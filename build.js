#!/usr/bin/env node
/**
 * Rd Bee Portfolio — Build Script
 * Đọc toàn bộ data từ CMS (JSON files) và inject thẳng vào HTML lúc build.
 * Netlify chạy script này tự động mỗi khi có thay đổi.
 */

const fs   = require('fs');
const path = require('path');

// ─── Helpers ────────────────────────────────────────────────
function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch(e) {
    return null;
  }
}

function readFolder(folderPath) {
  if (!fs.existsSync(folderPath)) return [];
  return fs.readdirSync(folderPath)
    .filter(f => f.endsWith('.json'))
    .map(f => readJSON(path.join(folderPath, f)))
    .filter(Boolean);
}

function esc(str) {
  return (str || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function nl2br(str) {
  return esc(str).replace(/\n/g,'<br>');
}

function resolveImg(p) {
  if (!p || p.trim() === '') return null;
  return p.startsWith('http') ? p : p;
}

// ─── Read all CMS data ───────────────────────────────────────
const s        = readJSON('data/settings.json') || {};
const projects = readFolder('data/projects').sort((a,b)=>(a.order||99)-(b.order||99));
const brands   = readFolder('data/brands').sort((a,b)=>(a.order||99)-(b.order||99));
const social   = readFolder('data/social').sort((a,b)=>(a.order||99)-(b.order||99));

console.log(`📦 Settings: OK`);
console.log(`🖼  Projects: ${projects.length}`);
console.log(`🏷  Brands:   ${brands.length}`);
console.log(`📱 Social:   ${social.length}`);

// ─── Read template ───────────────────────────────────────────
let html = fs.readFileSync('index.template.html', 'utf8');

// ─── 1. SETTINGS ────────────────────────────────────────────
html = html
  .replace(/{{LOGO_NAME}}/g,   esc(s.logo_name  || 'Rd Bee'))
  .replace(/{{TAGLINE}}/g,     esc(s.tagline    || ''))
  .replace(/{{STATUS}}/g,      esc(s.status     || 'Available for Projects'))
  .replace(/{{HERO_DESC}}/g,   nl2br(s.hero_desc || ''))
  .replace(/{{EMAIL}}/g,       esc(s.email      || ''))
  .replace(/{{INSTAGRAM}}/g,   esc(s.instagram  || ''))
  .replace(/{{INSTAGRAM_URL}}/g, `https://www.instagram.com/${(s.instagram||'').replace('@','')}`)
  .replace(/{{BEHANCE_URL}}/g, esc(s.behance    || '#'))
  .replace(/{{LOCATION}}/g,    esc(s.location   || ''))
  .replace(/{{FOOTER_YEAR}}/g, esc(s.footer_year|| '2025'))
  .replace(/{{FOOTER_DESC}}/g, nl2br(s.footer_desc || ''))
  .replace(/{{ABOUT_DESIGNER}}/g,      nl2br(s.about_designer     || ''))
  .replace(/{{ABOUT_EXPERTISE}}/g,     nl2br(s.about_expertise    || ''))
  .replace(/{{ABOUT_EXPERTISE_SUB}}/g, nl2br(s.about_expertise_sub|| ''));

// Hero image
const heroImg = resolveImg(s.hero_image);
if (heroImg) {
  html = html.replace(
    '{{HERO_IMAGE}}',
    `<img src="${esc(heroImg)}" alt="Hero" style="width:100%;height:100%;object-fit:cover;display:block;opacity:0.88;">`
  );
} else {
  html = html.replace(
    '{{HERO_IMAGE}}',
    `<div class="img-placeholder tone-1" style="height:100%;font-size:10px;letter-spacing:0.2em;">Hero Image</div>`
  );
}

// ─── 2. PROJECTS GRID ────────────────────────────────────────
const VISIBLE = 6;
const tones   = ['tone-2','tone-3','tone-4','tone-1','tone-5','tone-6'];

const projectsHTML = projects.map((p, i) => {
  const img   = resolveImg(p.cover_image);
  const imgEl = img
    ? `<img src="${esc(img)}" alt="${esc(p.title)}" style="width:100%;height:100%;object-fit:cover;opacity:0.9;display:block;transition:transform 0.7s cubic-bezier(0.25,0.46,0.45,0.94),opacity 0.5s ease;">`
    : `<div class="img-placeholder ${tones[i%6]}" style="height:100%;">Image</div>`;
  const hidden  = i >= VISIBLE ? ' hidden-card' : '';
  const nameArr = (p.title||'').split(' ');
  const nameMid = Math.ceil(nameArr.length/2);
  const nameHTML= nameArr.slice(0,nameMid).join(' ')+'<br>'+nameArr.slice(nameMid).join(' ');
  return `
    <a class="project-card${hidden}" href="#" onclick="openProject(${i}); return false;">
      <div class="project-img-wrap">${imgEl}</div>
      <div class="project-info">
        <p class="project-category">${esc(p.category||'')}</p>
        <h3 class="project-name">${nameHTML}</h3>
      </div>
    </a>`;
}).join('\n');

const extraCount = Math.max(0, projects.length - VISIBLE);
html = html
  .replace('{{PROJECTS_GRID}}',  projectsHTML || '<div style="padding:40px;text-align:center;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:var(--mid);">Projects coming soon</div>')
  .replace('{{PROJECTS_COUNT}}', String(projects.length).padStart(2,'0') + ' Projects')
  .replace('{{LOAD_MORE_COUNT}}', extraCount > 0 ? `+${extraCount} more` : '')
  .replace('{{LOAD_MORE_DISPLAY}}', extraCount > 0 ? 'flex' : 'none');

// ─── 3. FEATURED ROW ─────────────────────────────────────────
const featured = projects.filter(p => p.featured !== false).slice(0,2);
const featuredHTML = featured.length > 0
  ? featured.map((p, i) => {
      const idx = projects.indexOf(p);
      const img = resolveImg(p.hero_image || p.cover_image);
      const imgEl = img
        ? `<img src="${esc(img)}" alt="${esc(p.title)}" style="width:100%;height:100%;object-fit:cover;opacity:0.88;display:block;transition:transform 0.8s ease,opacity 0.5s ease;">`
        : `<div class="img-placeholder tone-${i+2}" style="height:100%;">Campaign Image</div>`;
      return `
        <a class="featured-card" href="#" onclick="openProject(${idx}); return false;">
          <div class="featured-img-wrap">${imgEl}</div>
          <div class="featured-meta">${esc(p.category||'')}</div>
          <div class="featured-info">
            <p class="featured-eyebrow">${esc(p.scope||'')}</p>
            <h3 class="featured-title">${esc(p.title||'')}</h3>
          </div>
        </a>`;
    }).join('\n')
  : `<div style="padding:80px;text-align:center;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:var(--mid);width:100%;">Featured projects coming soon</div>`;

html = html.replace('{{FEATURED_ROW}}', featuredHTML);

// ─── 4. PROJECTS DATA (JS array) ─────────────────────────────
const projectsJS = JSON.stringify(projects.map(p => ({
  eyebrow:     p.category    || '',
  title:       p.title       || '',
  client:      p.client      || '—',
  year:        p.year        || '—',
  scope:       p.scope       || '—',
  industry:    p.industry    || '—',
  desc:        p.description || '—',
  heroImg:     resolveImg(p.hero_image || p.cover_image) || null,
  gallery:     (p.gallery||[]).map(g => resolveImg(typeof g==='string'?g:g.image)).filter(Boolean),
})), null, 2);

html = html.replace('{{PROJECTS_JS_DATA}}', projectsJS);

// ─── 5. BRANDS DROPDOWN ──────────────────────────────────────
const brandsHTML = brands.length > 0
  ? brands.map(b => {
      const isSoon = b.status === 'coming_soon';
      const projs  = Array.isArray(b.projects) ? b.projects : [];
      const links  = projs.length > 0
        ? projs.map(proj => {
            const idx = projects.findIndex(p =>
              (p.title||'').toLowerCase().includes((proj.title||'').toLowerCase().split(' ')[0])
            );
            const clickFn = (!isSoon && idx >= 0)
              ? `openProject(${idx}); closeBrands(); return false;`
              : `return false;`;
            const style = isSoon ? ' style="opacity:0.38;pointer-events:none;"' : '';
            return `
              <a class="dropdown-project-link" href="#" onclick="${clickFn}"${style}>
                <span>${esc(proj.title)}</span>
                <span style="display:flex;align-items:center;gap:8px;">
                  <span class="dropdown-project-tag">${esc(proj.tag||'')}</span>
                  ${!isSoon ? '<span class="dropdown-arrow">→</span>' : ''}
                </span>
              </a>`;
          }).join('')
        : `<a class="dropdown-project-link" href="#" onclick="return false;" style="opacity:0.38;pointer-events:none;">
            <span>Coming Soon</span>
            <span class="dropdown-project-tag">${esc(b.industry||'')}</span>
          </a>`;
      return `
        <div class="dropdown-brand">
          <span class="dropdown-brand-name">${esc(b.name)}</span>
          ${links}
        </div>`;
    }).join('\n')
  : '<!-- No brands yet -->';

html = html.replace('{{BRANDS_DROPDOWN}}', brandsHTML);

// ─── 6. SOCIAL STRIP ─────────────────────────────────────────
const socialTones = ['tone-2','tone-3','tone-1','tone-5'];
const socialHTML = social.length > 0
  ? social.map((s, i) => {
      const img   = resolveImg(s.image);
      const imgEl = img
        ? `<img src="${esc(img)}" alt="${esc(s.label)}" style="width:100%;height:100%;object-fit:cover;display:block;transition:transform 0.5s ease;">`
        : `<div class="img-placeholder ${socialTones[i%4]}" style="height:100%;">Post</div>`;
      return `
        <div class="social-item">
          <div class="social-img-wrap">${imgEl}</div>
          <p class="social-label">${esc(s.label||'')}</p>
        </div>`;
    }).join('\n')
  : ['Beauty Editorial','Fashion Campaign','Brand Packaging','Personal Project'].map((label,i)=>`
      <div class="social-item">
        <div class="social-img-wrap"><div class="img-placeholder ${socialTones[i]}" style="height:100%;">Post</div></div>
        <p class="social-label">${label}</p>
      </div>`).join('\n');

html = html.replace('{{SOCIAL_STRIP}}', socialHTML);

// ─── Write output ─────────────────────────────────────────────
fs.writeFileSync('index.html', html);
console.log('✅ index.html built successfully');
