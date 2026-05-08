#!/usr/bin/env node
/**
 * build.js — Rd Bee Portfolio Build-Time CMS (ROBUST VERSION)
 * 
 * Handles ALL CMS data formats:
 * - brands/social as array [] or object { brands: [], items: [] }
 * - gallery items as strings or objects { image: "..." }
 * - image paths: /uploads/x.jpg, static/uploads/x.jpg, full URLs
 * - marquee/footer lists as strings or objects
 */

const fs = require('fs');
const path = require('path');

// ─── HELPERS ───────────────────────────────────────────

function readJSON(filepath) {
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (e) {
    console.warn(`⚠ Could not read ${filepath}:`, e.message);
    return null;
  }
}

function loadProjectFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => readJSON(path.join(dir, f)))
    .filter(Boolean)
    .sort((a, b) => (a.order || 99) - (b.order || 99));
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function nl2br(str) {
  if (!str) return '';
  return esc(str).replace(/\n/g, '<br>');
}

/** Universal image path resolver */
function img(val) {
  if (!val) return '';
  if (typeof val === 'object' && val !== null) return img(val.image || val.src || val.url || '');
  if (typeof val !== 'string') return '';
  const t = val.trim();
  if (!t) return '';
  if (t.startsWith('http://') || t.startsWith('https://')) return t;
  if (t.startsWith('static/')) return '/' + t.slice(7);
  if (!t.startsWith('/')) return '/' + t;
  return t;
}

/** Universal gallery resolver */
function resolveGallery(gallery) {
  if (!gallery || !Array.isArray(gallery)) return [];
  return gallery.map(item => img(item)).filter(Boolean);
}

/** Load array from data that might be [] or { key: [] } */
function loadArray(data, ...keys) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  for (const key of keys) {
    if (data[key] && Array.isArray(data[key])) return data[key];
  }
  return [];
}

/** Extract string from item that might be "str" or { key: "str" } */
function extractStr(item, ...keys) {
  if (typeof item === 'string') return item;
  if (typeof item === 'object' && item !== null) {
    for (const k of keys) { if (item[k]) return String(item[k]); }
  }
  return '';
}

// ─── LOAD DATA ─────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');

const settings = readJSON(path.join(DATA_DIR, 'settings.json')) || {};
const brands = loadArray(readJSON(path.join(DATA_DIR, 'brands.json')), 'brands').sort((a,b) => (a.order||99) - (b.order||99));
const social = loadArray(readJSON(path.join(DATA_DIR, 'social.json')), 'items').sort((a,b) => (a.order||99) - (b.order||99));
const projects = loadProjectFiles(path.join(DATA_DIR, 'projects'));

const packagesRaw = readJSON(path.join(DATA_DIR, 'packages.json')) || {};
const packages = {};
for (const [key, val] of Object.entries(packagesRaw)) {
  if (val && typeof val === 'object' && val.slug) packages[key] = val;
}

const marqueeItems = (settings.marquee_items || []).map(m => extractStr(m, 'item', 'label', 'text')).filter(Boolean);
const footerNavLinks = (settings.footer_nav_links || ['Work','Brands','Personal','About']).map(l => extractStr(l, 'link', 'label', 'text')).filter(Boolean);

console.log(`✓ Settings loaded`);
console.log(`✓ ${projects.length} projects, ${brands.length} brands, ${social.length} social, ${Object.keys(packages).length} packages`);

// ─── BUILD SECTIONS ────────────────────────────────────
const VISIBLE_COUNT = 6;

function buildBrandsDropdown() {
  return brands.map(b => {
    const isSoon = b.status === 'coming_soon';
    let links = '';
    if (b.projects && b.projects.length > 0) {
      links = b.projects.map(proj => {
        if (isSoon) {
          return `\n            <a class="dropdown-project-link" href="#" onclick="return false;" style="opacity:0.38;pointer-events:none;"><span>${esc(proj.title)}</span><span class="dropdown-project-tag">${esc(proj.tag||'')}</span></a>`;
        }
        let projIdx = -1;
        const bn = b.name.toLowerCase(), pt = proj.title.toLowerCase();
        projIdx = projects.findIndex(p => p.title && p.title.toLowerCase() === pt);
        if (projIdx < 0) projIdx = projects.findIndex(p => p.title && (p.title.toLowerCase().includes(pt) || pt.includes(p.title.toLowerCase())));
        if (projIdx < 0) projIdx = projects.findIndex(p => (p.title && p.title.toLowerCase().includes(bn)) || (p.client && p.client.toLowerCase().includes(bn)));
        if (projIdx < 0) { const ws = pt.split(/\s+/).filter(w=>w.length>3); projIdx = projects.findIndex(p => { const c = `${p.title} ${p.category} ${p.scope} ${p.client}`.toLowerCase(); return ws.filter(w=>c.includes(w)).length>=2; }); }
        const click = projIdx >= 0 ? `openProject(${projIdx}); closeBrands(); return false;` : `return false;`;
        return `\n            <a class="dropdown-project-link" href="#" onclick="${click}"><span>${esc(proj.title)}</span><span style="display:flex;align-items:center;gap:8px;"><span class="dropdown-project-tag">${esc(proj.tag||'')}</span><span class="dropdown-arrow">→</span></span></a>`;
      }).join('');
    } else {
      links = `\n            <a class="dropdown-project-link" href="#" onclick="return false;" style="opacity:0.38;pointer-events:none;"><span>Coming Soon</span><span class="dropdown-project-tag">${esc(b.industry||'')}</span></a>`;
    }
    return `\n          <div class="dropdown-brand"><span class="dropdown-brand-name">${esc(b.name)}</span>${links}\n          </div>`;
  }).join('');
}

function buildPackagesDropdown() {
  return Object.values(packages).sort((a,b) => (a.order||99)-(b.order||99)).map(pkg =>
    `\n            <a class="dropdown-project-link" href="#" onclick="openPackage('${esc(pkg.slug)}'); closePackageMenu(); return false;"><span>${esc(pkg.dropdown_label)}</span><span style="display:flex;align-items:center;gap:8px;"><span class="dropdown-project-tag">${esc(pkg.dropdown_tag)}</span><span class="dropdown-arrow">→</span></span></a>`
  ).join('');
}

function buildHeroImage() {
  const hi = img(settings.hero_image);
  if (hi) return `\n    <img src="${esc(hi)}" alt="Hero" style="width:100%;height:100%;object-fit:cover;display:block;opacity:0.88;">\n    <span class="hero-img-label">${esc(settings.hero_image_label||'Featured — 2025')}</span>`;
  return `\n    <div class="img-placeholder tone-1" style="height:100%;font-size:10px;letter-spacing:0.2em;">Hero Image</div>\n    <span class="hero-img-label">${esc(settings.hero_image_label||'Featured — 2025')}</span>`;
}

function buildMarquee() {
  const s = marqueeItems.map(i => `<span class="marquee-item">${esc(i)}</span><span class="marquee-dot"></span>`).join('\n    ');
  return `${s}\n    ${s}`;
}

function buildProjectsGrid() {
  return projects.map((p, i) => {
    const src = img(p.cover_image);
    const imgH = src ? `<img src="${esc(src)}" alt="${esc(p.title)}" style="width:100%;height:100%;object-fit:cover;opacity:0.9;transition:transform 0.7s cubic-bezier(0.25,0.46,0.45,0.94),opacity 0.5s ease;display:block;">` : `<div class="img-placeholder tone-${(i%6)+1}" style="height:100%;">Image</div>`;
    const hidden = i >= VISIBLE_COUNT ? ' hidden-card' : '';
    return `\n    <a class="project-card${hidden}" href="#" onclick="openProject(${i}); return false;"><div class="project-img-wrap">${imgH}</div><div class="project-info"><p class="project-category">${esc(p.category||'')}</p><h3 class="project-name">${esc(p.title||'').replace(/\s+(\S)/g,'<br>$1')}</h3></div></a>`;
  }).join('');
}

function buildFeaturedRow() {
  let feat = projects.filter(p => p.featured === true);
  if (!feat.length) feat = projects.slice(0, 2);
  return feat.slice(0, 2).map((p, i) => {
    const fi = projects.indexOf(p);
    const src = img(p.hero_image) || img(p.cover_image);
    const imgH = src ? `<img src="${esc(src)}" alt="${esc(p.title)}" style="width:100%;height:100%;object-fit:cover;opacity:0.88;transition:transform 0.8s ease,opacity 0.5s ease;display:block;">` : `<div class="img-placeholder tone-${i+2}" style="height:100%;">Campaign Image</div>`;
    return `\n    <a class="featured-card" href="#" onclick="openProject(${fi}); return false;"><div class="featured-img-wrap">${imgH}</div><div class="featured-meta">${esc(p.category||'')}</div><div class="featured-info"><p class="featured-eyebrow">${esc(p.scope||'')}</p><h3 class="featured-title">${esc(p.title||'')}</h3></div></a>`;
  }).join('');
}

function buildAboutStrip() {
  const igH = settings.instagram||'', igU = settings.instagram_url||`https://www.instagram.com/${igH.replace('@','')}`;
  return `\n    <div class="about-col"><p class="about-col-label">${esc(settings.about_designer_label||'Designer')}</p><p class="about-col-content">${nl2br(settings.about_designer_content||'')}</p><p class="about-col-sub">${nl2br(settings.about_designer_sub||'')}</p></div>\n    <div class="about-col"><p class="about-col-label">${esc(settings.about_expertise_label||'Expertise')}</p><p class="about-col-content">${nl2br(settings.about_expertise_content||'')}</p><p class="about-col-sub">${nl2br(settings.about_expertise_sub||'')}</p></div>\n    <div class="about-col"><p class="about-col-label">${esc(settings.about_contact_label||'Contact')}</p><p class="about-col-content" id="aboutEmail">${esc(settings.email||'')}</p><p class="about-col-sub">Instagram: <a href="${esc(igU)}" target="_blank" style="color:var(--black);text-decoration:none;">${esc(igH)}</a><br><a href="${esc(settings.behance||'')}" target="_blank" style="color:var(--black);text-decoration:none;">${esc(settings.behance_label||'Behance')}</a><br>${esc(settings.location||'')}</p></div>`;
}

function buildSocialStrip() {
  return social.map((s, i) => {
    const src = img(s.image);
    const imgH = src ? `<img src="${esc(src)}" alt="${esc(s.label)}" style="width:100%;height:100%;object-fit:cover;display:block;transition:transform 0.5s ease;">` : `<div class="img-placeholder tone-${(i%5)+1}" style="height:100%;">Post</div>`;
    return `\n    <div class="social-item"><div class="social-img-wrap">${imgH}</div><p class="social-label">${esc(s.label||'')}</p></div>`;
  }).join('');
}

function buildFooterNav() { return footerNavLinks.map(l => `      <a href="#${l.toLowerCase()}">${esc(l)}</a>`).join('\n'); }

function buildFooterConnect() {
  const p = [];
  if (settings.instagram) { const u = settings.instagram_url||`https://www.instagram.com/${settings.instagram.replace('@','')}`; p.push(`      <a href="${esc(u)}" target="_blank" id="footerInstagram">Instagram</a>`); }
  if (settings.behance) p.push(`      <a href="${esc(settings.behance)}" target="_blank" id="footerBehance">Behance</a>`);
  if (settings.email) p.push(`      <a href="mailto:${esc(settings.email)}" id="footerEmail">${esc(settings.email)}</a>`);
  return p.join('\n');
}

function buildProjectsJSArray() {
  return JSON.stringify(projects.map(p => ({
    title: p.title||'', category: p.category||'', client: p.client||'—', year: p.year||'—',
    scope: p.scope||'—', industry: p.industry||'—', description: p.description||'—',
    cover_image: img(p.cover_image), hero_image: img(p.hero_image)||img(p.cover_image),
    gallery: resolveGallery(p.gallery), featured: p.featured === true,
  })), null, 2);
}

function buildPackagesJSObject() { return JSON.stringify(packages, null, 2); }

// ─── INJECT INTO TEMPLATE ──────────────────────────────
const templatePath = path.join(__dirname, 'template.html');
if (!fs.existsSync(templatePath)) { console.error('✗ template.html not found!'); process.exit(1); }

let html = fs.readFileSync(templatePath, 'utf8');
const hc = Math.max(0, projects.length - VISIBLE_COUNT);

const R = {
  '{{LOGO_NAME}}': esc(settings.logo_name||'Rd Bee'),
  '{{SITE_STATUS}}': esc(settings.status||'Available for Projects'),
  '{{HERO_EYEBROW}}': esc(settings.tagline||''),
  '{{HERO_TITLE_LINE1}}': esc(settings.hero_title_line1||'Visual'),
  '{{HERO_TITLE_LINE2}}': esc(settings.hero_title_line2||'Brand'),
  '{{HERO_TITLE_LINE3}}': esc(settings.hero_title_line3||'Identity'),
  '{{HERO_DESC}}': nl2br(settings.hero_desc||''),
  '{{HERO_IMAGE}}': buildHeroImage(),
  '{{HERO_IMAGE_LABEL}}': esc(settings.hero_image_label||'Featured — 2025'),
  '{{MARQUEE_ITEMS}}': buildMarquee(),
  '{{PROJECTS_COUNT}}': `${String(projects.length).padStart(2,'0')} Projects`,
  '{{PROJECTS_GRID}}': buildProjectsGrid(),
  '{{LOAD_MORE_DISPLAY}}': hc > 0 ? 'flex' : 'none',
  '{{LOAD_MORE_COUNT}}': `+${hc} more`,
  '{{FEATURED_ROW}}': buildFeaturedRow(),
  '{{ABOUT_STRIP}}': buildAboutStrip(),
  '{{SOCIAL_HANDLE}}': esc(settings.instagram||'@nnhanlee'),
  '{{SOCIAL_STRIP}}': buildSocialStrip(),
  '{{BRANDS_DROPDOWN}}': buildBrandsDropdown(),
  '{{PACKAGES_DROPDOWN}}': buildPackagesDropdown(),
  '{{FOOTER_LOGO}}': esc(settings.logo_name||'Rd Bee'),
  '{{FOOTER_DESC}}': nl2br(settings.footer_desc||''),
  '{{FOOTER_NAV_LINKS}}': buildFooterNav(),
  '{{FOOTER_CONNECT}}': buildFooterConnect(),
  '{{FOOTER_COPYRIGHT}}': esc(settings.copyright||`© 2025 ${settings.logo_name||'Rd Bee'}. All rights reserved.`),
  '{{FOOTER_LOCATION}}': esc(settings.location||''),
  '{{PROJECTS_JS_DATA}}': buildProjectsJSArray(),
  '{{PACKAGES_JS_DATA}}': buildPackagesJSObject(),
  '{{INSTAGRAM_URL}}': esc(settings.instagram_url||`https://www.instagram.com/${(settings.instagram||'').replace('@','')}`),
};

for (const [k, v] of Object.entries(R)) html = html.split(k).join(v);

fs.writeFileSync(path.join(__dirname, 'index.html'), html, 'utf8');
console.log(`\n✓ Built index.html (${(html.length/1024).toFixed(1)} KB)`);
console.log(`  → ${projects.length} projects, ${brands.length} brands, ${social.length} social, ${Object.keys(packages).length} packages`);
