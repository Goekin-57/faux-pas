# Prépare les images uniques du chapitre 1 (faites avec ChatGPT) pour le jeu : découpe, détourage, raccords, atlas.
import json, base64, io
import numpy as np
from PIL import Image
from scipy import ndimage
D = '/tmp/claude-0/-home-claude/3f7854d1-44a1-55df-af76-c75e2bb012da/scratchpad/art/'
def seamless_x(im, ov):
    a = np.array(im).astype(np.float32); w = a.shape[1]
    out = a[:, :w - ov].copy()
    t = np.linspace(0, 1, ov)[None, :, None]
    out[:, :ov] = a[:, w - ov:] * (1 - t) + a[:, :ov] * t
    return Image.fromarray(out.clip(0, 255).astype(np.uint8), im.mode)
def seamless_y(im, ov):
    return seamless_x(im.transpose(Image.TRANSPOSE), ov).transpose(Image.TRANSPOSE)
def sc(im, f): return im.resize((max(1, round(im.width * f)), max(1, round(im.height * f))), Image.LANCZOS)
items = {}
# ---- objets ----
ob = Image.open(D + 'objets.png').convert('RGBA')
mask = ndimage.binary_dilation(np.array(ob)[:, :, 3] > 40, iterations=6)
lab, n = ndimage.label(mask)
boxes = [(s[1].start, s[0].start, s[1].stop, s[0].stop) for s in ndimage.find_objects(lab) if (s[1].stop - s[1].start) * (s[0].stop - s[0].start) > 3000]
boxes.sort(key=lambda b: (b[1] > 350, b[0]))
names = ['spikes', 'spring', 'coin_gold', 'hud_heart', 'door', 'sign', 'bush', 'tree', 'flower', 'mushroom_red', 'rock']
for nm, bx in zip(names, boxes):
    im = ob.crop(bx)
    al = np.array(im)[:, :, 3] > 40; lb, nn = ndimage.label(ndimage.binary_dilation(al, iterations=6))
    if nn > 1:
        big = 1 + int(np.argmax(ndimage.sum(al, lb, range(1, nn + 1))))
        arr = np.array(im); arr[:, :, 3] = np.where(lb == big, arr[:, :, 3], 0); im = Image.fromarray(arr, 'RGBA')
    im = im.crop(im.getbbox())
    items[nm] = sc(im, {'tree': 0.45, 'door': 0.4, 'sign': 0.4}.get(nm, 0.3))
# cœur vide pour le compteur de vies : même cœur en gris
h = np.array(items['hud_heart']).astype(np.float32); g = h[:, :, :3].mean(axis=2, keepdims=True)
dark = (g < 80)[:, :, 0]
e = np.concatenate([np.where(dark[:, :, None], h[:, :, :3], g * 0.55 + 70), h[:, :, 3:]], axis=2)
items['hud_heart_empty'] = Image.fromarray(e.clip(0, 255).astype(np.uint8), 'RGBA')
# ---- plateforme : bouts arrondis + tranche du milieu ----
pf = Image.open(D + 'plateforme.png').convert('RGBA')
Y0, Y1 = 190, 668
items['pf_l'] = sc(pf.crop((44, Y0, 366, Y1)), 0.25)
items['pf_m'] = sc(pf.crop((908, Y0, 1104, Y1)), 0.25)
items['pf_r'] = sc(pf.crop((1828, Y0, 2128, Y1)), 0.25)
# bandeau du dessus pour les grands sols (herbe + haut de la terre)
T1 = 432
items['top_l'] = sc(pf.crop((44, Y0, 366, T1)), 0.25)
items['top_m'] = sc(pf.crop((908, Y0, 1104, T1)), 0.25)
items['top_r'] = sc(pf.crop((1828, Y0, 2128, T1)), 0.25)
# terre (avec cailloux) raccordable dans les deux sens, teinte calée sur la plateforme
so = Image.open(D + 'sol.png').convert('RGB').crop((0, 600, 1254, 1045))
a = np.array(so).astype(np.float32); a *= np.array([245 / 237, 123 / 126, 63 / 69])[None, None, :]
so = Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGB')
so = seamless_y(seamless_x(so, 140), 90).convert('RGBA')
items['dirt'] = sc(so, 0.25)
ink = Image.new('RGBA', (4, 4), (56, 55, 68, 255)); items['ink'] = ink
# ---- atlas ----
PAD = 3; WMAX = 2048
order = sorted(items.items(), key=lambda kv: -kv[1].height)
x = y = rowh = 0; M = {}
A = Image.new('RGBA', (WMAX, 2048), (0, 0, 0, 0))
for nm, im in order:
    w, hh = im.width + PAD * 2, im.height + PAD * 2
    if x + w > WMAX: x = 0; y += rowh; rowh = 0
    big = im.resize((im.width + PAD * 2, im.height + PAD * 2), Image.NEAREST) if nm in ('dirt', 'pf_m', 'top_m', 'ink') else None
    if big: A.paste(big, (x, y))
    A.paste(im, (x + PAD, y + PAD)); M[nm] = [x + PAD, y + PAD, im.width, im.height]
    x += w; rowh = max(rowh, hh)
A = A.crop((0, 0, WMAX, y + rowh))
def png(im, q=True):
    b = io.BytesIO(); (im.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.NONE) if q else im).save(b, 'PNG', optimize=True); return b.getvalue()
atlas = png(A)
# ---- fonds ----
far = Image.open(D + 'lointain.png').convert('RGBA')
fa = np.array(far).astype(np.int32); sky = np.array([178, 221, 253])
dist = np.abs(fa[:, :, :3] - sky).sum(axis=2)
fa[:, :, 3] = np.clip((dist - 10) * 255 / 30, 0, 255)       # ciel rendu transparent : le ciel du niveau reste visible
far = seamless_x(Image.fromarray(fa.astype(np.uint8), 'RGBA').crop((4, 0, 2128 + 16, far.height)), 16)
far = sc(far, 0.6)
mid = Image.open(D + 'milieu.png').convert('RGBA').crop((12, 0, 2162, 724))
m2 = Image.new('RGBA', (mid.width * 2, mid.height)); m2.paste(mid, (0, 0)); m2.paste(mid.transpose(Image.FLIP_LEFT_RIGHT), (mid.width, 0)); mid = m2   # copie en miroir : raccord parfait
mid = sc(mid.crop((0, mid.getbbox()[1], mid.width, mid.height)), 0.5)
farb, midb = png(far), png(mid)
print('atlas', A.size, len(atlas), 'far', far.size, len(farb), 'mid', mid.size, len(midb))
A.save(D + 'atlas2.png'); far.save(D + 'far.png'); mid.save(D + 'mid.png')
js = '  const ART_MAP = ' + json.dumps(M, separators=(',', ':')) + ';\n'
js += '  const ART_SRC = "data:image/png;base64,' + base64.b64encode(atlas).decode() + '";\n'
js += '  const ART_FAR = "data:image/png;base64,' + base64.b64encode(farb).decode() + '";\n'
js += '  const ART_MID = "data:image/png;base64,' + base64.b64encode(midb).decode() + '";\n'
js += f'  const ART_FAR_SIZE = [{far.width}, {far.height}], ART_MID_SIZE = [{mid.width}, {mid.height}];\n'
open(D + 'art.js', 'w').write(js)
