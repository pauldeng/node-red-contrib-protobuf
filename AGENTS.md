# Repository Guide for Agents and Engineers

This is the canonical, AI-neutral working guide for this repository. Keep it short, factual, and updated when commands, source layout, or test behavior changes.

## Project Snapshot

- Package: `node-red-contrib-protobuf`
- Runtime: CommonJS Node.js package for Node-RED.
- Main entrypoint: `src/index.js`.
- Node support: `>=20.19.0` from `package.json`.
- Node-RED support: `>=4.1.0` from `package.json`.
- Runtime dependency: `protobufjs`.

## Start Here

- Architecture: `docs/architecture.md`
- Node behavior and options: `docs/node-guide.md`
- Test commands and coverage map: `docs/testing.md`
- Change workflow: `docs/change-workflow.md`
- File reference map: `docs/reference-map.md`
- Troubleshooting: `docs/troubleshooting.md`

## Commands

Run from the repository root.

```bash
npm install
npm test
npm run lint
npm run coverage
npm run test:ui
npm run test:docker
```

Focused checks:

```bash
npm test -- --grep "encode input options"
npm test -- --grep "decode output options"
npm run test:ui -- -g "Node-RED editor dialogs"
```

`npm run test:docker` requires Docker or passwordless `sudo docker`. It runs `scripts/ensure-docker-ubuntu.sh` first, which checks Docker and on Ubuntu 22.04 / 24.04 / 26.04 will install Docker CE via apt when it is missing; on other systems the suite exits before Mocha starts and you need to install Docker yourself. The suite then runs a packaged integration test in a Node Docker image with no published ports.

## Verification Expectations

- For runtime changes, add or update a focused Mocha test first, then run the focused test and `npm test`.
- For editor UI changes, run `npm run test:ui` and inspect the rendered dialog or a screenshot.
- For package, example, or real Node-RED integration changes, run `npm run test:docker`.
- For all code changes, run `npm run lint` and `git diff --check`.
- Run `npm run coverage` before claiming coverage is healthy.
- Report any skipped or failing verification explicitly.

## Code Style

- Use CommonJS (`require`, `module.exports`); `package.json` sets `"type": "commonjs"`.
- Keep edits small and consistent with nearby code.
- Prefer standard Node.js APIs and protobuf.js helpers over ad hoc parsing.
- Preserve Node-RED callback behavior: call `done(error)` when available, otherwise use node `error` or `warn` methods as existing code does.
- Prefer `async`/`await` in new tests and scripts when asynchronous code is needed.
- Use ASCII text unless a file already requires non-ASCII.
- Add comments only where they explain non-obvious behavior.

## Protobuf Gotchas

- `msg.protobufType` overrides the configured Type field on encode and decode nodes.
- Proto3 scalar defaults (`false`, `0`, `""`) are not transmitted unless the schema tracks presence with `optional`, proto2, or Editions presence.
- Decode `longsType: "BigInt"` is exact but not JSON-serializable. Prefer `String` when data flows to Debug, JSON, MQTT, HTTP, or other JSON serialization paths.
- Encode `inputConversion: "fromObject"` uses protobuf.js conversion semantics for enum names, bytes strings, and 64-bit integer strings.
- Base64url support is implemented by this package as normalization around protobuf.js base64 byte handling.
- Inline proto definitions are self-contained; imports are resolved only in file-path mode.

## Generated and Local Files

Do not commit generated or local artifacts unless explicitly requested:

- `node_modules/`
- `coverage/`
- `.nyc_output/`
- `test-results/`
- `playwright-report/`
- `blob-report/`
- `.codegraph/`
- local planning files such as `GOAL.md` or `PLAN*.md`

## Git and Review Etiquette

- Do not commit unless the user asks for a commit.
- Stage only files that belong to the requested change.
- Keep unrelated dirty or untracked files untouched.
- Write commit messages with a short subject and a body explaining runtime behavior, UI/docs impact, and tests when relevant.
- For reviews, lead with bugs, risks, and missing tests before summaries.

## Code Search

- If `.codegraph/` is available and current, use CodeGraph tools for structural questions such as definitions, callers, callees, and impact.
- Use `rg` for literal text searches.
- Prefer the smallest relevant file or symbol over broad context loads.
