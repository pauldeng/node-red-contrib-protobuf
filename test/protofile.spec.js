const assert = require('node:assert');
var helper = require('node-red-node-test-helper');
var protofile = require('../src/nodes/protofile');
var fs = require('fs');

helper.init(require.resolve('node-red'));

describe('protobuf protofile node', function () {

  afterEach(function () {
    helper.unload();
  });

  it('test.proto should be loadable', function (done) {
    fs.access('test/assets/test.proto', (error) => {
        if (!error) done();
    });
  });

  it('should be loaded', function (done) {
    var flow = [{ id: 'n1', type: 'protobuf-file', name: 'test name', protopath: 'test/assets/test.proto' }];
    helper.load(protofile, flow, function () {
      var n1 = helper.getNode('n1');
      assert.strictEqual(n1.name, 'test name');
      assert.strictEqual(n1.protopath, 'test/assets/test.proto');
      assert.strictEqual(typeof n1.protoTypes, 'object');
      done();
    });
  });

  it('should reload on file change', function (done) {
    fs.copyFileSync('test/assets/test.proto', '/tmp/test.proto');
    var flow = [{ id: 'n1', type: 'protobuf-file', name: 'test name', protopath: '/tmp/test.proto' }];
    helper.load(protofile, flow, function () {
      fs.copyFileSync('test/assets/complex.proto', '/tmp/test.proto');
      let n1 = helper.getNode('n1');
      setTimeout(() => {
        assert.strictEqual(typeof n1.protoTypes.Zaehler_Waerme, 'object');
        done();
      }, 25);
    });
  });

  it('should load multiple files', function (done) {
    var flow = [{ id: 'n1', type: 'protobuf-file', name: 'test name', protopath: 'test/assets/test.proto,test/assets/issue3.proto' }];
    helper.load(protofile, flow, function () {
      var n1 = helper.getNode('n1');
      if (!Array.isArray(n1['protopath'])) return done(Error("protopath does not contain multiple files"))
      if (n1['protoTypes']['TestType'] === undefined || n1['protoTypes']['Viessmann'] === undefined) return done(Error('not all types loaded'))
      done()
    });
  });

  it('should keep each config node load state isolated', function (done) {
    var flow = [
      { id: 'n1', type: 'protobuf-file', name: 'test one', protopath: 'test/assets/test.proto' },
      { id: 'n2', type: 'protobuf-file', name: 'test two', protopath: 'test/assets/issue3.proto' }
    ];

    helper.load(protofile, flow, function () {
      var n1 = helper.getNode('n1');
      n1.protopath = 'test/assets/issue3.proto';
      n1.protoTypes = undefined;
      n1.load();

      try {
        assert.strictEqual(typeof n1.protoTypes.Viessmann, 'object');
        done();
      }
      catch (error) {
        done(error);
      }
    });
  });

  it('should not watch file changes when watchFile is false', function (done) {
    var flow = [{ id: 'n1', type: 'protobuf-file', name: 'test name', protopath: 'test/assets/test.proto', watchFile: false }];

    helper.load(protofile, flow, function () {
      var n1 = helper.getNode('n1');

      try {
        assert.strictEqual(n1.watchFile, false);
        assert.strictEqual(n1.protoFileWatcher, undefined);
        done();
      }
      catch (error) {
        done(error);
      }
    });
  });

});
