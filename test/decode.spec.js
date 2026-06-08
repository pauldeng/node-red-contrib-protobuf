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

});
