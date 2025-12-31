#!/usr/bin/env node

import { readFileSync, writeFileSync, renameSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import process from 'process';

function getVersion() {
  try {
    return execSync('node scripts/get-version.js', {
      encoding: 'utf-8',
    }).trim();
  } catch (error) {
    console.error('Error: Failed to get version:', error.message);
    process.exit(1);
  }
}

function updatePackageJson(version) {
  const packageJsonPath = join(process.cwd(), 'package.json');
  const tempPath = packageJsonPath + '.tmp';

  const content = readFileSync(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(content);
  packageJson.version = version;

  const updatedContent = JSON.stringify(packageJson, null, 2) + '\n';

  writeFileSync(tempPath, updatedContent, 'utf8');
  renameSync(tempPath, packageJsonPath);
}

const version = getVersion();
updatePackageJson(version);
console.log(`✓ Version stamped: ${version}`);
