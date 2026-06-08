const { test, expect } = require('@playwright/test');
const childProcess = require('node:child_process');
const fs = require('node:fs/promises');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

const repoRoot = path.resolve(__dirname, '../..');
const nodeRedBin = path.join(repoRoot, 'node_modules', '.bin', 'node-red');
const protoPath = path.join(repoRoot, 'test', 'assets', 'test.proto');

async function getFreePort () {
    const server = net.createServer();

    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });

    const address = server.address();
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.close(resolve);
    });

    return address.port;
}

async function waitForEditor (baseUrl, processOutput) {
    const deadline = Date.now() + 30000;
    let lastError;

    while (Date.now() < deadline) {
        try {
            await new Promise((resolve, reject) => {
                const request = http.get(baseUrl, (response) => {
                    response.resume();
                    if (response.statusCode === 200) {
                        resolve();
                        return;
                    }
                    reject(new Error(`Node-RED returned HTTP ${response.statusCode}`));
                });

                request.once('error', reject);
                request.setTimeout(1000, () => {
                    request.destroy(new Error('Node-RED editor request timed out'));
                });
            });
            return;
        }
        catch (error) {
            lastError = error;
            await delay(250);
        }
    }

    throw new Error(`Node-RED did not start in time: ${lastError}\n${processOutput.join('')}`);
}

async function waitForExit (processHandle) {
    if (processHandle.exitCode !== null) {
        return;
    }

    await new Promise((resolve) => {
        processHandle.once('exit', resolve);
    });
}

function encodeDecodeFlow () {
    const testPayload = {
        timestamp: 1533295590569,
        foo: 1.5,
        bar: true,
        test: 'Playwright protobuf UI',
        noMoreSnakeCase: true,
    };

    return [
        {
            id: 'flow-tab',
            type: 'tab',
            label: 'protobuf ui test',
            disabled: false,
            info: '',
        },
        {
            id: 'inject-node',
            type: 'inject',
            z: 'flow-tab',
            name: 'protobuf input',
            props: [
                { p: 'payload', v: JSON.stringify(testPayload), vt: 'json' },
                { p: 'topic', v: '', vt: 'str' },
            ],
            repeat: '',
            crontab: '',
            once: false,
            onceDelay: 0.1,
            x: 150,
            y: 120,
            wires: [['encode-node']],
        },
        {
            id: 'encode-node',
            type: 'encode',
            z: 'flow-tab',
            name: 'encode TestType',
            protofile: 'proto-config',
            protoType: 'TestType',
            x: 360,
            y: 120,
            wires: [['decode-node']],
        },
        {
            id: 'decode-node',
            type: 'decode',
            z: 'flow-tab',
            name: 'decode TestType',
            protofile: 'proto-config',
            protoType: 'TestType',
            x: 570,
            y: 120,
            wires: [['debug-node']],
        },
        {
            id: 'debug-node',
            type: 'debug',
            z: 'flow-tab',
            name: 'decoded payload',
            active: true,
            tosidebar: true,
            console: false,
            tostatus: false,
            complete: 'payload',
            targetType: 'msg',
            statusVal: '',
            statusType: 'auto',
            x: 790,
            y: 120,
            wires: [],
        },
        {
            id: 'proto-config',
            type: 'protobuf-file',
            z: '',
            name: 'test.proto',
            protopath: protoPath,
            watchFile: false,
            keepCase: false,
        },
    ];
}

async function startNodeRed () {
    const userDir = await fs.mkdtemp(path.join(os.tmpdir(), 'node-red-protobuf-ui-'));
    const nodeModulesDir = path.join(userDir, 'node_modules');
    const moduleLink = path.join(nodeModulesDir, 'node-red-contrib-protobuf');
    const settingsPath = path.join(userDir, 'settings.js');
    const flowPath = path.join(userDir, 'flows.json');
    const port = await getFreePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const processOutput = [];

    await fs.mkdir(nodeModulesDir, { recursive: true });
    await fs.symlink(repoRoot, moduleLink, process.platform === 'win32' ? 'junction' : 'dir');
    await fs.writeFile(
        path.join(userDir, 'package.json'),
        JSON.stringify({
            private: true,
            dependencies: {
                'node-red-contrib-protobuf': `file:${repoRoot}`,
            },
        }, null, 2),
    );
    await fs.writeFile(flowPath, JSON.stringify(encodeDecodeFlow(), null, 2));
    await fs.writeFile(settingsPath, [
        'module.exports = {',
        '    flowFile: "flows.json",',
        '    credentialSecret: false,',
        '    logging: { console: { level: "fatal", metrics: false, audit: false } },',
        '    externalModules: { palette: { allowInstall: false, allowUpload: false } },',
        '    editorTheme: { tours: false },',
        '};',
        '',
    ].join('\n'));

    const processHandle = childProcess.spawn(nodeRedBin, [
        '--userDir', userDir,
        '--settings', settingsPath,
        '--port', String(port),
        '--no-telemetry',
    ], {
        cwd: repoRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    processHandle.stdout.on('data', (data) => processOutput.push(data.toString()));
    processHandle.stderr.on('data', (data) => processOutput.push(data.toString()));

    try {
        await waitForEditor(baseUrl, processOutput);
    }
    catch (error) {
        processHandle.kill();
        await waitForExit(processHandle);
        await fs.rm(userDir, { recursive: true, force: true });
        throw error;
    }

    return {
        baseUrl,
        processOutput,
        async stop () {
            processHandle.kill();
            await waitForExit(processHandle);
            await fs.rm(userDir, { recursive: true, force: true });
        },
    };
}

test('Node-RED editor flow encodes and decodes a protobuf message', async ({ page }) => {
    const nodeRed = await startNodeRed();

    try {
        await page.goto(nodeRed.baseUrl);
        await page.waitForFunction(() => globalThis.RED && globalThis.RED.nodes && globalThis.RED.nodes.node('inject-node'));

        await expect(page.locator('.red-ui-palette-node[data-palette-type="encode"]')).toBeVisible();
        await expect(page.locator('.red-ui-palette-node[data-palette-type="decode"]')).toBeVisible();

        await page.evaluate(() => globalThis.RED.sidebar.show('debug'));
        await page.locator('#inject-node .red-ui-flow-node-button-button').click();

        const debugPayload = page.locator('.red-ui-debug-msg-payload').last();
        await expect(debugPayload).toContainText('Playwright protobuf UI');
        await expect(debugPayload).toContainText('noMoreSnakeCase');
        await expect(debugPayload).toContainText('1533295590569');
    }
    catch (error) {
        throw new Error(`${error.message}\nNode-RED output:\n${nodeRed.processOutput.join('')}`);
    }
    finally {
        await nodeRed.stop();
    }
});
