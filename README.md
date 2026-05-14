# 🤖 ML Affiliate Bot — WhatsApp + Mercado Livre + Claude AI

Automação completa para grupos de ofertas no WhatsApp. Monitora um grupo, detecta links de afiliados do Mercado Livre, analisa o produto com IA e reposta uma descrição profissional com imagem em outro grupo.

---

## 🚀 Como Funciona

```
[Grupo Origem]                [Bot Node.js]                  [Grupo Destino]
Você cola o link  ──────►  Scraping do produto          ──────►  📸 Imagem
de afiliado ML             Análise com Claude AI                 💬 Descrição top
                           Download da imagem                    🔗 Link original
```

1. Você copia um link de afiliado do Mercado Livre
2. Cola no grupo de origem do WhatsApp
3. O bot detecta o link automaticamente
4. Faz scraping do produto (título, preço, imagem, características)
5. A Claude API cria uma descrição impactante com emojis e CTA
6. O bot envia imagem + descrição + link para o grupo de destino

---

## 📋 Pré-requisitos

- Node.js 18+
- Um número de WhatsApp dedicado (ou o seu, ciente de que ficará conectado)
- Chave de API da Anthropic → [console.anthropic.com](https://console.anthropic.com)
- Estar presente nos dois grupos do WhatsApp (origem e destino)

---

## ⚙️ Instalação

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/ml-affiliate-bot.git
cd ml-affiliate-bot

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
```

Edite o arquivo `.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...
SOURCE_GROUP_NAME=Nome Exato do Grupo Origem
DEST_GROUP_NAME=Nome Exato do Grupo Destino
```

> ⚠️ Os nomes dos grupos precisam ser **exatamente iguais** aos nomes no WhatsApp, incluindo espaços e acentos.

---

## ▶️ Uso

```bash
npm start
```

Na primeira execução, um **QR Code aparecerá no terminal**. Escaneie com o WhatsApp do celular que vai monitorar o grupo (Configurações → Aparelhos conectados → Conectar aparelho).

A sessão fica salva localmente — nas próximas execuções, não precisará escanear novamente.

---

## 📁 Estrutura do Projeto

```
ml-affiliate-bot/
├── .env                  # Variáveis de ambiente (não commitar)
├── .env.example          # Exemplo de configuração
├── package.json
├── index.js              # Ponto de entrada
└── src/
    ├── whatsapp.js       # Cliente WhatsApp e lógica de grupos
    ├── scraper.js        # Scraping do produto no Mercado Livre
    ├── ai.js             # Integração com Claude API
    └── utils.js          # Helpers (extração de URL, download de imagem, etc.)
```

---

## 🛠️ Stack

| Ferramenta | Uso |
|---|---|
| [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) | Automação do WhatsApp via Puppeteer |
| [Anthropic SDK](https://github.com/anthropic/anthropic-sdk-node) | Geração de descrições com Claude |
| [axios](https://axios-http.com) + [cheerio](https://cheerio.js.org) | Scraping do Mercado Livre |
| [dotenv](https://github.com/motdotla/dotenv) | Gerenciamento de variáveis de ambiente |

---

## 💡 Exemplo de Saída

> 🔥 **Fone Bluetooth JBL Tune 510BT**
>
> ~~R$ 249,90~~ → **R$ 189,90** ✅ 24% OFF
>
> ✔️ Até 40h de bateria  
> ✔️ Pure Bass Sound  
> ✔️ Dobrável — fácil de guardar  
> ✔️ Conexão com 2 dispositivos simultaneamente  
>
> ⚡ Promoção por tempo limitado! Corre que tá voando 👇  
> [link do produto]

---

## 🔧 Produção com PM2

Para rodar em segundo plano e reiniciar automaticamente:

```bash
npm install -g pm2
pm2 start index.js --name ml-bot
pm2 save
pm2 startup
```

---

## ⚠️ Avisos Importantes

- **whatsapp-web.js** é uma biblioteca não oficial. O WhatsApp pode banir números que automatizam envios em massa. Use com moderação.
- O Mercado Livre ocasionalmente muda seus seletores CSS. Se o scraping parar de funcionar, inspecione a página e atualize `src/scraper.js`.
- Não compartilhe sua `ANTHROPIC_API_KEY` nem a commite no repositório.
- O arquivo `.wwebjs_auth/` (sessão do WhatsApp) também não deve ser commitado.

---

## 📄 .gitignore recomendado

```
node_modules/
.env
.wwebjs_auth/
.wwebjs_cache/
```

---

## 📜 Licença

MIT — use, modifique e distribua à vontade.

---

Feito com ☕ e Claude AI
