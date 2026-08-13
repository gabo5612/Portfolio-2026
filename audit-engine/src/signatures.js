/* Firmas de apps de Shopify, identificadas por el dominio o el handle que
   cargan en el HTML.

   Riesgo §5: "Un falso positivo te hunde la credibilidad en la primera
   frase". Por eso cada detección guarda la URL exacta que la disparó, y el
   paso ⑤ de tu checklist es comprobarlas. Prefiere un patrón estrecho que
   falle a uno amplio que invente.

   Categorías con más de una app cargando a la vez son la mina de oro del
   informe: "tienes 4 apps de reseñas cargando a la vez". */

export const FIRMAS = [
  // ── Reseñas ───────────────────────────────────────────────────────
  { id: 'judge-me',      nombre: 'Judge.me',            categoria: 'reseñas',      patrones: ['judge.me'] },
  { id: 'loox',          nombre: 'Loox',                categoria: 'reseñas',      patrones: ['loox.io'] },
  { id: 'yotpo',         nombre: 'Yotpo Reviews',       categoria: 'reseñas',      patrones: ['yotpo.com', 'yotpo.js'] },
  { id: 'stamped',       nombre: 'Stamped.io',          categoria: 'reseñas',      patrones: ['stamped.io'] },
  { id: 'okendo',        nombre: 'Okendo',              categoria: 'reseñas',      patrones: ['okendo.io'] },
  { id: 'reviews-io',    nombre: 'Reviews.io',          categoria: 'reseñas',      patrones: ['reviews.io'] },
  { id: 'fera',          nombre: 'Fera',                categoria: 'reseñas',      patrones: ['fera.ai'] },
  { id: 'ali-reviews',   nombre: 'Ali Reviews',         categoria: 'reseñas',      patrones: ['alireviews.io'] },
  { id: 'trustpilot',    nombre: 'Trustpilot',          categoria: 'reseñas',      patrones: ['trustpilot.com'] },
  { id: 'shopify-prod-reviews', nombre: 'Shopify Product Reviews', categoria: 'reseñas', patrones: ['productreviews.shopifycdn.com'] },

  // ── Email marketing ───────────────────────────────────────────────
  { id: 'klaviyo',       nombre: 'Klaviyo',             categoria: 'email',        patrones: ['klaviyo.com'] },
  { id: 'omnisend',      nombre: 'Omnisend',            categoria: 'email',        patrones: ['omnisend.com', 'omnisnippet'] },
  { id: 'mailchimp',     nombre: 'Mailchimp',           categoria: 'email',        patrones: ['chimpstatic.com', 'list-manage.com'] },
  { id: 'drip',          nombre: 'Drip',                categoria: 'email',        patrones: ['getdrip.com'] },

  // ── SMS ───────────────────────────────────────────────────────────
  { id: 'attentive',     nombre: 'Attentive',           categoria: 'sms',          patrones: ['attentivemobile.com'] },
  { id: 'postscript',    nombre: 'Postscript',          categoria: 'sms',          patrones: ['postscript.io'] },

  // ── Popups y captación ────────────────────────────────────────────
  { id: 'privy',         nombre: 'Privy',               categoria: 'popups',       patrones: ['privy.com'] },
  { id: 'justuno',       nombre: 'Justuno',             categoria: 'popups',       patrones: ['justuno.com'] },
  { id: 'optinmonster',  nombre: 'OptinMonster',        categoria: 'popups',       patrones: ['omappapi.com', 'optinmonster.com'] },
  { id: 'wisepops',      nombre: 'Wisepops',            categoria: 'popups',       patrones: ['wisepops.com'] },
  { id: 'wheelio',       nombre: 'Wheelio',             categoria: 'popups',       patrones: ['wheelio'] },

  // ── Chat y soporte ────────────────────────────────────────────────
  { id: 'gorgias',       nombre: 'Gorgias',             categoria: 'chat',         patrones: ['gorgias.chat', 'gorgias.com'] },
  { id: 'tidio',         nombre: 'Tidio',               categoria: 'chat',         patrones: ['tidio.co'] },
  { id: 'zendesk',       nombre: 'Zendesk',             categoria: 'chat',         patrones: ['zdassets.com', 'zendesk.com'] },
  { id: 'intercom',      nombre: 'Intercom',            categoria: 'chat',         patrones: ['intercomcdn.com', 'intercom.io'] },
  { id: 'crisp',         nombre: 'Crisp',               categoria: 'chat',         patrones: ['crisp.chat'] },
  { id: 'tawk',          nombre: 'Tawk.to',             categoria: 'chat',         patrones: ['tawk.to'] },
  { id: 'reamaze',       nombre: 'Re:amaze',            categoria: 'chat',         patrones: ['reamaze.com'] },

  // ── Suscripciones y fidelidad ─────────────────────────────────────
  { id: 'recharge',      nombre: 'Recharge',            categoria: 'suscripciones', patrones: ['rechargepayments.com', 'rechargecdn.com'] },
  { id: 'bold',          nombre: 'Bold Commerce',       categoria: 'suscripciones', patrones: ['boldapps.net'] },
  { id: 'smile',         nombre: 'Smile.io',            categoria: 'fidelidad',    patrones: ['smile.io'] },
  { id: 'loyaltylion',   nombre: 'LoyaltyLion',         categoria: 'fidelidad',    patrones: ['loyaltylion.com', 'loyaltylion.net'] },
  { id: 'swell',         nombre: 'Yotpo Loyalty',       categoria: 'fidelidad',    patrones: ['swellrewards.com'] },

  // ── Page builders (suelen ser los que más pesan) ──────────────────
  { id: 'pagefly',       nombre: 'PageFly',             categoria: 'page-builder', patrones: ['pagefly.io'] },
  { id: 'gempages',      nombre: 'GemPages',            categoria: 'page-builder', patrones: ['gempages.net'] },
  { id: 'shogun',        nombre: 'Shogun',              categoria: 'page-builder', patrones: ['getshogun.com', 'shogun.dev'] },
  { id: 'zipify',        nombre: 'Zipify Pages',        categoria: 'page-builder', patrones: ['zipifypages.com', 'zipify.com'] },

  // ── Búsqueda y filtros ────────────────────────────────────────────
  { id: 'searchanise',   nombre: 'Searchanise',         categoria: 'busqueda',     patrones: ['searchanise.com'] },
  { id: 'klevu',         nombre: 'Klevu',               categoria: 'busqueda',     patrones: ['klevu.com'] },
  { id: 'boost',         nombre: 'Boost AI Search',     categoria: 'busqueda',     patrones: ['bc-sf-filter', 'boostcommerce'] },

  // ── Upsell y personalización ──────────────────────────────────────
  { id: 'rebuy',         nombre: 'Rebuy',               categoria: 'upsell',       patrones: ['rebuyengine.com'] },
  { id: 'vitals',        nombre: 'Vitals',              categoria: 'upsell',       patrones: ['vitals.co', 'appsolve.io'] },
  { id: 'nosto',         nombre: 'Nosto',               categoria: 'upsell',       patrones: ['nosto.com'] },

  // ── Analítica y mapas de calor ────────────────────────────────────
  { id: 'gtm',           nombre: 'Google Tag Manager',  categoria: 'analitica',    patrones: ['googletagmanager.com'] },
  { id: 'ga',            nombre: 'Google Analytics',    categoria: 'analitica',    patrones: ['google-analytics.com'] },
  { id: 'meta-pixel',    nombre: 'Meta Pixel',          categoria: 'analitica',    patrones: ['connect.facebook.net'] },
  { id: 'tiktok-pixel',  nombre: 'TikTok Pixel',        categoria: 'analitica',    patrones: ['analytics.tiktok.com'] },
  { id: 'pinterest',     nombre: 'Pinterest Tag',       categoria: 'analitica',    patrones: ['s.pinimg.com'] },
  { id: 'snapchat',      nombre: 'Snap Pixel',          categoria: 'analitica',    patrones: ['sc-static.net'] },
  { id: 'criteo',        nombre: 'Criteo',              categoria: 'analitica',    patrones: ['criteo.net', 'criteo.com'] },
  { id: 'hotjar',        nombre: 'Hotjar',              categoria: 'analitica',    patrones: ['hotjar.com'] },
  { id: 'clarity',       nombre: 'Microsoft Clarity',   categoria: 'analitica',    patrones: ['clarity.ms'] },
  { id: 'lucky-orange',  nombre: 'Lucky Orange',        categoria: 'analitica',    patrones: ['luckyorange.com'] },

  // ── Pago aplazado ─────────────────────────────────────────────────
  { id: 'klarna',        nombre: 'Klarna',              categoria: 'pago',         patrones: ['klarnaservices.com', 'klarna.com'] },
  { id: 'afterpay',      nombre: 'Afterpay / Clearpay', categoria: 'pago',         patrones: ['afterpay.com', 'clearpay.co.uk'] },
  { id: 'affirm',        nombre: 'Affirm',              categoria: 'pago',         patrones: ['affirm.com'] },

  // ── Otros ─────────────────────────────────────────────────────────
  { id: 'weglot',        nombre: 'Weglot',              categoria: 'traduccion',   patrones: ['weglot.com'] },
  { id: 'langify',       nombre: 'Langify',             categoria: 'traduccion',   patrones: ['langify-app.com'] },
  { id: 'route',         nombre: 'Route',               categoria: 'envios',       patrones: ['routeapp.io'] },
  { id: 'backinstock',   nombre: 'Back in Stock',       categoria: 'inventario',   patrones: ['backinstock.org'] },
  { id: 'elfsight',      nombre: 'Elfsight',            categoria: 'widgets',      patrones: ['elfsight.com'] },
  { id: 'instafeed',     nombre: 'Instafeed',           categoria: 'widgets',      patrones: ['instafeed'] },
  { id: 'tolstoy',       nombre: 'Tolstoy',             categoria: 'video',        patrones: ['gotolstoy.com'] },
];

/** Categorías donde tener más de una app es casi siempre un error caro. */
export const CATEGORIAS_EXCLUYENTES = ['reseñas', 'email', 'chat', 'popups', 'busqueda', 'page-builder'];
