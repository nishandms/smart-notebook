/**
 * Smart Notebook - In-Browser Client-Side Compilers
 * - Python: Pyodide WebAssembly via CDN
 * - JavaScript: Sandboxed Web Worker execution
 */

const PYODIDE_CDN_SCRIPT = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
const PYODIDE_INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';

let pyodideInstance = null;
let pyodideLoadingPromise = null;

/**
 * Dynamically load Pyodide script tag if not already present
 */
function loadPyodideScript() {
  return new Promise((resolve, reject) => {
    if (window.loadPyodide) {
      resolve();
      return;
    }

    const existingScript = document.querySelector(`script[src*="pyodide.js"]`);
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', (e) => reject(new Error('Failed to load Pyodide CDN script.')));
      return;
    }

    const script = document.createElement('script');
    script.src = PYODIDE_CDN_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Network error loading Pyodide from CDN. Ensure you are connected or CDN is accessible.'));
    document.head.appendChild(script);
  });
}

/**
 * Initialize Pyodide instance singleton with status callbacks
 */
export async function getPyodide(onStatus = () => {}) {
  if (pyodideInstance) {
    return pyodideInstance;
  }

  if (pyodideLoadingPromise) {
    return pyodideLoadingPromise;
  }

  pyodideLoadingPromise = (async () => {
    onStatus('Loading Pyodide runtime script...');
    await loadPyodideScript();

    onStatus('Initializing Python WebAssembly engine...');
    const pyodide = await window.loadPyodide({
      indexURL: PYODIDE_INDEX_URL
    });

    pyodideInstance = pyodide;
    onStatus('Python ready.');
    return pyodide;
  })();

  return pyodideLoadingPromise;
}

/**
 * Execute Python code client-side via Pyodide
 */
export async function runPythonCode(code, onStatus = () => {}) {
  const startTime = performance.now();
  let stdoutLogs = [];
  let stderrLogs = [];

  try {
    const pyodide = await getPyodide(onStatus);
    onStatus('Executing Python script...');

    // Configure stdout & stderr capture handlers
    pyodide.setStdout({
      batched: (text) => {
        stdoutLogs.push(text);
      }
    });

    pyodide.setStderr({
      batched: (text) => {
        stderrLogs.push(text);
      }
    });

    // Execute Python code
    const result = await pyodide.runPythonAsync(code);
    const durationMs = Math.round(performance.now() - startTime);

    let output = stdoutLogs.join('\n');
    if (result !== undefined && result !== null) {
      // If code was an expression or returned something not printed
      const resStr = String(result);
      if (resStr && !output.includes(resStr)) {
        output = output ? `${output}\n-> ${resStr}` : `-> ${resStr}`;
      }
    }

    if (!output && stderrLogs.length === 0) {
      output = '(Code executed successfully with no output)';
    }

    return {
      success: true,
      stdout: output,
      stderr: stderrLogs.join('\n'),
      durationMs
    };
  } catch (err) {
    const durationMs = Math.round(performance.now() - startTime);
    return {
      success: false,
      stdout: stdoutLogs.join('\n'),
      stderr: err.message || String(err),
      durationMs
    };
  }
}

/**
 * Worker script code to run JavaScript in isolated thread with console overrides
 */
const JS_WORKER_CODE = `
self.onmessage = function(e) {
  const { code } = e.data;
  const logs = [];
  const errors = [];

  function formatArg(arg) {
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, null, 2);
      } catch (err) {
        return Object.prototype.toString.call(arg);
      }
    }
    return String(arg);
  }

  // Intercept console functions
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info
  };

  console.log = function(...args) {
    logs.push(args.map(formatArg).join(' '));
  };
  console.info = console.log;
  console.warn = function(...args) {
    logs.push('[WARN] ' + args.map(formatArg).join(' '));
  };
  console.error = function(...args) {
    errors.push(args.map(formatArg).join(' '));
  };

  try {
    const fn = new Function(code);
    const result = fn();
    let finalLog = logs.join('\\n');
    if (result !== undefined) {
      const resStr = formatArg(result);
      finalLog = finalLog ? finalLog + '\\n-> ' + resStr : '-> ' + resStr;
    }
    self.postMessage({
      success: true,
      stdout: finalLog,
      stderr: errors.join('\\n')
    });
  } catch (err) {
    self.postMessage({
      success: false,
      stdout: logs.join('\\n'),
      stderr: (err && err.stack) ? err.stack : String(err)
    });
  }
};
`;

/**
 * Execute JavaScript code inside a sandboxed Web Worker with a 5000ms timeout
 */
export function runJavaScriptCode(code, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const startTime = performance.now();
    let blob;
    let worker;

    try {
      blob = new Blob([JS_WORKER_CODE], { type: 'application/javascript' });
      worker = new Worker(URL.createObjectURL(blob));
    } catch (err) {
      resolve({
        success: false,
        stdout: '',
        stderr: `Failed to spawn Web Worker: ${err.message}`,
        durationMs: 0
      });
      return;
    }

    let hasResponded = false;

    const timer = setTimeout(() => {
      if (!hasResponded) {
        hasResponded = true;
        worker.terminate();
        resolve({
          success: false,
          stdout: '',
          stderr: `Execution timed out after ${timeoutMs}ms (infinite loop protection).`,
          durationMs: timeoutMs
        });
      }
    }, timeoutMs);

    worker.onmessage = (event) => {
      if (hasResponded) return;
      hasResponded = true;
      clearTimeout(timer);
      worker.terminate();

      const durationMs = Math.round(performance.now() - startTime);
      const { success, stdout, stderr } = event.data;
      resolve({
        success,
        stdout: stdout || (stderr ? '' : '(Code executed successfully with no output)'),
        stderr: stderr || '',
        durationMs
      });
    };

    worker.onerror = (err) => {
      if (hasResponded) return;
      hasResponded = true;
      clearTimeout(timer);
      worker.terminate();

      const durationMs = Math.round(performance.now() - startTime);
      resolve({
        success: false,
        stdout: '',
        stderr: err.message || 'Worker runtime error',
        durationMs
      });
    };

    worker.postMessage({ code });
  });
}
