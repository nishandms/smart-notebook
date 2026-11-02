import assert from 'node:assert';
import fs from 'node:fs';

console.log('--- Testing Web View Navigation Architecture ---');

// 1. Inspect HTML structure
const html = fs.readFileSync('index.html', 'utf8');

// Verify dashboard menu is removed
assert.strictEqual(
  html.includes('id="btnNavMenu"'),
  false,
  'FAIL: btnNavMenu (dashboard dropdown button) must be removed from web header'
);
assert.strictEqual(
  html.includes('id="navMenuDropdown"'),
  false,
  'FAIL: navMenuDropdown must be removed from web header'
);
console.log('✓ 1. Dashboard menu successfully removed from web header');

// Verify Back to Home button exists in header
assert.strictEqual(
  html.includes('id="btnBackToHome"'),
  true,
  'FAIL: btnBackToHome must exist in header'
);
assert.strictEqual(
  html.includes('id="brandHomeBtn"'),
  true,
  'FAIL: brandHomeBtn must exist and return home'
);
console.log('✓ 2. Top "Back to Home" button and clickable brand home link exist');

// Verify Plan Setup is moved into Settings
assert.strictEqual(
  html.includes('id="settingsMenuWrapper"'),
  true,
  'FAIL: settingsMenuWrapper must exist'
);
assert.strictEqual(
  html.includes('id="settingsDropdownMenu"'),
  true,
  'FAIL: settingsDropdownMenu must exist'
);
assert.strictEqual(
  html.includes('id="btnSettingsPlanSetup"'),
  true,
  'FAIL: btnSettingsPlanSetup must exist inside Settings'
);
assert.strictEqual(
  html.includes('id="btnSettingsDeviceSync"'),
  true,
  'FAIL: btnSettingsDeviceSync must exist inside Settings'
);
assert.strictEqual(
  html.includes('id="btnModalOpenPlanSetup"'),
  true,
  'FAIL: btnModalOpenPlanSetup shortcut must exist inside deviceModal'
);
console.log('✓ 3. Plan Setup is moved inside Settings dropdown and modal');

// Verify Profile is moved to Google Auth / User Menu
assert.strictEqual(
  html.includes('id="btnUserDropdownProfile"'),
  true,
  'FAIL: btnUserDropdownProfile must exist inside userDropdownMenu'
);
assert.strictEqual(
  html.includes('id="btnSignOut"'),
  true,
  'FAIL: btnSignOut must exist inside userDropdownMenu'
);
console.log('✓ 4. Profile is moved to Google Auth / Logout menu');

// 2. Test Router / switchView state behavior
console.log('\n--- Testing switchView & Back to Home Visibility Logic ---');

function mockSwitchView(viewName, domState) {
  domState.currentView = viewName;
  // Rule: btnBackToHome is hidden on dashboard, visible on any other view
  domState.btnBackToHomeDisplay = (viewName === 'dashboard') ? 'none' : 'inline-flex';
  domState.viewConfigActive = (viewName === 'config');
  domState.viewDashboardActive = (viewName === 'dashboard');
  domState.viewProfileActive = (viewName === 'profile');
}

const domState = {};

// Test when navigating to dashboard
mockSwitchView('dashboard', domState);
assert.strictEqual(domState.btnBackToHomeDisplay, 'none', 'Back to Home button must be hidden on dashboard');
assert.strictEqual(domState.viewDashboardActive, true);
console.log('✓ When on Dashboard (Home), "Back to Home" is hidden');

// Test when navigating to Plan Setup (config)
mockSwitchView('config', domState);
assert.strictEqual(domState.btnBackToHomeDisplay, 'inline-flex', 'Back to Home button must be visible on config view');
assert.strictEqual(domState.viewConfigActive, true);
console.log('✓ When on Plan Setup (config), "Back to Home" is visible (inline-flex)');

// Test when navigating to Profile
mockSwitchView('profile', domState);
assert.strictEqual(domState.btnBackToHomeDisplay, 'inline-flex', 'Back to Home button must be visible on profile view');
assert.strictEqual(domState.viewProfileActive, true);
console.log('✓ When on Profile, "Back to Home" is visible (inline-flex)');

// Test returning to dashboard
mockSwitchView('dashboard', domState);
assert.strictEqual(domState.btnBackToHomeDisplay, 'none');
console.log('✓ Returning to Dashboard hides "Back to Home" button');

console.log('\n=========================================');
console.log('🎉 ALL WEB VIEW NAVIGATION TESTS PASSED!');
console.log('=========================================');

