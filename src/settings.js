const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../data/settings.json');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return {}; }
}

function get(key) {
  return load()[key] ?? process.env[key] ?? null;
}

function set(key, value) {
  const data = load();
  data[key] = value;
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  process.env[key] = value;
}

// Apply saved settings to env on startup
function applyToEnv() {
  const data = load();
  for (const [k, v] of Object.entries(data)) {
    if (!process.env[k]) process.env[k] = v;
  }
}

module.exports = { get, set, applyToEnv };
