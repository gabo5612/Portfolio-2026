/* Utilidades de test. Sin dependencias: node:test viene con Node 18+.

   El motor sólo toca la red a través de `fetch`, así que interceptarlo
   permite probar el camino real completo —construcción de la URL, clave de
   API, reintentos, parseo— contra respuestas grabadas. */

/** Respuesta mínima con la superficie de `Response` que usa el motor. */
export function respuesta(cuerpo, { status = 200, headers = {}, url = 'https://tienda.test/' } = {}) {
  const mapa = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  const texto = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo);
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    headers: { get: k => mapa.get(String(k).toLowerCase()) ?? null },
    text: async () => texto,
    json: async () => (typeof cuerpo === 'string' ? JSON.parse(cuerpo) : cuerpo),
  };
}

/**
 * Sustituye fetch por una tabla de rutas.
 * @param {Array<[string|RegExp, object|function]>} rutas primera coincidencia gana
 * @returns {{restaurar:function, llamadas:string[]}}
 */
export function interceptarFetch(rutas) {
  const original = globalThis.fetch;
  const llamadas = [];

  globalThis.fetch = async (entrada, opciones = {}) => {
    const url = String(entrada);
    llamadas.push(url);
    for (const [patron, resultado] of rutas) {
      const coincide = patron instanceof RegExp ? patron.test(url) : url.includes(patron);
      if (coincide) {
        return typeof resultado === 'function' ? resultado(url, opciones) : resultado;
      }
    }
    return respuesta('sin ruta en el mock: ' + url, { status: 404, url });
  };

  return { restaurar: () => { globalThis.fetch = original; }, llamadas };
}

/** Silencia el log a stderr durante un test ruidoso. */
export function silenciar() {
  const original = console.error;
  console.error = () => {};
  return () => { console.error = original; };
}
