# Architecture

This package provides three Node-RED node types:

- `protobuf-file`: configuration node that loads protobuf schemas.
- `encode`: runtime node that encodes JavaScript objects into protobuf buffers.
- `decode`: runtime node that decodes protobuf buffers into JavaScript objects.

`src/index.js` registers the nodes in this order: `protobuf-file`, `encode`, then `decode`.

## Runtime Flow

1. A flow configures a `protobuf-file` node.
2. The config node loads a protobuf.js `Root` from either file paths or inline schema text.
3. `encode` and `decode` receive messages and resolve the message type from `msg.protobufType` or their configured Type field.
4. The runtime node looks up the message type in the loaded `Root`.
5. The runtime node encodes or decodes `msg.payload` and sends the updated message.

The encode and decode nodes cache the last resolved message type by proto root identity and type name. When the protofile node reloads a schema, it replaces the root and the cache naturally misses.

## Protofile Node

`src/nodes/protofile.js` owns schema loading.

- File mode loads one or more comma-separated paths with protobuf.js `Root.loadSync`.
- Inline mode parses editor text with protobuf.js `parse`.
- Inline definitions are self-contained; imports are only resolved in file mode.
- File mode can watch configured paths with `fs.watch`.
- File watch reloads are batched with a short timer.
- The admin endpoint `POST /protobuf-file/types` validates a supplied path or inline definition and returns message type names.
- The endpoint is gated by `flows.write` and does not enumerate directories.

## Encode Node

`src/nodes/encode.js` verifies or converts `msg.payload` and encodes it.

- Strict input mode verifies the supplied object directly.
- Convert plain object mode uses protobuf.js `fromObject`.
- Base64url byte input is normalized to protobuf.js-compatible base64 before conversion.
- Invalid payload handling is configurable as warn-and-drop or raise-error.
- Delimited mode writes one length-prefixed protobuf message per payload object.

## Decode Node

`src/nodes/decode.js` decodes buffers and converts protobuf.js messages to plain JavaScript objects.

- Output conversion uses protobuf.js `toObject` options.
- Base64url byte output is a package-level post-processing step over protobuf.js base64 string output.
- Missing required proto2 fields can still produce a partial decoded object through protobuf.js `ProtocolError.instance`.
- Delimited mode reads consecutive length-prefixed messages.
- Delimited output can send one Node-RED message per decoded item or one message with an array payload.

## Performance Invariants

The encode and decode nodes share three optimizations that the per-message input handler must preserve. `test/runtime-optimizations.spec.js` pins each.

- Status dedup: `setStatus` skips updates whose `fill|shape|text` match the previous status. `node.status` emits a runtime event per call, so redundant updates have a real cost on busy flows.
- Message-type cache: `lookupMessageType` memoizes the last resolved type, keyed on the proto root identity and the type name. A protofile reload replaces the root, which naturally misses the cache.
- Bounded lookup-error warn: when type lookup fails, the warning lists available top-level type names (`Object.keys(root.nested)`); it does not stringify the full schema.

Changes to the input handlers should preserve each invariant or update the regression spec deliberately.

## Editor UI

Each node has an `.html` file beside its runtime `.js` file. These files define Node-RED editor defaults, form controls, and help text. Help blocks must declare `<script type="text/markdown" data-help-name="...">` so Node-RED 5 renders GitHub-style `[!WARNING]` and `[!TIP]` alerts and Markdown property tables.

When adding a runtime option, update:

- the runtime `.js` file,
- the editor defaults,
- the editor form control,
- the help text,
- README feature text when user-facing,
- focused Mocha tests,
- Playwright UI tests when editor controls change.

## Examples

`examples/*.json` flows are discovered by Node-RED when the package is installed. The filename (minus `.json`) becomes the entry under **Import > Examples > @pauldeng/node-red-contrib-protobuf** in the editor, so renaming a flow file changes the user-visible menu label.

`examples/protos/*.proto` are the schemas these flows reference. Example flows resolve schema paths against the Node-RED runtime working directory; the shipped paths assume `~/.node-red/node_modules/@pauldeng/node-red-contrib-protobuf/`.
