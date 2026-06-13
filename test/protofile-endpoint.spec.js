const assert = require('node:assert');
var protofile = require('../src/nodes/protofile');

function createTypesEndpoint () {
    var handler;
    var RED = {
        nodes: {
            createNode: function () {},
            registerType: function () {}
        },
        httpAdmin: {
            post: function (path, middleware, routeHandler) {
                assert.strictEqual(path, '/protobuf-file/types');
                assert.strictEqual(typeof middleware, 'function');
                assert.strictEqual(typeof routeHandler, 'function');
                handler = routeHandler;
            }
        },
        auth: {
            needsPermission: function (permission) {
                assert.strictEqual(permission, 'flows.write');
                return function (req, res, next) { next(); };
            }
        },
        library: {
            register: function () {}
        }
    };

    protofile(RED);
    assert.strictEqual(typeof handler, 'function');
    return handler;
}

describe('protobuf-file types admin endpoint', function () {
    var typesEndpoint;

    before(function () {
        typesEndpoint = createTypesEndpoint();
    });

    function postTypes (body) {
        var result;
        var res = {
            statusCode: 200,
            status: function (statusCode) {
                res.statusCode = statusCode;
                return res;
            },
            json: function (payload) {
                result = { statusCode: res.statusCode, body: payload };
            }
        };

        typesEndpoint({ body: body }, res);
        return result;
    }

    it('should list the message types for a single proto file', function () {
        var res = postTypes({ protopath: 'test/assets/test.proto' });
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.body.ok, true);
        assert.ok(res.body.types.includes('TestType'));
    });

    it('should list types from every file when multiple paths are given', function () {
        var res = postTypes({ protopath: 'test/assets/test.proto,test/assets/issue3.proto' });
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.body.ok, true);
        assert.ok(res.body.types.includes('TestType'));
        assert.ok(res.body.types.includes('Viessmann'));
    });

    it('should resolve imports and include nested types for a chained schema', function () {
        var res = postTypes({ protopath: 'examples/protos/sensor.proto' });
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.body.ok, true);
        assert.deepStrictEqual(res.body.types, ['Header', 'Location', 'SensorReport']);
    });

    it('should report a load error for a missing file without throwing', function () {
        var res = postTypes({ protopath: 'test/assets/does-not-exist.proto' });
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.body.ok, false);
        assert.strictEqual(typeof res.body.error, 'string');
    });

    it('should not enumerate directories (a directory path is just a load error)', function () {
        var res = postTypes({ protopath: 'test/assets' });
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.body.ok, false);
        assert.strictEqual(res.body.items, undefined, 'endpoint must never return a directory listing');
        assert.strictEqual(res.body.types, undefined);
    });

    it('should list types from inline protobuf content', function () {
        var res = postTypes({ sourceType: 'inline', protocontent: 'syntax = "proto3"; message Bar { bool b = 1; }' });
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.body.ok, true);
        assert.ok(res.body.types.includes('Bar'));
    });

    it('should report an error for empty inline content', function () {
        var res = postTypes({ sourceType: 'inline', protocontent: '' });
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.body.ok, false);
        assert.strictEqual(typeof res.body.error, 'string');
    });

    it('should reject an empty proto path', function () {
        var res = postTypes({ protopath: '' });
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.body.ok, false);
        assert.match(res.body.error, /path/i);
    });
});
