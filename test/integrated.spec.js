const assert = require('node:assert');
var helper = require('node-red-node-test-helper');
var encode = require('../src/nodes/encode');
var decode = require('../src/nodes/decode');
var protofile = require('../src/nodes/protofile');

helper.init(require.resolve('node-red'));

const generateIntegratedFlow = function(protoFilePath, protoType, keepCase) {
    return [
        {
            'id': 'encode-node',
            'type': 'encode',
            'z': 'e4c459b3.cc22e8',
            'name': '',
            'protofile': 'c55e9eb5.3175',
            'protoType': protoType,
            'wires': [
                [
                    'decode-node'
                ]
            ]
        },
        {
            'id': 'decode-node',
            'type': 'decode',
            'z': 'e4c459b3.cc22e8',
            'name': '',
            'protofile': 'c55e9eb5.3175',
            'protoType': protoType,
            'wires': [
                [
                    'helper-node'
                ]
            ]
        },
        {
            'id': 'helper-node',
            'type': 'helper',
            'z': 'e4c459b3.cc22e8',
            'name': '',
            'outputs': 1,
            'noerr': 0,
            'wires': [
                []
            ]
        },
        {
            'id': 'c55e9eb5.3175',
            'type': 'protobuf-file',
            'z': '',
            'protopath': protoFilePath,
            'keepCase': keepCase || false
        }
    ];
};

describe('protobuf integration test', function () {

    afterEach(function () {
        helper.unload();
    });

    it('should encode and decode a message with idempotence', function (done) {
        helper.load([encode, decode, protofile], generateIntegratedFlow('test/assets/test.proto', 'TestType'), function () {
            let testMessage = {
                timestamp: 1533295590569,
                foo: 1.0,
                bar: true,
                test: 'A string value',
                noMoreSnakeCase: true 
            };
            var encodeNode = helper.getNode('encode-node');
            var helperNode = helper.getNode('helper-node');
            helperNode.on('input', function (msg) {
                try {
                    assert.deepStrictEqual(msg.payload, testMessage);
                    done();
                }
                catch (error) {
                    done(error);
                }
            });
            encodeNode.receive({
                payload: testMessage
            });
        });
    });

    it('should encode and decode a message with underscores in field names', function (done) {
        helper.load([encode, decode, protofile], generateIntegratedFlow('test/assets/issue29.proto', 'Department', true), function () {
            let testMessage = {
                department_id: 12345,
                name: 'Test department'
            };
            var encodeNode = helper.getNode('encode-node');
            var helperNode = helper.getNode('helper-node');
            helperNode.on('input', function (msg) {
                try {
                    assert.deepStrictEqual(msg.payload, testMessage);
                    done();
                }
                catch (error) {
                    done(error);
                }
            });
            encodeNode.receive({
                payload: testMessage
            });
        });
    });

    it('should encode and decode camelCase field names when keepCase is false', function (done) {
        helper.load([encode, decode, protofile], generateIntegratedFlow('test/assets/issue29.proto', 'Department', false), function () {
            let testMessage = {
                departmentId: 12345,
                name: 'Test department'
            };
            var encodeNode = helper.getNode('encode-node');
            var helperNode = helper.getNode('helper-node');
            helperNode.on('input', function (msg) {
                try {
                    assert.deepStrictEqual(msg.payload, testMessage);
                    done();
                }
                catch (error) {
                    done(error);
                }
            });
            encodeNode.receive({
                payload: testMessage
            });
        });
    });

    it('should encode and decode a proto2 message with required, optional, and defaulted fields', function (done) {
        helper.load([encode, decode, protofile], generateIntegratedFlow('test/assets/proto2.proto', 'Proto2Type'), function () {
            let testMessage = {
                name: 'proto2 message',
                note: 'explicit note',
                count: 7,
                tags: ['required', 'optional', 'defaulted']
            };
            var encodeNode = helper.getNode('encode-node');
            var helperNode = helper.getNode('helper-node');
            helperNode.on('input', function (msg) {
                try {
                    assert.deepStrictEqual(msg.payload, testMessage);
                    done();
                }
                catch (error) {
                    done(error);
                }
            });
            encodeNode.receive({
                payload: testMessage
            });
        });
    });

    it('should encode and decode an edition 2023 message', function (done) {
        helper.load([encode, decode, protofile], generateIntegratedFlow('test/assets/edition2023.proto', 'Edition2023Type'), function () {
            let testMessage = {
                name: 'edition 2023 message',
                count: 2023,
                tags: ['edition', '2023']
            };
            var encodeNode = helper.getNode('encode-node');
            var helperNode = helper.getNode('helper-node');
            helperNode.on('input', function (msg) {
                try {
                    assert.deepStrictEqual(msg.payload, testMessage);
                    done();
                }
                catch (error) {
                    done(error);
                }
            });
            encodeNode.receive({
                payload: testMessage
            });
        });
    });

    it('should encode and decode an edition 2024 message', function (done) {
        helper.load([encode, decode, protofile], generateIntegratedFlow('test/assets/edition2024.proto', 'Edition2024Type'), function () {
            let testMessage = {
                name: 'edition 2024 message',
                count: 2024,
                tags: ['edition', '2024']
            };
            var encodeNode = helper.getNode('encode-node');
            var helperNode = helper.getNode('helper-node');
            helperNode.on('input', function (msg) {
                try {
                    assert.deepStrictEqual(msg.payload, testMessage);
                    done();
                }
                catch (error) {
                    done(error);
                }
            });
            encodeNode.receive({
                payload: testMessage
            });
        });
    });

    it('should encode and decode using an inline protobuf definition', function (done) {
        var flow = [
            { id: 'encode-node', type: 'encode', z: 'e4c459b3.cc22e8', protofile: 'c55e9eb5.3175', protoType: 'InlineType', wires: [['decode-node']] },
            { id: 'decode-node', type: 'decode', z: 'e4c459b3.cc22e8', protofile: 'c55e9eb5.3175', protoType: 'InlineType', wires: [['helper-node']] },
            { id: 'helper-node', type: 'helper', z: 'e4c459b3.cc22e8', wires: [[]] },
            { id: 'c55e9eb5.3175', type: 'protobuf-file', z: '', sourceType: 'inline', protocontent: 'syntax = "proto3"; message InlineType { string label = 1; int32 count = 2; }' }
        ];
        helper.load([encode, decode, protofile], flow, function () {
            let testMessage = { label: 'inline round trip', count: 3 };
            var encodeNode = helper.getNode('encode-node');
            var helperNode = helper.getNode('helper-node');
            helperNode.on('input', function (msg) {
                try {
                    assert.deepStrictEqual(msg.payload, testMessage);
                    done();
                }
                catch (error) {
                    done(error);
                }
            });
            encodeNode.receive({ payload: testMessage });
        });
    });

});
