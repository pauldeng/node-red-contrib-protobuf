const assert = require('node:assert');
var helper = require('node-red-node-test-helper');
var protofile = require('../src/nodes/protofile');

helper.init(require.resolve('node-red'));

// The admin endpoint is registered when the protobuf-file node module loads.
// helper.request() is a supertest instance bound to the helper's httpAdmin app.
describe('protobuf-file types admin endpoint', function () {

    before(function (done) {
        helper.load(protofile, [{ id: 'n1', type: 'protobuf-file', name: 'endpoint', protopath: 'test/assets/test.proto' }], function () {
            done();
        });
    });

    after(function () {
        helper.unload();
    });

    function postTypes (body) {
        return helper.request()
            .post('/protobuf-file/types')
            .send(body)
            .set('Content-Type', 'application/json');
    }

    it('should list the message types for a single proto file', function (done) {
        postTypes({ protopath: 'test/assets/test.proto' })
            .expect(200)
            .end(function (error, res) {
                if (error) return done(error);
                try {
                    assert.strictEqual(res.body.ok, true);
                    assert.ok(res.body.types.includes('TestType'));
                    done();
                }
                catch (assertion) {
                    done(assertion);
                }
            });
    });

    it('should list types from every file when multiple paths are given', function (done) {
        postTypes({ protopath: 'test/assets/test.proto,test/assets/issue3.proto' })
            .expect(200)
            .end(function (error, res) {
                if (error) return done(error);
                try {
                    assert.strictEqual(res.body.ok, true);
                    assert.ok(res.body.types.includes('TestType'));
                    assert.ok(res.body.types.includes('Viessmann'));
                    done();
                }
                catch (assertion) {
                    done(assertion);
                }
            });
    });

    it('should resolve imports and include nested types for a chained schema', function (done) {
        postTypes({ protopath: 'examples/protos/sensor.proto' })
            .expect(200)
            .end(function (error, res) {
                if (error) return done(error);
                try {
                    assert.strictEqual(res.body.ok, true);
                    assert.deepStrictEqual(res.body.types, ['Header', 'Location', 'SensorReport']);
                    done();
                }
                catch (assertion) {
                    done(assertion);
                }
            });
    });

    it('should report a load error for a missing file without throwing', function (done) {
        postTypes({ protopath: 'test/assets/does-not-exist.proto' })
            .expect(200)
            .end(function (error, res) {
                if (error) return done(error);
                try {
                    assert.strictEqual(res.body.ok, false);
                    assert.strictEqual(typeof res.body.error, 'string');
                    done();
                }
                catch (assertion) {
                    done(assertion);
                }
            });
    });

    it('should not enumerate directories (a directory path is just a load error)', function (done) {
        postTypes({ protopath: 'test/assets' })
            .expect(200)
            .end(function (error, res) {
                if (error) return done(error);
                try {
                    assert.strictEqual(res.body.ok, false);
                    assert.strictEqual(res.body.items, undefined, 'endpoint must never return a directory listing');
                    assert.strictEqual(res.body.types, undefined);
                    done();
                }
                catch (assertion) {
                    done(assertion);
                }
            });
    });

    it('should reject an empty proto path', function (done) {
        postTypes({ protopath: '' })
            .expect(200)
            .end(function (error, res) {
                if (error) return done(error);
                try {
                    assert.strictEqual(res.body.ok, false);
                    assert.match(res.body.error, /path/i);
                    done();
                }
                catch (assertion) {
                    done(assertion);
                }
            });
    });
});
