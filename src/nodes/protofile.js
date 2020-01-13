protobufjs = require("protobufjs");
fs = require("fs");

module.exports = function(RED) {
  function ProtoFileNode(config) {
    RED.nodes.createNode(this, config);
    this.protopath = config.protopath;
    protoFileNode = this;
    let load = function() {
      try {
        protoFileNode.prototypes = protobufjs.loadSync(config.protopath);
      } catch (error) {
        protoFileNode.error("Proto file could not be loaded. " + error);
      }
    };

    load();

    if (protoFileNode.prototypes === undefined) return;

    try {
      protoFileNode.protoFileWatcher = fs.watch(config.protopath, eventType => {
        if (eventType === "change") {
          load();
          protoFileNode.warn("Protobuf file changed on disk. Reloaded.");
        }
      });
      protoFileNode.on("close", () => {
        protoFileNode.protoFileWatcher.close();
      });
    } catch (error) {
      protoFileNode.error(
        "Error when trying to watch the file on disk: " + error
      );
    }
  }
  RED.nodes.registerType("protobuf-file", ProtoFileNode);
};
