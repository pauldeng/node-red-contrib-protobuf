# Troubleshooting

Use this file for likely causes before changing code.

## Type Lookup Fails

Symptoms:

- Warning mentions a problem looking up the message type.
- No output message is sent.

Check:

- `msg.protobufType` overrides the configured Type field.
- The type name may need the package prefix, such as `package.Message`.
- Use the protobuf-file editor's Validate & list types button to see exact names.
- Confirm the protofile node loaded without errors.

## Proto File Does Not Load

Check:

- The path is correct from the Node-RED runtime working directory.
- Comma-separated paths are valid and readable.
- Imported files are resolvable from file mode.
- Inline schemas cannot resolve imports.
- Node-RED has filesystem permission to read watched files.

## Inline Schema Fails

Check:

- The inline schema text is not empty.
- Imports are not used in inline mode.
- `keepCase` is set the same way as the flow expects.

## Proto3 Default Values Disappear

Plain proto3 scalar default values are not transmitted. A decoded object can omit fields that were set to `false`, `0`, or `""`.

Use one of these schema choices when presence matters:

- proto3 `optional`
- proto2
- Protobuf Editions with presence

## 64-Bit Integers Are Wrong or Hard to Serialize

Decode `Longs` choices trade convenience and safety:

- `String`: safe for JSON and exact.
- `Number`: convenient but may lose precision.
- `BigInt`: exact but `JSON.stringify` throws.
- `Long object`: protobuf.js object representation.

Use `String` unless the downstream flow explicitly needs another shape.

## Bytes Look Wrong

Encode:

- `String (base64)` expects standard base64.
- `String (base64url)` accepts URL-safe base64 and normalizes it before protobuf.js conversion.

Decode:

- `String (base64)` returns protobuf.js base64 strings.
- `String (base64url)` returns unpadded URL-safe base64.
- `Array` and `Buffer` avoid text encoding concerns.

## Delimited Decode Sends Multiple Messages

By default, delimited decode sends one Node-RED message per decoded item. Choose the array output option to receive one message with an array payload.

## Watch Mode Does Not Reload

The watcher in `src/nodes/protofile.js` reloads only on `fs.watch` events of type `change`. Editors and tools that save atomically by writing to a temp file and renaming over the original emit `rename` events instead, which the watcher ignores. In that case the on-disk file is current but the loaded schema stays stale until the next deploy.

Check:

- Watch mode applies only to file-mode schemas.
- `watchFile` must not be disabled.
- All watched paths must be readable.
- If your editor saves by rename, configure it for in-place writes or redeploy the flow after edits to force a reload.

## Docker Tests Fail Before Mocha Starts

Check:

- Docker is installed and running.
- The current user can run `docker info`, or passwordless `sudo -n docker info` works.
- The image exists or can be pulled before running with `--network none`.
- Override the image with `NODE_DOCKER_IMAGE` if needed.
