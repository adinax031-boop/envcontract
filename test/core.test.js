import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, parseEnv, assertContract } from '../src/index.js';
const schema = rule => ({ version: 1, variables: { VALUE: rule } });
const check = (rule, value) => validate(schema(rule), { VALUE: value });
for (const [type, good, bad] of [
  ['integer', ['0', '-12', '+9'], ['1.2', '1e2', 'Infinity', '9007199254740992', '']],
  ['number', ['1.2', '-.5', '1e2'], ['NaN', 'Infinity', '0x10', '', ' 2']],
  ['boolean', ['true', 'false'], ['1', 'TRUE', '']],
  ['url', ['https://example.com', 'http://localhost:3000'], ['ftp://example.com', 'nonsense', ' https://example.com']]
]) {
  for (const value of good) test(`${type} accepts ${JSON.stringify(value)}`, () => assert.equal(check({ type }, value).valid, true));
  for (const value of bad) test(`${type} rejects ${JSON.stringify(value)}`, () => assert.equal(check({ type }, value).valid, false));
}
test('required, optional, defaults, and explicit empty values', () => {
  assert.equal(validate(schema({ type: 'string' }), {}).valid, false);
  assert.equal(validate(schema({ type: 'string', required: false }), {}).valid, true);
  assert.deepEqual(validate(schema({ type: 'integer', default: '5' }), {}).defaultsUsed, ['VALUE']);
  assert.equal(check({ type: 'integer', default: '5' }, '').valid, false);
});
test('bounds, enum, unicode length and protocols', () => {
  assert.equal(check({ type: 'number', min: 2, max: 3 }, '2').valid, true);
  assert.equal(check({ type: 'number', min: 2, max: 3 }, '4').issues[0].code, 'max');
  assert.equal(check({ type: 'number', min: 2 }, '1').issues[0].code, 'min');
  assert.equal(check({ type: 'string', enum: ['a'] }, 'b').issues[0].code, 'enum');
  assert.equal(check({ type: 'string', minLength: 2 }, '😀').issues[0].code, 'minLength');
  assert.equal(check({ type: 'string', maxLength: 1 }, 'aa').issues[0].code, 'maxLength');
  assert.equal(check({ type: 'url', protocols: ['postgres:'] }, 'postgres://host/db').valid, true);
});
test('schema rejects mistakes before values', () => {
  for (const rule of [{}, { type: 'wat' }, { type: 'number', min: 3, max: 2 }, { type: 'string', typo: 1 }, { type: 'boolean', default: 'yes' }, { type: 'string', required: 1 }, { type: 'string', enum: [] }, { type: 'url', protocols: ['https'] }, { type: 'number', minLength: 1 }, { type: 'string', default: 2 }, { type: 'number', min: Infinity }]) assert.throws(() => assertContract(schema(rule)));
  for (const s of [null, [], { version: 2, variables: {} }, { version: 1, variables: {}, typo: 1 }, { version: 1, variables: {}, additionalProperties: 1 }]) assert.throws(() => assertContract(s));
});
test('secret-safe reports and unknown keys', () => {
  const s = { ...schema({ type: 'integer' }), additionalProperties: false };
  const report = validate(s, { VALUE: 'SENSITIVE_TOKEN', SENSITIVE_NAME: 'secret' });
  assert.equal(report.valid, false);
  assert.equal(JSON.stringify(report).includes('SENSITIVE'), false);
  assert.equal(report.issues[1].count, 1);
});
test('inherited values cannot satisfy required variables', () => assert.equal(validate(schema({ type: 'string' }), Object.create({ VALUE: 'x' })).valid, false));
test('input remains unchanged and nonstring values fail', () => {
  const input = { VALUE: 5 }; const before = structuredClone(input);
  assert.equal(validate(schema({ type: 'integer' }), input).valid, false);
  assert.deepEqual(input, before);
  assert.throws(() => validate(schema({ type: 'string' }), null));
});
test('dotenv comments, export, literals, BOM and CRLF', () => {
  const env = parseEnv('\uFEFF# hi\r\nexport A=hello # comment\r\nB="x # y" # comment\nC=abc#def\nD=\'literal $HOME\'\nEMPTY=');
  assert.deepEqual({ ...env }, { A: 'hello', B: 'x # y', C: 'abc#def', D: 'literal $HOME', EMPTY: '' });
});
test('dotenv rejects duplicates, malformed and multiline content without leaking', () => {
  for (const input of ['A=one\nA=two', 'SECRET_DO_NOT_PRINT', 'A="unclosed', 'A="ok" garbage', 'A="line\nline"']) assert.throws(() => parseEnv(input), e => !e.message.includes('SECRET_DO_NOT_PRINT'));
  assert.throws(() => parseEnv(null));
});
test('special object keys are ordinary data, never prototype mutation', () => {
  const env = parseEnv('__proto__=safe\nconstructor=ok');
  assert.equal(Object.getPrototypeOf(env), null);
  assert.equal(env.__proto__, 'safe');
});
  
