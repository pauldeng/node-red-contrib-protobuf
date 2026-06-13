const assert = require('node:assert');
var helper = require('node-red-node-test-helper');
var protobuf = require('protobufjs');
var decode = require('../src/nodes/decode');
var protofile = require('../src/nodes/protofile');

helper.init(require.resolve('node-red'));

const OptionsType = new protobuf.Root().loadSync('test/assets/options.proto').lookupType('OptionsType');

function buffer (payload) {
    return Buffer.from(OptionsType.encode(OptionsType.create(payload)).finish());
}

// enum GREEN, big 42, bytes 0x01ff, oneof "text" set.
function populatedBuffer () {
    return buffer({ color: 1, big: 42, data: Buffer.from([1, 255]), text: 'hi' });
}

function bigLongBuffer () {
    return buffer({ big: '9007199254740993' });
}

function delimitedBuffer (payloads) {
    return Buffer.concat(payloads.map(function (payload) {
        return Buffer.from(OptionsType.encodeDelimited(OptionsType.create(payload)).finish());
    }));
}

function emptyBuffer () {
    return buffer({});
}

function nanBuffer () {
    return buffer({ ratio: NaN });
}

// Load a decode flow with the given option overrides, send one buffer, and
// run the assertion on the decoded payload.
function decodeWith (options, buf, assertion, done) {
    var flow = [
        Object.assign({ id: 'n', type: 'decode', z: 'f', protofile: 'pf', protoType: 'OptionsType', wires: [['h']] }, options),
        { id: 'h', type: 'helper', z: 'f', wires: [[]] },
        { id: 'pf', type: 'protobuf-file', z: '', protopath: 'test/assets/options.proto' }
    ];
    helper.load([decode, protofile], flow, function () {
        helper.getNode('h').on('input', function (msg) {
            try {
                assertion(msg.payload);
                done();
            }
            catch (error) {
                done(error);
            }
        });
        helper.getNode('n').receive({ payload: buf });
    });
}

describe('decode output options', function () {

    afterEach(function () {
        return helper.unload();
    });

    it('defaults to the current behavior when no options are set', function (done) {
        decodeWith({}, populatedBuffer(), function (payload) {
            assert.strictEqual(payload.color, 'GREEN');           // enums as string
            assert.strictEqual(payload.big, '42');                // longs as string
            assert.strictEqual(payload.data, 'Af8=');             // bytes as base64 string
            assert.strictEqual(payload.numbers, undefined);       // defaults off: unset omitted
        }, done);
    });

    it('outputs enums as numbers when enumsType is Number', function (done) {
        decodeWith({ enumsType: 'Number' }, populatedBuffer(), function (payload) {
            assert.strictEqual(payload.color, 1);
        }, done);
    });

    it('outputs longs as numbers when longsType is Number', function (done) {
        decodeWith({ longsType: 'Number' }, populatedBuffer(), function (payload) {
            assert.strictEqual(payload.big, 42);
        }, done);
    });

    it('outputs longs as Long objects when longsType is Long', function (done) {
        decodeWith({ longsType: 'Long' }, populatedBuffer(), function (payload) {
            assert.strictEqual(typeof payload.big, 'object');
            assert.strictEqual(payload.big.low, 42);
        }, done);
    });

    it('outputs longs as BigInt values when longsType is BigInt', function (done) {
        decodeWith({ longsType: 'BigInt' }, bigLongBuffer(), function (payload) {
            assert.strictEqual(typeof payload.big, 'bigint');
            assert.strictEqual(payload.big.toString(), '9007199254740993');
        }, done);
    });

    it('outputs bytes as an array when bytesType is Array', function (done) {
        decodeWith({ bytesType: 'Array' }, populatedBuffer(), function (payload) {
            assert.deepStrictEqual(payload.data, [1, 255]);
        }, done);
    });

    it('outputs bytes as a Buffer when bytesType is Buffer', function (done) {
        decodeWith({ bytesType: 'Buffer' }, populatedBuffer(), function (payload) {
            assert.ok(Buffer.isBuffer(payload.data));
        }, done);
    });

    it('includes default values when decodeDefaults is true', function (done) {
        decodeWith({ decodeDefaults: true }, emptyBuffer(), function (payload) {
            assert.deepStrictEqual(payload.numbers, []);
            assert.ok(Object.prototype.hasOwnProperty.call(payload, 'ratio'));
        }, done);
    });

    it('includes only empty arrays when decodeArrays is true', function (done) {
        decodeWith({ decodeArrays: true }, emptyBuffer(), function (payload) {
            assert.deepStrictEqual(payload.numbers, []);
            assert.strictEqual(payload.labels, undefined);   // only arrays, not full defaults
        }, done);
    });

    it('includes only empty objects when decodeObjects is true', function (done) {
        decodeWith({ decodeObjects: true }, emptyBuffer(), function (payload) {
            assert.deepStrictEqual(payload.labels, {});
            assert.strictEqual(payload.numbers, undefined);  // only maps, not full defaults
        }, done);
    });

    it('adds the virtual oneof property when decodeOneofs is true', function (done) {
        decodeWith({ decodeOneofs: true }, populatedBuffer(), function (payload) {
            assert.strictEqual(payload.choice, 'text');
        }, done);
    });

    it('applies decode output options to delimited array output', function (done) {
        decodeWith({
            delimited: true,
            delimitedOutput: 'array',
            enumsType: 'Number',
            longsType: 'Number',
            bytesType: 'Array'
        }, delimitedBuffer([
            { color: 1, big: 42, data: Buffer.from([1, 255]) },
            { color: 1, big: 7, data: Buffer.from([2, 3]) }
        ]), function (payload) {
            assert.deepStrictEqual(payload, [
                { color: 1, data: [1, 255], big: 42 },
                { color: 1, data: [2, 3], big: 7 }
            ]);
        }, done);
    });

    it('produces JSON-safe values (NaN -> string) when decodeJson is true', function (done) {
        decodeWith({ decodeJson: true }, nanBuffer(), function (payload) {
            assert.strictEqual(payload.ratio, 'NaN');
        }, done);
    });
});
