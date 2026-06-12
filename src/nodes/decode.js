const protobufjs = require('protobufjs');

const decodeOptions = {
    longs: String,
    enums: String,
    bytes: String,
    defaults: false, // includes default values, otherwise not transmitted values will be assigned their default value!
};

module.exports = function (RED) {
    function ProtobufDecodeNode (config) {
        RED.nodes.createNode(this, config);
        // Retrieve the config node
        this.protofile = RED.nodes.getNode(config.protofile);
        this.protoType = config.protoType;
        this.delimited = config.delimited === true;
        this.delimitedOutput = config.delimitedOutput || 'messages';
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
                const reader = protobufjs.Reader.create(msg.payload);
                const decodedMessages = [];
                while (reader.pos < reader.len) {
                    try {
                        const message = messageType.decodeDelimited(reader);
                        decodedMessages.push(messageType.toObject(message, decodeOptions));
                    }
                    catch (exception) {
                        if (exception instanceof protobufjs.util.ProtocolError) {
                            node.warn('Received message contains empty fields. Incomplete message will be forwarded.');
                            setStatus({fill: 'yellow', shape: 'dot', text: 'Message incomplete'});
                            decodedMessages.push(messageType.toObject(exception.instance, decodeOptions));
                            break;
                        }
                        completeWithError(msg, done, new Error(`Wire format is invalid: ${exception.message}`), 'Wire format invalid');
                        return;
                    }
                }
                if (decodedMessages.length === 0) {
                    node.warn('Delimited payload is empty. Nothing to decode.');
                    setStatus({fill: 'yellow', shape: 'dot', text: 'Payload empty'});
                    completeWithoutError(done);
                    return;
                }
                setStatus({fill: 'green', shape: 'dot', text: 'Processed'});
                if (node.delimitedOutput === 'array') {
                    msg.payload = decodedMessages;
                    send(msg);
                }
                else {
                    for (const decodedMessage of decodedMessages) {
                        const outMsg = RED.util.cloneMessage(msg);
                        outMsg.payload = decodedMessage;
                        send(outMsg);
                    }
                }
                completeWithoutError(done);
                return;
            }

            try {
                const message = messageType.decode(msg.payload);
                msg.payload = messageType.toObject(message, decodeOptions);
            }
            catch (exception) {
                if (exception instanceof protobufjs.util.ProtocolError) {
                    node.warn('Received message contains empty fields. Incomplete message will be forwarded.');
                    setStatus({fill: 'yellow', shape: 'dot', text: 'Message incomplete'});
                    msg.payload = messageType.toObject(exception.instance, decodeOptions);
                    send(msg);
                    completeWithoutError(done);
                    return;
                }
                completeWithError(msg, done, new Error(`Wire format is invalid: ${exception.message}`), 'Wire format invalid');
                return;
            }

            setStatus({fill: 'green', shape: 'dot', text: 'Processed'});
            send(msg);
            completeWithoutError(done);
        });
    }
    RED.nodes.registerType('decode', ProtobufDecodeNode);
};
