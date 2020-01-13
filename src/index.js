protobufencode = require("nodes/encode");
protobufdecode = require("nodes/decode");
protobuffile = require("nodes/protofile");

module.exports = function(RED) {
  RED.nodes.registerType("protobuf-file", protobuffile.ProtoFileNode);
  RED.nodes.registerType("encode", protobufencode.ProtobufEncodeNode);
  RED.nodes.registerType("decode", protobufdecode.ProtobufDecodeNode);
};
