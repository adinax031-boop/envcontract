<div align="center">

# ◈ EnvContract
### Configuration is an interface. Give it a contract.

Validate environment settings before deployment — without printing secrets.

[![CI](https://github.com/adinax031-boop/envcontract/actions/workflows/ci.yml/badge.svg)](https://github.com/adinax031-boop/envcontract/actions/workflows/ci.yml)
![Node ≥22](https://img.shields.io/badge/node-%E2%89%A522-43853d)
![Dependencies: zero](https://img.shields.io/badge/runtime_dependencies-0-7c3aed)
![License: MIT](https://img.shields.io/badge/license-MIT-blue)

</div>

```text
$ envcontract check --schema contract.json --env staging.env
FAIL · 4 variables checked · 2 issues
  PORT: max
  API_TOKEN: minLength
```

A service can have valid code and still fail because a port is invalid, a URL uses the wrong protocol, or a required token is missing. EnvContract turns those assumptions into a versioned JSON contract that runs locally and in CI.

- **CLI + library:** use the same rules in deployment checks and application startup.
- **Secret-safe diagnostics:** reports contain variable names and error codes, never supplied values, defaults, or enum choices. Unknown keys are counted, not printed.
- **Strict by default:** malformed schemas, duplicate dotenv assignments and misspelled options fail early.
- **Predictable inputs:** file-only by default; explicitly opt into process environment overlays.
- **No runtime dependencies, no build step, no network requests.** Includes TypeScript declarations.

## Try it

Node.js 22 or newer. npm registry publication is not required:

```sh
git clone https://github.com/adinax031-boop/envcontract.git
cd envcontract
npm test
node bin/envcontract.js check --schema examples/contract.json --env examples/demo.env
npm link
envcontract --help
```

Or install directly from the repository:

```sh
npm install github:adinax031-boop/envcontract
npx envcontract --help
```

## Write a contract

```json
{
  "version": 1,
  "variables": {
    "PORT": { "type": "integer", "default": "3000", "min": 1, "max": 65535 },
    "NODE_ENV": { "type": "string", "enum": ["development", "test", "production"] },
    "API_URL": { "type": "url", "protocols": ["https:"] },
    "API_TOKEN": { "type": "string", "minLength": 16 },
    "DEBUG": { "type": "boolean", "required": false }
  }
}
```

`envcontract init` creates a starter contract and refuses to overwrite existing files.

| Rule | Meaning |
| --- | --- |
| `type` | Required: `string`, `integer`, `number`, `boolean`, `url` |
| `required` | Defaults to true; missing optional values are skipped |
| `default` | String fallback for absent values, validated with the same constraints |
| `enum` | Nonempty list of permitted literal strings |
| `min`, `max` | Inclusive numeric bounds |
| `minLength`, `maxLength` | Unicode code-point length for strings and URLs |
| `protocols` | URL protocol allowlist, including `:`; defaults to HTTP and HTTPS |
| `description` | Documentation only; not included in diagnostics |

At the contract root, `additionalProperties: false` rejects undeclared keys. Leave it unset when checking `process.env`, which normally contains unrelated operating-system settings. All numbers, booleans and defaults are expressed as strings in environment input. Booleans accept exactly `true` and `false`; integers must be safe integers in decimal notation. Numeric values must be finite. An empty string is present; use `minLength: 1` to forbid it. Defaults apply only when a key is absent or undefined and do not mutate the input.

## CLI and automation

```sh
# Validate a specific file. No ambient process values are read.
envcontract check --schema contract.json --env staging.env
# File first, then process environment overrides.
envcontract check --schema contract.json --env staging.env --process
# Validate only the running environment.
envcontract check --schema contract.json --process --json
```

Exit status is **0** for valid configuration, **1** for validation failures and **2** for usage, file or schema errors. JSON mode emits a report on stdout for completed checks; input errors emit a generic message on stderr and exit 2. Invalid input is never echoed, including paths and JSON parser excerpts.

```json
{"valid":false,"checked":1,"defaultsUsed":[],"issues":[{"key":"PORT","code":"type"}]}
```

Run after setting your CI environment, or before your application's start command:

```json
{ "scripts": { "prestart": "envcontract check --schema contract.json --process" } }
```

## Library

```js
import { validate, parseEnv } from '@adinax031-boop/envcontract';
import { readFileSync } from 'node:fs';

const contract = JSON.parse(readFileSync('contract.json', 'utf8'));
const report = validate(contract, parseEnv(readFileSync('.env', 'utf8')));
if (!report.valid) {
  console.error(report);
  process.exit(1);
}
```

`assertContract(schema)` throws `ContractError` for malformed contracts. `validate` also validates the contract before checking values, and never mutates its arguments. `parseEnv` returns an object with no prototype to handle special keys safely. Validation returns metadata only; this package does not load configuration into `process.env` or return coerced values.

## Dotenv grammar and boundaries

Supports `KEY=value`, optional `export`, blank lines, comments, UTF-8 BOM, CRLF, and single or double quoted values. Quotes are literal delimiters; backslash escape processing, multiline values, interpolation and shell execution are deliberately unsupported. Outside quotes, a `#` preceded by whitespace starts a comment; `abc#def` is literal. Duplicate keys fail rather than silently overriding earlier assignments.

Variable names must match `[A-Za-z_][A-Za-z0-9_]*`. Names in the contract are considered public configuration metadata and are printed in validation reports. Do not put credentials in names. Treat contracts as trusted project code. The tool checks structure and constraints, not whether a token is authentic or an endpoint is reachable. URL validation follows the platform URL parser and the configured protocol allowlist; it is not a complete network policy or SSRF defence. No secret scanner, vault, or dotenv implementation compatibility is claimed.

## Development and quality

```sh
npm run check
npm run test:coverage
npm pack
```

Tests cover numeric edge cases, constraints, defaults, schema errors, secret-safe output, dotenv parsing, prototype keys, process overlays, CLI exit codes and non-overwriting initialization. CI is configured for Node 22/24 on Linux, Windows and macOS, and also checks packaging. Local results do not substitute for those platform runs.

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) and [CHANGELOG.md](CHANGELOG.md). MIT licensed.
