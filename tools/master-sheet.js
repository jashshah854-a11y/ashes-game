// Master sheet v2 helper for the Ashes of Empires art pipeline.
// Run: node tools/master-sheet.js p2 <out-path>
//      node tools/master-sheet.js check [manifest-path]
//
// Two jobs, both for VISUAL_STRATEGY.md section 2.2 (master sheet v2):
//
// 1. buildP2() draws panel P2, the palette strip, in code and returns it
//    as a 768 x 768 PNG Buffer. Layout (deterministic, no text):
//    - Top half, rows 0 to 383: five equal vertical swatch columns in
//      palette order (Paper, Ink, Vessari blue, Khessite red, Ember).
//      Column c spans x from floor(c * 768 / 5) to floor((c + 1) * 768 / 5),
//      so the widths are 153 or 154 px and the five exactly fill 768.
//    - Bottom half, rows 384 to 767: a 13-step luma ramp. Step i (0 to 12)
//      is the neutral gray (v, v, v) with v = round(i * 255 / 12), and
//      spans x from floor(i * 768 / 13) to floor((i + 1) * 768 / 13), so
//      the widths are 59 or 60 px and the 13 exactly fill 768. A neutral
//      gray's Rec. 709 luma equals v, so the ramp walks through the five
//      value bands in BANDS from black to white.
//    The PNG is encoded with node zlib only: signature, IHDR (8 bit,
//    color type 2 RGB, no interlace), one IDAT with filter byte 0 on every
//    scanline, IEND, and a CRC32 (implemented below) on each chunk.
//
// 2. validateManifest(manifest) checks a master sheet v2 manifest
//    ({ version: "v2", panels: { P1: {...}, ... P10: {...} } }) and
//    returns { ok, errors, panels }. A panel status is "built", "sourced",
//    or "pending"; built and sourced panels name a file, pending panels
//    do not. Pending is an honest state, not an error.
//
// Usable as a module too: require it for PALETTE, BANDS, REQUIRED_PANELS,
// hexToRgb, luma, buildP2, and validateManifest. The CLI part runs only
// when the file is the main module.
'use strict';

var fs = require('fs');
var path = require('path');
var zlib = require('zlib');

var PALETTE = [
  { name: 'Paper', hex: '#E6D8B5' },
  { name: 'Ink', hex: '#2B2620' },
  { name: 'Vessari blue', hex: '#2E6FD8' },
  { name: 'Khessite red', hex: '#C8372D' },
  { name: 'Ember', hex: '#F29A2E' }
];

var BANDS = [
  { name: 'Ink', min: 0, max: 40 },
  { name: 'Terrain', min: 60, max: 150 },
  { name: 'Last seen', min: 120, max: 175 },
  { name: 'Unknown', min: 185, max: 225 },
  { name: 'State lights', min: 225, max: 255 }
];

var REQUIRED_PANELS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10'];
var STATUSES = { built: true, sourced: true, pending: true };

var P2_SIZE = 768;
var RAMP_STEPS = 13;
var DEFAULT_MANIFEST = path.join(__dirname, '..', 'art-direction', 'master-sheet', 'v2', 'manifest.json');

function hexToRgb(hex) {
  var h = String(hex).replace(/^#/, '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16)
  };
}

function luma(rgb) {
  var y = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
  return Math.round(y * 100) / 100;
}

// CRC32 (IEEE, reflected, polynomial 0xEDB88320) as PNG chunks need it.
var CRC_TABLE = (function () {
  var table = new Array(256);
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  var c = 0xFFFFFFFF;
  for (var i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  var len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  var typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  var crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

function encodePngRgb(width, height, rgbRows) {
  var ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // color type: RGB
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter method
  ihdr[12] = 0;  // no interlace
  var stride = 1 + width * 3;
  var raw = Buffer.alloc(stride * height);
  for (var y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter byte 0 (none)
    rgbRows[y].copy(raw, y * stride + 1);
  }
  var signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

// Fills one scanline with n equal columns; column c spans
// floor(c * width / n) to floor((c + 1) * width / n).
function columnRow(width, colors) {
  var n = colors.length;
  var row = Buffer.alloc(width * 3);
  for (var c = 0; c < n; c++) {
    var x0 = Math.floor(c * width / n);
    var x1 = Math.floor((c + 1) * width / n);
    for (var x = x0; x < x1; x++) {
      row[x * 3] = colors[c].r;
      row[x * 3 + 1] = colors[c].g;
      row[x * 3 + 2] = colors[c].b;
    }
  }
  return row;
}

function buildP2() {
  var swatches = PALETTE.map(function (p) { return hexToRgb(p.hex); });
  var ramp = [];
  for (var i = 0; i < RAMP_STEPS; i++) {
    var v = Math.round(i * 255 / (RAMP_STEPS - 1));
    ramp.push({ r: v, g: v, b: v });
  }
  var topRow = columnRow(P2_SIZE, swatches);
  var bottomRow = columnRow(P2_SIZE, ramp);
  var rows = [];
  for (var y = 0; y < P2_SIZE; y++) rows.push(y < P2_SIZE / 2 ? topRow : bottomRow);
  return encodePngRgb(P2_SIZE, P2_SIZE, rows);
}

function validateManifest(manifest) {
  var errors = [];
  var panels = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    errors.push('manifest is not an object');
    return { ok: false, errors: errors, panels: panels };
  }
  if (manifest.version !== 'v2') errors.push('version is ' + JSON.stringify(manifest.version) + ', expected "v2"');
  var table = (manifest.panels && typeof manifest.panels === 'object') ? manifest.panels : {};
  if (!manifest.panels || typeof manifest.panels !== 'object') errors.push('panels is not an object');
  REQUIRED_PANELS.forEach(function (id) {
    var p = table[id];
    if (!p || typeof p !== 'object') {
      errors.push(id + ' is missing');
      panels.push({ id: id, status: 'missing', file: null, session: null, note: '' });
      return;
    }
    var status = p.status;
    var hasFile = typeof p.file === 'string' && p.file.length > 0;
    if (!STATUSES[status]) {
      errors.push(id + ' has unknown status ' + JSON.stringify(status));
    } else if ((status === 'built' || status === 'sourced') && !hasFile) {
      errors.push(id + ' is ' + status + ' but names no file');
    } else if (status === 'pending' && p.file !== undefined && p.file !== null) {
      errors.push(id + ' is pending but names a file');
    }
    panels.push({
      id: id,
      status: status,
      file: hasFile ? p.file : null,
      session: p.session || null,
      note: p.note || ''
    });
  });
  return { ok: errors.length === 0, errors: errors, panels: panels };
}

function main(argv) {
  var cmd = argv[0];
  if (cmd === 'p2' && argv.length === 2) {
    var out = path.resolve(argv[1]);
    var png = buildP2();
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, png);
    console.log('P2 written: ' + out + ' (' + png.length + ' bytes)');
    return 0;
  }
  if (cmd === 'check' && argv.length <= 2) {
    var file = argv[1] ? path.resolve(argv[1]) : DEFAULT_MANIFEST;
    var manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      console.log('cannot read manifest ' + file + ': ' + e.message);
      return 2;
    }
    var result = validateManifest(manifest);
    result.panels.forEach(function (p) {
      var detail = p.file ? p.file : (p.session ? 'session ' + p.session + ': ' + p.note : p.note);
      console.log(p.id + ' ' + p.status + ' ' + detail);
    });
    result.errors.forEach(function (e) { console.log('ERROR ' + e); });
    var counts = { built: 0, sourced: 0, pending: 0 };
    result.panels.forEach(function (p) { if (counts[p.status] !== undefined) counts[p.status]++; });
    console.log((result.ok ? 'OK' : 'FAIL') + ': ' + result.panels.length + ' panels, ' +
      counts.built + ' built, ' + counts.sourced + ' sourced, ' + counts.pending + ' pending, ' +
      result.errors.length + ' errors');
    return result.ok ? 0 : 1;
  }
  console.log('usage: node tools/master-sheet.js p2 <out-path> | check [manifest-path]');
  return 2;
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}

module.exports = {
  PALETTE: PALETTE,
  BANDS: BANDS,
  REQUIRED_PANELS: REQUIRED_PANELS,
  hexToRgb: hexToRgb,
  luma: luma,
  buildP2: buildP2,
  validateManifest: validateManifest
};
