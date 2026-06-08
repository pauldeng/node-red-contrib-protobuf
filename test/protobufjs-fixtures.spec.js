const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const protobuf = require('protobufjs');
const protofile = require('../src/nodes/protofile');

const fixtureRoot = path.join(__dirname, 'assets', 'protobufjs-tests-data');

const expectedProtoFiles = [
  'badimport.proto',
  'cli/null-defaults-edition2023.proto',
  'cli/null-defaults-proto3.proto',
  'cli/null-defaults.proto',
  'cli/test-filter-import.proto',
  'cli/test-filter.proto',
  'cli/test.proto',
  'comment_serialization.proto',
  'comments-alternate-parse.proto',
  'comments.proto',
  'common-custom.proto',
  'common.proto',
  'convert.proto',
  'feature-resolution.proto',
  'google/protobuf/descriptor.proto',
  'import-option-bad.proto',
  'invalid-lookup.proto',
  'invalid.proto',
  'issue936.proto',
  'mapbox/vector_tile.proto',
  'options_test.proto',
  'package.proto',
  'rpc-reserved.proto',
  'rpc.proto',
  'test.proto',
  'type_url.proto',
  'uncommon.proto',
  'weak-other.proto',
  'weak.proto',
  'whitespace-in-type.proto',
];

const expectedLoadFailures = new Map([
  ['badimport.proto', /nonexistent\.proto|no such file/i],
  ['common-custom.proto', /custom\/common\.proto|no such file/i],
  ['invalid-lookup.proto', /illegal token 'required'/i],
  ['invalid.proto', /illegal token 'null'/i],
]);

const validProtoFiles = expectedProtoFiles.filter(function (protoFile) {
  return !expectedLoadFailures.has(protoFile);
});

const collectProtoFiles = function (directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(function (entry) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectProtoFiles(entryPath);
    }

    if (entry.isFile() && entry.name.endsWith('.proto')) {
      return [path.relative(fixtureRoot, entryPath).replaceAll(path.sep, '/')];
    }

    return [];
  });
};

const createProtoFileNode = function (config) {
  const errors = [];
  let ProtoFileNode;

  const RED = {
    nodes: {
      createNode: function (node) {
        node.error = function (message) {
          errors.push(message);
        };
        node.log = function () {};
        node.on = function () {};
      },
      registerType: function (type, nodeConstructor) {
        assert.strictEqual(type, 'protobuf-file');
        ProtoFileNode = nodeConstructor;
      },
    },
  };

  protofile(RED);

  return {
    errors,
    node: new ProtoFileNode(config),
  };
};

describe('protobuf.js upstream fixture corpus', function () {

  it('should include every .proto file from protobuf.js tests/data', function () {
    assert.deepStrictEqual(collectProtoFiles(fixtureRoot).sort(), expectedProtoFiles);
  });

  it('should load every valid upstream .proto fixture and document expected invalid fixtures', function () {
    for (const protoFile of expectedProtoFiles) {
      const filePath = path.join(fixtureRoot, protoFile);

      try {
        const root = protobuf.loadSync(filePath);

        if (expectedLoadFailures.has(protoFile)) {
          assert.fail(`${protoFile} loaded but should fail`);
        }

        assert.ok(root instanceof protobuf.Root, `${protoFile} did not load as a protobuf Root`);
      }
      catch (error) {
        const expectedError = expectedLoadFailures.get(protoFile);

        if (!expectedError) {
          throw error;
        }

        assert.match(error.message, expectedError, `${protoFile} failed with an unexpected error`);
      }
    }
  });

  it('should load every valid upstream .proto fixture through the protobuf-file node', function () {
    for (const protoFile of validProtoFiles) {
      const { errors, node } = createProtoFileNode({
        protopath: path.join(fixtureRoot, protoFile),
        watchFile: false,
      });

      assert.deepStrictEqual(errors, [], `${protoFile} emitted an unexpected node error`);
      assert.ok(node.protoTypes instanceof protobuf.Root, `${protoFile} was not loaded into a protobuf Root`);
    }
  });

});
