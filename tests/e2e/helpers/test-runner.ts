// Universal Test Harness for E2E tests
// Works with Vitest when executed via Vitest, or as standalone runner with Node 24

export interface TestContext {
  name: string;
}

export type TestFn = () => void | Promise<void>;
export type HookFn = () => void | Promise<void>;

interface TestCase {
  name: string;
  fn: TestFn;
}

interface TestSuite {
  name: string;
  beforeAllHooks: HookFn[];
  afterAllHooks: HookFn[];
  beforeEachHooks: HookFn[];
  afterEachHooks: HookFn[];
  tests: TestCase[];
}

// Global registry for standalone mode
const suites: TestSuite[] = [];
let currentSuite: TestSuite | null = null;

// Determine if we are running in an environment with global test runner (e.g., Vitest)
const hasGlobalRunner = typeof (globalThis as any).describe === 'function';

export function describe(name: string, fn: () => void): void {
  if (hasGlobalRunner) {
    (globalThis as any).describe(name, fn);
    return;
  }

  const suite: TestSuite = {
    name,
    beforeAllHooks: [],
    afterAllHooks: [],
    beforeEachHooks: [],
    afterEachHooks: [],
    tests: [],
  };
  const prevSuite = currentSuite;
  currentSuite = suite;
  suites.push(suite);
  try {
    fn();
  } finally {
    currentSuite = prevSuite;
  }
}

export function it(name: string, fn: TestFn): void {
  if (hasGlobalRunner) {
    (globalThis as any).it(name, fn);
    return;
  }

  if (!currentSuite) {
    describe('Default Suite', () => {
      it(name, fn);
    });
    return;
  }
  currentSuite.tests.push({ name, fn });
}

export const test = it;

export function beforeAll(fn: HookFn): void {
  if (hasGlobalRunner) {
    (globalThis as any).beforeAll(fn);
    return;
  }
  if (currentSuite) currentSuite.beforeAllHooks.push(fn);
}

export function afterAll(fn: HookFn): void {
  if (hasGlobalRunner) {
    (globalThis as any).afterAll(fn);
    return;
  }
  if (currentSuite) currentSuite.afterAllHooks.push(fn);
}

export function beforeEach(fn: HookFn): void {
  if (hasGlobalRunner) {
    (globalThis as any).beforeEach(fn);
    return;
  }
  if (currentSuite) currentSuite.beforeEachHooks.push(fn);
}

export function afterEach(fn: HookFn): void {
  if (hasGlobalRunner) {
    (globalThis as any).afterEach(fn);
    return;
  }
  if (currentSuite) currentSuite.afterEachHooks.push(fn);
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (!keysB.includes(k) || !deepEqual(a[k], b[k])) return false;
  }
  return true;
}

export interface Matchers<T = any> {
  toBe(expected: any): void;
  toEqual(expected: any): void;
  toBeDefined(): void;
  toBeUndefined(): void;
  toBeNull(): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toContain(item: any): void;
  toHaveLength(length: number): void;
  toBeGreaterThan(val: number): void;
  toBeGreaterThanOrEqual(val: number): void;
  toBeLessThan(val: number): void;
  toBeLessThanOrEqual(val: number): void;
  toMatch(pattern: RegExp | string): void;
  toThrow(expected?: string | RegExp): void;
  not: Matchers<T>;
}

export function expect(actual: any): Matchers {
  if (hasGlobalRunner && typeof (globalThis as any).expect === 'function') {
    return (globalThis as any).expect(actual);
  }

  function createMatchers(isNot = false): Matchers {
    const check = (condition: boolean, failMessage: string) => {
      const passed = isNot ? !condition : condition;
      if (!passed) {
        throw new Error(isNot ? `Expected NOT to: ${failMessage}` : failMessage);
      }
    };

    return {
      toBe(expected: any) {
        check(
          Object.is(actual, expected),
          `Expected ${JSON.stringify(actual)} to be ${JSON.stringify(expected)}`
        );
      },
      toEqual(expected: any) {
        check(
          deepEqual(actual, expected),
          `Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`
        );
      },
      toBeDefined() {
        check(actual !== undefined, `Expected actual to be defined, got undefined`);
      },
      toBeUndefined() {
        check(actual === undefined, `Expected actual to be undefined, got ${JSON.stringify(actual)}`);
      },
      toBeNull() {
        check(actual === null, `Expected actual to be null, got ${JSON.stringify(actual)}`);
      },
      toBeTruthy() {
        check(Boolean(actual), `Expected ${JSON.stringify(actual)} to be truthy`);
      },
      toBeFalsy() {
        check(!actual, `Expected ${JSON.stringify(actual)} to be falsy`);
      },
      toContain(item: any) {
        if (typeof actual === 'string') {
          check(actual.includes(String(item)), `Expected string "${actual}" to contain "${item}"`);
        } else if (Array.isArray(actual)) {
          check(
            actual.some(el => deepEqual(el, item) || el === item),
            `Expected array ${JSON.stringify(actual)} to contain ${JSON.stringify(item)}`
          );
        } else {
          throw new Error(`toContain called on non-string, non-array: ${actual}`);
        }
      },
      toHaveLength(len: number) {
        const length = actual?.length;
        check(length === len, `Expected length ${length} to be ${len}`);
      },
      toBeGreaterThan(val: number) {
        check(actual > val, `Expected ${actual} to be greater than ${val}`);
      },
      toBeGreaterThanOrEqual(val: number) {
        check(actual >= val, `Expected ${actual} to be >= ${val}`);
      },
      toBeLessThan(val: number) {
        check(actual < val, `Expected ${actual} to be < ${val}`);
      },
      toBeLessThanOrEqual(val: number) {
        check(actual <= val, `Expected ${actual} to be <= ${val}`);
      },
      toMatch(pattern: RegExp | string) {
        const reg = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
        check(reg.test(String(actual)), `Expected "${actual}" to match ${reg}`);
      },
      toThrow(expected?: string | RegExp) {
        if (typeof actual !== 'function') {
          throw new Error('toThrow requires a function');
        }
        let thrownError: any = null;
        try {
          actual();
        } catch (err) {
          thrownError = err;
        }
        check(thrownError !== null, `Expected function to throw, but it did not`);
        if (expected && thrownError) {
          const msg = thrownError.message || String(thrownError);
          if (expected instanceof RegExp) {
            check(expected.test(msg), `Expected error message "${msg}" to match ${expected}`);
          } else {
            check(msg.includes(expected), `Expected error message "${msg}" to include "${expected}"`);
          }
        }
      },
      get not() {
        return createMatchers(!isNot);
      },
    };
  }

  return createMatchers(false);
}

export async function runAllSuites(): Promise<{ passed: number; failed: number; total: number; errors: Array<{ suite: string; test: string; error: any }> }> {
  let passed = 0;
  let failed = 0;
  const errors: Array<{ suite: string; test: string; error: any }> = [];

  for (const suite of suites) {
    console.log(`\n\x1b[36m▶ Suite: ${suite.name}\x1b[0m`);

    for (const hook of suite.beforeAllHooks) {
      try {
        await hook();
      } catch (err) {
        console.error(`\x1b[31m  ✖ beforeAll failed in ${suite.name}: ${err}\x1b[0m`);
        throw err;
      }
    }

    for (const testCase of suite.tests) {
      for (const hook of suite.beforeEachHooks) {
        await hook();
      }

      const start = Date.now();
      try {
        await testCase.fn();
        const duration = Date.now() - start;
        passed++;
        console.log(`  \x1b[32m✔\x1b[0m ${testCase.name} \x1b[90m(${duration}ms)\x1b[0m`);
      } catch (err: any) {
        const duration = Date.now() - start;
        failed++;
        errors.push({ suite: suite.name, test: testCase.name, error: err });
        console.error(`  \x1b[31m✖\x1b[0m ${testCase.name} \x1b[90m(${duration}ms)\x1b[0m`);
        console.error(`    \x1b[31mError: ${err?.message || err}\x1b[0m`);
        if (err?.stack) {
          const stackLine = err.stack.split('\n')[1] || '';
          console.error(`    \x1b[90m${stackLine.trim()}\x1b[0m`);
        }
      }

      for (const hook of suite.afterEachHooks) {
        await hook();
      }
    }

    for (const hook of suite.afterAllHooks) {
      try {
        await hook();
      } catch (err) {
        console.error(`\x1b[31m  ✖ afterAll failed in ${suite.name}: ${err}\x1b[0m`);
      }
    }
  }

  return { passed, failed, total: passed + failed, errors };
}

export function clearSuites(): void {
  suites.length = 0;
}
