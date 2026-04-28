#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');

const root    = path.resolve(__dirname, '..');
const rootPkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = rootPkg.version;

const platforms = [
  'linux-x64', 'linux-arm64',
  'darwin-x64', 'darwin-arm64',
  'win32-x64', 'win32-arm64',
];

for (const platform of platforms) {
  const pkgPath = path.join(root, 'npm', `wx-voice-silk-${platform}`, 'package.json');
  const pkg     = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.version   = version;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`Updated wx-voice-silk-${platform} → ${version}`);
}

if (!rootPkg.optionalDependencies) rootPkg.optionalDependencies = {};
for (const platform of platforms) {
  rootPkg.optionalDependencies[`@binsee/wx-voice-silk-${platform}`] = version;
}
fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(rootPkg, null, 2) + '\n');
console.log(`Updated root optionalDependencies → ${version}`);
