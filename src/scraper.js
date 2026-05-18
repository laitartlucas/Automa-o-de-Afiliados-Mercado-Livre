const axios = require('axios');
const cheerio = require('cheerio');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
};

async function resolveUrl(url) {
  try {
    const res = await axios.get(url, {
      headers: HEADERS,
      maxRedirects: 10,
      timeout: 15000,
      validateStatus: (s) => s < 400,
    });
    return res.request?.res?.responseUrl || res.request?.responseURL || url;
  } catch (err) {
    if (err.response?.headers?.location) return err.response.headers.location;
    return url;
  }
}

function parsePrice(text) {
  if (!text) return null;
  const cleaned = text.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

function extractJsonLd($) {
  let product = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (product) return;
    try {
      const data = JSON.parse($(el).html() || '{}');
      if (data['@type'] === 'Product') product = data;
      else if (Array.isArray(data['@graph']))
        product = data['@graph'].find((n) => n['@type'] === 'Product') || null;
    } catch {}
  });
  return product;
}

async function scrapeProduct(originalUrl) {
  const url = await resolveUrl(originalUrl);
  console.log(`[SCRAPER] URL final: ${url}`);

  const res = await axios.get(url, { headers: HEADERS, timeout: 20000, validateStatus: (s) => s < 400 });
  const $ = cheerio.load(res.data);

  const title =
    $('h1.ui-pdp-title').text().trim() ||
    $('h1[class*="title"]').first().text().trim() ||
    $('meta[property="og:title"]').attr('content') ||
    $('title').text().replace(/\s*\|.*$/, '').trim();

  const imageUrl =
    $('meta[property="og:image"]').attr('content') ||
    $('.ui-pdp-gallery__figure img').first().attr('data-zoom') ||
    $('.ui-pdp-gallery__figure img').first().attr('src') ||
    $('img.ui-pdp-image').first().attr('src') ||
    '';

  let currentPrice = null;
  let originalPrice = null;
  let discountPercent = null;

  // 1. Preço atual — aria-label="Agora: X reais..." (mais confiável)
  const $agoraEl = $('[aria-label^="Agora:"]').first();
  if ($agoraEl.length) {
    const f = $agoraEl.find('.andes-money-amount__fraction').text().trim();
    const c = $agoraEl.find('.andes-money-amount__cents').text().trim();
    if (f) currentPrice = parsePrice(f + (c ? `,${c}` : ''));
  }

  // 2. Fallback: classe --cents-superscript (elemento visual do preço atual)
  if (!currentPrice) {
    const $el = $('.andes-money-amount--cents-superscript').first();
    const f = $el.find('.andes-money-amount__fraction').text().trim();
    const c = $el.find('.andes-money-amount__cents').text().trim();
    if (f) currentPrice = parsePrice(f + (c ? `,${c}` : ''));
  }

  // 3. Fallback: JSON-LD (pode conter preço original em vez do atual)
  if (!currentPrice) {
    const jsonLd = extractJsonLd($);
    if (jsonLd?.offers) {
      const offers = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers;
      const rawLow = offers?.lowPrice ? parseFloat(offers.lowPrice) : null;
      const rawPrice = offers?.price ? parseFloat(offers.price) : null;
      currentPrice = rawLow || rawPrice || null;
    }
  }

  // Preço original — aria-label="Antes: X reais..." (dentro de <s>)
  const $antesEl = $('[aria-label^="Antes:"]').first();
  if ($antesEl.length) {
    const f = $antesEl.find('.andes-money-amount__fraction').text().trim();
    const c = $antesEl.find('.andes-money-amount__cents').text().trim();
    if (f) originalPrice = parsePrice(f + (c ? `,${c}` : ''));
  }

  // Fallback preço original: classe --previous (elemento visual riscado)
  if (!originalPrice) {
    const $el = $('.andes-money-amount--previous').first();
    const f = $el.find('.andes-money-amount__fraction').text().trim();
    const c = $el.find('.andes-money-amount__cents').text().trim();
    if (f) originalPrice = parsePrice(f + (c ? `,${c}` : ''));
  }

  const discountLabel = $('.ui-pdp-price__second-line__label,[data-testid="discount"],[class*="discount-label"]').first().text().trim();
  const discountMatch = discountLabel.match(/(\d+)\s*%/);
  if (discountMatch) {
    discountPercent = parseInt(discountMatch[1], 10);
  } else if (originalPrice && currentPrice && originalPrice > currentPrice) {
    discountPercent = Math.round((1 - currentPrice / originalPrice) * 100);
  }

  console.log(`[SCRAPER] Preço atual: ${currentPrice} | Preço original: ${originalPrice} | Desconto: ${discountPercent}%`);

  const features = [];
  $('.ui-pdp-features__item').each((_, el) => {
    const text = $(el).text().trim();
    if (text) features.push(text);
  });
  if (features.length === 0) {
    $('.andes-table__row,.ui-pdp-specs__table tr').each((_, el) => {
      const key = $(el).find('.andes-table__column--left,th').text().trim();
      const val = $(el).find('.andes-table__column--right,td').last().text().trim();
      if (key && val) features.push(`${key}: ${val}`);
    });
  }

  return { title, currentPrice, originalPrice, discountPercent, imageUrl, features: features.slice(0, 8), url: originalUrl };
}

async function downloadImage(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 15000,
    headers: { 'User-Agent': HEADERS['User-Agent'] },
  });
  return Buffer.from(res.data);
}

module.exports = { scrapeProduct, downloadImage };
