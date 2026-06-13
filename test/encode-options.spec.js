const assert = require('node:assert');
var helper = require('node-red-node-test-helper');
var protobuf = require('protobufjs');
var encode = require('../src/nodes/encode');
var protofile = require('../src/nodes/protofile');

helper.init(require.resolve('node-red'));

const OptionsType = new protobuf.Root().loadSync('test/assets/options.proto').lookupType('OptionsType');

function encodeFlow (options) {
    return [
        Object.assign({ id: 'n', type: 'encode', z: 'f', protofile: 'pf', protoType: 'OptionsType', wires: [['h']] }, options),
        { id: 'h', type: 'helper', z: 'f', wires: [[]] },
        { id: 'pf', type: 'protobuf-file', z: '', protopath: 'test/assets/options.proto' }
    ];
}

describe('encode input options', function () {

    afterEach(function () {
        return helper.unload();
    });

    it('converts JSON-friendly plain object values when inputConversion is fromObject', function (done) {
        helper.load([encode, protofile], encodeFlow({ inputConversion: 'fromObject' }), function () {
            var helperNode = helper.getNode('h');
            helperNode.on('input', function (msg) {
                try {
                    assert.ok(Buffer.isBuffer(msg.payload));
                    const decoded = OptionsType.toObject(OptionsType.decode(msg.payload), {
                        enums: String,
                        longs: String,
                        bytes: String
                    });
                    assert.deepStrictEqual(decoded, {
                        color: 'GREEN',
                        data: '+/8=',
                        big: '9007199254740993',
                        text: 'hi'
                    });
                    done();
                }
                catch (error) {
                    done(error);
                }
            });
            helper.getNode('n').receive({
                payload: {
                    color: 'GREEN',
                    data: '+/8=',
                    big: '9007199254740993',
                    text: 'hi'
                }
            });
        });
    });

    it('loads the base64url bytes input option', function (done) {
        helper.load([encode, protofile], encodeFlow({ inputBytesType: 'Base64Url' }), function () {
            try {
                assert.strictEqual(helper.getNode('n').inputBytesType, 'Base64Url');
                done();
            }
            catch (error) {
                done(error);
            }
        });
    });

    it('encodes base64url bytes when inputBytesType is Base64Url', function (done) {
        helper.load([encode, protofile], encodeFlow({
            inputConversion: 'fromObject',
            inputBytesType: 'Base64Url'
        }), function () {
            var helperNode = helper.getNode('h');
            helperNode.on('input', function (msg) {
                try {
                    const decoded = OptionsType.toObject(OptionsType.decode(msg.payload), {
                        bytes: String
                    });
                    assert.strictEqual(decoded.data, '+/8=');
                    done();
                }
                catch (error) {
                    done(error);
                }
            });
            helper.getNode('n').receive({ payload: { data: '-_8' } });
        });
    });

    it('reports invalid payloads as errors when validationFailure is error', function (done) {
        helper.load([encode, protofile], encodeFlow({ validationFailure: 'error' }), function () {
            var encodeNode = helper.getNode('n');
            var helperNode = helper.getNode('h');
            helperNode.on('input', function () {
                done(new Error('nothing should be sent for an invalid payload'));
            });
            encodeNode.on('call:warn', function () {
                done(new Error('invalid payload should be reported as an error'));
            });
            encodeNode.on('call:error', function (call) {
                try {
                    assert.match(String(call.args[0]), /Message is not valid under selected message type/);
                    done();
                }
                catch (error) {
                    done(error);
                }
            });
            encodeNode.receive({ payload: 'invalid payload' });
        });
    });
});
