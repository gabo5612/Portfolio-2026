/* Etapa ② de la auditoría SEO — recogida de datos.

   Hermana de collect.js, misma forma y mismas reglas: sólo hechos medidos,
   cada uno con fuente y fecha; la prosa la escribe la etapa ③ y sólo puede
   usar lo que salga de aquí.

   Diferencia importante con la de velocidad: aquí NO hay traducción a
   dinero. Estimar euros perdidos por SEO exige volumen de búsqueda y CTR
   por posición, y ninguno de los dos se puede medir desde fuera sin una
   API de pago. El titular de este informe es contable — cuántas
   comprobaciones fallan y cuáles — y eso se puede verificar entero desde
   el navegador del cliente en cinco minutos. */

import { normalizeOrigin, hostOf, today, log } from './util.js';
import { cargarPagina, descubrirPaginas } from './page.js';
import { analizarInfra, confirmarShopifyEnHtml, detectarTema } from './infra.js';
import { detectarMoneda, calcularScoreSeo } from './score.js';
import {
  leerMetadatos, leerRobots, leerSitemap, comprobar404,
  comprobarLlmsTxt, comprobarRutaDuplicada, comprobar, resumir, pareceEscaparate,
} from './seo.js';

/**
 * @param {string} entrada dominio o URL de la tienda
 * @param {object} opciones
 * @param {string} opciones.facturacionRango rango declarado en el formulario
 */
export async function auditarSeo(entrada, opciones = {}) {
  const { facturacionRango = null } = opciones;
  const origin = normalizeOrigin(entrada);
  const host = hostOf(origin);
  const faltantes = [];

  log(`\n▸ Auditando SEO de ${host}`);

  const infra = await analizarInfra(origin);
  const base = infra.url_final || origin;
  const home = await cargarPagina(base);

  if (home.error) return fallida(origin, host, `no se pudo descargar la home: ${home.error}`);

  const esShopify = infra.shopify.confirmado || confirmarShopifyEnHtml(home.html).confirmado;
  if (!esShopify) return fallida(origin, host, 'no es una tienda Shopify', 'no_shopify');

  /* Antes de medir nada: ¿esto es el escaparate? Si la cadena de
     redirecciones nos ha dejado en el checkout o en un muro de bots,
     auditarlo produce fallos catastróficos sobre una tienda que está
     bien. Mejor fallar y volver con la URL correcta. */
  const metaHome = leerMetadatos({ rol: 'home', ...home });
  const escaparate = pareceEscaparate(metaHome, home.final_url || base);
  if (!escaparate.ok) return fallida(origin, host, escaparate.motivo, 'no_escaparate');

  // ── Las tres plantillas que deciden el SEO de una tienda ──────────
  const { producto, coleccion } = await descubrirPaginas(base, home.html);
  const paginas = [{ rol: 'home', ...home }];
  if (producto) paginas.push({ rol: 'producto', ...(await cargarPagina(producto)) });
  if (coleccion) paginas.push({ rol: 'coleccion', ...(await cargarPagina(coleccion)) });

  const validas = paginas.filter(p => !p.error).map(p => ({ ...p, meta: leerMetadatos(p) }));
  for (const p of paginas.filter(p => p.error)) {
    faltantes.push(`No se pudo descargar la plantilla de ${p.rol}: ${p.error}.`);
  }
  if (!producto) faltantes.push('No se localizó una ficha de producto pública: sin ella no se puede juzgar el schema Product, que es la comprobación de más valor.');
  if (!coleccion) faltantes.push('No se localizó una página de colección pública.');

  // ── Las seis peticiones extra, en paralelo ────────────────────────
  log('  · robots, sitemap, 404, llms.txt y ruta duplicada');
  const [robots, sitemap, notFound, llms, duplicada] = await Promise.all([
    leerRobots(base),
    leerSitemap(base),
    comprobar404(base),
    comprobarLlmsTxt(base),
    comprobarRutaDuplicada(producto, coleccion),
  ]);
  if (!duplicada.medible) faltantes.push(`No se pudo comprobar la ruta duplicada de producto: ${duplicada.motivo}.`);

  const comprobaciones = comprobar({
    origin: base,
    paginas: validas,
    robots, sitemap, notFound, duplicada, llms,
    xRobotsTag: infra.x_robots_tag,
  });

  const resumen = resumir(comprobaciones);
  const tema = detectarTema(home.html);
  const monedaActiva = detectarMoneda(home.html);
  if (!tema) faltantes.push('No se pudo identificar el tema (Shopify.theme no presente en el HTML).');

  /* Lo que esta auditoría no mide, dicho antes de que lo pregunte nadie.
     Es también la lista de lo que sí incluye el sprint de pago. */
  faltantes.push(
    'Sin acceso a Search Console: no hay datos de impresiones, posiciones ni páginas realmente indexadas.',
    'Sin datos de volumen de búsqueda: esta auditoría no estima tráfico ni ingresos perdidos, sólo el estado técnico verificable desde fuera.',
    `Alcance: tres plantillas (${validas.map(p => p.rol).join(', ')}), no el catálogo entero.`,
  );

  return {
    estado: 'ok',
    tipo: 'seo',
    tienda: { host, origin, url_final: infra.url_final, moneda_activa: monedaActiva },
    fecha_auditoria: today(),
    infra: { url_final: infra.url_final, redirecciones: infra.redirecciones, hsts: infra.hsts, shopify: infra.shopify },
    tema,
    paginas: validas.map(p => ({
      rol: p.rol,
      url: p.meta.url_final,
      title: p.meta.title,
      title_caracteres: p.meta.title.length,
      meta_description: p.meta.meta_description,
      meta_description_caracteres: p.meta.meta_description.length,
      canonical: p.meta.canonical,
      h1: p.meta.h1,
      schema_tipos: p.meta.json_ld.tipos,
      imagenes: p.meta.imagenes,
    })),
    robots, sitemap,
    error_404: notFound,
    ruta_duplicada: duplicada,
    llms_txt: llms,
    comprobaciones,
    resumen,
    lead_score: calcularScoreSeo({ resumen, comprobaciones, tema, moneda: monedaActiva, host, facturacionRango }),
    datos_faltantes: faltantes,
  };
}

function fallida(origin, host, motivo, codigo = 'error') {
  log(`  ✗ ${motivo}`);
  return {
    estado: 'fallida',
    tipo: 'seo',
    codigo, motivo,
    tienda: { host, origin },
    fecha_auditoria: today(),
    datos_faltantes: [motivo],
  };
}
