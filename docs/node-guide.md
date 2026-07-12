# Node Guide

This guide summarizes the behavior that flow authors and maintainers should know before changing node code.

## Shared Behavior

- `protobuf-file` is required by encode and decode nodes.
- `msg.protobufType` overrides the node's configured Type field.
- If no type is available, encode/decode reports an error.
- If the configured protofile did not load, encode/decode reports an error.
- If type lookup fails, encode/decode warns and sends no message.

## Protobuf-File

Source modes:

- File path: loads one path or comma-separated paths.
- Inline definition: parses schema text from the editor.

Options:

- `keepCase`: preserves protobuf field casing when loading or parsing.
- `watchFile`: watches file-mode schemas and reloads on change. Inline schemas are not watched.

When file watching is enabled, the node watches the configured files and every imported file resolved by protobuf.js. A successful reload replaces the complete root and refreshes the watcher set. If a reload fails, the error is reported and the last successfully loaded root remains active.

Admin endpoint:

- `POST /protobuf-file/types`
- Body accepts file-mode fields (`protopath`, optional `keepCase`) or inline fields (`sourceType: "inline"`, `protocontent`, optional `keepCase`).
- Response is `{ ok: true, types: [...] }` or `{ ok: false, error: "..." }`.

## Encode

Input:

- `msg.payload`: object, or array when Delimited is enabled.
- `msg.protobufType`: optional type override.

Output:

- `msg.payload`: protobuf buffer.
- `msg.protobufType`: type used by the node.

Options:

- Delimited: uses protobuf.js `encodeDelimited`. With an array payload, each item becomes one length-prefixed message in the output buffer.
- Input conversion:
  - Strict: verifies the supplied payload directly.
  - Convert plain object: uses protobuf.js `fromObject` before encoding.
- Bytes:
  - String (base64): protobuf.js default bytes-string input.
  - String (base64url): package-level normalization to base64 before protobuf.js conversion.
- Invalid payload:
  - Warn and drop: logs a warning and sends nothing.
  - Raise error: calls Node-RED error handling so Catch nodes can handle the failure.

## Decode

Input:

- `msg.payload`: protobuf buffer.
- `msg.protobufType`: optional type override.

Output:

- `msg.payload`: decoded object, or an array when Delimited and array output are selected.
- `msg.protobufType`: type used by the node.

Delimited options:

- Delimited: uses protobuf.js `decodeDelimited`.
- Output:
  - One message per decoded item.
  - Single message with array payload.

Output conversion options:

- Enums:
  - String (name): default historical behavior.
  - Number (value): protobuf.js numeric enum output.
- Longs:
  - String: default historical behavior and safest for JSON.
  - Number: convenient but can lose precision above JavaScript's safe integer range.
  - BigInt: exact JavaScript integer, but not JSON-serializable.
  - Long object: protobuf.js default Long representation.
- Bytes:
  - String (base64): default historical behavior.
  - String (base64url): package-level post-processing from base64 to unpadded URL-safe base64.
  - Array: byte array.
  - Buffer: protobuf.js default Buffer output.
- Defaults: includes unset fields with default values.
- Empty arrays: includes unset repeated fields as `[]` without forcing all scalar defaults.
- Empty objects: includes unset map fields as `{}` without forcing all scalar defaults.
- Virtual oneofs: adds a property named after the oneof set, with the selected field name as its value.
- JSON floats: converts `NaN` and `Infinity` float values to strings.

## Presence Gotcha

Plain proto3 scalar fields use implicit presence. If a field is set to its default value (`false`, `0`, or `""`), protobuf does not transmit it, and decode cannot distinguish it from unset. Use proto3 `optional`, proto2, or Editions presence when the difference matters.
