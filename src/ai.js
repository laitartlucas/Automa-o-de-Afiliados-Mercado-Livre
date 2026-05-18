const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic();

async function generateSalesMessage(product) {
  const { title, currentPrice, originalPrice, discountPercent, features, url } = product;

  const priceInfo = currentPrice
    ? `Preço: R$ ${currentPrice.toFixed(2)}${originalPrice ? ` (era R$ ${originalPrice.toFixed(2)})` : ''}${discountPercent ? ` — ${discountPercent}% OFF` : ''}`
    : 'Preço: verificar no link';

  const featuresText = features?.length
    ? `\nCaracterísticas:\n${features.map((f) => `- ${f}`).join('\n')}`
    : '';

  const prompt = `Você é especialista em marketing de afiliados brasileiro. Crie uma mensagem de oferta impactante para grupo de WhatsApp.

Produto: ${title || 'Produto Mercado Livre'}
${priceInfo}${featuresText}
Link: ${url}

Regras:
- Máximo 8 linhas
- Use emojis estrategicamente (não exagere)
- Destaque o preço e a economia (se houver desconto)
- Se tiver preço original use o formato ~~R$ XX,XX~~ para mostrar riscado
- Termine com CTA urgente + link
- Português brasileiro informal`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0].text.trim();
}

module.exports = { generateSalesMessage };
