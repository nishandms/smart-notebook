/**
 * Smart Notebook - Storage & Synchronization Layer
 * Hybrid Offline-First architecture:
 * - Persists locally in browser IndexedDB (100% offline support).
 * - Synchronizes with backend SQLite server when connected (multi-device & multi-user access).
 */

import { getAuthHeaders } from './auth.js';

const DB_NAME = 'SmartNotebookDB';
const DB_VERSION = 1;
const API_BASE = '/api';

let dbPromise = null;
let isServerOnline = false;

// Callbacks for sync status changes
const syncStatusListeners = new Set();

export function onSyncStatusChange(callback) {
  syncStatusListeners.add(callback);
  callback({ online: isServerOnline });
  return () => syncStatusListeners.delete(callback);
}

function notifySyncStatus(online) {
  isServerOnline = online;
  syncStatusListeners.forEach((fn) => fn({ online }));
}

/**
 * Check if the centralized multi-device server is reachable
 */
export async function checkServerHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, {
      headers: getAuthHeaders(),
      signal: AbortSignal.timeout(1500)
    });
    if (res.ok) {
      const data = await res.json();
      notifySyncStatus(true);
      return { online: true, data };
    }
  } catch (err) {
    // Server is unreachable, stay in local IndexedDB mode
  }
  notifySyncStatus(false);
  return { online: false };
}

/**
 * Fetch local network URLs for multi-device pairing (phone, tablet, laptop)
 */
export async function getNetworkDeviceInfo() {
  try {
    const res = await fetch(`${API_BASE}/network-info`, { signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    // Ignore if offline
  }
  return { devices: [] };
}

/**
 * Initialize local browser IndexedDB
 */
export function openDatabase() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('plans')) {
        db.createObjectStore('plans', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('days')) {
        const dayStore = db.createObjectStore('days', { keyPath: 'day' });
        dayStore.createIndex('status', 'status', { unique: false });
      }

      if (!db.objectStoreNames.contains('activityLogs')) {
        db.createObjectStore('activityLogs', { autoIncrement: true, keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => {
      console.error('IndexedDB error:', event.target.error);
      reject(event.target.error);
    };
  });

  return dbPromise;
}

/**
 * Clear local IndexedDB stores (used when switching user accounts)
 */
export async function clearLocalIndexedDBCache() {
  const db = await openDatabase();
  return new Promise((resolve) => {
    const tx = db.transaction(['plans', 'days'], 'readwrite');
    tx.objectStore('plans').clear();
    tx.objectStore('days').clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

/**
 * Save new learning plan and day milestones
 * (Synchronizes to Backend SQLite with Auth and saves locally in IndexedDB)
 */
export async function saveLearningPlan(meta, days) {
  const db = await openDatabase();

  // 1. Save in local IndexedDB
  await new Promise((resolve, reject) => {
    const tx = db.transaction(['plans', 'days', 'activityLogs'], 'readwrite');
    const planStore = tx.objectStore('plans');
    const dayStore = tx.objectStore('days');
    const logStore = tx.objectStore('activityLogs');

    dayStore.clear();

    const planData = {
      id: 'current',
      goal: meta.goal,
      duration: Number(meta.duration),
      targetLanguage: meta.targetLanguage || 'python',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active'
    };

    planStore.put(planData);

    days.forEach((item, index) => {
      const initialStatus = index === 0 ? 'active' : (item.status || 'locked');
      dayStore.put({
        day: Number(item.day),
        title: item.title,
        description: item.description,
        starterCode: item.starterCode || '',
        note: item.note || '',
        code: item.code || (item.starterCode || ''),
        codeLang: item.codeLang || meta.targetLanguage || 'python',
        codeOutput: item.codeOutput || '',
        status: initialStatus,
        completedAt: item.completedAt || null,
        skippedAt: item.skippedAt || null,
        updatedAt: new Date().toISOString()
      });
    });

    logStore.add({
      type: 'PLAN_CREATED',
      goal: meta.goal,
      timestamp: new Date().toISOString()
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // 2. Synchronize to Backend Server if online
  try {
    const res = await fetch(`${API_BASE}/plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({
        goal: meta.goal,
        duration: meta.duration,
        targetLanguage: meta.targetLanguage,
        days
      })
    });
    if (res.ok) {
      notifySyncStatus(true);
    }
  } catch (err) {
    console.warn('Backend sync deferred (offline):', err.message);
  }

  return { success: true, count: days.length };
}

/**
 * Get active learning plan metadata
 * (Tries Backend first to ensure latest sync across devices; falls back to IndexedDB)
 */
export async function getCurrentPlan() {
  // Try backend first
  try {
    const res = await fetch(`${API_BASE}/plan`, {
      headers: getAuthHeaders(),
      signal: AbortSignal.timeout(1500)
    });
    if (res.ok) {
      const data = await res.json();
      notifySyncStatus(true);
      if (data.plan) {
        // Cache to IndexedDB
        const db = await openDatabase();
        const tx = db.transaction(['plans', 'days'], 'readwrite');
        tx.objectStore('plans').put(data.plan);
        if (Array.isArray(data.days)) {
          const dayStore = tx.objectStore('days');
          data.days.forEach((d) => dayStore.put(d));
        }
        return data.plan;
      } else {
        // Backend returned empty plan for this user
        return null;
      }
    }
  } catch (err) {
    // Offline, fallback to local IndexedDB
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['plans'], 'readonly');
    const store = tx.objectStore('plans');
    const req = store.get('current');
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get all timeline day records sorted by day number
 */
export async function getAllDays() {
  // Try backend first for multi-device sync
  try {
    const res = await fetch(`${API_BASE}/days`, {
      headers: getAuthHeaders(),
      signal: AbortSignal.timeout(1500)
    });
    if (res.ok) {
      const serverDays = await res.json();
      notifySyncStatus(true);
      if (Array.isArray(serverDays) && serverDays.length > 0) {
        // Cache into local IndexedDB
        const db = await openDatabase();
        const tx = db.transaction(['days'], 'readwrite');
        const dayStore = tx.objectStore('days');
        serverDays.forEach((d) => dayStore.put(d));
        return serverDays.sort((a, b) => a.day - b.day);
      } else if (Array.isArray(serverDays) && serverDays.length === 0) {
        return [];
      }
    }
  } catch (err) {
    // Offline
  }

  // Fallback to IndexedDB
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['days'], 'readonly');
    const store = tx.objectStore('days');
    const req = store.getAll();
    req.onsuccess = () => {
      const sorted = (req.result || []).sort((a, b) => a.day - b.day);
      resolve(sorted);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get a specific day record
 */
export async function getDay(dayNumber) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['days'], 'readonly');
    const store = tx.objectStore('days');
    const req = store.get(Number(dayNumber));
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Update a day's fields (notes, code, status, etc.)
 */
export async function updateDay(dayNumber, updates) {
  const dayNum = Number(dayNumber);
  const db = await openDatabase();

  // 1. Update IndexedDB locally
  const updatedRecord = await new Promise((resolve, reject) => {
    const tx = db.transaction(['days'], 'readwrite');
    const store = tx.objectStore('days');
    const getReq = store.get(dayNum);

    getReq.onsuccess = () => {
      const record = getReq.result;
      if (!record) {
        reject(new Error(`Day ${dayNum} not found`));
        return;
      }

      const updated = {
        ...record,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve(updated);
      putReq.onerror = () => reject(putReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });

  // 2. Sync to Backend
  try {
    fetch(`${API_BASE}/days/${dayNum}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(updates)
    }).catch(() => {});
  } catch (e) {}

  return updatedRecord;
}

/**
 * Reset all data
 */
export async function resetAllData() {
  const db = await openDatabase();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(['plans', 'days', 'activityLogs'], 'readwrite');
    tx.objectStore('plans').clear();
    tx.objectStore('days').clear();
    tx.objectStore('activityLogs').clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });

  // Reset backend
  try {
    await fetch(`${API_BASE}/reset`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
  } catch (e) {}

  return true;
}

/**
 * Export full database contents as JSON string
 */
export async function exportAllData() {
  // If server is available, get from server; else export local IndexedDB
  try {
    const res = await fetch(`${API_BASE}/export`, {
      headers: getAuthHeaders(),
      signal: AbortSignal.timeout(1500)
    });
    if (res.ok) {
      const data = await res.json();
      return JSON.stringify(data, null, 2);
    }
  } catch (e) {}

  const plan = await getCurrentPlan();
  const days = await getAllDays();
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    plan,
    days
  }, null, 2);
}
