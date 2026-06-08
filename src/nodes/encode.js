module.exports = function (RED) {
    function ProtobufEncodeNode (config) {
        RED.nodes.createNode(this, config);
        // Retrieve the config node
        this.protofile = RED.nodes.getNode(config.protofile);
        this.protoType = config.protoType;
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

            if (messageType.verify(msg.payload)) {
                node.warn('Message is not valid under selected message type.');
                node.status({fill: 'yellow', shape: 'dot', text: 'Message invalid'});
                completeWithoutError(done);
                return;
            }
            // create a protobuf message and convert it into a buffer
            msg.payload = messageType.encode(messageType.create(msg.payload)).finish();
            node.status({fill: 'green', shape: 'dot', text: 'Processed'});
            send(msg);
            completeWithoutError(done);
        });
    }
    RED.nodes.registerType('encode', ProtobufEncodeNode);
};
