const assert = require('node:assert');
var helper = require('node-red-node-test-helper');
var protobuf = require('protobufjs');
var encode = require('../src/nodes/encode');
var decode = require('../src/nodes/decode');
var protofile = require('../src/nodes/protofile');

helper.init(require.resolve('node-red'));

const testMessages = [
    { test: 'first', bar: true },
    { test: 'second', foo: 2.5 },
    { test: 'third', timestamp: 1533295590569 }
];

function lookupTestType () {
    return new protobuf.Root().loadSync('test/assets/test.proto').lookupType('TestType');
}

function delimitedBuffer (messages) {
    const TestType = lookupTestType();
    const writer = protobuf.Writer.create();
    messages.forEach(message => TestType.encodeDelimited(TestType.create(message), writer));
    return Buffer.from(writer.finish());
}

function readDelimited (buffer) {
    const TestType = lookupTestType();
    const reader = protobuf.Reader.create(buffer);
    const messages = [];
    while (reader.pos < reader.len) {
        messages.push(TestType.toObject(TestType.decodeDelimited(reader)));
    }
    return messages;
}

function encodeFlow (nodeOverrides) {
    return [
        Object.assign({
            id: 'encode-node',
            type: 'encode',
            z: 'delimited-flow',
            protofile: 'proto-node',
            protoType: 'TestType',
            delimited: true,
            wires: [['helper-node']]
        }, nodeOverrides),
        { id: 'helper-node', type: 'helper', z: 'delimited-flow', wires: [[]] },
        { id: 'proto-node', type: 'protobuf-file', z: '', protopath: 'test/assets/test.proto' }
    ];
}

function decodeFlow (nodeOverrides) {
    return [
        Object.assign({
            id: 'decode-node',
            type: 'decode',
            z: 'delimited-flow',
            protofile: 'proto-node',
            protoType: 'TestType',
            delimited: true,
            wires: [['helper-node']]
        }, nodeOverrides),
        { id: 'helper-node', type: 'helper', z: 'delimited-flow', wires: [[]] },
        { id: 'proto-node', type: 'protobuf-file', z: '', protopath: 'test/assets/test.proto' }
    ];
}

describe('protobuf delimited mode', function () {

    afterEach(function () {
        helper.unload();
    });

    it('should default to non-delimited mode when the config properties are absent', function (done) {
        helper.load([encode, decode, protofile], [
            { id: 'encode-node', type: 'encode', z: 'delimited-flow', protofile: 'proto-node', protoType: 'TestType', wires: [[]] },
            { id: 'decode-node', type: 'decode', z: 'delimited-flow', protofile: 'proto-node', protoType: 'TestType', wires: [[]] },
            { id: 'proto-node', type: 'protobuf-file', z: '', protopath: 'test/assets/test.proto' }
        ], function () {
            try {
                assert.strictEqual(helper.getNode('encode-node').delimited, false);
                assert.strictEqual(helper.getNode('decode-node').delimited, false);
                assert.strictEqual(helper.getNode('decode-node').delimitedOutput, 'messages');
                done();
            }
            catch (error) {
                done(error);
            }
        });
    });

    it('should encode a single object as one delimited message', function (done) {
        helper.load([encode, protofile], encodeFlow(), function () {
            var helperNode = helper.getNode('helper-node');
            helperNode.on('input', function (msg) {
                try {
                    assert.ok(Buffer.isBuffer(msg.payload));
                    assert.deepStrictEqual(readDelimited(msg.payload), [testMessages[0]]);
                    done();
                }
                catch (error) {
                    done(error);
                }
            });
            helper.getNode('encode-node').receive({ payload: testMessages[0] });
        });
    });

    it('should encode an array as a concatenated delimited stream', function (done) {
        helper.load([encode, protofile], encodeFlow(), function () {
            var helperNode = helper.getNode('helper-node');
            helperNode.on('input', function (msg) {
                try {
                    assert.deepStrictEqual(readDelimited(msg.payload), testMessages);
                    done();
                }
                catch (error) {
                    done(error);
                }
            });
            helper.getNode('encode-node').receive({ payload: testMessages });
        });
    });

    it('should warn and send nothing when an array element is invalid', function (done) {
        helper.load([encode, protofile], encodeFlow(), function () {
            var encodeNode = helper.getNode('encode-node');
            var helperNode = helper.getNode('helper-node');
            helperNode.on('input', function () {
                done(new Error('nothing should be sent for an invalid element'));
            });
            encodeNode.on('call:warn', function (call) {
                try {
                    assert.match(String(call.args[0]), /not valid/);
                    assert.match(String(call.args[0]), /1/);
                    done();
                }
                catch (error) {
                    done(error);
                }
            });
            encodeNode.receive({ payload: [testMessages[0], { test: 42 }] });
        });
    });

    it('should decode a delimited stream into one message per item by default', function (done) {
        helper.load([decode, protofile], decodeFlow(), function () {
            var helperNode = helper.getNode('helper-node');
            const received = [];
            helperNode.on('input', function (msg) {
                received.push(msg);
                if (received.length < testMessages.length) return;
                try {
                    assert.deepStrictEqual(received.map(m => m.payload), testMessages);
                    received.forEach(m => {
                        assert.strictEqual(m.topic, 'stream-topic');
                        assert.strictEqual(m.protobufType, 'TestType');
                    });
                    done();
                }
                catch (error) {
                    done(error);
                }
            });
            helper.getNode('decode-node').receive({ payload: delimitedBuffer(testMessages), topic: 'stream-topic' });
        });
    });

    it('should decode a delimited stream into a single array payload when configured', function (done) {
        helper.load([decode, protofile], decodeFlow({ delimitedOutput: 'array' }), function () {
            var helperNode = helper.getNode('helper-node');
            helperNode.on('input', function (msg) {
                try {
                    assert.deepStrictEqual(msg.payload, testMessages);
                    assert.strictEqual(msg.protobufType, 'TestType');
                    done();
                }
                catch (error) {
                    done(error);
                }
            });
            helper.getNode('decode-node').receive({ payload: delimitedBuffer(testMessages) });
        });
    });

    it('should round trip an array through delimited encode and decode', function (done) {
        var flow = [
            { id: 'encode-node', type: 'encode', z: 'delimited-flow', protofile: 'proto-node', protoType: 'TestType', delimited: true, wires: [['decode-node']] },
            { id: 'decode-node', type: 'decode', z: 'delimited-flow', protofile: 'proto-node', protoType: 'TestType', delimited: true, delimitedOutput: 'array', wires: [['helper-node']] },
            { id: 'helper-node', type: 'helper', z: 'delimited-flow', wires: [[]] },
            { id: 'proto-node', type: 'protobuf-file', z: '', protopath: 'test/assets/test.proto' }
        ];
        helper.load([encode, decode, protofile], flow, function () {
            var helperNode = helper.getNode('helper-node');
            helperNode.on('input', function (msg) {
                try {
                    assert.deepStrictEqual(msg.payload, testMessages);
                    done();
                }
                catch (error) {
                    done(error);
                }
            });
            helper.getNode('encode-node').receive({ payload: testMessages });
        });
    });

    // Regression guard for the varint endianness bug fixed in fork commit
    // bveenema/node-red-protobuf@8e873cd: a hand-rolled big-endian varint
    // parser misread length prefixes of two or more bytes, so delimited
    // messages of 128 bytes or longer failed to decode. This package uses
    // protobuf.js Reader/decodeDelimited, which reads varints little-endian
    // per the protobuf wire spec; these tests pin that behavior.
    it('should length-prefix a long message with a little-endian varint', function (done) {
        const bigMessage = { test: 'x'.repeat(500) };
        helper.load([encode, protofile], encodeFlow(), function () {
            var helperNode = helper.getNode('helper-node');
            helperNode.on('input', function (msg) {
                try {
                    const TestType = lookupTestType();
                    const innerLength = TestType.encode(TestType.create(bigMessage)).finish().length;
                    assert.ok(innerLength >= 128, 'message must need a multi-byte varint length prefix');
                    const expectedPrefix = Buffer.from(protobuf.Writer.create().uint32(innerLength).finish());
                    assert.ok(expectedPrefix.length >= 2, 'length prefix must span multiple varint bytes');
                    assert.deepStrictEqual(msg.payload.subarray(0, expectedPrefix.length), expectedPrefix);
                    assert.deepStrictEqual(readDelimited(msg.payload), [bigMessage]);
                    done();
                }
                catch (error) {
                    done(error);
                }
            });
            helper.getNode('encode-node').receive({ payload: bigMessage });
        });
    });

    it('should round trip long delimited messages between short ones', function (done) {
        const mixedMessages = [
            { test: 'short' },
            { test: 'y'.repeat(20000) },
            { test: 'also short', bar: true }
        ];
        var flow = [
            { id: 'encode-node', type: 'encode', z: 'delimited-flow', protofile: 'proto-node', protoType: 'TestType', delimited: true, wires: [['decode-node']] },
            { id: 'decode-node', type: 'decode', z: 'delimited-flow', protofile: 'proto-node', protoType: 'TestType', delimited: true, delimitedOutput: 'array', wires: [['helper-node']] },
            { id: 'helper-node', type: 'helper', z: 'delimited-flow', wires: [[]] },
            { id: 'proto-node', type: 'protobuf-file', z: '', protopath: 'test/assets/test.proto' }
        ];
        helper.load([encode, decode, protofile], flow, function () {
            var helperNode = helper.getNode('helper-node');
            helperNode.on('input', function (msg) {
                try {
                    assert.deepStrictEqual(msg.payload, mixedMessages);
                    done();
                }
                catch (error) {
                    done(error);
                }
            });
            helper.getNode('encode-node').receive({ payload: mixedMessages });
        });
    });

    it('should report a corrupted delimited stream as a node error and send nothing', function (done) {
        helper.load([decode, protofile], decodeFlow(), function () {
            var decodeNode = helper.getNode('decode-node');
            var helperNode = helper.getNode('helper-node');
            helperNode.on('input', function () {
                done(new Error('nothing should be sent for a corrupted stream'));
            });
            decodeNode.on('call:error', function (call) {
                try {
                    assert.match(String(call.args[0]), /Wire format is invalid/);
                    done();
                }
                catch (error) {
                    done(error);
                }
            });
            // A valid message followed by a frame whose length prefix points past the buffer end.
            const corrupted = Buffer.concat([delimitedBuffer([testMessages[0]]), Buffer.from([0x7f])]);
            decodeNode.receive({ payload: corrupted });
        });
    });

    it('should decode delimited proto2 messages with missing required fields as partial objects', function (done) {
        var flow = [
            { id: 'decode-node', type: 'decode', z: 'delimited-flow', protofile: 'proto-node', protoType: 'Proto2Type', delimited: true, delimitedOutput: 'array', wires: [['helper-node']] },
            { id: 'helper-node', type: 'helper', z: 'delimited-flow', wires: [[]] },
            { id: 'proto-node', type: 'protobuf-file', z: '', protopath: 'test/assets/proto2.proto' }
        ];
        const Proto2Type = new protobuf.Root().loadSync('test/assets/proto2.proto').lookupType('Proto2Type');
        const writer = protobuf.Writer.create();
        Proto2Type.encodeDelimited(Proto2Type.create({ name: 'complete' }), writer);
        // Raw frame for a message that truly misses the required name field on the
        // wire: protobuf.js always writes required fields when encoding, so the
        // bytes are crafted directly (field 2 "note" = "partial only").
        writer.bytes(Buffer.from([18, 12, 112, 97, 114, 116, 105, 97, 108, 32, 111, 110, 108, 121]));
        helper.load([decode, protofile], flow, function () {
            var helperNode = helper.getNode('helper-node');
            helperNode.on('input', function (msg) {
                try {
                    assert.deepStrictEqual(msg.payload, [{ name: 'complete' }, { note: 'partial only' }]);
                    done();
                }
                catch (error) {
                    done(error);
                }
            });
            helper.getNode('decode-node').receive({ payload: Buffer.from(writer.finish()) });
        });
    });

    it('should continue decoding after a partial delimited proto2 message', function (done) {
        var flow = [
            { id: 'decode-node', type: 'decode', z: 'delimited-flow', protofile: 'proto-node', protoType: 'Proto2Type', delimited: true, delimitedOutput: 'array', wires: [['helper-node']] },
            { id: 'helper-node', type: 'helper', z: 'delimited-flow', wires: [[]] },
            { id: 'proto-node', type: 'protobuf-file', z: '', protopath: 'test/assets/proto2.proto' }
        ];
        const Proto2Type = new protobuf.Root().loadSync('test/assets/proto2.proto').lookupType('Proto2Type');
        const writer = protobuf.Writer.create();
        // Raw frame for a message that truly misses the required name field on the
        // wire: protobuf.js always writes required fields when encoding, so the
        // bytes are crafted directly (field 2 "note" = "partial only").
        writer.bytes(Buffer.from([18, 12, 112, 97, 114, 116, 105, 97, 108, 32, 111, 110, 108, 121]));
        Proto2Type.encodeDelimited(Proto2Type.create({ name: 'complete' }), writer);
        helper.load([decode, protofile], flow, function () {
            var helperNode = helper.getNode('helper-node');
            helperNode.on('input', function (msg) {
                try {
                    assert.deepStrictEqual(msg.payload, [{ note: 'partial only' }, { name: 'complete' }]);
                    done();
                }
                catch (error) {
                    done(error);
                }
            });
            helper.getNode('decode-node').receive({ payload: Buffer.from(writer.finish()) });
        });
    });

    it('should warn and send nothing for an empty delimited buffer', function (done) {
        helper.load([decode, protofile], decodeFlow(), function () {
            var decodeNode = helper.getNode('decode-node');
            var helperNode = helper.getNode('helper-node');
            helperNode.on('input', function () {
                done(new Error('nothing should be sent for an empty buffer'));
            });
            decodeNode.on('call:warn', function (call) {
                try {
                    assert.match(String(call.args[0]), /empty/i);
                    done();
                }
                catch (error) {
                    done(error);
                }
            });
            decodeNode.receive({ payload: Buffer.alloc(0) });
        });
    });
});
