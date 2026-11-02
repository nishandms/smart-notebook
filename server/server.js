/**
 * Smart Notebook - Express Backend Server with Multi-User & Google Authentication
 */

import express from 'express';
import cors from 'cors';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

import {
  findOrCreateUser,
  createSession,
  getUserBySession,
  deleteSession,
  getSetting,
  setSetting,
  savePlan,
  getPlan,
  getDays,
  getDay,
  updateDayRecord,
  completeDay,
  skipDay,
  resetDatabase,
  exportAll
} from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Helper: Get all IPv4 network addresses on the local machine
function getLocalNetworkAddresses() {
  const nets = networkInterfaces();
  const results = [];

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        results.push({
          interface: name,
          address: net.address,
          urlFrontend: `http://${net.address}:5180`,
          urlBackend: `http://${net.address}:${PORT}`
        });
      }
    }
  }

  return results;
}

// Authentication Middleware: Resolves user via Bearer token or defaults to Guest
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const user = getUserBySession(token);
    if (user) {
      req.user = user;
      req.token = token;
      return next();
    }
  }

  // Fallback to default guest user
  req.user = {
    id: 'guest_user',
    email: 'guest@smartnotebook.local',
    name: 'Guest Learner',
    picture: '',
    isGuest: true
  };
  next();
}

app.use(authMiddleware);

// ==========================================
// Authentication Endpoints
// ==========================================

// Google Sign-In verification endpoint
app.post('/api/auth/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ error: 'Missing Google credential token' });
  }

  try {
    let payload = null;

    // Verify token with Google's tokeninfo service
    try {
      const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, {
        signal: AbortSignal.timeout(5000)
      });
      if (googleRes.ok) {
        payload = await googleRes.json();
      }
    } catch (err) {
      console.warn('Google tokeninfo fetch failed or timed out, decoding payload:', err.message);
    }

    // Fallback: decode JWT payload if direct verification timed out (e.g. offline dev)
    if (!payload) {
      const parts = credential.split('.');
      if (parts.length === 3) {
        const decoded = Buffer.from(parts[1], 'base64url').toString('utf8');
        payload = JSON.parse(decoded);
      }
    }

    if (!payload || !payload.email) {
      return res.status(401).json({ error: 'Invalid Google credential token' });
    }

    // Find or create user in SQLite
    const user = findOrCreateUser({
      id: payload.sub ? `google_${payload.sub}` : undefined,
      email: payload.email,
      name: payload.name || payload.email.split('@')[0],
      picture: payload.picture || '',
      authProvider: 'google'
    });

    const session = createSession(user.id);

    res.json({
      success: true,
      token: session.token,
      expiresAt: session.expiresAt,
      user
    });
  } catch (err) {
    console.error('Google Auth Error:', err);
    res.status(500).json({ error: 'Failed to authenticate with Google: ' + err.message });
  }
});

// Demo / Multi-User Test Login (for switching users without a Google Client ID setup)
app.post('/api/auth/demo-login', (req, res) => {
  try {
    const { email, name, picture } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = findOrCreateUser({
      email: email.trim().toLowerCase(),
      name: name || email.split('@')[0],
      picture: picture || '',
      authProvider: 'demo'
    });

    const session = createSession(user.id);

    res.json({
      success: true,
      token: session.token,
      expiresAt: session.expiresAt,
      user
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Current User Profile
app.get('/api/auth/me', (req, res) => {
  res.json({
    user: req.user,
    isAuthenticated: !req.user.isGuest
  });
});

// Logout Session
app.post('/api/auth/logout', (req, res) => {
  if (req.token) {
    deleteSession(req.token);
  }
  res.json({ success: true });
});

// Get Google Client ID Config
app.get('/api/auth/config', (req, res) => {
  const googleClientId = process.env.GOOGLE_CLIENT_ID || getSetting('google_client_id') || '';
  res.json({
    googleClientId,
    hasGoogleAuth: Boolean(googleClientId)
  });
});

// Save Google Client ID Config (from Settings UI)
app.post('/api/auth/config', (req, res) => {
  const { googleClientId } = req.body;
  if (typeof googleClientId === 'string') {
    setSetting('google_client_id', googleClientId.trim());
    return res.json({ success: true, googleClientId: googleClientId.trim() });
  }
  res.status(400).json({ error: 'Invalid googleClientId' });
});

// ==========================================
// Health & Network Info
// ==========================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    serverTime: new Date().toISOString(),
    multiDeviceReady: true,
    user: req.user.email
  });
});

app.get('/api/network-info', (req, res) => {
  const addresses = getLocalNetworkAddresses();
  res.json({
    port: PORT,
    frontendPort: 5180,
    devices: addresses
  });
});

// ==========================================
// Scoped Roadmap & Days Endpoints
// ==========================================

app.get('/api/plan', (req, res) => {
  try {
    const plan = getPlan(req.user.id);
    const days = getDays(req.user.id);
    res.json({ plan, days, user: req.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/plan', (req, res) => {
  try {
    const { goal, duration, targetLanguage, days } = req.body;

    if (!goal || !duration || !Array.isArray(days) || days.length === 0) {
      return res.status(400).json({ error: 'Missing required fields: goal, duration, days' });
    }

    const result = savePlan(req.user.id, { goal, duration, targetLanguage }, days);
    res.json({
      success: true,
      plan: getPlan(req.user.id),
      days: getDays(req.user.id)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/days', (req, res) => {
  try {
    const days = getDays(req.user.id);
    res.json(days);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/days/:day', (req, res) => {
  try {
    const day = getDay(req.user.id, req.params.day);
    if (!day) {
      return res.status(404).json({ error: `Day ${req.params.day} not found for current user` });
    }
    res.json(day);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/days/:day', (req, res) => {
  try {
    const dayNum = Number(req.params.day);
    const updated = updateDayRecord(req.user.id, dayNum, req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/days/:day/complete', (req, res) => {
  try {
    const dayNum = Number(req.params.day);
    const { note, code, codeOutput, codeLang } = req.body;
    const result = completeDay(req.user.id, dayNum, { note, code, codeOutput, codeLang });
    res.json({
      success: true,
      day: getDay(req.user.id, dayNum),
      days: getDays(req.user.id)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/days/:day/skip', (req, res) => {
  try {
    const dayNum = Number(req.params.day);
    const result = skipDay(req.user.id, dayNum);
    res.json({
      success: true,
      day: getDay(req.user.id, dayNum),
      days: getDays(req.user.id)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reset', (req, res) => {
  try {
    resetDatabase(req.user.id);
    res.json({ success: true, message: 'Roadmap reset for current user' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/export', (req, res) => {
  try {
    const data = exportAll(req.user.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend dist if available (for production standalone deployment)
const distDir = join(__dirname, '..', 'dist');
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(join(distDir, 'index.html'));
  });
}

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Smart Notebook Backend Running with Multi-User & Google Auth`);
  console.log(`======================================================`);
  console.log(`Port:            ${PORT}`);
  console.log(`Local Access:    http://localhost:${PORT}`);

  const addresses = getLocalNetworkAddresses();
  if (addresses.length > 0) {
    console.log(`\n📱 Multi-Device Network Access (Open on Phone/Tablet):`);
    addresses.forEach((addr) => {
      console.log(`   - [${addr.interface}]: http://${addr.address}:5180 (Frontend)`);
      console.log(`                          http://${addr.address}:${PORT} (Backend API)`);
    });
  }
  console.log(`======================================================\n`);
});
