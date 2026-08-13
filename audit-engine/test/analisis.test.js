/* Dinero, score de lead y las reglas duras del análisis. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { calcularPerdida, fmt, num, OBJETIVO_LCP_S, PERDIDA_POR_S, PERDIDA_MAXIMA } from '../src/money.js';
import { calcularScore } from '../src/score.js';
import { validarAnalisis } from '../src/validate.js';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '..');

/* ── La invariante que sostiene la coherencia de marca ────────────── */

describe('money.js es espejo de la calculadora de la web', () => {
  test('las tres constantes coinciden con assets/main.js', async () => {
    const mainJs = await readFile(join(raiz, '..', 'assets', 'main.js'), 'utf8');
    const leer = nombre => {
      const m = mainJs.match(new RegExp(`${nombre}\\s*=\\s*([\\d.]+)`));
      assert.ok(m, `no se encontró ${nombre} en assets/main.js`);
      return Number(m[1]);
    };

    // Si esto falla, el número del informe y el de la web se contradicen y
    // el cliente lo nota. Cambiar uno obliga a cambiar el otro.
    assert.equal(OBJETIVO_LCP_S, leer('TARGET_LCP'));
    assert.equal(PERDIDA_POR_S, leer('LOSS_PER_S'));
    assert.equal(PERDIDA_MAXIMA, leer('MAX_LOSS'));
  });

  test('produce el mismo resultado que la web para el caso por defecto', () => {
    // La web arranca en 250.000 y 4,2 s y muestra 34.000.
    const r = calcularPerdida(4.2, 250000, 'USD', 'en-US');
    assert.equal(r.perdida_pct, 13.6);
    assert.equal(r.perdida_importe, 34000);
  });

  test('sin facturación no hay importe, sólo porcentaje', () => {
    const r = calcularPerdida(5.2, null);
    assert.equal(r.perdida_importe, null, 'un importe aquí sería inventado');
    assert.equal(r.perdida_pct, 21.6);
    assert.match(r.formula, /^\(5,2s − 2,5s\) × 8%\/s = 21,6%$/);
    assert.ok(r.supuestos.some(s => /desconocida/i.test(s)), 'declara el hueco');
  });

  test('por debajo del objetivo la pérdida es cero, nunca negativa', () => {
    const r = calcularPerdida(1.8, 100000);
    assert.equal(r.perdida_pct, 0);
    assert.equal(r.perdida_importe, 0);
    assert.equal(r.exceso_s, 0);
  });

  test('aplica el tope del 45% en tiendas catastróficas', () => {
    const r = calcularPerdida(30, 100000);
    assert.equal(r.perdida_pct, PERDIDA_MAXIMA, 'sin tope el número deja de ser creíble');
    assert.equal(r.perdida_importe, 45000);
  });

  test('una entrada basura se declara no medible, no se convierte en cero', () => {
    // Un 0% es una afirmación ("no pierdes nada"), y de una entrada
    // inválida no se puede afirmar nada.
    for (const malo of [null, undefined, NaN, '', 'abc']) {
      const r = calcularPerdida(malo, malo);
      assert.equal(r.medible, false, `entrada ${JSON.stringify(malo)}`);
      assert.equal(r.perdida_pct, null);
      assert.equal(r.perdida_importe, null);
      assert.equal(r.formula, null);
    }
  });

  test('formatea según el idioma del informe', () => {
    assert.equal(fmt(250000, 'USD', 'en-US'), '$250,000');
    assert.equal(fmt(250000, 'EUR', 'es-ES'), '€250.000');
    assert.equal(fmt(null), '—');
    assert.equal(num(21.6, 1, 'en-US'), '21.6');
    assert.equal(num(21.6, 1, 'es-ES'), '21,6');
  });
});

/* ── Score de lead ────────────────────────────────────────────────── */

describe('score.js ordena la cola', () => {
  const apps = n => ({ total: n });

  test('suma las señales del documento con su evidencia', () => {
    const r = calcularScore({
      psiMovil: { score: 31 }, apps: apps(19),
      tema: { a_medida: true, nombre: 'Dawn' }, moneda: 'USD', host: 'x.com',
      facturacionRango: 'alto',
    });
    assert.equal(r.total, 100, '30+20+20+20+10 = 100, topado a 100');
    assert.equal(r.prioridad, 'alta');
    assert.ok(r.señales.every(s => s.evidencia), 'cada señal viaja con su evidencia');
  });

  test('una tienda rápida cae al final de la cola', () => {
    // Regla 6: si va bien, no hay nada que venderle sin inventárselo.
    const r = calcularScore({ psiMovil: { score: 92 }, apps: apps(3), tema: null, moneda: 'USD', host: 'x.com' });
    assert.ok(r.total < 30);
    assert.equal(r.prioridad, 'baja');
    assert.ok(r.señales.some(s => s.puntos === -40));
  });

  test('el score nunca sale del rango 0-100', () => {
    const r = calcularScore({ psiMovil: { score: 95 }, apps: apps(0), tema: null, moneda: 'JPY', host: 'x.jp' });
    assert.ok(r.total >= 0 && r.total <= 100);
  });

  test('deduce el país por moneda o por dominio, con su confianza', () => {
    assert.equal(calcularScore({ psiMovil: {}, apps: apps(0), moneda: 'GBP', host: 'x.com' }).geo.pais, 'UK');
    const porTld = calcularScore({ psiMovil: {}, apps: apps(0), moneda: null, host: 'tienda.co.uk' });
    assert.equal(porTld.geo.pais, 'UK');
    assert.equal(porTld.geo.confianza, 'alta', 'el dominio es más fiable que la moneda');
    assert.equal(calcularScore({ psiMovil: {}, apps: apps(0), moneda: null, host: 'x.es' }).geo.pais, null);
  });
});

/* ── Las reglas duras, hechas código ──────────────────────────────── */

describe('validate.js bloquea lo que no debe llegar a un prospecto', () => {
  const cargar = async () => ({
    datos: JSON.parse(await readFile(join(raiz, 'fixtures', 'ejemplo.audit.json'), 'utf8')),
    base: JSON.parse(await readFile(join(raiz, 'fixtures', 'ejemplo.analysis.json'), 'utf8')),
  });
  const clon = o => JSON.parse(JSON.stringify(o));

  test('el análisis de ejemplo pasa', async () => {
    const { datos, base } = await cargar();
    const r = validarAnalisis(base, datos);
    assert.equal(r.ok, true, r.errores.join(' · '));
  });

  const casos = [
    ['un hallazgo sin evidencia', a => { delete a.hallazgos[0].evidencia; }, /sin evidencia/],
    ['más de cinco hallazgos', a => { a.hallazgos.push(clon(a.hallazgos[0])); }, /máximo es 5/],
    ['evidencia sin fuente', a => { a.hallazgos[0].evidencia.fuente = ''; }, /evidencia sin fuente/],
    ['evidencia sin fecha', a => { a.hallazgos[0].evidencia.fecha = ''; }, /evidencia sin fecha/],
    ['fecha mal formada', a => { a.hallazgos[0].evidencia.fecha = '12/08/2026'; }, /no es AAAA-MM-DD/],
    ['plan que no dura tres semanas', a => { a.plan_3_semanas.pop(); }, /exactamente 3/],
    ['impacto fuera del vocabulario', a => { a.hallazgos[0].impacto = 'crítico'; }, /impacto debe ser/],
    ['confianza inventada', a => { a.confianza = 'bastante'; }, /confianza debe ser/],
    ['quick win sin pasos', a => { a.quick_win_regalado.pasos = []; }, /quick win sin pasos/],
  ];

  for (const [nombre, romper, esperado] of casos) {
    test(`bloquea: ${nombre}`, async () => {
      const { datos, base } = await cargar();
      const a = clon(base);
      romper(a);
      const r = validarAnalisis(a, datos);
      assert.equal(r.ok, false, 'debería bloquear');
      assert.ok(r.errores.some(e => esperado.test(e)), `errores: ${r.errores.join(' · ')}`);
    });
  }

  test('bloquea un importe cuando la facturación es desconocida', async () => {
    const { datos, base } = await cargar();
    const a = clon(base);
    a.coste_estimado_mensual.valor = 34000;   // datos.dinero.facturacion_mensual es null
    const r = validarAnalisis(a, datos);
    assert.equal(r.ok, false);
    assert.ok(r.errores.some(e => /número inventado/.test(e)));
  });

  test('permite el importe cuando el cliente sí dio su facturación', async () => {
    const { datos, base } = await cargar();
    const d = clon(datos), a = clon(base);
    d.dinero.facturacion_mensual = 250000;
    a.coste_estimado_mensual.valor = 54000;
    assert.equal(validarAnalisis(a, d).ok, true);
  });

  test('exige confianza baja cuando la tienda ya va bien (regla 6)', async () => {
    const { datos, base } = await cargar();
    const d = clon(datos);
    d.rendimiento.movil.score = 88;
    assert.equal(validarAnalisis(clon(base), d).ok, false);

    const a = clon(base);
    a.confianza = 'baja';
    assert.equal(validarAnalisis(a, d).ok, true, 'con confianza baja sí pasa');
  });

  test('avisa de cifras que no salen de los datos recogidos', async () => {
    const { datos, base } = await cargar();
    const a = clon(base);
    a.hallazgos[0].que_pasa = 'La home tarda 9.7s en pintar el primer producto.';
    const r = validarAnalisis(a, datos);
    // Avisa en vez de bloquear: la heurística no puede distinguir un número
    // derivado legítimo de uno inventado. El juicio final es del paso ⑤.
    assert.equal(r.ok, true);
    assert.ok(r.avisos.some(x => /9\.7/.test(x)));
  });

  /* Este guardián falló tres veces de formas distintas mientras se escribía,
     y las tres eran silenciosas: aceptaba de todo. Los casos quedan fijados
     aquí porque un aviso que nunca salta es peor que no tenerlo — da una
     falsa sensación de red de seguridad. */
  describe('procedencia de las cifras escritas en la prosa', () => {
    const medidos = [
      ['5.2 s', 'lcp_s medido'],
      ['5.2s', 'sin espacio antes de la unidad'],
      ['1840 ms', 'TBT medido'],
      ['1240 KB', 'ahorro medido, en mayúsculas'],
      ['720 ms', 'bloqueo de un tercero'],
      ['21.6%', 'porcentaje medido, pegado al número'],
      ['31%', 'el score móvil'],
      ['4800 ms', 'p75 de CrUX'],
      ['7 s', 'redondeo fiel del speed index de 7.1 s'],
      ['4820 kb', 'peso total de la página'],
    ];
    const inventados = [
      ['9.7 s', 'nadie lo midió'],
      ['3.2 s', 'no vale que exista un 3 suelto en los datos'],
      ['888 kb', 'cerca de 890 no es 890'],
      ['1570 ms', 'derivado de sumar 720 + 510 + 340'],
      ['25%', 'la promesa de conversión que más fácil se cuela'],
      ['12.5%', 'nadie lo midió'],
      ['2400 kb', 'un LCP de 2.4 s no valida un tamaño en KB'],
      ['2026 ms', 'sólo aparece dentro de una fecha'],
      ['12.2 s', 'sólo aparece en la versión de Lighthouse'],
    ];

    const conCifra = (base, texto) => {
      const a = clon(base);
      a.hallazgos = [{
        titulo: 'T', que_pasa: `Sube un ${texto}, medido.`,
        por_que_cuesta_dinero: 'C', que_haria: 'Q',
        evidencia: { metrica: 'm', valor: 'v', fuente: 'f', fecha: '2026-08-12' },
        impacto: 'alto', esfuerzo_horas: 1,
      }];
      a.diagnostico_una_linea = 'Sin cifras';
      a.que_pasa_si_no_se_arregla = 'Sin cifras';
      return a;
    };
    const avisa = r => r.avisos.some(x => x.includes('no aparece'));

    for (const [cifra, porque] of medidos) {
      test(`acepta "${cifra}" — ${porque}`, async () => {
        const { datos, base } = await cargar();
        assert.equal(avisa(validarAnalisis(conCifra(base, cifra), datos)), false);
      });
    }
    for (const [cifra, porque] of inventados) {
      test(`avisa de "${cifra}" — ${porque}`, async () => {
        const { datos, base } = await cargar();
        assert.equal(avisa(validarAnalisis(conCifra(base, cifra), datos)), true);
      });
    }
  });

  test('avisa de la jerga de agencia sin bloquear', async () => {
    const { datos, base } = await cargar();
    const a = clon(base);
    a.hallazgos[0].que_haria = 'Leverage a holistic approach to digital presence';
    const r = validarAnalisis(a, datos);
    assert.equal(r.ok, true);
    assert.ok(r.avisos.some(x => /agencia/.test(x)));
  });

  test('no revienta con entradas degeneradas', () => {
    for (const basura of [null, undefined, 'texto', 42, []]) {
      const r = validarAnalisis(basura, null);
      assert.equal(r.ok, false);
      assert.ok(Array.isArray(r.errores) && r.errores.length);
    }
  });
});
