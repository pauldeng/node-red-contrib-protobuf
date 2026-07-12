const protobufjs = require('protobufjs');

function fromBase64Url (value) {
    const converted = value.replace(/-/g, '+').replace(/_/g, '/');
    const padding = converted.length % 4;
    return padding === 0 ? converted : converted + '='.repeat(4 - padding);
}

function normalizeBase64UrlBytes (messageType, object) {
    if (!object || typeof object !== 'object') {
        return object;
    }
    const normalized = Array.isArray(object) ? object.slice() : { ...object };
    for (const field of messageType.fieldsArray) {
        const value = normalized[field.name];
        if (value === undefined || value === null) {
            continue;
        }
        if (field.type === 'bytes') {
            if (field.map) {
                normalized[field.name] = Object.fromEntries(Object.entries(value).map(function ([key, item]) {
                    return [key, typeof item === 'string' ? fromBase64Url(item) : item];
                }));
            }
            else if (field.repeated) {
                normalized[field.name] = value.map(function (item) {
                    return typeof item === 'string' ? fromBase64Url(item) : item;
                });
            }
            else if (typeof value === 'string') {
                normalized[field.name] = fromBase64Url(value);
            }
        }
        else if (field.resolvedType && field.resolvedType.fieldsArray) {
            if (field.map) {
                normalized[field.name] = Object.fromEntries(Object.entries(value).map(function ([key, item]) {
                    return [key, normalizeBase64UrlBytes(field.resolvedType, item)];
                }));
            }
            else if (field.repeated) {
                normalized[field.name] = value.map(function (item) {
                    return normalizeBase64UrlBytes(field.resolvedType, item);
                });
            }
            else {
                normalized[field.name] = normalizeBase64UrlBytes(field.resolvedType, value);
            }
        }
    }
    return normalized;
}

module.exports = function (RED) {
    function ProtobufEncodeNode (config) {
        RED.nodes.createNode(this, config);
        // Retrieve the config node
        this.protofile = RED.nodes.getNode(config.protofile);
        this.protoType = config.protoType;
        this.delimited = config.delimited === true;
        this.inputConversion = config.inputConversion === 'fromObject' ? 'fromObject' : 'strict';
        this.inputBytesType = config.inputBytesType === 'Base64Url' ? 'Base64Url' : 'String';
        this.validationFailure = config.validationFailure === 'error' ? 'error' : 'warn';
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

        function invalidPayloadMessage (index) {
            if (index === undefined) {
                return 'Message is not valid under selected message type.';
            }
            return `Message at index ${index} is not valid under selected message type.`;
        }

        function completeInvalidPayload (msg, done, error) {
            if (node.validationFailure === 'error') {
                completeWithError(msg, done, error, 'Message invalid');
                return;
            }
            node.warn(error.message);
            setStatus({fill: 'yellow', shape: 'dot', text: 'Message invalid'});
            completeWithoutError(done);
        }

        function preparePayload (messageType, payload, index) {
            const messageText = invalidPayloadMessage(index);
            try {
                const input = node.inputBytesType === 'Base64Url'
                    ? normalizeBase64UrlBytes(messageType, payload)
                    : payload;
                if (node.inputConversion === 'fromObject') {
                    const message = messageType.fromObject(input);
                    const reason = messageType.verify(message);
                    if (reason) {
                        return { error: new Error(`${messageText} ${reason}`) };
                    }
                    return { message };
                }

                if (messageType.verify(input)) {
                    return { error: new Error(messageText) };
                }
                return { message: messageType.create(input) };
            }
            catch (error) {
                return { error: new Error(`${messageText} ${error.message}`) };
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
                const messages = [];
                for (const [index, payload] of payloads.entries()) {
                    const prepared = preparePayload(messageType, payload, index);
                    if (prepared.error) {
                        completeInvalidPayload(msg, done, prepared.error);
                        return;
                    }
                    messages.push(prepared.message);
                }
                const writer = protobufjs.Writer.create();
                for (const message of messages) {
                    messageType.encodeDelimited(message, writer);
                }
                msg.payload = writer.finish();
                setStatus({fill: 'green', shape: 'dot', text: 'Processed'});
                send(msg);
                completeWithoutError(done);
                return;
            }

            const prepared = preparePayload(messageType, msg.payload);
            if (prepared.error) {
                completeInvalidPayload(msg, done, prepared.error);
                return;
            }
            // create a protobuf message and convert it into a buffer
            msg.payload = messageType.encode(prepared.message).finish();
            setStatus({fill: 'green', shape: 'dot', text: 'Processed'});
            send(msg);
            completeWithoutError(done);
        });
    }
    RED.nodes.registerType('encode', ProtobufEncodeNode);
};
