const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
var helper = require('node-red-node-test-helper');
var protobuf = require('protobufjs');
var encode = require('../src/nodes/encode');
var decode = require('../src/nodes/decode');
var protofile = require('../src/nodes/protofile');

helper.init(require.resolve('node-red'));

const examplesDir = path.resolve(__dirname, '..', 'examples');
const protosDir = path.join(examplesDir, 'protos');
const packagedProtoPrefix = 'node_modules/node-red-contrib-protobuf/examples/protos/';

const examples = {
    '01 encode basics.json': { proto: 'proto3.proto', protoType: 'TestType', kind: 'encode' },
    '02 decode basics.json': { proto: 'proto3.proto', protoType: 'TestType', kind: 'decode' },
    '03 proto2 round trip.json': { proto: 'proto2.proto', protoType: 'Proto2Type', kind: 'roundtrip' },
    '04 proto3 round trip.json': { proto: 'proto3.proto', protoType: 'TestType', kind: 'roundtrip' },
    '05 edition 2023 round trip.json': { proto: 'edition2023.proto', protoType: 'Edition2023Type', kind: 'roundtrip' },
    '06 edition 2024 round trip.json': { proto: 'edition2024.proto', protoType: 'Edition2024Type', kind: 'roundtrip' },
    '07 delimited stream.json': { proto: 'proto3.proto', protoType: 'TestType', kind: 'delimited' },
    '08 chained protos.json': { proto: 'sensor.proto', protoType: 'SensorReport', kind: 'roundtrip', imports: ['common.proto', 'location.proto'] }
};

const allowedNodeTypes = ['comment', 'inject', 'function', 'debug', 'encode', 'decode', 'protobuf-file'];

const decodeExampleExpectedPayload = {
    timestamp: 1533295590569,
    foo: 1.5,
    bar: true,
    test: 'Hello from the decode example',
    noMoreSnakeCase: true
};

function readExample (fileName) {
    return JSON.parse(fs.readFileSync(path.join(examplesDir, fileName), 'utf8'));
}

function getInjectPayload (nodes) {
    const injectNode = nodes.find(node => node.type === 'inject');
    const payloadProp = injectNode.props.find(prop => prop.p === 'payload');
    return JSON.parse(payloadProp.v);
}

function getFunctionHex (nodes) {
    const functionNode = nodes.find(node => node.type === 'function');
    const match = /Buffer\.from\('([0-9a-f]+)', 'hex'\)/.exec(functionNode.func);
    return match && match[1];
}

// Reduce an example flow to the runtime nodes the test helper can load:
// keep encode/decode/protobuf-file, point the proto path at this repo,
// and turn the debug sink into a helper node so output can be asserted.
function buildRuntimeFlow (nodes) {
    const debugNode = nodes.find(node => node.type === 'debug');
    const flow = nodes
        .filter(node => ['encode', 'decode', 'protobuf-file'].includes(node.type))
        .map(node => ({ ...node }));
    flow.forEach(node => {
        if (node.type === 'protobuf-file') {
            node.protopath = path.join(protosDir, path.basename(node.protopath));
            node.z = '';
        }
        else {
            node.z = 'examples-test-flow';
        }
    });
    flow.push({ id: debugNode.id, type: 'helper', z: 'examples-test-flow', wires: [[]] });
    return flow;
}

describe('packaged example flows', function () {

    afterEach(function () {
        helper.unload();
    });

    it('should ship exactly the documented example flow files', function () {
        const shipped = fs.readdirSync(examplesDir).filter(name => name.endsWith('.json')).sort();
        assert.deepStrictEqual(shipped, Object.keys(examples).sort());
    });

    Object.entries(examples).forEach(([fileName, expected]) => {
        describe(fileName, function () {

            it('should be a valid flow with documented structure', function () {
                const nodes = readExample(fileName);
                assert.ok(Array.isArray(nodes), 'example must be a JSON array of nodes');

                const unexpectedTypes = nodes.map(node => node.type).filter(type => !allowedNodeTypes.includes(type));
                assert.deepStrictEqual(unexpectedTypes, [], 'examples must only use core and protobuf nodes');

                assert.ok(nodes.some(node => node.type === 'comment'), 'every example needs an explanatory comment node');
                assert.ok(nodes.some(node => node.type === 'debug'), 'every example needs a debug sink');

                const configNodes = nodes.filter(node => node.type === 'protobuf-file');
                assert.strictEqual(configNodes.length, 1, 'every example needs exactly one protobuf-file config node');
                const configNode = configNodes[0];
                assert.strictEqual(configNode.watchFile, false, 'examples must not watch files');
                assert.strictEqual(configNode.protopath, packagedProtoPrefix + expected.proto);
                assert.ok(fs.existsSync(path.join(protosDir, expected.proto)), 'referenced proto must ship in examples/protos');
                (expected.imports || []).forEach(importedProto => {
                    assert.ok(fs.existsSync(path.join(protosDir, importedProto)), `imported proto ${importedProto} must ship in examples/protos`);
                });

                nodes.filter(node => ['encode', 'decode'].includes(node.type)).forEach(node => {
                    assert.strictEqual(node.protofile, configNode.id, `${node.type} node must reference the example config node`);
                    assert.strictEqual(node.protoType, expected.protoType);
                    if (expected.kind === 'delimited') {
                        assert.strictEqual(node.delimited, true, `${node.type} node must enable delimited mode`);
                    }
                });
            });

            if (expected.kind === 'roundtrip') {
                it('should encode and decode its inject payload unchanged', function (done) {
                    const nodes = readExample(fileName);
                    const payload = getInjectPayload(nodes);
                    const encodeId = nodes.find(node => node.type === 'encode').id;
                    const helperId = nodes.find(node => node.type === 'debug').id;
                    helper.load([encode, decode, protofile], buildRuntimeFlow(nodes), function () {
                        helper.getNode(helperId).on('input', function (msg) {
                            try {
                                assert.deepStrictEqual(msg.payload, payload);
                                done();
                            }
                            catch (error) {
                                done(error);
                            }
                        });
                        helper.getNode(encodeId).receive({ payload: payload });
                    });
                });
            }

            if (expected.kind === 'delimited') {
                it('should stream each decoded item as its own message', function (done) {
                    const nodes = readExample(fileName);
                    const payload = getInjectPayload(nodes);
                    const encodeId = nodes.find(node => node.type === 'encode').id;
                    const helperId = nodes.find(node => node.type === 'debug').id;
                    helper.load([encode, decode, protofile], buildRuntimeFlow(nodes), function () {
                        const received = [];
                        helper.getNode(helperId).on('input', function (msg) {
                            received.push(msg.payload);
                            if (received.length < payload.length) return;
                            try {
                                assert.deepStrictEqual(received, payload);
                                done();
                            }
                            catch (error) {
                                done(error);
                            }
                        });
                        helper.getNode(encodeId).receive({ payload: payload });
                    });
                });
            }

            if (expected.kind === 'encode') {
                it('should encode its inject payload to a protobuf buffer', function (done) {
                    const nodes = readExample(fileName);
                    const payload = getInjectPayload(nodes);
                    const encodeId = nodes.find(node => node.type === 'encode').id;
                    const helperId = nodes.find(node => node.type === 'debug').id;
                    helper.load([encode, protofile], buildRuntimeFlow(nodes), function () {
                        helper.getNode(helperId).on('input', function (msg) {
                            try {
                                assert.ok(Buffer.isBuffer(msg.payload), 'encode output must be a buffer');
                                assert.strictEqual(msg.protobufType, expected.protoType);
                                const root = new protobuf.Root().loadSync(path.join(protosDir, expected.proto));
                                const messageType = root.lookupType(expected.protoType);
                                const decoded = messageType.toObject(messageType.decode(msg.payload));
                                assert.deepStrictEqual(decoded, payload);
                                done();
                            }
                            catch (error) {
                                done(error);
                            }
                        });
                        helper.getNode(encodeId).receive({ payload: payload });
                    });
                });
            }

            if (expected.kind === 'decode') {
                it('should decode its embedded buffer to the documented payload', function (done) {
                    const nodes = readExample(fileName);
                    const hex = getFunctionHex(nodes);
                    assert.ok(hex, 'decode example must embed a hex buffer in its function node');
                    const decodeId = nodes.find(node => node.type === 'decode').id;
                    const helperId = nodes.find(node => node.type === 'debug').id;
                    helper.load([decode, protofile], buildRuntimeFlow(nodes), function () {
                        helper.getNode(helperId).on('input', function (msg) {
                            try {
                                assert.deepStrictEqual(msg.payload, decodeExampleExpectedPayload);
                                done();
                            }
                            catch (error) {
                                done(error);
                            }
                        });
                        helper.getNode(decodeId).receive({ payload: Buffer.from(hex, 'hex') });
                    });
                });
            }
        });
    });
});
