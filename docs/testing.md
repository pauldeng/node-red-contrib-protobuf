# Testing

This repository uses Mocha for runtime tests, nyc for coverage, Playwright for Node-RED editor tests, and a Docker-only integration test for packaged behavior.

## Standard Commands

```bash
npm test
npm run lint
npm run coverage
npm run test:ui
npm run test:docker
```

## What Each Command Covers

- `npm test`: all `test/**/*spec.js` files except `test/ui/**/*.spec.js`.
- `npm run lint`: ESLint over the repository, using `eslint.config.js`.
- `npm run coverage`: nyc over `npm test`.
- `npm run test:ui`: Playwright tests for Node-RED editor dialogs and help.
- `npm run test:docker`: packaged integration tests inside Docker.

## Docker Integration

`npm run test:docker` runs `scripts/run-docker-tests.js`.

The runner:

- calls `scripts/ensure-docker-ubuntu.sh` first to verify Docker works (and on Ubuntu 22.04 / 24.04 / 26.04, install Docker CE via apt when it is missing),
- uses `docker` if available,
- falls back to passwordless `sudo -n docker` if needed,
- uses `node:${process.versions.node}-alpine` by default,
- accepts `NODE_DOCKER_IMAGE` to override the image,
- mounts the repository read-only at `/workspace`,
- runs with `--network none`,
- sets `PROTOBUF_DOCKER_TEST=1`.

The Docker suite verifies:

- `npm pack` includes files needed by Node-RED and examples,
- the package entrypoint registers `protobuf-file`, `encode`, and `decode`,
- an encode/decode flow works through `node-red-node-test-helper` using a packaged example proto path,
- the `/protobuf-file/types` endpoint responds over real HTTP inside the container.

## Coverage Notes

Coverage should be run before claiming a full change is verified. If coverage fails under nyc while the same test passes under plain Mocha, inspect for test-helper or server lifecycle differences before changing production code.

## UI Testing

Use Playwright for editor UI assertions:

```bash
npm run test:ui -- -g "Node-RED editor dialogs"
```

For visual layout changes, inspect the rendered dialog or a screenshot. Check that labels fit, controls persist values, and help text matches the runtime behavior.

## Test Placement

- Add runtime tests near the node being changed.
- Add round-trip tests in `test/options-roundtrip.spec.js` when an option is meaningful only across encode and decode.
- Add UI tests when editor defaults, controls, labels, help, examples menu, or persistence changes.
- Add Docker tests for published package layout, example paths, entrypoint registration, or behavior that depends on a real Node-RED HTTP admin server.

## Common Test Patterns

- Most runtime node tests use `node-red-node-test-helper`.
- Endpoint edge tests can call captured handlers directly when HTTP server behavior is not under test.
- Docker tests can use `node-red-node-test-helper` for flows and embedded Node-RED for real HTTP checks.
- Prefer `async`/`await` and `events.once` for new asynchronous tests.
