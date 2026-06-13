// Review addition: verifies the new encode/decode options interoperate end to
// end (the existing specs exercise each node in isolation, not together).
const assert = require('node:assert');
var helper = require('node-red-node-test-helper');
var encode = require('../src/nodes/encode');
var decode = require('../src/nodes/decode');
var protofile = require('../src/nodes/protofile');

helper.init(require.resolve('node-red'));

function flow (encodeOptions, decodeOptions) {
    return [
        Object.assign({ id: 'enc', type: 'encode', z: 'f', protofile: 'pf', protoType: 'OptionsType', wires: [['dec']] }, encodeOptions),
        Object.assign({ id: 'dec', type: 'decode', z: 'f', protofile: 'pf', protoType: 'OptionsType', wires: [['h']] }, decodeOptions),
        { id: 'h', type: 'helper', z: 'f', wires: [[]] },
        { id: 'pf', type: 'protobuf-file', z: '', protopath: 'test/assets/options.proto' }
    ];
}

describe('encode/decode options round trip', function () {

    afterEach(function () {
        return helper.unload();
    });

    it('round trips base64url bytes through encode and decode', function (done) {
        const input = { color: 'GREEN', big: '42', text: 'hi', data: '-_8' };
        helper.load([encode, decode, protofile], flow(
            { inputConversion: 'fromObject', inputBytesType: 'Base64Url' },
            { bytesType: 'Base64Url' }
        ), function () {
            helper.getNode('h').on('input', function (msg) {
                try {
                    assert.deepStrictEqual(msg.payload, input);
                    done();
                }
                catch (error) {
                    done(error);
                }
            });
            helper.getNode('enc').receive({ payload: input });
        });
    });

    it('round trips a plain message with default (pre-options) settings', function (done) {
        // No options set on either node => historical strict-encode / string-decode behavior.
        helper.load([encode, decode, protofile], flow({}, {}), function () {
            helper.getNode('h').on('input', function (msg) {
                try {
                    // numeric enum in, string enum out (default enums: String); long as string.
                    assert.deepStrictEqual(msg.payload, { color: 'GREEN', big: '42', text: 'hi' });
                    done();
                }
                catch (error) {
                    done(error);
                }
            });
            helper.getNode('enc').receive({ payload: { color: 1, big: 42, text: 'hi' } });
        });
    });
});
