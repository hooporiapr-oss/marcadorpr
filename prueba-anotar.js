// Digital scoresheet (anotar.html): a whole game on a phone, against a
// real local PostgreSQL as the anon role. Replays the Amarillo vs
// Violeta game so the result must come out 47–34.
const path = require('path');
const { Client } = require('pg'); const { chromium } = require('playwright');
const MPR = '/home/claude/marcadorpr';
let fails = 0; const is = (c, t) => { console.log((c ? '  ok   ' : '  BAD  ') + t); if (!c) fails++ };
const A = [['24','Jerry Ocasio'],['32','Janel Rodríguez'],['76','Jean Pegrón'],['96','Elian Carmona'],['65','Sebastián Beltrán'],['19','Josean López'],['90','Wildaber Guzmán']];
const B = [['78','Zaid Matos'],['20','Christopher Martínez'],['82','Noah Guzmán'],['79','Jordan Cueto'],['22','Giovanier Allende'],['89','Ethan González'],['33','Kaydew Burgos']];
// [team, player row, key, period]
const J = [];
const add = (t, i, ks, p) => ks.forEach((k) => J.push([t, i, k, p]));
add('a', 4, [2, 2, 2], 1); add('a', 5, [1, 2, 2], 1);             // 11
add('a', 2, [2], 2); add('a', 4, [2, 2], 2); add('a', 5, [2, 2], 2); // 10
add('a', 1, [2], 3); add('a', 2, [2, 2], 3); add('a', 4, [2, 2, 2], 3); // 12
add('a', 1, [2], 4); add('a', 2, [2, 2, 2], 4); add('a', 4, [2, 2, 2], 4); // 14
add('b', 0, [3, 2, 1, 2], 1); add('b', 2, [2], 1);                // 10
add('b', 0, [3], 2);                                             // 3
add('b', 0, [2, 2, 3], 3); add('b', 5, [2, 3], 3);               // 12
add('b', 0, [2], 4); add('b', 3, [2], 4); add('b', 5, [3], 4); add('b', 6, [2], 4); // 9
(async () => {
  const an = new Client({ host: '/tmp/pggym', user: 'postgres', database: 'hoja' }); await an.connect(); await an.query('set role anon');
  const base = { rpc: async (fn, args) => { const k = Object.keys(args || {});
    try { const r = await an.query(`select public.${fn}(${k.map((x, i) => x + ' => $' + (i + 1)).join(',')}) r`, k.map((x) => typeof args[x] === 'object' && args[x] ? JSON.stringify(args[x]) : args[x])); return { data: r.rows[0].r, error: null } }
    catch (e) { return { data: null, error: { message: e.message } } } } };
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
  await ctx.route('https://fonts.**', (rt) => rt.abort());
  await ctx.route('http://mpr.test/**', (rt) => rt.fulfill({ path: path.join(MPR, new URL(rt.request().url()).pathname) }));
  let down = false;
  await ctx.route('https://sdaphocueugzfvjovuxd.supabase.co/rest/v1/rpc/*', async (rt) => {
    if (rt.request().method() === 'OPTIONS') return rt.fulfill({ status: 204, headers: cors });
    if (down) return rt.abort();
    const x = await base.rpc(rt.request().url().split('/').pop(), JSON.parse(rt.request().postData() || '{}'));
    rt.fulfill({ status: x.error ? 400 : 200, headers: cors, body: JSON.stringify(x.error || x.data) }); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  const noScroll = () => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  const txt = (s) => p.locator(s).innerText();

  console.log('1 · Code and players');
  await p.goto('http://mpr.test/anotar.html');
  is(await p.locator('a[href="hoja.html"]').count() === 0, 'no link to the photo route yet (it is not live)');
  await p.fill('#codigo', 'nope'); await p.click('#entrar'); await p.waitForFunction(() => /no sirve/.test(document.getElementById('m1').textContent)); is(true, 'a wrong code says so');
  await p.fill('#codigo', 'CANOVANAS-7'); await p.click('#entrar'); await p.waitForSelector('#pEquipos:not([hidden])');
  is(await p.locator('.ros[data-t="a"] tbody tr').count() === 5, 'five empty player rows to start');
  await p.click('#empezar'); is(/nombre de los dos equipos/.test(await txt('#m2')), 'cannot start without team names');
  await p.fill('#lugar', 'Quintas, Canóvanas'); await p.fill('#fecha', '11/9');
  for (const [t, L, nm] of [['a', A, 'Equipo 5 Amarillo'], ['b', B, 'Equipo 1 Violeta']]) {
    const box = p.locator(`.ros[data-t="${t}"]`);
    await box.locator('.nom').fill(nm);
    await box.locator('.add').click(); await box.locator('.add').click();
    for (let i = 0; i < L.length; i++) { const r = box.locator('tbody tr').nth(i); await r.locator('.jn').fill(L[i][0]); await r.locator('.jo').fill(L[i][1]) }
  }
  is(await noScroll(), 'no sideways scroll');
  await p.click('#empezar'); await p.waitForSelector('#pJuego:not([hidden])');
  is(await p.locator('#lista .pl').count() === 7, 'game screen: 7 players with buttons');
  is(await noScroll(), 'no sideways scroll on the game screen');

  console.log('2 · The game');
  let lado = 'a', per = 1;
  for (const [t, i, k, pp] of J) {
    if (t !== lado) { await p.click(`.tabs button[data-t="${t}"]`); lado = t }
    if (pp !== per) { await p.click(`#per button[data-p="${pp}"]`); per = pp }
    await p.locator('#lista .pl').nth(i).locator(`button[data-k="${k}"]`).click();
  }
  is(await txt('#nA') === '47' && await txt('#nB') === '34', 'the scoreboard reads 47–34');
  // fouls: Jerry 2, Sebastián 1, Josean 2 (period 4); Zaid 1, Noah 2
  await p.click('.tabs button[data-t="a"]');
  for (const i of [0, 0, 4, 5, 5]) await p.locator('#lista .pl').nth(i).locator('button[data-k="f"]').click();
  await p.click('.tabs button[data-t="b"]');
  for (const i of [0, 2, 2]) await p.locator('#lista .pl').nth(i).locator('button[data-k="f"]').click();
  is(/Faltas: 5 · BONUS/.test(await txt('#fA')) && /Faltas: 3$/.test(await txt('#fB')), 'team fouls this period, with BONUS from the 4th');
  await p.locator('#lista .pl').nth(6).locator('button[data-k="3"]').click();
  is(await txt('#nB') === '37' && /Kaydew Burgos.*\+3/.test(await txt('#ultimo')), 'a mistaken +3 shows as the last play');
  await p.click('#deshacer'); is(await txt('#nB') === '34', 'undo takes it back');
  await p.click('.tabs button[data-t="a"]');
  for (let k = 0; k < 5; k++) await p.locator('#lista .pl').nth(3).locator('button[data-k="f"]').click();
  is(await p.locator('#lista .pl').nth(3).getAttribute('class').then((c) => /out/.test(c)), '5 fouls: the player shows as fouled out');
  for (let k = 0; k < 5; k++) await p.click('#deshacer');

  console.log('3 · Nothing is lost');
  await p.reload(); await p.waitForSelector('#pJuego:not([hidden])');
  is(await txt('#nA') === '47' && await txt('#nB') === '34', 'reloading the page brings the game back as it was');
  await p.click('#editar'); await p.waitForSelector('#pEquipos:not([hidden])');
  await p.locator('.ros[data-t="a"] tbody tr').nth(4).locator('.jo').fill('Sebastián Beltrán Jr.');
  await p.locator('.ros[data-t="a"] tbody tr').nth(4).locator('.del').click();
  await p.click('#empezar'); await p.waitForSelector('#pJuego:not([hidden])');
  is(await txt('#nA') === '47' && /Sebastián Beltrán/.test(await txt('#lista')), 'erasing a player who already scored does not erase his points');
  await p.click('#per button[aria-label]'); is(/OT/.test(await txt('#per')), 'the + button adds overtime');
  await p.click('#per button[data-p="4"]');
  await p.click('#lang'); is(/Fouls: 5 · BONUS/.test(await txt('#fA')) && /UNDO/.test(await txt('#deshacer')), 'English toggle');
  await p.click('#lang');

  console.log('4 · Publish');
  await p.click('#terminar'); is(/Toca otra vez/.test(await txt('#m3')), 'ending asks to tap again');
  down = true; await p.click('#terminar'); await p.waitForFunction(() => /sigue guardado/.test(document.getElementById('m3').textContent));
  is(true, 'no connection: says the game is still saved on the phone');
  down = false; await p.click('#terminar'); await p.click('#terminar'); await p.waitForSelector('#pListo:not([hidden])');
  is(/Equipo 5 Amarillo 47 – 34 Equipo 1 Violeta/.test(await txt('#final')), 'published 47–34');
  await p.click('#verBox'); await p.waitForSelector('#score:not([hidden])');
  const body = await txt('main');
  is(/11\s+10\s+12\s+14\s+47/.test(body) && /10\s+3\s+12\s+9\s+34/.test(body), 'box score periods 11-10-12-14 and 10-3-12-9');
  is(/Sebastián Beltrán Jr\.\s+22\s+1/.test(body) && /Zaid Matos\s+20\s+1/.test(body) && /Josean López\s+9\s+2/.test(body), 'player points and fouls');
  await p.goto('http://mpr.test/anotar.html'); await p.waitForSelector('#pEquipos:not([hidden])');
  is(await p.inputValue('.ros[data-t="a"] .nom') === '', 'after publishing, the phone starts a fresh game');

  console.log('5 · Saved teams');
  await p.waitForSelector('.ros[data-t="a"] select.guardado');
  const ops = await p.locator('.ros[data-t="a"] select.guardado option').allInnerTexts();
  is(ops.some((o) => /Equipo 5 Amarillo \(7\)/.test(o)) && ops.some((o) => /Equipo 1 Violeta \(7\)/.test(o)), 'the next game offers the saved teams');
  await p.selectOption('.ros[data-t="a"] select.guardado', { label: 'Equipo 5 Amarillo (7)' });
  await p.selectOption('.ros[data-t="b"] select.guardado', { label: 'Equipo 1 Violeta (7)' });
  is(await p.inputValue('.ros[data-t="a"] .nom') === 'Equipo 5 Amarillo' && await p.locator('.ros[data-t="a"] tbody tr').count() === 7, 'picking one fills the team name and its 7 players');
  is(await p.inputValue('.ros[data-t="a"] tbody tr:nth-child(1) .jn') === '24' && await p.inputValue('.ros[data-t="b"] tbody tr:nth-child(1) .jo') === 'Zaid Matos', 'with their numbers and names');
  await p.locator('.ros[data-t="b"] tbody tr').nth(1).locator('.jo').fill('Chris Martínez');
  await p.click('#empezar'); await p.waitForSelector('#pJuego:not([hidden])');
  is(await p.locator('#lista .pl').count() === 7 && await txt('#nA') === '0', 'and the game starts fresh at 0–0');
  await p.locator('#lista .pl').nth(0).locator('button[data-k="2"]').click();
  await p.click('#editar'); await p.waitForSelector('#pEquipos:not([hidden])');
  is(await p.locator('select.guardado').count() === 0, 'once a point is scored, editing players shows no picker (it cannot swap a team mid-game)');
  await p.click('#empezar');
  const otro = await base.rpc('bw_plantillas', { p_code: 'OTRO-1' });
  const malo = await base.rpc('bw_plantillas', { p_code: 'nope' });
  is(Array.isArray(otro.data) && otro.data.length === 0 && malo.error, "another organizer sees none of these teams; a wrong code gets nothing");
  is(!JSON.stringify((await base.rpc('bw_plantillas', { p_code: 'CANOVANAS-7' })).data).includes('puntos'), 'saved teams carry names and numbers only, no stats');
  console.log('6 · Live');
  await p.click('#enVivo'); await p.waitForSelector('#vivoOn:not([hidden])');
  const wa = decodeURIComponent(await p.getAttribute('#vivoWa', 'href'));
  const link = (wa.match(/http:\/\/mpr\.test\/box\.html\?h=[0-9a-f]{10}/) || [])[0];
  is(!!link && /EN VIVO: Equipo 5 Amarillo vs Equipo 1 Violeta/.test(wa), 'share live gives one WhatsApp link');
  is(/actualizado/.test(await txt('#vivoOn')), 'and says when it was last updated');
  const q = await ctx.newPage(); await q.goto(link); await q.waitForSelector('#score:not([hidden])');
  is(/EN VIVO/.test(await q.locator('#fin').innerText()) && await q.locator('#nA').innerText() === '2' && await q.locator('#nB').innerText() === '0', 'the link shows LIVE 2–0');
  await p.click('.tabs button[data-t="b"]'); await p.locator('#lista .pl').nth(0).locator('button[data-k="3"]').click();
  await p.waitForTimeout(16500);
  await q.reload(); await q.waitForSelector('#score:not([hidden])');
  is(await q.locator('#nB').innerText() === '3', 'a basket goes out by itself within 15 seconds');
  await q.waitForTimeout(21000);
  await p.locator('#lista .pl').nth(0).locator('button[data-k="1"]').click(); await p.click('#vivoYa');
  await p.waitForTimeout(1500); await q.waitForTimeout(20500);
  is(await q.locator('#nB').innerText() === '4', 'UPDATE NOW sends at once, and the open link refreshes itself');
  await p.reload(); await p.waitForSelector('#vivoOn:not([hidden])'); is(true, 'after a reload the phone is still live');
  down = true; await p.locator('#lista .pl').nth(0).locator('button[data-k="2"]').click(); await p.click('#vivoYa');
  await p.waitForFunction(() => /sin señal/.test(document.getElementById('vivoOn').textContent)); is(true, 'no signal: it says so');
  down = false; await p.waitForFunction(() => /actualizado/.test(document.getElementById('vivoOn').textContent), null, { timeout: 25000 });
  await q.reload(); await q.waitForSelector('#score:not([hidden])');
  is(await q.locator('#nB').innerText() === '6', 'and catches up by itself when the signal is back');
  await p.click('#terminar'); await p.click('#terminar'); await p.waitForSelector('#pListo:not([hidden])');
  is((await p.getAttribute('#verBox', 'href')) === link, 'the final uses the same link');
  await q.reload(); await q.waitForSelector('#score:not([hidden])');
  is(await q.locator('#fin').innerText() === 'FINAL' && await q.locator('#nB').innerText() === '6', 'which now says FINAL');
  const su = new Client({ host: '/tmp/pggym', user: 'postgres', database: 'hoja' }); await su.connect();
  const rows = (await su.query("select count(*)::int n from bw_hojas where datos->'a'->>'nombre' = 'Equipo 5 Amarillo' and datos->>'estado' is not null")).rows[0].n;
  is(rows >= 5, 'every update was kept as its own row (' + rows + '), none overwritten');
  await su.end(); await q.close();

  is(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); await an.end();
  console.log(fails ? `\n✗ ${fails} failure(s)` : '\nOK'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1) });
