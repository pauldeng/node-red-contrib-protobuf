# Security Policy

## Reporting a vulnerability

Please do **not** open a public GitHub issue for security vulnerabilities.

Use GitHub's private vulnerability reporting:

1. Open <https://github.com/pauldeng/node-red-contrib-protobuf/security/advisories/new>.
2. Provide a description, the affected version(s), and reproduction steps.

If GitHub's flow is unavailable, email <paul.deng@gallagher.com> instead.

You can expect an acknowledgement within seven days and a status update within thirty days.

## Supported versions

| Version | Status |
| --- | --- |
| `2.x` | Active. Security and bug fixes land on the latest minor. |
| `1.x` and earlier | Not maintained by this fork. See the upstream [`node-red-contrib-protobuf`](https://www.npmjs.com/package/node-red-contrib-protobuf) (last published 2023-01-06). |

## Scope

This policy covers the runtime behavior of the `encode`, `decode`, and `protobuf-file` nodes and the admin endpoint that backs the **Validate & list types** button.

Vulnerabilities in [`protobufjs`](https://github.com/protobufjs/protobuf.js) itself should be reported upstream.
