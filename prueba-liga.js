/* LIGAS EN EL CONSTRUCTOR   node prueba-liga.js
   Meet once or twice, a two-game series before the final, and a
   published page that fills seeds from the table and series winners
   by itself. Built on Torneo Navidad de Colores (Nov 2026). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { chromium } = require('/opt/node-tools/node_modules/playwright-core');
let bad = 0; const si = (c, m) => { if (!c) bad++; console.log((c ? '  ok   ' : '  MAL  ') + m) };

// ── 1 · the engine, run straight from constructor.html
const html = fs.readFileSync(path.join(__dirname, 'constructor.html'), 'utf8');
function fn(name){ const i = html.indexOf('function ' + name + '('); let d = 0, j = html.indexOf('{', i);
  for (; j < html.length; j++){ if (html[j] === '{') d++; if (html[j] === '}' && --d === 0) break } return html.slice(i, j + 1) }
const ctx = {}; vm.createContext(ctx);
vm.runInContext(['ordenSiembra','knockout','pools','slotTime','schedule','makeSlots'].map(fn).join('\n'), ctx);
const E = n => Array.from({ length:n }, (_, i) => 'Equipo ' + (i + 1));

console.log('\n1 · Engine');
let b = ctx.pools(E(4), 4, 4, 'NV', 1, 2, 2, '9-10 años');
const grupo = b.games.filter(g => g.round === 0), ko = b.games.filter(g => g.round > 0);
si(grupo.length === 12, '9-10 (4 teams, twice): 12 table games');
const pares = {}; grupo.forEach(g => { const k = [g.a.team, g.b.team].sort().join('|'); (pares[k] = pares[k] || []).push(g.a.team) });
si(Object.keys(pares).length === 6 && Object.values(pares).every(v => v.length === 2 && v[0] !== v[1]), 'every pair twice, home and away swapped');
const semis = ko.filter(g => /^Semifinal/.test(g.stage)), fin = ko.filter(g => g.stage === 'Final');
si(semis.length === 4 && fin.length === 1, 'two-game semifinal series (4 games) and one final');
si(semis.some(g => g.a.team === '1º · 9-10 años' && g.b.team === '4º · 9-10 años') && semis.some(g => g.a.team === '2º · 9-10 años' && g.b.team === '3º · 9-10 años'), 'seeds 1º v 4º and 2º v 3º, named with their category');
const s1 = semis.find(g => g.serie === 2 && g.a.team === '4º · 9-10 años');
si(s1 && /juego 2$/.test(s1.stage) && s1.serieDe, 'game 2 swaps home and says "juego 2"');
si(/^NV-\d+\/NV-\d+$/.test(fin[0].a.from) && /^NV-\d+\/NV-\d+$/.test(fin[0].b.from), 'the final waits for "X/Y" series winners');
b = ctx.pools(E(3), 3, 3, 'NV', 1, 2, 2, '5-6 años');
const f56 = b.games.find(g => g.stage === 'Final'), s56 = b.games.filter(g => /^Semifinal/.test(g.stage));
si(s56.length === 2 && [s56[0].a.team, s56[0].b.team].sort().join() === '2º · 5-6 años,3º · 5-6 años' && f56.a.team === '1º · 5-6 años', '5-6 (3 teams): 1º waits in the final, 2º v 3º play the series');
b = ctx.pools(E(2), 2, 2, 'NV', 1, 3, 1, '7-8 años');
si(b.games.filter(g => g.round === 0).length === 3 && b.games.filter(g => g.stage === 'Final').length === 1, '7-8 (2 teams, three times, then a final): 3 + 1');
b = ctx.knockout(E(8), 'K', 1);
si(b.games.length === 7 && !b.games.some(g => g.serie), 'plain knockout unchanged: 8 teams, 7 games');
b = ctx.pools(E(6), 3, 2, 'G', 1);
si(b.games.filter(g => g.round === 0).length === 6 && b.games.some(g => g.a.team === '1º Grupo A' || g.b.team === '1º Grupo A'), 'old call without the new options: as before');

// schedule: game 2 of a series a later day; playoffs after the table
b = ctx.pools(E(4), 4, 4, 'NV', 1, 1, 2, '9-10 años');
b.games.forEach(g => { g.cat = '9-10 años'; g.courts = ['C-1'] });
const slots = ctx.makeSlots(['2026-12-05','2026-12-06','2026-12-07'], ['C-1'], 8, 14);
const placed = ctx.schedule(b.games, slots, 1);
const t = g => new Date(g.date + 'T00:00').getTime() + parseInt(g.time) % 12 * 3.6e6 + (/PM/.test(g.time) ? 12 * 3.6e6 : 0);
const lastTable = Math.max(...placed.filter(g => !g.round).map(t));
const pl = placed.filter(g => g.round > 0);
si(pl.every(g => g.date) && pl.every(g => t(g) > lastTable), 'every playoff game is placed after the last table game');
const g2s = pl.filter(g => g.serieDe);
si(g2s.length === 2 && g2s.every(g => g.date > placed.find(x => x.no === g.serieDe).date), 'game 2 of each series lands on a later day');

// ── 2 · the published page fills seeds and series by itself
(async () => {
  console.log('\n2 · Published page');
  const juegos = ctx.pools(E(4), 4, 4, 'NV', 1, 2, 2, '9-10 años').games.map(g => ({ no:g.no, cat:'9-10 años', stage:g.stage || '',
      date:'2026-11-07', time:'10:00AM', court:'C-1', a:g.a.team || ('Ganador ' + g.a.from), b:g.b.team || ('Ganador ' + g.b.from) }));
  const fuerza = { 'Equipo 1':4, 'Equipo 2':3, 'Equipo 3':2, 'Equipo 4':1 };
  const tabla = {};
  juegos.filter(g => g.stage === 'Grupo').forEach(g => { tabla[g.no] = fuerza[g.a] > fuerza[g.b] ? { a:40, b:30 } : { a:30, b:40 } });
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox'] });
  async function abrir(scores){
    const p = await browser.newPage({ viewport:{ width:390, height:900 } }); const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    await p.route('**/*', r => { const u = r.request().url();
      if (u.startsWith('file:')) return r.continue();
      const m = u.match(/\/rpc\/([a-z0-9_]+)/);
      const out = !m ? {} : m[1] === 'torneo_publico' ? { ok:true, id:'prueba-liga', tourney:{ name:'Prueba Liga', where:'Canóvanas', courts:[{ id:'C-1', name:'Quintas' }] }, games:juegos, colour:{} }
                : m[1] === 'bw_board' ? scores : (m[1] === 'bw_teams_board' || m[1] === 'bw_request_states') ? [] : {};
      r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(out) }); });
    await p.goto('file://' + path.join(__dirname, 'torneo.html') + '?t=prueba-liga'); await p.waitForTimeout(700);
    return { p, errs };
  }
  const fila = async (p, no) => (await p.locator('.r[data-j="' + no + '"]').innerText()).replace(/\s+/g, ' ');
  const semis = juegos.filter(g => /^Semifinal/.test(g.stage)), fin = juegos.find(g => g.stage === 'Final');
  const s14 = semis.find(g => g.a === '1º · 9-10 años'), s23 = semis.find(g => g.a === '2º · 9-10 años');

  let { p, errs } = await abrir({});
  si(/1º · 9-10 años/.test(await fila(p, s14.no)), 'no scores: the semifinal still reads "1º · 9-10 años"');
  await p.close();

  const parcial = Object.assign({}, tabla); delete parcial[Object.keys(parcial)[0]];
  ({ p } = await abrir(parcial));
  si(/1º · 9-10 años/.test(await fila(p, s14.no)), 'table one score short: seeds wait');
  await p.close();

  ({ p, errs } = await abrir(tabla));
  si(/Equipo 1/.test(await fila(p, s14.no)) && /Equipo 4/.test(await fila(p, s14.no)), 'table complete: 1º v 4º becomes Equipo 1 v Equipo 4');
  si(/Equipo 2/.test(await fila(p, s23.no)) && /Equipo 3/.test(await fila(p, s23.no)), '2º v 3º becomes Equipo 2 v Equipo 3');
  si(/Ganador/.test(await fila(p, fin.no)), 'the final still waits for the series');
  await p.close();

  // Series: Equipo 1 sweeps; 2v3 goes 1-1 and Equipo 3 wins on points (79-80).
  const k = no => no.toUpperCase();
  const g14 = semis.filter(g => [g.a, g.b].includes('1º · 9-10 años')), g23 = semis.filter(g => [g.a, g.b].includes('2º · 9-10 años'));
  const sc = Object.assign({}, tabla);
  g14.forEach(g => sc[k(g.no)] = g.a === '1º · 9-10 años' ? { a:50, b:20 } : { a:20, b:50 });
  const [x1, x2] = g23;   // x1: 2º home? a=2º; x2: a=3º
  sc[k(x1.no)] = x1.a === '2º · 9-10 años' ? { a:41, b:30 } : { a:30, b:41 };   // Equipo 2 wins by 11
  sc[k(x2.no)] = x2.a === '3º · 9-10 años' ? { a:50, b:38 } : { a:38, b:50 };   // Equipo 3 wins by 12
  ({ p, errs } = await abrir(sc));
  const f = await fila(p, fin.no);
  si(/Equipo 1/.test(f) && /Equipo 3/.test(f) && !/Ganador/.test(f), 'final fills itself: Equipo 1 v Equipo 3 (1-1 series won on points, 80-79)');
  si(!errs.length, 'no page errors ' + errs.join(' '));
  await p.close();

  await browser.close();
  console.log(bad ? '\n' + bad + ' FAILED' : '\nALL PASS'); process.exit(bad ? 1 : 0);
})();
