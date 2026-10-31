# Construit l'atlas d'images du chapitre 1 à partir du New Platformer Pack (Kenney, CC0)
import json, base64, io, sys
from PIL import Image
SRC = '/tmp/claude-0/-home-claude/3f7854d1-44a1-55df-af76-c75e2bb012da/scratchpad/np/src/Sprites/'
OUT = '/tmp/claude-0/-home-claude/3f7854d1-44a1-55df-af76-c75e2bb012da/scratchpad/skin/'
TILE = 96
items = []   # (name, image)
sets = ['grass']
parts = ['block_top_left', 'block_top', 'block_top_right', 'block_left', 'block_center', 'block_right', 'block_bottom_left', 'block_bottom', 'block_bottom_right',
         'block', 'horizontal_left', 'horizontal_middle', 'horizontal_right', 'vertical_top', 'vertical_middle', 'vertical_bottom']
for s in sets:
    for p in parts:
        n = f'terrain_{s}_{p}'
        items.append((n, Image.open(SRC + f'Tiles/Double/{n}.png').convert('RGBA').resize((TILE, TILE), Image.LANCZOS), True))
objs = ['spikes', 'spring', 'spring_out', 'door_open', 'door_open_top', 'door_closed', 'door_closed_top', 'coin_gold', 'coin_gold_side', 'hud_heart', 'hud_heart_empty',
        'bush', 'grass', 'mushroom_red', 'mushroom_brown', 'rock', 'fence', 'flag_green_a', 'flag_green_b']
for n in objs:
    im = Image.open(SRC + f'Tiles/Double/{n}.png').convert('RGBA')
    im = im.crop(im.getbbox()); im = im.resize((round(im.width * .75), round(im.height * .75)), Image.LANCZOS)
    items.append((n, im, False))
for n in ['snail_walk_a', 'snail_walk_b', 'snail_shell', 'snail_rest']:
    im = Image.open(SRC + f'Enemies/Double/{n}.png').convert('RGBA')
    im = im.crop(im.getbbox()); im = im.resize((round(im.width * .6), round(im.height * .6)), Image.LANCZOS)
    items.append((n, im, False))
# fond : collines, ciel blanc rendu transparent (le ciel du jeu reste visible)
bg = Image.open(SRC + 'Backgrounds/Double/background_color_hills.png').convert('RGBA').crop((0, 220, 512, 512))
px = bg.load()
for y in range(bg.height):
    for x in range(bg.width):
        r, g, b, a = px[x, y]
        d = (255 - r) + (255 - g) + (255 - b)
        if d < 60: px[x, y] = (r, g, b, int(255 * d / 60))   # fondu doux autour du blanc
items.append(('bg_hills', bg, True))
# rangement en étagères
PAD = 2; WMAX = 1024
items.sort(key=lambda it: -it[1].height)
x = y = rowh = 0; pos = {}
for n, im, ext in items:
    w, h = im.width + PAD * 2, im.height + PAD * 2
    if x + w > WMAX: x = 0; y += rowh; rowh = 0
    pos[n] = (x, y); x += w; rowh = max(rowh, h)
H = y + rowh
A = Image.new('RGBA', (WMAX, H), (0, 0, 0, 0))
M = {}
for n, im, ext in items:
    x, y = pos[n]
    if ext:   # bords étirés pour éviter les liserés entre tuiles
        big = im.resize((im.width + PAD * 2, im.height + PAD * 2), Image.NEAREST)
        A.paste(big, (x, y))
    A.paste(im, (x + PAD, y + PAD))
    M[n] = [x + PAD, y + PAD, im.width, im.height]
q = A.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.NONE)
buf = io.BytesIO(); q.save(buf, 'PNG', optimize=True)
raw = io.BytesIO(); A.save(raw, 'PNG', optimize=True)
data = buf.getvalue()
print('atlas', A.size, 'png', len(raw.getvalue()), 'quant', len(data))
open(OUT + 'atlas.png', 'wb').write(data)
open(OUT + 'atlas.js', 'w').write('  const SKIN_MAP = ' + json.dumps(M, separators=(',', ':')) + ';\n  const SKIN_SRC = "data:image/png;base64,' + base64.b64encode(data).decode() + '";\n')
