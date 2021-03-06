protobufjs = require("protobufjs");

module.exports = function(RED) {
  function ProtobufDecodeNode(config) {
    RED.nodes.createNode(this, config);
    // Retrieve the config node
    this.protofile = RED.nodes.getNode(config.protofile);
    this.protoType = config.protoType;
    var node = this;

    let resolveMessageType = function(msg) {
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
      return messageType;
    };

    node.on("input", function(msg) {
      let messageType = resolveMessageType(msg);
      if (!messageType) return;
      let message;
      try {
        message = messageType.decode(msg.payload);
      } catch (exception) {
        if (exception instanceof protobufjs.util.ProtocolError) {
          node.warn(
            "Received message contains empty fields. Uncomplete message will be forwarded."
          );
          msg.payload = e.instance;
          node.send(msg);
        } else {
          //node.log(msg.payload.toString("hex"));
          return node.error("Wire format is invalid: " + JSON.stringify(msg));
        }
      }
      let decodeoptions = {
        longs: String,
        enums: String,
        bytes: String,
        defaults: false // includes default values, otherwise not transmitted values will be assigned their default value!
      };
      msg.payload = messageType.toObject(message, decodeoptions);
      node.send(msg);
    });
  }
  RED.nodes.registerType("decode", ProtobufDecodeNode);
};
