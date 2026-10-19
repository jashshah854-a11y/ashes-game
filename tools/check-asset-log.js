// Asset log check for the Ashes of Empires asset pipeline.
// Run: node tools/check-asset-log.js
//
// Scans the assets directory at the repo root (one level up from this
// script) recursively for asset files, excluding assets/log itself,
// and requires every asset file to appear as an admitted final.file
// entry in some .jsonl log under assets/log. Prints one FAIL line per
// asset file the logs do not admit, then a summary line, and exits 1
// when any asset file fails.
//
// Usable as a module too: require it and call checkAssets(rootDir),
// which returns { counts: { assetFiles, admittedEntries }, failures }.
// The CLI part runs only when the file is the main module.
'use strict';

var fs = require('fs');
var path = require('path');

var ASSET_EXTS = { '.png': true, '.webp': true, '.jpg': true };
var LOG_DIR_NAME = path.join('assets', 'log');

function checkAssets(rootDir) {
  var assetsDir = path.join(rootDir, 'assets');
  var logDir = path.join(assetsDir, 'log');

  // Collect every admitted final.file from the .jsonl logs under
  // assets/log. A line counts when its status is "admitted" and it
  // names a final file.
  var admitted = {};
  var admittedEntries = 0;
  if (fs.existsSync(logDir)) {
    fs.readdirSync(logDir).sort().forEach(function (name) {
      if (name.slice(-6) !== '.jsonl') return;
      var lines = fs.readFileSync(path.join(logDir, name), 'utf8').split('\n');
      lines.forEach(function (line) {
        var text = line.trim();
        if (!text) return;
        var entry;
        try { entry = JSON.parse(text); } catch (e) { return; }
        if (entry && entry.status === 'admitted' && entry.final &&
            typeof entry.final.file === 'string') {
          admitted[entry.final.file] = true;
          admittedEntries++;
        }
      });
    });
  }

  // Walk every asset file under assets/, skipping the log directory
  // itself, and check each one against the admitted set. Repo relative
  // paths use forward slashes.
  var failures = [];
  var assetFiles = 0;

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).sort().forEach(function (name) {
      var full = path.join(dir, name);
      if (full === logDir) return;
      var stat = fs.statSync(full);
      if (stat.isDirectory()) {
        walk(full);
        return;
      }
      if (!ASSET_EXTS[path.extname(full).toLowerCase()]) return;
      assetFiles++;
      var rel = path.relative(rootDir, full).split(path.sep).join('/');
      if (!admitted[rel]) failures.push(rel);
    });
  }
  walk(assetsDir);

  return {
    counts: { assetFiles: assetFiles, admittedEntries: admittedEntries },
    failures: failures
  };
}

function main() {
  var rootDir = path.join(__dirname, '..');
  var result = checkAssets(rootDir);
  result.failures.forEach(function (rel) {
    console.log('FAIL ' + rel + ' is not admitted in the asset log');
  });
  console.log('ASSET LOG CHECK: ' + result.counts.assetFiles + ' asset files, ' +
    result.counts.admittedEntries + ' admitted log entries, ' +
    result.failures.length + ' failures');
  process.exit(result.failures.length === 0 ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = { checkAssets: checkAssets };
