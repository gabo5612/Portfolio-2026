/* Etapa ② — Recogida de datos. Orquesta todo y devuelve un JSON crudo.

   Nada de prosa aquí: sólo hechos medidos, cada uno con su fuente y su
   fecha. La prosa la escribe la etapa ③ a partir de esto, y sólo puede
   usar números que aparezcan en esta salida. */

import { normalizeOrigin, hostOf, today, log } from './util.js';
import { runPsi } from './psi.js';
import { runCrux } from './crux.js';
import { cargarPagina, descubrirPaginas } from './page.js';
import { analizarInfra, confirmarShopifyEnHtml, detectarTema } from './infra.js';
import { detectarApps } from './apps.js';
import { calcularPerdida } from './money.js';
import { calcularScore, detectarMoneda } from './score.js';

/**
 * @param {string} entrada dominio o URL de la tienda
 * @param {object} opciones
 * @param {string[]} opciones.competidores URLs de competidores del mismo nicho
 * @param {number|null} opciones.facturacion facturación mensual, si el cliente la dio
 */
export async function auditar(entrada, opciones = {}) {
  const { competidores = [], facturacion = null, moneda = 'EUR', facturacionRango = null } = opciones;
  const origin = normalizeOrigin(entrada);
  const host = hostOf(origin);
  const faltantes = [];

  log(`\n▸ Auditando ${host}`);

  // ── Infraestructura y validación de que es Shopify ────────────────
  // Un dominio muerto, un DNS que no resuelve o un TLS roto son resultados
  // legítimos de una auditoría, no excepciones: tienen que salir como
  // `fallida` igual que el resto, no como una traza de pila sin JSON.
  let infra;
  try {
    infra = await analizarInfra(origin);
  } catch (err) {
    return fallida(origin, host, `no se pudo contactar con el dominio: ${err.message}`, 'inalcanzable');
  }

  const home = await cargarPagina(infra.url_final || origin);

  if (home.error) {
    return fallida(origin, host, `no se pudo descargar la home: ${home.error}`);
  }

  const shopifyHtml = confirmarShopifyEnHtml(home.html);
  const esShopify = infra.shopify.confirmado || shopifyHtml.confirmado;
  if (!esShopify) {
    // Validación §① punto 2. Respuesta honesta: sólo audito Shopify.
    return fallida(origin, host, 'no es una tienda Shopify', 'no_shopify');
  }

  // ── Estructura: home + ficha de producto + colección ──────────────
  const { producto, coleccion } = await descubrirPaginas(infra.url_final || origin, home.html);
  const paginas = [home];
  if (producto) paginas.push(await cargarPagina(producto));
  if (coleccion) paginas.push(await cargarPagina(coleccion));
  const validas = paginas.filter(p => p && !p.error);

  if (!producto) faltantes.push('No se localizó una ficha de producto pública.');
  if (!coleccion) faltantes.push('No se localizó una página de colección pública.');

  const tema = detectarTema(home.html);
  const monedaActiva = detectarMoneda(home.html);
  const apps = detectarApps(validas, host);
  if (!tema) faltantes.push('No se pudo identificar el tema (Shopify.theme no presente en el HTML).');

  // ── Rendimiento ───────────────────────────────────────────────────
  let psiMovil = null, psiEscritorio = null;
  try {
    psiMovil = await runPsi(infra.url_final || origin, 'mobile');
  } catch (err) {
    // Sin el dato móvil no hay informe. Es la métrica sobre la que se
    // sostiene todo el argumento: mejor fallar que rellenar el hueco.
    return fallida(origin, host, `PageSpeed móvil falló: ${err.message}`);
  }
  try {
    psiEscritorio = await runPsi(infra.url_final || origin, 'desktop');
  } catch (err) {
    faltantes.push(`No hay dato de PageSpeed en escritorio: ${err.message}`);
  }

  /* El origen tiene que ser el de después de la redirección: CrUX indexa por
     origen exacto, y casi toda tienda con dominio propio manda el ápex a
     www. Preguntando por el ápex se recibe un 404 y el dato de campo se
     descarta como "tráfico bajo" en tiendas que sí lo tienen.

     Y va envuelto porque es una fuente opcional: un fallo de red aquí no
     puede tumbar una auditoría por lo demás completa. */
  let crux;
  const origenCampo = origenDe(infra.url_final) || origin;
  try {
    crux = await runCrux(origenCampo, 'PHONE');
  } catch (err) {
    crux = { disponible: false, motivo: `la consulta falló: ${err.message}` };
  }
  if (!crux.disponible) {
    faltantes.push(`Sin dato de campo de usuarios reales: ${crux.motivo}.`);
  }

  // ── Competencia ───────────────────────────────────────────────────
  // Se auditan los competidores que TÚ indicas. Adivinarlos automáticamente
  // produciría comparaciones falsas, que es exactamente el fallo que hunde
  // la credibilidad en la primera frase.
  const competencia = [];
  for (const url of competidores.filter(Boolean)) {
    try {
      const co = normalizeOrigin(url);
      log(`  · competidor: ${hostOf(co)}`);
      const psi = await runPsi(co, 'mobile');
      competencia.push({
        host: hostOf(co), url: co,
        score: psi.score, lcp_s: psi.metricas.lcp_s, cls: psi.metricas.cls,
        fuente: psi.fuente, fecha: psi.fecha,
      });
    } catch (err) {
      log(`    ! falló: ${err.message}`);
    }
  }
  if (!competencia.length) {
    faltantes.push('Sin comparativa: no se indicaron competidores del mismo nicho.');
  }

  // ── Dinero y prioridad ────────────────────────────────────────────
  const dinero = calcularPerdida(psiMovil.metricas.lcp_s, facturacion, moneda);
  if (!dinero.medible) {
    // PSI respondió pero sin LCP. Rellenarlo con un 0 % tranquilizador es
    // exactamente el fallo que el motor existe para no cometer.
    faltantes.push('PageSpeed no devolvió Largest Contentful Paint: no se puede estimar la pérdida.');
  }
  if (facturacion == null) {
    faltantes.push('Facturación mensual desconocida: la pérdida sólo se expresa en porcentaje.');
  }

  const score = calcularScore({
    psiMovil, apps, tema, moneda: monedaActiva, host, facturacionRango,
  });

  return {
    estado: 'ok',
    tienda: { host, origin, url_final: infra.url_final, moneda_activa: monedaActiva },
    fecha_auditoria: today(),
    infra,
    tema,
    paginas: validas.map(p => ({
      url: p.url,
      bytes_html: p.bytes,
      scripts: p.recursos.scripts.length,
      imagenes: p.imagenes,
      fuentes: p.fuentes,
    })),
    apps,
    rendimiento: { movil: psiMovil, escritorio: psiEscritorio },
    campo: crux,
    competencia,
    dinero,
    lead_score: score,
    datos_faltantes: faltantes,
  };
}

/** Sólo el esquema y el host: es como CrUX indexa sus registros. */
function origenDe(url) {
  try { return new URL(url).origin; } catch { return null; }
}

function fallida(origin, host, motivo, codigo = 'error') {
  log(`  ✗ ${motivo}`);
  return {
    estado: 'fallida',
    codigo,
    motivo,
    tienda: { host, origin },
    fecha_auditoria: today(),
    // Riesgo §5: nunca envíes un informe con huecos. Marcarlo como fallido
    // es la salida correcta, no rellenar lo que falta.
    datos_faltantes: [motivo],
  };
}
