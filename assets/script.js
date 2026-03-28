
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}

function b64d(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  try { return atob(s); } catch (e) { return null; }
}

function b64e(s) {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64dBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  try {
    const b = atob(s);
    const u = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return u;
  } catch (e) { return null; }
}

function ts2date(b) {
  try {
    const r = b64d(b);
    if (!r) return null;
    let n = 0;
    for (let i = 0; i < r.length; i++) n = n * 256 + r.charCodeAt(i);
    return new Date(
      (n + new Date('2011-01-01T00:00:00Z').getTime() / 1000) * 1000
    ).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  } catch (e) { return null; }
}


function jhl(j) {
  j = j.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return j.replace(
    /("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    m => {
      let c = 'jn';
      if (/^"/.test(m))        c = /:$/.test(m) ? 'jk' : 'js';
      else if (/true|false/.test(m)) c = 'jb';
      else if (/null/.test(m)) c = 'jz';
      return `<span class="${c}">${m}</span>`;
    }
  );
}


function decodePayload(raw) {
  const bytes = b64dBytes(raw);
  if (!bytes) return { ok: false, html: '<span style="color:var(--red)">failed to decode base64</span>', type: 'unknown' };

  // Plain JSON
  try {
    const plain  = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(plain);
    return { ok: true, html: jhl(JSON.stringify(parsed, null, 2)), type: 'json' };
  } catch (e) {}

  // Zlib-compressed JSON
  try {
    const decompressed = pako.inflate(bytes, { to: 'string' });
    const parsed = JSON.parse(decompressed);
    return { ok: true, html: jhl(JSON.stringify(parsed, null, 2)), type: 'zlib' };
  } catch (e) {}

  try {
    return { ok: true, html: esc(new TextDecoder().decode(bytes)), type: 'raw' };
  } catch (e) {}

  return { ok: false, html: '<span style="color:var(--red)">could not decode payload</span>', type: 'unknown' };
}

function parseCookie(raw) {
  raw = raw.trim();
  let compressed = false;
  if (raw.startsWith('.')) {
    compressed = true;
    raw = raw.slice(1);
  }
  const parts = raw.split('.');
  return { parts, compressed };
}


function sw(name) {
  const ns = ['decode', 'encode', 'verify', 'crack'];
  document.querySelectorAll('.tab').forEach((t, i) => t.classList.toggle('active', ns[i] === name));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
}


function vis(id, btn) {
  const el = document.getElementById(id);
  el.type = el.type === 'password' ? 'text' : 'password';
  btn.textContent = el.type === 'password' ? 'show' : 'hide';
}

function cp(elId, btnId) {
  navigator.clipboard.writeText(document.getElementById(elId).textContent).then(() => {
    const b = document.getElementById(btnId);
    b.textContent = 'copied';
    b.classList.add('ok');
    setTimeout(() => { b.textContent = 'copy'; b.classList.remove('ok'); }, 2000);
  });
}

function clr(inId, outId) {
  document.getElementById(inId).value = '';
  document.getElementById(outId).classList.remove('show');
}


function doDecode() {
  const raw    = document.getElementById('dec-in').value.trim();
  const outEl  = document.getElementById('dec-out');
  const partsEl = document.getElementById('dec-parts');
  if (!raw) { alert('paste a cookie first'); return; }

  const { parts, compressed } = parseCookie(raw);
  if (parts.length < 2) {
    partsEl.innerHTML = `<div class="box err">invalid format</div>`;
    outEl.classList.add('show');
    return;
  }

  let html = '';
  const decoded    = decodePayload(parts[0]);
  const typeLabel  = compressed || decoded.type === 'zlib' ? 'payload (zlib)' : 'payload';

  html += `<div class="part">
    <div class="part-h">
      <span style="color:#9cdcfe">${typeLabel}</span>
      <span class="part-raw">${esc(parts[0].slice(0, 36))}${parts[0].length > 36 ? '…' : ''}</span>
    </div>
    <div class="part-b">${decoded.html}</div>
  </div>`;

  if (parts.length >= 3) {
    const d   = ts2date(parts[1]);
    const sig = parts.slice(2).join('.');
    html += `<div class="part">
      <div class="part-h">
        <span style="color:#4ec9b0">timestamp</span>
        <span class="part-raw">${esc(parts[1])}</span>
      </div>
      <div class="part-b">${d || '<span style="color:var(--muted)">could not decode</span>'}</div>
    </div>`;
    html += `<div class="part">
      <div class="part-h">
        <span style="color:#ce9178">hmac-sha1</span>
        <span class="part-raw">${esc(sig.slice(0, 36))}${sig.length > 36 ? '…' : ''}</span>
      </div>
      <div class="part-b" style="color:var(--muted)">verify with secret key → verify tab</div>
    </div>`;
  } else {
    html += `<div class="part">
      <div class="part-h"><span style="color:#ce9178">part 2</span></div>
      <div class="part-b">${esc(parts[1])}</div>
    </div>`;
  }

  partsEl.innerHTML = html;
  outEl.classList.add('show');
}


function doEncode() {
  const ps  = document.getElementById('enc-payload').value.trim();
  const key = document.getElementById('enc-key').value;
  const fmt = document.querySelector('input[name="enc-fmt"]:checked').value;
  const outEl = document.getElementById('enc-out');
  const box   = document.getElementById('enc-box');

  if (!ps)  { alert('enter a json payload'); return; }
  if (!key) { alert('enter a secret key');   return; }

  let payload;
  try { payload = JSON.parse(ps); }
  catch (e) {
    box.textContent = 'invalid json: ' + e.message;
    box.className   = 'box err';
    outEl.classList.add('show');
    return;
  }

  try {
    const EPOCH = new Date('2011-01-01T00:00:00Z').getTime() / 1000;
    let ts = Math.floor(Date.now() / 1000) - EPOCH;
    let tb = [];
    while (ts > 0) { tb.unshift(ts & 0xff); ts >>= 8; }
    const tsb = b64e(String.fromCharCode(...tb));

    let pb;
    if (fmt === 'compressed') {
      const jsonBytes  = new TextEncoder().encode(JSON.stringify(payload));
      const compressed = pako.deflate(jsonBytes);
      let bstr = '';
      for (let i = 0; i < compressed.length; i++) bstr += String.fromCharCode(compressed[i]);
      pb = b64e(bstr);
      const sigBase = pb + '.' + tsb;
      const sig     = b64e(CryptoJS.enc.Latin1.stringify(CryptoJS.HmacSHA1(sigBase, key)));
      box.textContent = '.' + pb + '.' + tsb + '.' + sig;
    } else {
      pb = b64e(JSON.stringify(payload));
      const sigBase = pb + '.' + tsb;
      const sig     = b64e(CryptoJS.enc.Latin1.stringify(CryptoJS.HmacSHA1(sigBase, key)));
      box.textContent = pb + '.' + tsb + '.' + sig;
    }

    box.className = 'box ok';
    outEl.classList.add('show');
  } catch (e) {
    box.textContent = 'error: ' + e.message;
    box.className   = 'box err';
    outEl.classList.add('show');
  }
}

function clrEnc() {
  document.getElementById('enc-payload').value = '';
  document.getElementById('enc-key').value     = '';
  document.getElementById('enc-out').classList.remove('show');
}


function doVerify() {
  const rawInput = document.getElementById('ver-cookie').value.trim();
  const key      = document.getElementById('ver-key').value;
  const outEl    = document.getElementById('ver-out');
  const statusEl = document.getElementById('ver-status');
  const partsEl  = document.getElementById('ver-parts');

  if (!rawInput) { alert('paste a cookie'); return; }
  if (!key)      { alert('enter a secret key'); return; }

  const { parts } = parseCookie(rawInput);
  if (parts.length < 3) {
    statusEl.innerHTML = `<div class="badge err">✗ invalid format</div>`;
    partsEl.innerHTML  = '';
    outEl.classList.add('show');
    return;
  }

  try {
    const sigProvided = parts.slice(2).join('.');
    const sigBase     = parts[0] + '.' + parts[1];
    const sigComputed = b64e(CryptoJS.enc.Latin1.stringify(CryptoJS.HmacSHA1(sigBase, key)));
    const valid       = sigComputed === sigProvided;

    statusEl.innerHTML = valid
      ? `<div class="badge ok">✓ valid — key matches</div>`
      : `<div class="badge err">✗ invalid — wrong key or tampered</div>`;

    const decoded = decodePayload(parts[0]);
    partsEl.innerHTML = decoded.ok
      ? `<div class="part"><div class="part-h"><span style="color:#9cdcfe">payload</span></div><div class="part-b">${decoded.html}</div></div>`
      : '';
    outEl.classList.add('show');
  } catch (e) {
    statusEl.innerHTML = `<div class="badge err">✗ ${esc(e.message)}</div>`;
    partsEl.innerHTML  = '';
    outEl.classList.add('show');
  }
}

function clrVer() {
  document.getElementById('ver-cookie').value = '';
  document.getElementById('ver-key').value    = '';
  document.getElementById('ver-out').classList.remove('show');
}

const FALLBACK_WL = ['secret','secretkey','mysecretkey','changeme','admin','password','test','dev','flask','insecure'];
let WL = [];

fetch('https://gist.githubusercontent.com/razvanttn/885f3d5e84db23372ef9578561a82a1e/raw/4b24defb2259d313b5c48e2eccc02fc47e2bc77e/gistfile1.txt')
  .then(r => r.ok ? r.text() : Promise.reject())
  .then(t => {
    WL = cleanWl(t);
    const el = document.getElementById('bf-wl-label');
    if (el) el.textContent = `built-in wordlist (${WL.length.toLocaleString()} keys)`;
  })
  .catch(() => {
    WL = FALLBACK_WL;
    const el = document.getElementById('bf-wl-label');
    if (el) el.textContent = `built-in wordlist (${FALLBACK_WL.length} keys)`;
  });

let bfRun = false;
let bfCustom = null;

function cleanWl(raw) {
  const s = new Set();
  for (let l of raw.split(/\r?\n/)) {
    l = l.trim().replace(/^['"`]+|['"`]+$/g, '').trim();
    if (!l || l.startsWith('#') || l.startsWith('//') || l.startsWith('&') || l.startsWith('<') || l.includes('{0}') || l.includes('openssl rand')) continue;
    s.add(l);
  }
  return [...s];
}

function togWl() {
  document.getElementById('bf-upload').style.display =
    document.querySelector('input[name="bf-src"]:checked').value === 'upload' ? 'block' : 'none';
}

function loadWl(input) {
  const f = input.files[0];
  if (!f) return;
  document.getElementById('bf-file-lbl').textContent = `loading ${f.name}...`;
  const r = new FileReader();
  r.onload = e => {
    bfCustom = cleanWl(e.target.result);
    document.getElementById('bf-file-lbl').textContent = `${f.name} — ${bfCustom.length.toLocaleString()} keys`;
  };
  r.readAsText(f);
}

async function startBf() {
  const cookie = document.getElementById('bf-cookie').value.trim();
  if (!cookie) { alert('paste a cookie'); return; }

  const { parts } = parseCookie(cookie);
  if (parts.length < 3) { alert('invalid cookie — needs 3 parts'); return; }

  const src = document.querySelector('input[name="bf-src"]:checked').value;
  const wl  = src === 'upload' ? bfCustom : WL;
  if (!wl || !wl.length) { alert('wordlist empty or not loaded'); return; }

  const sigBase  = parts[0] + '.' + parts[1];
  const sigGiven = parts.slice(2).join('.');

  bfRun = true;
  document.getElementById('bf-start').style.display = 'none';
  document.getElementById('bf-stop').style.display  = '';
  document.getElementById('bf-prog').style.display  = 'block';
  document.getElementById('bf-out').classList.add('show');
  document.getElementById('bf-status').innerHTML = `<div class="badge run">running... 0 / ${wl.length.toLocaleString()}</div>`;
  document.getElementById('bf-found').innerHTML  = '';

  const total = wl.length;
  let found   = null;
  const t0    = Date.now();
  const CHUNK = 500;

  for (let i = 0; i < total; i += CHUNK) {
    if (!bfRun) break;
    for (const key of wl.slice(i, i + CHUNK)) {
      if (b64e(CryptoJS.enc.Latin1.stringify(CryptoJS.HmacSHA1(sigBase, key))) === sigGiven) {
        found = key;
        break;
      }
    }
    if (found !== null) break;

    const done  = Math.min(i + CHUNK, total);
    const speed = Math.round(done / ((Date.now() - t0) / 1000));
    document.getElementById('bf-bar').style.width       = (done / total * 100) + '%';
    document.getElementById('bf-prog-lbl').textContent  = `${done.toLocaleString()} / ${total.toLocaleString()}`;
    document.getElementById('bf-speed').textContent     = `${speed.toLocaleString()} keys/s`;
    document.getElementById('bf-status').innerHTML      = `<div class="badge run">running... ${done.toLocaleString()} / ${total.toLocaleString()}</div>`;
    await new Promise(r => setTimeout(r, 0));
  }

  bfRun = false;
  document.getElementById('bf-start').style.display = '';
  document.getElementById('bf-stop').style.display  = 'none';

  if (found !== null) {
    document.getElementById('bf-bar').style.width    = '100%';
    document.getElementById('bf-status').innerHTML   = `<div class="badge ok">✓ key found</div>`;
    const decoded = decodePayload(parts[0]);
    const ph = decoded.ok
      ? `<div class="part"><div class="part-h"><span style="color:#9cdcfe">payload</span></div><div class="part-b">${decoded.html}</div></div>`
      : '';
    document.getElementById('bf-found').innerHTML =
      `<div class="part">
        <div class="part-h">
          <span style="color:var(--green)">SECRET_KEY</span>
          <button class="cp" id="cp-bf" onclick="cpT('${esc(found)}','cp-bf')" style="margin-left:auto">copy</button>
        </div>
        <div class="part-b" style="color:var(--green)">${esc(found) || '(empty string)'}</div>
      </div>${ph}`;
  } else {
    document.getElementById('bf-status').innerHTML = `<div class="badge err">✗ not found in wordlist</div>`;
  }
}

function stopBf() { bfRun = false; }

function clrBf() {
  bfRun = false;
  document.getElementById('bf-cookie').value = '';
  document.getElementById('bf-out').classList.remove('show');
  document.getElementById('bf-prog').style.display    = 'none';
  document.getElementById('bf-bar').style.width       = '0%';
  document.getElementById('bf-start').style.display   = '';
  document.getElementById('bf-stop').style.display    = 'none';
  bfCustom = null;
  document.getElementById('bf-file-lbl').textContent  = 'no file chosen';
  document.getElementById('bf-file').value            = '';
  document.querySelector('input[name="bf-src"][value="builtin"]').checked = true;
  document.getElementById('bf-upload').style.display  = 'none';
}

function cpT(text, btnId) {
  navigator.clipboard.writeText(text).then(() => {
    const b = document.getElementById(btnId);
    if (!b) return;
    b.textContent = 'copied';
    b.classList.add('ok');
    setTimeout(() => { b.textContent = 'copy'; b.classList.remove('ok'); }, 2000);
  });
}
