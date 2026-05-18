const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

let client;
let ready = false;
let currentQR = null;
let destChatId = null;

function isReady() { return ready; }
function getQR() { return currentQR; }

async function resolveDestChatId() {
  if (!destChatId) {
    const chats = await client.getChats();
    const found = chats.find((c) => c.isGroup && c.name === process.env.DEST_GROUP_NAME);
    if (!found) {
      console.warn(`[WA] Grupo "${process.env.DEST_GROUP_NAME}" não encontrado`);
      return null;
    }
    destChatId = found.id._serialized;
    console.log(`[WA] Grupo destino: "${found.name}" (${destChatId})`);
  }
  return destChatId;
}

async function trySend(fn, retries = 3) {
  for (let i = 1; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      console.warn(`[WA] Tentativa ${i}/${retries} falhou: ${err.message}`);
      if (i === retries) throw err;
      await new Promise((r) => setTimeout(r, i * 3000));
    }
  }
}

async function sendToGroup(message, imageBuffer, imageUrl) {
  const chatId = await resolveDestChatId();
  if (!chatId) throw new Error(`Grupo "${process.env.DEST_GROUP_NAME}" não encontrado`);

  if (imageBuffer && imageUrl) {
    const ext = (imageUrl.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const media = new MessageMedia(mime, imageBuffer.toString('base64'), `produto.${ext}`);
    await trySend(() => client.sendMessage(chatId, media, { caption: message }));
  } else {
    await trySend(() => client.sendMessage(chatId, message));
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
    destChatId = null;
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
  destChatId = null;
}

module.exports = { initWhatsApp, sendToGroup, isReady, getQR, setGroupName };
