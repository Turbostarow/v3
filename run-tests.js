// ============================================================
// tests/run-tests.js — Minimal test runner (no extra deps)
// ============================================================

import { runParserTests }   from './parser.test.js';
import { runRendererTests } from './renderer.test.js';
import { runStorageTests }  from './storage.test.js';
import { runSortingTests }  from './sorting.test.js';

const suites = [
  { name: 'Parser',   fn: runParserTests },
  { name: 'Renderer', fn: runRendererTests },
  { name: 'Storage',  fn: runStorageTests },
  { name: 'Sorting',  fn: runSortingTests },
];

let totalPass = 0;
let totalFail = 0;

for (const suite of suites) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Test Suite: ${suite.name}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  const { pass, fail } = await suite.fn();
  totalPass += pass;
  totalFail += fail;
}

console.log(`\n${'═'.repeat(38)}`);
console.log(`  Results: ${totalPass} passed, ${totalFail} failed`);
console.log(`${'═'.repeat(38)}\n`);

if (totalFail > 0) process.exit(1);
