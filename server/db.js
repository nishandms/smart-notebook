/**
 * Smart Notebook - Server Database Layer with Multi-User & Google Auth Support
 * Uses Node.js v24 native SQLite (node:sqlite) for persistent, zero-dependency multi-device storage.
 */

import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure data directory exists
const dataDir = join(__dirname, '..', 'data');
mkdirSync(dataDir, { recursive: true });

const dbPath = join(dataDir, 'notebook.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode
db.exec('PRAGMA journal_mode = WAL;');

// Initialize / Migrate Schema
function initializeSchema() {
  // Check if existing plans table has user_id
  const plansTable = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='plans'").get();
  if (plansTable && !plansTable.sql.includes('user_id')) {
    // Drop old single-user tables to migrate cleanly
    db.exec(`
      DROP TABLE IF EXISTS plans;
      DROP TABLE IF EXISTS days;
      DROP TABLE IF EXISTS activity_logs;
    `);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      picture TEXT,
      auth_provider TEXT DEFAULT 'google',
      created_at TEXT NOT NULL,
      last_login_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plans (
      user_id TEXT NOT NULL,
      id TEXT NOT NULL DEFAULT 'current',
      goal TEXT NOT NULL,
      duration INTEGER NOT NULL,
      target_language TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, id)
    );

    CREATE TABLE IF NOT EXISTS days (
      user_id TEXT NOT NULL,
      day INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      starter_code TEXT DEFAULT '',
      note TEXT DEFAULT '',
      code TEXT DEFAULT '',
      code_lang TEXT DEFAULT 'python',
      code_output TEXT DEFAULT '',
      status TEXT DEFAULT 'locked',
      completed_at TEXT,
      skipped_at TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, day)
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      payload TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

initializeSchema();

// ==========================================
// User & Session Management
// ==========================================

export function findOrCreateUser({ id, email, name, picture, authProvider = 'google' }) {
  const now = new Date().toISOString();
  const userId = id || `user_${randomUUID()}`;

  // Check if user exists by email
  const existingStmt = db.prepare('SELECT * FROM users WHERE email = ?');
  const existing = existingStmt.get(email);

  if (existing) {
    const updateStmt = db.prepare(`
      UPDATE users
      SET name = COALESCE(?, name),
          picture = COALESCE(?, picture),
          last_login_at = ?
      WHERE id = ?
    `);
    updateStmt.run(name, picture, now, existing.id);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(existing.id);
  }

  const insertStmt = db.prepare(`
    INSERT INTO users (id, email, name, picture, auth_provider, created_at, last_login_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertStmt.run(userId, email, name || 'Learner', picture || '', authProvider, now, now);

  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
}

export function createSession(userId) {
  const token = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

  const stmt = db.prepare(`
    INSERT INTO sessions (token, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(token, userId, now.toISOString(), expiresAt);

  return { token, expiresAt };
}

export function getUserBySession(token) {
  if (!token) return null;

  const stmt = db.prepare(`
    SELECT u.*, s.expires_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ?
  `);
  const row = stmt.get(token);
  if (!row) return null;

  // Check expiration
  if (new Date(row.expires_at) < new Date()) {
    deleteSession(token);
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    picture: row.picture,
    authProvider: row.auth_provider,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at
  };
}

export function deleteSession(token) {
  const stmt = db.prepare('DELETE FROM sessions WHERE token = ?');
  stmt.run(token);
  return true;
}

// App Settings (e.g. Google Client ID)
export function getSetting(key) {
  const stmt = db.prepare('SELECT value FROM app_settings WHERE key = ?');
  const row = stmt.get(key);
  return row ? row.value : null;
}

export function setSetting(key, value) {
  const stmt = db.prepare(`
    INSERT INTO app_settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  stmt.run(key, value);
  return true;
}

// ==========================================
// Scoped Plans & Days Storage (Per User)
// ==========================================

export function savePlan(userId, meta, days) {
  const now = new Date().toISOString();

  db.exec('BEGIN TRANSACTION;');
  try {
    const deleteDays = db.prepare('DELETE FROM days WHERE user_id = ?');
    deleteDays.run(userId);

    const deletePlan = db.prepare("DELETE FROM plans WHERE user_id = ? AND id = 'current'");
    deletePlan.run(userId);

    const insertPlan = db.prepare(`
      INSERT INTO plans (user_id, id, goal, duration, target_language, status, created_at, updated_at)
      VALUES (?, 'current', ?, ?, ?, 'active', ?, ?)
    `);
    insertPlan.run(userId, meta.goal, Number(meta.duration), meta.targetLanguage || 'python', now, now);

    const insertDay = db.prepare(`
      INSERT INTO days (user_id, day, title, description, starter_code, note, code, code_lang, code_output, status, completed_at, skipped_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    days.forEach((item, index) => {
      const initialStatus = index === 0 ? 'active' : (item.status || 'locked');
      insertDay.run(
        userId,
        Number(item.day),
        item.title,
        item.description,
        item.starterCode || '',
        item.note || '',
        item.code || (item.starterCode || ''),
        item.codeLang || meta.targetLanguage || 'python',
        item.codeOutput || '',
        initialStatus,
        item.completedAt || null,
        item.skippedAt || null,
        now
      );
    });

    const insertLog = db.prepare(`
      INSERT INTO activity_logs (user_id, type, payload, created_at) VALUES (?, ?, ?, ?)
    `);
    insertLog.run(userId, 'PLAN_CREATED', JSON.stringify({ goal: meta.goal, duration: meta.duration }), now);

    db.exec('COMMIT;');
    return { success: true, count: days.length };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function getPlan(userId) {
  const stmt = db.prepare("SELECT * FROM plans WHERE user_id = ? AND id = 'current' LIMIT 1;");
  const row = stmt.get(userId);
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    goal: row.goal,
    duration: row.duration,
    targetLanguage: row.target_language,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function getDays(userId) {
  const stmt = db.prepare('SELECT * FROM days WHERE user_id = ? ORDER BY day ASC;');
  const rows = stmt.all(userId);

  return rows.map((r) => ({
    day: r.day,
    title: r.title,
    description: r.description,
    starterCode: r.starter_code,
    note: r.note,
    code: r.code,
    codeLang: r.code_lang,
    codeOutput: r.code_output,
    status: r.status,
    completedAt: r.completed_at,
    skippedAt: r.skipped_at,
    updatedAt: r.updated_at
  }));
}

export function getDay(userId, dayNumber) {
  const stmt = db.prepare('SELECT * FROM days WHERE user_id = ? AND day = ?;');
  const r = stmt.get(userId, Number(dayNumber));
  if (!r) return null;

  return {
    day: r.day,
    title: r.title,
    description: r.description,
    starterCode: r.starter_code,
    note: r.note,
    code: r.code,
    codeLang: r.code_lang,
    codeOutput: r.code_output,
    status: r.status,
    completedAt: r.completed_at,
    skippedAt: r.skipped_at,
    updatedAt: r.updated_at
  };
}

export function updateDayRecord(userId, dayNumber, updates) {
  const day = getDay(userId, dayNumber);
  if (!day) {
    throw new Error(`Day ${dayNumber} not found for this user`);
  }

  const now = new Date().toISOString();
  const merged = { ...day, ...updates, updatedAt: now };

  const stmt = db.prepare(`
    UPDATE days
    SET note = ?, code = ?, code_lang = ?, code_output = ?, status = ?, completed_at = ?, skipped_at = ?, updated_at = ?
    WHERE user_id = ? AND day = ?
  `);

  stmt.run(
    merged.note || '',
    merged.code || '',
    merged.codeLang || 'python',
    merged.codeOutput || '',
    merged.status,
    merged.completedAt || null,
    merged.skippedAt || null,
    now,
    userId,
    Number(dayNumber)
  );

  return getDay(userId, dayNumber);
}

export function completeDay(userId, dayNumber, { note, code, codeOutput, codeLang }) {
  const dayNum = Number(dayNumber);
  const now = new Date().toISOString();

  db.exec('BEGIN TRANSACTION;');
  try {
    const updateCurrent = db.prepare(`
      UPDATE days
      SET status = 'completed',
          note = COALESCE(?, note),
          code = COALESCE(?, code),
          code_output = COALESCE(?, code_output),
          code_lang = COALESCE(?, code_lang),
          completed_at = ?,
          updated_at = ?
      WHERE user_id = ? AND day = ?
    `);
    updateCurrent.run(note, code, codeOutput, codeLang, now, now, userId, dayNum);

    // Unlock next day if locked
    const nextDayNum = dayNum + 1;
    const nextStmt = db.prepare('SELECT status FROM days WHERE user_id = ? AND day = ?');
    const nextRow = nextStmt.get(userId, nextDayNum);
    if (nextRow && nextRow.status === 'locked') {
      const unlockStmt = db.prepare("UPDATE days SET status = 'active', updated_at = ? WHERE user_id = ? AND day = ?");
      unlockStmt.run(now, userId, nextDayNum);
    }

    db.exec('COMMIT;');
    return { success: true, day: dayNum, nextDayUnlocked: !!nextRow };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function skipDay(userId, dayNumber) {
  const dayNum = Number(dayNumber);
  const now = new Date().toISOString();

  db.exec('BEGIN TRANSACTION;');
  try {
    const updateCurrent = db.prepare(`
      UPDATE days
      SET status = 'skipped',
          skipped_at = ?,
          updated_at = ?
      WHERE user_id = ? AND day = ?
    `);
    updateCurrent.run(now, now, userId, dayNum);

    const nextDayNum = dayNum + 1;
    const nextStmt = db.prepare('SELECT status FROM days WHERE user_id = ? AND day = ?');
    const nextRow = nextStmt.get(userId, nextDayNum);
    if (nextRow && nextRow.status === 'locked') {
      const unlockStmt = db.prepare("UPDATE days SET status = 'active', updated_at = ? WHERE user_id = ? AND day = ?");
      unlockStmt.run(now, userId, nextDayNum);
    }

    db.exec('COMMIT;');
    return { success: true, day: dayNum, nextDayUnlocked: !!nextRow };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function resetDatabase(userId) {
  db.exec('BEGIN TRANSACTION;');
  try {
    db.prepare('DELETE FROM plans WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM days WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM activity_logs WHERE user_id = ?').run(userId);
    db.exec('COMMIT;');
    return true;
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function exportAll(userId) {
  const plan = getPlan(userId);
  const days = getDays(userId);
  return {
    version: 1,
    userId,
    exportedAt: new Date().toISOString(),
    plan,
    days
  };
}
