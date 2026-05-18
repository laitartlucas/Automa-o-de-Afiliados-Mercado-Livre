const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

let client;
let ready = false;
let currentQR = null;

function isReady() { return ready; }
function getQR() { return currentQR; }

async function resolveDestChat() {
  const chats = await client.getChats();
  const dest = chats.find((c) => c.isGroup && c.name === process.env.DEST_GROUP_NAME) || null;
  if (dest) {
    console.log(`[WA] Grupo destino: "${dest.name}"`);
  } else {
    console.warn(`[WA] Grupo "${process.env.DEST_GROUP_NAME}" não encontrado`);
  }
  return dest;
}

async function sendToGroup(message, imageBuffer, imageUrl) {
  const dest = await resolveDestChat();
  if (!dest) throw new Error(`Grupo "${process.env.DEST_GROUP_NAME}" não encontrado`);

  await new Promise((r) => setTimeout(r, 2000));

  if (imageBuffer && imageUrl) {
    const ext = (imageUrl.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const media = new MessageMedia(mime, imageBuffer.toString('base64'), `produto.${ext}`);
    await dest.sendMessage(media, { caption: message });
  } else {
    await dest.sendMessage(message);
  }
}

async function initWhatsApp() {
  client = new Client({
    authStrategy: new LocalAuth({ clientId: 'ml-affiliate-bot' }),
    webVersionCache: { type: 'local', path: './.wwebjs_cache' },
    puppeteer: {
      headless: true,
      protocolTimeout: 300000,
      ...(process.env.PUPPETEER_EXECUTABLE_PATH && { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-extensions',
        '--disable-sync',
        '--no-first-run',
        '--memory-pressure-off',
      ],
    },
  });

  client.on('qr', (qr) => {
    currentQR = qr;
    console.log('\n[WA] QR Code disponível — acesse http://localhost:3000 para escanear\n');
    qrcode.generate(qr, { small: true });
  });

  client.on('authenticated', () => {
    currentQR = null;
    console.log('[WA] Autenticado — sessão salva.');
  });

  client.on('disconnected', (reason) => {
    ready = false;
    destChat = null;
    console.warn('[WA] Desconectado:', reason);
  });

  // Resolve when ready, reject on auth failure or initialize error
  return new Promise((resolve, reject) => {
    client.on('ready', async () => {
      ready = true;
      console.log('[WA] Conectado e pronto!');
      resolve();
    });

    client.on('auth_failure', (msg) => reject(new Error(`Falha de autenticação: ${msg}`)));

    client.initialize().catch(reject);
  });
}

function setGroupName(name) {
  process.env.DEST_GROUP_NAME = name;
}

module.exports = { initWhatsApp, sendToGroup, isReady, getQR, setGroupName };
