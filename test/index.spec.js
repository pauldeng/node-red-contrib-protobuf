const assert = require('node:assert');

describe('package entrypoint', function () {
  it('should register all Node-RED node types', function () {
    delete require.cache[require.resolve('../src/index')];

    const register = require('../src/index');
    const registeredTypes = [];
    const RED = {
      nodes: {
        registerType: function (type) {
          registeredTypes.push(type);
        }
      },
      httpAdmin: {
        post: function () {}
      },
      auth: {
        needsPermission: function () {
          return function (req, res, next) { next(); };
        }
      }
    };

    register(RED);

    assert.deepStrictEqual(registeredTypes.sort(), ['decode', 'encode', 'protobuf-file']);
  });
});
