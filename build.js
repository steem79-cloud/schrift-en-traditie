// Schrift & Traditie: zet Pages CMS Markdown-essays om naar een openbare website.
// Deze build draait bij elke wijziging automatisch via Netlify.
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const source = path.join(root, 'content', 'essays');
const destination = path.join(root, 'dist');

function scalar(value) {
  const s = value.trim();
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null' || s === '~') return '';
  if (s.startsWith('"') && s.endsWith('"')) {
    try { return JSON.parse(s); } catch { return s.slice(1, -1); }
  }
  if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1).replace(/''/g, "'");
  return s.replace(/\s+#.*$/, '');
}
function readEssay(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) throw new Error(`Geen geldige Markdown-frontmatter: ${file}`);
  const metadata = {};
  for (const line of match[1].split('\n')) {
    const pair = line.match(/^([\w-]+):\s*(.*)$/);
    if (pair) metadata[pair[1]] = scalar(pair[2]);
  }
  if (metadata.published !== true) return null;
  const title = String(metadata.title || '').trim();
  const body = match[2].trim();
  if (!title || !body) throw new Error(`Gepubliceerd essay zonder titel of tekst: ${file}`);
  const date = String(metadata.date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Ongeldige datum: ${file}`);
  const summary = body.replace(/[#*_>\[\]()`!]/g, '').replace(/\s+/g,' ').slice(0, 190).trim();
  return {
    id: path.basename(file, '.md'),
    title,
    category: String(metadata.category || 'Jodendom'),
    date,
    summary,
    body,
    status: 'published'
  };
}
fs.mkdirSync(destination, {recursive: true});
const essays = fs.existsSync(source)
  ? fs.readdirSync(source).filter(name => name.endsWith('.md')).sort().map(name => readEssay(path.join(source, name))).filter(Boolean)
  : [];
essays.sort((a, b) => b.date.localeCompare(a.date));
const template = fs.readFileSync(path.join(root, 'template', 'index.html'), 'utf8');
const pattern = /<script id="site-data" type="application\/json">[\s\S]*?<\/script>/;
if (!pattern.test(template)) throw new Error('Website-sjabloon mist site-data');
const data = JSON.stringify({readonly: true, posts: essays}).replace(/</g, '\\u003c');
const output = template.replace(pattern, `<script id="site-data" type="application/json">${data}</script>`);
fs.writeFileSync(path.join(destination, 'index.html'), output, 'utf8');
const media = path.join(root, 'media');
if (fs.existsSync(media)) fs.cpSync(media, path.join(destination, 'media'), {recursive: true});
console.log(`Website gebouwd met ${essays.length} openbare essays. Concepten blijven privé op de website.`);
