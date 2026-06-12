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
      }, 200);
    });
  });

  it('should reload when any configured file changes', function (done) {
    var tmpDir = fs.mkdtempSync('/tmp/node-red-protobuf-watch-');
    var firstProto = `${tmpDir}/first.proto`;
    var secondProto = `${tmpDir}/second.proto`;
    var flow = [{ id: 'n1', type: 'protobuf-file', name: 'test name', protopath: `${firstProto},${secondProto}` }];

    fs.copyFileSync('test/assets/test.proto', firstProto);
    fs.copyFileSync('test/assets/issue3.proto', secondProto);

    const finish = function (error) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      done(error);
    };

    helper.load(protofile, flow, function () {
      var n1 = helper.getNode('n1');

      try {
        assert.strictEqual(n1.protoFileWatchers.length, 2, 'every configured file should have a watcher');
      }
      catch (error) {
        return finish(error);
      }

      fs.copyFileSync('test/assets/complex.proto', secondProto);

      setTimeout(() => {
        try {
          assert.strictEqual(typeof n1.protoTypes.TestType, 'object');
          assert.strictEqual(typeof n1.protoTypes.Zaehler_Waerme, 'object', 'a change to the second file should trigger a reload');
          assert.strictEqual(n1.protoTypes.Viessmann, undefined);

          fs.copyFileSync('test/assets/proto2.proto', firstProto);

          setTimeout(() => {
            try {
              assert.strictEqual(typeof n1.protoTypes.Proto2Type, 'object', 'a change to the first file should trigger a reload');
              assert.strictEqual(n1.protoTypes.TestType, undefined);
              assert.strictEqual(typeof n1.protoTypes.Zaehler_Waerme, 'object');
              finish();
            }
            catch (error) {
              finish(error);
            }
          }, 250);
        }
        catch (error) {
          finish(error);
        }
      }, 250);
    });
  });

  it('should resolve imported proto files when only the root file is configured', function (done) {
    var flow = [{ id: 'n1', type: 'protobuf-file', name: 'test name', protopath: 'examples/protos/sensor.proto' }];
    helper.load(protofile, flow, function () {
      var n1 = helper.getNode('n1');
      try {
        assert.strictEqual(typeof n1.protoTypes.SensorReport, 'object');
        assert.strictEqual(typeof n1.protoTypes.Header, 'object', 'imported common.proto types should be loaded');
        assert.strictEqual(typeof n1.protoTypes.Location, 'object', 'imported location.proto types should be loaded');
        done();
      }
      catch (error) {
        done(error);
      }
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
        assert.strictEqual(n1.protoFileWatchers, undefined);
        done();
      }
      catch (error) {
        done(error);
      }
    });
  });

});
