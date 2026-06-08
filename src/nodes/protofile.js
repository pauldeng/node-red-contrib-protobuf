const { Root } = require('protobufjs');
const fs = require('fs');

module.exports = function (RED) {
    function ProtoFileNode (config) {
        RED.nodes.createNode(this, config);
        const configuredPath = config.protopath || '';
        if (configuredPath.includes(',')) {
            this.protopath = configuredPath.split(',');
        }
        else {
            this.protopath = configuredPath;
        }
        this.watchFile = config.watchFile !== false;
        this.keepCase = config.keepCase;
        const protoFileNode = this;

        protoFileNode.load = function () {
            try {
                protoFileNode.protoTypes = new Root().loadSync(protoFileNode.protopath, { keepCase: protoFileNode.keepCase });
            }
            catch (error) {
                protoFileNode.error('Proto file could not be loaded. ' + error);
            }
        };
        protoFileNode.watchProtopath = function () {
            try {
                // if it's an array, just watch the first one, it's most likely the one likely to change.
                // As the subsequent files are more likely dependencies on the root.
                let watchedFile = protoFileNode.protopath;
                if (Array.isArray(watchedFile)) {
                    watchedFile = watchedFile[0];
                }
                protoFileNode.protoFileWatcher = fs.watch(watchedFile, (eventType) => {
                    if (eventType === 'change') {
                        protoFileNode.load();
                        protoFileNode.log('Protobuf file changed on disk. Reloaded.');
                    }
                });
                protoFileNode.on('close', () => {
                    if (protoFileNode.protoFileWatcher) {
                        protoFileNode.protoFileWatcher.close();
                    }
                });
            }
            catch (error) {
                protoFileNode.error('Error when trying to watch the file on disk: ' + error);
            }
        };
        protoFileNode.load();
        if (protoFileNode.protoTypes !== undefined && protoFileNode.watchFile) protoFileNode.watchProtopath();
    }
    RED.nodes.registerType('protobuf-file', ProtoFileNode);
};
