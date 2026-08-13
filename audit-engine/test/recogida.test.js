/* Etapa ② — recogida de datos. */

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { runPsi } from '../src/psi.js';
import { runCrux } from '../src/crux.js';
import { cargarPagina, descubrirPaginas } from '../src/page.js';
import { detectarApps } from '../src/apps.js';
import { analizarInfra, confirmarShopifyEnHtml, detectarTema } from '../src/infra.js';
import { detectarMoneda } from '../src/score.js';
import { interceptarFetch, respuesta, silenciar } from './helpers.js';

const aqui = dirname(fileURLToPath(import.meta.url));
const leerFixture = n => readFile(join(aqui, 'fixtures', n), 'utf8').then(JSON.parse);

let activo = null;
afterEach(() => { activo?.restaurar(); activo = null; });

/* ── PSI ──────────────────────────────────────────────────────────── */

describe('psi.js contra una respuesta real de la API', () => {
  test('extrae score y convierte las métricas a sus unidades', async () => {
    const payload = await leerFixture('psi-mobile.json');
    activo = interceptarFetch([['pagespeedonline', respuesta(payload)]]);
    const callar = silenciar();
    const r = await runPsi('https://tienda.test/', 'mobile');
    callar();

    assert.equal(r.score, 31, 'score 0.31 → 31');
    assert.equal(r.metricas.lcp_s, 5.23, '5234.56 ms → 5.23 s');
    assert.equal(r.metricas.cls, 0.312, 'CLS a 3 decimales, sin dividir');
    assert.equal(r.metricas.tbt_ms, 1840, 'TBT en ms, redondeado');
    assert.equal(r.metricas.fcp_s, 3.4);
    assert.equal(r.metricas.tti_s, 12.63);
    assert.equal(r.estrategia, 'mobile');
  });

  test('arrastra fuente y fecha con cada medición (regla 4)', async () => {
    activo = interceptarFetch([['pagespeedonline', respuesta(await leerFixture('psi-mobile.json'))]]);
    const callar = silenciar();
    const r = await runPsi('https://tienda.test/');
    callar();

    assert.equal(r.fuente, 'PageSpeed Insights');
    assert.equal(r.version_lighthouse, '12.2.1');
    assert.equal(r.fecha, '2026-08-12', 'la fecha sale de fetchTime, no del reloj local');
    assert.equal(r.url_analizada, 'https://www.tienda.test/', 'usa finalUrl, no la pedida');
  });

  test('ordena las oportunidades por ahorro y descarta las que no ahorran nada', async () => {
    activo = interceptarFetch([['pagespeedonline', respuesta(await leerFixture('psi-mobile.json'))]]);
    const callar = silenciar();
    const { oportunidades } = await runPsi('https://tienda.test/');
    callar();

    assert.deepEqual(oportunidades.map(o => o.id),
      ['unused-javascript', 'uses-responsive-images', 'render-blocking-resources']);
    assert.equal(oportunidades[0].ahorro_ms, 2100);
    assert.equal(oportunidades[0].ahorro_kb, 890, '911360 B → 890 KB');
    assert.equal(oportunidades[0].ejemplos.length, 2, 'guarda URLs concretas como evidencia');
    assert.ok(!oportunidades.some(o => o.id === 'modern-image-formats'),
      'una oportunidad con ahorro 0 no es un hallazgo');
    assert.ok(!oportunidades.some(o => o.id === 'server-response-time'),
      'score 1 significa que ya está bien');
  });

  test('lee terceros tanto si entity es objeto como si es cadena', async () => {
    activo = interceptarFetch([['pagespeedonline', respuesta(await leerFixture('psi-mobile.json'))]]);
    const callar = silenciar();
    const { terceros, recursos } = await runPsi('https://tienda.test/');
    callar();

    // Lighthouse cambió la forma de `entity` entre versiones: soportar sólo
    // una deja el hallazgo más vendible del informe en "desconocida".
    assert.deepEqual(terceros.map(t => t.entidad), ['Yotpo', 'Loox', 'Judge.me']);
    assert.equal(terceros[0].bloqueo_ms, 720);
    assert.equal(recursos.total_kb, 4820);
    assert.equal(recursos.desglose.script.kb, 2140);
    assert.equal(recursos.desglose.total, undefined, '"total" no es un tipo de recurso');
  });

  test('añade la clave de API a la petición cuando existe', async () => {
    process.env.PAGESPEED_API_KEY = 'clave-de-prueba';
    activo = interceptarFetch([['pagespeedonline', respuesta(await leerFixture('psi-mobile.json'))]]);
    const callar = silenciar();
    await runPsi('https://tienda.test/');
    callar();
    delete process.env.PAGESPEED_API_KEY;

    assert.ok(activo.llamadas[0].includes('key=clave-de-prueba'));
    assert.ok(activo.llamadas[0].includes('strategy=mobile'));
  });

  test('lanza si la respuesta no trae lighthouseResult', async () => {
    activo = interceptarFetch([['pagespeedonline', respuesta({ kind: 'x' })]]);
    const callar = silenciar();
    await assert.rejects(() => runPsi('https://tienda.test/'), /lighthouseResult/);
    callar();
  });
});

/* ── CrUX ─────────────────────────────────────────────────────────── */

describe('crux.js', () => {
  test('calcula la serie p75 y la tendencia', async () => {
    process.env.CRUX_API_KEY = 'k';
    activo = interceptarFetch([['chromeuxreport', respuesta(await leerFixture('crux-history.json'))]]);
    const callar = silenciar();
    const r = await runCrux('https://tienda.test');
    callar();
    delete process.env.CRUX_API_KEY;

    assert.equal(r.disponible, true);
    assert.equal(r.series.largest_contentful_paint.ultimo, 4800);
    assert.equal(r.series.largest_contentful_paint.primero, 4100);
    assert.equal(r.series.largest_contentful_paint.tendencia, 'empeora');
    assert.equal(r.series.interaction_to_next_paint.tendencia, 'mejora');
    assert.equal(r.series.cumulative_layout_shift.tendencia, 'estable');
    assert.equal(r.series.cumulative_layout_shift.ultimo, 0.22, 'CLS conserva 3 decimales');
    assert.equal(r.fecha, '2026-08-08', 'la fecha es la del último periodo');
    assert.equal(r.periodos.length, 5);
  });

  test('sin clave no inventa nada: declara que no está disponible', async () => {
    const guardadas = [process.env.CRUX_API_KEY, process.env.PAGESPEED_API_KEY];
    delete process.env.CRUX_API_KEY; delete process.env.PAGESPEED_API_KEY;
    const callar = silenciar();
    const r = await runCrux('https://tienda.test');
    callar();
    if (guardadas[0]) process.env.CRUX_API_KEY = guardadas[0];
    if (guardadas[1]) process.env.PAGESPEED_API_KEY = guardadas[1];

    assert.equal(r.disponible, false);
    assert.match(r.motivo, /CRUX_API_KEY/);
  });

  test('un 404 significa tráfico bajo, no un error', async () => {
    process.env.CRUX_API_KEY = 'k';
    activo = interceptarFetch([['chromeuxreport', respuesta({}, { status: 404 })]]);
    const callar = silenciar();
    const r = await runCrux('https://tienda.test');
    callar();
    delete process.env.CRUX_API_KEY;

    assert.equal(r.disponible, false);
    assert.match(r.motivo, /tráfico bajo/);
  });
});

/* ── Parseo de HTML ───────────────────────────────────────────────── */

const HTML_TIENDA = `<!DOCTYPE html><html><head>
<title>Tienda</title>
<link rel="canonical" href="https://tienda.test/">
<link rel="alternate" hreflang="de" href="https://tienda.de/">
<link rel="alternate" hreflang="fr" href="https://tienda.fr/">
<link rel="stylesheet" href="//cdn.shopify.com/s/files/1/theme.css">
<link rel="preload" as="font" href="//cdn.shopify.com/s/fonts/inter.woff2" crossorigin>
<script src="https://cdn1.judge.me/widget.js"></script>
<script src="https://loox.io/widget/loox.js"></script>
<script src="https://static.klaviyo.com/onsite/js/klaviyo.js"></script>
<script>Shopify.theme = {"name":"Dawn a medida","id":123,"theme_store_id":null,"role":"main"};
Shopify.currency = {"active":"GBP","rate":"1.0"};</script>
<style>
@font-face{font-family:"Inter";src:url(/inter.woff2);font-display:swap}
@font-face{font-family:"Playfair";src:url(/playfair.woff2)}
</style>
</head><body>
<img src="/logo.png" alt="logo">
<img src="/hero.jpg" width="1200" height="600">
<img src="/a.jpg">
<img src="/b.webp" loading="lazy" srcset="/b.webp 1x">
<img src="/c.png">
<script type="text/x-template">
  <img :src="producto.imagen" :alt="producto.nombre">
  <img v-bind:src="cardRefs[i]">
</script>
<template><img :src="otro.thing"></template>
<a href="/products/camiseta-azul">Camiseta</a>
<a href="/collections/verano">Verano</a>
</body></html>`;

describe('page.js', () => {
  test('separa los link que descargan de los que sólo declaran', async () => {
    activo = interceptarFetch([['tienda.test', respuesta(HTML_TIENDA, { url: 'https://tienda.test/' })]]);
    const p = await cargarPagina('https://tienda.test/');

    assert.equal(p.recursos.scripts.length, 3);
    // hreflang y canonical apuntan fuera pero no cargan nada: contarlos como
    // terceros infla el número y te deja en evidencia en la primera frase.
    assert.ok(p.recursos.links.every(u => !u.includes('tienda.de')));
    assert.ok(p.recursos.meta.some(u => u.includes('tienda.de')));
    assert.equal(p.recursos.links.length, 2, 'stylesheet + preload');
  });

  test('no cuenta como imágenes las plantillas de JS', async () => {
    activo = interceptarFetch([['tienda.test', respuesta(HTML_TIENDA, { url: 'https://tienda.test/' })]]);
    const { imagenes } = await cargarPagina('https://tienda.test/');

    assert.equal(imagenes.total, 5, 'las <img> dentro de script/template no cuentan');
    assert.equal(imagenes.renderizadas_por_js, 0);
    assert.ok(imagenes.ejemplos_sin_lazy.every(s => s.startsWith('/')),
      'ningún ejemplo puede ser una expresión de plantilla tipo "cardRefs["');
    assert.equal(imagenes.sin_lazy, 2, 'las dos primeras se perdonan: son marca y hero');
    assert.equal(imagenes.sin_dimensiones, 4);
  });

  test('detecta font-display ausente y archivos con URL relativa al protocolo', async () => {
    activo = interceptarFetch([['tienda.test', respuesta(HTML_TIENDA, { url: 'https://tienda.test/' })]]);
    const { fuentes } = await cargarPagina('https://tienda.test/');

    assert.equal(fuentes.caras_font_face, 2);
    assert.equal(fuentes.caras_con_font_display, 1);
    assert.equal(fuentes.falta_font_display, true);
    assert.equal(fuentes.archivos_fuente, 1, '//cdn.shopify.com/...woff2 cuenta');
    assert.ok(fuentes.alcance, 'declara que sólo mira el CSS embebido');
  });

  test('descubre producto y colección por los endpoints públicos', async () => {
    activo = interceptarFetch([
      ['/products.json', respuesta({ products: [{ handle: 'camiseta-azul' }] })],
      ['/collections.json', respuesta({ collections: [{ handle: 'verano' }] })],
    ]);
    const callar = silenciar();
    const r = await descubrirPaginas('https://tienda.test', HTML_TIENDA);
    callar();

    assert.equal(r.producto, 'https://tienda.test/products/camiseta-azul');
    assert.equal(r.coleccion, 'https://tienda.test/collections/verano');
  });

  test('si los endpoints están capados, tira de los enlaces del HTML', async () => {
    activo = interceptarFetch([[/products\.json|collections\.json/, respuesta('', { status: 404 })]]);
    const callar = silenciar();
    const r = await descubrirPaginas('https://tienda.test', HTML_TIENDA);
    callar();

    assert.equal(r.producto, 'https://tienda.test/products/camiseta-azul');
    assert.equal(r.coleccion, 'https://tienda.test/collections/verano');
  });

  test('una página caída devuelve error en vez de romper el lote', async () => {
    activo = interceptarFetch([['tienda.test', () => { throw new Error('ECONNREFUSED'); }]]);
    const p = await cargarPagina('https://tienda.test/');
    assert.match(p.error, /ECONNREFUSED/);
  });
});

/* ── Tema, moneda, apps ───────────────────────────────────────────── */

describe('detección de tienda', () => {
  test('lee el tema y marca los que no vienen de la Theme Store', () => {
    const t = detectarTema(HTML_TIENDA);
    assert.equal(t.nombre, 'Dawn a medida');
    assert.equal(t.a_medida, true, 'theme_store_id null → a medida');
    assert.ok(t.fuente);
  });

  test('lee la moneda activa', () => {
    assert.equal(detectarMoneda(HTML_TIENDA), 'GBP');
    assert.equal(detectarMoneda('<html></html>'), null);
  });

  test('confirma Shopify por el HTML cuando el proxy oculta la cabecera', () => {
    assert.deepEqual(confirmarShopifyEnHtml(HTML_TIENDA), { confirmado: true, evidencia: 'cdn.shopify.com' });
    assert.equal(confirmarShopifyEnHtml('<html>woocommerce</html>').confirmado, false);
  });

  test('detecta apps, las duplicadas y separa los terceros del CDN propio', async () => {
    activo = interceptarFetch([['tienda.test', respuesta(HTML_TIENDA, { url: 'https://tienda.test/' })]]);
    const pagina = await cargarPagina('https://tienda.test/');
    const r = detectarApps([pagina], 'tienda.test');

    assert.equal(r.total, 3);
    assert.deepEqual(r.apps.map(a => a.id).sort(), ['judge-me', 'klaviyo', 'loox']);
    assert.ok(r.apps.every(a => a.confianza === 'alta'), 'coincidir en un recurso es evidencia fuerte');
    assert.ok(r.apps.every(a => a.evidencia), 'sin evidencia no se reporta');

    // El hallazgo que más fácil se vende: dos apps de lo mismo a la vez.
    assert.equal(r.duplicadas.length, 1);
    assert.equal(r.duplicadas[0].categoria, 'reseñas');
    assert.deepEqual(r.duplicadas[0].nombres.sort(), ['Judge.me', 'Loox']);

    const dominios = r.dominios_terceros.map(d => d.dominio);
    assert.ok(!dominios.some(d => d.endsWith('shopify.com')), 'el CDN de Shopify es la plataforma, no un tercero');
    assert.ok(dominios.includes('loox.io'));
    assert.ok(r.alcance, 'declara que no ve lo que inyecta un Tag Manager');
  });
});

/* ── Infraestructura ──────────────────────────────────────────────── */

describe('infra.js', () => {
  test('sigue la cadena de redirecciones y lee las cabeceras', async () => {
    activo = interceptarFetch([
      ['https://tienda.test', (url, o) => o.redirect === 'manual'
        ? respuesta('', { status: 301, headers: { location: 'https://www.tienda.test/' } })
        : respuesta('', {})],
      ['https://www.tienda.test', respuesta('', {
        headers: {
          'content-encoding': 'br', 'cf-ray': 'abc123',
          'strict-transport-security': 'max-age=31536000',
          'x-robots-tag': 'noindex',
        },
      })],
    ]);
    const r = await analizarInfra('https://tienda.test');

    assert.equal(r.url_final, 'https://www.tienda.test/');
    assert.equal(r.redirecciones.saltos, 1);
    assert.equal(r.redirecciones_encadenadas, false, 'un salto es normal');
    assert.equal(r.compresion, 'br');
    assert.equal(r.cdn, 'Cloudflare');
    assert.equal(r.hsts, true);
    assert.equal(r.x_robots_tag, 'noindex');
  });

  test('detecta Shopify por la cabecera x-shopid', async () => {
    activo = interceptarFetch([['tienda.test', respuesta('', { headers: { 'x-shopid': '11044168' } })]]);
    const r = await analizarInfra('https://tienda.test');
    assert.equal(r.shopify.confirmado, true);
    assert.equal(r.shopify.shop_id, '11044168');
    assert.equal(r.cdn, 'Shopify (Fastly)');
  });
});
