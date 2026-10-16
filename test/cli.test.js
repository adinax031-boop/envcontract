import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const bin = fileURLToPath(new URL('../bin/envcontract.js', import.meta.url));
function fixture(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'envcontract-'));
  const run = (args, env = {}) => spawnSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8', env });
  try { fn(cwd, run); } finally { rmSync(cwd, { recursive: true, force: true }); }
}
test('CLI check passes, fails, and emits parseable secret-safe JSON', () => fixture((cwd, run) => {
  writeFileSync(join(cwd, 'contract.json'), JSON.stringify({ version: 1, variables: { PORT: { type: 'integer' } } }));
  writeFileSync(join(cwd, 'sample.env'), 'PORT=3000');
  assert.equal(run(['check', '--env', 'sample.env']).status, 0);
  writeFileSync(join(cwd, 'sample.env'), 'PORT=TOP_SECRET');
  const result = run(['check', '--env', 'sample.env', '--json']);
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).valid, false);
  assert.equal((result.stdout + result.stderr).includes('TOP_SECRET'), false);
  assert.equal(run(['check', '--env', 'sample.env', '--process'], { PORT: '80' }).status, 0);
  assert.equal(run(['check'], { PORT: '80' }).status, 1);
}));
test('init is exclusive and generated schema works', () => fixture((cwd, run) => {
  assert.equal(run(['init']).status, 0);
  const before = readFileSync(join(cwd, 'contract.json'), 'utf8');
  assert.equal(run(['init']).status, 2);
  assert.equal(readFileSync(join(cwd, 'contract.json'), 'utf8'), before);
  assert.equal(run(['check', '--process'], { NODE_ENV: 'test' }).status, 0);
}));
test('invalid usage and files use exit 2 without paths or raw input', () => fixture((cwd, run) => {
  for (const args of [['check'], ['wat'], ['check', '--schema'], ['check', '--json', '--json'], ['init', '--env', 'x'], ['check', '--unknown']]) assert.equal(run(args).status, 2);
  writeFileSync(join(cwd, 'contract.json'), 'SECRET_BROKEN_JSON');
  const result = run(['check']);
  assert.equal(result.status, 2);
  assert.equal((result.stdout + result.stderr).includes('SECRET_BROKEN_JSON'), false);
  assert.equal(run(['--help']).status, 0);
  assert.equal(run(['--version']).stdout.trim(), '1.0.0');
}));
  
