# Servicio de SEO para Shopify — informe de trabajo

**Fecha:** 12–13 de agosto de 2026
**Alcance:** añadir el SEO técnico de Shopify como segundo servicio, con su
auditoría automatizada, su lugar en el flujo de trabajo y su lugar en la web.

---

## 1. Decisiones de partida

Tres preguntas condicionaban el trabajo entero. Las respuestas fueron:

| Pregunta | Respuesta | Consecuencia |
|---|---|---|
| ¿Cómo se vende el SEO frente al sprint de velocidad? | **Por separado y también en conjunto**, para no obligar a nadie a pagar por algo que no le interesa | Dos sprints hermanos de 30 días + una tira de paquete |
| ¿Cuál es el segundo servicio además del SEO? | **Sólo SEO por ahora** | La web pasa de una oferta a dos, no a tres |
| ¿Una auditoría gratuita o dos? | **Dos auditorías separadas** | Dos motores, dos plantillas de informe, dos colas de outbound |

La tercera es la que más código implicó: el prospecto elige velocidad **o**
SEO, cada uno con su correo, su Loom y su informe.

---

## 2. Inventario de lo entregado

### Archivos nuevos

| Archivo | Líneas | Qué es |
|---|---|---|
| `audit-engine/src/seo.js` | 662 | Las 22 comprobaciones, el parseo del HTML y las peticiones extra |
| `audit-engine/src/seo-collect.js` | 137 | Orquestación de la auditoría → JSON crudo |
| `audit-engine/bin/seo.js` | 76 | CLI |
| `audit-engine/analysis/seo-prompt.md` | 112 | Etapa ③ — el prompt de análisis |
| `audit-engine/analysis/seo-schema.json` | 121 | Esquema de salida de la etapa ③ |
| `audit-engine/report/seo-template.js` | 405 | Informe HTML autocontenido |
| `audit-engine/bin/report.js` | 89 | CLI de informes, elige plantilla por tipo |
| `audit-engine/test/seo.test.js` | 388 | 30 tests |
| `scratchpad/seo-sitio.md` | — | Los cambios del sitio, listos para aplicar |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/score.js` | `calcularScoreSeo()` nuevo; `detectarGeo()` pasa a exportarse |
| `src/infra.js` | Añadido `x_robots_tag` a la salida (un noindex por cabecera no se ve en el HTML) |
| `src/validate.js` | `validarAnalisisSeo()` nuevo; `jergaDeAgencia()` generalizado; jerga de SEO añadida a la lista |
| `bin/batch.js` | Bandera `--seo`: misma cola, motor de SEO, resumen y CSV propios |
| `report/template.js` | `CSS` pasa a exportarse para que las dos plantillas compartan estilos |
| `CLAUDE.md` | Comandos y sección de arquitectura del motor de SEO |

---

## 3. La auditoría SEO automatizada

```bash
node bin/seo.js tienda.com
node bin/seo.js tienda.com --out auditorias-seo/
node bin/batch.js queue.csv --seo --out auditorias-seo/
```

Sin API key, sin dependencias. Seis peticiones extra sobre las de la
auditoría de velocidad, y corre en segundos.

### Qué mide: 22 comprobaciones en cuatro grupos

**Rastreo e indexación (6)** — si Google no puede entrar, lo demás sobra.

| id | Comprueba |
|---|---|
| `robots_txt` | Que exista y sea accesible |
| `robots_bloqueos` | Que no bloquee `/products`, `/collections` o `/pages` |
| `sitemap_declarado` | Línea `Sitemap:` en robots.txt |
| `sitemap_xml` | Índice servido, con sus secciones |
| `noindex` | Meta robots y cabecera `X-Robots-Tag` en las tres plantillas |
| `error_404` | Que una URL inventada devuelva 404 y no un soft 404 |

**Contenido duplicado (4)** — la especialidad de Shopify.

| id | Comprueba |
|---|---|
| `canonical_presente` | Canonical en las tres plantillas |
| `canonical_autoreferente` | Que apunte a la propia página |
| `ruta_duplicada` | Que `/collections/x/products/y` canonicalice a `/products/y` |
| `hreflang` | Coherencia y presencia de `x-default` |

**Metadatos de página (5)**

| id | Comprueba |
|---|---|
| `title_presente` | Existe y mide entre 15 y 65 caracteres |
| `title_unico` | Distinto en cada plantilla |
| `meta_description` | Existe y mide entre 70 y 160 caracteres |
| `h1_unico` | Exactamente uno por plantilla |
| `alt_imagenes` | Atributo `alt` declarado |

**Resultados enriquecidos y buscadores con IA (7)**

| id | Comprueba |
|---|---|
| `schema_product` | `Product` o `ProductGroup` con name, image, price, priceCurrency y availability |
| `schema_breadcrumb` | `BreadcrumbList` en la ficha |
| `schema_organization` | `Organization` o `WebSite` en la home |
| `schema_coleccion` | `ItemList` o `CollectionPage` en la colección |
| `open_graph` | `og:title` y `og:image` |
| `json_ld_valido` | Ningún bloque JSON-LD roto |
| `llms_txt` | Presencia, marcada como informativa |

### El total es siempre 22

Una comprobación que no se puede ejecutar se emite como `no_medible`, nunca
se descarta. Si faltara `robots.txt` el total bajaría a 20 y la cifra que la
web publica sería falsa. Hay un test que lo fija.

### Estados

`pasa` · `falla` · `aviso` · `no_aplica` · `no_medible`

`no_aplica` y `no_medible` no cuentan en el porcentaje de salud: lo que no
se pudo medir no suma ni resta. Una tienda de un solo mercado sin hreflang
no tiene una carencia, tiene una comprobación que no le toca.

### Lo que deliberadamente **no** hace

Ni palabras clave, ni backlinks, ni intención de búsqueda, ni calidad de
contenido. Todo eso necesita el Search Console del cliente y APIs de pago.
Regalarlo en la auditoría automática devalúa el sprint y, desde fuera, no se
puede medir sin inventar. Va declarado en `datos_faltantes` de cada informe.

---

## 4. Dos reglas que gobiernan el módulo

### Prohibido el dinero

La auditoría de velocidad traduce a euros porque tiene un LCP medido y un
coeficiente citado. La de SEO no puede: estimar ingresos perdidos exige
volumen de búsqueda y CTR por posición, y ninguno de los dos está en la
entrada.

El titular del informe de SEO es un **recuento**: cuántas comprobaciones
fallan de cuántas evaluadas. Es contable, es verificable y el cliente puede
repetirlo entero desde su navegador.

`validarAnalisisSeo()` rechaza —error, no aviso— un análisis cuyos hallazgos
mencionen moneda, facturación o ingresos, o que prometan posiciones o
porcentajes de tráfico.

### Los hallazgos se anclan a comprobaciones

Cada hallazgo debe citar el `id` de una comprobación cuyo estado sea `falla`
o `aviso`. Si cita una que no existe, o una que pasa, el informe no se
genera.

Es una regla más fuerte que la del motor de velocidad: allí se comprueba que
el número exista en la entrada; aquí se comprueba que **el problema** exista.

---

## 5. Falsos positivos encontrados y corregidos

El riesgo §5 del proyecto dice que un falso positivo hunde la credibilidad en
la primera frase. Probando contra tiendas reales aparecieron cuatro. Cada uno
tiene su test de regresión con el caso escrito, para que nadie los
"simplifique" más adelante.

### 5.1 `robots.txt` leído sin agrupar por User-agent

El `robots.txt` que Shopify sirve de serie termina así:

```
User-agent: Nutch
Disallow: /
```

Leyendo las líneas sueltas, el motor anunciaba **"esta tienda se bloquea
entera a sí misma"** sobre una tienda impecable. Ahora se parsea en grupos y
sólo se evalúa el de `User-agent: *`. Los comentarios se ignoran.

*Detectado contra allbirds.com.*

### 5.2 `alt=""` contado como fallo

Un `alt` vacío es la forma **correcta** de marcar una imagen decorativa.
Contarlo como carencia convertía un tema bien hecho en un hallazgo inventado:
28 de 59 imágenes "sin alt" en una tienda que las tenía bien puestas.

Ahora sólo cuenta la **ausencia del atributo**; los `alt=""` se reportan
aparte como contexto.

### 5.3 Sólo se buscaba `Product`

`ProductGroup` es el tipo que Google pide para productos con variantes, y es
el que usan los temas modernos. Buscar sólo `Product` producía **"no tienes
schema de producto"** sobre tiendas que lo tenían bien. Ahora se aceptan los
dos, y en un `ProductGroup` el precio se busca en la variante, que es donde
vive.

*Detectado contra allbirds.com.*

### 5.4 La auditoría acababa en el checkout de Shopify

El peor de los cuatro. Con `gymshark.com`, la cadena de redirecciones
terminaba en `us.checkout.gymshark.com` — el dominio de checkout de Shopify,
no el escaparate. Esa máquina sirve, con toda la razón, páginas sin título,
sin h1 y sin metadatos.

El informe salía así:

```
■ Ninguna plantilla clave está en noindex: 3 de 3 páginas con noindex
■ Todas las plantillas tienen title: 3 de 3 sin title
■ Todas las plantillas tienen meta description: 3 de 3 sin meta description
■ Schema Product completo en la ficha: sin bloque Product ni ProductGroup
lead score ....... 95 (alta)
```

Cuatro fallos catastróficos y prioridad máxima sobre una tienda impecable.

Se añadió `pareceEscaparate()`: si el host final es un dominio de checkout, o
si la página no tiene ni `<title>` ni un solo `h1`, la auditoría **falla
honestamente** en vez de emitir un informe sobre otra máquina.

```
estado: FALLIDA — la cadena de redirecciones acaba en
us.checkout.gymshark.com, que es el checkout de Shopify y no el escaparate
```

Esto respeta el invariante que ya tenía el motor: los datos que faltan hacen
fallar la auditoría, no se rellenan.

---

## 6. Verificación

### Contra tiendas reales

| Tienda | Resultado | Lectura |
|---|---|---|
| allbirds.com | 1 fallo, 3 avisos, salud 82 %, **lead score 0 (baja)** | Tienda bien llevada; la regla honesta la manda al final de la cola |
| deathwishcoffee.com | 0 fallos, 5 avisos, salud 76 %, **lead score 0 (baja)** | Igual |
| gymshark.com | **Auditoría fallida** | El guardia del escaparate hace su trabajo |

Que dos marcas grandes salgan con prioridad baja es el comportamiento
correcto: la regla de −40 puntos por "poco que vender" existe justamente para
eso, y es la misma que ya tenía el motor de velocidad.

### Tests

```
node --test test/seo.test.js   →  30 tests, 30 pasan
npm test                       →  129 tests, 129 pasan
```

Los 30 nuevos cubren el parseo, los cuatro falsos positivos, el total
invariante de 22, el score y las siete reglas duras del validador.

### Flujo completo

Probado de punta a punta: `bin/seo.js` → JSON → análisis → `bin/report.js` →
HTML de 24 KB, cero peticiones externas, sin un solo `undefined` en la
salida.

---

## 7. El mes de trabajo

El sprint de SEO son **30 días**, y su plan tiene **cuatro semanas, no tres**
como el de velocidad:

| Semana | Objetivo |
|---|---|
| 1 | Indexabilidad y rastreo: robots, sitemap, noindex, 404 |
| 2 | Duplicados: canonicals, rutas de producto, parámetros |
| 3 | Datos estructurados y metadatos de plantilla |
| 4 | **Re-rastreo, validación y entrega del antes/después** |

La cuarta no es trabajo nuevo: es la verificación después de que Google
vuelva a pasar. Un cambio de schema que nadie ha vuelto a rastrear está
desplegado, no terminado. El esquema lo exige (`plan_4_semanas`, exactamente
cuatro entradas) y el validador avisa si la semana 4 no dice cómo se
verifica.

### La garantía, y lo que no promete

| Sprint | Garantía |
|---|---|
| Velocidad | PageSpeed 85+ o devolución completa |
| SEO | **Toda comprobación fallida en verde, o devolución completa** |

Las posiciones **nunca** entran en la garantía. Los arreglos salen dentro del
mes; cuándo vuelve Google a rastrear y a reordenar no es tuyo para
prometerlo.

Por eso `que_no_promete` es un campo **obligatorio** del esquema de análisis:
la advertencia se escribe antes de cobrar, no después de reclamar. Es lo que
separa esto de las agencias a las que el cliente ya ha pagado.

---

## 8. El sitio web

**Preparado, no aplicado.** Está en `scratchpad/seo-sitio.md`, listo para
pegar.

### Por qué no se aplicó

Al ir a editar `index.html` había **dos sesiones más trabajando en este
repositorio a la vez** (`portfolio-82` y `portfolio-69`). Durante el trabajo
aparecieron solos `bin/batch.js`, un sistema de i18n EN/ES completo con
claves `data-i18n`, la sección `#report` y una suite de tests.

`assets/i18n.js` **todavía no existe**: alguien lo está escribiendo ahora
mismo. Añadir secciones con claves que ese archivo no conoce las dejaría sin
traducir en español y rotas en inglés. Es una colisión garantizada, no una
posibilidad.

### Qué contiene el documento preparado

Todo con su clave `data-i18n` y su par EN/ES:

- **Head y marca** — título, descripción, `og:`, rol de marca
- **Hero** — titular que cubre las dos vías sin perder el golpe del original
- **Segunda métrica en el gauge** — `—/22` con badge ámbar, se rellena
  corriendo `bin/seo.js` contra el propio dominio en el build
- **Sección de dos vías** — velocidad y SEO como servicios hermanos
- **Sección `#seo`** — cinco cosas que Shopify hace de serie y Google lee
  mal, más los cuatro grupos de comprobaciones. Ni una estadística: son
  propiedades de la plataforma, verificables por el lector
- **Tarjeta de plan SEO** — 30 días, garantía contra comprobaciones, con la
  advertencia de posiciones impresa en la propia tarjeta
- **Tira de paquete** — los dos sprints seguidos
- **FAQ** — tres preguntas nuevas, marcadas `Placeholder.` como el resto
- **CTA doble** — dos `mailto` con asunto distinto hasta que entre Cal.com
- **CSS** — sin ramas `prefers-color-scheme`, cifras en mono con
  `tabular-nums`, huecos con em-dash y badge ámbar

Las cuatro reglas del sistema de diseño se respetan en todo el bloque.

---

## 9. Decisiones pendientes

### El paquete: ¿60 días o un mes?

Lo dejé en **60 días, en serie** (velocidad primero, SEO después), marcado
con badge ámbar para que lo decidas.

El motivo: un solo operador haciendo los dos sprints en un mes tiene que
recortar uno de los dos, y entonces la garantía deja de ser defendible. Y la
garantía es lo único que sostiene la oferta entera.

Velocidad primero porque el SEO trae tráfico a una página que tiene que
aguantarlo.

Si lo quieres a un mes, hay que decidir qué sale del alcance y decirlo en la
tarjeta.

### Precios

Siguen en `€ —` con badge ámbar, los tres. El sprint de SEO nace igual: no se
inventa un número.

### Aplicar el sitio

Hay que coordinarlo con la sesión que está montando el i18n. O paras esa
sesión y aplico yo, o le pasas el documento.

---

## 10. Riesgo asumido

**Sobrescribí `audit-engine/bin/report.js` sin leerlo antes.** No existía
cuando empecé la sesión, pero como los archivos aparecían solos, es posible
que otra sesión lo hubiera creado entre medias. Conviene revisar que la
versión actual sea la que quieres.

---

## 11. Límites conocidos del motor

Declarados en la salida y en el prompt, no escondidos:

- **Tres plantillas, no el catálogo.** Home, una ficha de producto y una
  colección. El informe nunca dice "todos tus productos".
- **Sólo el índice del sitemap.** Los sub-sitemaps no se descargan: el de
  productos de una tienda grande pesa megas y esto tiene que correr sobre
  listas de cientos de dominios.
- **Sin Search Console.** No hay impresiones, ni posiciones, ni páginas
  realmente indexadas.
- **Sólo el grupo `User-agent: *`** de robots.txt. A propósito.
- **Sólo el HTML inicial.** Lo que pinta el JavaScript del tema no se juzga.

---

## 12. Comandos

```bash
cd audit-engine

# Auditoría SEO de una tienda
node bin/seo.js tienda.com

# Guardando el JSON
node bin/seo.js tienda.com --out auditorias-seo/

# Lote de outbound por SEO (sin API key, 8 en paralelo)
node bin/batch.js queue.csv --seo --out auditorias-seo/

# Informe: elige plantilla por el campo `tipo`, sin bandera
node bin/report.js auditorias-seo/x.seo.json analisis/x.seo.analysis.json \
  --out informes/ --loom https://loom.com/share/… --cal https://cal.com/…

# Tests
npm test
```

La etapa ③ sigue siendo manual y a propósito: pegas el JSON en Claude con
`analysis/seo-prompt.md` y `analysis/seo-schema.json`, guardas la respuesta y
se la das a `bin/report.js`. Nada llega a un prospecto sin que lo hayas
leído.
