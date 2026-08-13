/* Carga audit-engine/.env si existe, antes de que nadie lea process.env.

   Sin esto el fallo es silencioso y engañoso: la clave está en el .env, nadie
   la lee, PSI se consulta de forma anónima y devuelve HTTP 429 al primer
   intento. Eso parece un problema de cuota de Google, no un .env sin cargar.

   Lo importan los bin/, no los src/: así los tests siguen siendo herméticos y
   una clave real en el .env del desarrollador no altera lo que miden.

   Las variables que ya vengan del entorno ganan — process.loadEnvFile no
   sobrescribe, y en CI la clave llega por el entorno de GitHub Actions. */

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ruta = fileURLToPath(new URL('../.env', import.meta.url));

// loadEnvFile llegó en Node 20.12; el README promete Node 18+.
if (existsSync(ruta) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(ruta);
}
