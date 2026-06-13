# Change Workflow

Use this workflow for code, test, example, and documentation changes.

## Before Editing

1. Read `AGENTS.md`.
2. Read the focused reference doc under `docs/`.
3. Inspect the smallest source or test files needed.
4. For structural questions, use CodeGraph when available.
5. Use `rg` for literal text searches.

## Test-First Rule

For behavior changes, add or update a failing focused test before changing runtime code. Keep the test close to the behavior:

- encode runtime behavior: `test/encode*.spec.js`
- decode runtime behavior: `test/decode*.spec.js`
- encode/decode interoperability: `test/options-roundtrip.spec.js` or `test/integrated.spec.js`
- protofile behavior: `test/protofile*.spec.js`
- editor UI and help: `test/ui/node-red-protobuf.spec.js`
- package and real Node-RED integration: `test/docker/protofile-real-server.test.js`

For docs-only changes, no behavior test is required. Still run a lightweight sanity check such as `git diff --check`.

## Implementation

- Keep the change narrow.
- Match nearby CommonJS and Node-RED patterns.
- Prefer protobuf.js APIs over manual protobuf handling.
- Avoid unrelated refactors.
- Do not rewrite generated fixtures unless the change intentionally updates them.

## Verification

Use the smallest command that proves the change first, then broaden.

```bash
npm test -- --grep "<focused behavior>"
npm test
npm run lint
npm run coverage
```

Add these when relevant:

```bash
npm run test:ui
npm run test:docker
```

For UI changes, inspect the rendered Node-RED dialog. Automated assertions alone are not enough for layout changes.

## Commit Discipline

- Commit only when explicitly asked.
- Check `git status --short` before staging.
- Stage only files in scope.
- Leave unrelated dirty or untracked files untouched.
- Use a short subject and a body with the behavior, docs/UI impact, and verification.

Example:

```text
feat: add decode bytes base64url output

Expose String (base64url) in the decode Bytes dropdown and normalize protobuf.js base64 byte output to unpadded URL-safe base64.

Update node help, README feature text, runtime coverage, and UI assertions.
```
