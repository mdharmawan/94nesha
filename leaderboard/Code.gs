/**
 * 94nesha Putting Challenge — shared leaderboard (Google Apps Script web app).
 * Paste into the leaderboard Google Sheet via Extensions > Apps Script, then
 * Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 * Put the /exec URL into DATA.leaderboard in index.html.
 */
const MAX_NAME = 24;
const HEADER = ['Waktu', 'Nama', 'Pukulan', 'H1', 'H2', 'H3', 'Durasi (detik)'];

function sheet_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sh.getLastRow() === 0 || sh.getRange(1, 1).getValue() !== HEADER[0]) {
    if (sh.getLastRow() > 0) sh.insertRowBefore(1);
    sh.getRange(1, 1, 1, HEADER.length).setValues([HEADER]);
  }
  return sh;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// Best round per player (case-insensitive name), fewest strokes, ties to the faster round.
function top_(n) {
  const rows = sheet_().getDataRange().getValues().slice(1);
  const best = {};
  rows.forEach(r => {
    const name = String(r[1]).trim(), strokes = Number(r[2]), ms = Math.round(Number(r[6]) * 1000);
    if (!name || !strokes) return;
    const k = name.toLowerCase(), b = best[k];
    if (!b || strokes < b.strokes || (strokes === b.strokes && ms < b.ms)) best[k] = {name, strokes, ms};
  });
  return Object.keys(best).map(k => best[k])
    .sort((a, b) => a.strokes - b.strokes || a.ms - b.ms)
    .slice(0, n)
    .map(x => ({name: x.name, strokes: x.strokes}));
}

function doGet() {
  return json_({ok: true, top: top_(10)});
}

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    let name = String(d.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, MAX_NAME);
    const holes = (d.holes || []).map(Number), strokes = Number(d.strokes), ms = Number(d.ms);
    if (!name) return json_({ok: false, error: 'name'});
    if (holes.length !== 3 || holes.some(h => !Number.isInteger(h) || h < 1 || h > 9) ||
        holes.reduce((a, b) => a + b, 0) !== strokes) return json_({ok: false, error: 'score'});
    if (!(ms >= 3000 && ms < 3600000)) return json_({ok: false, error: 'time'});
    if (/^[=+\-@]/.test(name)) name = "'" + name; // stop formula injection
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const cache = CacheService.getScriptCache(), key = 'n:' + name.toLowerCase();
      if (cache.get(key)) return json_({ok: false, error: 'wait'});
      cache.put(key, '1', 20);
      sheet_().appendRow([new Date(), name, strokes, holes[0], holes[1], holes[2], Math.round(ms / 100) / 10]);
    } finally {
      lock.releaseLock();
    }
    return json_({ok: true, top: top_(10)});
  } catch (err) {
    return json_({ok: false, error: 'bad'});
  }
}
