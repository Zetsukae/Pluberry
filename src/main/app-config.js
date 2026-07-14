const path = require('node:path');
const fs = require('node:fs');
const { app } = require('electron');

function getResourcePath(filename) {
  const candidates = [
    path.join(__dirname, '..', '..', filename),
    path.join(app?.getAppPath?.() || __dirname, filename),
    path.join(process.resourcesPath || '', filename),
  ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return path.join(__dirname, '..', '..', filename);
}

function getAppAssetPath(relativePath) {
  return getResourcePath(path.join('assets', relativePath));
}

module.exports = {
  getResourcePath,
  getAppAssetPath,
};
