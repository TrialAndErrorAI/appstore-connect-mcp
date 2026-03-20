/**
 * Sandboxed Code Executor for Code Mode
 *
 * Runs LLM-generated JavaScript in an isolated Node.js vm context.
 * Only injected globals (spec, api) are available — no network, no filesystem, no env vars.
 */

import { createContext, runInNewContext } from 'vm';

export interface ExecuteResult {
  result: any;
  logs: string[];
  error?: string;
}

const MAX_OUTPUT_CHARS = 40_000;
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Execute code in a sandboxed vm context.
 *
 * @param code - JavaScript code string (can be async)
 * @param globals - Objects available inside the sandbox (e.g., { spec }, { api })
 * @param timeout - Maximum execution time in ms
 */
export async function executeInSandbox(
  code: string,
  globals: Record<string, any>,
  timeout: number = DEFAULT_TIMEOUT_MS
): Promise<ExecuteResult> {
  const logs: string[] = [];

  // Build sandbox context — only injected globals + safe console
  const contextGlobals: Record<string, any> = {
    ...globals,
    console: {
      log: (...args: any[]) => logs.push(args.map(formatValue).join(' ')),
      error: (...args: any[]) => logs.push('[ERROR] ' + args.map(formatValue).join(' ')),
      warn: (...args: any[]) => logs.push('[WARN] ' + args.map(formatValue).join(' ')),
    },
    JSON,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Date,
    Math,
    RegExp,
    Map,
    Set,
    Promise,
    Error,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    // Explicitly block dangerous globals
    fetch: undefined,
    require: undefined,
    process: undefined,
    globalThis: undefined,
    eval: undefined,
    Function: undefined,
    setTimeout: undefined,
    setInterval: undefined,
    setImmediate: undefined,
    Buffer: undefined,
    __dirname: undefined,
    __filename: undefined,
    import: undefined,
  };

  const context = createContext(contextGlobals);

  // Wrap code as async IIFE so `await` works
  const wrappedCode = `(async () => {\n${code}\n})()`;

  try {
    const result = await runInNewContext(wrappedCode, context, {
      timeout,
      displayErrors: true,
    });

    return {
      result: truncate(formatValue(result)),
      logs: logs.map(l => truncate(l)),
    };
  } catch (error: any) {
    return {
      result: null,
      logs: logs.map(l => truncate(l)),
      error: error.message || String(error),
    };
  }
}

/**
 * Format a value for output (handles objects, arrays, etc.)
 */
function formatValue(value: any): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * Truncate output to prevent context bloat
 */
function truncate(str: string): string {
  if (str.length <= MAX_OUTPUT_CHARS) return str;
  return str.slice(0, MAX_OUTPUT_CHARS) + `\n\n[TRUNCATED — ${str.length} chars total, showing first ${MAX_OUTPUT_CHARS}]`;
}
