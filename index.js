require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const QRCode = require('qrcode');
const { applyToEnv, get: getSetting, set: setSetting } = require('./src/settings');
const { initWhatsApp, sendToGroup, isReady, getQR, setGroupName } = require('./src/whatsapp');
const { scrapeProduct, downloadImage } = require('./src/scraper');
const { generateSalesMessage } = require('./src/ai');

// Apply saved settings (group name, etc.) before anything else
applyToEnv();

const required = ['ANTHROPIC_API_KEY', 'ADMIN_PASSWORD', 'SESSION_SECRET'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`[BOT] Variáveis ausentes no .env: ${missing.join(', ')}`);
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }, // 7 dias
}));

// Serve static assets (CSS, JS, images) without auth
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// ── Auth middleware ──────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  if (req.session?.authenticated) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Não autenticado' });
  res.redirect('/login');
}

// ── Public routes ────────────────────────────────────────────────────────────

app.get('/login', (req, res) => {
  if (req.session?.authenticated) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public/login.html'));
});

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password && password === process.env.ADMIN_PASSWORD) {
    req.session.authenticated = true;
    return res.json({ success: true });
  }
  res.status(401).json({ error: 'Senha incorreta' });
});

// ── Protected routes ─────────────────────────────────────────────────────────

app.get('/', requireAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public/app.html'));
});

app.post('/api/logout', requireAuth, (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/status', requireAuth, (_req, res) => {
  res.json({
    ready: isReady(),
    hasQR: !!getQR(),
    groupName: getSetting('DEST_GROUP_NAME') || '',
  });
});

app.get('/api/qr', requireAuth, async (_req, res) => {
  const qrString = getQR();
  if (!qrString) return res.json({ qr: null });
  const dataUrl = await QRCode.toDataURL(qrString, {
    width: 260, margin: 2, color: { dark: '#000', light: '#fff' },
  });
  res.json({ qr: dataUrl });
});

app.post('/api/settings', requireAuth, (req, res) => {
  const { groupName } = req.body;
  if (!groupName?.trim()) return res.status(400).json({ error: 'Nome do grupo é obrigatório' });
  setSetting('DEST_GROUP_NAME', groupName.trim());
  setGroupName(groupName.trim());
  console.log(`[SETTINGS] Grupo destino atualizado: "${groupName.trim()}"`);
  res.json({ success: true });
});

app.post('/api/process', requireAuth, async (req, res) => {
  const { url } = req.body;
  if (!url?.trim()) return res.status(400).json({ error: 'URL é obrigatória' });
  if (!isReady()) return res.status(503).json({ error: 'WhatsApp não está conectado ainda.' });
  if (!getSetting('DEST_GROUP_NAME')) return res.status(400).json({ error: 'Configure o nome do grupo antes de enviar.' });

  try {
    console.log(`[PIPELINE] Processando: ${url.trim()}`);
    const product = await scrapeProduct(url.trim());
    console.log(`[PIPELINE] Produto: "${product.title}"`);

    const message = await generateSalesMessage(product);
    console.log('[PIPELINE] Mensagem gerada');

    let imageBuffer = null;
    if (product.imageUrl) {
      try { imageBuffer = await downloadImage(product.imageUrl); }
      catch (err) { console.warn('[PIPELINE] Imagem não baixada:', err.message); }
    }

    await sendToGroup(message, imageBuffer, product.imageUrl);
    console.log('[PIPELINE] Enviado!');

    res.json({ success: true, message, product });
  } catch (err) {
    console.error('[PIPELINE] Erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n[SERVER] Acesse http://localhost:${PORT}\n`);
});

async function startWhatsApp() {
  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[BOT] Iniciando WhatsApp (tentativa ${attempt}/${MAX_RETRIES})...`);
      await initWhatsApp();
      return;
    } catch (err) {
      console.error(`[BOT] Falha ${attempt}/${MAX_RETRIES}:`, err.message);
      if (attempt < MAX_RETRIES) {
        const wait = attempt * 5000;
        console.log(`[BOT] Aguardando ${wait / 1000}s...`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  console.error('[BOT] Máximo de tentativas atingido. Reinicie o bot.');
}

startWhatsApp();
