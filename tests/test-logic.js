import { cleanAiResponse, validatePlanJson, generatePrompt, getSamplePlan } from '../scripts/promptGenerator.js';

console.log('1. Testing generatePrompt...');
const prompt = generatePrompt({ goal: 'Learn Python', duration: 7, targetLanguage: 'python' });
if (!prompt.includes('Learn Python') || !prompt.includes('7 consecutive days')) {
  throw new Error('Prompt generation failed');
}
console.log('   ✓ generatePrompt passed');

console.log('2. Testing cleanAiResponse with markdown code fences and conversational preamble...');
const markdownInput = 'Here is your learning plan as requested:\n```json\n[\n  {\n    "day": 1,\n    "title": "Intro to Python",\n    "description": "Learn syntax and run your first print script."\n  }\n]\n```\nGood luck studying!';
const cleaned = cleanAiResponse(markdownInput);
console.log('   Cleaned output:', cleaned);
if (!cleaned.startsWith('[') || !cleaned.endsWith(']')) {
  throw new Error('Markdown stripping failed: ' + cleaned);
}
console.log('   ✓ cleanAiResponse passed');

console.log('3. Testing validatePlanJson on clean input...');
const validRes = validatePlanJson(markdownInput);
if (!validRes.isValid || validRes.data.length !== 1 || validRes.data[0].day !== 1) {
  throw new Error('Valid plan validation failed: ' + JSON.stringify(validRes));
}
console.log('   ✓ Valid plan validation passed');

console.log('4. Testing validatePlanJson on built-in samples...');
const pythonSample = getSamplePlan('python');
const pyRes = validatePlanJson(JSON.stringify(pythonSample));
if (!pyRes.isValid || pyRes.data.length !== 7) {
  throw new Error('Python sample validation failed');
}
const jsSample = getSamplePlan('javascript');
const jsRes = validatePlanJson(JSON.stringify(jsSample));
if (!jsRes.isValid || jsRes.data.length !== 7) {
  throw new Error('JS sample validation failed');
}
console.log('   ✓ Built-in sample validation passed (7 days each)');

console.log('5. Testing schema validation error cases:');
// Missing title
const missingTitle = validatePlanJson('[{"day": 1, "description": "No title here"}]');
if (missingTitle.isValid || !missingTitle.error.includes('title')) {
  throw new Error('Missing title test failed');
}
console.log('   ✓ Detected missing title correctly:', missingTitle.error);

// Missing description
const missingDesc = validatePlanJson('[{"day": 1, "title": "Day 1 Title"}]');
if (missingDesc.isValid || !missingDesc.error.includes('description')) {
  throw new Error('Missing description test failed');
}
console.log('   ✓ Detected missing description correctly:', missingDesc.error);

// Non-array
const nonArray = validatePlanJson('{"day": 1, "title": "Obj", "description": "Desc"}');
if (nonArray.isValid || !nonArray.error.includes('JSON Array')) {
  throw new Error('Non-array test failed');
}
console.log('   ✓ Detected non-array root correctly:', nonArray.error);

// Duplicate day
const duplicateDay = validatePlanJson('[{"day": 1, "title": "A", "description": "B"}, {"day": 1, "title": "C", "description": "D"}]');
if (duplicateDay.isValid || !duplicateDay.error.includes('Duplicate')) {
  throw new Error('Duplicate day test failed');
}
console.log('   ✓ Detected duplicate day correctly:', duplicateDay.error);

console.log('\n=========================================');
console.log('🎉 ALL LOGIC AND VALIDATION TESTS PASSED!');
console.log('=========================================\n');
