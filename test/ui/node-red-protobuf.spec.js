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

async function openNodeDialog (page, nodeId) {
    await page.evaluate((id) => {
        globalThis.RED.editor.edit(globalThis.RED.nodes.node(id));
    }, nodeId);
    await expect(page.locator('#dialog-form')).toBeVisible();
}

async function closeNodeDialog (page) {
    await page.locator('#node-dialog-cancel').click();
    await expect(page.locator('#dialog-form')).toBeHidden();
}

async function getNodeHelpText (page, type) {
    return page.evaluate((nodeType) => {
        const help = globalThis.document.querySelector(`script[data-help-name="${nodeType}"]`);
        return help ? help.textContent : '';
    }, type);
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
        throw new Error(`${error.message}\nNode-RED output:\n${nodeRed.processOutput.join('')}`, { cause: error });
    }
    finally {
        await nodeRed.stop();
    }
});

test('Node-RED import menu lists the packaged example flows', async ({ page }) => {
    const nodeRed = await startNodeRed();

    try {
        await page.goto(nodeRed.baseUrl);
        await page.waitForFunction(() => globalThis.RED && globalThis.RED.nodes && globalThis.RED.nodes.node('encode-node'));

        await page.evaluate(() => globalThis.RED.actions.invoke('core:show-examples-import-dialog'));
        await expect(page.locator('#red-ui-clipboard-dialog')).toBeVisible();

        const examplesTab = page.locator('#red-ui-clipboard-dialog-import-tab-examples');
        const packageEntry = examplesTab.locator('.red-ui-treeList-label', { hasText: 'node-red-contrib-protobuf' });
        await expect(packageEntry).toBeVisible();
        await packageEntry.locator('i.fa-angle-right').click();

        const exampleNames = [
            '01 encode basics',
            '02 decode basics',
            '03 proto2 round trip',
            '04 proto3 round trip',
            '05 edition 2023 round trip',
            '06 edition 2024 round trip',
            '07 delimited stream',
        ];
        for (const name of exampleNames) {
            await expect(examplesTab.locator('.red-ui-treeList-label', { hasText: name })).toBeVisible();
        }

        await examplesTab.locator('.red-ui-treeList-label', { hasText: '04 proto3 round trip' }).click();
        await page.locator('#red-ui-clipboard-dialog-ok').click();

        await page.waitForFunction(() => {
            let imported = 0;
            globalThis.RED.nodes.eachNode((node) => {
                if (node.type === 'encode') {
                    imported += 1;
                }
            });
            return imported >= 2;
        });
    }
    catch (error) {
        throw new Error(`${error.message}\nNode-RED output:\n${nodeRed.processOutput.join('')}`, { cause: error });
    }
    finally {
        await nodeRed.stop();
    }
});

test('Node-RED editor dialogs expose modern protobuf configuration UI', async ({ page }) => {
    const nodeRed = await startNodeRed();

    try {
        await page.goto(nodeRed.baseUrl);
        await page.waitForFunction(() => globalThis.RED && globalThis.RED.nodes && globalThis.RED.nodes.node('encode-node'));

        const definitions = await page.evaluate(() => {
            const encode = globalThis.RED.nodes.getType('encode');
            const decode = globalThis.RED.nodes.getType('decode');
            const protofile = globalThis.RED.nodes.getType('protobuf-file');

            return {
                encode: {
                    color: encode.color,
                    icon: encode.icon,
                    protofileRequired: encode.defaults.protofile.required,
                    protoTypeRequired: encode.defaults.protoType.required,
                    inputLabel: encode.inputLabels,
                    outputLabel: encode.outputLabels,
                    delimitedDefault: encode.defaults.delimited && encode.defaults.delimited.value,
                },
                decode: {
                    color: decode.color,
                    icon: decode.icon,
                    protofileRequired: decode.defaults.protofile.required,
                    protoTypeRequired: decode.defaults.protoType.required,
                    inputLabel: decode.inputLabels,
                    outputLabel: decode.outputLabels,
                    delimitedDefault: decode.defaults.delimited && decode.defaults.delimited.value,
                    delimitedOutputDefault: decode.defaults.delimitedOutput && decode.defaults.delimitedOutput.value,
                },
                protofile: {
                    hasPrototypesDefault: Object.prototype.hasOwnProperty.call(protofile.defaults, 'prototypes'),
                    protopathRequired: protofile.defaults.protopath.required,
                },
            };
        });

        expect(definitions.encode.color).not.toBe(definitions.decode.color);
        expect(definitions.encode.icon).not.toBe(definitions.decode.icon);
        expect(definitions.encode.protofileRequired).toBe(true);
        expect(definitions.decode.protofileRequired).toBe(true);
        expect(definitions.encode.protoTypeRequired).toBe(false);
        expect(definitions.decode.protoTypeRequired).toBe(false);
        expect(definitions.encode.inputLabel).toBe('object');
        expect(definitions.encode.outputLabel).toBe('protobuf buffer');
        expect(definitions.decode.inputLabel).toBe('protobuf buffer');
        expect(definitions.decode.outputLabel).toBe('object');
        expect(definitions.protofile.hasPrototypesDefault).toBe(false);
        expect(definitions.protofile.protopathRequired).toBe(true);
        expect(definitions.encode.delimitedDefault).toBe(false);
        expect(definitions.decode.delimitedDefault).toBe(false);
        expect(definitions.decode.delimitedOutputDefault).toBe('messages');

        await openNodeDialog(page, 'encode-node');
        await expect(page.locator('label[for="node-input-protofile"]')).toContainText('Proto file');
        await expect(page.locator('label[for="node-input-protoType"]')).toContainText('Type');
        await expect(page.locator('#node-input-protoType')).toHaveAttribute('placeholder', 'Example: package.Message');
        await expect(page.locator('#node-input-protobuf-type-tip')).toContainText('When msg.protobufType is set, the value overrides this field');
        await expect(page.locator('#node-input-delimited')).toBeVisible();
        await closeNodeDialog(page);

        await openNodeDialog(page, 'decode-node');
        await expect(page.locator('label[for="node-input-protofile"]')).toContainText('Proto file');
        await expect(page.locator('label[for="node-input-protoType"]')).toContainText('Type');
        await expect(page.locator('#node-input-protoType')).toHaveAttribute('placeholder', 'Example: package.Message');
        await expect(page.locator('#node-input-protobuf-type-tip')).toContainText('When msg.protobufType is set, the value overrides this field');
        await expect(page.locator('#node-input-delimited')).toBeVisible();
        await expect(page.locator('#node-input-delimitedOutput-row')).toBeHidden();
        await page.locator('#node-input-delimited').check();
        await expect(page.locator('#node-input-delimitedOutput-row')).toBeVisible();
        await page.locator('#node-input-delimited').uncheck();
        await expect(page.locator('#node-input-delimitedOutput-row')).toBeHidden();
        await closeNodeDialog(page);

        await openNodeDialog(page, 'encode-node');
        await page.locator('#node-input-btn-protofile-edit').click();
        await expect(page.locator('#node-config-input-protopath')).toBeVisible();
        await expect(page.locator('label[for="node-config-input-protopath"]')).toContainText('Proto path');
        await expect(page.locator('label[for="node-config-input-watchFile"]')).toContainText('Watch file');
        await expect(page.locator('label[for="node-config-input-keepCase"]')).toContainText('Keep case');
        await expect(page.locator('text=Keep names like')).toBeVisible();
        await expect(page.locator('#node-config-protopath-tip')).toContainText('Use commas to load multiple .proto files');
        await expect(page.locator('#node-config-watch-tip')).toContainText('All listed files are watched');
        await page.locator('#node-config-dialog-cancel').click();
        await closeNodeDialog(page);

        await expect(page.locator('.red-ui-palette-node[data-palette-type="encode"]')).toBeVisible();
        await expect(page.locator('.red-ui-palette-node[data-palette-type="decode"]')).toBeVisible();

        await expect(page.locator('.red-ui-palette-node[data-palette-type="encode"] .red-ui-palette-label')).toHaveText('encode');
        await expect(page.locator('.red-ui-palette-node[data-palette-type="decode"] .red-ui-palette-label')).toHaveText('decode');

        const scriptTypes = await page.evaluate(() => {
            const types = {};
            for (const nodeType of ['encode', 'decode', 'protobuf-file']) {
                const template = globalThis.document.querySelector(`script[data-template-name="${nodeType}"]`);
                const help = globalThis.document.querySelector(`script[data-help-name="${nodeType}"]`);
                types[nodeType] = {
                    template: template && template.getAttribute('type'),
                    help: help && help.getAttribute('type'),
                };
            }
            return types;
        });

        for (const nodeType of ['encode', 'decode', 'protobuf-file']) {
            expect(scriptTypes[nodeType].template).toBe('text/html');
            expect(scriptTypes[nodeType].help).toBe('text/markdown');
        }

        const encodeHelp = await getNodeHelpText(page, 'encode');
        const decodeHelp = await getNodeHelpText(page, 'decode');
        const protofileHelp = await getNodeHelpText(page, 'protobuf-file');

        expect(encodeHelp).toContain('msg.protobufType overrides the configured message type');
        expect(encodeHelp).toContain('Delimited');
        expect(encodeHelp).toContain('Example');
        expect(encodeHelp).toContain('https://protobufjs.github.io/protobuf.js/Type.html');
        expect(encodeHelp).toContain('https://protobuf.dev/programming-guides/encoding/');
        expect(encodeHelp).toContain('[!WARNING]');
        expect(encodeHelp).toContain('false vs not set');
        expect(encodeHelp).toContain('https://protobuf.dev/programming-guides/field_presence/');
        expect(decodeHelp).toContain('partial decoded message');
        expect(decodeHelp).toContain('one message per decoded item');
        expect(decodeHelp).toContain('Example');
        expect(decodeHelp).toContain('https://protobufjs.github.io/protobuf.js/Type.html');
        expect(decodeHelp).toContain('https://protobuf.dev/programming-guides/techniques/#streaming');
        expect(decodeHelp).toContain('[!WARNING]');
        expect(decodeHelp).toContain('false vs not set');
        expect(decodeHelp).toContain('optional bool enabled = 1;');
        expect(decodeHelp).toContain('https://protobuf.dev/programming-guides/field_presence/');
        expect(protofileHelp).toContain('syntax = "proto3"');
        expect(protofileHelp).toContain('https://protobuf.dev/programming-guides/editions/');
        expect(protofileHelp).toContain('https://protobufjs.github.io/protobuf.js/Root.html');
        expect(protofileHelp).toContain('[!TIP]');
        expect(protofileHelp).toContain('https://protobuf.dev/programming-guides/field_presence/');
        expect(protofileHelp).toContain('Use commas to load multiple');
        expect(protofileHelp).toContain('/flows/protos/messages.proto,/flows/protos/common.proto');
        expect(protofileHelp).toContain('All listed files are watched');
        expect(protofileHelp).toContain('keepCase');
        expect(protofileHelp).toContain('device_id');
        expect(protofileHelp).toContain('deviceId');
    }
    catch (error) {
        throw new Error(`${error.message}\nNode-RED output:\n${nodeRed.processOutput.join('')}`, { cause: error });
    }
    finally {
        await nodeRed.stop();
    }
});
