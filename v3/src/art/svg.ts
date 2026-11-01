// Illustrations SVG originales (personnage et accessoires).
// Elles sont dessinées à 2x puis affichées à 0.5 pour rester nettes.

const ns = 'xmlns="http://www.w3.org/2000/svg"';

export interface SvgAsset {
  key: string;
  w: number;
  h: number;
  svg: string;
}

const INK = '#141B3D';
const MOUTH = '#6E2335';

export const SVG_ASSETS: SvgAsset[] = [
  // ---------------- Héros ----------------
  {
    key: 'hero-body', w: 112, h: 126,
    svg: `<svg ${ns} viewBox="0 0 112 126">
      <defs>
        <radialGradient id="b" cx="36%" cy="28%" r="78%">
          <stop offset="0" stop-color="#4659A0"/><stop offset=".5" stop-color="#26336E"/><stop offset="1" stop-color="#151C47"/>
        </radialGradient>
        <linearGradient id="rim" x1="0" x2="1"><stop offset=".55" stop-color="#7FD1C7" stop-opacity="0"/><stop offset="1" stop-color="#9FE3D8" stop-opacity=".55"/></linearGradient>
      </defs>
      <path d="M53 14 C47 3 58 -2 66 4 C70 7 69 12 64 13 C66 9 62 6 59 8 C57 10 58 13 60 15 Z" fill="#26336E"/>
      <path d="M56 12 C85 12 103 34 104 64 C106 98 88 120 56 120 C24 120 6 98 8 64 C9 34 27 12 56 12 Z" fill="url(#b)"/>
      <path d="M56 12 C85 12 103 34 104 64 C106 98 88 120 56 120 C24 120 6 98 8 64 C9 34 27 12 56 12 Z" fill="url(#rim)"/>
      <ellipse cx="38" cy="34" rx="16" ry="9" fill="#FFFFFF" opacity=".10" transform="rotate(-25 38 34)"/>
    </svg>`
  },
  {
    key: 'hero-face', w: 80, h: 58,
    svg: `<svg ${ns} viewBox="0 0 80 58">
      <defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FBF7EE"/><stop offset="1" stop-color="#E6DDCB"/></linearGradient></defs>
      <path d="M40 3 C64 3 77 14 77 29 C77 46 61 55 40 55 C19 55 3 46 3 29 C3 14 16 3 40 3 Z" fill="url(#f)"/>
      <ellipse cx="14" cy="38" rx="7" ry="4" fill="#F3A08A" opacity=".55"/>
      <ellipse cx="66" cy="38" rx="7" ry="4" fill="#F3A08A" opacity=".55"/>
    </svg>`
  },
  {
    key: 'hero-eye', w: 20, h: 28,
    svg: `<svg ${ns} viewBox="0 0 20 28">
      <ellipse cx="10" cy="14" rx="8.5" ry="12.5" fill="${INK}"/>
      <circle cx="13" cy="8" r="3.6" fill="#fff"/>
      <circle cx="7" cy="20" r="1.7" fill="#fff" opacity=".6"/>
    </svg>`
  },
  {
    key: 'hero-eye-x', w: 20, h: 28,
    svg: `<svg ${ns} viewBox="0 0 20 28"><path d="M3 7 L17 21 M17 7 L3 21" stroke="${INK}" stroke-width="4" stroke-linecap="round"/></svg>`
  },
  {
    key: 'hero-eye-happy', w: 20, h: 28,
    svg: `<svg ${ns} viewBox="0 0 20 28"><path d="M2 18 Q10 6 18 18" stroke="${INK}" stroke-width="4.5" fill="none" stroke-linecap="round"/></svg>`
  },
  {
    key: 'mouth-smile', w: 28, h: 18,
    svg: `<svg ${ns} viewBox="0 0 28 18"><path d="M6 5 Q14 17 22 5 Q14 9 6 5 Z" fill="${MOUTH}" stroke="${MOUTH}" stroke-width="2" stroke-linejoin="round"/></svg>`
  },
  {
    key: 'mouth-open', w: 28, h: 18,
    svg: `<svg ${ns} viewBox="0 0 28 18"><ellipse cx="14" cy="9" rx="5" ry="7" fill="${MOUTH}"/><ellipse cx="14" cy="12.5" rx="3" ry="2.2" fill="#E37A7A"/></svg>`
  },
  {
    key: 'mouth-worried', w: 28, h: 18,
    svg: `<svg ${ns} viewBox="0 0 28 18"><path d="M5 11 Q9.5 6 14 10.5 Q18.5 15 23 9" stroke="${MOUTH}" stroke-width="2.8" fill="none" stroke-linecap="round"/></svg>`
  },
  {
    key: 'mouth-grin', w: 28, h: 18,
    svg: `<svg ${ns} viewBox="0 0 28 18"><path d="M4 4 L24 4 Q24 16 14 16 Q4 16 4 4 Z" fill="${MOUTH}"/><path d="M6 4 L22 4 L21 7.5 L7 7.5 Z" fill="#fff"/><ellipse cx="14" cy="13" rx="5" ry="2.4" fill="#E37A7A"/></svg>`
  },
  {
    key: 'mouth-flat', w: 28, h: 18,
    svg: `<svg ${ns} viewBox="0 0 28 18"><path d="M8 9 L20 9" stroke="${MOUTH}" stroke-width="2.8" stroke-linecap="round"/></svg>`
  },
  {
    key: 'hero-foot', w: 30, h: 18,
    svg: `<svg ${ns} viewBox="0 0 30 18"><ellipse cx="15" cy="9" rx="13" ry="8" fill="#141A42"/><ellipse cx="12" cy="6" rx="6" ry="2.5" fill="#fff" opacity=".12"/></svg>`
  },
  {
    key: 'hero-hand', w: 18, h: 18,
    svg: `<svg ${ns} viewBox="0 0 18 18"><circle cx="9" cy="9" r="7.5" fill="#26336E"/><circle cx="7" cy="7" r="2.6" fill="#fff" opacity=".15"/></svg>`
  },
  {
    key: 'hero-scarf-band', w: 112, h: 34,
    svg: `<svg ${ns} viewBox="0 0 112 34">
      <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFA552"/><stop offset=".6" stop-color="#F28C38"/><stop offset="1" stop-color="#C9611F"/></linearGradient></defs>
      <path d="M6 10 Q56 24 106 10 Q108 20 104 26 Q56 38 8 26 Q4 20 6 10 Z" fill="url(#s)"/>
      <path d="M10 15 Q56 28 102 15" stroke="#FFD6A8" stroke-width="2" fill="none" opacity=".6"/>
      <path d="M12 22 Q56 34 100 22" stroke="#B4521A" stroke-width="2" fill="none" opacity=".45" stroke-dasharray="4 5"/>
    </svg>`
  },

  // ---------------- Point de contrôle : pot + bourgeon ----------------
  {
    key: 'cp-pot', w: 96, h: 84,
    svg: `<svg ${ns} viewBox="0 0 96 84">
      <defs><linearGradient id="p" x1="0" x2="1"><stop offset="0" stop-color="#C46B4E"/><stop offset=".45" stop-color="#E08A66"/><stop offset="1" stop-color="#A9553D"/></linearGradient></defs>
      <path d="M18 26 L78 26 L70 80 Q48 86 26 80 Z" fill="url(#p)"/>
      <rect x="10" y="12" width="76" height="18" rx="6" fill="#E89A75"/>
      <rect x="10" y="12" width="76" height="6" rx="3" fill="#F6B89A" opacity=".8"/>
      <path d="M24 46 Q48 54 72 46" stroke="#7FD1C7" stroke-width="5" fill="none" stroke-linecap="round" opacity=".9"/>
      <circle cx="34" cy="60" r="3" fill="#F7D774"/><circle cx="48" cy="63" r="3" fill="#F7D774"/><circle cx="62" cy="60" r="3" fill="#F7D774"/>
      <ellipse cx="48" cy="14" rx="34" ry="5" fill="#5B3A2E" opacity=".9"/>
    </svg>`
  },
  {
    key: 'cp-bud', w: 44, h: 60,
    svg: `<svg ${ns} viewBox="0 0 44 60">
      <path d="M22 4 C34 14 36 34 22 56 C8 34 10 14 22 4 Z" fill="#7DB386"/>
      <path d="M22 4 C30 14 31 30 22 50 Z" fill="#5E9A70"/>
      <path d="M22 4 C26 8 27 12 24 18 C20 12 19 8 22 4 Z" fill="#F6B89A"/>
    </svg>`
  },
  {
    key: 'cp-bloom', w: 96, h: 96,
    svg: `<svg ${ns} viewBox="0 0 96 96">
      <g transform="translate(48 48)">
        ${Array.from({ length: 12 }, (_, i) => `<ellipse rx="10" ry="24" cy="-24" fill="${i % 2 ? '#F7D774' : '#FBE38E'}" transform="rotate(${i * 30})"/>`).join('')}
        <circle r="17" fill="#E8846B"/>
        <circle r="12" fill="#C9614D"/>
        ${Array.from({ length: 10 }, (_, i) => `<circle r="1.8" cx="${Math.cos(i * 0.63) * 7}" cy="${Math.sin(i * 0.63) * 7}" fill="#F6B89A"/>`).join('')}
      </g>
    </svg>`
  },
  {
    key: 'leaf', w: 40, h: 22,
    svg: `<svg ${ns} viewBox="0 0 40 22"><path d="M2 11 Q20 -4 38 11 Q20 26 2 11 Z" fill="#7DB386"/><path d="M4 11 L36 11" stroke="#4E7A62" stroke-width="1.6"/></svg>`
  },

  // ---------------- Dionée (plante croqueuse suspendue) ----------------
  {
    key: 'snap-jaw', w: 132, h: 64,
    svg: `<svg ${ns} viewBox="0 0 132 64">
      <defs>
        <linearGradient id="o" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9CC59A"/><stop offset="1" stop-color="#5E9A70"/></linearGradient>
        <linearGradient id="i" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C9614D"/><stop offset="1" stop-color="#EE9A80"/></linearGradient>
      </defs>
      <path d="M6 50 Q66 -6 126 50 Z" fill="url(#o)"/>
      <path d="M16 50 Q66 6 116 50 Z" fill="url(#i)"/>
      ${Array.from({ length: 9 }, (_, i) => { const x = 14 + i * 13; return `<path d="M${x} 48 L${x + 5} 63 L${x + 10} 48 Z" fill="#FFF3DF"/>`; }).join('')}
      <path d="M40 22 Q66 8 92 22" stroke="#C7E3B8" stroke-width="3" fill="none" opacity=".7" stroke-linecap="round"/>
    </svg>`
  },
  {
    key: 'snap-eyes-closed', w: 60, h: 20,
    svg: `<svg ${ns} viewBox="0 0 60 20"><path d="M6 10 Q14 16 22 10 M38 10 Q46 16 54 10" stroke="#2F5446" stroke-width="3.5" fill="none" stroke-linecap="round"/></svg>`
  },
  {
    key: 'snap-eyes-open', w: 60, h: 24,
    svg: `<svg ${ns} viewBox="0 0 60 24">
      <ellipse cx="14" cy="12" rx="9" ry="10" fill="#FFF3DF"/><ellipse cx="46" cy="12" rx="9" ry="10" fill="#FFF3DF"/>
      <circle cx="15" cy="14" r="5" fill="#2A1530"/><circle cx="45" cy="14" r="5" fill="#2A1530"/>
      <path d="M4 3 L22 7 M56 3 L38 7" stroke="#2F5446" stroke-width="3.5" stroke-linecap="round"/>
    </svg>`
  },
  {
    key: 'hang-pot', w: 120, h: 76,
    svg: `<svg ${ns} viewBox="0 0 120 76">
      <defs><linearGradient id="hp" x1="0" x2="1"><stop offset="0" stop-color="#3E9E98"/><stop offset=".5" stop-color="#6FC2B8"/><stop offset="1" stop-color="#2E7C77"/></linearGradient></defs>
      <path d="M14 14 L106 14 Q104 60 60 72 Q16 60 14 14 Z" fill="url(#hp)"/>
      <rect x="8" y="6" width="104" height="14" rx="7" fill="#8FDCD2"/>
      <path d="M26 34 Q60 46 94 34" stroke="#F7D774" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M22 8 Q30 -4 40 8 M80 8 Q90 -4 98 8" stroke="#5E9A70" stroke-width="5" fill="none" stroke-linecap="round"/>
    </svg>`
  },

  // ---------------- Porte de sortie ----------------
  {
    key: 'door-frame', w: 180, h: 260,
    svg: `<svg ${ns} viewBox="0 0 180 260">
      <defs>
        <linearGradient id="fr" x1="0" x2="1"><stop offset="0" stop-color="#E9E4D8"/><stop offset=".5" stop-color="#FFFDF7"/><stop offset="1" stop-color="#CFC8B8"/></linearGradient>
      </defs>
      <path d="M14 256 L14 90 Q14 14 90 14 Q166 14 166 90 L166 256 Z" fill="url(#fr)"/>
      <path d="M30 256 L30 92 Q30 30 90 30 Q150 30 150 92 L150 256 Z" fill="#2B4A43"/>
      <path d="M90 14 L90 30 M40 40 L52 52 M140 40 L128 52" stroke="#BFB7A5" stroke-width="4"/>
      <circle cx="90" cy="22" r="6" fill="#F7D774"/>
      <rect x="6" y="248" width="168" height="12" rx="4" fill="#CFC8B8"/>
    </svg>`
  },
  {
    key: 'door-glow', w: 120, h: 230,
    svg: `<svg ${ns} viewBox="0 0 120 230">
      <defs><radialGradient id="gl" cx="50%" cy="60%" r="65%"><stop offset="0" stop-color="#FFF6D6"/><stop offset=".6" stop-color="#F7D774"/><stop offset="1" stop-color="#F6B89A"/></radialGradient></defs>
      <path d="M0 230 L0 62 Q0 0 60 0 Q120 0 120 62 L120 230 Z" fill="url(#gl)"/>
    </svg>`
  },
  {
    key: 'door-leaf', w: 120, h: 230,
    svg: `<svg ${ns} viewBox="0 0 120 230">
      <defs><linearGradient id="gp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#BFE9E1" stop-opacity=".85"/><stop offset=".5" stop-color="#E8FFF9" stop-opacity=".55"/><stop offset="1" stop-color="#9FD6CC" stop-opacity=".85"/></linearGradient></defs>
      <path d="M0 230 L0 62 Q0 0 60 0 Q120 0 120 62 L120 230 Z" fill="#F3EFE6"/>
      <path d="M10 112 L10 64 Q10 12 60 12 Q110 12 110 64 L110 112 Z" fill="url(#gp)"/>
      <rect x="10" y="122" width="44" height="96" rx="4" fill="url(#gp)"/>
      <rect x="66" y="122" width="44" height="96" rx="4" fill="url(#gp)"/>
      <path d="M60 12 L60 112 M10 70 L110 70" stroke="#F3EFE6" stroke-width="5"/>
      <path d="M22 30 L44 60" stroke="#fff" stroke-width="5" opacity=".7" stroke-linecap="round"/>
      <circle cx="98" cy="128" r="6" fill="#F7D774"/><circle cx="96" cy="126" r="2" fill="#fff"/>
    </svg>`
  },

  // ---------------- Logo / icônes UI ----------------
  {
    key: 'icon-wilt', w: 40, h: 40,
    svg: `<svg ${ns} viewBox="0 0 40 40"><path d="M20 38 Q20 24 24 18" stroke="#5E9A70" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <g transform="translate(26 14) rotate(35)">${Array.from({ length: 6 }, (_, i) => `<ellipse rx="4" ry="8" cy="-7" fill="#F6B89A" transform="rotate(${i * 60})"/>`).join('')}<circle r="5" fill="#E8846B"/></g>
      <path d="M12 30 Q6 26 8 20 Q14 22 16 30" fill="#7DB386"/></svg>`
  },
  {
    key: 'icon-clock', w: 40, h: 40,
    svg: `<svg ${ns} viewBox="0 0 40 40"><circle cx="20" cy="21" r="15" fill="none" stroke="#FFF1C9" stroke-width="3.5"/><path d="M20 12 L20 21 L27 25" stroke="#FFF1C9" stroke-width="3.5" fill="none" stroke-linecap="round"/><rect x="16" y="2" width="8" height="5" rx="2" fill="#FFF1C9"/></svg>`
  },
  {
    key: 'icon-pause', w: 40, h: 40,
    svg: `<svg ${ns} viewBox="0 0 40 40"><rect x="11" y="9" width="6" height="22" rx="3" fill="#FFF1C9"/><rect x="23" y="9" width="6" height="22" rx="3" fill="#FFF1C9"/></svg>`
  },
  {
    key: 'icon-arrow', w: 64, h: 64,
    svg: `<svg ${ns} viewBox="0 0 64 64"><path d="M40 14 L22 32 L40 50" stroke="#FFF1C9" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  },
  {
    key: 'icon-jump', w: 64, h: 64,
    svg: `<svg ${ns} viewBox="0 0 64 64"><path d="M16 40 L32 22 L48 40" stroke="#FFF1C9" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  },
  {
    key: 'icon-lock', w: 40, h: 40,
    svg: `<svg ${ns} viewBox="0 0 40 40"><path d="M13 18 L13 13 Q13 6 20 6 Q27 6 27 13 L27 18" stroke="currentColor" stroke-width="3.5" fill="none" style="color:#FFF1C9"/><rect x="9" y="17" width="22" height="17" rx="4" fill="#FFF1C9"/></svg>`
  }
];
