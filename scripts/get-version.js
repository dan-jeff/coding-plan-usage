#!/usr/bin/env node

import { execSync } from 'child_process';
import process from 'process';

function getGitDescribe() {
  try {
    return execSync('git describe --tags --always --long --dirty', {
      encoding: 'utf-8',
    }).trim();
  } catch (error) {
    if (error.status === 128) {
      console.error('Error: Not a git repository');
    } else {
      console.error('Error: Failed to run git describe:', error.message);
    }
    process.exit(1);
  }
}

function parseGitDescribe(output) {
  const dirty = output.endsWith('-dirty');
  const cleanOutput = dirty ? output.slice(0, -6) : output;

  const match = cleanOutput.match(
    /^(?:(v)?(\d+\.\d+\.\d+))-(\d+)-g([0-9a-f]+)|^v?(\d+\.\d+\.\d+)$|^(?:g)?([0-9a-f]+)$/
  );

  if (!match) {
    console.error('Error: Unable to parse git describe output:', cleanOutput);
    process.exit(1);
  }

  const [_, __, tagVersion, commitsAhead, commitHash, exactTag, noTagHash] =
    match;

  let version;

  if (exactTag) {
    version = exactTag;
  } else if (tagVersion) {
    if (parseInt(commitsAhead) === 0) {
      version = tagVersion;
    } else {
      version = `${tagVersion}-dev.${commitsAhead}+${commitHash}`;
    }
  } else if (noTagHash) {
    version = `0.0.0-dev+${noTagHash}`;
  }

  if (dirty) {
    version += '-dirty';
  }

  return version;
}

const output = getGitDescribe();
const version = parseGitDescribe(output);
console.log(version);
