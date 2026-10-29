/* ══════════════════════════════════════════════════════════════════
   HACER torneo.html DESDE LA PLANTILLA DEL CONSTRUCTOR

     node hacer-torneo.js

   Lee el <script id="tpl"> de constructor.html —la misma plantilla
   que se baja cuando alguien le da a «bajar»— y la convierte en la
   página que lee el calendario de la base.

   POR QUÉ ESTO ES UN GENERADOR Y NO UNA PÁGINA ESCRITA A MANO.

   En el repo hay tres calendarios publicados —copa-puerto-rico,
   basketween y demonstration-basketball— y los tres salieron de esta
   misma plantilla. Hoy difieren entre ellos en 976 y 238 líneas.
   Nadie los cambió a propósito: se generaron en momentos distintos y
   cada arreglo posterior a la plantilla sólo llegó a los que se
   volvieron a generar. Son tres copias viejas de lo mismo, y ninguna
   dice que lo es.

   torneo.html sería la cuarta copia el día que alguien tocara la
   plantilla. Así que no se escribe: se genera, y se vuelve a generar
   cuando cambie el constructor. Si la plantilla cambia de forma y
   este script ya no encuentra lo que busca, falla ruidosamente en vez
   de producir una página a medias.
   ══════════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');

const AQUI  = __dirname;
const FUENTE = path.join(AQUI, 'constructor.html');
const SALIDA = path.join(AQUI, 'torneo.html');

/* Cada sustitución se comprueba. Un .replace() que no encuentra su
   texto no se queja: devuelve la cadena igual y deja una página que
   casi funciona, que es la peor clase de fallo. */
let fallos = 0;
function cambiar(txt, viejo, nuevo, nombre) {
  const n = txt.split(viejo).length - 1;
  if (n !== 1) {
    console.error(`  MAL  ${nombre}: esperaba 1 aparición, hay ${n}`);
    fallos++;
    return txt;
  }
  console.log(`  ok   ${nombre}`);
  return txt.split(viejo).join(nuevo);
}

const src = fs.readFileSync(FUENTE, 'utf8');
const ABRE = '<script id="tpl" type="text/plain">';
const i = src.indexOf(ABRE);
if (i < 0) { console.error('No encuentro la plantilla en constructor.html'); process.exit(1); }
const j = src.indexOf('</script>', i);
let t = src.slice(i + ABRE.length, j).replace(/<\\\/script>/g, '<\/script>');

console.log(`Plantilla: ${t.split('\n').length} líneas\n`);

/* ── 1 · Los datos dejan de estar horneados ─────────────────────── */
t = cambiar(t,
`var TOURNEY = __TOURNEY__;
var HOME    = __HOME__;          // el equipo que se marca, o null
var GAMES   = __GAMES__;
var CATCOLOR = __CATCOLOR__;`,
`/* EL CALENDARIO NO VIENE HORNEADO: lo trae torneo_publico() al
   cargar, desde ?t=<torneo>. Es la única diferencia de fondo entre
   esta página y la que se baja — todo lo de abajo es idéntico, y por
   eso se genera en vez de escribirse. */
var TOURNEY = null;
var HOME     = null;             // el equipo que se marca, o null
var GAMES    = [];
var CATCOLOR = {};
var TORNEO   = '';               // el id, que es también el slug`,
'los datos salen de la base');

/* ── 2 · La cabecera no puede llevar el nombre horneado ─────────── */
t = cambiar(t, '<title>__NAME__ — calendario</title>',
               '<title>Calendario — marcadorpr</title>', 'title neutral');
t = cambiar(t, '<meta name="description" content="__DESC__">',
               '<meta name="description" content="Un calendario de marcadorpr: los juegos y los marcadores según van entrando.">',
               'description neutral');
t = cambiar(t, '<meta property="og:url" content="https://marcadorpr.com/__SLUG__.html">',
               '<meta property="og:url" content="https://marcadorpr.com/torneo.html">',
               'og:url');
t = cambiar(t, '<meta property="og:title" content="__NAME__ — calendario y marcadores">',
               '<meta property="og:title" content="Calendario y marcadores — marcadorpr">',
               'og:title');
t = cambiar(t, '<meta property="og:description" content="__DESC__">',
               '<meta property="og:description" content="Los juegos y los marcadores según van entrando.">',
               'og:description');
t = cambiar(t, '<meta name="twitter:title" content="__NAME__ — calendario y marcadores">',
               '<meta name="twitter:title" content="Calendario y marcadores — marcadorpr">',
               'twitter:title');
t = cambiar(t, '<meta name="twitter:description" content="__DESC__">',
               '<meta name="twitter:description" content="Los juegos y los marcadores según van entrando.">',
               'twitter:description');

/* ── 3 · El rótulo y el enlace al dinero, vacíos hasta que carga ── */
t = cambiar(t, '<div class="mark"><span>__KICKER__</span>__NAME__</div>',
               '<div class="mark"><span id="mkKick"></span><span id="mkName"></span></div>',
               'el rótulo');
t = cambiar(t, 'href="https://cadapunto.com/?t=__SLUG__"',
               'href="https://cadapunto.com/" id="cpad"',
               'el enlace a cadapunto');

/* ── 4 · El arranque espera a que llegue el calendario ──────────── */
t = cambiar(t,
`build();
indexGames();
document.querySelector('.mark').addEventListener('dblclick', unlock);
if (code()) document.getElementById('lock').classList.add('on');
load();`,
`/* ══════════════════════════════════════════════════════════════
   EL CALENDARIO SE LEE AL CARGAR

   Lo de abajo es lo que la página bajada hacía de corrido. Aquí
   espera: sin TOURNEY ni GAMES no hay nada que pintar, y build()
   sobre un array vacío deja una página en blanco sin decir por qué.
   ══════════════════════════════════════════════════════════════ */
function arrancar(){
  build();
  indexGames();
  document.querySelector('.mark').addEventListener('dblclick', unlock);
  if (code()) document.getElementById('lock').classList.add('on');
  load();
}

function aviso(titulo, linea){
  var d = document.getElementById('cargando');
  if (!d) return;
  d.innerHTML = '<div class="cg-caja"><div class="cg-t"></div>' +
                '<div class="cg-p"></div></div>';
  d.querySelector('.cg-t').textContent = titulo;
  d.querySelector('.cg-p').textContent = linea || '';
}

(function(){
  var id = (location.search.match(/[?&]t=([^&#]+)/) || [])[1];
  id = id ? decodeURIComponent(id).trim() : '';

  if (!id){
    aviso('Falta el torneo',
          'Este enlace va con el torneo pegado: marcadorpr.com/torneo.html?t=copa-puerto-rico');
    return;
  }

  rpc('torneo_publico', { p_id: id }).then(function(r){
    if (!r || !r.ok){
      aviso('No hay ningún torneo con ese nombre',
            'Comprueba el enlace, o pídeselo otra vez a quien te lo mandó.');
      return;
    }

    TORNEO   = r.id || id;
    TOURNEY  = r.tourney || { name: '', where: '', courts: [] };
    HOME     = r.home || null;
    GAMES    = r.games || [];
    CATCOLOR = r.colour || {};

    /* El nombre se pone al cargar. Para quien lee y para Google vale;
       para la vista previa de WhatsApp no, porque ésa lee el HTML sin
       ejecutarlo. Eso se arregla sirviendo la página desde un
       servidor, y hasta entonces la vista previa sale genérica — lo
       que NO sale es un nombre equivocado. */
    var nom = TOURNEY.name || 'Calendario';
    document.title = nom + ' — calendario';
    var md = document.querySelector('meta[name="description"]');
    var ng = GAMES.length;
    var desc = (ng === 1 ? 'La partida de ' : 'Las ' + ng + ' partidas de ') + nom +
               (TOURNEY.where ? ' de ' + TOURNEY.where : '') +
               '. Los marcadores según van entrando.';
    if (md) md.setAttribute('content', desc);
    ['og:title','twitter:title'].forEach(function(p){
      var m = document.querySelector('meta[property="'+p+'"], meta[name="'+p+'"]');
      if (m) m.setAttribute('content', nom + ' — calendario y marcadores');
    });
    ['og:description','twitter:description'].forEach(function(p){
      var m = document.querySelector('meta[property="'+p+'"], meta[name="'+p+'"]');
      if (m) m.setAttribute('content', desc);
    });
    var ogu = document.querySelector('meta[property="og:url"]');
    if (ogu) ogu.setAttribute('content',
      'https://marcadorpr.com/torneo.html?t=' + encodeURIComponent(TORNEO));

    document.getElementById('mkKick').textContent = TOURNEY.where || 'Torneo';
    document.getElementById('mkName').textContent = nom;
    var cp = document.getElementById('cpad');
    if (cp) cp.href = 'https://cadapunto.com/?t=' + encodeURIComponent(TORNEO);

    var d = document.getElementById('cargando');
    if (d) d.remove();

    arrancar();
  }).catch(function(){
    aviso('No se pudo leer el calendario',
          'Vuelve a cargar la página. Si sigue igual, el tablero está caído.');
  });
})();`,
'el arranque espera al calendario');

/* ── 5 · La tapa de carga ───────────────────────────────────────── */
t = cambiar(t, '<body>',
`<body>
<!-- La tapa tapa la página hasta que llega el calendario. Sin ella
     se ve medio segundo de cabecera vacía, y si el torneo no existe
     se queda un calendario en blanco sin explicación. -->
<div id="cargando">
  <div class="cg-caja"><div class="cg-t">Cargando el calendario…</div><div class="cg-p"></div></div>
</div>
<style>
#cargando{position:fixed;inset:0;z-index:9999;background:#0b1420;color:#fff;
  display:flex;align-items:center;justify-content:center;padding:24px;
  font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif}
#cargando .cg-caja{max-width:34rem;text-align:center}
#cargando .cg-t{font-size:clamp(1.1rem,3.4vw,1.5rem);font-weight:800;line-height:1.25}
#cargando .cg-p{margin-top:.7rem;color:#9fb0c4;font-size:.95rem;line-height:1.55;
  word-break:break-word}
</style>`,
'la tapa de carga');

if (fallos){
  console.error(`\n✗ ${fallos} sustitución(es) sin hacer. No escribo torneo.html:\n` +
                '  la plantilla cambió de forma y hay que ajustar este script.');
  process.exit(1);
}

const quedan = t.match(/__[A-Z]+__/g);
if (quedan){
  console.error('\n✗ quedan huecos sin rellenar: ' + [...new Set(quedan)].join(', '));
  process.exit(1);
}

fs.writeFileSync(SALIDA, t);
console.log(`\n✓ torneo.html escrito — ${t.split('\n').length} líneas`);
