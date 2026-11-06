/* NAVIDAD DE COLORES (marcadorpr)   node prueba-navidad.js
   Schedule, standings, auto-filled playoffs and score posting, with the
   database calls answered here (nothing reaches Supabase). */
const { chromium } = require('/opt/node-tools/node_modules/playwright-core');
const path = require('path'), fs = require('fs');
const PAGE = 'file://' + path.resolve(__dirname, 'navidad-de-colores.html');
const LIB = process.env.JSLIB || '';
let bad = 0; const si = (c, m) => { if (!c) bad++; console.log((c ? '  ok   ' : '  MAL  ') + m) };
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox'] });
  async function abrir(board, hash){
    const c = await b.newContext({ viewport:{ width:390, height:900 }, acceptDownloads:true }); const p = await c.newPage();
    const errs = [], calls = []; p.on('pageerror', e => errs.push(String(e)));
    const DB = JSON.parse(JSON.stringify(board || {}));
    await p.route('**/*', r => { const u = r.request().url();
      if (u.startsWith('file:')) return r.continue();
      if (LIB && /jspdf\.umd/.test(u)) return r.fulfill({ contentType:'text/javascript', body: fs.readFileSync(LIB + '/jspdf/dist/jspdf.umd.min.js', 'utf8') });
      if (LIB && /autotable/.test(u)) return r.fulfill({ contentType:'text/javascript', body: fs.readFileSync(LIB + '/jspdf-autotable/dist/jspdf.plugin.autotable.min.js', 'utf8') });
      const m = u.match(/\/rpc\/([a-z_]+)/);
      if (m){ const a = r.request().postDataJSON() || {}; calls.push([m[1], a]); let out = {};
        if (m[1] === 'cuadro_tablero') out = DB;
        if (m[1] === 'cuadro_entrar') out = a.p_codigo === 'NV4827' ? { ok:true } : { ok:false, reason:'code' };
        if (m[1] === 'cuadro_marcar'){ if (a.p_codigo !== 'NV4827') out = { ok:false, reason:'code' };
          else { if (a.p_a === null) delete DB[a.p_juego]; else DB[a.p_juego] = { a:a.p_a, b:a.p_b }; out = { ok:true } } }
        return r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(out) }); }
      r.abort(); });
    await p.goto(PAGE + (hash || '')); await p.waitForTimeout(400);
    return { c, p, errs, calls, DB };
  }
  const cat = (p, e) => p.locator('#ages button', { hasText:e }).click().then(() => p.waitForTimeout(100));
  const row = (p, k) => p.locator('.g[data-k="' + k + '"]');

  console.log('\n1 · Schedule, no scores yet');
  let { c, p, errs, calls } = await abrir({});
  si(await p.locator('#ages button').count() === 5, 'five age groups');
  si(/75\s*juegos/.test(await p.locator('#tally').innerText()) && /0\s*con marcador/.test(await p.locator('#tally').innerText()), 'tally: 75 games, 0 scored');
  si(calls.some(x => x[0] === 'cuadro_tablero' && x[1].p_torneo === 'navidad-colores-2026'), 'reads this tournament\'s scores');
  await cat(p, '9-10');
  si(/2\.º lugar/.test(await row(p, '9-10#14').innerText()) && /3\.º lugar/.test(await row(p, '9-10#14').innerText()), 'semifinal waits for the standings: 3.º @ 2.º');
  si(/Ganador semifinal 14\/16/.test(await row(p, '9-10#17').innerText()), 'final waits for the series winners');
  si(await p.locator('.g.tap').count() === 0, 'no scorer code: nothing can be edited');
  await p.goto(PAGE + '#dia'); await p.waitForTimeout(200);
  si(await p.locator('.g').count() === 75, 'by day: all 75 games');
  si(!errs.length, 'no page errors ' + errs.join(' ')); await c.close();

  console.log('\n2 · Regular season done → standings fill the bracket');
  // 9-10: Equipo 1 wins everything, 2 beats 3 and 4, 3 beats 4.
  const R = {}, rank = { 'Equipo 1':4, 'Equipo 2':3, 'Equipo 3':2, 'Equipo 4':1 };
  const g910 = [[1,'Equipo 1','Equipo 2'],[2,'Equipo 3','Equipo 4'],[3,'Equipo 3','Equipo 2'],[4,'Equipo 1','Equipo 4'],[5,'Equipo 2','Equipo 4'],[6,'Equipo 3','Equipo 1'],
                [7,'Equipo 3','Equipo 2'],[8,'Equipo 1','Equipo 4'],[9,'Equipo 3','Equipo 1'],[10,'Equipo 2','Equipo 4'],[11,'Equipo 1','Equipo 2'],[12,'Equipo 3','Equipo 4']];
  g910.forEach(([n, v, l]) => { R['9-10#' + n] = rank[v] > rank[l] ? { a:40, b:30 } : { a:30, b:40 } });
  ({ c, p, errs } = await abrir(R));
  await cat(p, '9-10');
  const tab = await p.locator('table.tabla tbody tr').allInnerTexts();
  si(/^1\s+Equipo 1/.test(tab[0]) && /^4\s+Equipo 4/.test(tab[3]) && /6\s+0/.test(tab[0]), 'standings: Equipo 1 first (6-0), Equipo 4 last');
  si(/Equipo 4[\s\S]*Equipo 1/.test(await row(p, '9-10#13').innerText()), 'semifinal 13: Equipo 4 @ Equipo 1 (4.º @ 1.º)');
  si(/Equipo 3[\s\S]*Equipo 2/.test(await row(p, '9-10#16').innerText()), 'semifinal 16: Equipo 3 @ Equipo 2 (3.º @ 2.º)');
  si(/Ganador semifinal/.test(await row(p, '9-10#17').innerText()), 'final still waits for the semifinals');
  await c.close();

  console.log('\n3 · Posting scores with the scorer code; the bracket moves on its own');
  ({ c, p, errs, calls } = await abrir(R));
  await cat(p, '9-10');
  await p.click('#lock'); await p.fill('#codeIn', 'xx0000'); await p.click('#codeGo'); await p.waitForTimeout(200);
  si(/incorrecto/i.test(await p.locator('#codeSay').innerText()) && await p.locator('.g.tap').count() === 0, 'wrong code: refused, nothing opens');
  await p.fill('#codeIn', 'nv-4827'); await p.click('#codeGo'); await p.waitForTimeout(300);
  si(await p.locator('#codeBox').isHidden() && /abierto/.test(await p.locator('#lock').innerText()), 'right code (any case, any dashes): scorer mode on');
  si(await row(p, '9-10#17').evaluate(e => !e.classList.contains('tap')), 'the final cannot be scored before its teams are known');
  await row(p, '9-10#17').click(); await p.waitForTimeout(100);
  si(/todavía no tiene equipos/.test(await p.locator('#toast').innerText()) && await p.locator('.ed').count() === 0, 'tapping a game without teams says why');
  const secs = await p.locator('.sec h2').allInnerTexts();
  si(/regular/i.test(secs[1]) && /postemporada/i.test(secs[2]), 'regular season comes before the playoffs (the games you can score now)');
  async function poner(k, a, bb){
    await row(p, k).click(); await p.waitForTimeout(100);
    await p.fill('#edA', String(a)); await p.fill('#edB', String(bb)); await p.click('#edOk'); await p.waitForTimeout(250);
  }
  // 1v4 series: Equipo 1 wins both. 2v3 series: 1-1, Equipo 3 more total points.
  await poner('9-10#13', 20, 50); await poner('9-10#15', 22, 44);
  await poner('9-10#14', 30, 41); await poner('9-10#16', 50, 38);
  const sent = calls.filter(x => x[0] === 'cuadro_marcar');
  si(sent.length === 4 && sent[0][1].p_juego === '9-10#13' && sent[0][1].p_a === 20 && sent[0][1].p_b === 50, 'posted as game "9-10#13": visitante 20, local 50');
  const fin = await row(p, '9-10#17').innerText();
  si(/Equipo 3[\s\S]*Equipo 1/.test(fin), 'final filled itself: Equipo 3 (won 2v3 on points, 80-79) @ Equipo 1');
  await poner('9-10#17', 45, 45);
  si(/empatado/.test(await p.locator('#toast').innerText()) && !calls.some(x => x[0] === 'cuadro_marcar' && x[1].p_juego === '9-10#17'), 'a tied playoff score is refused');
  await p.fill('#edA', '48'); await p.fill('#edB', '45'); await p.click('#edOk'); await p.waitForTimeout(250);
  si(await p.locator('.champ').count() === 1 && /Equipo 3/.test(await p.locator('.champ').innerText()), 'champion banner: Equipo 3');
  si(/🏆 Equipo 3/.test(await p.locator('#ages button', { hasText:'9-10' }).innerText()), 'the age button shows the champion');
  await row(p, '9-10#16').click(); await p.waitForTimeout(100); await p.click('#edDel'); await p.waitForTimeout(250);
  si(/Ganador semifinal 14\/16/.test(await row(p, '9-10#17').innerText()) && await p.locator('.champ').count() === 0, 'clearing a semifinal score takes the final back to waiting');
  si(!errs.length, 'no page errors ' + errs.join(' ')); await c.close();

  console.log('\n4 · 5-6 años: 1st straight to the final, 2nd v 3rd semifinal');
  const R5 = {}; const r5 = { 'Equipo 1':1, 'Equipo 2':3, 'Equipo 3':2 };
  [[1,'Equipo 1','Equipo 2'],[2,'Equipo 3','Equipo 2'],[3,'Equipo 3','Equipo 1'],[4,'Equipo 3','Equipo 2'],[5,'Equipo 1','Equipo 2'],[6,'Equipo 3','Equipo 2'],[7,'Equipo 3','Equipo 1'],[8,'Equipo 1','Equipo 2']]
    .forEach(([n, v, l]) => { R5['5-6#' + n] = r5[v] > r5[l] ? { a:20, b:10 } : { a:10, b:20 } });
  R5['5-6#9'] = { a:10, b:20 }; R5['5-6#10'] = { a:10, b:20 };
  ({ c, p } = await abrir(R5));
  const t5 = await p.locator('table.tabla tbody tr').allInnerTexts();
  si(/Equipo 2/.test(t5[0]) && /a la final/.test(t5[0]) && /semifinal/.test(t5[1]), 'Equipo 2 first → straight to the final; 2nd and 3rd → semifinal');
  si(/Equipo 3[\s\S]*Equipo 2/.test(await row(p, '5-6#11').innerText()), 'final: semifinal winner (Equipo 3, won both at home) @ 1st (Equipo 2)');
  await c.close();

  console.log('\n5 · Downloads');
  ({ c, p } = await abrir(R5));
  const [d1] = await Promise.all([p.waitForEvent('download'), p.click('#bCsv')]);
  const csv = fs.readFileSync(await d1.path(), 'utf8');
  si(d1.suggestedFilename() === 'Navidad-de-Colores-2026.csv' && csv.split('\r\n').length === 77 && /5-6 años,1,Equipo 1,Equipo 2,10 - 20/.test(csv), 'CSV: 75 games with scores');
  if (LIB){
    await p.waitForFunction(() => window.jspdf && window.jspdf.jsPDF, null, { timeout:5000 }).catch(() => {});
    const [d2] = await Promise.all([p.waitForEvent('download'), p.click('#bPdf')]);
    si(/^Navidad-de-Colores-2026-5-6-anos\.pdf$/.test(d2.suggestedFilename()) && fs.readFileSync(await d2.path()).slice(0, 5).toString() === '%PDF-', 'PDF of the age group shown');
  }
  await c.close();

  console.log('\n6 · Phone width');
  ({ c, p } = await abrir(R));
  await cat(p, '11-13');
  si(await p.evaluate(() => document.documentElement.scrollWidth) <= 390, 'no sideways scroll at 390px');
  await c.close();

  await b.close();
  console.log(bad ? '\n' + bad + ' FAILED' : '\nALL PASS'); process.exit(bad ? 1 : 0);
})();
