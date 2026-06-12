const protobufjs = require('protobufjs');

module.exports = function (RED) {
    function ProtobufEncodeNode (config) {
        RED.nodes.createNode(this, config);
        // Retrieve the config node
        this.protofile = RED.nodes.getNode(config.protofile);
        this.protoType = config.protoType;
        this.delimited = config.delimited === true;
        const node = this;

        // Only push a status update when it actually changes. node.status()
        // emits a runtime event per call, so skipping no-op updates keeps the
        // per-message hot path cheap on busy flows.
        let lastStatusKey = null;
        function setStatus (status) {
            const key = status.fill + '|' + status.shape + '|' + status.text;
            if (key === lastStatusKey) {
                return;
            }
            lastStatusKey = key;
            node.status(status);
        }

        // Cache the resolved message type so a steady stream of the same type
        // does not re-walk the proto namespace on every message. Keyed on the
        // proto root identity so a protofile reload (which replaces the root)
        // invalidates the cache automatically.
        let cachedRoot = null;
        let cachedName = null;
        let cachedType = null;
        function lookupMessageType (root, name) {
            if (root === cachedRoot && name === cachedName) {
                return cachedType;
            }
            const type = root.lookupType(name);
            cachedRoot = root;
            cachedName = name;
            cachedType = type;
            return type;
        }

        function completeWithError (msg, done, error, statusText) {
            setStatus({fill: 'red', shape: 'dot', text: statusText});
            if (done) {
                done(error);
            }
            else {
                node.error(error, msg);
            }
        }

        function completeWithoutError (done) {
            if (done) {
                done();
            }
        }

        function resolveMessageType (msg, done) {
            msg.protobufType = msg.protobufType || node.protoType;
            if (msg.protobufType === undefined) {
                completeWithError(msg, done, new Error('No protobuf type supplied!'), 'Protobuf type missing');
                return undefined;
            }
            if (!node.protofile) {
                completeWithError(msg, done, new Error('No .proto file configured!'), 'Protofile missing');
                return undefined;
            }
            if (node.protofile.protoTypes === undefined) {
                completeWithError(msg, done, new Error('No .proto types loaded! Check that the file exists and that node-red has permission to access it.'), 'Protofile not ready');
                return undefined;
            }
            try {
                return lookupMessageType(node.protofile.protoTypes, msg.protobufType);
            }
            catch (error) {
                const available = Object.keys((node.protofile.protoTypes && node.protofile.protoTypes.nested) || {});
                node.warn(`Problem while looking up the message type "${msg.protobufType}" in ${node.protofile.protopath}. Available types: ${available.join(', ') || '(none)'}. ${error}`);
                setStatus({fill: 'yellow', shape: 'dot', text: 'Message type not found'});
                completeWithoutError(done);
                return undefined;
            }
        }

        node.on('input', function (msg, send, done) {
            const messageType = resolveMessageType(msg, done);
            if (!messageType) return;

            if (node.delimited) {
                // Each payload object becomes one length-prefixed message in a single buffer.
                const payloads = Array.isArray(msg.payload) ? msg.payload : [msg.payload];
                for (const [index, payload] of payloads.entries()) {
                    if (messageType.verify(payload)) {
                        node.warn(`Message at index ${index} is not valid under selected message type.`);
                        setStatus({fill: 'yellow', shape: 'dot', text: 'Message invalid'});
                        completeWithoutError(done);
                        return;
                    }
                }
                const writer = protobufjs.Writer.create();
                for (const payload of payloads) {
                    messageType.encodeDelimited(messageType.create(payload), writer);
                }
                msg.payload = writer.finish();
                setStatus({fill: 'green', shape: 'dot', text: 'Processed'});
                send(msg);
                completeWithoutError(done);
                return;
            }

            if (messageType.verify(msg.payload)) {
                node.warn('Message is not valid under selected message type.');
                setStatus({fill: 'yellow', shape: 'dot', text: 'Message invalid'});
                completeWithoutError(done);
                return;
            }
            // create a protobuf message and convert it into a buffer
            msg.payload = messageType.encode(messageType.create(msg.payload)).finish();
            setStatus({fill: 'green', shape: 'dot', text: 'Processed'});
            send(msg);
            completeWithoutError(done);
        });
    }
    RED.nodes.registerType('encode', ProtobufEncodeNode);
};
