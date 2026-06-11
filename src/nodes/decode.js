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

        function completeWithError (msg, done, error, statusText) {
            node.status({fill: 'red', shape: 'dot', text: statusText});
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
            node.status({fill: 'green', shape: 'dot', text: 'Ready'});
            try {
                return node.protofile.protoTypes.lookupType(msg.protobufType);
            }
            catch (error) {
                node.warn(`
Problem while looking up the message type.
${error}
Protofile object:
${node.protofile.protopath}
Prototypes content:
${JSON.stringify(node.protofile.protoTypes)}
With configured protoType:
${msg.protobufType}
                `);
                node.status({fill: 'yellow', shape: 'dot', text: 'Message type not found'});
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
                            node.status({fill: 'yellow', shape: 'dot', text: 'Message incomplete'});
                            decodedMessages.push(messageType.toObject(exception.instance, decodeOptions));
                            break;
                        }
                        completeWithError(msg, done, new Error(`Wire format is invalid: ${exception.message}`), 'Wire format invalid');
                        return;
                    }
                }
                if (decodedMessages.length === 0) {
                    node.warn('Delimited payload is empty. Nothing to decode.');
                    node.status({fill: 'yellow', shape: 'dot', text: 'Payload empty'});
                    completeWithoutError(done);
                    return;
                }
                node.status({fill: 'green', shape: 'dot', text: 'Processed'});
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
                    node.status({fill: 'yellow', shape: 'dot', text: 'Message incomplete'});
                    msg.payload = messageType.toObject(exception.instance, decodeOptions);
                    send(msg);
                    completeWithoutError(done);
                    return;
                }
                completeWithError(msg, done, new Error(`Wire format is invalid: ${exception.message}`), 'Wire format invalid');
                return;
            }

            node.status({fill: 'green', shape: 'dot', text: 'Processed'});
            send(msg);
            completeWithoutError(done);
        });
    }
    RED.nodes.registerType('decode', ProtobufDecodeNode);
};
