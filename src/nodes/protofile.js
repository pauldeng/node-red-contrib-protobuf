const protobufjs = require('protobufjs');
const { Root } = protobufjs;
const fs = require('fs');

// Split a comma-separated proto path into the array protobuf.js expects,
// or pass a single path (or already-split array) straight through.
function splitProtopath (protopath) {
    if (Array.isArray(protopath)) {
        return protopath;
    }
    return protopath.includes(',') ? protopath.split(',').map((part) => part.trim()) : protopath;
}

// Load one or more proto files into a protobuf.js Root. Shared by the
// runtime node and the validate endpoint so they never load differently.
function loadProtoRoot (protopath, keepCase) {
    return new Root().loadSync(splitProtopath(protopath), { keepCase: keepCase === true });
}

// Collect the fully-qualified names of every message type in a root,
// including types nested inside other messages.
function collectTypeNames (root) {
    const names = [];
    (function walk (namespace) {
        (namespace.nestedArray || []).forEach((child) => {
            if (child instanceof protobufjs.Type) {
                names.push(child.fullName.replace(/^\./, ''));
            }
            if (child.nestedArray) {
                walk(child);
            }
        });
    })(root);
    return names.sort();
}

module.exports = function (RED) {
    // Validate a proto path and return its message type names. Gated at
    // flows.write so it grants no capability a deploy-capable user lacks,
    // and it only loads the supplied path - it never lists directories.
    RED.httpAdmin.post('/protobuf-file/types', RED.auth.needsPermission('flows.write'), function (req, res) {
        const protopath = ((req.body && req.body.protopath) || '').trim();
        if (!protopath) {
            res.json({ ok: false, error: 'No proto path supplied.' });
            return;
        }
        try {
            res.json({ ok: true, types: collectTypeNames(loadProtoRoot(protopath, req.body.keepCase)) });
        }
        catch (error) {
            res.json({ ok: false, error: ('Proto file could not be loaded. ' + (error.message || error)).slice(0, 500) });
        }
    });

    function ProtoFileNode (config) {
        RED.nodes.createNode(this, config);
        this.protopath = splitProtopath(config.protopath || '');
        this.watchFile = config.watchFile !== false;
        this.keepCase = config.keepCase;
        const protoFileNode = this;

        protoFileNode.load = function () {
            try {
                protoFileNode.protoTypes = loadProtoRoot(protoFileNode.protopath, protoFileNode.keepCase);
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
