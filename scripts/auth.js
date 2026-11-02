/**
 * Smart Notebook - Authentication Module
 * Supports Google Identity Services (GIS) Sign-In, token management, and multi-user switching.
 */

const TOKEN_KEY = 'sn_auth_token';
const USER_KEY = 'sn_auth_user';

let currentUser = null;
let currentToken = null;
const authChangeListeners = new Set();

export function onAuthStateChanged(callback) {
  authChangeListeners.add(callback);
  callback(currentUser);
  return () => authChangeListeners.delete(callback);
}

function notifyAuthChange() {
  authChangeListeners.forEach((fn) => fn(currentUser));
}

export function getAuthToken() {
  if (!currentToken) {
    currentToken = localStorage.getItem(TOKEN_KEY);
  }
  return currentToken;
}

export function getCurrentUser() {
  if (!currentUser) {
    const stored = localStorage.getItem(USER_KEY);
    if (stored) {
      try {
        currentUser = JSON.parse(stored);
      } catch (e) {}
    }
  }
  return currentUser;
}

export function getAuthHeaders() {
  const token = getAuthToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

/**
 * Initialize auth state on app boot
 */
export async function initAuth() {
  const token = getAuthToken();
  if (token) {
    try {
      const res = await fetch('/api/auth/me', {
        headers: getAuthHeaders(),
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.isAuthenticated) {
          currentUser = data.user;
          localStorage.setItem(USER_KEY, JSON.stringify(data.user));
          notifyAuthChange();
          return currentUser;
        }
      }
    } catch (err) {
      console.warn('Auth check fallback to cached user:', err.message);
    }
  }

  // Fallback to cached or guest
  currentUser = getCurrentUser() || {
    id: 'guest_user',
    email: 'guest@smartnotebook.local',
    name: 'Guest Learner',
    picture: '',
    isGuest: true
  };
  notifyAuthChange();
  return currentUser;
}

/**
 * Log in using Google credential JWT
 */
export async function loginWithGoogleCredential(credential) {
  const res = await fetch('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Google authentication failed');
  }

  const data = await res.json();
  setSession(data.token, data.user);
  return data.user;
}

/**
 * Log in via Demo / Multi-User Switcher
 */
export async function loginWithDemoAccount(email, name, picture) {
  const res = await fetch('/api/auth/demo-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name, picture })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Login failed');
  }

  const data = await res.json();
  setSession(data.token, data.user);
  return data.user;
}

export function setSession(token, user) {
  currentToken = token;
  currentUser = user;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  notifyAuthChange();
}

export async function logoutUser() {
  const token = getAuthToken();
  if (token) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: getAuthHeaders()
      });
    } catch (e) {}
  }

  currentToken = null;
  currentUser = {
    id: 'guest_user',
    email: 'guest@smartnotebook.local',
    name: 'Guest Learner',
    picture: '',
    isGuest: true
  };
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  notifyAuthChange();
}

/**
 * Get and update Google Client ID
 */
export async function getGoogleConfig() {
  try {
    const res = await fetch('/api/auth/config');
    if (res.ok) return await res.json();
  } catch (e) {}
  return { googleClientId: '', hasGoogleAuth: false };
}

export async function saveGoogleClientId(googleClientId) {
  const res = await fetch('/api/auth/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ googleClientId })
  });
  if (!res.ok) {
    throw new Error('Failed to save Google Client ID');
  }
  return await res.json();
}

/**
 * Initialize Google Identity Services (GIS) button and One Tap
 */
export function renderGoogleButton(containerId, clientId, onSuccess, onError = console.error) {
  if (!window.google || !window.google.accounts || !window.google.accounts.id) {
    console.warn('Google Identity Services script not yet loaded.');
    return;
  }

  if (!clientId) {
    return;
  }

  try {
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        if (response && response.credential) {
          onSuccess(response.credential);
        } else {
          onError(new Error('No credential returned from Google'));
        }
      },
      auto_select: false,
      cancel_on_tap_outside: true
    });

    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = '';
      window.google.accounts.id.renderButton(container, {
        theme: 'outline',
        size: 'large',
        type: 'standard',
        shape: 'rectangular',
        text: 'signin_with',
        logo_alignment: 'left',
        width: '320'
      });
    }

    // Attempt One Tap prompt if supported
    try {
      window.google.accounts.id.prompt();
    } catch (e) {}
  } catch (err) {
    onError(err);
  }
}
