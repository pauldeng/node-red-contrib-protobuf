# Reference Map

Use this map to find the smallest relevant file for a change.

## Package Entry Points

- `package.json`: package metadata, published file list, scripts, Node-RED node map.
- `src/index.js`: registers all Node-RED node constructors.
- `README.md`: public package usage, features, examples, and contribution notes.
- `LICENSE`: BSD 3-Clause license.

## Runtime Source

- `src/nodes/protofile.js`: schema loading, inline parsing, file watching, type-list endpoint.
- `src/nodes/encode.js`: encode runtime behavior.
- `src/nodes/decode.js`: decode runtime behavior.

## Editor Source

- `src/nodes/protofile.html`: protobuf-file editor UI and help.
- `src/nodes/encode.html`: encode editor UI, defaults, and help.
- `src/nodes/decode.html`: decode editor UI, defaults, and help.

## Examples

- `examples/*.json`: Node-RED importable example flows.
- `examples/protos/*.proto`: schemas used by shipped examples.

When changing examples, update README text and `test/examples.spec.js` together.

## Tests

- `test/index.spec.js`: package entrypoint registration.
- `test/encode.spec.js`: baseline encode loading and error behavior.
- `test/encode-options.spec.js`: encode input options and invalid payload handling.
- `test/decode.spec.js`: baseline decode loading and error behavior.
- `test/decode-options.spec.js`: decode output options.
- `test/delimited.spec.js`: length-delimited encode/decode behavior.
- `test/integrated.spec.js`: encode/decode integration.
- `test/options-roundtrip.spec.js`: encode and decode option interoperability.
- `test/protofile.spec.js`: protofile config-node loading, inline schemas, watching, imports, and multi-file paths.
- `test/protofile-endpoint.spec.js`: handler-level edge coverage for `/protobuf-file/types`.
- `test/protobufjs-fixtures.spec.js`: protobuf.js upstream fixture corpus.
- `test/runtime-optimizations.spec.js`: status and lookup-cache behavior.
- `test/examples.spec.js`: example-flow integrity.
- `test/ui/node-red-protobuf.spec.js`: Node-RED editor dialogs, controls, help text, and import menu.
- `test/docker/protofile-real-server.test.js`: Docker-only packaged integration against real package layout and embedded Node-RED admin HTTP.

## Test Assets

- `test/assets/options.proto`: option coverage schema with enum, repeated, map, bytes, int64, float, and oneof fields.
- `test/assets/test.proto`: common encode/decode test schema.
- `test/assets/proto2.proto`: proto2 required/optional coverage.
- `test/assets/edition2023.proto` and `test/assets/edition2024.proto`: Editions coverage.
- `test/assets/protobufjs-tests-data/`: vendored protobuf.js test schemas.

## Scripts

- `scripts/run-docker-tests.js`: runs Docker-only package integration tests.
- `scripts/update-protobufjs-fixtures.js`: refreshes vendored protobuf.js fixture data when intentionally updating that corpus.

## Local Outputs

These paths are generated locally and should not be committed by default:

- `coverage/`
- `.nyc_output/`
- `test-results/`
- `playwright-report/`
- `blob-report/`
- `.codegraph/`
