const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const object = o => o !== null && typeof o === 'object' && !Array.isArray(o);
const fields = new Set(['type', 'required', 'default', 'enum', 'min', 'max', 'minLength', 'maxLength', 'protocols', 'description']);
const types = new Set(['string', 'integer', 'number', 'boolean', 'url']);
const namePattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

export class ContractError extends Error {
  constructor(message) { super(message); this.name = 'ContractError'; }
}

/** Validate schema before inspecting values. Schema errors never include supplied values. */
export function assertContract(schema) {
  if (!object(schema) || schema.version !== 1 || !object(schema.variables)) throw new ContractError('Expected version: 1 and a variables object');
  if (Object.keys(schema).some(k => !['version', 'variables', 'additionalProperties'].includes(k))) throw new ContractError('Unknown contract option');
  if (own(schema, 'additionalProperties') && typeof schema.additionalProperties !== 'boolean') throw new ContractError('additionalProperties must be boolean');
  for (const [key, rule] of Object.entries(schema.variables)) {
    if (!namePattern.test(key)) throw new ContractError('Invalid variable name');
    if (!object(rule) || !types.has(rule.type) || Object.keys(rule).some(k => !fields.has(k))) throw new ContractError(`Invalid rule for ${key}`);
    const fail = () => { throw new ContractError(`Invalid constraints for ${key}`); };
    if (own(rule, 'required') && typeof rule.required !== 'boolean') fail();
    if (own(rule, 'default') && typeof rule.default !== 'string') fail();
    if (own(rule, 'description') && typeof rule.description !== 'string') fail();
    if (own(rule, 'enum') && (!Array.isArray(rule.enum) || !rule.enum.length || rule.enum.some(x => typeof x !== 'string'))) fail();
    for (const k of ['min', 'max']) if (own(rule, k) && (!['number', 'integer'].includes(rule.type) || !Number.isFinite(rule[k]))) fail();
    for (const k of ['minLength', 'maxLength']) if (own(rule, k) && (!['string', 'url'].includes(rule.type) || !Number.isSafeInteger(rule[k]) || rule[k] < 0)) fail();
    if (rule.min > rule.max || rule.minLength > rule.maxLength) fail();
    if (own(rule, 'protocols') && (rule.type !== 'url' || !Array.isArray(rule.protocols) || !rule.protocols.length || rule.protocols.some(p => typeof p !== 'string' || !/^[a-z][a-z0-9+.-]*:$/.test(p)))) fail();
    if (own(rule, 'default') && checkValue(rule.default, rule).length) throw new ContractError(`Invalid default for ${key}`);
  }
  return schema;
}

function checkValue(value, rule) {
  const errors = [];
  const numeric = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
  if (rule.type === 'integer' && (!/^[+-]?\d+$/.test(value) || !Number.isSafeInteger(Number(value)))) errors.push('type');
  if (rule.type === 'number' && (!numeric.test(value) || !Number.isFinite(Number(value)))) errors.push('type');
  if (rule.type === 'boolean' && !['true', 'false'].includes(value)) errors.push('type');
  if (rule.type === 'url') {
    try { const url = new URL(value); if (value.trim() !== value || !(rule.protocols ?? ['https:', 'http:']).includes(url.protocol)) errors.push('type'); }
    catch { errors.push('type'); }
  }
  if (rule.enum && !rule.enum.includes(value)) errors.push('enum');
  if (!errors.includes('type')) {
    if (rule.min !== undefined && Number(value) < rule.min) errors.push('min');
    if (rule.max !== undefined && Number(value) > rule.max) errors.push('max');
  }
  if (rule.minLength !== undefined && [...value].length < rule.minLength) errors.push('minLength');
  if (rule.maxLength !== undefined && [...value].length > rule.maxLength) errors.push('maxLength');
  return errors;
}

/** Returns metadata only. Never returns raw input, defaults, enum values, or resolved secrets. */
export function validate(schema, values) {
  assertContract(schema);
  if (!object(values)) throw new ContractError('Expected an environment object');
  const issues = [];
  let checked = 0;
  const defaultsUsed = [];
  for (const [key, rule] of Object.entries(schema.variables)) {
    let value = own(values, key) ? values[key] : undefined;
    if (value === undefined && own(rule, 'default')) { value = rule.default; defaultsUsed.push(key); }
    if (value === undefined) { if (rule.required !== false) issues.push({ key, code: 'required' }); continue; }
    checked++;
    if (typeof value !== 'string') { issues.push({ key, code: 'type' }); continue; }
    for (const code of checkValue(value, rule)) issues.push({ key, code });
  }
  if (schema.additionalProperties === false) {
    // Unknown names may themselves contain sensitive data: report a count only.
    const count = Object.keys(values).filter(k => !own(schema.variables, k)).length;
    if (count) issues.push({ key: null, code: 'unknown', count });
  }
  return { valid: issues.length === 0, checked, defaultsUsed, issues };
}

/** Deliberately limited dotenv grammar; no interpolation, execution, or multiline values. */
export function parseEnv(text) {
  if (typeof text !== 'string') throw new ContractError('Expected dotenv text');
  const result = Object.create(null);
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;
    const fail = () => { throw new ContractError(`Invalid dotenv syntax on line ${i + 1}`); };
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) fail();
    const [, key, raw] = match;
    if (own(result, key)) throw new ContractError(`Duplicate dotenv assignment on line ${i + 1}`);
    let value;
    if (raw.startsWith('"') || raw.startsWith("'")) {
      const quote = raw[0];
      const end = raw.indexOf(quote, 1);
      if (end < 0 || !/^(?:\s*#.*|\s*)$/.test(raw.slice(end + 1))) fail();
      value = raw.slice(1, end);
    } else value = raw.replace(/\s+#.*$/, '').trimEnd();
    result[key] = value;
  }
  return result;
}
