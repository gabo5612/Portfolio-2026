/* Detección de apps instaladas y de scripts de terceros.

   Cada detección arrastra la URL exacta que la disparó: sin evidencia no
   se reporta, y el paso ⑤ (revisión humana) existe precisamente para
   descartar los falsos positivos que queden. */

import { FIRMAS, CATEGORIAS_EXCLUYENTES } from './signatures.js';
import { hostOf } from './util.js';

/**
 * @param {Array<{url:string, html:string, recursos:{scripts:string[], links:string[]}}>} paginas
 * @param {string} tiendaHost host de la propia tienda, para separar 1ª de 3ª parte
 */
export function detectarApps(paginas, tiendaHost) {
  const encontradas = new Map();

  for (const pagina of paginas) {
    if (!pagina?.html) continue;
    const candidatas = [...pagina.recursos.scripts, ...pagina.recursos.links];

    for (const firma of FIRMAS) {
      for (const patron of firma.patrones) {
        // 1) Coincidencia en un recurso cargado — la evidencia más fuerte.
        const recurso = candidatas.find(u => u.toLowerCase().includes(patron));
        if (recurso) {
          registrar(encontradas, firma, recurso, pagina.url, 'recurso');
          break;
        }
        // 2) Coincidencia en el HTML — más débil, se marca como tal.
        if (pagina.html.toLowerCase().includes(patron)) {
          registrar(encontradas, firma, patron, pagina.url, 'html');
          break;
        }
      }
    }
  }

  const apps = [...encontradas.values()].sort((a, b) =>
    a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre));

  return {
    total: apps.length,
    apps,
    duplicadas: detectarDuplicadas(apps),
    dominios_terceros: dominiosTerceros(paginas, tiendaHost),
    // Importante para no exagerar en el informe: las apps que un Tag Manager
    // inyecta después no aparecen aquí. "0 apps" significa "ninguna en el
    // HTML inicial", nunca "la tienda no tiene apps".
    alcance: 'apps presentes en el HTML inicial; las inyectadas por Tag Manager no se ven',
  };
}

function registrar(mapa, firma, evidencia, pagina, tipo) {
  const previa = mapa.get(firma.id);

  if (previa) {
    if (!previa.paginas.includes(pagina)) previa.paginas.push(pagina);
    // Una evidencia de tipo "recurso" gana a una de tipo "html", pero sólo
    // sustituye la evidencia y la confianza: las páginas ya vistas se
    // conservan, o la lista del informe sale incompleta.
    if (previa.confianza === 'media' && tipo === 'recurso') {
      previa.evidencia = evidencia;
      previa.confianza = 'alta';
    }
    return;
  }

  mapa.set(firma.id, {
    id: firma.id,
    nombre: firma.nombre,
    categoria: firma.categoria,
    evidencia,
    confianza: tipo === 'recurso' ? 'alta' : 'media',
    paginas: [pagina],
  });
}

/** Dos apps de reseñas cargando a la vez. Esto es lo que se vende. */
function detectarDuplicadas(apps) {
  const porCategoria = {};
  for (const app of apps) {
    (porCategoria[app.categoria] ||= []).push(app.nombre);
  }
  return Object.entries(porCategoria)
    .filter(([cat, lista]) => lista.length > 1 && CATEGORIAS_EXCLUYENTES.includes(cat))
    .map(([categoria, nombres]) => ({ categoria, cuantas: nombres.length, nombres }));
}

/** Todos los dominios externos que la tienda carga, con cuántos recursos de cada uno. */
function dominiosTerceros(paginas, tiendaHost) {
  const cuenta = new Map();
  for (const pagina of paginas) {
    if (!pagina?.recursos) continue;
    for (const url of [...pagina.recursos.scripts, ...pagina.recursos.links]) {
      const host = hostOf(url);
      if (!host || host === tiendaHost) continue;
      // El CDN de Shopify es la propia plataforma, no un tercero.
      if (host.endsWith('shopify.com') || host.endsWith('shopifycdn.com')) continue;
      cuenta.set(host, (cuenta.get(host) || 0) + 1);
    }
  }
  return [...cuenta.entries()]
    .map(([dominio, recursos]) => ({ dominio, recursos }))
    .sort((a, b) => b.recursos - a.recursos);
}
