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
const warehouse = loadArray(readJSON(path.join(DATA_DIR, 'warehouse.json')), 'posts').sort((a,b) => (a.order||99) - (b.order||99));
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

// ─── WAREHOUSE (Social "kho") ──────────────────────────
const WH_FORMATS = {
  s1_square:    { label:"Style 1 · 1 ảnh vuông (900×900)",        n:1, ar:"1 / 1" },
  s1_landscape: { label:"Style 1 · 1 ảnh ngang (1200×900)",       n:1, ar:"4 / 3" },
  s1_event:     { label:"Style 1 · 1 ảnh event cover (1200×628)", n:1, ar:"1200 / 628" },
  s1_link:      { label:"Style 1 · 1 ảnh share link (1200×518)",  n:1, ar:"1200 / 518" },
  s1_story:     { label:"Style 1 · 1 ảnh story (1080×1920)",      n:1, ar:"9 / 16" },
  s2:  { label:"Style 2 · 2 ảnh vuông cạnh nhau",  n:2, ar:"2 / 1",   cols:"1fr 1fr",     rows:"1fr",        cells:[{},{}], flat:true },
  s3:  { label:"Style 3 · 2 ảnh dọc cạnh nhau",    n:2, ar:"1 / 1",   cols:"1fr 1fr",     rows:"1fr",        cells:[{},{}] },
  s4:  { label:"Style 4 · 2 ảnh ngang xếp dọc",    n:2, ar:"1 / 1",   cols:"1fr",         rows:"1fr 1fr",    cells:[{},{}] },
  s5:  { label:"Style 5 · 3 ảnh vuông hàng ngang", n:3, ar:"3 / 1",   cols:"1fr 1fr 1fr", rows:"1fr",        cells:[{},{},{}], flat:true },
  s6:  { label:"Style 6 · 1 dọc trái + 2 phải",    n:3, ar:"1 / 1",   cols:"1fr 1fr",     rows:"1fr 1fr",    cells:[{s:"grid-column:1;grid-row:1 / span 2"},{s:"grid-column:2"},{s:"grid-column:2"}] },
  s7:  { label:"Style 7 · 1 ngang trên + 2 dưới",  n:3, ar:"1 / 1",   cols:"1fr 1fr",     rows:"1fr 1fr",    cells:[{s:"grid-column:1 / span 2;grid-row:1"},{s:"grid-row:2"},{s:"grid-row:2"}] },
  s8:  { label:"Style 8 · Lưới 2×2",               n:4, ar:"1 / 1",   cols:"1fr 1fr",     rows:"1fr 1fr",    cells:[{},{},{},{}] },
  s9:  { label:"Style 9 · 1 bìa dọc + 3 phải (598×900)", n:4, ar:"1 / 1", cols:"2fr 1fr", rows:"1fr 1fr 1fr", cells:[{s:"grid-column:1;grid-row:1 / span 3"},{s:"grid-column:2"},{s:"grid-column:2"},{s:"grid-column:2"}] },
  s10: { label:"Style 10 · 1 ngang trên + 3 dưới", n:4, ar:"1 / 1",   cols:"1fr 1fr 1fr", rows:"2fr 1fr",    cells:[{s:"grid-column:1 / span 3;grid-row:1"},{s:"grid-row:2"},{s:"grid-row:2"},{s:"grid-row:2"}] },
};
function whCell(src, style) {
  return `<div class="wh-cell"${style?` style="${style}"`:''}><img src="${esc(src)}" alt="" loading="lazy"></div>`;
}
function whMedia(post) {
  const imgs = resolveGallery(post.images);
  const fmt = WH_FORMATS[post.format] || WH_FORMATS.s1_square;
  if (!imgs.length) return `<div class="wh-media" style="aspect-ratio:${fmt.ar||'1 / 1'}"><div class="img-placeholder tone-1" style="height:100%;">Post</div></div>`;
  if ((fmt.n||1) === 1 || !fmt.cells) {
    return `<div class="wh-media" style="aspect-ratio:${fmt.ar||'1 / 1'}"><img src="${esc(imgs[0])}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;"></div>`;
  }
  const cells = fmt.cells.map((c,i)=> imgs[i] ? whCell(imgs[i], c.s||'') : '').join('');
  const gs = `aspect-ratio:${fmt.ar};grid-template-columns:${fmt.cols};grid-template-rows:${fmt.rows}`;
  return `<div class="wh-media"><div class="wh-collage" style="${gs}">${cells}</div></div>`;
}
function fmtWHDate(d){ if(!d) return ''; try { return new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); } catch(e){ return String(d); } }
function whBrandList() {
  const seen = [];
  warehouse.forEach(p => { const b = (p.brand||'').trim(); if (b && !seen.includes(b)) seen.push(b); });
  return seen;
}
function buildWhChips() {
  const brands = whBrandList();
  if (!brands.length) return '';
  const chip = (b,label,on) => `<button class="wh-chip${on?' on':''}" data-brand="${esc(b)}">${esc(label)}</button>`;
  return `<div class="wh-chips" id="whChips">${chip('__all__','All',true)}${brands.map(b=>chip(b,b,false)).join('')}</div>`;
}
function buildWarehouseFeed() {
  if (!warehouse.length) return `<p class="wh-empty">Chưa có bài nào trong kho. Thêm bài trong CMS hoặc data/warehouse.json.</p>`;
  return warehouse.map((p)=>{
    const brand = (p.brand||'').trim();
    const fmt = WH_FORMATS[p.format] || WH_FORMATS.s1_square;
    const cls = `wh-post ${fmt.flat ? 'flat' : 'pol'}${p.film ? ' wh-film' : ''}`;
    return `\n    <article class="${cls}" data-brand="${esc(brand)}">${whMedia(p)}<div class="wh-post-foot">${brand?`<p class="wh-brand">${esc(brand)}</p>`:''}<p class="wh-caption">${nl2br(p.caption||'')}</p><p class="wh-meta"><span>${esc(fmtWHDate(p.date))}</span></p></div></article>`;
  }).join('');
}

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
  '{{WAREHOUSE_LABEL}}': esc(settings.warehouse_label||'The Warehouse'),
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

// ─── BUILD WAREHOUSE PAGE (/warehouse) ─────────────────
const WH_LABEL = settings.warehouse_label || 'The Warehouse';
const styleBlock  = (html.match(/<style>[\s\S]*?<\/style>/) || [''])[0];
const footerBlock = ((html.match(/<footer>[\s\S]*?<\/footer>/) || [''])[0]).replace(/href="#/g, 'href="/#');

const WH_CSS = `
  .wh-wrap{padding:92px 28px 40px;max-width:1180px;margin:0 auto;}
  .wh-intro{font-family:var(--font-mono);font-size:13px;line-height:1.6;color:var(--mid);max-width:62ch;margin:14px 0 24px;}
  .wh-chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 32px;}
  .wh-chip{font-family:var(--font-mono);font-size:12px;letter-spacing:.02em;color:var(--mid);background:transparent;border:1px solid var(--border);padding:8px 15px;border-radius:999px;cursor:none;transition:color .18s ease,background .18s ease,border-color .18s ease;}
  .wh-chip:hover{color:var(--black);border-color:var(--black);}
  .wh-chip.on{background:var(--black);color:var(--white);border-color:var(--black);}
  .wh-brand{font-family:'Caveat',cursive;font-size:22px;line-height:1;color:#e63222;margin-bottom:5px;}
  .wh-active{font-weight:500 !important;text-decoration:underline;text-underline-offset:4px;}
  .wh-feed{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:30px;align-items:start;}
  @media(max-width:540px){.wh-feed{grid-template-columns:1fr;}}
  .wh-post{background:var(--white);max-width:420px;width:100%;margin:0 auto;cursor:none;}
  .wh-post.flat{border:1px solid var(--border);}
  .wh-post.pol{padding:14px 14px 0;border-radius:2px;box-shadow:0 1px 1px rgba(10,10,10,.05),0 8px 16px -6px rgba(10,10,10,.18),0 24px 44px -20px rgba(10,10,10,.24);transition:transform .45s cubic-bezier(.2,.8,.2,1),box-shadow .45s;}
  .wh-post.pol:hover{transform:translateY(-7px) rotate(-.6deg);box-shadow:0 2px 3px rgba(10,10,10,.06),0 18px 26px -8px rgba(10,10,10,.24),0 44px 66px -24px rgba(10,10,10,.32);}
  .wh-media{position:relative;width:100%;background:var(--black);overflow:hidden;}
  .wh-media>img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .55s ease,opacity .4s ease;}
  .wh-post:hover .wh-media>img{transform:scale(1.04);opacity:.9;}
  .wh-collage{display:grid;gap:2px;width:100%;background:var(--black);}
  .wh-cell{position:relative;overflow:hidden;background:var(--black);min-width:0;min-height:0;}
  .wh-cell img{width:100%;height:100%;object-fit:cover;display:block;transition:opacity .4s ease;}
  .wh-post:hover .wh-cell img{opacity:.92;}
  .wh-more{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(10,10,10,.5);color:var(--white);font-family:var(--font-display);font-size:26px;}
  .wh-post-foot{padding:14px 16px 16px;}
  .wh-post.pol .wh-post-foot{padding:15px 6px 16px;}
  .wh-film .wh-media img{filter:contrast(1.06) saturate(.9) sepia(.10) brightness(1.02);}
  .wh-film .wh-media::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:2;opacity:.16;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");background-size:140px 140px;}
  .wh-film .wh-media::before{content:"";position:absolute;inset:0;pointer-events:none;z-index:2;background:radial-gradient(ellipse at center,transparent 56%,rgba(10,10,10,.22) 100%);}
  .wh-caption{font-family:var(--font-mono);font-size:13px;line-height:1.5;color:var(--black);}
  .wh-meta{display:flex;justify-content:space-between;margin-top:12px;font-family:var(--font-mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--mid);}
  .wh-empty{color:var(--mid);font-family:var(--font-mono);grid-column:1/-1;}
  .wh-lightbox{position:fixed;inset:0;z-index:200;display:none;background:rgba(10,10,10,.93);align-items:center;justify-content:center;padding:40px;}
  .wh-lightbox.open{display:flex;}
  .wh-lb-inner{max-width:460px;width:100%;max-height:90vh;overflow:auto;}
  .wh-lb-inner .wh-post{max-width:none;margin:0;}
  .wh-lb-inner .wh-post.pol:hover{transform:none;}
  .wh-lb-close{position:fixed;top:20px;right:24px;width:42px;height:42px;border:1px solid var(--white);background:transparent;color:var(--white);font-size:15px;cursor:none;border-radius:50%;z-index:201;}
  @media(max-width:640px){.wh-wrap{padding-top:78px;}}
`;

const WH_SCRIPT = '<scr'+'ipt>'
+ 'var cursor=document.getElementById("cursor");'
+ 'if(cursor){document.addEventListener("mousemove",function(e){cursor.style.left=e.clientX+"px";cursor.style.top=e.clientY+"px";});'
+ 'document.querySelectorAll("a,button,.wh-post").forEach(function(el){el.addEventListener("mouseenter",function(){cursor.classList.add("hover");});el.addEventListener("mouseleave",function(){cursor.classList.remove("hover");});});}'
+ 'var ham=document.getElementById("hamburger"),nav=document.getElementById("mainNav");'
+ 'function whMobile(){if(window.innerWidth<=640){ham.style.display="flex";}else{ham.style.display="none";nav.classList.remove("mobile-open");ham.classList.remove("open");}}'
+ 'whMobile();window.addEventListener("resize",whMobile);'
+ 'ham.addEventListener("click",function(){nav.classList.toggle("mobile-open");ham.classList.toggle("open");});'
+ 'var lb=document.getElementById("whLightbox"),lbInner=document.getElementById("whLbInner");'
+ 'document.querySelectorAll(".wh-post").forEach(function(p){p.addEventListener("click",function(){lbInner.innerHTML=p.outerHTML;lb.classList.add("open");});});'
+ 'document.getElementById("whLbClose").addEventListener("click",function(){lb.classList.remove("open");});'
+ 'lb.addEventListener("click",function(e){if(e.target===lb)lb.classList.remove("open");});'
+ 'document.addEventListener("keydown",function(e){if(e.key==="Escape")lb.classList.remove("open");});'
+ 'var feed=document.querySelector(".wh-feed"),chips=document.getElementById("whChips");'
+ 'function shuffleFeed(){if(!feed)return;var els=[].slice.call(feed.children);for(var i=els.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=els[i];els[i]=els[j];els[j]=t;}els.forEach(function(e){feed.appendChild(e);});}'
+ 'function applyFilter(brand){if(!feed)return;feed.querySelectorAll(".wh-post").forEach(function(p){p.style.display=(brand==="__all__"||p.getAttribute("data-brand")===brand)?"":"none";});if(chips){chips.querySelectorAll(".wh-chip").forEach(function(c){c.classList.toggle("on",c.getAttribute("data-brand")===brand);});}if(brand==="__all__"){shuffleFeed();}}'
+ 'function brandFromHash(){var m=location.hash.match(/b=([^&]+)/);return m?decodeURIComponent(m[1]):"__all__";}'
+ 'if(chips){chips.addEventListener("click",function(e){var c=e.target.closest(".wh-chip");if(!c)return;var b=c.getAttribute("data-brand");location.hash=(b==="__all__")?"":("b="+encodeURIComponent(b));applyFilter(b);});}'
+ 'window.addEventListener("hashchange",function(){applyFilter(brandFromHash());});'
+ 'applyFilter(brandFromHash());'
+ '</scr'+'ipt>';

const whHeader = `<header>
  <a href="/" class="logo">${esc(settings.logo_name||'Rd Bee')}</a>
  <nav id="mainNav">
    <a href="/#work">Work</a>
    <a href="/#brands">Brands</a>
    <a href="/#packages">Design Package</a>
    <a href="/warehouse" class="wh-active">${esc(WH_LABEL)}</a>
    <a href="/#personal">Personal</a>
    <a href="/#about">About</a>
  </nav>
  <button class="hamburger" id="hamburger" aria-label="Menu" style="display:none;"><span></span><span></span><span></span></button>
  <span class="header-right">${esc(settings.status||'Available for Projects')}</span>
</header>`;

const whHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(WH_LABEL)} — ${esc(settings.logo_name||'Rd Bee')}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;600&family=IBM+Plex+Mono:ital,wght@0,300;0,400;0,500;1,300&subset=vietnamese&display=swap" rel="stylesheet">
${styleBlock}
<style>${WH_CSS}</style>
</head>
<body>
<div class="cursor" id="cursor"></div>
${whHeader}
<main class="wh-wrap">
  <div class="section-header">
    <span class="section-label">${esc(WH_LABEL)}</span>
    <span class="section-count">${String(warehouse.length).padStart(2,'0')} Posts · ${esc(settings.instagram||'@nnhanlee')}</span>
  </div>
  <p class="wh-intro">${nl2br(settings.warehouse_intro||'Kho kết quả social tôi làm cho các thương hiệu làm đẹp & thời trang — tuyển chọn và cập nhật mỗi ngày. Vào xem nhé.')}</p>
  ${buildWhChips()}
  <div class="wh-feed">${buildWarehouseFeed()}</div>
</main>
${footerBlock}
<div class="wh-lightbox" id="whLightbox"><button class="wh-lb-close" id="whLbClose">&#10005;</button><div class="wh-lb-inner" id="whLbInner"></div></div>
${WH_SCRIPT}
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'warehouse.html'), whHtml, 'utf8');
console.log(`✓ Built warehouse.html (${(whHtml.length/1024).toFixed(1)} KB) → ${warehouse.length} posts`);
