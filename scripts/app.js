/**
 * Smart Notebook - Main Application Controller
 * Handles SPA navigation, UI rendering, progression logic, task modal, and compiler execution.
 */

import '../styles/main.css';

import {
  openDatabase,
  saveLearningPlan,
  getCurrentPlan,
  getAllDays,
  getDay,
  updateDay,
  resetAllData,
  exportAllData,
  checkServerHealth,
  getNetworkDeviceInfo,
  onSyncStatusChange,
  clearLocalIndexedDBCache
} from './db.js';

import {
  initAuth,
  getCurrentUser,
  onAuthStateChanged,
  loginWithGoogleCredential,
  loginWithDemoAccount,
  logoutUser,
  getGoogleConfig,
  saveGoogleClientId,
  renderGoogleButton
} from './auth.js';

import {
  generatePrompt,
  cleanAiResponse,
  validatePlanJson,
  getSamplePlan
} from './promptGenerator.js';

import {
  runPythonCode,
  runJavaScriptCode
} from './compilers.js';

// ==========================================
// Application State
// ==========================================
const state = {
  currentView: 'config',
  plan: null,
  days: [],
  activeDayModal: null,
  activeModalTab: 'note',
  selectedLanguage: 'python',
  isExecutingCode: false,
  activeAuthTab: 'google',
  googleClientId: '',
  sliderDayNumber: 1,
  calendarWeekOffset: 0
};

// ==========================================
// DOM Element Selectors
// ==========================================
const DOM = {
  // Top Navigation & Back to Home
  brandHomeBtn: document.getElementById('brandHomeBtn'),
  btnBackToHome: document.getElementById('btnBackToHome'),
  settingsMenuWrapper: document.getElementById('settingsMenuWrapper'),
  btnOpenSettings: document.getElementById('btnOpenSettings'),
  settingsDropdownMenu: document.getElementById('settingsDropdownMenu'),
  btnSettingsPlanSetup: document.getElementById('btnSettingsPlanSetup'),
  btnSettingsDeviceSync: document.getElementById('btnSettingsDeviceSync'),
  btnSettingsGoogleConfig: document.getElementById('btnSettingsGoogleConfig'),
  btnSettingsExportJson: document.getElementById('btnSettingsExportJson'),
  btnSettingsResetAll: document.getElementById('btnSettingsResetAll'),

  // Mobile Footer Navigation Bar
  mobileFooterNav: document.getElementById('mobileFooterNav'),
  mobNavDashboard: document.getElementById('mobNavDashboard'),
  mobNavConfig: document.getElementById('mobNavConfig'),
  mobNavProfile: document.getElementById('mobNavProfile'),
  mobNavSettings: document.getElementById('mobNavSettings'),

  // Multi-Device Sync & Modal
  btnSyncStatus: document.getElementById('btnSyncStatus'),
  statusDot: document.getElementById('statusDot'),
  statusLabel: document.getElementById('statusLabel'),
  deviceModal: document.getElementById('deviceModal'),
  btnDeviceModalClose: document.getElementById('btnDeviceModalClose'),
  btnDeviceModalDone: document.getElementById('btnDeviceModalDone'),
  deviceUrlsList: document.getElementById('deviceUrlsList'),
  btnModalOpenPlanSetup: document.getElementById('btnModalOpenPlanSetup'),

  // Auth & User Menu
  btnOpenAuthModal: document.getElementById('btnOpenAuthModal'),
  navAuthBtnText: document.getElementById('navAuthBtnText'),
  userMenuGroup: document.getElementById('userMenuGroup'),
  btnUserMenu: document.getElementById('btnUserMenu'),
  userNavAvatar: document.getElementById('userNavAvatar'),
  userNavFallback: document.getElementById('userNavFallback'),
  userNavName: document.getElementById('userNavName'),
  userDropdownMenu: document.getElementById('userDropdownMenu'),
  userDropdownName: document.getElementById('userDropdownName'),
  userDropdownEmail: document.getElementById('userDropdownEmail'),
  btnUserDropdownProfile: document.getElementById('btnUserDropdownProfile'),
  btnUserDropdownSignIn: document.getElementById('btnUserDropdownSignIn'),
  btnSwitchAccount: document.getElementById('btnSwitchAccount'),
  btnOpenGoogleSettings: document.getElementById('btnOpenGoogleSettings'),
  btnSignOut: document.getElementById('btnSignOut'),

  // Auth Modal
  authModal: document.getElementById('authModal'),
  btnAuthModalClose: document.getElementById('btnAuthModalClose'),
  btnAuthModalDone: document.getElementById('btnAuthModalDone'),
  tabBtnAuthGoogle: document.getElementById('tabBtnAuthGoogle'),
  tabBtnAuthDemo: document.getElementById('tabBtnAuthDemo'),
  tabBtnAuthSettings: document.getElementById('tabBtnAuthSettings'),
  paneAuthGoogle: document.getElementById('paneAuthGoogle'),
  paneAuthDemo: document.getElementById('paneAuthDemo'),
  paneAuthSettings: document.getElementById('paneAuthSettings'),
  googleBtnContainer: document.getElementById('googleBtnContainer'),
  googleUnconfiguredBox: document.getElementById('googleUnconfiguredBox'),
  btnGoToSettingsTab: document.getElementById('btnGoToSettingsTab'),
  btnGoToDemoTab: document.getElementById('btnGoToDemoTab'),
  formSaveGoogleClient: document.getElementById('formSaveGoogleClient'),
  inputGoogleClientId: document.getElementById('inputGoogleClientId'),
  customUserLoginForm: document.getElementById('customUserLoginForm'),
  inputCustomEmail: document.getElementById('inputCustomEmail'),
  inputCustomName: document.getElementById('inputCustomName'),

  // Views
  viewConfig: document.getElementById('viewConfig'),
  viewDashboard: document.getElementById('viewDashboard'),
  viewProfile: document.getElementById('viewProfile'),

  // Config Form
  planConfigForm: document.getElementById('planConfigForm'),
  inputGoal: document.getElementById('inputGoal'),
  inputDuration: document.getElementById('inputDuration'),
  inputLanguage: document.getElementById('inputLanguage'),
  btnGeneratePrompt: document.getElementById('btnGeneratePrompt'),
  btnQuickSample: document.getElementById('btnQuickSample'),
  promptOutputSection: document.getElementById('promptOutputSection'),
  promptTextDisplay: document.getElementById('promptTextDisplay'),
  btnCopyPrompt: document.getElementById('btnCopyPrompt'),
  aiJsonResponse: document.getElementById('aiJsonResponse'),
  schemaErrorAlert: document.getElementById('schemaErrorAlert'),
  schemaErrorText: document.getElementById('schemaErrorText'),
  btnValidateAndSave: document.getElementById('btnValidateAndSave'),

  // Dashboard Hero & Metrics
  dashTodayLabel: document.getElementById('dashTodayLabel'),
  dashDateTitle: document.getElementById('dashDateTitle'),
  dashGoalSubtitle: document.getElementById('dashGoalSubtitle'),
  dashGoalTitle: document.getElementById('dashGoalTitle'),
  dashGoalLanguage: document.getElementById('dashGoalLanguage'),
  dashGoalTimeline: document.getElementById('dashGoalTimeline'),
  dashGoalStatus: document.getElementById('dashGoalStatus'),
  btnCreateNewPlan: document.getElementById('btnCreateNewPlan'),

  headerProgressCard: document.getElementById('headerProgressCard'),
  dashHeaderRingFill: document.getElementById('dashHeaderRingFill'),
  dashHeaderPercent: document.getElementById('dashHeaderPercent'),

  widgetCompletedDays: document.getElementById('widgetCompletedDays'),
  widgetTotalDays: document.getElementById('widgetTotalDays'),
  widgetCompletedFill: document.getElementById('widgetCompletedFill'),
  widgetCompletedSubtext: document.getElementById('widgetCompletedSubtext'),

  widgetPendingDays: document.getElementById('widgetPendingDays'),
  widgetPendingBreakdown: document.getElementById('widgetPendingBreakdown'),

  widgetConsistencyCircle: document.getElementById('widgetConsistencyCircle'),
  widgetConsistencyText: document.getElementById('widgetConsistencyText'),
  widgetConsistencyLabel: document.getElementById('widgetConsistencyLabel'),

  // Continuous 3D Virtual Card Stack Deck
  cardStackDeck: document.getElementById('cardStackDeck'),
  shellPercentText: document.getElementById('shellPercentText'),
  btnSliderPrev: document.getElementById('btnSliderPrev'),
  btnSliderNext: document.getElementById('btnSliderNext'),

  // Layered Next Up Peek Info Pill
  nextUpPeekLayer: document.getElementById('nextUpPeekLayer'),
  nextUpTitle: document.getElementById('nextUpTitle'),

  // Calendar Strip
  calWeekTitle: document.getElementById('calWeekTitle'),
  calDateRange: document.getElementById('calDateRange'),
  btnCalPrevWeek: document.getElementById('btnCalPrevWeek'),
  btnCalNextWeek: document.getElementById('btnCalNextWeek'),
  calendarDaysRow: document.getElementById('calendarDaysRow'),

  // Bottom Floating Pill
  btnBottomGoalPill: document.getElementById('btnBottomGoalPill'),
  bottomGoalPillText: document.getElementById('bottomGoalPillText'),

  timelineContainer: document.getElementById('timelineContainer'),

  // Task Modal
  taskModal: document.getElementById('taskModal'),
  btnModalClose: document.getElementById('btnModalClose'),
  modalDayPill: document.getElementById('modalDayPill'),
  modalTitle: document.getElementById('modalTitle'),
  modalDescription: document.getElementById('modalDescription'),

  tabBtnNote: document.getElementById('tabBtnNote'),
  tabBtnCode: document.getElementById('tabBtnCode'),
  paneNote: document.getElementById('paneNote'),
  paneCode: document.getElementById('paneCode'),

  noteInput: document.getElementById('noteInput'),
  noteCharCount: document.getElementById('noteCharCount'),
  noteAutosaveStatus: document.getElementById('noteAutosaveStatus'),

  pillLangPython: document.getElementById('pillLangPython'),
  pillLangJS: document.getElementById('pillLangJS'),
  editorLanguageLabel: document.getElementById('editorLanguageLabel'),
  codeInput: document.getElementById('codeInput'),
  btnRunCode: document.getElementById('btnRunCode'),
  btnClearTerminal: document.getElementById('btnClearTerminal'),
  terminalOutput: document.getElementById('terminalOutput'),
  terminalExecutionTime: document.getElementById('terminalExecutionTime'),

  completionHint: document.getElementById('completionHint'),
  completionHintText: document.getElementById('completionHintText'),
  btnModalSkip: document.getElementById('btnModalSkip'),
  btnModalComplete: document.getElementById('btnModalComplete'),

  // Profile View
  profileAvatar: document.getElementById('profileAvatar'),
  profileActiveGoalText: document.getElementById('profileActiveGoalText'),
  statCompletionRate: document.getElementById('statCompletionRate'),
  statConsistencyScore: document.getElementById('statConsistencyScore'),
  statCompletedCount: document.getElementById('statCompletedCount'),
  statTotalWords: document.getElementById('statTotalWords'),
  backlogCountBadge: document.getElementById('backlogCountBadge'),
  profileBacklogContainer: document.getElementById('profileBacklogContainer'),

  btnExportJson: document.getElementById('btnExportJson'),
  btnExportMarkdown: document.getElementById('btnExportMarkdown'),
  btnResetAll: document.getElementById('btnResetAll'),

  toastContainer: document.getElementById('toastContainer')
};

// ==========================================
// Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await openDatabase();
    setupEventListeners();

    // Listen to Multi-Device synchronization status
    onSyncStatusChange(({ online }) => {
      if (online) {
        if (DOM.statusDot) DOM.statusDot.classList.remove('offline');
        if (DOM.statusLabel) DOM.statusLabel.textContent = 'Synced (Multi-Device)';
        if (DOM.btnSyncStatus) DOM.btnSyncStatus.title = 'Connected to Backend SQLite Server. Click to view pairing URLs.';
        if (DOM.btnOpenSettings) DOM.btnOpenSettings.title = 'Settings (Multi-Device Synced)';
      } else {
        if (DOM.statusDot) DOM.statusDot.classList.add('offline');
        if (DOM.statusLabel) DOM.statusLabel.textContent = 'Offline (IndexedDB)';
        if (DOM.btnSyncStatus) DOM.btnSyncStatus.title = 'Offline mode active. Data saved in browser.';
        if (DOM.btnOpenSettings) DOM.btnOpenSettings.title = 'Settings (Offline Mode)';
      }
    });

    // Check server health immediately & periodically
    checkServerHealth();
    setInterval(checkServerHealth, 8000);

    // Initialize User Session & Auth Listener
    onAuthStateChanged((user) => {
      renderUserAuthState(user);
    });
    await initAuth();

    // Initialize Google Identity Services if client ID is set
    await setupGoogleIdentity();

    await loadInitialData();
  } catch (err) {
    console.error('Initialization error:', err);
    showToast('Database initialization error: ' + err.message, 'danger');
  }
});

async function setupGoogleIdentity() {
  const config = await getGoogleConfig();
  state.googleClientId = config.googleClientId || '';

  if (state.googleClientId) {
    DOM.inputGoogleClientId.value = state.googleClientId;
    DOM.googleUnconfiguredBox.style.display = 'none';

    // Render Google GIS button
    renderGoogleButton('googleBtnContainer', state.googleClientId, async (credential) => {
      try {
        const user = await loginWithGoogleCredential(credential);
        closeAuthModal();
        await reloadUserData();
        showToast(`Welcome, ${user.name}! Roadmaps synced with Google account.`, 'success');
      } catch (err) {
        showToast('Google Sign-In failed: ' + err.message, 'danger');
      }
    }, (err) => {
      console.warn('GIS error:', err);
    });
  } else {
    DOM.googleUnconfiguredBox.style.display = 'block';
    DOM.googleBtnContainer.innerHTML = '';
  }
}

function renderUserAuthState(user) {
  DOM.userMenuGroup.style.display = 'block';

  if (user && !user.isGuest) {
    DOM.btnOpenAuthModal.style.display = 'none';

    DOM.userNavName.textContent = user.name.split(' ')[0];
    DOM.userDropdownName.textContent = user.name;
    DOM.userDropdownEmail.textContent = user.email;

    if (user.picture) {
      DOM.userNavAvatar.src = user.picture;
      DOM.userNavAvatar.style.display = 'block';
      DOM.userNavFallback.style.display = 'none';
    } else {
      DOM.userNavFallback.textContent = user.name.charAt(0).toUpperCase();
      DOM.userNavFallback.style.display = 'flex';
      DOM.userNavAvatar.style.display = 'none';
    }

    if (DOM.btnSignOut) DOM.btnSignOut.style.display = 'flex';
    if (DOM.btnUserDropdownSignIn) DOM.btnUserDropdownSignIn.style.display = 'none';

    // Profile view header update
    if (DOM.profileAvatar) {
      DOM.profileAvatar.textContent = user.name.charAt(0).toUpperCase();
    }
  } else {
    DOM.btnOpenAuthModal.style.display = 'inline-flex';
    DOM.userNavName.textContent = 'Guest';
    DOM.userDropdownName.textContent = 'Guest Learner';
    DOM.userDropdownEmail.textContent = 'Local Offline Session';
    DOM.userNavFallback.textContent = 'G';
    DOM.userNavFallback.style.display = 'flex';
    DOM.userNavAvatar.style.display = 'none';

    if (DOM.btnSignOut) DOM.btnSignOut.style.display = 'none';
    if (DOM.btnUserDropdownSignIn) DOM.btnUserDropdownSignIn.style.display = 'flex';

    if (DOM.profileAvatar) {
      DOM.profileAvatar.textContent = 'SN';
    }
  }
}

async function loadInitialData() {
  let plan = await getCurrentPlan();
  let days = await getAllDays();

  // If no learning plan exists in DB yet, auto-initialize with sample plan
  // so the dashboard is immediately interactive and never gets stuck
  if (!plan || days.length === 0) {
    const sampleCurriculum = getSamplePlan('python');
    await saveLearningPlan({
      goal: 'Master Python 3 Core & Data Structures',
      duration: 7,
      targetLanguage: 'python'
    }, sampleCurriculum);

    plan = await getCurrentPlan();
    days = await getAllDays();
  }

  state.plan = plan;
  state.days = days;
  state.selectedLanguage = plan.targetLanguage || 'python';
  switchView('dashboard');
}

async function reloadUserData() {
  await clearLocalIndexedDBCache();
  await loadInitialData();
  if (state.currentView === 'profile') {
    renderProfile();
  }
}

// Authentication Modal Controls
function openAuthModal(defaultTab = 'google') {
  switchAuthTab(defaultTab);
  DOM.authModal.classList.add('open');
  DOM.authModal.setAttribute('aria-hidden', 'false');
  setupGoogleIdentity();
}

function closeAuthModal() {
  DOM.authModal.classList.remove('open');
  DOM.authModal.setAttribute('aria-hidden', 'true');
}

function switchAuthTab(tabName) {
  state.activeAuthTab = tabName;
  DOM.tabBtnAuthGoogle.classList.toggle('active', tabName === 'google');
  DOM.tabBtnAuthDemo.classList.toggle('active', tabName === 'demo');
  DOM.tabBtnAuthSettings.classList.toggle('active', tabName === 'settings');

  DOM.paneAuthGoogle.style.display = tabName === 'google' ? 'block' : 'none';
  DOM.paneAuthDemo.style.display = tabName === 'demo' ? 'block' : 'none';
  DOM.paneAuthSettings.style.display = tabName === 'settings' ? 'block' : 'none';
}

// Multi-Device Connection Modal
async function openDeviceModal() {
  DOM.deviceUrlsList.innerHTML = '<div style="font-size: 13px; color: var(--text-tertiary);">Detecting local network interfaces...</div>';
  DOM.deviceModal.classList.add('open');
  DOM.deviceModal.setAttribute('aria-hidden', 'false');

  const netInfo = await getNetworkDeviceInfo();
  DOM.deviceUrlsList.innerHTML = '';

  const devices = (netInfo && netInfo.devices) ? netInfo.devices : [];

  // Always include current window host
  const currentHost = window.location.host;
  const currentUrl = `${window.location.protocol}//${currentHost}`;

  const allUrls = [
    { interface: 'Current Browser / This PC', urlFrontend: currentUrl },
    ...devices
  ];

  // De-duplicate by urlFrontend
  const seen = new Set();
  const uniqueUrls = allUrls.filter(d => {
    if (seen.has(d.urlFrontend)) return false;
    seen.add(d.urlFrontend);
    return true;
  });

  uniqueUrls.forEach((dev) => {
    const item = document.createElement('div');
    item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: var(--bg-canvas); border: 1px solid var(--border-subtle); border-radius: 8px; gap: 8px;';
    item.innerHTML = `
      <div>
        <div style="font-weight: 600; font-size: 13.5px; color: var(--accent); font-family: var(--font-mono);">${dev.urlFrontend}</div>
        <div style="font-size: 11.5px; color: var(--text-tertiary); margin-top: 2px;">Interface: ${dev.interface}</div>
      </div>
      <button type="button" class="btn btn-secondary btn-sm btn-copy-device-url" data-url="${dev.urlFrontend}">
        Copy URL
      </button>
    `;
    DOM.deviceUrlsList.appendChild(item);
  });

  DOM.deviceUrlsList.querySelectorAll('.btn-copy-device-url').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const url = e.currentTarget.dataset.url;
      try {
        await navigator.clipboard.writeText(url);
        btn.textContent = '✓ Copied!';
        setTimeout(() => { btn.textContent = 'Copy URL'; }, 2000);
        showToast('URL copied to clipboard! Open it on your phone or tablet.', 'success');
      } catch (err) {
        showToast('Address: ' + url, 'normal');
      }
    });
  });
}

function closeDeviceModal() {
  DOM.deviceModal.classList.remove('open');
  DOM.deviceModal.setAttribute('aria-hidden', 'true');
}

// ==========================================
// View Routing
// ==========================================
function switchView(viewName) {
  state.currentView = viewName;

  // Toggle "Back to Home" button when navigated away from Dashboard
  if (DOM.btnBackToHome) {
    DOM.btnBackToHome.style.display = (viewName === 'dashboard') ? 'none' : 'inline-flex';
  }

  // Close any open dropdown menus (Settings or User dropdown)
  if (DOM.settingsDropdownMenu) DOM.settingsDropdownMenu.style.display = 'none';
  if (DOM.btnOpenSettings) {
    DOM.btnOpenSettings.classList.remove('open');
    DOM.btnOpenSettings.setAttribute('aria-expanded', 'false');
  }

  if (DOM.userDropdownMenu) DOM.userDropdownMenu.style.display = 'none';
  if (DOM.btnUserMenu) {
    DOM.btnUserMenu.classList.remove('open');
    DOM.btnUserMenu.setAttribute('aria-expanded', 'false');
  }

  // Nav buttons active state (mobile footer nav)
  [DOM.mobNavDashboard, DOM.mobNavConfig, DOM.mobNavProfile].forEach((btn) => {
    if (btn) btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  // View sections visibility
  DOM.viewConfig.classList.toggle('active', viewName === 'config');
  DOM.viewDashboard.classList.toggle('active', viewName === 'dashboard');
  DOM.viewProfile.classList.toggle('active', viewName === 'profile');

  if (viewName === 'dashboard') {
    renderDashboard();
  } else if (viewName === 'profile') {
    renderProfile();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// Configuration (Page 1) Logic
// ==========================================
function handleGeneratePrompt(e) {
  e.preventDefault();
  const goal = DOM.inputGoal.value.trim();
  const duration = parseInt(DOM.inputDuration.value, 10);
  const targetLanguage = DOM.inputLanguage.value;

  if (!goal) {
    showToast('Please enter a learning goal.', 'warning');
    DOM.inputGoal.focus();
    return;
  }

  if (isNaN(duration) || duration <= 0) {
    showToast('Duration must be at least 1 day.', 'warning');
    DOM.inputDuration.focus();
    return;
  }

  const promptText = generatePrompt({ goal, duration, targetLanguage });
  DOM.promptTextDisplay.textContent = promptText;
  DOM.promptOutputSection.style.display = 'block';

  // Smooth scroll to prompt box
  DOM.promptOutputSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  showToast('AI prompt generated! Copy and send to your AI model.', 'success');
}

async function handleCopyPrompt() {
  const text = DOM.promptTextDisplay.textContent;
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    const origHTML = DOM.btnCopyPrompt.innerHTML;
    DOM.btnCopyPrompt.innerHTML = `✓ Copied!`;
    showToast('Prompt copied to clipboard!', 'success');
    setTimeout(() => {
      DOM.btnCopyPrompt.innerHTML = origHTML;
    }, 2000);
  } catch (err) {
    // Fallback for older browsers/permissions
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('Prompt copied to clipboard!', 'success');
  }
}

function handleLoadSamplePlan() {
  const language = DOM.inputLanguage.value;
  const sampleData = getSamplePlan(language);

  DOM.inputGoal.value = language === 'javascript'
    ? 'Modern JavaScript & Async Programming'
    : 'Master Python 3 Core & Data Structures';
  DOM.inputDuration.value = sampleData.length;

  // Reveal prompt section and populate textarea with JSON
  const promptText = generatePrompt({
    goal: DOM.inputGoal.value,
    duration: sampleData.length,
    targetLanguage: language
  });
  DOM.promptTextDisplay.textContent = promptText;
  DOM.promptOutputSection.style.display = 'block';

  // Format as clean indented JSON with markdown code fence to also demonstrate stripping!
  DOM.aiJsonResponse.value = '```json\n' + JSON.stringify(sampleData, null, 2) + '\n```';
  DOM.schemaErrorAlert.style.display = 'none';

  showToast(`✨ Loaded ${sampleData.length}-Day sample plan with starter code. Click "Validate & Launch Roadmap"!`, 'success');
  DOM.aiJsonResponse.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function handleValidateAndSave() {
  const rawInput = DOM.aiJsonResponse.value;
  DOM.schemaErrorAlert.style.display = 'none';

  const validation = validatePlanJson(rawInput);

  if (!validation.isValid) {
    DOM.schemaErrorAlert.style.display = 'flex';
    DOM.schemaErrorText.innerHTML = `<strong>${validation.error}</strong><br>${validation.details || ''}`;
    DOM.schemaErrorAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  // Valid schema! Save to IndexedDB
  const goal = DOM.inputGoal.value.trim() || 'My Learning Plan';
  const duration = validation.data.length;
  const targetLanguage = DOM.inputLanguage.value;

  try {
    await saveLearningPlan(
      { goal, duration, targetLanguage },
      validation.data
    );

    state.plan = await getCurrentPlan();
    state.days = await getAllDays();
    state.selectedLanguage = targetLanguage;

    showToast(`🎉 Roadmap created! ${duration} days loaded into IndexedDB.`, 'success');
    switchView('dashboard');
  } catch (err) {
    DOM.schemaErrorAlert.style.display = 'flex';
    DOM.schemaErrorText.textContent = 'Storage Error: ' + err.message;
  }
}

// ==========================================
// Daily Habit Consistency & Usage Tracking
// ==========================================
const USAGE_DATES_KEY = 'smart_notebook_usage_dates';

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getRecordedUsageDates() {
  try {
    const raw = localStorage.getItem(USAGE_DATES_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    }
  } catch (err) {
    console.warn('Failed to read usage dates from localStorage:', err);
  }
  return [];
}

function recordDailyUsage() {
  try {
    const todayStr = getTodayDateString();
    let dates = getRecordedUsageDates();
    let modified = false;

    if (!dates.includes(todayStr)) {
      dates.push(todayStr);
      modified = true;
    }

    // Infer usage dates from any completed tasks or notes/code
    if (state.days && state.days.length > 0 && state.plan && state.plan.createdAt) {
      const planStart = new Date(state.plan.createdAt);
      state.days.forEach((d) => {
        if (d.status === 'completed' || (d.note && d.note.trim()) || (d.code && d.code.trim())) {
          const dTime = new Date(planStart.getTime() + (d.day - 1) * 86400000);
          const dStr = `${dTime.getFullYear()}-${String(dTime.getMonth() + 1).padStart(2, '0')}-${String(dTime.getDate()).padStart(2, '0')}`;
          if (!dates.includes(dStr)) {
            dates.push(dStr);
            modified = true;
          }
        }
      });
    }

    if (modified) {
      dates.sort();
      localStorage.setItem(USAGE_DATES_KEY, JSON.stringify(dates));
    }
    return dates;
  } catch (err) {
    console.warn('Failed to save daily usage:', err);
    return getRecordedUsageDates();
  }
}

function calculateDailyConsistency() {
  const usageDates = recordDailyUsage();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Plan inception date
  let planStart = today;
  if (state.plan && state.plan.createdAt) {
    const parsed = new Date(state.plan.createdAt);
    if (!isNaN(parsed.getTime())) {
      planStart = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }
  }

  // Days elapsed since roadmap inception
  const diffTime = today.getTime() - planStart.getTime();
  const daysElapsed = Math.max(1, Math.round(diffTime / 86400000) + 1);

  // Filter usage dates that fall within [planStart, today]
  const planStartStr = `${planStart.getFullYear()}-${String(planStart.getMonth() + 1).padStart(2, '0')}-${String(planStart.getDate()).padStart(2, '0')}`;
  const todayStr = getTodayDateString();

  const activeDatesInPlan = usageDates.filter((dateStr) => {
    return dateStr >= planStartStr && dateStr <= todayStr;
  });

  const distinctDaysUsed = Math.max(1, activeDatesInPlan.length);
  const trackedWindow = daysElapsed;

  const consistencyScore = Math.min(100, Math.round((distinctDaysUsed / trackedWindow) * 100));

  // Compute current consecutive daily streak ending today
  let streak = 0;
  const usageSet = new Set(usageDates);
  const checkDate = new Date(today.getTime());

  while (true) {
    const y = checkDate.getFullYear();
    const m = String(checkDate.getMonth() + 1).padStart(2, '0');
    const d = String(checkDate.getDate()).padStart(2, '0');
    const dateKey = `${y}-${m}-${d}`;

    if (usageSet.has(dateKey)) {
      streak++;
      checkDate.setTime(checkDate.getTime() - 86400000);
    } else {
      break;
    }
  }

  return {
    consistencyScore,
    streak: Math.max(1, streak),
    daysUsedCount: distinctDaysUsed,
    daysElapsed: trackedWindow
  };
}

// ==========================================
// Dashboard & Left-Right Slider with Calendar Logic
// ==========================================
async function renderDashboard() {
  if (!state.plan) {
    state.plan = await getCurrentPlan();
    state.days = await getAllDays();
  }

  if (!state.plan || state.days.length === 0) {
    const sampleCurriculum = getSamplePlan('python');
    await saveLearningPlan({
      goal: 'Master Python 3 Core & Data Structures',
      duration: 7,
      targetLanguage: 'python'
    }, sampleCurriculum);
    state.plan = await getCurrentPlan();
    state.days = await getAllDays();
  }

  const { plan, days } = state;

  // Update Header Banner & Subtitle
  if (DOM.dashGoalTitle) DOM.dashGoalTitle.textContent = plan.goal;
  if (DOM.dashGoalLanguage) DOM.dashGoalLanguage.textContent = `Language: ${plan.targetLanguage === 'javascript' ? 'JavaScript' : 'Python'}`;
  
  const completedCount = days.filter((d) => d.status === 'completed').length;
  const skippedCount = days.filter((d) => d.status === 'skipped').length;
  const activeDayItem = days.find((d) => d.status === 'active');
  const lockedCount = days.filter((d) => d.status === 'locked').length;
  const totalDays = days.length;

  if (DOM.dashGoalTimeline) {
    DOM.dashGoalTimeline.textContent = activeDayItem ? `Current: Day ${activeDayItem.day}` : 'Completed';
  }
  if (DOM.dashGoalStatus) {
    DOM.dashGoalStatus.textContent = completedCount === totalDays ? 'Status: Mastered! 🏆' : 'Status: In Progress';
  }

  // Quick Metrics Pill 1: Completed Days
  if (DOM.widgetCompletedDays) DOM.widgetCompletedDays.textContent = completedCount;
  if (DOM.widgetTotalDays) DOM.widgetTotalDays.textContent = `/ ${totalDays}`;
  const completionPercent = totalDays > 0 ? Math.round((completedCount / totalDays) * 100) : 0;
  if (DOM.widgetCompletedFill) DOM.widgetCompletedFill.style.width = `${completionPercent}%`;
  if (DOM.widgetCompletedSubtext) DOM.widgetCompletedSubtext.textContent = `${completionPercent}% completed`;

  // Quick Metrics Pill 2: Pending Days
  const pendingDays = totalDays - completedCount;
  if (DOM.widgetPendingDays) DOM.widgetPendingDays.textContent = pendingDays;
  if (DOM.widgetPendingBreakdown) DOM.widgetPendingBreakdown.textContent = `${lockedCount} locked • ${skippedCount} review`;

  // Quick Metrics Pill 3: Habit Consistency Score (Calculated based on everyday app is used)
  const habit = calculateDailyConsistency();
  const consistencyScore = habit.consistencyScore;
  const streak = habit.streak;

  if (DOM.widgetConsistencyText) DOM.widgetConsistencyText.textContent = `${consistencyScore}%`;
  if (DOM.widgetConsistencyLabel) {
    if (streak > 1) {
      DOM.widgetConsistencyLabel.textContent = `${streak} Day Streak 🔥`;
    } else if (consistencyScore >= 90) {
      DOM.widgetConsistencyLabel.textContent = 'Daily Habit 🌟';
    } else if (consistencyScore >= 70) {
      DOM.widgetConsistencyLabel.textContent = 'Steady Routine 🚀';
    } else {
      DOM.widgetConsistencyLabel.textContent = 'Building Habit 🎯';
    }
  }

  if (DOM.widgetConsistencyCircle) {
    const ringCircumference = 201.06;
    const strokeOffset = ringCircumference - (consistencyScore / 100) * ringCircumference;
    DOM.widgetConsistencyCircle.style.strokeDashoffset = strokeOffset;
  }

  // Circular Progress Ring in Hero Header (From Screenshot)
  // Radius = 30, Circumference = 2 * PI * 30 ≈ 188.5
  const headerCircumference = 188.5;
  const headerOffset = headerCircumference - (completionPercent / 100) * headerCircumference;
  if (DOM.dashHeaderRingFill) {
    DOM.dashHeaderRingFill.style.strokeDashoffset = headerOffset;
  }
  if (DOM.dashHeaderPercent) {
    DOM.dashHeaderPercent.textContent = `${completionPercent}%`;
  }
  if (DOM.shellPercentText) {
    DOM.shellPercentText.textContent = `${completionPercent}%`;
  }

  // Determine which day to display in the Slider
  if (!state.sliderDayNumber || state.sliderDayNumber < 1 || state.sliderDayNumber > totalDays) {
    if (activeDayItem) {
      state.sliderDayNumber = activeDayItem.day;
    } else if (skippedCount > 0) {
      const firstSkipped = days.find((d) => d.status === 'skipped');
      state.sliderDayNumber = firstSkipped ? firstSkipped.day : 1;
    } else {
      state.sliderDayNumber = 1;
    }
  }

  // Render 3D Virtual Card Deck
  renderCardDeck();

  // Dashboard header date is locked to Today's date!
  renderDashboardHeaderDate();

  // Render Layered Next Up Peek
  renderNextUpPeek(state.sliderDayNumber);

  // Render Calendar Strip
  renderCalendarStrip(state.sliderDayNumber);

  // Bottom Floating Pill text (matching mockup: "I want to become...")
  if (DOM.bottomGoalPillText) {
    DOM.bottomGoalPillText.textContent = 'I want to become...';
  }
  if (DOM.btnBottomGoalPill && plan && plan.goal) {
    DOM.btnBottomGoalPill.title = `Goal: ${plan.goal} - Click to configure`;
  }

  // Legacy timeline container update (kept hidden in DOM for backward-compatibility)
  renderTimelineFlowchart(days);
}

// Render dashboard header date - Always anchored to Today's date!
function renderDashboardHeaderDate() {
  const today = new Date();
  if (DOM.dashTodayLabel) {
    DOM.dashTodayLabel.textContent = 'Today';
  }
  if (DOM.dashDateTitle) {
    DOM.dashDateTitle.textContent = today.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }
}

// Update dashboard header date (compatibility wrapper - remains anchored to Today)
function updateDashboardHeaderDate(dayNumber) {
  renderDashboardHeaderDate();
}

// Render Continuous 3D Virtual Card Deck
// All cards exist concurrently in the deck and smoothly glide between
// offsets with GPU-accelerated transforms. Zero jump, zero flicker,
// zero collapsing to 2 cards!
function renderCardDeck() {
  if (!DOM.cardStackDeck) return;
  const { days, plan } = state;
  if (!days || days.length === 0) return;

  const currentDay = state.sliderDayNumber || 1;
  const totalDays = days.length;
  const targetLang = plan ? (plan.targetLanguage === 'javascript' ? 'JavaScript' : 'Python') : 'Python';

  let html = '';

  days.forEach((dayItem) => {
    const isLocked = dayItem.status === 'locked';
    const isCompleted = dayItem.status === 'completed';
    const isActive = dayItem.status === 'active';
    const isSkipped = dayItem.status === 'skipped';

    const lang = dayItem.codeLang || targetLang;
    const hasNotes = !!(dayItem.note && dayItem.note.trim().length > 0);
    const hasCode = !!(dayItem.code && dayItem.code.trim().length > 0);
    const duration = dayItem.duration ? `${dayItem.duration}h` : '2h';

    let btnText = 'Start task';
    let btnTitle = 'Start study & practice';
    if (isActive) {
      btnText = 'Start task';
      btnTitle = 'Start study & practice';
    } else if (isCompleted) {
      btnText = 'View notes & code';
      btnTitle = 'View completed notes and code';
    } else if (isSkipped) {
      btnText = 'Review task';
      btnTitle = 'Review skipped task';
    } else {
      btnText = `Complete Day ${dayItem.day - 1} to unlock`;
      btnTitle = `Complete Day ${dayItem.day - 1} first to unlock this lesson`;
    }

    const tagText = isActive ? "Today's focus" : `Day ${dayItem.day} Focus`;
    const statusLabel = getStatusDisplayName(dayItem.status);

    html += `
      <div class="deck-card" data-day="${dayItem.day}" id="deckCard-${dayItem.day}">
        <div class="deck-card-ridge" aria-hidden="true">
          <div class="deck-ridge-badge">
            <span class="material-symbols-rounded">layers</span>
            <span>Day ${dayItem.day}</span>
          </div>
          <span class="deck-ridge-meta">${duration} • ${statusLabel}</span>
        </div>

        <div class="focus-card-header">
          <div class="focus-label-group">
            <span class="focus-tag">${escapeHTML(tagText)}</span>
            <span class="focus-day-indicator">Day ${dayItem.day} of ${totalDays}</span>
          </div>
        </div>

        <h2 class="focus-card-title">${escapeHTML(dayItem.title)}</h2>

        <p class="focus-card-desc">
          ${escapeHTML(dayItem.description)}
        </p>

        <div class="focus-card-meta-row">
          <span class="meta-chip status-chip status-${dayItem.status}">${statusLabel}</span>
          <span class="meta-chip">${escapeHTML(lang)}</span>
          <span class="meta-chip meta-chip-notes" style="display: ${hasNotes ? 'inline-flex' : 'none'};">
            <span class="material-symbols-rounded">description</span> Notes
          </span>
          <span class="meta-chip meta-chip-code" style="display: ${hasCode ? 'inline-flex' : 'none'};">
            <span class="material-symbols-rounded">terminal</span> Code
          </span>
        </div>

        <div class="focus-card-action-row">
          <button type="button" class="btn-start-task status-${dayItem.status}" data-day="${dayItem.day}" ${isLocked ? 'disabled aria-disabled="true"' : ''} title="${btnTitle}">
            <span class="material-symbols-rounded btn-lock-icon">lock</span>
            <span class="btn-start-task-text">${btnText}</span>
          </button>

          <div class="focus-card-time-group">
            <button type="button" class="btn-skip-pill" data-day="${dayItem.day}" style="display: ${isActive ? 'inline-flex' : 'none'};" title="Skip and review later">
              <span class="material-symbols-rounded">fast_forward</span>
              <span>Skip</span>
            </button>
            <span class="focus-time-text">
              <span class="material-symbols-rounded">schedule</span>
              <span>${duration}</span>
            </span>
          </div>
        </div>
      </div>
    `;
  });

  // Final Completion Card (for continuous 3D stack depth on the final days)
  html += `
    <div class="deck-card deck-card-completion" data-day="complete" id="deckCard-complete">
      <div class="deck-card-ridge" aria-hidden="true">
        <div class="deck-ridge-badge">
          <span class="material-symbols-rounded">emoji_events</span>
          <span>Roadmap Goal</span>
        </div>
        <span class="deck-ridge-meta">Completed</span>
      </div>

      <div class="focus-card-header">
        <div class="focus-label-group">
          <span class="focus-tag">All Done 🏆</span>
          <span class="focus-day-indicator">${totalDays} of ${totalDays}</span>
        </div>
        <div class="focus-icon-badge" title="Roadmap Goal Completed">
          <span class="material-symbols-rounded" style="color: #f59e0b; font-size: 22px;">verified</span>
        </div>
      </div>

      <h2 class="focus-card-title">Roadmap Completed! 🎉</h2>

      <p class="focus-card-desc">
        You have explored all days in this learning plan. Revisit any notes and code, or configure a new roadmap to keep advancing!
      </p>

      <div class="focus-card-meta-row">
        <span class="meta-chip status-chip status-completed">Completed</span>
        <span class="meta-chip">${escapeHTML(targetLang)}</span>
      </div>

      <div class="focus-card-action-row">
        <button type="button" class="btn-start-task status-completed" data-day="complete" title="Configure new goal">
          <span class="material-symbols-rounded" style="font-size: 16px;">add_circle</span>
          <span class="btn-start-task-text">Explore New Goal</span>
        </button>
      </div>
    </div>
  `;

  DOM.cardStackDeck.innerHTML = html;

  // Apply initial offset classes
  updateDeckOffsets(currentDay);
}

// Update card positions in 3D stack based on active day
function updateDeckOffsets(currentDay) {
  if (!DOM.cardStackDeck) return;
  const cards = DOM.cardStackDeck.querySelectorAll('.deck-card');
  const totalDays = state.days ? state.days.length : 7;

  cards.forEach((card) => {
    const dayStr = card.dataset.day;
    const cardDay = dayStr === 'complete' ? totalDays + 1 : parseInt(dayStr, 10);
    const diff = cardDay - currentDay;

    card.classList.remove(
      'deck-offset-passed-far',
      'deck-offset-passed',
      'deck-offset-0',
      'deck-offset-1',
      'deck-offset-2',
      'deck-offset-waiting'
    );

    if (diff < -1) {
      card.classList.add('deck-offset-passed-far');
    } else if (diff === -1) {
      card.classList.add('deck-offset-passed');
    } else if (diff === 0) {
      card.classList.add('deck-offset-0');
    } else if (diff === 1) {
      card.classList.add('deck-offset-1');
    } else if (diff === 2) {
      card.classList.add('deck-offset-2');
    } else {
      card.classList.add('deck-offset-waiting');
    }
  });
}

// Render Focus Card for given day (compatibility wrapper)
function renderFocusCard(dayNumber) {
  renderDashboardHeaderDate();
  updateDeckOffsets(dayNumber);
}

// Render Layered Next Up Peek
function renderNextUpPeek(dayNumber) {
  const { days } = state;
  if (!days || days.length === 0) return;
  const nextDayItem = days.find((d) => d.day === dayNumber + 1);

  if (nextDayItem) {
    if (DOM.nextUpTitle) DOM.nextUpTitle.textContent = nextDayItem.title;
    if (DOM.nextUpPeekLayer) {
      DOM.nextUpPeekLayer.style.display = 'inline-flex';
      DOM.nextUpPeekLayer.classList.remove('is-complete');
    }
  } else {
    if (DOM.nextUpTitle) DOM.nextUpTitle.textContent = 'Roadmap Complete! Revisit any task or explore new goals 🏆';
    if (DOM.nextUpPeekLayer) {
      DOM.nextUpPeekLayer.style.display = 'inline-flex';
      DOM.nextUpPeekLayer.classList.add('is-complete');
    }
  }
}

// Render Previous Day Cover Card (retained for compatibility)
function renderCoverCard(dayNumber) {
  // Virtual deck handles passed cards smoothly via deck-offset-passed
}

// Render Calendar Strip - Centered on current week with Today's date anchored as active capsule
function renderCalendarStrip(selectedDayNumber) {
  if (!DOM.calendarDaysRow) return;
  DOM.calendarDaysRow.innerHTML = '';

  const { days, plan } = state;
  if (!days || days.length === 0) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculate Monday of the week containing Today
  const dayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday
  const distanceToMonday = (dayOfWeek + 6) % 7;
  const baseMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - distanceToMonday);

  // Apply calendar week offset
  const activeMonday = new Date(baseMonday.getTime() + (state.calendarWeekOffset || 0) * 7 * 86400000);
  const activeSunday = new Date(activeMonday.getTime() + 6 * 86400000);

  // Header Date Range: e.g. "Nov 1-7"
  if (DOM.calDateRange) {
    const startMonth = activeMonday.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = activeSunday.toLocaleDateString('en-US', { month: 'short' });
    const startNum = activeMonday.getDate();
    const endNum = activeSunday.getDate();

    if (startMonth === endMonth) {
      DOM.calDateRange.textContent = `${startMonth} ${startNum}-${endNum}`;
    } else {
      DOM.calDateRange.textContent = `${startMonth} ${startNum} - ${endMonth} ${endNum}`;
    }
  }

  if (DOM.calWeekTitle) {
    DOM.calWeekTitle.textContent = (state.calendarWeekOffset === 0) ? 'This week' : 'Week schedule';
  }

  // Weekday initials: Mon through Sun
  const dayLetters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const planDate = plan && plan.createdAt ? new Date(plan.createdAt) : new Date();
  const planMidnight = new Date(planDate.getFullYear(), planDate.getMonth(), planDate.getDate());

  for (let i = 0; i < 7; i++) {
    const colDate = new Date(activeMonday.getTime() + i * 86400000);
    const dateNumber = colDate.getDate();
    const dayInitial = dayLetters[i];

    // Is this column Today's real-world date?
    const isToday = colDate.getFullYear() === today.getFullYear() &&
                    colDate.getMonth() === today.getMonth() &&
                    colDate.getDate() === today.getDate();

    // Find if any curriculum day falls on this calendar date
    const dayDiff = Math.round((colDate.getTime() - planMidnight.getTime()) / 86400000);
    const mappedDayNum = dayDiff + 1;
    const dayItem = days.find((d) => d.day === mappedDayNum);
    const isViewingThisCard = selectedDayNumber && mappedDayNum === selectedDayNumber;

    const colEl = document.createElement('div');
    // The active white capsule is ALWAYS Today's date!
    colEl.className = `calendar-day-col ${isToday ? 'active-capsule is-today' : ''} ${isViewingThisCard && !isToday ? 'is-viewing-card' : ''}`;
    colEl.dataset.day = mappedDayNum;

    // Status Dot class
    let statusDotClass = 'dot-empty';
    if (dayItem) {
      if (dayItem.status === 'completed') statusDotClass = 'dot-completed';
      else if (dayItem.status === 'active') statusDotClass = 'dot-active';
      else if (dayItem.status === 'skipped') statusDotClass = 'dot-skipped';
      else if (dayItem.status === 'locked') statusDotClass = 'dot-locked';
    }

    colEl.innerHTML = `
      <span class="cal-day-letter">${dayInitial}</span>
      <span class="cal-day-number">${dateNumber}</span>
      <span class="cal-status-dot ${statusDotClass}"></span>
    `;

    if (dayItem) {
      colEl.style.cursor = 'pointer';
      colEl.setAttribute('role', 'button');
      colEl.setAttribute('tabindex', '0');
      colEl.title = `Day ${dayItem.day}: ${dayItem.title} (${getStatusDisplayName(dayItem.status)})`;
      colEl.addEventListener('click', () => {
        slideToDay(dayItem.day);
      });
      colEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          slideToDay(dayItem.day);
        }
      });
    } else {
      colEl.style.opacity = '0.35';
      colEl.style.cursor = 'default';
    }

    DOM.calendarDaysRow.appendChild(colEl);
  }
}

// Smoothly slide between days in focus card with continuous 3D virtual stacked deck physics
function slideToDay(targetDayNum, direction = 'auto') {
  const { days } = state;
  if (!days || days.length === 0) return;
  if (targetDayNum < 1 || targetDayNum > days.length) return;
  if (targetDayNum === state.sliderDayNumber) return;

  state.sliderDayNumber = targetDayNum;

  // Immediately update slider arrow disabled states
  if (DOM.btnSliderPrev) DOM.btnSliderPrev.disabled = targetDayNum <= 1;
  if (DOM.btnSliderNext) DOM.btnSliderNext.disabled = targetDayNum >= days.length;

  // Date header remains locked on Today! (Does NOT shift with task milestones)
  renderDashboardHeaderDate();

  // Update deck offsets - GPU CSS transitions handle smooth continuous glide
  updateDeckOffsets(targetDayNum);

  // Update next up info pill and calendar strip
  renderNextUpPeek(targetDayNum);
  renderCalendarStrip(targetDayNum);
}

// Legacy timeline flowchart (kept functional for hidden compatibility container)
function renderTimelineFlowchart(days) {
  if (!DOM.timelineContainer) return;
  DOM.timelineContainer.innerHTML = '';

  days.forEach((dayItem) => {
    const itemEl = document.createElement('div');
    itemEl.className = `timeline-item ${dayItem.status}`;
    itemEl.id = `dayItem-${dayItem.day}`;

    let nodeContent = dayItem.day;
    if (dayItem.status === 'completed') nodeContent = '<span class="material-symbols-rounded">check</span>';
    else if (dayItem.status === 'skipped') nodeContent = '<span class="material-symbols-rounded">replay</span>';
    else if (dayItem.status === 'locked') nodeContent = '<span class="material-symbols-rounded">lock</span>';

    itemEl.innerHTML = `
      <div class="timeline-node">${nodeContent}</div>
      <div class="timeline-card">
        <h3>${escapeHTML(dayItem.title)}</h3>
        <button type="button" class="btn-open-task" data-day="${dayItem.day}">Open</button>
      </div>
    `;

    DOM.timelineContainer.appendChild(itemEl);
  });

  DOM.timelineContainer.querySelectorAll('.btn-open-task').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const day = parseInt(e.currentTarget.dataset.day, 10);
      openTaskModal(day);
    });
  });
}

// ==========================================
// Task Modal Logic (Notes, Code, Compilers)
// ==========================================
async function openTaskModal(dayNumber) {
  const dayItem = await getDay(dayNumber);
  if (!dayItem) return;

  state.activeDayModal = dayItem;

  // Header info
  DOM.modalDayPill.textContent = `Day ${dayItem.day} • ${getStatusDisplayName(dayItem.status)}`;
  DOM.modalTitle.textContent = dayItem.title;
  DOM.modalDescription.textContent = dayItem.description;

  // Notes tab
  DOM.noteInput.value = dayItem.note || '';
  updateNoteCharCount();

  // Code tab
  const activeLang = dayItem.codeLang || state.selectedLanguage || 'python';
  setModalLanguage(activeLang);

  DOM.codeInput.value = dayItem.code || dayItem.starterCode || '';
  if (dayItem.codeOutput) {
    DOM.terminalOutput.textContent = dayItem.codeOutput;
    DOM.terminalOutput.classList.remove('has-error');
  } else {
    DOM.terminalOutput.innerHTML = '<span class="terminal-empty">Click "Run Code" to compile and execute client-side.</span>';
    DOM.terminalOutput.classList.remove('has-error');
  }
  DOM.terminalExecutionTime.textContent = 'Ready';

  // Skip button visibility (only show skip if day is active)
  DOM.btnModalSkip.style.display = dayItem.status === 'active' ? 'inline-flex' : 'none';

  // Completion Criteria Check
  validateCompletionCriteria();

  // Reset tab to notes
  switchModalTab('note');

  // Open modal
  DOM.taskModal.classList.add('open');
  DOM.taskModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeTaskModal() {
  DOM.taskModal.classList.remove('open');
  DOM.taskModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  state.activeDayModal = null;
}

function switchModalTab(tabName) {
  state.activeModalTab = tabName;

  DOM.tabBtnNote.classList.toggle('active', tabName === 'note');
  DOM.tabBtnCode.classList.toggle('active', tabName === 'code');

  DOM.paneNote.classList.toggle('active', tabName === 'note');
  DOM.paneCode.classList.toggle('active', tabName === 'code');
}

function setModalLanguage(lang) {
  state.selectedLanguage = lang;
  DOM.pillLangPython.classList.toggle('active', lang === 'python');
  DOM.pillLangJS.classList.toggle('active', lang === 'javascript');

  if (lang === 'python') {
    DOM.editorLanguageLabel.textContent = 'Python 3 (Pyodide WebAssembly)';
    DOM.codeInput.placeholder = '# Write Python 3 code here...\nprint("Hello, world!")';
  } else {
    DOM.editorLanguageLabel.textContent = 'JavaScript (Sandboxed Web Worker)';
    DOM.codeInput.placeholder = '// Write JavaScript code here...\nconsole.log("Hello, world!");';
  }
}

// Word & Character count in Notes
function updateNoteCharCount() {
  const text = DOM.noteInput.value.trim();
  const charLen = text.length;
  const wordCount = text.length === 0 ? 0 : text.split(/\s+/).length;
  DOM.noteCharCount.textContent = `${charLen} characters • ${wordCount} words`;
  validateCompletionCriteria();
}

// Completion criteria rule: >= 15 characters in either Note OR Code
function validateCompletionCriteria() {
  if (!state.activeDayModal) return;

  const noteChars = (DOM.noteInput.value || '').trim().length;
  const codeChars = (DOM.codeInput.value || '').trim().length;
  const maxChars = Math.max(noteChars, codeChars);

  const isValid = maxChars >= 15;

  DOM.btnModalComplete.disabled = !isValid;

  if (isValid) {
    DOM.completionHint.classList.add('valid');
    DOM.completionHintText.textContent = `✓ Completion criteria met (${maxChars} chars written)`;
  } else {
    DOM.completionHint.classList.remove('valid');
    DOM.completionHintText.textContent = `Add at least 15 characters of notes or code to mark complete (${maxChars}/15).`;
  }
}

// Autosave helper for active modal
let autosaveTimeout = null;
function triggerAutosave() {
  if (!state.activeDayModal) return;

  DOM.noteAutosaveStatus.textContent = 'Saving...';
  clearTimeout(autosaveTimeout);

  autosaveTimeout = setTimeout(async () => {
    if (!state.activeDayModal) return;

    try {
      await updateDay(state.activeDayModal.day, {
        note: DOM.noteInput.value,
        code: DOM.codeInput.value,
        codeLang: state.selectedLanguage
      });
      DOM.noteAutosaveStatus.textContent = 'Saved offline in IndexedDB';
    } catch (err) {
      DOM.noteAutosaveStatus.textContent = 'Error saving';
    }
  }, 400);
}

// In-Browser Code Execution Runner
async function executeCode() {
  if (state.isExecutingCode || !state.activeDayModal) return;

  const code = DOM.codeInput.value;
  const lang = state.selectedLanguage;

  if (!code.trim()) {
    showToast('Code editor is empty. Enter some code to run.', 'warning');
    return;
  }

  state.isExecutingCode = true;
  DOM.btnRunCode.disabled = true;
  DOM.btnRunCode.innerHTML = `<span class="spinner"></span> <span>Running...</span>`;
  DOM.terminalExecutionTime.textContent = 'Executing...';
  DOM.terminalOutput.innerHTML = '<span class="terminal-empty">Executing script...</span>';
  DOM.terminalOutput.classList.remove('has-error');

  try {
    let result;
    if (lang === 'python') {
      result = await runPythonCode(code, (status) => {
        DOM.terminalExecutionTime.textContent = status;
      });
    } else {
      result = await runJavaScriptCode(code);
    }

    DOM.terminalExecutionTime.textContent = `⚡ ${result.durationMs}ms`;

    if (result.success) {
      DOM.terminalOutput.textContent = result.stdout || '(Code executed with no output)';
      DOM.terminalOutput.classList.remove('has-error');
    } else {
      let combined = '';
      if (result.stdout) combined += result.stdout + '\n';
      combined += result.stderr;
      DOM.terminalOutput.textContent = combined;
      DOM.terminalOutput.classList.add('has-error');
    }

    // Save output & code to IndexedDB
    await updateDay(state.activeDayModal.day, {
      code: DOM.codeInput.value,
      codeOutput: DOM.terminalOutput.textContent,
      codeLang: lang
    });

  } catch (err) {
    DOM.terminalOutput.textContent = 'Runtime Exception: ' + err.message;
    DOM.terminalOutput.classList.add('has-error');
    DOM.terminalExecutionTime.textContent = 'Error';
  } finally {
    state.isExecutingCode = false;
    DOM.btnRunCode.disabled = false;
    DOM.btnRunCode.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
      <span>Run Code</span>
    `;
    validateCompletionCriteria();
  }
}

// Mark Complete Progression Handler
async function markTaskComplete() {
  if (!state.activeDayModal) return;

  const dayNum = state.activeDayModal.day;
  const note = DOM.noteInput.value;
  const code = DOM.codeInput.value;
  const output = DOM.terminalOutput.textContent;

  try {
    // 1. Mark current day completed
    await updateDay(dayNum, {
      status: 'completed',
      note,
      code,
      codeOutput: output,
      codeLang: state.selectedLanguage,
      completedAt: new Date().toISOString()
    });

    // 2. Progression: Unlock next day if it is locked
    const nextDayNum = dayNum + 1;
    const nextDay = await getDay(nextDayNum);
    if (nextDay && nextDay.status === 'locked') {
      await updateDay(nextDayNum, {
        status: 'active'
      });
    }

    closeTaskModal();

    // Reload days
    state.days = await getAllDays();
    renderDashboard();

    showToast(`🎉 Day ${dayNum} completed! Consistency score updated.`, 'success');
  } catch (err) {
    showToast('Failed to save completion: ' + err.message, 'danger');
  }
}

// Skip & Review Later Handler
async function skipAndReviewLater(dayNum) {
  try {
    // 1. Flag active day as skipped
    await updateDay(dayNum, {
      status: 'skipped',
      skippedAt: new Date().toISOString()
    });

    // 2. Unlock next day if it was locked
    const nextDayNum = dayNum + 1;
    const nextDay = await getDay(nextDayNum);
    if (nextDay && nextDay.status === 'locked') {
      await updateDay(nextDayNum, {
        status: 'active'
      });
    }

    if (state.activeDayModal && state.activeDayModal.day === dayNum) {
      closeTaskModal();
    }

    // Refresh state
    state.days = await getAllDays();
    renderDashboard();

    showToast(`Day ${dayNum} skipped and flagged for review later. Next day unlocked!`, 'warning');
  } catch (err) {
    showToast('Error skipping day: ' + err.message, 'danger');
  }
}

// ==========================================
// Profile (Page 3) Analytics & Data Management
// ==========================================
async function renderProfile() {
  const user = getCurrentUser();
  const profileNameEl = document.querySelector('.profile-name');
  if (user && !user.isGuest) {
    if (profileNameEl) profileNameEl.textContent = user.name;
    if (DOM.profileAvatar) DOM.profileAvatar.textContent = user.name.charAt(0).toUpperCase();
  } else {
    if (profileNameEl) profileNameEl.textContent = 'Guest Learner';
    if (DOM.profileAvatar) DOM.profileAvatar.textContent = 'G';
  }

  if (!state.plan) {
    state.plan = await getCurrentPlan();
    state.days = await getAllDays();
  }

  const { plan, days } = state;
  if (!plan) {
    DOM.profileActiveGoalText.textContent = 'Active Plan: No active plan created yet.';
    DOM.statCompletionRate.textContent = '0%';
    DOM.statConsistencyScore.textContent = '100%';
    DOM.statCompletedCount.textContent = '0 / 0';
    DOM.statTotalWords.textContent = '0';
    DOM.profileBacklogContainer.innerHTML = `
      <div class="empty-backlog">
        <p style="font-weight: 500; color: var(--text-primary);">No active roadmap</p>
        <p style="font-size: 13px; margin-top: 4px;">Create a plan in Plan Setup to start learning!</p>
      </div>
    `;
    return;
  }

  DOM.profileActiveGoalText.textContent = `Active Plan: ${plan.goal} (${plan.duration} Days)`;

  const completedCount = days.filter((d) => d.status === 'completed').length;
  const skippedDays = days.filter((d) => d.status === 'skipped');
  const totalDays = days.length;

  // Completion rate
  const completionPercent = totalDays > 0 ? Math.round((completedCount / totalDays) * 100) : 0;
  DOM.statCompletionRate.textContent = `${completionPercent}%`;

  // Habit Consistency score (calculated based on everyday the app is used)
  const habit = calculateDailyConsistency();
  DOM.statConsistencyScore.textContent = `${habit.consistencyScore}%`;

  // Total completed days
  DOM.statCompletedCount.textContent = `${completedCount} / ${totalDays}`;

  // Word count across all notes
  let totalWords = 0;
  days.forEach((d) => {
    if (d.note && d.note.trim()) {
      totalWords += d.note.trim().split(/\s+/).length;
    }
  });
  DOM.statTotalWords.textContent = totalWords.toLocaleString();

  // Backlog List
  DOM.backlogCountBadge.textContent = `${skippedDays.length} day${skippedDays.length === 1 ? '' : 's'} pending review`;
  DOM.profileBacklogContainer.innerHTML = '';

  if (skippedDays.length === 0) {
    DOM.profileBacklogContainer.innerHTML = `
      <div class="empty-backlog">
        <span class="material-symbols-rounded" style="font-size: 28px; margin-bottom: 8px; color: var(--success);">check_circle</span>
        <p style="font-weight: 500; color: var(--text-primary);">Zero pending reviews</p>
        <p style="font-size: 13px; margin-top: 4px;">You have completed every day in sequence without any unresolved skips!</p>
      </div>
    `;
  } else {
    skippedDays.forEach((item) => {
      const bItem = document.createElement('div');
      bItem.className = 'backlog-item';
      bItem.innerHTML = `
        <div class="backlog-info">
          <span class="backlog-day">Day ${item.day} • Pending Review</span>
          <span class="backlog-title">${escapeHTML(item.title)}</span>
          <span style="font-size: 12.5px; color: var(--text-secondary);">${escapeHTML(item.description)}</span>
        </div>
        <button type="button" class="btn btn-warning btn-sm btn-profile-review" data-day="${item.day}">
          Review & Complete
        </button>
      `;
      DOM.profileBacklogContainer.appendChild(bItem);
    });

    DOM.profileBacklogContainer.querySelectorAll('.btn-profile-review').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const day = parseInt(e.currentTarget.dataset.day, 10);
        openTaskModal(day);
      });
    });
  }
}

// Data Export as JSON
async function handleExportJson() {
  const jsonStr = await exportAllData();
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `SmartNotebook_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('IndexedDB backup exported as JSON file.', 'success');
}

// Data Export as Markdown
async function handleExportMarkdown() {
  const plan = await getCurrentPlan();
  const days = await getAllDays();

  if (!plan) {
    showToast('No active plan to export.', 'warning');
    return;
  }

  let md = `# Smart Notebook — Study Journal\n\n`;
  md += `**Goal:** ${plan.goal}\n`;
  md += `**Duration:** ${plan.duration} Days\n`;
  md += `**Language:** ${plan.targetLanguage}\n`;
  md += `**Exported At:** ${new Date().toLocaleString()}\n\n`;
  md += `---\n\n`;

  days.forEach((day) => {
    md += `## Day ${day.day}: ${day.title}\n\n`;
    md += `**Status:** ${day.status.toUpperCase()}\n`;
    md += `**Description:** ${day.description}\n\n`;

    if (day.note && day.note.trim()) {
      md += `### 📝 Notes\n\n${day.note.trim()}\n\n`;
    }

    if (day.code && day.code.trim()) {
      md += `### 💻 Code (${day.codeLang || 'text'})\n\n\`\`\`${day.codeLang || ''}\n${day.code.trim()}\n\`\`\`\n\n`;
    }

    if (day.codeOutput && day.codeOutput.trim()) {
      md += `**Terminal Output:**\n\`\`\`\n${day.codeOutput.trim()}\n\`\`\`\n\n`;
    }

    md += `---\n\n`;
  });

  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `SmartNotebook_Notes_${Date.now()}.md`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Study notes exported as Markdown!', 'success');
}

// Reset Database Confirmation
async function handleResetAll() {
  const confirmed = window.confirm(
    'Are you sure you want to reset all data?\nThis will clear your current learning plan, timeline progress, notes, and code snippets from IndexedDB.'
  );

  if (confirmed) {
    await resetAllData();
    state.plan = null;
    state.days = [];
    DOM.aiJsonResponse.value = '';
    DOM.promptOutputSection.style.display = 'none';
    switchView('config');
    showToast('Database reset. You can create a new learning plan now.', 'success');
  }
}

// ==========================================
// Event Listeners Registration
// ==========================================
function setupEventListeners() {
  // Brand Header Click & Top Back to Home Navigation
  if (DOM.brandHomeBtn) {
    DOM.brandHomeBtn.addEventListener('click', () => switchView('dashboard'));
    DOM.brandHomeBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        switchView('dashboard');
      }
    });
  }

  if (DOM.btnBackToHome) {
    DOM.btnBackToHome.addEventListener('click', () => switchView('dashboard'));
  }

  document.querySelectorAll('[data-action="go-home"]').forEach((btn) => {
    btn.addEventListener('click', () => switchView('dashboard'));
  });

  // Mobile Footer Navigation Bar options
  if (DOM.mobNavDashboard) DOM.mobNavDashboard.addEventListener('click', () => switchView('dashboard'));
  if (DOM.mobNavConfig) DOM.mobNavConfig.addEventListener('click', () => switchView('config'));
  if (DOM.mobNavProfile) DOM.mobNavProfile.addEventListener('click', () => switchView('profile'));
  if (DOM.mobNavSettings) DOM.mobNavSettings.addEventListener('click', openDeviceModal);

  // Settings Menu (Web View) & Dropdown Actions
  if (DOM.btnOpenSettings && DOM.settingsDropdownMenu) {
    DOM.btnOpenSettings.addEventListener('click', (e) => {
      e.stopPropagation();
      if (DOM.userDropdownMenu) DOM.userDropdownMenu.style.display = 'none';
      const isOpen = DOM.settingsDropdownMenu.style.display === 'block';
      DOM.settingsDropdownMenu.style.display = isOpen ? 'none' : 'block';
      DOM.btnOpenSettings.classList.toggle('open', !isOpen);
      DOM.btnOpenSettings.setAttribute('aria-expanded', !isOpen ? 'true' : 'false');
    });

    document.addEventListener('click', (e) => {
      if (DOM.settingsMenuWrapper && !DOM.settingsMenuWrapper.contains(e.target)) {
        DOM.settingsDropdownMenu.style.display = 'none';
        DOM.btnOpenSettings.classList.remove('open');
        DOM.btnOpenSettings.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Plan Setup inside Settings
  if (DOM.btnSettingsPlanSetup) {
    DOM.btnSettingsPlanSetup.addEventListener('click', () => {
      if (DOM.settingsDropdownMenu) DOM.settingsDropdownMenu.style.display = 'none';
      if (DOM.btnOpenSettings) DOM.btnOpenSettings.classList.remove('open');
      switchView('config');
    });
  }

  // Multi-Device Sync inside Settings
  if (DOM.btnSettingsDeviceSync) {
    DOM.btnSettingsDeviceSync.addEventListener('click', () => {
      if (DOM.settingsDropdownMenu) DOM.settingsDropdownMenu.style.display = 'none';
      if (DOM.btnOpenSettings) DOM.btnOpenSettings.classList.remove('open');
      openDeviceModal();
    });
  }

  // Google Auth Config inside Settings
  if (DOM.btnSettingsGoogleConfig) {
    DOM.btnSettingsGoogleConfig.addEventListener('click', () => {
      if (DOM.settingsDropdownMenu) DOM.settingsDropdownMenu.style.display = 'none';
      if (DOM.btnOpenSettings) DOM.btnOpenSettings.classList.remove('open');
      openAuthModal('settings');
    });
  }

  // Data Export & Reset inside Settings
  if (DOM.btnSettingsExportJson) {
    DOM.btnSettingsExportJson.addEventListener('click', () => {
      if (DOM.settingsDropdownMenu) DOM.settingsDropdownMenu.style.display = 'none';
      if (DOM.btnOpenSettings) DOM.btnOpenSettings.classList.remove('open');
      handleExportJson();
    });
  }

  if (DOM.btnSettingsResetAll) {
    DOM.btnSettingsResetAll.addEventListener('click', () => {
      if (DOM.settingsDropdownMenu) DOM.settingsDropdownMenu.style.display = 'none';
      if (DOM.btnOpenSettings) DOM.btnOpenSettings.classList.remove('open');
      handleResetAll();
    });
  }

  // Configuration page
  DOM.planConfigForm.addEventListener('submit', handleGeneratePrompt);
  DOM.btnCopyPrompt.addEventListener('click', handleCopyPrompt);
  DOM.btnQuickSample.addEventListener('click', handleLoadSamplePlan);
  DOM.btnValidateAndSave.addEventListener('click', handleValidateAndSave);

  // Dashboard shortcuts & Slider controls
  if (DOM.btnCreateNewPlan) {
    DOM.btnCreateNewPlan.addEventListener('click', () => {
      switchView('config');
      DOM.inputGoal.focus();
    });
  }

  if (DOM.btnSliderPrev) {
    DOM.btnSliderPrev.addEventListener('click', () => {
      slideToDay(state.sliderDayNumber - 1, 'prev');
    });
  }
  if (DOM.btnSliderNext) {
    DOM.btnSliderNext.addEventListener('click', () => {
      slideToDay(state.sliderDayNumber + 1, 'next');
    });
  }
  // Delegated event handler on 3D Virtual Card Deck
  if (DOM.cardStackDeck) {
    DOM.cardStackDeck.addEventListener('click', (e) => {
      // 1. Click on Start Task button (only active front card can trigger)
      const startBtn = e.target.closest('.btn-start-task');
      if (startBtn) {
        const card = startBtn.closest('.deck-card');
        if (!card || !card.classList.contains('deck-offset-0')) return;
        const dayStr = startBtn.dataset.day;
        if (dayStr === 'complete') {
          switchView('config');
          DOM.inputGoal.focus();
          return;
        }
        const day = parseInt(dayStr, 10);
        const dayItem = state.days.find((d) => d.day === day);
        if (dayItem && dayItem.status === 'locked') {
          e.preventDefault();
          showToast(`Day ${dayItem.day} is locked. Complete Day ${dayItem.day - 1} first to unlock!`, 'info');
          return;
        }
        openTaskModal(day);
        return;
      }

      // 2. Click on Skip Pill button
      const skipBtn = e.target.closest('.btn-skip-pill');
      if (skipBtn) {
        const card = skipBtn.closest('.deck-card');
        if (!card || !card.classList.contains('deck-offset-0')) return;
        const day = parseInt(skipBtn.dataset.day, 10);
        if (!isNaN(day)) {
          skipAndReviewLater(day);
        }
        return;
      }

      // 3. Click on a stacked card behind the front card (offset 1 or offset 2)
      const clickedCard = e.target.closest('.deck-card');
      if (clickedCard && !clickedCard.classList.contains('deck-offset-0')) {
        const dayStr = clickedCard.dataset.day;
        const targetDay = dayStr === 'complete' ? state.days.length : parseInt(dayStr, 10);
        if (!isNaN(targetDay) && targetDay >= 1 && targetDay <= state.days.length) {
          slideToDay(targetDay, targetDay > state.sliderDayNumber ? 'next' : 'prev');
        }
      }
    });
  }

  // Next Up Info Bar Pill below deck
  if (DOM.nextUpPeekLayer) {
    DOM.nextUpPeekLayer.addEventListener('click', (e) => {
      e.stopPropagation();
      const nextDay = state.days.find((d) => d.day === state.sliderDayNumber + 1);
      if (nextDay) {
        slideToDay(nextDay.day, 'next');
      } else {
        switchView('config');
        DOM.inputGoal.focus();
      }
    });
  }

  // Calendar Week Strip prev/next week controls
  if (DOM.btnCalPrevWeek) {
    DOM.btnCalPrevWeek.addEventListener('click', () => {
      state.calendarWeekOffset = (state.calendarWeekOffset || 0) - 1;
      renderCalendarStrip(state.sliderDayNumber);
    });
  }
  if (DOM.btnCalNextWeek) {
    DOM.btnCalNextWeek.addEventListener('click', () => {
      state.calendarWeekOffset = (state.calendarWeekOffset || 0) + 1;
      renderCalendarStrip(state.sliderDayNumber);
    });
  }

  // Bottom Floating Pill: "I want to become..."
  if (DOM.btnBottomGoalPill) {
    DOM.btnBottomGoalPill.addEventListener('click', () => {
      switchView('config');
      DOM.inputGoal.focus();
    });
  }

  // Keyboard navigation for Dashboard slider
  document.addEventListener('keydown', (e) => {
    if (state.currentView === 'dashboard' && !state.activeDayModal && !DOM.taskModal.classList.contains('open') && !DOM.authModal.classList.contains('open')) {
      if (e.key === 'ArrowLeft') {
        slideToDay(state.sliderDayNumber - 1, 'prev');
      } else if (e.key === 'ArrowRight') {
        slideToDay(state.sliderDayNumber + 1, 'next');
      }
    }
  });

  // Touch swipe support for Mobile/Tablet Slider (smooth tracking, ignores vertical scrolling)
  const centerstage = document.querySelector('.dash-centerstage-container') || document.querySelector('.slider-viewport-container');
  if (centerstage) {
    let startX = 0;
    let startY = 0;
    let isTracking = false;

    centerstage.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        isTracking = true;
      }
    }, { passive: true });

    centerstage.addEventListener('touchmove', (e) => {
      if (e.touches.length > 1) isTracking = false;
    }, { passive: true });

    centerstage.addEventListener('touchend', (e) => {
      if (!isTracking) return;
      isTracking = false;
      if (e.changedTouches.length === 1) {
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        const diffX = endX - startX;
        const diffY = endY - startY;

        // Ensure swipe is predominantly horizontal and passes threshold
        if (Math.abs(diffX) > 42 && Math.abs(diffX) > Math.abs(diffY) * 1.35) {
          if (diffX < 0) {
            slideToDay(state.sliderDayNumber + 1, 'next');
          } else {
            slideToDay(state.sliderDayNumber - 1, 'prev');
          }
        }
      }
    }, { passive: true });
  }

  // Task Modal tabs
  DOM.tabBtnNote.addEventListener('click', () => switchModalTab('note'));
  DOM.tabBtnCode.addEventListener('click', () => switchModalTab('code'));

  // Task Modal close
  DOM.btnModalClose.addEventListener('click', closeTaskModal);
  DOM.taskModal.addEventListener('click', (e) => {
    if (e.target === DOM.taskModal) closeTaskModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && DOM.taskModal.classList.contains('open')) {
      closeTaskModal();
    }
  });

  // Note textarea inputs
  DOM.noteInput.addEventListener('input', () => {
    updateNoteCharCount();
    triggerAutosave();
  });

  // Code editor language toggle
  DOM.pillLangPython.addEventListener('click', () => setModalLanguage('python'));
  DOM.pillLangJS.addEventListener('click', () => setModalLanguage('javascript'));

  // Code editor Tab key indentation
  DOM.codeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = DOM.codeInput.selectionStart;
      const end = DOM.codeInput.selectionEnd;
      const val = DOM.codeInput.value;
      DOM.codeInput.value = val.substring(0, start) + '  ' + val.substring(end);
      DOM.codeInput.selectionStart = DOM.codeInput.selectionEnd = start + 2;
      triggerAutosave();
      validateCompletionCriteria();
    }
  });

  DOM.codeInput.addEventListener('input', () => {
    triggerAutosave();
    validateCompletionCriteria();
  });

  // Code execution & terminal
  DOM.btnRunCode.addEventListener('click', executeCode);
  DOM.btnClearTerminal.addEventListener('click', () => {
    DOM.terminalOutput.innerHTML = '<span class="terminal-empty">Terminal cleared.</span>';
    DOM.terminalExecutionTime.textContent = 'Cleared';
  });

  // Modal actions
  DOM.btnModalComplete.addEventListener('click', markTaskComplete);
  DOM.btnModalSkip.addEventListener('click', () => {
    if (state.activeDayModal) {
      skipAndReviewLater(state.activeDayModal.day);
    }
  });

  // Profile Data Export / Reset
  DOM.btnExportJson.addEventListener('click', handleExportJson);
  DOM.btnExportMarkdown.addEventListener('click', handleExportMarkdown);
  DOM.btnResetAll.addEventListener('click', handleResetAll);

  // Multi-Device Status & Modal
  if (DOM.btnSyncStatus) DOM.btnSyncStatus.addEventListener('click', openDeviceModal);
  DOM.btnDeviceModalClose.addEventListener('click', closeDeviceModal);
  DOM.btnDeviceModalDone.addEventListener('click', closeDeviceModal);
  DOM.deviceModal.addEventListener('click', (e) => {
    if (e.target === DOM.deviceModal) closeDeviceModal();
  });

  // Shortcut inside Device Modal to Plan Setup
  if (DOM.btnModalOpenPlanSetup) {
    DOM.btnModalOpenPlanSetup.addEventListener('click', () => {
      closeDeviceModal();
      switchView('config');
    });
  }

  // User Auth & Modal
  DOM.btnOpenAuthModal.addEventListener('click', () => openAuthModal('google'));

  DOM.btnUserMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    if (DOM.settingsDropdownMenu) DOM.settingsDropdownMenu.style.display = 'none';
    const isOpen = DOM.userDropdownMenu.style.display === 'block';
    DOM.userDropdownMenu.style.display = isOpen ? 'none' : 'block';
  });

  document.addEventListener('click', (e) => {
    if (!DOM.userMenuGroup.contains(e.target)) {
      DOM.userDropdownMenu.style.display = 'none';
    }
  });

  // Profile inside User Dropdown Menu
  if (DOM.btnUserDropdownProfile) {
    DOM.btnUserDropdownProfile.addEventListener('click', () => {
      DOM.userDropdownMenu.style.display = 'none';
      switchView('profile');
    });
  }

  // Sign In inside User Dropdown Menu (for guest)
  if (DOM.btnUserDropdownSignIn) {
    DOM.btnUserDropdownSignIn.addEventListener('click', () => {
      DOM.userDropdownMenu.style.display = 'none';
      openAuthModal('google');
    });
  }

  DOM.btnSwitchAccount.addEventListener('click', () => {
    DOM.userDropdownMenu.style.display = 'none';
    openAuthModal('demo');
  });

  DOM.btnOpenGoogleSettings.addEventListener('click', () => {
    DOM.userDropdownMenu.style.display = 'none';
    openAuthModal('settings');
  });

  DOM.btnSignOut.addEventListener('click', async () => {
    DOM.userDropdownMenu.style.display = 'none';
    await logoutUser();
    await reloadUserData();
    showToast('Signed out. Switched to Guest mode.', 'normal');
  });

  // Global Escape key dismiss for popovers
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (DOM.settingsDropdownMenu && DOM.settingsDropdownMenu.style.display === 'block') {
        DOM.settingsDropdownMenu.style.display = 'none';
        if (DOM.btnOpenSettings) DOM.btnOpenSettings.classList.remove('open');
      }
      if (DOM.userDropdownMenu && DOM.userDropdownMenu.style.display === 'block') {
        DOM.userDropdownMenu.style.display = 'none';
      }
    }
  });

  DOM.btnAuthModalClose.addEventListener('click', closeAuthModal);
  DOM.btnAuthModalDone.addEventListener('click', closeAuthModal);
  DOM.authModal.addEventListener('click', (e) => {
    if (e.target === DOM.authModal) closeAuthModal();
  });

  DOM.tabBtnAuthGoogle.addEventListener('click', () => switchAuthTab('google'));
  DOM.tabBtnAuthDemo.addEventListener('click', () => switchAuthTab('demo'));
  DOM.tabBtnAuthSettings.addEventListener('click', () => switchAuthTab('settings'));
  DOM.btnGoToSettingsTab.addEventListener('click', () => switchAuthTab('settings'));
  DOM.btnGoToDemoTab.addEventListener('click', () => switchAuthTab('demo'));

  // Preset Demo Accounts
  document.querySelectorAll('.btn-demo-user').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const email = e.currentTarget.dataset.email;
      const name = e.currentTarget.dataset.name;
      try {
        await loginWithDemoAccount(email, name);
        closeAuthModal();
        await reloadUserData();
        showToast(`Signed in as ${name}!`, 'success');
      } catch (err) {
        showToast(err.message, 'danger');
      }
    });
  });

  // Custom User Sign-In Form
  DOM.customUserLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = DOM.inputCustomEmail.value.trim();
    const name = DOM.inputCustomName.value.trim();
    try {
      await loginWithDemoAccount(email, name);
      closeAuthModal();
      await reloadUserData();
      showToast(`Signed in as ${name}!`, 'success');
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });

  // Save Google Client ID Form
  DOM.formSaveGoogleClient.addEventListener('submit', async (e) => {
    e.preventDefault();
    const clientId = DOM.inputGoogleClientId.value.trim();
    try {
      await saveGoogleClientId(clientId);
      showToast('Google Client ID saved! Initializing Google Sign-In...', 'success');
      await setupGoogleIdentity();
      switchAuthTab('google');
    } catch (err) {
      showToast('Error saving Client ID: ' + err.message, 'danger');
    }
  });
}

// ==========================================
// Toast Notification Utility
// ==========================================
function showToast(message, type = 'normal') {
  const toast = document.createElement('div');
  toast.className = 'toast';

  let icon = '<span class="material-symbols-rounded">info</span>';
  if (type === 'success') icon = '<span class="material-symbols-rounded" style="color: var(--success);">check_circle</span>';
  else if (type === 'warning') icon = '<span class="material-symbols-rounded" style="color: var(--warning);">warning</span>';
  else if (type === 'danger') icon = '<span class="material-symbols-rounded" style="color: var(--danger);">cancel</span>';

  toast.innerHTML = `<span aria-hidden="true">${icon}</span> <span>${message}</span>`;
  DOM.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px) scale(0.95)';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 250);
  }, 3500);
}

// Helper: Escape HTML strings to prevent XSS
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getStatusDisplayName(status) {
  switch (status) {
    case 'completed': return 'Completed';
    case 'active': return 'In Progress';
    case 'skipped': return 'Pending Review';
    case 'locked': return 'Locked';
    default: return status;
  }
}
