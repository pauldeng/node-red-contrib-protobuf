module.exports = function(RED) {
  function ProtobufEncodeNode(config) {
    RED.nodes.createNode(this, config);
    // Retrieve the config node
    this.protofile = RED.nodes.getNode(config.protofile);
    this.protoType = config.protoType;
    var node = this;
    node.on("input", function(msg) {
      if (!msg.protobufType) {
        if (!node.protoType) return node.error("No protobuf type supplied!");
        msg.protobufType = node.protoType;
      }
      if (node.protofile.prototypes === undefined) {
        return node.error(
          "No .proto types loaded! Check that the file exists and that node-red has permission to access it."
        );
      }
      let messageType;
      try {
        messageType = node.protofile.prototypes.lookupType(msg.protobufType);
      } catch (error) {
        return node.error(`
Problem while looking up the message type.
${error}
Protofile object:
${node.protofile.protopath}
Prototypes content:
${JSON.stringify(node.protofile.prototypes)}
With configured protoType:
${msg.protobufType}
                `);
      }
      // check if msg.payload is a valid message under respective
      // selected protobuf message type
      let result = messageType.verify(msg.payload);
      if (result) {
        return node.error(
          "Message is not valid under selected message type. " + result
        );
      }
      // create a protobuf message and convert it into a buffer
      msg.payload = messageType
        .encode(messageType.create(msg.payload))
        .finish();
      node.send(msg);
    });
  }
  RED.nodes.registerType("encode", ProtobufEncodeNode);
};
