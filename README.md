# node-red-contrib-protobuf
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fw4tsn%2Fnode-red-contrib-protobuf.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Fw4tsn%2Fnode-red-contrib-protobuf?ref=badge_shield)


This project features protobuf encode/decode nodes. Load a proto file, supply a desired type for encoding or decoding and have fun.

## Installation

In the Node-RED editor, open **Menu > Manage palette > Install**, search for
`node-red-contrib-protobuf`, and install it.

From the command line, install it in your Node-RED user directory and restart Node-RED:

```bash
cd ~/.node-red
npm install node-red-contrib-protobuf
```

## Usage

1. Place an encode/decode node on a flow
2. Configure the protofile path pointing to your protobuf file(s)
3. Either supply a proto type
    1. within the encode/decode configuration
    2. with the `msg.protobufType` field (takes precedence over node configuration)
4. Either send a `protobuf` encoded payload to the decode node or a `JSON` encoded payload to the encode node

*Note on the protofile node* The proto file node watches the specified file(s) for changes on the filesystem through nodejs fs API. If the file contents of a `.proto`-file change on disk, all configured files become reloaded. Every comma-separated path is watched; rapid consecutive changes (common with some editors and operating systems) are batched into a single reload.

## Examples

This package ships importable example flows. In the Node-RED editor, open **Menu > Import > Examples > node-red-contrib-protobuf** and pick one:

1. **encode basics** - turn a JavaScript object into protobuf wire bytes
2. **decode basics** - turn protobuf wire bytes back into a JavaScript object
3. **proto2 round trip** - `required`, `optional`, and default values
4. **proto3 round trip** - implicit presence and snake_case to camelCase conversion
5. **edition 2023 round trip** - Protobuf Editions schema
6. **edition 2024 round trip** - Protobuf Editions schema

The matching schemas live in `examples/protos/`. Each flow's comment node explains what it shows. The protobuf-file config nodes use the relative path `node_modules/node-red-contrib-protobuf/examples/protos/...`; if the proto file fails to load, edit the config node and enter the absolute path on your machine.

## Features

* Encode JSON payload to protobuf messages
* Decode protobuf messages to JSON payload
* Load protobuf file(s) from the local file system
* Consider protos from one or multiple protobuf files (including inheritance)

## Contribution

To setup your local development environment first clone this repository, then use a container runtime to get your node-red environment up and running like this:

```bash
podman run -p 1880:1880 -v $(pwd):/tmp/node-red-contrib-protobuf -d --name nodered nodered/node-red
```

After you saved your changes to the code update the installation within the container with this command:

```bash
podman exec -it nodered npm install /tmp/node-red-contrib-protobuf/ && podman restart nodered
```

*Note on SELinux enabled machines it's necessary to allow containers access to your working directory like this: `chcon -t container_file_t $(pwd)`*

### Testing and Coverage-Report

First `npm install` for the dev dependencies. Tests, linting and code coverage are then available through:

```bash
npm test
npm run coverage
npm run lint
```

## License

The BSD 3-Clause License

[Alexander Wellbrock](https://w4tsn.github.io/blog)


[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fw4tsn%2Fnode-red-contrib-protobuf.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Fw4tsn%2Fnode-red-contrib-protobuf?ref=badge_large)

## Roadmap

* validate type from loaded .proto files
* allow `.proto`-path to be a URL
* expose more configuration parameters from the protobufjs API
* write tests covering misconfiguration and errors/exceptions
* enhance the multi-file selection UI
