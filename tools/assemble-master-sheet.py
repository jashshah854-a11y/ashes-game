#!/usr/bin/env python3
# Master sheet v2 assembly for the Ashes of Empires art direction.
# Run: python3 tools/assemble-master-sheet.py
#
# Builds every v2 panel file, the P6 crop, the composite, and
# master-sheet.json from already selected, already logged sources
# (VISUAL_STRATEGY.md 2.2, MAP_TREATMENT.md 7.2). It makes no new
# rendition and selects nothing.
#
# Layout: a 4 by 3 grid of 768 by 768 cells, 3072 by 2304 total, cells
# touching with no gutters, row-major order:
#   row 1: P1 P2 P3 P4
#   row 2: P5 P6 P7 P8
#   row 3: P9 P10 EMPTY EMPTY
# The two unused cells are flat Paper #E6D8B5 (RGB 230,216,181). No text
# is drawn anywhere on the composite; master-sheet.json names each cell.
#
# Sources:
#   P1  art-direction/master-diorama-board.png (1536x1024), scaled to fit
#       768x512 LANCZOS, unedited, pasted at y 128 on a Paper canvas.
#   P2  art-direction/master-sheet/v2/panels/P2.png, built in code by
#       tools/master-sheet.js at Step 18a. Read only, never rewritten.
#   P3  R1-P3-c1, P4 R1-P4-c1, P5 R1-P5-c1, P7 R1-P7-c1, P8 R1-P8-c1,
#       P9 R1-P9-c2, P10 R1-P10-c1: each 1600x1600 under
#       art-direction/renditions/Pn/, resized to 768x768 LANCZOS.
#   P6  MAP-TGT-R0-c3 at art-direction/renditions/MAP-TGT/R0-MAP-TGT-c3.png
#       (1792x1344), crop box left 512, top 0, right 1280, bottom 768, no
#       resize. MAP_TREATMENT 7.2 replaces P6 with a 768 by 768 MAP-TGT
#       crop; this box centres the crop horizontally on the central black
#       river line and takes the north coast across its top, with both
#       faction ribbons in frame.
#
# Deterministic and idempotent: the same sources give byte identical
# outputs on every run (PNG written with fixed settings and no metadata).
# Exits nonzero if any source file is missing or has the wrong size.
import json
import os
import sys

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT_DIR = 'art-direction/master-sheet/v2'
PANEL_DIR = OUT_DIR + '/panels'
COMPOSITE = OUT_DIR + '/master-sheet-v2.png'
SHEET_JSON = OUT_DIR + '/master-sheet.json'

CELL = 768
COLUMNS = 4
ROWS = 3
PAPER = (230, 216, 181)

P6_BOX = (512, 0, 1280, 768)

RESIZED = 'resized 1600x1600 to 768x768 LANCZOS'

# Row-major cell order. kind: diorama, existing, resize, crop, empty.
CELLS = [
    {'panel': 'P1', 'kind': 'diorama', 'sourceLogId': 'master-sheet-v1 diorama',
     'sourceFile': 'art-direction/master-diorama-board.png', 'size': (1536, 1024),
     'transform': 'scaled to fit 768x512 centred on Paper, unedited'},
    {'panel': 'P2', 'kind': 'existing', 'sourceLogId': 'P2 code built',
     'sourceFile': PANEL_DIR + '/P2.png', 'size': (768, 768),
     'transform': 'existing code built panel, untouched'},
    {'panel': 'P3', 'kind': 'resize', 'sourceLogId': 'R1-P3-c1',
     'sourceFile': 'art-direction/renditions/P3/R1-P3-c1.png', 'size': (1600, 1600), 'transform': RESIZED},
    {'panel': 'P4', 'kind': 'resize', 'sourceLogId': 'R1-P4-c1',
     'sourceFile': 'art-direction/renditions/P4/R1-P4-c1.png', 'size': (1600, 1600), 'transform': RESIZED},
    {'panel': 'P5', 'kind': 'resize', 'sourceLogId': 'R1-P5-c1',
     'sourceFile': 'art-direction/renditions/P5/R1-P5-c1.png', 'size': (1600, 1600), 'transform': RESIZED},
    {'panel': 'P6', 'kind': 'crop', 'sourceLogId': 'MAP-TGT-R0-c3',
     'sourceFile': 'art-direction/renditions/MAP-TGT/R0-MAP-TGT-c3.png', 'size': (1792, 1344),
     'transform': 'crop box 512,0,1280,768 from 1792x1344, no resize'},
    {'panel': 'P7', 'kind': 'resize', 'sourceLogId': 'R1-P7-c1',
     'sourceFile': 'art-direction/renditions/P7/R1-P7-c1.png', 'size': (1600, 1600), 'transform': RESIZED},
    {'panel': 'P8', 'kind': 'resize', 'sourceLogId': 'R1-P8-c1',
     'sourceFile': 'art-direction/renditions/P8/R1-P8-c1.png', 'size': (1600, 1600), 'transform': RESIZED},
    {'panel': 'P9', 'kind': 'resize', 'sourceLogId': 'R1-P9-c2',
     'sourceFile': 'art-direction/renditions/P9/R1-P9-c2.png', 'size': (1600, 1600), 'transform': RESIZED},
    {'panel': 'P10', 'kind': 'resize', 'sourceLogId': 'R1-P10-c1',
     'sourceFile': 'art-direction/renditions/P10/R1-P10-c1.png', 'size': (1600, 1600), 'transform': RESIZED},
    {'panel': 'EMPTY', 'kind': 'empty', 'sourceLogId': None, 'sourceFile': None,
     'transform': 'Paper #E6D8B5 fill'},
    {'panel': 'EMPTY', 'kind': 'empty', 'sourceLogId': None, 'sourceFile': None,
     'transform': 'Paper #E6D8B5 fill'},
]


def fail(msg):
    sys.stderr.write('assemble-master-sheet: ' + msg + '\n')
    sys.exit(1)


def repo(rel):
    return os.path.join(ROOT, rel)


def load(cell):
    p = repo(cell['sourceFile'])
    if not os.path.isfile(p):
        fail('missing source for ' + cell['panel'] + ': ' + cell['sourceFile'])
    im = Image.open(p)
    im.load()
    if im.size != cell['size']:
        fail(cell['panel'] + ' source ' + cell['sourceFile'] + ' is ' + 'x'.join(map(str, im.size)) +
             ', expected ' + 'x'.join(map(str, cell['size'])))
    return im.convert('RGB')


def build_panel(cell, src):
    kind = cell['kind']
    if kind == 'diorama':
        canvas = Image.new('RGB', (CELL, CELL), PAPER)
        canvas.paste(src.resize((768, 512), Image.LANCZOS), (0, 128))
        return canvas
    if kind == 'existing':
        return src
    if kind == 'resize':
        return src.resize((CELL, CELL), Image.LANCZOS)
    if kind == 'crop':
        return src.crop(P6_BOX)
    return Image.new('RGB', (CELL, CELL), PAPER)


def save_png(im, rel):
    path = repo(rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, format='PNG', optimize=False, compress_level=9)


def main():
    # Check every source before writing anything.
    sources = {}
    for i, cell in enumerate(CELLS):
        if cell['sourceFile'] is not None:
            sources[i] = load(cell)

    composite = Image.new('RGB', (CELL * COLUMNS, CELL * ROWS), PAPER)
    entries = []
    for i, cell in enumerate(CELLS):
        row, column = divmod(i, COLUMNS)
        panel = build_panel(cell, sources.get(i))
        if panel.size != (CELL, CELL):
            fail(cell['panel'] + ' panel is ' + 'x'.join(map(str, panel.size)) + ', expected 768x768')
        if cell['kind'] in ('diorama', 'resize', 'crop'):
            save_png(panel, PANEL_DIR + '/' + cell['panel'] + '.png')
        composite.paste(panel, (column * CELL, row * CELL))
        entries.append({
            'panel': cell['panel'],
            'row': row + 1,
            'column': column + 1,
            'sourceLogId': cell['sourceLogId'],
            'sourceFile': cell['sourceFile'],
            'transform': cell['transform'],
        })

    save_png(composite, COMPOSITE)

    sheet = {
        'version': 'v2',
        'cellSize': CELL,
        'columns': COLUMNS,
        'rows': ROWS,
        'width': CELL * COLUMNS,
        'height': CELL * ROWS,
        'cells': entries,
    }
    with open(repo(SHEET_JSON), 'w', encoding='utf-8', newline='\n') as f:
        f.write(json.dumps(sheet, indent=2) + '\n')

    print('master sheet v2 written: ' + COMPOSITE + ' (' + str(CELL * COLUMNS) + 'x' + str(CELL * ROWS) + '), ' +
          str(sum(1 for c in CELLS if c['kind'] in ('diorama', 'resize', 'crop'))) + ' panels, ' + SHEET_JSON)
    return 0


if __name__ == '__main__':
    sys.exit(main())
