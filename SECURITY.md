# Security policy

The current 1.x release line is supported. Never include real credentials or environment files in public issues, pull requests, logs or examples.

For a suspected vulnerability, use GitHub's private vulnerability reporting feature if enabled. If private reporting is unavailable, open an issue requesting a private reporting channel without publishing exploit details or secrets.

Reports deliberately omit raw values, parser exceptions, paths, and unknown key names. Declared contract variable names are public metadata. Library callers must avoid logging the input objects themselves. Contracts should be trusted project files; this is not a sandbox for untrusted schemas or a secret management service. All parsing and validation is local; no telemetry or network calls are performed.
