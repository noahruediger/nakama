/**
 * NAKAMA backend: connects the NAKAMA app to this Google Sheet.
 *
 * One-time setup (see README):
 *   1. Project Settings > Script properties > add PIN = your PIN phrase.
 *   2. Run `setup` once from the editor (imports your contacts, creates the
 *      Beeper sync inbox folder, installs the hourly sync trigger).
 *   3. Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone.
 *      Copy the /exec URL into NAKAMA > Settings with your PIN.
 *
 * Every request must include the PIN. Without it, nothing is returned.
 */

var TABS = {
  Contacts: ['ID', 'Name', 'Category', 'Relationship', 'Network', 'Place met', 'Tags', 'Membership', 'Gender', 'Priority', 'Cadence', 'Messaging app', 'Phone', 'Email', 'Instagram', 'Facebook', 'LinkedIn', 'Address', 'Birthday', 'Starred', 'Needs review', 'To contact', 'Parents', 'Partner', 'Last contact', 'Added', 'Beeper chats', 'Notes', 'Updated'],
  Log: ['Date', 'Contact ID', 'Contact', 'App', 'Source'],
  Photos: ['Contact ID', 'Photo'],
  'Beeper Chats': ['Chat ID', 'App', 'Name', 'Last activity', 'You last sent', 'Contact ID', 'Status'],
  Maps: ['Name', 'Settings'],
  Views: ['Name', 'Settings'],
  Lists: ['Category', 'Relationship', 'Priority', 'Cadence', 'Messaging app', 'Network', 'Gender'],
  Settings: ['Key', 'Value']
};

// App field name <-> sheet header
var FIELDS = {
  id: 'ID', name: 'Name', category: 'Category', relationship: 'Relationship', network: 'Network',
  place: 'Place met', tags: 'Tags', membership: 'Membership', gender: 'Gender', priority: 'Priority',
  cadence: 'Cadence', platform: 'Messaging app', phone: 'Phone', email: 'Email', instagram: 'Instagram',
  facebook: 'Facebook', linkedin: 'LinkedIn', address: 'Address', birthday: 'Birthday', starred: 'Starred',
  needsReview: 'Needs review', toContact: 'To contact', parents: 'Parents', partner: 'Partner',
  lastContact: 'Last contact', added: 'Added', beeper: 'Beeper chats', notes: 'Notes', updated: 'Updated'
};
var LIST_FIELDS = { place: 1, tags: 1, membership: 1, parents: 1 };
var BOOL_FIELDS = { starred: 1, needsReview: 1, toContact: 1 };
var SYNC_FOLDER = 'NAKAMA Sync Inbox';

/* ---------------- web endpoints ---------------- */

function doGet(e) { return handle_((e && e.parameter) || {}); }

function doPost(e) {
  var body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { body = {}; }
  var p = (e && e.parameter) || {};
  for (var k in p) if (body[k] === undefined) body[k] = p[k];
  return handle_(body);
}

function handle_(p) {
  var pin = PropertiesService.getScriptProperties().getProperty('PIN');
  if (!pin) return out_({ ok: false, error: 'No PIN is set yet. In Apps Script, open Project Settings > Script properties and add PIN.' });
  if (String(p.pin || '') !== pin) return out_({ ok: false, error: 'Wrong PIN.' });
  var lock = LockService.getScriptLock();
  try {
    if (p.action !== 'all' && p.action !== 'ping') lock.waitLock(20000);
    return out_(run_(p));
  } catch (err) {
    return out_({ ok: false, error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function run_(p) {
  switch (p.action) {
    case 'ping': return { ok: true, app: 'NAKAMA' };
    case 'all': return getAll_();
    case 'batch': return { ok: true, results: (p.ops || []).map(function (op) { return run_(op); }) };
    case 'saveContact': return saveContact_(p.contact);
    case 'deleteContact': return deleteContact_(p.id);
    case 'log': return addLog_(p.id, p.date, p.app, p.source || 'NAKAMA');
    case 'savePhoto': return savePhoto_(p.id, p.photo);
    case 'linkChat': return linkChat_(p.chatId, p.contactId);
    case 'unlinkChat': return unlinkChat_(p.chatId);
    case 'ignoreChat': return setChatStatus_(p.chatId, 'Ignored', '');
    case 'saveNamed': return saveNamed_(p.tab, p.name, p.settings);
    case 'deleteNamed': return deleteNamed_(p.tab, p.name);
    case 'setSetting': return { ok: true, value: setSetting_(p.key, p.value) };
    default: return { ok: false, error: 'Unknown action: ' + p.action };
  }
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------------- sheet helpers ---------------- */

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function sheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) {
    sh = ss_().insertSheet(name);
    sh.getRange(1, 1, 1, TABS[name].length).setValues([TABS[name]]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function headerMap_(sh) {
  var h = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0];
  var m = {};
  h.forEach(function (name, i) { if (name) m[String(name)] = i; });
  return m;
}

function rows_(name) {
  var sh = sheet_(name);
  var last = sh.getLastRow();
  if (last < 2) return { sh: sh, map: headerMap_(sh), values: [] };
  return { sh: sh, map: headerMap_(sh), values: sh.getRange(2, 1, last - 1, sh.getLastColumn()).getDisplayValues() };
}

function findRow_(name, col, value) {
  var r = rows_(name);
  var c = r.map[col];
  for (var i = 0; i < r.values.length; i++) if (String(r.values[i][c]) === String(value)) return { sh: r.sh, map: r.map, row: i + 2, values: r.values[i] };
  return { sh: r.sh, map: r.map, row: -1, values: null };
}

function today_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }

/* ---------------- read everything ---------------- */

function rowToContact_(map, row) {
  var c = {};
  for (var f in FIELDS) {
    var i = map[FIELDS[f]];
    var v = i === undefined ? '' : String(row[i] || '');
    if (LIST_FIELDS[f]) c[f] = v ? v.split(',').map(function (s) { return s.trim(); }).filter(String) : [];
    else if (BOOL_FIELDS[f]) c[f] = /^(yes|true|1)$/i.test(v);
    else if (f === 'beeper') {
      c.beeper = {};
      v.split(',').forEach(function (pair) { var m = pair.split(':'); if (m.length === 2 && m[0].trim()) c.beeper[m[0].trim()] = m[1].trim(); });
    } else c[f] = v;
  }
  return c;
}

function getAll_() {
  var C = rows_('Contacts');
  var contacts = C.values.filter(function (r) { return r[C.map['ID']]; }).map(function (r) { return rowToContact_(C.map, r); });
  var L = rows_('Log');
  var log = L.values.map(function (r) { return { d: r[L.map['Date']], id: r[L.map['Contact ID']], p: r[L.map['App']], s: r[L.map['Source']] }; });
  var P = rows_('Photos'), photos = {};
  P.values.forEach(function (r) { if (r[0]) photos[r[0]] = r[1]; });
  var B = rows_('Beeper Chats');
  var chats = B.values.map(function (r) {
    return { id: r[B.map['Chat ID']], platform: r[B.map['App']], name: r[B.map['Name']], lastActivity: r[B.map['Last activity']], lastSent: r[B.map['You last sent']], contactId: r[B.map['Contact ID']], status: r[B.map['Status']] };
  });
  function named(tab) {
    return rows_(tab).values.filter(function (r) { return r[0]; }).map(function (r) { try { var o = JSON.parse(r[1]); o.name = r[0]; return o; } catch (e) { return null; } }).filter(Boolean);
  }
  var LS = rows_('Lists'), lists = {};
  Object.keys(LS.map).forEach(function (h) { lists[h] = LS.values.map(function (r) { return r[LS.map[h]]; }).filter(String); });
  var settings = {};
  rows_('Settings').values.forEach(function (r) { if (r[0]) settings[r[0]] = r[1]; });
  return { ok: true, contacts: contacts, log: log, photos: photos, chats: chats, maps: named('Maps'), views: named('Views'), lists: lists, settings: settings };
}

/* ---------------- writes ---------------- */

function contactToRow_(map, c, existing) {
  var row = existing ? existing.slice() : new Array(Object.keys(map).length).fill('');
  for (var f in FIELDS) {
    if (c[f] === undefined) continue;
    var i = map[FIELDS[f]];
    if (i === undefined) continue;
    var v = c[f];
    if (LIST_FIELDS[f]) v = (v || []).join(', ');
    else if (BOOL_FIELDS[f]) v = v ? 'Yes' : '';
    else if (f === 'beeper') v = Object.keys(v || {}).map(function (k) { return k + ':' + v[k]; }).join(', ');
    row[i] = v == null ? '' : String(v);
  }
  row[map['Updated']] = today_();
  return row;
}

function saveContact_(c) {
  if (!c) return { ok: false, error: 'No contact sent.' };
  var sh = sheet_('Contacts'), map = headerMap_(sh);
  if (!c.id) c.id = 'n' + new Date().getTime().toString(36);
  var found = findRow_('Contacts', 'ID', c.id);
  var row = contactToRow_(map, c, found.values);
  if (found.row > 0) sh.getRange(found.row, 1, 1, row.length).setNumberFormat('@').setValues([row]);
  else {
    if (!c.added) row[map['Added']] = today_();
    sh.getRange(sh.getLastRow() + 1, 1, 1, row.length).setNumberFormat('@').setValues([row]);
  }
  return { ok: true, id: c.id };
}

function deleteContact_(id) {
  var f = findRow_('Contacts', 'ID', id);
  if (f.row > 0) f.sh.deleteRow(f.row);
  var p = findRow_('Photos', 'Contact ID', id);
  if (p.row > 0) p.sh.deleteRow(p.row);
  return { ok: true };
}

function addLog_(id, date, app, source) {
  var c = findRow_('Contacts', 'ID', id);
  if (c.row < 0) return { ok: false, error: 'Contact not found.' };
  date = String(date || today_()).slice(0, 10);
  sheet_('Log').appendRow([date, id, c.values[c.map['Name']], app || '', source || '']);
  var cur = c.values[c.map['Last contact']];
  if (!cur || date > cur) c.sh.getRange(c.row, c.map['Last contact'] + 1).setNumberFormat('@').setValue(date);
  return { ok: true };
}

function savePhoto_(id, photo) {
  var f = findRow_('Photos', 'Contact ID', id);
  if (!photo) { if (f.row > 0) f.sh.deleteRow(f.row); return { ok: true }; }
  if (String(photo).length > 49000) return { ok: false, error: 'That photo is too large. Crop it smaller and try again.' };
  if (f.row > 0) f.sh.getRange(f.row, 2).setValue(photo);
  else f.sh.appendRow([id, photo]);
  return { ok: true };
}

function setChatStatus_(chatId, status, contactId) {
  var f = findRow_('Beeper Chats', 'Chat ID', chatId);
  if (f.row < 0) return { ok: false, error: 'Chat not found.' };
  f.sh.getRange(f.row, f.map['Status'] + 1).setValue(status);
  f.sh.getRange(f.row, f.map['Contact ID'] + 1).setValue(contactId || '');
  return { ok: true, chat: f };
}

function linkChat_(chatId, contactId) {
  var r = setChatStatus_(chatId, 'Linked', contactId);
  if (!r.ok) return r;
  var ch = r.chat, app = ch.values[ch.map['App']], sent = ch.values[ch.map['You last sent']];
  var c = findRow_('Contacts', 'ID', contactId);
  if (c.row < 0) return { ok: false, error: 'Contact not found.' };
  var cur = rowToContact_(c.map, c.values);
  var key = app; if (cur.beeper[key] && String(cur.beeper[key]) !== String(chatId)) key = app + ' 2';
  cur.beeper[key] = String(chatId);
  if (!cur.platform) cur.platform = app;
  saveContact_({ id: contactId, beeper: cur.beeper, platform: cur.platform });
  if (sent) addLog_(contactId, sent, app, 'Beeper');
  return { ok: true };
}

function unlinkChat_(chatId) {
  var f = findRow_('Beeper Chats', 'Chat ID', chatId);
  if (f.row > 0) {
    var cid = f.values[f.map['Contact ID']];
    setChatStatus_(chatId, 'Unmatched', '');
    if (cid) {
      var c = findRow_('Contacts', 'ID', cid);
      if (c.row > 0) {
        var cur = rowToContact_(c.map, c.values);
        Object.keys(cur.beeper).forEach(function (k) { if (String(cur.beeper[k]) === String(chatId)) delete cur.beeper[k]; });
        saveContact_({ id: cid, beeper: cur.beeper });
      }
    }
  }
  return { ok: true };
}

function saveNamed_(tab, name, settings) {
  if (tab !== 'Maps' && tab !== 'Views') return { ok: false, error: 'Unknown tab.' };
  var f = findRow_(tab, 'Name', name), json = JSON.stringify(settings || {});
  if (f.row > 0) f.sh.getRange(f.row, 2).setValue(json); else f.sh.appendRow([name, json]);
  return { ok: true };
}

function deleteNamed_(tab, name) {
  var f = findRow_(tab, 'Name', name);
  if (f.row > 0) f.sh.deleteRow(f.row);
  return { ok: true };
}

function setSetting_(key, value) {
  var f = findRow_('Settings', 'Key', key);
  if (f.row > 0) f.sh.getRange(f.row, 2).setValue(value); else f.sh.appendRow([key, value]);
  return value;
}

/* ---------------- one-time setup + import ---------------- */

function setup() {
  var ss = ss_();
  // 1. Import data uploaded by Claude (nakama-import-part-*.json in Drive), if present
  var parts = [], it = DriveApp.searchFiles("title contains 'nakama-import-part-' and trashed = false");
  while (it.hasNext()) parts.push(it.next());
  if (parts.length) {
    parts.sort(function (a, b) { return a.getName() < b.getName() ? -1 : 1; });
    var data = {};
    parts.forEach(function (f) {
      var part = JSON.parse(f.getBlob().getDataAsString('UTF-8'));
      for (var tab in part) data[tab] = (data[tab] || []).concat(data[tab] ? part[tab].slice(1) : part[tab]);
    });
    Object.keys(TABS).forEach(function (tab) {
      if (!data[tab]) return;
      var sh = ss.getSheetByName(tab) || ss.insertSheet(tab);
      sh.clear();
      var rows = data[tab], width = rows[0].length;
      rows = rows.map(function (r) { r = r.slice(0, width); while (r.length < width) r.push(''); return r.map(function (v) { return v == null ? '' : String(v); }); });
      sh.getRange(1, 1, rows.length, width).setNumberFormat('@').setValues(rows);
      sh.getRange(1, 1, 1, width).setFontWeight('bold');
      sh.setFrozenRows(1);
    });
    parts.forEach(function (f) { f.setTrashed(true); });
  }
  Object.keys(TABS).forEach(function (t) { sheet_(t); });
  var first = ss.getSheetByName('Sheet1');
  if (first && ss.getSheets().length > 1 && first.getLastRow() === 0) ss.deleteSheet(first);
  // 2. Beeper sync inbox folder
  var folders = DriveApp.getFoldersByName(SYNC_FOLDER);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(SYNC_FOLDER);
  PropertiesService.getScriptProperties().setProperty('SYNC_FOLDER_ID', folder.getId());
  writeSyncState_(folder);
  // 3. Hourly trigger to process the inbox
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'processInbox') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('processInbox').timeBased().everyHours(1).create();
  Logger.log('NAKAMA setup done. ' + (parts.length ? 'Imported ' + parts.length + ' file(s). ' : '') + 'Sync folder: ' + folder.getUrl());
}

/* ---------------- nightly Beeper sync ---------------- */
/*
 * Claude's nightly task drops a file like nakama-sync-2026-10-15.json into the
 * "NAKAMA Sync Inbox" Drive folder:
 *   { "syncedAt": "...", "chats": [ { "id": 475, "platform": "Messenger", "name": "Gray Hendricks",
 *       "lastActivity": "2026-10-14", "lastSent": "2026-10-14" }, ... ] }
 * This function (run hourly by the trigger) applies it: known chats update the linked contact's
 * Last contact and Log; new chats are added as Unmatched for the Beeper matcher.
 */
function processInbox() {
  var id = PropertiesService.getScriptProperties().getProperty('SYNC_FOLDER_ID');
  if (!id) return;
  var folder = DriveApp.getFolderById(id), files = folder.getFiles(), done = 0, last = null;
  while (files.hasNext()) {
    var f = files.next();
    if (!/^nakama-sync-.*\.json$/.test(f.getName())) continue;
    var data;
    try { data = JSON.parse(f.getBlob().getDataAsString('UTF-8')); } catch (e) { f.setName('FAILED-' + f.getName()); continue; }
    applySync_(data);
    if (!last || data.syncedAt > last) last = data.syncedAt;
    f.setTrashed(true); done++;
  }
  if (done) { setSetting_('Last Beeper sync', last || new Date().toISOString()); writeSyncState_(folder); }
}

function applySync_(data) {
  var B = rows_('Beeper Chats'), byId = {};
  B.values.forEach(function (r, i) { byId[String(r[B.map['Chat ID']])] = i + 2; });
  (data.chats || []).forEach(function (ch) {
    var row = byId[String(ch.id)];
    if (!row) {
      B.sh.appendRow([String(ch.id), ch.platform || '', ch.name || '', ch.lastActivity || '', ch.lastSent || '', '', 'Unmatched']);
      byId[String(ch.id)] = B.sh.getLastRow();
      return;
    }
    var vals = B.sh.getRange(row, 1, 1, B.sh.getLastColumn()).getDisplayValues()[0];
    if (ch.lastActivity) B.sh.getRange(row, B.map['Last activity'] + 1).setNumberFormat('@').setValue(ch.lastActivity);
    if (ch.name) B.sh.getRange(row, B.map['Name'] + 1).setValue(ch.name);
    var prevSent = vals[B.map['You last sent']];
    if (ch.lastSent && (!prevSent || ch.lastSent > prevSent)) {
      B.sh.getRange(row, B.map['You last sent'] + 1).setNumberFormat('@').setValue(ch.lastSent);
      var cid = vals[B.map['Contact ID']];
      if (cid && vals[B.map['Status']] === 'Linked') addLog_(cid, ch.lastSent, ch.platform || vals[B.map['App']], 'Beeper');
    }
  });
}

function writeSyncState_(folder) {
  var name = 'nakama-sync-state.json';
  var state = JSON.stringify({ lastSync: getSetting_('Last Beeper sync') || '', writtenAt: new Date().toISOString() });
  var ex = folder.getFilesByName(name);
  if (ex.hasNext()) ex.next().setContent(state); else folder.createFile(name, state, 'application/json');
}

function getSetting_(key) { var f = findRow_('Settings', 'Key', key); return f.row > 0 ? f.values[1] : ''; }
