"use strict";

const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const DOCKER_IMAGE = process.env.NODE_DOCKER_IMAGE || `node:${process.versions.node}-alpine`;

function canRun(command, args) {
    const result = spawnSync(command, args, {
        cwd: ROOT,
        env: process.env,
        stdio: "ignore"
    });
    return !result.error && result.status === 0;
}

function resolveDockerCommand() {
    if (canRun("docker", ["info"])) {
        return ["docker"];
    }
    if (canRun("sudo", ["-n", "docker", "info"])) {
        return ["sudo", "-n", "docker"];
    }
    return ["docker"];
}

function run(command, args) {
    const result = spawnSync(command, args, {
        cwd: ROOT,
        env: process.env,
        stdio: "inherit"
    });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`${command} ${args.join(" ")} exited with ${result.status}`);
    }
}

const docker = resolveDockerCommand();
run(docker[0], docker.slice(1).concat([
    "run",
    "--rm",
    "--network",
    "none",
    "--volume",
    `${ROOT}:/workspace:ro`,
    "--workdir",
    "/workspace",
    "--env",
    "PROTOBUF_DOCKER_TEST=1",
    DOCKER_IMAGE,
    "./node_modules/.bin/mocha",
    "test/docker/protofile-real-server.test.js"
]));
