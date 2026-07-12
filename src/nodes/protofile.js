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

// Load one or more proto files into a protobuf.js Root.
function loadProtoRoot (protopath, keepCase) {
    return new Root().loadSync(splitProtopath(protopath), { keepCase: keepCase === true });
}

// Parse an inline protobuf definition string into a Root. Inline schemas
// are self-contained: protobuf.js cannot resolve `import` from text.
function parseProtoContent (content, keepCase) {
    const source = (content || '').trim();
    if (!source) {
        throw new Error('No inline protobuf definition.');
    }
    return protobufjs.parse(source, { keepCase: keepCase === true }).root;
}

// Load the proto types from either a file path or inline content. Shared by
// the runtime node and the validate endpoint so they never load differently.
function loadProtoTypes (opts) {
    if (opts.sourceType === 'inline') {
        return parseProtoContent(opts.protocontent, opts.keepCase);
    }
    return loadProtoRoot(opts.protopath, opts.keepCase);
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
    // Library collection that stores inline .proto definitions saved from
    // the editor (Save/Open buttons next to the inline editor).
    RED.library.register('protobuf');

    // Validate a proto source and return its message type names. Gated at
    // flows.write so it grants no capability a deploy-capable user lacks,
    // and it only loads the supplied path or inline content - it never
    // lists directories.
    RED.httpAdmin.post('/protobuf-file/types', RED.auth.needsPermission('flows.write'), function (req, res) {
        const body = req.body || {};
        const sourceType = body.sourceType || 'file';
        if (sourceType !== 'inline' && !((body.protopath || '').trim())) {
            res.json({ ok: false, error: 'No proto path supplied.' });
            return;
        }
        try {
            const root = loadProtoTypes({
                sourceType: sourceType,
                protopath: (body.protopath || '').trim(),
                protocontent: body.protocontent,
                keepCase: body.keepCase
            });
            res.json({ ok: true, types: collectTypeNames(root) });
        }
        catch (error) {
            res.json({ ok: false, error: ('Proto file could not be loaded. ' + (error.message || error)).slice(0, 500) });
        }
    });

    function ProtoFileNode (config) {
        RED.nodes.createNode(this, config);
        this.sourceType = config.sourceType || 'file';
        this.protocontent = config.protocontent || '';
        this.protopath = splitProtopath(config.protopath || '');
        this.watchFile = config.watchFile !== false;
        this.keepCase = config.keepCase;
        const protoFileNode = this;
        let reloadTimer = null;

        protoFileNode.load = function () {
            try {
                protoFileNode.protoTypes = loadProtoTypes(protoFileNode);
                return true;
            }
            catch (error) {
                protoFileNode.error('Proto file could not be loaded. ' + error);
                return false;
            }
        };
        protoFileNode.closeWatchers = function () {
            (protoFileNode.protoFileWatchers || []).forEach((watcher) => watcher.close());
            protoFileNode.protoFileWatchers = [];
        };
        protoFileNode.watchProtopath = function () {
            protoFileNode.closeWatchers();
            for (const watchedFile of protoFileNode.protoTypes.files) {
                try {
                    protoFileNode.protoFileWatchers.push(fs.watch(watchedFile, (eventType) => {
                        if (eventType === 'change') {
                            // Editors and fs.watch can fire several change events per save,
                            // so changes are batched into a single reload of all files.
                            clearTimeout(reloadTimer);
                            reloadTimer = setTimeout(() => {
                                if (protoFileNode.load()) {
                                    protoFileNode.watchProtopath();
                                    protoFileNode.log('Protobuf file changed on disk. Reloaded.');
                                }
                            }, 50);
                        }
                    }));
                }
                catch (error) {
                    protoFileNode.error(`Error when trying to watch ${watchedFile} on disk: ` + error);
                }
            }
        };
        protoFileNode.on('close', () => {
            clearTimeout(reloadTimer);
            protoFileNode.closeWatchers();
        });
        protoFileNode.load();
        // Inline definitions have no file to watch.
        if (protoFileNode.protoTypes !== undefined && protoFileNode.sourceType !== 'inline' && protoFileNode.watchFile) {
            protoFileNode.watchProtopath();
        }
    }
    RED.nodes.registerType('protobuf-file', ProtoFileNode);
};
