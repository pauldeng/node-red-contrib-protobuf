# Changelog

All notable changes to this package will be documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.1] - 2026-07-12

### Changed

- Updated protobuf.js to 8.7.0 and refreshed the Playwright, ESLint, and Node-RED development toolchain.
- Updated GitHub Actions and expanded CI to Node.js 26; release tags now run editor UI and packaged Node-RED integration tests instead of release-time CLI validation.

### Fixed

- Delimited proto2 decoding now continues with trailing frames after forwarding a partial message that is missing required fields.
- Invalid repeated, map, or nested base64url byte values now follow the configured warn-or-error validation behavior instead of escaping as a `TypeError`.
- File watch mode now reloads changes to imported schemas and no longer claims a failed reload succeeded; the existing last-good schema remains active after failure.

## [2.0.0] - 2026-06-14

First release under the `@pauldeng/` npm scope. Continuation of [`node-red-contrib-protobuf`](https://www.npmjs.com/package/node-red-contrib-protobuf) `1.1.2` by [Alexander Wellbrock](https://w4tsn.github.io/blog), which has been unmaintained since 2023-01-06.

### Changed

- Published as `@pauldeng/node-red-contrib-protobuf`; the unscoped `node-red-contrib-protobuf` line is no longer maintained.
- `protobufjs` upgraded from `^6.11.2` to `^8.6.3`.
- Node.js floor raised to `>=20.19.0` (was effectively 18.x in `1.1.2`).
- Node-RED floor raised to `>=4.1.0`.
- Editor dialogs renovated; palette appearance and node help text rewritten.
- Bundled example flows reference `node_modules/@pauldeng/node-red-contrib-protobuf/examples/protos/...` for `protopath`.

### Added

- proto2, Editions 2023, and Editions 2024 round-trip coverage with bundled fixtures.
- Delimited (length-prefixed) encoding and decoding (`encodeDelimited` / `decodeDelimited`).
- Inline `.proto` definitions in the protobuf-file config dialog, with optional save-to-library.
- Validate-and-list-types admin endpoint backing the editor's **Validate & list types** button.
- Decode output options: enum/long/bytes representation, include unset defaults, JSON-safe NaN/Infinity.
- Encode input options: base64 / base64url byte input; strict verification vs `fromObject` conversion.
- Eight bundled example flows: encode/decode basics, proto2 / proto3 / editions 2023 / editions 2024 round trips, delimited streams, and chained (multi-file) protos.

### Fixed

- Config-node state isolation: each protobuf-file config now keeps its own load state.
- `ProtocolError` raised during decode is reported via Node-RED's `done`/error path instead of crashing the runtime.
- Status updates dedupe identical messages to avoid editor churn.
- Type-lookup warnings surface available types instead of dumping the full schema.

### Migration

1. **Node types are unchanged.** Existing flows that reference `encode`, `decode`, and `protobuf-file` continue to load.
2. **Uninstall the old package before installing the scoped one.** Installing both side by side causes duplicate node-type registration at Node-RED startup.

   ```bash
   cd ~/.node-red
   npm uninstall node-red-contrib-protobuf
   npm install @pauldeng/node-red-contrib-protobuf
   ```

3. **Update hard-coded `protopath` strings in saved flows.** Any flow whose protobuf-file config node has a relative path like `node_modules/node-red-contrib-protobuf/examples/protos/...` will point at the now-uninstalled package after upgrade. Either rewrite the path to `node_modules/@pauldeng/node-red-contrib-protobuf/examples/protos/...`, switch to an absolute path on disk, or re-import the corresponding example flow from **Import → Examples** to pick up the new path automatically.

## Earlier history

For the `1.1.x` and earlier history, see the original [`node-red-contrib-protobuf`](https://www.npmjs.com/package/node-red-contrib-protobuf) on npm and its upstream repository.

[Unreleased]: https://github.com/pauldeng/node-red-contrib-protobuf/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/pauldeng/node-red-contrib-protobuf/releases/tag/v2.0.0
