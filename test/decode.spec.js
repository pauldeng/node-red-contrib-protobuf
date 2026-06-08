const assert = require('node:assert');
var helper = require('node-red-node-test-helper');
var decode = require('../src/nodes/decode');
var protofile = require('../src/nodes/protofile');

helper.init(require.resolve('node-red'));

describe('protobuf decode node', function () {

  afterEach(function () {
    helper.unload();
  });

  it('should be loaded', function (done) {
    var flow = [{ id: 'n1', type: 'decode', name: 'test name' }];
    helper.load(decode, flow, function () {
      var n1 = helper.getNode('n1');
      assert.strictEqual(n1.name, 'test name');
      done();
    });
  });

  it('should report a clear error when no protofile config node is configured', function (done) {
    var flow = [{
      id: 'decode-node',
      type: 'decode',
      z: 'e4c459b3.cc22e8',
      protoType: 'TestType',
      wires: [[]]
    }];

    helper.load(decode, flow, function () {
      var decodeNode = helper.getNode('decode-node');

      decodeNode.on('call:error', function (call) {
        try {
          assert.match(String(call.args[0]), /No \.proto file configured/);
          done();
        }
        catch (error) {
          done(error);
        }
      });

      decodeNode.receive({
        payload: Buffer.from([0xff]),
        protobufType: 'TestType'
      });
    });
  });

  it('should report invalid wire format as a node error', function (done) {
    var flow = [{
        id: 'decode-node',
        type: 'decode',
        z: 'e4c459b3.cc22e8',
        protofile: 'proto-node',
        protoType: 'TestType',
        wires: [[]]
      },
      {
        id: 'proto-node',
        type: 'protobuf-file',
        z: '',
        protopath: 'test/assets/test.proto'
      }];

    helper.load([decode, protofile], flow, function () {
      var decodeNode = helper.getNode('decode-node');

      decodeNode.on('call:error', function (call) {
        try {
          assert.match(String(call.args[0]), /Wire format is invalid/);
          done();
        }
        catch (error) {
          done(error);
        }
      });

      decodeNode.receive({
        payload: Buffer.from([0xff])
      });
    });
  });

  it('should forward partially decoded proto2 payloads when required fields are missing', function (done) {
    var flow = [{
        id: 'decode-node',
        type: 'decode',
        z: 'e4c459b3.cc22e8',
        protofile: 'proto-node',
        protoType: 'Proto2Type',
        wires: [['helper-node']]
      },
      {
        id: 'helper-node',
        type: 'helper',
        z: 'e4c459b3.cc22e8',
        wires: [[]]
      },
      {
        id: 'proto-node',
        type: 'protobuf-file',
        z: '',
        protopath: 'test/assets/proto2.proto'
      }];

    helper.load([decode, protofile], flow, function () {
      var decodeNode = helper.getNode('decode-node');
      var helperNode = helper.getNode('helper-node');

      helperNode.on('input', function (msg) {
        try {
          assert.deepStrictEqual(msg.payload, { note: 'partial only' });
          done();
        }
        catch (error) {
          done(error);
        }
      });

      decodeNode.receive({
        payload: Buffer.from([18, 12, 112, 97, 114, 116, 105, 97, 108, 32, 111, 110, 108, 121])
      });
    });
  });

  it('should warn when the protobuf type is unknown', function (done) {
    var flow = [{
        id: 'decode-node',
        type: 'decode',
        z: 'e4c459b3.cc22e8',
        protofile: 'proto-node',
        protoType: 'MissingType',
        wires: [[]]
      },
      {
        id: 'proto-node',
        type: 'protobuf-file',
        z: '',
        protopath: 'test/assets/test.proto'
      }];

    helper.load([decode, protofile], flow, function () {
      var decodeNode = helper.getNode('decode-node');

      decodeNode.on('call:warn', function (call) {
        try {
          assert.match(String(call.args[0]), /Problem while looking up the message type/);
          done();
        }
        catch (error) {
          done(error);
        }
      });

      decodeNode.receive({
        payload: Buffer.from([])
      });
    });
  });

  it('should report an error when the configured proto file did not load', function (done) {
    var flow = [{
        id: 'decode-node',
        type: 'decode',
        z: 'e4c459b3.cc22e8',
        protofile: 'proto-node',
        protoType: 'TestType',
        wires: [[]]
      },
      {
        id: 'proto-node',
        type: 'protobuf-file',
        z: '',
        protopath: 'test/assets/missing.proto'
      }];

    helper.load([decode, protofile], flow, function () {
      var decodeNode = helper.getNode('decode-node');

      decodeNode.on('call:error', function (call) {
        try {
          assert.match(String(call.args[0]), /No \.proto types loaded/);
          done();
        }
        catch (error) {
          done(error);
        }
      });

      decodeNode.receive({
        payload: Buffer.from([])
      });
    });
  });

});
