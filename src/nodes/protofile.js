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
            const watchedFiles = Array.isArray(protoFileNode.protopath) ? protoFileNode.protopath : [protoFileNode.protopath];
            // Editors and fs.watch can fire several change events per save,
            // so changes are batched into a single reload of all files.
            let reloadTimer = null;
            const scheduleReload = function () {
                clearTimeout(reloadTimer);
                reloadTimer = setTimeout(() => {
                    protoFileNode.load();
                    protoFileNode.log('Protobuf file changed on disk. Reloaded.');
                }, 50);
            };
            protoFileNode.protoFileWatchers = [];
            for (const watchedFile of watchedFiles) {
                try {
                    protoFileNode.protoFileWatchers.push(fs.watch(watchedFile, (eventType) => {
                        if (eventType === 'change') {
                            scheduleReload();
                        }
                    }));
                }
                catch (error) {
                    protoFileNode.error(`Error when trying to watch ${watchedFile} on disk: ` + error);
                }
            }
            protoFileNode.on('close', () => {
                clearTimeout(reloadTimer);
                protoFileNode.protoFileWatchers.forEach((watcher) => watcher.close());
                protoFileNode.protoFileWatchers = [];
            });
        };
        protoFileNode.load();
        if (protoFileNode.protoTypes !== undefined && protoFileNode.watchFile) protoFileNode.watchProtopath();
    }
    RED.nodes.registerType('protobuf-file', ProtoFileNode);
};
