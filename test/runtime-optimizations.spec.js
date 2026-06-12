const assert = require('node:assert');
var helper = require('node-red-node-test-helper');
var protobuf = require('protobufjs');
var encode = require('../src/nodes/encode');
var decode = require('../src/nodes/decode');
var protofile = require('../src/nodes/protofile');

helper.init(require.resolve('node-red'));

const TestType = new protobuf.Root().loadSync('test/assets/test.proto').lookupType('TestType');

function sampleBuffer () {
    return Buffer.from(TestType.encode(TestType.create({ test: 'sample' })).finish());
}

function encodeFlow () {
    return [
        { id: 'n', type: 'encode', z: 'f', protofile: 'pf', protoType: 'TestType', wires: [['h']] },
        { id: 'h', type: 'helper', z: 'f', wires: [[]] },
        { id: 'pf', type: 'protobuf-file', z: '', protopath: 'test/assets/test.proto' }
    ];
}

function decodeFlow () {
    return [
        { id: 'n', type: 'decode', z: 'f', protofile: 'pf', protoType: 'TestType', wires: [['h']] },
        { id: 'h', type: 'helper', z: 'f', wires: [[]] },
        { id: 'pf', type: 'protobuf-file', z: '', protopath: 'test/assets/test.proto' }
    ];
}

// The nodes reassign msg.payload in place, so every message must be a fresh
// object (a shared array would be mutated across runs and across tests).
function encodePayloads () {
    return [{ payload: { test: 'a' } }, { payload: { test: 'b' } }, { payload: { test: 'c' } }];
}

function decodePayloads () {
    return [{ payload: sampleBuffer() }, { payload: sampleBuffer() }, { payload: sampleBuffer() }];
}

// Run all messages through the node, then run the assertions once the helper
// has received the expected count.
function afterAllMessages (node, helperNode, payloads, check, done) {
    var received = 0;
    helperNode.on('input', function () {
        received += 1;
        if (received < payloads.length) {
            return;
        }
        try {
            check();
            done();
        }
        catch (error) {
            done(error);
        }
    });
    payloads.forEach(function (payload) {
        node.receive(payload);
    });
}

describe('runtime optimizations', function () {

    afterEach(function () {
        return helper.unload();
    });

    [
        { name: 'encode', mods: [encode, protofile], flow: encodeFlow, payloads: encodePayloads },
        { name: 'decode', mods: [decode, protofile], flow: decodeFlow, payloads: decodePayloads }
    ].forEach(function (scenario) {

        it(`${scenario.name}: updates status only on change, never the redundant 'Ready'`, function (done) {
            helper.load(scenario.mods, scenario.flow(), function () {
                var node = helper.getNode('n');
                var statuses = [];
                node.status = function (status) { statuses.push(status); };
                afterAllMessages(node, helper.getNode('h'), scenario.payloads(), function () {
                    var texts = statuses.map(function (s) { return s.text; });
                    assert.ok(!texts.includes('Ready'), "should not emit the redundant 'Ready' status");
                    assert.strictEqual(texts.filter(function (t) { return t === 'Processed'; }).length, 1,
                        "'Processed' status set once for a steady stream, not per message");
                }, done);
            });
        });

        it(`${scenario.name}: resolves the message type once for a stable type`, function (done) {
            helper.load(scenario.mods, scenario.flow(), function () {
                var node = helper.getNode('n');
                var root = node.protofile.protoTypes;
                var calls = 0;
                var original = root.lookupType;
                root.lookupType = function (name) { calls += 1; return original.call(root, name); };
                afterAllMessages(node, helper.getNode('h'), scenario.payloads(), function () {
                    assert.strictEqual(calls, 1, 'lookupType should be cached after the first message');
                }, done);
            });
        });
    });

    it('encode: warns with available types instead of a full schema dump for an unknown type', function (done) {
        helper.load([encode, protofile], encodeFlow(), function () {
            var node = helper.getNode('n');
            node.on('call:warn', function (call) {
                try {
                    var message = String(call.args[0]);
                    assert.match(message, /Problem while looking up the message type/);
                    assert.match(message, /Nonexistent/);
                    assert.match(message, /TestType/);
                    // The old warn dumped JSON.stringify(root), which contains the
                    // serialized field definitions; the bounded warn must not.
                    assert.ok(!/"fields"/.test(message), 'warn must not dump the full schema JSON');
                    done();
                }
                catch (error) {
                    done(error);
                }
            });
            node.receive({ payload: { test: 'a' }, protobufType: 'Nonexistent' });
        });
    });
});
