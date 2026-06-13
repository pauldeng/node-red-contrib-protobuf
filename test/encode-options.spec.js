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

function toObject (buffer) {
    return OptionsType.toObject(OptionsType.decode(buffer), {
        enums: String,
        longs: String,
        bytes: String
    });
}

function readDelimited (buffer) {
    const reader = protobuf.Reader.create(buffer);
    const messages = [];
    while (reader.pos < reader.len) {
        messages.push(OptionsType.toObject(OptionsType.decodeDelimited(reader), {
            enums: String,
            longs: String,
            bytes: String
        }));
    }
    return messages;
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
                    assert.deepStrictEqual(toObject(msg.payload), {
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
                    assert.strictEqual(toObject(msg.payload).data, '+/8=');
                    done();
                }
                catch (error) {
                    done(error);
                }
            });
            helper.getNode('n').receive({ payload: { data: '-_8' } });
        });
    });

    it('normalizes base64url bytes in repeated, map, and nested fields', function (done) {
        helper.load([encode, protofile], encodeFlow({
            inputConversion: 'fromObject',
            inputBytesType: 'Base64Url'
        }), function () {
            var helperNode = helper.getNode('h');
            helperNode.on('input', function (msg) {
                try {
                    assert.deepStrictEqual(toObject(msg.payload), {
                        data: '+/8=',
                        chunks: ['AQI=', '+/8='],
                        dataByName: { first: '+/8=' },
                        nested: { data: '+/8=' },
                        nestedItems: [
                            { data: 'AQI=' },
                            { data: '+/8=' }
                        ],
                        nestedByName: {
                            first: { data: '+/8=' }
                        }
                    });
                    done();
                }
                catch (error) {
                    done(error);
                }
            });
            helper.getNode('n').receive({
                payload: {
                    data: '-_8',
                    chunks: ['AQI', '-_8'],
                    dataByName: { first: '-_8' },
                    nested: { data: '-_8' },
                    nestedItems: [
                        { data: 'AQI' },
                        { data: '-_8' }
                    ],
                    nestedByName: {
                        first: { data: '-_8' }
                    }
                }
            });
        });
    });

    it('applies input conversion and base64url bytes to delimited array output', function (done) {
        helper.load([encode, protofile], encodeFlow({
            delimited: true,
            inputConversion: 'fromObject',
            inputBytesType: 'Base64Url'
        }), function () {
            var helperNode = helper.getNode('h');
            helperNode.on('input', function (msg) {
                try {
                    assert.deepStrictEqual(readDelimited(msg.payload), [
                        { color: 'GREEN', data: '+/8=', big: '42', text: 'first' },
                        { color: 'GREEN', data: 'AQI=', big: '7', count: 2 }
                    ]);
                    done();
                }
                catch (error) {
                    done(error);
                }
            });
            helper.getNode('n').receive({
                payload: [
                    { color: 'GREEN', data: '-_8', big: '42', text: 'first' },
                    { color: 'GREEN', data: 'AQI', big: '7', count: 2 }
                ]
            });
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

    it('reports delimited invalid payloads as errors with the failing index', function (done) {
        helper.load([encode, protofile], encodeFlow({
            delimited: true,
            validationFailure: 'error'
        }), function () {
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
                    assert.match(String(call.args[0]), /Message at index 1 is not valid/);
                    done();
                }
                catch (error) {
                    done(error);
                }
            });
            encodeNode.receive({ payload: [{ data: Buffer.from([1]) }, 'invalid payload'] });
        });
    });

    it('reports fromObject conversion failures as errors when configured', function (done) {
        helper.load([encode, protofile], encodeFlow({
            inputConversion: 'fromObject',
            validationFailure: 'error'
        }), function () {
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
                    assert.match(String(call.args[0]), /labels: object expected/);
                    done();
                }
                catch (error) {
                    done(error);
                }
            });
            encodeNode.receive({ payload: { labels: 'invalid map' } });
        });
    });
});
