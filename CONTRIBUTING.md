# Contributing

Use Node.js 22 or newer. No dependency installation or build step is needed.
Run `npm run check`, `npm run test:coverage`, and `npm pack` before opening a PR.

Keep diagnostics free of environment values, raw parser errors, unknown variable names and filesystem paths. Include regression tests for behaviour changes. Document grammar changes explicitly: broad dotenv compatibility is not a goal.

Open an issue with the expected and actual behaviour and a minimal reproduction containing synthetic values only. Keep PRs focused, add tests for new validation rules, and update the changelog for user-facing changes.
