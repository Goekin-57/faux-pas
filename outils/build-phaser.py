# Fabrique phaser/index.html : le même jeu, avec Phaser chargé pour le rendu WebGL du chapitre 1.
import os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
s = open(os.path.join(R, 'index.html')).read()
assert s.count('\n<script>\n') == 1
s = s.replace('\n<script>\n', '\n<script src="phaser.min.js"></script>\n<script>\n')
s = s.replace('<title>NOT SO FAST!</title>', '<title>NOT SO FAST! (Phaser)</title>')
open(os.path.join(R, 'phaser', 'index.html'), 'w').write(s)
print('phaser/index.html ok')
