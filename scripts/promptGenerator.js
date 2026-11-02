/**
 * Smart Notebook - Prompt Generator & AI JSON Preprocessor / Validator
 */

/**
 * Generate formatted prompt to copy into external AI models
 */
export function generatePrompt({ goal, duration, targetLanguage = 'python' }) {
  const languageNote = targetLanguage === 'python' ? 'Python' : 'JavaScript';

  return `You are an expert educational curriculum designer and senior software engineer.
Create a structured, step-by-step daily learning roadmap for: "${goal}" spanning ${duration} consecutive days.

CRITICAL INSTRUCTION:
Your response MUST be ONLY a valid raw JSON array containing exactly ${duration} objects, with no conversational preamble, markdown code fence blocks, or postscript explanations.

Each object in the array MUST strictly conform to this schema:
[
  {
    "day": 1,
    "title": "Clear, engaging topic title",
    "description": "Specific concepts to master and hands-on mini challenge to complete (2-3 sentences).",
    "starterCode": "# Runnable ${languageNote} starter snippet or exercise placeholder"
  }
]

Requirements:
1. "day": Must be an integer starting at 1 and incrementing sequentially up to ${duration}.
2. "title": Concise, focused title (string, non-empty).
3. "description": Clear learning objectives and practice task (string, non-empty).
4. "starterCode": Minimal, valid starter code in ${languageNote} for in-browser execution.
5. Provide realistic, progressive learning curves (foundations -> intermediate -> project/review).`;
}

/**
 * Clean AI text using RegEx to strip markdown code fences, conversational fluff, and normalize JSON
 */
export function cleanAiResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return '';
  }

  let text = rawText.trim();

  // Strip markdown code blocks: ```json ... ``` or ``` ... ```
  text = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, '$1');

  // Strip single backticks wrapping the whole string
  text = text.replace(/^`+|`+$/g, '');

  // Normalize smart quotes to standard ASCII quotes
  text = text
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");

  // Extract content between the first '[' and last ']' if surrounded by conversational filler
  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');

  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    text = text.slice(firstBracket, lastBracket + 1);
  }

  // Remove trailing commas before closing braces/brackets (common AI JSON glitch)
  text = text.replace(/,\s*([\]}])/g, '$1');

  return text.trim();
}

/**
 * Validate parsed JSON against schema rules
 * Returns { isValid: boolean, data?: Array, error?: string, details?: string }
 */
export function validatePlanJson(rawInput) {
  const cleaned = cleanAiResponse(rawInput);

  if (!cleaned) {
    return {
      isValid: false,
      error: 'Empty input. Please paste the JSON array response from your AI model.'
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    return {
      isValid: false,
      error: 'Invalid JSON syntax.',
      details: `Could not parse text as JSON. Error: ${err.message}. Make sure all brackets and quotes are balanced.`
    };
  }

  if (!Array.isArray(parsed)) {
    return {
      isValid: false,
      error: 'Root format must be a JSON Array.',
      details: 'The top-level structure must be a list enclosed in square brackets [ ... ], containing day items.'
    };
  }

  if (parsed.length === 0) {
    return {
      isValid: false,
      error: 'Empty plan array.',
      details: 'The provided JSON array contains no day items. It must have at least 1 day.'
    };
  }

  const sanitized = [];
  const seenDays = new Set();

  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    const itemIndex = i + 1;

    if (!item || typeof item !== 'object') {
      return {
        isValid: false,
        error: `Item #${itemIndex} is not an object.`,
        details: `Expected an object with keys "day", "title", and "description", but got: ${typeof item}.`
      };
    }

    // Validate "day"
    if (item.day === undefined || item.day === null || isNaN(Number(item.day))) {
      return {
        isValid: false,
        error: `Item #${itemIndex} is missing or has an invalid "day" field.`,
        details: `Key "day" must be a positive integer.`
      };
    }

    const dayNum = Number(item.day);
    if (dayNum <= 0) {
      return {
        isValid: false,
        error: `Item #${itemIndex} has an invalid day number: ${dayNum}.`,
        details: `"day" must be greater than 0.`
      };
    }

    if (seenDays.has(dayNum)) {
      return {
        isValid: false,
        error: `Duplicate day number found: Day ${dayNum}.`,
        details: `Each day in the plan must have a unique sequential number.`
      };
    }
    seenDays.add(dayNum);

    // Validate "title"
    if (typeof item.title !== 'string' || !item.title.trim()) {
      return {
        isValid: false,
        error: `Item for Day ${dayNum} is missing a "title".`,
        details: `The "title" key is required and must be a non-empty string.`
      };
    }

    // Validate "description"
    if (typeof item.description !== 'string' || !item.description.trim()) {
      return {
        isValid: false,
        error: `Item for Day ${dayNum} is missing a "description".`,
        details: `The "description" key is required and must be a non-empty string.`
      };
    }

    sanitized.push({
      day: dayNum,
      title: item.title.trim(),
      description: item.description.trim(),
      starterCode: typeof item.starterCode === 'string' ? item.starterCode : ''
    });
  }

  // Sort by day number
  sanitized.sort((a, b) => a.day - b.day);

  return {
    isValid: true,
    data: sanitized,
    cleanedText: cleaned
  };
}

/**
 * Built-in ready-to-use sample plans for instant demonstration
 */
export function getSamplePlan(goalType = 'python') {
  if (goalType === 'javascript') {
    return [
      {
        day: 1,
        title: "Modern JS Foundations & Primitives",
        description: "Explore let/const scoping, primitive types, and template literals. Test string interpolation in the console.",
        starterCode: "// Modern JS variables & template literals\nconst student = 'Explorer';\nlet hoursStudied = 2;\nconsole.log(`Welcome, ${student}! Goal: Master modern JS.`);\nconsole.log(`Hours planned today: ${hoursStudied}`);"
      },
      {
        day: 2,
        title: "Arrow Functions & First-Class Functions",
        description: "Master concise arrow syntax, default parameters, and passing functions as arguments.",
        starterCode: "const square = (n) => n * n;\nconst formatResult = (fn, val) => `Result of calculation: ${fn(val)}`;\n\nconsole.log(formatResult(square, 9));"
      },
      {
        day: 3,
        title: "Array Higher-Order Methods (map, filter, reduce)",
        description: "Transform and filter data collections declaratively without traditional for loops.",
        starterCode: "const scores = [65, 88, 92, 45, 78, 95];\nconst honors = scores.filter(s => s >= 80);\nconst average = scores.reduce((sum, s) => sum + s, 0) / scores.length;\n\nconsole.log('High scores:', honors);\nconsole.log('Class average:', average.toFixed(1));"
      },
      {
        day: 4,
        title: "Objects, Destructuring & Rest/Spread",
        description: "Learn shallow copying, object destructuring with aliases, and rest parameters in functions.",
        starterCode: "const config = { theme: 'monochrome', cache: true, port: 8080 };\nconst { theme, ...options } = config;\n\nconsole.log('Active theme:', theme);\nconsole.log('Server options:', options);"
      },
      {
        day: 5,
        title: "Asynchronous JavaScript & Promises",
        description: "Understand the event loop, microtask queue, and chaining Promises.",
        starterCode: "const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));\n\nconsole.log('Step 1: Starting async pipeline...');\nwait(200).then(() => {\n  console.log('Step 2: Promise fulfilled successfully!');\n});"
      },
      {
        day: 6,
        title: "Async / Await and Error Handling",
        description: "Write readable synchronous-style async code using try/catch blocks.",
        starterCode: "async function fetchUserStatus(id) {\n  try {\n    return { id, status: 'online', lastActive: new Date().toLocaleTimeString() };\n  } catch (err) {\n    return { error: err.message };\n  }\n}\n\nfetchUserStatus(42).then(data => console.log('User status:', data));"
      },
      {
        day: 7,
        title: "Mini Project: State Store with Event Emitters",
        description: "Combine closures and arrays to build a lightweight observable pub-sub state store.",
        starterCode: "function createStore(initial) {\n  let state = initial;\n  const listeners = [];\n  return {\n    getState: () => state,\n    subscribe: (fn) => listeners.push(fn),\n    setState: (next) => {\n      state = typeof next === 'function' ? next(state) : next;\n      listeners.forEach(fn => fn(state));\n    }\n  };\n}\n\nconst store = createStore({ streak: 7 });\nstore.subscribe(s => console.log('State updated:', s));\nstore.setState(s => ({ ...s, streak: s.streak + 1 }));"
      }
    ];
  }

  // Default Python 7-Day Plan
  return [
    {
      day: 1,
      title: "Python Basics: Variables, Types & f-Strings",
      description: "Learn numeric and string primitives, basic arithmetic, and dynamic type casting in Python.",
      starterCode: "# Day 1: Exploring variables and formatted strings\nlearner = \"Nishant\"\nstreak_days = 1\nlanguage = \"Python 3\"\n\nmessage = f\"Learner: {learner} | Streak: {streak_days} day | Target: {language}\"\nprint(message)\nprint(f\"Data type of streak: {type(streak_days).__name__}\")"
    },
    {
      day: 2,
      title: "Control Flow: Conditionals & Truthiness",
      description: "Practice if/elif/else blocks, Boolean operators, and understanding truthy/falsy evaluation.",
      starterCode: "score = 88\n\nif score >= 90:\n    grade = 'A'\nelif score >= 80:\n    grade = 'B'\nelif score >= 70:\n    grade = 'C'\nelse:\n    grade = 'D'\n\nprint(f\"Exam Score: {score} -> Grade: {grade}\")"
    },
    {
      day: 3,
      title: "Data Structures: Lists & List Comprehensions",
      description: "Master list operations (append, pop, slice) and concise declarative comprehensions.",
      starterCode: "numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]\nevens = [n for n in numbers if n % 2 == 0]\nsquares = [n**2 for n in numbers]\n\nprint(f\"Original: {numbers}\")\nprint(f\"Evens only: {evens}\")\nprint(f\"Squares: {squares}\")"
    },
    {
      day: 4,
      title: "Dictionaries & Key-Value Lookups",
      description: "Work with dictionary keys, methods (get, items, values), and nested configuration mappings.",
      starterCode: "notebook_settings = {\n    'theme': 'minimal-monochrome',\n    'accent': 'indigo',\n    'offline_enabled': True,\n    'sync_interval_ms': 5000\n}\n\nfor key, val in notebook_settings.items():\n    print(f\"{key:20} -> {val}\")"
    },
    {
      day: 5,
      title: "Functions, *args, and **kwargs",
      description: "Define clean reusable functions with type hints, default arguments, and variable arguments.",
      starterCode: "def calculate_consistency(completed: int, skipped: int) -> float:\n    total = completed + skipped\n    if total == 0:\n        return 100.0\n    return round((completed / total) * 100.0, 1)\n\nprint(f\"Consistency (8 completed, 2 skipped): {calculate_consistency(8, 2)}%\")"
    },
    {
      day: 6,
      title: "Error Handling with try / except / finally",
      description: "Write resilient code by catching specific exceptions and using custom error messages.",
      starterCode: "def safe_divide(a, b):\n    try:\n        result = a / b\n    except ZeroDivisionError:\n        return \"Error: Cannot divide by zero!\"\n    except TypeError as e:\n        return f\"TypeError: {e}\"\n    else:\n        return f\"Quotient: {result:.2f}\"\n\nprint(safe_divide(42, 7))\nprint(safe_divide(10, 0))"
    },
    {
      day: 7,
      title: "Mini Project: Daily Learning Habit Tracker",
      description: "Synthesize classes, lists, and dicts to build an in-memory habit analytics engine.",
      starterCode: "class LearningJournal:\n    def __init__(self, topic):\n        self.topic = topic\n        self.entries = []\n\n    def add_entry(self, day, minutes, notes):\n        self.entries.append({'day': day, 'minutes': minutes, 'notes': notes})\n\n    def total_hours(self):\n        return sum(e['minutes'] for e in self.entries) / 60\n\njournal = LearningJournal(\"Python Mastery\")\njournal.add_entry(1, 45, \"Variables & types\")\njournal.add_entry(2, 60, \"List comprehensions\")\nprint(f\"{journal.topic} Total Hours: {journal.total_hours():.1f}h across {len(journal.entries)} sessions.\")"
    }
  ];
}
