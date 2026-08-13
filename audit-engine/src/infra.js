/* Infraestructura: cabeceras, compresión, CDN y redirecciones encadenadas.
   También la validación de que la tienda es realmente Shopify (etapa ①). */

import { fetchRetry, hostOf } from './util.js';

/** Sigue la cadena de redirecciones a mano para poder contarla. */
export async function seguirRedirecciones(url, maxSaltos = 6) {
  const cadena = [];
  let actual = url;

  for (let i = 0; i < maxSaltos; i++) {
    const res = await fetchRetry(actual, { redirect: 'manual', timeout: 30000, retries: 2 });
    const destino = res.headers.get('location');
    cadena.push({ url: actual, status: res.status, destino: destino || null });
    if (res.status < 300 || res.status >= 400 || !destino) {
      return { cadena, final: actual, saltos: cadena.length - 1, respuesta: res };
    }
    actual = new URL(destino, actual).href;
  }
  return { cadena, final: actual, saltos: cadena.length - 1, respuesta: null };
}

export async function analizarInfra(origin) {
  const { cadena, final, saltos, respuesta } = await seguirRedirecciones(origin);
  const res = respuesta || await fetchRetry(final, { timeout: 30000 });
  const h = res.headers;

  const cacheControl = h.get('cache-control');
  const server = h.get('server') || '';
  const powered = h.get('x-powered-by') || '';

  return {
    url_final: final,
    redirecciones: { saltos, cadena },
    // Más de un salto antes de servir el HTML es latencia pura antes del
    // primer byte, y en móvil se nota.
    redirecciones_encadenadas: saltos > 1,
    compresion: h.get('content-encoding') || 'ninguna',
    cache_control: cacheControl,
    cdn: detectarCdn(h, server),
    servidor: server || powered || null,
    shopify: detectarShopify(h),
    hsts: Boolean(h.get('strict-transport-security')),
    // Lo lee la auditoría SEO: un noindex servido por cabecera no se ve en
    // el HTML y es la forma más silenciosa de desaparecer de Google.
    x_robots_tag: h.get('x-robots-tag') || null,
    fuente: 'cabeceras HTTP de respuesta',
  };
}

function detectarCdn(h, server) {
  if (h.get('cf-ray')) return 'Cloudflare';
  if (h.get('x-shopid') || /shopify/i.test(server)) return 'Shopify (Fastly)';
  if (h.get('x-served-by') || h.get('x-fastly-request-id')) return 'Fastly';
  if (h.get('x-amz-cf-id')) return 'CloudFront';
  if (h.get('x-akamai-transformed')) return 'Akamai';
  return null;
}

/** Validación §① punto 2: ¿es realmente Shopify? */
function detectarShopify(headers) {
  const shopId = headers.get('x-shopid');
  const stage = headers.get('x-shopify-stage');
  return {
    confirmado: Boolean(shopId || stage),
    shop_id: shopId || null,
    evidencia: shopId ? 'cabecera x-shopid' : stage ? 'cabecera x-shopify-stage' : null,
  };
}

/**
 * Confirma Shopify también por el HTML, que es donde se ve en la mayoría de
 * tiendas con dominio propio detrás de un proxy.
 */
export function confirmarShopifyEnHtml(html) {
  if (!html) return { confirmado: false, evidencia: null };
  const señales = [
    ['cdn.shopify.com', /cdn\.shopify\.com/i],
    ['Shopify.theme', /Shopify\.theme/],
    ['shopify-features', /shopify-features/i],
    ['myshopify.com', /myshopify\.com/i],
  ];
  for (const [nombre, re] of señales) {
    if (re.test(html)) return { confirmado: true, evidencia: nombre };
  }
  return { confirmado: false, evidencia: null };
}

/** Tema y versión, del objeto Shopify.theme que la plataforma inyecta. */
export function detectarTema(html) {
  if (!html) return null;
  const m = html.match(/Shopify\.theme\s*=\s*(\{[^;]*\})/);
  if (!m) return null;
  try {
    const t = JSON.parse(m[1]);
    return {
      nombre: t.name || null,
      id: t.id || null,
      theme_store_id: t.theme_store_id ?? null,
      // Sin theme_store_id el tema no viene de la Theme Store: es a medida o
      // muy modificado. Señal de que invierten en la tienda (+10 al score).
      a_medida: t.theme_store_id == null,
      rol: t.role || null,
      fuente: 'objeto Shopify.theme en el HTML',
    };
  } catch { return null; }
}

/** Dominio del cliente, para el asunto del email y el titular del informe. */
export const marcaDe = url => hostOf(url);
