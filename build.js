#!/usr/bin/env node
/**
 * build.js — Rd Bee Portfolio Build-Time CMS
 * Reads JSON data from /data and injects into template.html → index.html
 * 
 * Usage: node build.js
 * Netlify build command: node build.js
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
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function nl2br(str) {
  if (!str) return '';
  return esc(str).replace(/\n/g, '<br>');
}

// ─── LOAD DATA ─────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');

const settings = readJSON(path.join(DATA_DIR, 'settings.json')) || {};
const brands = readJSON(path.join(DATA_DIR, 'brands.json')) || [];
const social = readJSON(path.join(DATA_DIR, 'social.json')) || [];
const packages = readJSON(path.join(DATA_DIR, 'packages.json')) || {};
const projects = loadProjectFiles(path.join(DATA_DIR, 'projects'));

console.log(`✓ Settings loaded`);
console.log(`✓ ${projects.length} projects loaded`);
console.log(`✓ ${brands.length} brands loaded`);
console.log(`✓ ${social.length} social items loaded`);
console.log(`✓ ${Object.keys(packages).length} packages loaded`);

// ─── BUILD SECTIONS ────────────────────────────────────

const VISIBLE_COUNT = 6;

// ── Brands Dropdown HTML ──
function buildBrandsDropdown() {
  return brands.map(b => {
    const isSoon = b.status === 'coming_soon';
    let links = '';

    if (b.projects && b.projects.length > 0) {
      links = b.projects.map(proj => {
        if (isSoon) {
          return `
            <a class="dropdown-project-link" href="#" onclick="return false;" style="opacity:0.38;pointer-events:none;">
              <span>${esc(proj.title)}</span>
              <span class="dropdown-project-tag">${esc(proj.tag || '')}</span>
            </a>`;
        }
        // Find matching project index for onclick
        const projIdx = projects.findIndex(p =>
          p.title && proj.title && p.title.toLowerCase().includes(proj.title.toLowerCase().split(' ')[0])
        );
        const clickFn = projIdx >= 0
          ? `openProject(${projIdx}); closeBrands(); return false;`
          : `return false;`;
        return `
            <a class="dropdown-project-link" href="#" onclick="${clickFn}">
              <span>${esc(proj.title)}</span>
              <span style="display:flex;align-items:center;gap:8px;">
                <span class="dropdown-project-tag">${esc(proj.tag || '')}</span>
                <span class="dropdown-arrow">→</span>
              </span>
            </a>`;
      }).join('');
    } else {
      links = `
            <a class="dropdown-project-link" href="#" onclick="return false;" style="opacity:0.38;pointer-events:none;">
              <span>Coming Soon</span>
              <span class="dropdown-project-tag">${esc(b.industry || '')}</span>
            </a>`;
    }

    return `
          <div class="dropdown-brand">
            <span class="dropdown-brand-name">${esc(b.name)}</span>${links}
          </div>`;
  }).join('');
}

// ── Packages Dropdown HTML ──
function buildPackagesDropdown() {
  const pkgList = Object.values(packages).sort((a, b) => (a.order || 99) - (b.order || 99));
  return pkgList.map(pkg => `
            <a class="dropdown-project-link" href="#" onclick="openPackage('${esc(pkg.slug)}'); closePackageMenu(); return false;">
              <span>${esc(pkg.dropdown_label)}</span>
              <span style="display:flex;align-items:center;gap:8px;">
                <span class="dropdown-project-tag">${esc(pkg.dropdown_tag)}</span>
                <span class="dropdown-arrow">→</span>
              </span>
            </a>`).join('');
}

// ── Hero Section ──
function buildHeroImage() {
  if (settings.hero_image) {
    return `
    <img src="${esc(settings.hero_image)}" alt="Hero" style="width:100%;height:100%;object-fit:cover;display:block;opacity:0.88;">
    <span class="hero-img-label">${esc(settings.hero_image_label || 'Featured — 2025')}</span>`;
  }
  return `
    <div class="img-placeholder tone-1" style="height:100%;font-size:10px;letter-spacing:0.2em;">Hero Image</div>
    <span class="hero-img-label">${esc(settings.hero_image_label || 'Featured — 2025')}</span>`;
}

// ── Marquee ──
function buildMarquee() {
  const items = settings.marquee_items || [];
  const single = items.map(item =>
    `<span class="marquee-item">${esc(item)}</span><span class="marquee-dot"></span>`
  ).join('\n    ');
  // Duplicate for infinite scroll
  return `${single}\n    ${single}`;
}

// ── Projects Grid ──
function buildProjectsGrid() {
  return projects.map((p, i) => {
    const imgSrc = p.cover_image || '';
    const imgHTML = imgSrc
      ? `<img src="${esc(imgSrc)}" alt="${esc(p.title)}" style="width:100%;height:100%;object-fit:cover;opacity:0.9;transition:transform 0.7s cubic-bezier(0.25,0.46,0.45,0.94),opacity 0.5s ease;display:block;">`
      : `<div class="img-placeholder tone-${(i % 6) + 1}" style="height:100%;">Image</div>`;
    const hidden = i >= VISIBLE_COUNT ? ' hidden-card' : '';
    const titleFormatted = esc(p.title || '').replace(/\s+(\S)/g, '<br>$1');
    return `
    <a class="project-card${hidden}" href="#" onclick="openProject(${i}); return false;">
      <div class="project-img-wrap">${imgHTML}</div>
      <div class="project-info">
        <p class="project-category">${esc(p.category || '')}</p>
        <h3 class="project-name">${titleFormatted}</h3>
      </div>
    </a>`;
  }).join('');
}

// ── Featured Row ──
function buildFeaturedRow() {
  const featured = projects.filter(p => p.featured !== false).slice(0, 2);
  if (featured.length === 0) {
    // fallback to first 2
    featured.push(...projects.slice(0, 2));
  }
  return featured.map((p, i) => {
    const fIdx = projects.indexOf(p);
    const fImg = p.hero_image || p.cover_image || '';
    const fImgHTML = fImg
      ? `<img src="${esc(fImg)}" alt="${esc(p.title)}" style="width:100%;height:100%;object-fit:cover;opacity:0.88;transition:transform 0.8s ease,opacity 0.5s ease;display:block;">`
      : `<div class="img-placeholder tone-${i + 2}" style="height:100%;">Campaign Image</div>`;
    return `
    <a class="featured-card" href="#" onclick="openProject(${fIdx}); return false;">
      <div class="featured-img-wrap">${fImgHTML}</div>
      <div class="featured-meta">${esc(p.category || '')}</div>
      <div class="featured-info">
        <p class="featured-eyebrow">${esc(p.scope || '')}</p>
        <h3 class="featured-title">${esc(p.title || '')}</h3>
      </div>
    </a>`;
  }).join('');
}

// ── About Strip ──
function buildAboutStrip() {
  const igHandle = settings.instagram || '';
  const igUrl = settings.instagram_url || `https://www.instagram.com/${igHandle.replace('@', '')}`;
  const behanceUrl = settings.behance || '';
  const behanceLabel = settings.behance_label || 'Behance';

  return `
    <div class="about-col">
      <p class="about-col-label">${esc(settings.about_designer_label || 'Designer')}</p>
      <p class="about-col-content">${nl2br(settings.about_designer_content || '')}</p>
      <p class="about-col-sub">${nl2br(settings.about_designer_sub || '')}</p>
    </div>
    <div class="about-col">
      <p class="about-col-label">${esc(settings.about_expertise_label || 'Expertise')}</p>
      <p class="about-col-content">${nl2br(settings.about_expertise_content || '')}</p>
      <p class="about-col-sub">${nl2br(settings.about_expertise_sub || '')}</p>
    </div>
    <div class="about-col">
      <p class="about-col-label">${esc(settings.about_contact_label || 'Contact')}</p>
      <p class="about-col-content" id="aboutEmail">${esc(settings.email || '')}</p>
      <p class="about-col-sub">Instagram: <a href="${esc(igUrl)}" target="_blank" style="color:var(--black);text-decoration:none;">${esc(igHandle)}</a><br>
      <a href="${esc(behanceUrl)}" target="_blank" style="color:var(--black);text-decoration:none;">${esc(behanceLabel)}</a><br>
      ${esc(settings.location || '')}</p>
    </div>`;
}

// ── Social Strip ──
function buildSocialStrip() {
  return social.map((s, i) => {
    const imgHTML = s.image
      ? `<img src="${esc(s.image)}" alt="${esc(s.label)}" style="width:100%;height:100%;object-fit:cover;display:block;transition:transform 0.5s ease;">`
      : `<div class="img-placeholder tone-${(i % 5) + 1}" style="height:100%;">Post</div>`;
    return `
    <div class="social-item">
      <div class="social-img-wrap">${imgHTML}</div>
      <p class="social-label">${esc(s.label || '')}</p>
    </div>`;
  }).join('');
}

// ── Footer ──
function buildFooterNavLinks() {
  const links = settings.footer_nav_links || ['Work', 'Brands', 'Personal', 'About'];
  return links.map(l => `      <a href="#${l.toLowerCase()}">${esc(l)}</a>`).join('\n');
}

function buildFooterConnect() {
  const parts = [];
  if (settings.instagram) {
    const igUrl = settings.instagram_url || `https://www.instagram.com/${settings.instagram.replace('@', '')}`;
    parts.push(`      <a href="${esc(igUrl)}" target="_blank" id="footerInstagram">Instagram</a>`);
  }
  if (settings.behance) {
    parts.push(`      <a href="${esc(settings.behance)}" target="_blank" id="footerBehance">Behance</a>`);
  }
  if (settings.email) {
    parts.push(`      <a href="mailto:${esc(settings.email)}" id="footerEmail">${esc(settings.email)}</a>`);
  }
  return parts.join('\n');
}

// ── Projects JS data (for project detail page) ──
function buildProjectsJSArray() {
  return JSON.stringify(projects.map((p, i) => ({
    title: p.title || '',
    category: p.category || '',
    client: p.client || '—',
    year: p.year || '—',
    scope: p.scope || '—',
    industry: p.industry || '—',
    description: p.description || '—',
    cover_image: p.cover_image || '',
    hero_image: p.hero_image || p.cover_image || '',
    gallery: p.gallery || [],
    featured: p.featured !== false,
  })), null, 2);
}

// ── Packages JS data ──
function buildPackagesJSObject() {
  return JSON.stringify(packages, null, 2);
}

// ─── LOAD TEMPLATE & INJECT ───────────────────────────
const templatePath = path.join(__dirname, 'template.html');
if (!fs.existsSync(templatePath)) {
  console.error('✗ template.html not found!');
  process.exit(1);
}

let html = fs.readFileSync(templatePath, 'utf8');

// Calculate hidden count
const hiddenCount = Math.max(0, projects.length - VISIBLE_COUNT);
const loadMoreDisplay = hiddenCount > 0 ? 'flex' : 'none';

// Replace all placeholders
const replacements = {
  '{{LOGO_NAME}}': esc(settings.logo_name || 'Rd Bee'),
  '{{SITE_STATUS}}': esc(settings.status || 'Available for Projects'),
  '{{HERO_EYEBROW}}': esc(settings.tagline || ''),
  '{{HERO_TITLE_LINE1}}': esc(settings.hero_title_line1 || 'Visual'),
  '{{HERO_TITLE_LINE2}}': esc(settings.hero_title_line2 || 'Brand'),
  '{{HERO_TITLE_LINE3}}': esc(settings.hero_title_line3 || 'Identity'),
  '{{HERO_DESC}}': nl2br(settings.hero_desc || ''),
  '{{HERO_IMAGE}}': buildHeroImage(),
  '{{MARQUEE_ITEMS}}': buildMarquee(),
  '{{PROJECTS_COUNT}}': `${String(projects.length).padStart(2, '0')} Projects`,
  '{{PROJECTS_GRID}}': buildProjectsGrid(),
  '{{LOAD_MORE_DISPLAY}}': loadMoreDisplay,
  '{{LOAD_MORE_COUNT}}': `+${hiddenCount} more`,
  '{{FEATURED_ROW}}': buildFeaturedRow(),
  '{{ABOUT_STRIP}}': buildAboutStrip(),
  '{{SOCIAL_HANDLE}}': esc(settings.instagram || '@nnhanlee'),
  '{{SOCIAL_STRIP}}': buildSocialStrip(),
  '{{BRANDS_DROPDOWN}}': buildBrandsDropdown(),
  '{{PACKAGES_DROPDOWN}}': buildPackagesDropdown(),
  '{{FOOTER_LOGO}}': esc(settings.logo_name || 'Rd Bee'),
  '{{FOOTER_DESC}}': nl2br(settings.footer_desc || ''),
  '{{FOOTER_NAV_LINKS}}': buildFooterNavLinks(),
  '{{FOOTER_CONNECT}}': buildFooterConnect(),
  '{{FOOTER_COPYRIGHT}}': esc(settings.copyright || `© 2025 ${settings.logo_name || 'Rd Bee'}. All rights reserved.`),
  '{{FOOTER_LOCATION}}': esc(settings.location || ''),
  '{{PROJECTS_JS_DATA}}': buildProjectsJSArray(),
  '{{PACKAGES_JS_DATA}}': buildPackagesJSObject(),
  '{{INSTAGRAM_URL}}': esc(settings.instagram_url || `https://www.instagram.com/${(settings.instagram || '').replace('@', '')}`),
};

for (const [placeholder, value] of Object.entries(replacements)) {
  html = html.split(placeholder).join(value);
}

// Write output
const outputPath = path.join(__dirname, 'index.html');
fs.writeFileSync(outputPath, html, 'utf8');
console.log(`\n✓ Built index.html (${(html.length / 1024).toFixed(1)} KB)`);
console.log(`  → ${projects.length} projects, ${brands.length} brands, ${social.length} social, ${Object.keys(packages).length} packages`);
