/* CrUX History API — dato de campo de usuarios reales, percentil 75,
   últimas 25 semanas.

   Por qué esta API y no el dato de campo del PSI: Google está retirando
   CrUX del PSI API (riesgo §5). Además la serie histórica da tendencia,
   y una tendencia persuade mucho más que una foto fija.

   Requiere clave. Sin CRUX_API_KEY la sección se marca como no disponible
   y entra en `datos_faltantes` — nunca se rellena por analogía. */

import { fetchRetry, round, log } from './util.js';

const ENDPOINT = 'https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord';

const METRICAS = [
  'largest_contentful_paint',
  'interaction_to_next_paint',
  'cumulative_layout_shift',
];

export async function runCrux(origin, formFactor = 'PHONE') {
  const key = process.env.CRUX_API_KEY || process.env.PAGESPEED_API_KEY;
  if (!key) {
    log('  · CrUX: sin clave, se omite');
    return { disponible: false, motivo: 'sin CRUX_API_KEY' };
  }

  log(`  · CrUX History: ${origin}`);
  const res = await fetchRetry(`${ENDPOINT}?key=${key}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ origin, formFactor, metrics: METRICAS }),
    timeout: 60000,
  });

  if (!res.ok) {
    // 404 = el origen no tiene tráfico suficiente en el dataset. Es un dato
    // en sí mismo, no un error: significa tienda pequeña.
    const motivo = res.status === 404
      ? 'origen sin datos suficientes en CrUX (tráfico bajo)'
      : `HTTP ${res.status}`;
    log(`  · CrUX no disponible: ${motivo}`);
    return { disponible: false, motivo };
  }

  const data = await res.json();
  const rec = data.record || {};
  const periodos = (rec.collectionPeriods || []).map(p => p.lastDate)
    .map(d => `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`);

  const series = {};
  for (const [nombre, m] of Object.entries(rec.metrics || {})) {
    const p75 = (m.percentilesTimeseries?.p75s || []).map(v =>
      v == null ? null : round(Number(v), nombre === 'cumulative_layout_shift' ? 3 : 0));
    series[nombre] = {
      p75: p75,
      ultimo: p75.length ? p75[p75.length - 1] : null,
      primero: p75.length ? p75[0] : null,
      tendencia: calcularTendencia(p75),
    };
  }

  return {
    disponible: true,
    form_factor: formFactor,
    periodos,
    series,
    fuente: 'CrUX History API (percentil 75, usuarios reales)',
    fecha: periodos.length ? periodos[periodos.length - 1] : null,
  };
}

/** empeora / mejora / estable, comparando el primer y último p75 válidos. */
function calcularTendencia(serie) {
  const validos = serie.filter(v => v != null);
  if (validos.length < 2) return null;
  const a = validos[0], b = validos[validos.length - 1];
  if (!a) return null;
  const cambio = (b - a) / a;
  if (cambio > 0.05) return 'empeora';   // más tiempo = peor
  if (cambio < -0.05) return 'mejora';
  return 'estable';
}
