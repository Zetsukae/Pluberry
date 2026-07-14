const fs = require('node:fs');
const path = require('node:path');

function loadDotEnvFile(filePath, env = process.env) {
  if (!filePath || !fs.existsSync(filePath)) {
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');

    if (key && typeof env[key] === 'undefined') {
      env[key] = value;
    }
  });

  return true;
}

function loadDotEnv(searchPaths = [], env = process.env) {
  const candidates = [];

  for (const entry of searchPaths) {
    if (!entry) continue;
    if (!candidates.includes(entry)) {
      candidates.push(entry);
    }
  }

  if (typeof process !== 'undefined' && process.resourcesPath) {
    const resourcesEnv = path.join(process.resourcesPath, '.env');
    if (!candidates.includes(resourcesEnv)) candidates.push(resourcesEnv);
  }

  for (const filePath of candidates) {
    if (loadDotEnvFile(filePath, env)) {
      return filePath;
    }
  }

  return null;
}

module.exports = {
  loadDotEnv,
  loadDotEnvFile,
};
