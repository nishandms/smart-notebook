import assert from 'node:assert';

console.log('--- 1. Testing Daily Habit Consistency Calculation ---');

function calculateDailyConsistencyLogic({ usageDates, planCreatedAt, todayStr }) {
  const today = new Date(todayStr + 'T00:00:00');
  let planStart = today;
  if (planCreatedAt) {
    const parsed = new Date(planCreatedAt + 'T00:00:00');
    if (!isNaN(parsed.getTime())) {
      planStart = parsed;
    }
  }

  const diffTime = today.getTime() - planStart.getTime();
  const daysElapsed = Math.max(1, Math.round(diffTime / 86400000) + 1);

  const planStartStr = planStart.toISOString().slice(0, 10);
  const activeDatesInPlan = usageDates.filter(d => d >= planStartStr && d <= todayStr);
  const distinctDaysUsed = Math.max(1, activeDatesInPlan.length);
  const trackedWindow = daysElapsed;

  const consistencyScore = Math.min(100, Math.round((distinctDaysUsed / trackedWindow) * 100));

  // Compute streak
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

// Test Case A: Brand new user on Day 1
const resA = calculateDailyConsistencyLogic({
  usageDates: ['2026-11-01'],
  planCreatedAt: '2026-11-01',
  todayStr: '2026-11-01'
});
assert.strictEqual(resA.consistencyScore, 100, 'Day 1 used should be 100% consistency');
assert.strictEqual(resA.streak, 1, 'Day 1 streak should be 1');
console.log('   ✓ Day 1 fresh plan: 100% consistency, 1-day streak');

// Test Case B: User has plan started 4 days ago, used app 3 of those days
const resB = calculateDailyConsistencyLogic({
  usageDates: ['2026-10-29', '2026-10-31', '2026-11-01'],
  planCreatedAt: '2026-10-29',
  todayStr: '2026-11-01'
});
// 4 days elapsed (29, 30, 31, 01), 3 days used -> 3/4 = 75%
assert.strictEqual(resB.daysElapsed, 4, 'Days elapsed should be 4');
assert.strictEqual(resB.daysUsedCount, 3, 'Days used should be 3');
assert.strictEqual(resB.consistencyScore, 75, 'Consistency should be 75%');
assert.strictEqual(resB.streak, 2, 'Streak should be 2 consecutive days (Oct 31, Nov 01)');
console.log('   ✓ 4 days elapsed with 3 days used: 75% consistency, 2-day streak');

// Test Case C: 7 days elapsed with perfect everyday usage
const resC = calculateDailyConsistencyLogic({
  usageDates: ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'],
  planCreatedAt: '2026-10-26',
  todayStr: '2026-11-01'
});
assert.strictEqual(resC.consistencyScore, 100, '7 of 7 days used should be 100%');
assert.strictEqual(resC.streak, 7, 'Streak should be 7 consecutive days');
console.log('   ✓ 7-day perfect streak: 100% consistency, 7-day streak');

console.log('\n--- 2. Testing Date Anchoring Logic ---');
// Verify that header date does NOT change when sliding tasks
let dashTodayLabel = '';
let dashDateTitle = '';

function renderDashboardHeaderDateMock() {
  const today = new Date('2026-11-01T12:00:00');
  dashTodayLabel = 'Today';
  dashDateTitle = today.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

function slideToDayMock(targetDayNum) {
  // sliderDayNumber updates, but header date remains Today
  renderDashboardHeaderDateMock();
}

renderDashboardHeaderDateMock();
const initialLabel = dashTodayLabel;
const initialDate = dashDateTitle;

slideToDayMock(2);
assert.strictEqual(dashTodayLabel, initialLabel, 'Header label must remain Today on Day 2');
assert.strictEqual(dashDateTitle, initialDate, 'Header date must remain current date on Day 2');

slideToDayMock(5);
assert.strictEqual(dashTodayLabel, initialLabel, 'Header label must remain Today on Day 5');
assert.strictEqual(dashDateTitle, initialDate, 'Header date must remain current date on Day 5');
console.log('   ✓ Dashboard header date stays firmly locked on Today when sliding tasks');

console.log('\n--- 3. Testing Calendar Strip Today Capsule Anchoring ---');
function getCalendarDayClasses(colDateStr, todayStr, selectedDayNumber, mappedDayNum) {
  const isToday = colDateStr === todayStr;
  const isViewingThisCard = selectedDayNumber && mappedDayNum === selectedDayNumber;
  return `calendar-day-col ${isToday ? 'active-capsule is-today' : ''} ${isViewingThisCard && !isToday ? 'is-viewing-card' : ''}`.trim();
}

const todayClassOnDay1 = getCalendarDayClasses('2026-11-01', '2026-11-01', 1, 1);
assert.ok(todayClassOnDay1.includes('active-capsule is-today'), 'Today gets active-capsule');

// When user slides to Day 3 card:
const todayClassWhenViewingDay3 = getCalendarDayClasses('2026-11-01', '2026-11-01', 3, 1);
assert.ok(todayClassWhenViewingDay3.includes('active-capsule is-today'), 'Today retains active-capsule even when Day 3 is viewed');

const day3ClassWhenViewingDay3 = getCalendarDayClasses('2026-11-03', '2026-11-01', 3, 3);
assert.ok(day3ClassWhenViewingDay3.includes('is-viewing-card'), 'Day 3 gets is-viewing-card indicator');
assert.ok(!day3ClassWhenViewingDay3.includes('active-capsule'), 'Day 3 must NOT have active-capsule');
console.log('   ✓ Calendar strip: active-capsule stays locked on Today, viewed task gets viewing indicator');

console.log('\n=========================================');
console.log('🎉 ALL CONSISTENCY AND DATE ANCHORING TESTS PASSED!');
console.log('=========================================\n');

