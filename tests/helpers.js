// ============================================================
// tests/helpers.js — Shared test assertion helpers
// ============================================================

export function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

export function assertEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${message}\n  Expected: ${e}\n  Actual:   ${a}`);
  }
}

export function assertNull(val, message) {
  if (val !== null && val !== undefined) {
    throw new Error(`${message} — expected null/undefined, got: ${JSON.stringify(val)}`);
  }
}

export function assertNotNull(val, message) {
  if (val === null || val === undefined) {
    throw new Error(`${message} — expected a value, got: ${val}`);
  }
}

/** Run a suite of { name, fn } test cases and print results */
export async function runSuite(suiteName, cases) {
  let pass = 0;
  let fail = 0;

  for (const { name, fn } of cases) {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
      pass++;
    } catch (err) {
      console.error(`  ❌ ${name}: ${err.message}`);
      fail++;
    }
  }

  console.log(`\n  ${suiteName}: ${pass} passed, ${fail} failed`);
  return { pass, fail };
}
