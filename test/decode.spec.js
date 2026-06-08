const assert = require('node:assert');
var helper = require('node-red-node-test-helper');
var decode = require('../src/nodes/decode');

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

});
