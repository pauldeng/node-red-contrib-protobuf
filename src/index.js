const registerEncodeNode = require('./nodes/encode');
const registerDecodeNode = require('./nodes/decode');
const registerProtofileNode = require('./nodes/protofile');

module.exports = function (RED) {
    registerProtofileNode(RED);
    registerEncodeNode(RED);
    registerDecodeNode(RED);
};
