// Comprehensive test for Virtual Card Deck logic and offsets
import assert from 'node:assert';

// Mock state and days
const sampleDays = [
  { day: 1, title: 'Day 1 Task', description: 'Desc 1', status: 'active', duration: 2 },
  { day: 2, title: 'Day 2 Task', description: 'Desc 2', status: 'locked', duration: 2 },
  { day: 3, title: 'Day 3 Task', description: 'Desc 3', status: 'locked', duration: 2 },
  { day: 4, title: 'Day 4 Task', description: 'Desc 4', status: 'locked', duration: 2 },
  { day: 5, title: 'Day 5 Task', description: 'Desc 5', status: 'locked', duration: 2 },
  { day: 6, title: 'Day 6 Task', description: 'Desc 6', status: 'locked', duration: 2 },
  { day: 7, title: 'Day 7 Task', description: 'Desc 7', status: 'locked', duration: 2 }
];

function calculateOffsetClass(cardDay, currentDay, totalDays) {
  const diff = cardDay - currentDay;
  if (diff < -1) return 'deck-offset-passed-far';
  if (diff === -1) return 'deck-offset-passed';
  if (diff === 0) return 'deck-offset-0';
  if (diff === 1) return 'deck-offset-1';
  if (diff === 2) return 'deck-offset-2';
  return 'deck-offset-waiting';
}

console.log('1. Testing Card Offsets for Day 1:');
const day1Offsets = sampleDays.map(d => ({
  day: d.day,
  offsetClass: calculateOffsetClass(d.day, 1, 7)
}));

assert.strictEqual(day1Offsets[0].offsetClass, 'deck-offset-0', 'Day 1 should be active front card');
assert.strictEqual(day1Offsets[1].offsetClass, 'deck-offset-1', 'Day 2 should be middle stack card');
assert.strictEqual(day1Offsets[2].offsetClass, 'deck-offset-2', 'Day 3 should be deep stack card');
assert.strictEqual(day1Offsets[3].offsetClass, 'deck-offset-waiting', 'Day 4 should be waiting');
console.log('   ✓ Day 1 offsets correct (3 cards visible: Day 1 front, Day 2 mid, Day 3 deep)');

console.log('2. Testing Card Offsets when sliding to Day 2:');
const day2Offsets = sampleDays.map(d => ({
  day: d.day,
  offsetClass: calculateOffsetClass(d.day, 2, 7)
}));

assert.strictEqual(day2Offsets[0].offsetClass, 'deck-offset-passed', 'Day 1 should be passed (gliding out to left)');
assert.strictEqual(day2Offsets[1].offsetClass, 'deck-offset-0', 'Day 2 should be active front card');
assert.strictEqual(day2Offsets[2].offsetClass, 'deck-offset-1', 'Day 3 should be middle stack card');
assert.strictEqual(day2Offsets[3].offsetClass, 'deck-offset-2', 'Day 4 should be deep stack card');
assert.strictEqual(day2Offsets[4].offsetClass, 'deck-offset-waiting', 'Day 5 should be waiting');

// Verify that EXACTLY 3 cards are in the active stack view (offset 0, offset 1, offset 2)
const visibleStackCards = day2Offsets.filter(d => ['deck-offset-0', 'deck-offset-1', 'deck-offset-2'].includes(d.offsetClass));
assert.strictEqual(visibleStackCards.length, 3, 'Exactly 3 cards must be visible in the 3D stack at all times!');
console.log('   ✓ Day 2 offsets correct (Day 1 passed, Day 2 front, Day 3 mid, Day 4 deep -> exactly 3 in stack)');

console.log('3. Testing Card Offsets when sliding back to Day 1:');
const day1BackOffsets = sampleDays.map(d => ({
  day: d.day,
  offsetClass: calculateOffsetClass(d.day, 1, 7)
}));

assert.strictEqual(day1BackOffsets[0].offsetClass, 'deck-offset-0', 'Day 1 returns to front');
assert.strictEqual(day1BackOffsets[1].offsetClass, 'deck-offset-1', 'Day 2 settles to middle');
assert.strictEqual(day1BackOffsets[2].offsetClass, 'deck-offset-2', 'Day 3 settles to deep');
assert.strictEqual(day1BackOffsets[3].offsetClass, 'deck-offset-waiting', 'Day 4 returns to waiting');
console.log('   ✓ Day 1 back transition correct (Continuous 3 cards maintained, no collapse to 2)');

console.log('4. Testing Final Day 7 with Completion Card:');
const totalDays = 7;
const completionDay = totalDays + 1; // 8
const day7Offsets = [
  ...sampleDays.map(d => ({ day: d.day, offsetClass: calculateOffsetClass(d.day, 7, 7) })),
  { day: 'complete', offsetClass: calculateOffsetClass(completionDay, 7, 7) }
];

const day7Front = day7Offsets.find(d => d.day === 7);
const day7Mid = day7Offsets.find(d => d.day === 'complete');
assert.strictEqual(day7Front.offsetClass, 'deck-offset-0', 'Day 7 is front card');
assert.strictEqual(day7Mid.offsetClass, 'deck-offset-1', 'Completion card is middle stack card');
console.log('   ✓ Final day maintains stacked depth with Completion card');

console.log('\n=========================================');
console.log('🎉 ALL VIRTUAL CARD DECK TESTS PASSED!');
console.log('=========================================');

