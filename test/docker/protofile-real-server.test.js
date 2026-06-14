const assert = require('node:assert');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { once } = require('node:events');
const express = require('express');
const helper = require('node-red-node-test-helper');
const RED = require('node-red');

helper.init(require.resolve('node-red'));

const packageName = '@pauldeng/node-red-contrib-protobuf';
const packagedProtoPath = 'node_modules/@pauldeng/node-red-contrib-protobuf/examples/protos/proto3.proto';

async function listen (server) {
    const listening = once(server, 'listening', { signal: globalThis.AbortSignal.timeout(3000) });
    server.listen(0, '127.0.0.1');
    await listening;
    return server.address().port;
}

async function closeServer (server) {
    const closed = once(server, 'close', { signal: globalThis.AbortSignal.timeout(3000) });
    server.close();
    await closed;
}

async function postJson (port, requestPath, body) {
    const response = await globalThis.fetch(`http://127.0.0.1:${port}${requestPath}`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: globalThis.AbortSignal.timeout(3000)
    });

    return {
        statusCode: response.status,
        body: await response.json()
    };
}

function run (command, args, options) {
    const result = spawnSync(command, args, {
        encoding: 'utf8',
        ...options
    });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`${command} ${args.join(' ')} exited with ${result.status}\n${result.stderr || result.stdout}`);
    }
    return result.stdout;
}

function symlinkDependency (consumerNodeModules, dependency) {
    fs.symlinkSync(
        path.join('/workspace', 'node_modules', dependency),
        path.join(consumerNodeModules, dependency),
        'dir'
    );
}

function createPackagedInstall () {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nr-protobuf-package-'));
    const packDir = path.join(tempDir, 'pack');
    const extractDir = path.join(tempDir, 'extract');
    const consumerDir = path.join(tempDir, 'consumer');
    const consumerNodeModules = path.join(consumerDir, 'node_modules');

    fs.mkdirSync(packDir);
    fs.mkdirSync(extractDir);
    fs.mkdirSync(consumerNodeModules, { recursive: true });

    const packOutput = run('npm', ['pack', '/workspace', '--pack-destination', packDir, '--json'], {
        cwd: tempDir
    });
    const packInfo = JSON.parse(packOutput)[0];
    const tarball = path.join(packDir, packInfo.filename);
    run('tar', ['-xzf', tarball, '-C', extractDir]);

    const installedDir = path.join(consumerNodeModules, packageName);
    fs.mkdirSync(path.dirname(installedDir), { recursive: true });
    fs.renameSync(path.join(extractDir, 'package'), installedDir);

    const packageJson = JSON.parse(fs.readFileSync(path.join(installedDir, 'package.json'), 'utf8'));
    Object.keys(packageJson.dependencies || {}).forEach(function (dependency) {
        symlinkDependency(consumerNodeModules, dependency);
    });

    return {
        tempDir,
        consumerDir,
        installedDir,
        files: packInfo.files.map(file => file.path).sort(),
        registerPackage: require(installedDir)
    };
}

function flowUsingPackagedExample () {
    return [
        { id: 'flow1', type: 'tab', label: 'docker smoke' },
        {
            id: 'encode-node',
            type: 'encode',
            z: 'flow1',
            protofile: 'proto-config',
            protoType: 'TestType',
            wires: [['decode-node']]
        },
        {
            id: 'decode-node',
            type: 'decode',
            z: 'flow1',
            protofile: 'proto-config',
            protoType: 'TestType',
            wires: [['helper-node']]
        },
        {
            id: 'helper-node',
            type: 'helper',
            z: 'flow1',
            wires: []
        },
        {
            id: 'proto-config',
            type: 'protobuf-file',
            z: '',
            protopath: packagedProtoPath,
            watchFile: false
        }
    ];
}

describe('protobuf Docker integration', function () {
    this.timeout(15000);

    let server;
    let userDir;
    let packaged;
    let originalCwd;
    let redStarted = false;
    let helperLoaded = false;

    before(async function () {
        assert.strictEqual(process.env.PROTOBUF_DOCKER_TEST, '1');

        originalCwd = process.cwd();
        packaged = createPackagedInstall();
        process.chdir(packaged.consumerDir);
    });

    afterEach(async function () {
        if (helperLoaded) {
            await helper.unload();
            helperLoaded = false;
        }
    });

    after(async function () {
        try {
            if (redStarted) {
                await RED.stop();
            }
        }
        finally {
            if (server && server.listening) {
                await closeServer(server);
            }
            if (userDir) {
                fs.rmSync(userDir, { recursive: true, force: true });
            }
            if (packaged) {
                fs.rmSync(packaged.tempDir, { recursive: true, force: true });
            }
            if (originalCwd) {
                process.chdir(originalCwd);
            }
        }
    });

    async function startEmbeddedServer () {
        const app = express();
        const registeredTypes = [];
        const registeredLibraries = [];
        userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nr-protobuf-'));
        server = http.createServer(app);

        RED.init(server, {
            userDir: userDir,
            flowFile: 'flows.json',
            credentialSecret: 'test',
            logging: { console: { level: 'off' } },
            httpAdminRoot: '/',
            httpNodeRoot: false,
            disableEditor: true
        });

        const registerType = RED.nodes.registerType;
        RED.nodes.registerType = function (type, constructor, opts) {
            registeredTypes.push(type);
            return registerType.call(RED.nodes, type, constructor, opts);
        };
        packaged.registerPackage({
            nodes: RED.nodes,
            httpAdmin: RED.httpAdmin,
            auth: RED.auth,
            library: {
                register: function (type) {
                    registeredLibraries.push(type);
                }
            },
            util: RED.util
        });
        RED.nodes.registerType = registerType;

        app.use('/', RED.httpAdmin);
        await listen(server);
        await RED.start();
        redStarted = true;

        assert.deepStrictEqual(registeredTypes, ['protobuf-file', 'encode', 'decode']);
        assert.deepStrictEqual(registeredLibraries, ['protobuf']);
    }

    it('packs the files needed by Node-RED and the shipped examples', function () {
        [
            'package.json',
            'src/index.js',
            'src/nodes/protofile.js',
            'src/nodes/protofile.html',
            'src/nodes/encode.js',
            'src/nodes/encode.html',
            'src/nodes/decode.js',
            'src/nodes/decode.html',
            'examples/04 proto3 round trip.json',
            'examples/protos/proto3.proto',
            'README.md',
            'LICENCE'
        ].forEach(function (file) {
            assert.ok(packaged.files.includes(file), `${file} is missing from npm pack output`);
        });

        assert.strictEqual(typeof packaged.registerPackage, 'function');
        assert.ok(fs.existsSync(path.join(packaged.installedDir, 'examples', 'protos', 'proto3.proto')));
    });

    it('runs an encode/decode flow against a packaged example proto path', async function () {
        const payload = {
            timestamp: 1533295590569,
            foo: 1.5,
            bar: true,
            test: 'Docker packaged flow',
            noMoreSnakeCase: true
        };

        helperLoaded = true;
        await helper.load(packaged.registerPackage, flowUsingPackagedExample());

        const encodeNode = helper.getNode('encode-node');
        const input = once(helper.getNode('helper-node'), 'input', {
            signal: globalThis.AbortSignal.timeout(3000)
        });
        encodeNode.receive({ payload });

        const [msg] = await input;
        assert.deepStrictEqual(msg.payload, payload);
    });

    it('serves the protobuf-file types endpoint over HTTP from the package entrypoint', async function () {
        await startEmbeddedServer();

        const res = await postJson(server.address().port, '/protobuf-file/types', {
            protopath: packagedProtoPath
        });

        assert.strictEqual(res.statusCode, 200);
        assert.deepStrictEqual(res.body, { ok: true, types: ['TestType'] });
    });
});
