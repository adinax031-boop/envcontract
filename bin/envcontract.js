#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { parseEnv, validate } from '../src/index.js';

const help = `EnvContract 1.0.0 — configuration checks without leaking values

Usage:
  envcontract check [--schema contract.json] [--env .env] [--process] [--json]
  envcontract init [--schema contract.json]

File-only checks are the default. --process overlays process.env on the file.
Exit codes: 0 valid, 1 validation failed, 2 input/schema/usage error.
`;
function main(args) {
  if (!args.length || ['--help', '-h'].includes(args[0])) { console.log(help); return 0; }
  if (args.length === 1 && args[0] === '--version') { console.log('1.0.0'); return 0; }
  const [command, ...rest] = args;
  if (!['check', 'init'].includes(command)) throw new Error();
  const opts = { schema: 'contract.json' };
  const seen = new Set();
  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i];
    if (seen.has(flag)) throw new Error();
    seen.add(flag);
    if (['--schema', '--env'].includes(flag)) {
      if (!rest[i + 1] || rest[i + 1].startsWith('--') || (command === 'init' && flag === '--env')) throw new Error();
      opts[flag.slice(2)] = rest[++i];
    } else if (command === 'check' && ['--json', '--process'].includes(flag)) opts[flag.slice(2)] = true;
    else throw new Error();
  }
  if (command === 'init') {
    const schema = { version: 1, variables: { PORT: { type: 'integer', default: '3000', min: 1, max: 65535 }, NODE_ENV: { type: 'string', enum: ['development', 'test', 'production'] } } };
    try { writeFileSync(opts.schema, JSON.stringify(schema, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); }
    catch { throw new Error(); }
    console.log('Created contract. Existing files are never overwritten.'); return 0;
  }
  let schema, values;
  try { schema = JSON.parse(readFileSync(opts.schema, 'utf8')); values = opts.env ? parseEnv(readFileSync(opts.env, 'utf8')) : {}; }
  catch { throw new Error(); }
  if (opts.process) values = { ...values, ...process.env };
  const report = validate(schema, values);
  if (opts.json) console.log(JSON.stringify(report));
  else {
    console.log(`${report.valid ? 'PASS' : 'FAIL'} · ${report.checked} variables checked · ${report.issues.length} issues`);
    for (const issue of report.issues) console.log(issue.code === 'unknown' ? `  unknown: ${issue.count} undeclared variables` : `  ${issue.key}: ${issue.code}`);
  }
  return report.valid ? 0 : 1;
}
try { process.exitCode = main(process.argv.slice(2)); }
catch { console.error('EnvContract: invalid input, schema, or arguments. Check --help. Values and paths are withheld.'); process.exitCode = 2; }
