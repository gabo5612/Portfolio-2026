# Informe de trabajo

**Proyecto:** `gabo5612/Portfolio-2026` · sitio de Gabriel Arias (rendimiento Shopify) y su motor de auditoría
**Fecha:** 13 de agosto de 2026
**Punto de partida:** repositorio con un solo commit y un `README.md` de una línea

---

## Índice

1. [Resumen](#1-resumen)
2. [Alcance: qué es mío y qué no](#2-alcance-qué-es-mío-y-qué-no)
3. [Fase A: el sitio](#3-fase-a-el-sitio)
4. [Fase B: el motor de auditoría](#4-fase-b-el-motor-de-auditoría)
5. [Fase C: verificación](#5-fase-c-verificación)
6. [Fase D: revisión y correcciones](#6-fase-d-revisión-y-correcciones)
7. [Catálogo de fallos encontrados](#7-catálogo-de-fallos-encontrados)
8. [Decisiones que conviene no revertir](#8-decisiones-que-conviene-no-revertir)
9. [Estado actual e inventario](#9-estado-actual-e-inventario)
10. [Lo que falta](#10-lo-que-falta)

---

## 1. Resumen

Tres bloques de trabajo, en este orden:

| Bloque | Qué salió |
|---|---|
| **Sitio** | Página única estática desde el diseño de Claude Design. Sin framework, sin build. |
| **Motor** | Fases 0 a 2 de `workflow-auditoria-automatizada.md`: recogida, informe y lote. Cero dependencias. |
| **Verificación** | 129 tests y una revisión de código que destapó 12 hallazgos, 8 de ellos corregidos aquí. |

**Estado:** todo verde (`129/129`). Hay **un bloqueante externo**: sin una clave de PageSpeed Insights el motor no puede recoger datos, y esa clave no la puedo sacar yo.

El hallazgo más caro de todo el trabajo fue una fórmula que no cuadraba con el número impreso encima, en el propio documento que se le manda al cliente. Está en la [sección 7](#7-catálogo-de-fallos-encontrados).

---

## 2. Alcance: qué es mío y qué no

Durante el trabajo hubo **otra sesión escribiendo en paralelo** sobre los mismos archivos. Para que este informe sirva de algo, la separación:

**Escrito en esta sesión**

- `index.html`, `assets/styles.css`, `assets/main.js`
- `audit-engine/`: `util.js`, `psi.js`, `crux.js`, `page.js`, `infra.js`, `apps.js`, `signatures.js`, `money.js`, `score.js` (velocidad), `collect.js`, `validate.js` (`validarAnalisis`), `report/template.js`
- `bin/audit.js`, `bin/batch.js`, `bin/report.js`
- `analysis/prompt.md`, `analysis/schema.json`, `fixtures/`, `queue.example.csv`
- `.github/workflows/audit-batch.yml`, `.gitignore`, `CLAUDE.md`, `audit-engine/README.md`
- Toda la suite: `test/helpers.js`, `test/fixtures/`, `recogida.test.js`, `analisis.test.js`, `informe.test.js`, `regresiones.test.js`

**Aparecido desde la sesión paralela** (no lo he escrito ni revisado a fondo)

- Pista de SEO completa: `src/seo.js`, `src/seo-collect.js`, `report/seo-template.js`, `bin/seo.js`, `analysis/seo-prompt.md`, `analysis/seo-schema.json`, `test/seo.test.js`
- Añadidos a archivos míos: `validarAnalisisSeo` en `validate.js`, `calcularScoreSeo` en `score.js`, `x_robots_tag` en `infra.js`, la bandera `--seo` en `batch.js` y `report.js`
- `assets/i18n.js` y el marcado `data-i18n` del sitio

Cuando digo «arreglado» me refiero a lo mío. Los cuatro hallazgos de la revisión que caen en la pista de SEO están listados sin tocar, en la [sección 10](#10-lo-que-falta).

---

## 3. Fase A: el sitio

### Origen

Importado del proyecto de Claude Design `5cae3bfa-7493-4859-82c8-ca64d6e9d52d`, archivos `Home · Gabriel Arias.dc.html` y `Design System · Gabriel Arias.dc.html`. Son componentes `.dc.html` —plantilla `<x-dc>` con enlaces `{{ }}` y una clase `DCLogic`—, no páginas ejecutables: hay que portarlos, no copiar el runtime.

### Decisión de stack

**Sin framework, a propósito.** El argumento de venta de la página es la velocidad y su héroe es un medidor de PageSpeed: servir un bundle contradiría el producto. Toda la interactividad del diseño —cabecera pegajosa, scrubber de la tira de carga, calculadora de pérdida— cabe en ~130 líneas de JavaScript sin dependencias.

### Cómo quedó

| Archivo | Contenido |
|---|---|
| `index.html` | La página entera, marcado semántico |
| `assets/styles.css` | Tokens del sistema en `:root`, luego componentes |
| `assets/main.js` | Tres IIFE: cabecera, tira de carga, calculadora |

**El JS sólo refina.** Cada sección es legible y usable con `main.js` bloqueado: la tira renderiza un estado intermedio válido desde atributos `opacity` en línea, la calculadora trae su resultado correcto ya en el HTML, y el FAQ son `<details>` nativos. El marcado estático y el primer render del JS tienen que coincidir: con el scrubber en `30` (3,0 s), eso significa cabecera «antes» visible, héroe y rejilla ocultos, y todos los marcos «después» visibles.

El JS lee el DOM por ganchos `data-*` (`data-scrub`, `data-leak`, `data-frame="bHero"`), nunca por clases. Las clases son para estilo; renombrar una no puede romper comportamiento.

### La sección del servicio de auditoría

Añadida después, al integrar el documento de workflow. Observación que cambió el encaje: **la auditoría ya era un servicio en la web** —la tarjeta «Audit / Free / 48 hours»—, así que el documento no describía un servicio nuevo sino la maquinaria de entrega del que ya se vendía.

En vez de una cuarta tarjeta, quedó:

- La tarjeta «Audit» enumera lo que se entrega de verdad (5 hallazgos, comparativa con 2 competidores, plan de 3 semanas, quick win, vídeo de 3 min)
- Sección `#report` con las **siete partes del informe** en su orden real, con la nº 04 —el quick win regalado— destacada en verde por ser la pieza de reciprocidad
- Tira de procedencia: con qué se mide, qué acompaña a cada cifra, qué pasa antes de que llegue al cliente

### Verificación del sitio

Renderizado en Chromium headless a 1280 px y 390 px. Comprobado: cruce de clases usadas contra clases definidas, balance de etiquetas, anclas sin destino. La tira de carga a 3,0 s enseña el marco «antes» todavía en blanco y el «después» pintado, que es exactamente la demostración pretendida.

---

## 4. Fase B: el motor de auditoría

Implementa las fases 0 a 2 de `workflow-auditoria-automatizada.md`. Node 18+, ESM, **cero dependencias** (así el workflow de GitHub Actions arranca sin `npm install`).

### La tubería

```
bin/audit.js  ─────────►  JSON crudo
   (etapa 2)                  │
                              ▼
              tú lo pegas en Claude con analysis/prompt.md
                   (etapa 3 — cero API keys)
                              │
                              ▼
                        JSON de análisis
                              │
                              ▼
bin/report.js ─────────►  informe HTML autocontenido
   (etapa 4)

bin/batch.js  ─────────►  lo mismo sobre un CSV, + resumen ordenado por lead score
   (fase 2)                    (workflow nocturno en Actions)
```

### Etapa 2: recogida

`bin/audit.js dominio.com --competidores a.com,b.com`

Recoge, cada dato con su fuente y su fecha:

- **PSI móvil y escritorio**: score, LCP, CLS, TBT, speed index, FCP, TTI; oportunidades de Lighthouse ordenadas por ahorro en ms con URLs concretas como evidencia; desglose de peso por tipo de recurso; terceros con su bloqueo del hilo principal
- **CrUX History API**: percentil 75 de usuarios reales y su **tendencia** (`empeora` / `mejora` / `estable`), que persuade mucho más que una foto fija
- **Estructura**: home + una ficha de producto + una colección, descubiertas por los endpoints públicos de Shopify o, si están capados, por los enlaces de la home
- **Apps instaladas** por tabla de firmas (~60 apps en 14 categorías), cada detección con la URL exacta que la disparó y su nivel de confianza
- **Apps duplicadas** por categoría — el hallazgo más fácil de vender: «tienes 4 apps de reseñas cargando a la vez»
- **Infraestructura**: cadena de redirecciones, compresión, CDN, `cache-control`, HSTS
- **Tema y moneda** del objeto `Shopify.theme` / `Shopify.currency`
- **Competencia**: el mismo test a los competidores que **tú** indicas
- **Dinero** y **lead score** 0–100

### Etapa 3: análisis

`analysis/prompt.md` + `analysis/schema.json`. Sin API: se pega en Claude, coste marginal cero, tal como propone el documento. El prompt lleva las seis reglas duras literales y una sección de límites de la entrada que el redactor debe respetar (que las apps inyectadas por Tag Manager no se ven, que `campo.disponible:false` no se sustituye por dato de laboratorio, etc.).

### Etapa 4: el informe

HTML de ~19 KB, **sin una sola petición externa**: ni fuentes, ni scripts, ni imágenes remotas. IBM Plex se pide pero no se descarga —si el cliente la tiene, la usa; si no, cae a la del sistema—. El informe es en sí mismo la demostración del producto.

Sirve con `noindex`, nombre de archivo con token de 32 caracteres (la URL *es* la contraseña), CSS de impresión que pasa a tinta negra sobre blanco, y las siete secciones del documento en orden. Bilingüe: el idioma sale del análisis y las cifras se formatean con el locale del cliente.

### La validación, que es el freno

`src/validate.js` convierte las reglas duras en código. **Si el análisis se las salta, el informe no se genera.** Es intencionado: el paso 5 de la checklist no puede corregir lo que nunca llega a existir.

Bloquea: hallazgo sin evidencia · más de cinco hallazgos · evidencia sin métrica, valor, fuente o fecha · fecha mal formada · plan que no dura tres semanas · importe en euros cuando la facturación del cliente es desconocida · score móvil > 75 sin confianza `baja`.

Avisa sin bloquear: jerga de agencia · cifras escritas en la prosa que no salen de los datos recogidos.

### Fase 2: el lote

`bin/batch.js queue.csv` procesa un CSV (3 en paralelo, que PSI aguanta de sobra) y produce un JSON por tienda más un `resumen.csv` ordenado por lead score: **ése es el orden en que grabas los Looms**. El workflow de Actions lo corre a las 03:00 UTC de lunes a viernes y deja el resumen en la pantalla del propio job, para poder mirarlo desde el móvil sin descargar nada.

`queue.csv`, `auditorias/`, `informes/` y `analisis/` están en `.gitignore`: llevan emails de prospectos y datos de tiendas de terceros.

### Lo que el motor NO hace, a propósito

- **No envía nada.** No hay Resend, ni cola, ni formulario. Eso es la fase 3, y la regla de parada del documento dice que no se construya hasta que ésta haya dado al menos una llamada agendada.
- **No renderiza páginas.** Sin navegador. Lo que depende de renderizar —si una imagen se sirve más grande de lo que se muestra— se toma de las oportunidades de Lighthouse en vez de estimarse.
- **No adivina competidores.** Los pones tú. Adivinarlos produciría comparaciones falsas, y una comparación falsa hunde el informe en la primera frase.
- **No inventa la facturación.** En outbound no la conoces: la pérdida sale en porcentaje y el importe queda vacío.

Cada límite viaja declarado en el propio JSON, en campos `alcance`, para que no se olvide al redactar.

---

## 5. Fase C: verificación

`npm test` · **129 tests, 27 suites, ~20 s**, `node:test`, sin instalar nada.

**La red se intercepta en `fetch`.** Eso permite que `psi.js` y `crux.js` ejecuten su camino real —construcción de la URL, clave de API, reintentos, parseo— contra respuestas grabadas con la forma exacta que devuelven las APIs. Por eso la suite corre sin clave y sin gastar cuota.

Además del parseo, la suite fija los invariantes que sostienen el producto:

- **La fórmula del dinero es idéntica a la de la web.** El test lee las tres constantes de `assets/main.js` con una expresión regular y las compara con `money.js`. Si alguien cambia una sola, el test cae.
- El informe no emite ni una petición externa
- El contenido hostil se escapa (un título con `<script>` no inyecta nada)
- Una tienda que no es Shopify se descarta **antes** de gastar cuota de PSI
- Un fallo de PSI marca la auditoría como fallida en vez de emitir un informe con huecos
- Cada hueco acaba declarado en `datos_faltantes`

### Lo que sigue sin verificar

`psi.js` y `crux.js` **nunca han tocado las APIs reales**. La cuota anónima de PSI está agotada de forma global y devuelve `429` siempre; sin `PAGESPEED_API_KEY` no hay manera. Las fixtures reproducen la forma documentada, pero si Google cambia el esquema la suite no se enteraría.

---

## 6. Fase D: revisión y correcciones

Revisión con `/code-review` en alto esfuerzo sobre las ~5.400 líneas del motor. **12 hallazgos.** Verifiqué uno a uno los que tocan mi código antes de cambiar nada, y corregí 8, cada uno con su test de regresión en `test/regresiones.test.js`.

Nota sobre `/fullstack-guardian`, que fue lo que se pidió: es un skill **constructor** (levanta aplicaciones full-stack con seguridad por capas), no un verificador. Para «¿esto funciona?» las herramientas correctas eran la suite de tests y `/code-review`.

---

## 7. Catálogo de fallos encontrados

Todos comparten una forma, y es la que los hace peligrosos: **ninguno rompía nada. Todos producían un número, un color o un aviso tranquilizador y falso.**

### 7.1 El grave: la fórmula no daba el número impreso encima

El tope del 45% se aplicaba al resultado pero **no aparecía escrito en la ecuación**. En una tienda con LCP de 9,2 s el informe imprimía:

```
€250.000 × (9,2s − 2,5s) × 8%/s = €112.500
```

Esa ecuación da **€134.000**. A partir de 8,1 s de LCP —exactamente el perfil de tienda que este motor busca— el cliente recibía un documento cuya propia aritmética no cuadra, justo en la sección que presume de que *«tu desarrollador puede comprobarlo en treinta segundos»*.

**Corregido** escribiendo el tope dentro de la ecuación:

```
€250.000 × mín(45%, (9,2s − 2,5s) × 8%/s) = €112.500
```

Y el supuesto ahora explica que sin tope la estimación sería del 53,6%, que no es creíble. **El mismo defecto estaba en la calculadora de la web**, así que se corrigió en los dos sitios; comprobado en el navegador con LCP = 12.

### 7.2 El guardián de cifras estaba roto de cuatro formas, todas silenciosas

Es la pieza que impide mandar un número inventado a un prospecto de 2.000 €. Aceptaba prácticamente cualquier cosa:

| # | Mecanismo |
|---|---|
| 1 | Comparaba **subcadenas** sobre el JSON serializado entero: `"10"` casaba dentro de `"11044168"`. Cualquier cifra que redondease a un entero corto pasaba. |
| 2 | El `\b` final **nunca casa detrás de `%`** (ambos son no-palabra): **ningún porcentaje llegó a comprobarse jamás**. Justo la unidad donde se cuela un «subimos la conversión un 25%». |
| 3 | Al arreglar lo anterior, una tolerancia de `±0,5 × 1000` cubría ±500 ms alrededor de cada millar: **toda la recta numérica**. |
| 4 | La conversión s↔ms se aplicaba **sin mirar la unidad escrita**: un LCP de escritorio de 2,4 s validaba un «2400 kb». |

**Regla final**, comprobable de un vistazo: *un número escrito es legítimo si es el redondeo fiel de algo medido, a la precisión con la que se escribió*. Conversión s↔ms sólo si la unidad escrita es `s` o `ms`. Y el pajar son los **valores numéricos** del JSON, nunca dígitos dentro de cadenas, de modo que fechas, versiones e ids quedan fuera.

Discrimina los 29 casos que se le pusieron: acepta `5.2s`, `21.6%`, `7 s` (redondeo fiel de 7,1); avisa de `9.7s`, `25%`, `1570 ms` (derivado de sumar tres bloqueos), `2400 kb`, `2026 ms`. Los casos quedan fijados como tests: **un aviso que nunca salta es peor que no tenerlo, porque da una falsa sensación de red de seguridad**.

### 7.3 Fallos de parseo, encontrados al correr contra una tienda real

Corriendo el motor contra `allbirds.com`:

- **`<img :src="producto.imagen">` contaba como imagen.** El `\b` de la expresión regular casa entre `:` y `src`, así que los atributos enlazados de Vue/Alpine entraban. En los ejemplos del informe aparecían cosas como `cardRefs[`.
- **Los `hreflang` contaban como dominios de terceros.** Allbirds salía con 21 «terceros» que eran sus propios dominios de país. Un `<link rel="alternate">` apunta fuera pero no descarga nada.
- **Las fuentes con URL relativa al protocolo no se detectaban.** Shopify sirve `//cdn.shopify.com/…woff2` y la expresión exigía `https:`.

### 7.4 Un `clamp()` sin espacios

`clamp(2.5rem,1.8rem+3vw,4rem)` es CSS inválido: los operadores `+` y `−` en funciones matemáticas exigen espacios alrededor. La declaración entera se descartaba y la cifra grande del informe caía al tamaño por defecto: **16 px en vez de 64 px**.

### 7.5 El resto de la revisión

| Hallazgo | Qué pasaba |
|---|---|
| `--seo` se comía el argumento siguiente | `--out auditorias/ --seo` corría la auditoría de **velocidad** sobre toda la cola quemando cuota de PSI; en el otro orden, se tragaba el `--out` y escribía en la carpeta por defecto |
| LCP nulo → «0 %» | PSI podía responder sin LCP y el titular salía con un `0 %` tranquilizador y falso. Ahora es no medible: raya, sin fórmula, y el hueco declarado |
| Dominio muerto reventaba el CLI | Un DNS que no resuelve daba traza de pila sin JSON, en vez del `estado: "fallida"` que existe justo para eso |
| CrUX con el origen equivocado | Se preguntaba por el ápex cuando la tienda vive en `www` → 404 → el dato de usuarios reales se descartaba como «tráfico bajo» en tiendas que sí lo tienen. Y no estaba envuelto: un fallo de red tumbaba la auditoría entera por una fuente opcional |
| `null <= 0.1` es `true` | Una métrica ausente salía con el punto verde de «bien» al lado de una raya |
| Apóstrofo truncaba atributos | `alt="Australia's leading store"` se leía como `"Australia"`. La comilla de cierre no estaba atada a la de apertura |
| Apps perdían páginas | Al subir de confianza se reconstruía la entrada y se descartaban las páginas ya vistas |

### 7.6 Fallos en mis propios tests

Por honestidad: de los primeros fallos de la suite, varios eran **de los tests, no del código**. Un mock demasiado laxo que capturaba la llamada a PSI porque la URL del competidor viaja dentro del parámetro `url`; una aserción mal escrita; un evaluador de fórmulas que rompía con separadores de millar en inglés; una tolerancia que no contemplaba que la fórmula imprime el LCP redondeado; y una página de prueba con HTML vacío, que `detectarApps` salta por diseño.

---

## 8. Decisiones que conviene no revertir

1. **Sin framework en el sitio.** La página vende velocidad y su héroe es un medidor de PageSpeed.
2. **`money.js` es espejo de `assets/main.js`.** El número del informe de un cliente y el de la calculadora de la web tienen que coincidir o todo el conjunto se lee como improvisado. Hay un test que lo vigila; si cambias una constante, cambia las dos.
3. **Sin fuente, no hay número.** La recogida guarda `fuente` y `fecha` junto a cada cifra; la validación rechaza el hallazgo sin evidencia.
4. **Un hueco falla la auditoría, no se rellena.** Si PSI móvil falla, `collect.js` devuelve `fallida` y `report.js` se niega a generar. Todo lo no medible acaba en `datos_faltantes`, que el informe imprime.
5. **Nada llega a un prospecto sin revisión humana.** No existe código de envío, deliberadamente.
6. **Dark only.** `color-scheme: dark` y sin paleta clara; no añadir ramas `prefers-color-scheme`.
7. **Los marcadores de posición son intencionados.** Precios `€ —`, el medidor sin score, las tarjetas de estadística, los casos de estudio: cada uno con su distintivo ámbar. No son bugs y no se rellenan con valores inventados.

---

## 9. Estado actual e inventario

```
Portfolio/
├── index.html                    485   la página entera
├── assets/
│   ├── styles.css                655   tokens + componentes
│   ├── main.js                   170   cabecera, tira de carga, calculadora
│   └── i18n.js                   369   [sesión paralela] detección de idioma
├── audit-engine/
│   ├── bin/         audit · batch · report · seo
│   ├── src/         util · psi · crux · page · infra · apps · signatures
│   │                money · score · collect · validate  (+ seo, seo-collect)
│   ├── report/      template.js  (+ seo-template.js)
│   ├── analysis/    prompt.md · schema.json  (+ seo-*)
│   ├── fixtures/    datos sintéticos para probar sin gastar cuota
│   ├── test/        129 tests, red interceptada
│   └── README.md    manual de operación
├── .github/workflows/audit-batch.yml   lote nocturno
├── CLAUDE.md                     contexto para futuras sesiones
└── .gitignore                    protege emails de prospectos
```

**Líneas:** sitio ~1.680 · motor ~3.620 · tests ~1.575

**Git:** todo sigue **sin commitear** (`??` en `git status`). El único commit del repositorio es el inicial. El remoto es `gabo5612/Portfolio-2026`, pero el `github.md` del proyecto de diseño apunta a `gabo5612/Gabriel-Arias-Portfolio`: conviene confirmar cuál es el bueno antes de empujar.

---

## 10. Lo que falta

### Bloqueante

**La clave de PageSpeed Insights.** Cinco minutos, gratis, sin tarjeta, en la consola de Google Cloud. Sin ella el motor no recoge nada: la cuota anónima está agotada de forma global y devuelve `429` al primer intento. Activa también la *Chrome UX Report API* en el mismo proyecto para el dato de usuarios reales.

Con la clave puesta, el siguiente paso es el de la sección 7 del documento de workflow: correr el motor contra las 20 tiendas peores de tu lista, grabar 5 Looms y mandar 5 emails **hoy**.

### Hallazgos abiertos en la pista de SEO

Cuatro de la revisión, en archivos de la sesión paralela. No los toqué para no pisar trabajo en vuelo:

- Las casillas de grupo cuentan las comprobaciones `no_medible` como aprobadas: una tienda sin `robots.txt` enseña `6/6` en verde, contra la regla del propio archivo de que nunca se aprueba por defecto
- El check de `noindex` culpa a la cabecera `X-Robots-Tag` siempre que exista, aunque diga `noarchive`
- URLs con doble barra (`//robots.txt`) cuando la tienda redirige; hoy Shopify las sirve, pero van escritas en el informe como fuente de cada comprobación
- La ayuda del CLI dice 21 comprobaciones y se emiten 22, que es el número que ve el cliente

### Decisiones de negocio pendientes

- Precio del sprint y del retainer (hoy `€ —` con distintivo ámbar)
- Respuestas del FAQ, marcadas `Placeholder.` en el propio texto
- Enlace de Cal.com (el CTA es hoy un `mailto:`)
- Verificar contra la fuente primaria el coeficiente del 0,8% por cada 100 ms, y las tres tarjetas de estadística
- Casos de estudio: el primero necesita permiso del cliente, captura antes, captura después y la fecha de cada una

### Fases 3 y 4 del documento

Formulario, cola, Resend, panel de aprobación. **Deliberadamente sin construir.** La regla de parada del documento es explícita: no se construye la fase siguiente hasta que la actual haya dado al menos una llamada agendada. El propio documento avisa de que este sistema puede convertirse en la misma trampa que construir la web durante dos meses en vez de vender — «y es una trampa más divertida, porque programar es cómodo y vender no».
