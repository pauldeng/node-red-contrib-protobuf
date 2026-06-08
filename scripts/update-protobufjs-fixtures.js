#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const upstreamUrl = 'https://github.com/protobufjs/protobuf.js.git';
const upstreamDir = path.join('/tmp', 'node-red-contrib-protobuf-protobufjs');
const upstreamDataDir = path.join(upstreamDir, 'tests', 'data');
const fixtureDir = path.join(repoRoot, 'test', 'assets', 'protobufjs-tests-data');

const run = function (command, args, options) {
  const output = execFileSync(command, args, {
    cwd: options && options.cwd ? options.cwd : repoRoot,
    encoding: 'utf8',
    stdio: options && options.stdio ? options.stdio : 'pipe',
  });

  return typeof output === 'string' ? output.trim() : '';
};

const copyFile = function (source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
};

const copyMatchingFiles = function (sourceDir, destinationDir, shouldCopy) {
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(destinationDir, entry.name);

    if (entry.isDirectory()) {
      copyMatchingFiles(sourcePath, destinationPath, shouldCopy);
      continue;
    }

    if (entry.isFile() && shouldCopy(entry.name)) {
      copyFile(sourcePath, destinationPath);
    }
  }
};

const countProtoFiles = function (directory) {
  let count = 0;

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      count += countProtoFiles(entryPath);
    }
    else if (entry.isFile() && entry.name.endsWith('.proto')) {
      count += 1;
    }
  }

  return count;
};

const writeReadme = function (revision) {
  fs.writeFileSync(
    path.join(fixtureDir, 'README.md'),
    `# protobuf.js Tests/Data Fixtures

These fixtures mirror the \`.proto\` files from:

https://github.com/protobufjs/protobuf.js/tree/master/tests/data

Imported upstream revision:

\`${revision}\`

Only \`.proto\` files and relevant license files are copied. Generated upstream
JavaScript, TypeScript declarations, JSON, binary, and text fixtures are not
copied because this project only uses the schema corpus.

Some upstream \`.proto\` files are intentionally invalid or reference missing
imports. Tests keep those files in the corpus and assert their expected parser
failures instead of omitting them.
`,
  );
};

if (!fs.existsSync(upstreamDir)) {
  run('git', ['clone', '--depth=1', upstreamUrl, upstreamDir], { stdio: 'inherit' });
}
else {
  run('git', ['fetch', '--depth=1', 'origin', 'master'], { cwd: upstreamDir, stdio: 'inherit' });
  run('git', ['checkout', 'FETCH_HEAD'], { cwd: upstreamDir, stdio: 'inherit' });
}

const revision = run('git', ['rev-parse', 'HEAD'], { cwd: upstreamDir });

fs.rmSync(fixtureDir, { recursive: true, force: true });
fs.mkdirSync(fixtureDir, { recursive: true });

copyMatchingFiles(upstreamDataDir, fixtureDir, function (fileName) {
  return fileName.endsWith('.proto') || fileName === 'LICENSE';
});
copyFile(path.join(upstreamDir, 'LICENSE'), path.join(fixtureDir, 'protobufjs-LICENSE'));
writeReadme(revision);

console.log(`Updated protobuf.js fixtures from ${revision}`);
console.log(`Copied ${countProtoFiles(fixtureDir)} .proto files to ${path.relative(repoRoot, fixtureDir)}`);
