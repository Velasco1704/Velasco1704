#!/usr/bin/env node
// Generates the profile README SVG assets (header, stack card, footer) in dark
// and light variants. Dependency-free and deterministic.
//
// Source of truth: the portfolio's src/site/content.ts (palette, TECH, logoPath).
// Override the location with PORTFOLIO_PATH=/abs/path/to/portfolio-v3.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PORTFOLIO = "/Users/danielvelasco/Developer/personal/portfolio/portfolio-v3";
const portfolio = process.env.PORTFOLIO_PATH || DEFAULT_PORTFOLIO;
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "assets");
mkdirSync(outDir, { recursive: true });

// ---------------------------------------------------------------- parsing
const src = readFileSync(join(portfolio, "src/site/content.ts"), "utf8");

const logoPath = /export const logoPath = "([^"]+)"/.exec(src)?.[1];
if (!logoPath) throw new Error("logoPath not found in content.ts");

const paletteSrc = /export const palette = \{([^}]+)\}/.exec(src)?.[1] ?? "";
const pick = (key) => {
  const m = new RegExp(`\\b${key}:\\s*'(#[0-9a-fA-F]{6})'`).exec(paletteSrc);
  if (!m) throw new Error(`palette.${key} not found`);
  return m[1];
};
const brand = {
  bg: pick("bg"),
  bg2: pick("bg2"),
  outer: pick("bgOut"),
  card: pick("card"),
  border: pick("border"),
  fg: pick("fg"),
  muted: pick("muted"),
  accent: pick("accent"),
  accent2: pick("accent2"),
};

const techStart = src.indexOf("export const TECH: Tech[] = [");
const arrStart = src.indexOf("[", src.indexOf("=", techStart));
const arrEnd = src.indexOf("\n];", arrStart);
const TECH = JSON.parse(src.slice(arrStart, arrEnd + 2).replace(/,\s*\]$/, "]"));
if (!Array.isArray(TECH) || TECH.length < 10) throw new Error("TECH parse failed");

// ---------------------------------------------------------------- themes
const themes = {
  dark: {
    bg: brand.bg,
    bg2: brand.bg2,
    outer: brand.outer,
    card: brand.card,
    border: brand.border,
    fg: brand.fg,
    muted: brand.muted,
    accent: brand.accent, // highlight text / monogram fill
    glowA: brand.accent2,
    glowB: brand.accent,
    glowAOp: 0.22,
    glowBOp: 0.1,
    dot: "#ffffff",
    dotOp: 0.07,
    mono: brand.accent,
    monoStroke: brand.accent,
    tileFill: brand.card,
    tileOp: 0.55,
  },
  light: {
    bg: "#f6f8fa",
    bg2: "#eaeef2",
    outer: "#ffffff",
    card: "#ffffff",
    border: "#d0d7de",
    fg: "#1d242b",
    muted: "#57606a",
    accent: brand.accent2,
    glowA: brand.accent2,
    glowB: brand.accent2,
    glowAOp: 0.14,
    glowBOp: 0.06,
    dot: "#1d242b",
    dotOp: 0.08,
    mono: "#1d242b",
    monoStroke: brand.accent2,
    tileFill: "#ffffff",
    tileOp: 1,
  },
};

const FONT = "'Plus Jakarta Sans', 'Segoe UI', -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif";

// ---------------------------------------------------------------- helpers
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const f = (n) => Number(n.toFixed(2));

const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (h) => {
  const [r, g, b] = hexToRgb(h).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const darken = (h, k) =>
  "#" + hexToRgb(h).map((v) => Math.round(v * (1 - k)).toString(16).padStart(2, "0")).join("");

const lighten = (h, k) =>
  "#" + hexToRgb(h).map((v) => Math.round(v + (255 - v) * k).toString(16).padStart(2, "0")).join("");

/** Brand color adapted to the theme so icons stay legible. */
function iconColor(color, mode) {
  if (mode === "dark") return lum(color) < 0.16 ? lighten(color, 0.4) : color;
  const l = lum(color);
  if (l > 0.75) return themes.light.fg;
  if (l > 0.5) return darken(color, 0.4);
  if (l > 0.3) return darken(color, 0.25);
  return color;
}

/** DV monogram. Path lives in a 271x181 box (x10) and is y-flipped. */
function monogram({ x, y, w, fill, stroke, cls = "" }) {
  const k = w / 271;
  return (
    `<g transform="translate(${f(x)} ${f(y)}) scale(${f(k)})">` +
    `<g transform="translate(0 181) scale(0.1 -0.1)">` +
    `<path class="${cls}" pathLength="1" d="${logoPath}" fill="${fill}" stroke="${stroke}" stroke-width="9" stroke-linejoin="round"/>` +
    `</g></g>`
  );
}

function svgWrap(w, h, title, body) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">\n` +
    `<title>${esc(title)}</title>\n${body}\n</svg>\n`
  );
}

/** Rounded card background shared by every asset. */
function frame(w, h, t, id) {
  return `<defs>
<clipPath id="${id}-clip"><rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="20"/></clipPath>
<pattern id="${id}-dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="${t.dot}" fill-opacity="${t.dotOp}"/></pattern>
<linearGradient id="${id}-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.bg}"/><stop offset="1" stop-color="${t.bg2}"/></linearGradient>
<radialGradient id="${id}-gA" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${t.glowA}" stop-opacity="${t.glowAOp}"/><stop offset="1" stop-color="${t.glowA}" stop-opacity="0"/></radialGradient>
<radialGradient id="${id}-gB" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${t.glowB}" stop-opacity="${t.glowBOp}"/><stop offset="1" stop-color="${t.glowB}" stop-opacity="0"/></radialGradient>
</defs>`;
}

function backdrop(w, h, t, id, { glow = true } = {}) {
  const glows = glow
    ? `<ellipse class="drift" cx="${f(w * 0.78)}" cy="${f(h * 0.4)}" rx="${f(w * 0.3)}" ry="${f(h * 0.85)}" fill="url(#${id}-gA)"/>
<ellipse class="drift2" cx="${f(w * 0.95)}" cy="${f(h * 0.95)}" rx="${f(w * 0.2)}" ry="${f(h * 0.6)}" fill="url(#${id}-gB)"/>`
    : "";
  return `<g clip-path="url(#${id}-clip)">
<rect width="${w}" height="${h}" fill="url(#${id}-bg)"/>
<rect width="${w}" height="${h}" fill="url(#${id}-dots)"/>
${glows}
</g>
<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="20" fill="none" stroke="${t.border}" stroke-width="1"/>`;
}

// Animations run "from" a hidden state, so the static markup is the final state.
const ANIM_CSS = `
.draw{stroke-dasharray:1;stroke-dashoffset:0;animation:draw 2.2s ease-out both,fillin 1s ease-out 1.5s both}
.rise{animation:rise .9s ease-out both}
.r1{animation-delay:.25s}.r2{animation-delay:.45s}.r3{animation-delay:.65s}.r4{animation-delay:.85s}
.drift{animation:drift 14s ease-in-out infinite alternate}
.drift2{animation:drift 18s ease-in-out infinite alternate-reverse}
@keyframes draw{from{stroke-dashoffset:1;fill-opacity:0}}
@keyframes fillin{from{fill-opacity:0}}
@keyframes rise{from{opacity:0;transform:translateY(8px)}}
@keyframes drift{from{transform:translate(-36px,10px)}to{transform:translate(28px,-8px)}}
@media (prefers-reduced-motion:reduce){.draw,.rise,.drift,.drift2{animation:none}}`;

// ---------------------------------------------------------------- header
function header(mode) {
  const t = themes[mode];
  const W = 1200;
  const H = 360;
  const id = "h";
  const body = `${frame(W, H, t, id)}
<style>${ANIM_CSS}
text{font-family:${FONT}}
</style>
${backdrop(W, H, t, id)}
${monogram({ x: 880, y: 100, w: 240, fill: t.mono, stroke: t.monoStroke, cls: "draw" })}
<text class="rise r1" x="72" y="74" font-size="14" font-weight="700" letter-spacing="4" fill="${t.accent}">[ SOFTWARE DEVELOPER ]</text>
<text class="rise r2" x="70" y="146" font-size="62" font-weight="800" letter-spacing="-1.5" fill="${t.fg}">Daniel Velasco</text>
<text class="rise r2" x="72" y="182" font-size="19" font-weight="500" fill="${t.muted}">— Bogotá, Colombia  ·  5+ years writing code</text>
<line x1="72" y1="208" x2="132" y2="208" stroke="${t.accent}" stroke-width="2" stroke-linecap="round"/>
<text class="rise r3" x="72" y="250" font-size="27" font-weight="700" fill="${t.fg}">Building <tspan fill="${t.accent}">high-impact</tspan> digital experiences</text>
<text class="rise r3" x="72" y="284" font-size="27" font-weight="700" fill="${t.fg}">in the e-commerce ecosystem.</text>
<text class="rise r4" x="72" y="324" font-size="15" font-weight="500" letter-spacing="0.5" fill="${t.muted}">VTEX IO · Shopify · Next.js for B2C and B2B brands.</text>`;
  return svgWrap(W, H, "Daniel Velasco, Software Developer (Full-Stack). Building high-impact digital experiences in the e-commerce ecosystem.", body);
}

// ---------------------------------------------------------------- stack
function icon(tech, x, y, size, mode) {
  const color = iconColor(tech.c, mode);
  const k = f(size / 24);
  const attrs = tech.s
    ? `fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"`
    : `fill="${color}"`;
  return `<g transform="translate(${f(x)} ${f(y)}) scale(${k})"><path d="${tech.d}" ${attrs}/></g>`;
}

function stack(mode) {
  const t = themes[mode];
  const W = 1200;
  const PAD = 40;
  const inner = W - PAD * 2;
  const id = "s";
  let y = PAD;
  const parts = [];

  // CORE row
  const core = TECH.filter((x) => x.g === "core");
  parts.push(`<text x="${PAD}" y="${y + 12}" font-size="12" font-weight="700" letter-spacing="3.5" fill="${t.accent}">CORE</text>`);
  y += 30;
  const gap = 20;
  const cw = f((inner - gap * (core.length - 1)) / core.length);
  const ch = 100;
  core.forEach((c, i) => {
    const x = PAD + i * (cw + gap);
    parts.push(`<rect x="${f(x)}" y="${y}" width="${cw}" height="${ch}" rx="16" fill="${t.tileFill}" fill-opacity="${t.tileOp}" stroke="${t.border}"/>`);
    parts.push(icon(c, x + 26, y + (ch - 44) / 2, 44, mode));
    parts.push(`<text x="${f(x + 88)}" y="${y + 46}" font-size="23" font-weight="800" fill="${t.fg}">${esc(c.n)}</text>`);
    if (c.sub) parts.push(`<text x="${f(x + 88)}" y="${y + 70}" font-size="13" font-weight="500" fill="${t.muted}">${esc(c.sub)}</text>`);
  });
  y += ch + 34;

  // Groups
  const groups = [
    ["fe", "FRONTEND"],
    ["be", "BACKEND & DATA"],
    ["ops", "DEVOPS & QUALITY"],
  ];
  const cols = 6;
  const tg = 14;
  const tw = f((inner - tg * (cols - 1)) / cols);
  const th = 54;
  groups.forEach(([g, title], gi) => {
    const items = TECH.filter((x) => x.g === g);
    parts.push(`<text x="${PAD}" y="${y + 12}" font-size="12" font-weight="700" letter-spacing="3.5" fill="${t.accent}">${esc(title)}</text>`);
    y += 28;
    items.forEach((it, i) => {
      const x = PAD + (i % cols) * (tw + tg);
      const yy = y + Math.floor(i / cols) * (th + tg);
      parts.push(`<rect x="${f(x)}" y="${yy}" width="${tw}" height="${th}" rx="12" fill="${t.tileFill}" fill-opacity="${t.tileOp}" stroke="${t.border}"/>`);
      parts.push(icon(it, x + 16, yy + (th - 24) / 2, 24, mode));
      parts.push(`<text x="${f(x + 52)}" y="${yy + th / 2 + 5}" font-size="14" font-weight="700" fill="${t.fg}">${esc(it.n)}</text>`);
    });
    const rows = Math.ceil(items.length / cols);
    y += rows * th + (rows - 1) * tg + (gi < groups.length - 1 ? 30 : 0);
  });
  const H = y + PAD;
  const body = `${frame(W, H, t, id)}
<style>text{font-family:${FONT}}${ANIM_CSS.replace(/\.draw[^\n]*\n/, "")}</style>
${backdrop(W, H, t, id, { glow: true })}
${parts.join("\n")}`;
  return svgWrap(W, H, "Technology stack: VTEX IO, Shopify, Next.js, plus frontend, backend and data, and devops and quality tools.", body);
}

// ---------------------------------------------------------------- footer
function footer(mode) {
  const t = themes[mode];
  const W = 1200;
  const H = 96;
  const id = "f";
  const body = `${frame(W, H, t, id)}
<style>text{font-family:${FONT}}${ANIM_CSS}</style>
${backdrop(W, H, t, id, { glow: true })}
${monogram({ x: 40, y: 28, w: 63, fill: t.mono, stroke: t.monoStroke })}
<text x="128" y="54" font-size="17" font-weight="700" fill="${t.fg}">Creating exceptional digital experiences with clean code.</text>
<text x="1160" y="54" font-size="13" font-weight="600" letter-spacing="1" text-anchor="end" fill="${t.muted}">© Daniel Velasco</text>`;
  return svgWrap(W, H, "Creating exceptional digital experiences with clean code. © Daniel Velasco", body);
}

// ---------------------------------------------------------------- write
for (const mode of ["dark", "light"]) {
  writeFileSync(join(outDir, `header-${mode}.svg`), header(mode));
  writeFileSync(join(outDir, `stack-${mode}.svg`), stack(mode));
  writeFileSync(join(outDir, `footer-${mode}.svg`), footer(mode));
}
console.log(`Wrote 6 SVGs to ${outDir} (portfolio: ${portfolio}, ${TECH.length} tech items)`);
