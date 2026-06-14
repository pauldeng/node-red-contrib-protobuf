# @pauldeng/node-red-contrib-protobuf

Encode and decode [Protocol Buffers](https://protobuf.dev/) in Node-RED flows.

This package adds three Node-RED nodes built on [protobuf.js](https://github.com/protobufjs/protobuf.js):

- **protobuf-file** - a configuration node that loads one or more `.proto` schemas, either from disk or from an inline definition edited in the dialog.
- **encode** - converts a JavaScript object on `msg.payload` into a protobuf-encoded `Buffer`.
- **decode** - converts a protobuf-encoded `Buffer` on `msg.payload` into a JavaScript object.

proto2, proto3, and Protobuf Editions 2023 / 2024 are supported.

## Compatibility

- Node-RED `>= 4.1.0` (tested against 5.x)
- Node.js `>= 20.19.0`

## Install

From the Node-RED editor: **Menu > Manage palette > Install**, then search for `@pauldeng/node-red-contrib-protobuf` (or just `protobuf`).

From a shell, in your Node-RED user directory:

```bash
cd ~/.node-red
npm install @pauldeng/node-red-contrib-protobuf
```

## Quick start

1. Drop an **encode** or **decode** node onto a flow.
2. Open its dialog and create a **protobuf-file** config node pointing at one or more `.proto` files (or paste an inline schema).
3. Set the **Type** field (for example `package.Message`) - or supply `msg.protobufType` on each message, which overrides the configured Type.
4. Send `msg.payload` as a JavaScript object (encode) or a `Buffer` (decode).

Use the **Validate & list types** button in the protobuf-file dialog to confirm the schema loaded and to copy the exact type name into the Type field.

## Examples

Importable example flows are bundled with the package. Open **Menu > Import > Examples > @pauldeng/node-red-contrib-protobuf** in the Node-RED editor:

| # | Example | Shows |
| --- | --- | --- |
| 1 | encode basics | turning a JavaScript object into protobuf wire bytes |
| 2 | decode basics | turning protobuf wire bytes back into a JavaScript object |
| 3 | proto2 round trip | `required`, `optional`, and default values |
| 4 | proto3 round trip | implicit presence and snake_case to camelCase conversion |
| 5 | edition 2023 round trip | Protobuf Editions schema |
| 6 | edition 2024 round trip | Protobuf Editions schema |
| 7 | delimited stream | several length-prefixed messages in one buffer |
| 8 | chained protos | a root schema that imports types from other files |

Each flow's comment node explains what it shows. The schemas live in `examples/protos/`.

## Features

- **Encode** - strict verification or protobuf.js `fromObject` conversion; base64 and base64url byte input; warn-and-drop or raise-error on invalid payloads.
- **Decode** - configurable enum / long / bytes representation; include unset defaults, empty arrays / objects, virtual oneofs; JSON-safe NaN / Infinity values.
- **Delimited streams** - length-prefixed `encodeDelimited` / `decodeDelimited` framing for serial or TCP-style flows.
- **Inline definitions** - type or paste a schema directly into the config dialog with protobuf syntax highlighting, saveable to the Node-RED library as a `.proto` file.
- **Multi-file schemas** - comma-separated paths, automatic `import` resolution, debounced file-watch reload.

## Important: proto3 "false" vs "not set"

> [!WARNING]
> Plain proto3 scalar fields use *implicit presence*. A value equal to the field default (`false`, `0`, `""`) is **never transmitted**, and the wire bytes for "set to false" and "never set" are identical. After decoding, the field is simply missing:
>
> ```text
> schema:  bool enabled = 1;
> flow:    { "enabled": false } -> encode -> decode -> { }      enabled is gone!
> ```
>
> This is standard protobuf behavior ([field presence guide](https://protobuf.dev/programming-guides/field_presence/)), not a bug in this node. When your flows must distinguish `false` or `0` from "not set", declare the field `optional` in proto3 - or use a proto2 or Editions schema, which track presence by default:
>
> ```text
> schema:  optional bool enabled = 1;
> flow:    { "enabled": false } -> encode -> decode -> { "enabled": false }
> ```

## Documentation

Full per-node options and help are in the editor's info sidebar - open any node and switch to the help tab.

For contributors and AI coding agents, deeper docs live in [`AGENTS.md`](AGENTS.md) and [`docs/`](docs/):

- [`docs/architecture.md`](docs/architecture.md) - runtime flow, performance invariants, editor UI conventions.
- [`docs/node-guide.md`](docs/node-guide.md) - full per-node options reference.
- [`docs/testing.md`](docs/testing.md) - test commands and placement.
- [`docs/change-workflow.md`](docs/change-workflow.md) - test-first rule, verification gates, commit discipline.
- [`docs/troubleshooting.md`](docs/troubleshooting.md) - common failure modes and remedies.

## Contributing

See [`docs/change-workflow.md`](docs/change-workflow.md). Quick start:

```bash
npm install
npm test
npm run lint
npm run coverage
npm run test:ui      # Playwright editor tests
npm run test:docker  # packaged integration tests (requires Docker)
```

## License

[BSD 3-Clause](LICENCE). Original author: [Alexander Wellbrock](https://w4tsn.github.io/blog).
