#!/usr/bin/env node
/* Etapa ④ — Valida el análisis y escribe el informe HTML.

   Detecta solo si es de velocidad o de SEO por el campo `tipo` del JSON de
   auditoría, así que no hay dos comandos que recordar.

   La validación no es opcional y no hay bandera para saltársela: el paso ⑤
   de la checklist no puede corregir lo que no llega a generarse, y eso es
   justo lo que impide que salga un número inventado hacia un prospecto.

   Uso:
     node bin/report.js auditorias/x.json analisis/x.analysis.json --out informes/
     node bin/report.js auditorias/x.seo.json analisis/x.seo.analysis.json --out informes/ \
       --loom https://loom.com/share/… --cal https://cal.com/…                       */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { renderInforme } from '../report/template.js';
import { renderInformeSeo } from '../report/seo-template.js';
import { validarAnalisis, validarAnalisisSeo } from '../src/validate.js';
import { reportToken, log } from '../src/util.js';

const args = parseArgs(process.argv.slice(2));
const [rutaDatos, rutaAnalisis] = args._;

if (!rutaDatos || !rutaAnalisis || args.help) {
  console.log(`
  node bin/report.js <auditoria.json> <analisis.json> [opciones]

    --out <carpeta>    dónde escribir el HTML (por defecto: informes/)
    --loom <url>       vídeo de Loom a incrustar
    --cal <url>        enlace de reserva para el único CTA
    --contacto <text>  pie del informe
    --forzar           escribe el informe aunque la validación falle
`);
  process.exit(args.help ? 0 : 1);
}

const datos = JSON.parse(await readFile(rutaDatos, 'utf8'));
const analisis = JSON.parse(await readFile(rutaAnalisis, 'utf8'));

if (datos.estado !== 'ok') {
  log(`✗ la auditoría está en estado "${datos.estado}": ${datos.motivo || 'sin motivo'}`);
  process.exit(1);
}

const esSeo = datos.tipo === 'seo';
const { ok, errores, avisos } = esSeo
  ? validarAnalisisSeo(analisis, datos)
  : validarAnalisis(analisis, datos);

for (const a of avisos) log(`  ▲ ${a}`);
for (const e of errores) log(`  ■ ${e}`);

if (!ok && !args.forzar) {
  log(`\n✗ ${errores.length} error(es) de validación. No se escribe el informe.`);
  log('  Corrige el análisis y vuelve a intentarlo, o usa --forzar si sabes lo que haces.');
  process.exit(1);
}

const html = (esSeo ? renderInformeSeo : renderInforme)(datos, analisis, {
  loomUrl: args.loom || null,
  calUrl: args.cal || null,
  contacto: args.contacto || null,
});

const carpeta = args.out || 'informes';
await mkdir(carpeta, { recursive: true });

/* Token largo en el nombre: el informe se sirve por URL sin autenticación,
   así que la URL es la contraseña. */
const archivo = join(carpeta, `${datos.tienda.host}${esSeo ? '-seo' : ''}-${reportToken()}.html`);
await writeFile(archivo, html);

log(`\n✓ ${archivo}`);
log(`  ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB, cero peticiones externas${args.loom ? ' salvo el iframe de Loom' : ''}`);
if (!ok) log('  ▲ escrito con --forzar y con errores de validación sin resolver');

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--forzar') out.forzar = true;
    else if (a.startsWith('--')) out[a.slice(2)] = argv[++i];
    else out._.push(a);
  }
  return out;
}
