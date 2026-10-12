// Servidor de medición de rendimiento (herramienta de desarrollo; no forma parte de la app).
// Sirve un build con una red 4G simulada y compartida (ancho de banda + latencia por petición), brotli como en Vercel, sin service
// worker ni caché del navegador. Las fuentes de Google y el inventario de Supabase pasan por aquí para pagar también la red simulada,
// y a cada página se le inyecta un pequeño medidor (`window.__m`: FCP, "torre visible", llamadas de dibujo, triángulos, ms por cuadro).
//
// Cómo usarlo (desde la raíz del repo; ver README → "Rendimiento"):
//   1. Construye apuntando Supabase a este servidor (la barra final importa):
//        VITE_SUPABASE_URL=http://localhost:4180/__supabase/ npx vite build --outDir dist-perf --emptyOutDir
//   2. node scripts/perf-server.cjs dist-perf 4180 9000 170        (<carpeta> <puerto> [kbps] [rttMs])
//   3. Abre http://localhost:4180/aura en el navegador y lee `window.__m.report()` / `window.__m.stats(0)`.
// Cambiar de perfil en caliente:  GET /__profile?kbps=1600&rtt=150&reset=1   (reset: la siguiente petición vuelve a pagar DNS+TLS)
// Perfiles de referencia: 4G rápido 9000 kbps / 170 ms · 4G lento (Lighthouse) 1600 kbps / 150 ms.
// Usa la llave pública de Supabase de .env.local solo para reenviar las consultas del inventario; no escribe nada.
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const [dist, portArg, kbpsArg, rttArg] = process.argv.slice(2);
const port = Number(portArg || 4180);
let kbps = Number(kbpsArg || 9000);
let rtt = Number(rttArg || 170);

// Supabase real (la misma que usa la app) — la URL y la llave no se imprimen.
let supabaseUrl = '';
try {
  const env = fs.readFileSync(path.resolve('.env.local'), 'utf8');
  supabaseUrl = (env.match(/^VITE_SUPABASE_URL=(.*)$/m) || [])[1]?.trim() || '';
} catch (e) {}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.pdf': 'application/pdf', '.ico': 'image/x-icon',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.webmanifest']);

const MEASURE = `<script>(function(){
var m=window.__m={res:[]};
try{new PerformanceObserver(function(l){l.getEntries().forEach(function(e){if(e.name==='first-contentful-paint')m.fcp=e.startTime})}).observe({type:'paint',buffered:true})}catch(e){}
try{new PerformanceObserver(function(l){var e=l.getEntries().pop();if(e)m.lcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true})}catch(e){}
function look(){
  var b=document.querySelector('[role=progressbar]');
  if(b){var v=Number(b.getAttribute('aria-valuenow'));
    if(m.loadingScreen===undefined)m.loadingScreen=performance.now();
    if(m.lastV!==v){m.lastV=v;m.marks.push([Math.round(performance.now()),v,b.getAttribute('aria-label')]);}
    if(v>=100&&m.ready===undefined){m.ready=performance.now();}
    var root=b.closest('.fixed');
    // "torre visible": la pantalla de carga empieza a desvanecerse (deja ver la escena)
    if(root&&root.classList.contains('opacity-0')&&m.visible===undefined)m.visible=performance.now();
  }
  if(m.canvas===undefined&&document.querySelector('canvas'))m.canvas=performance.now();
}
new MutationObserver(look).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-valuenow','class']});
// ── Render: cuántos cuadros, llamadas de dibujo, triángulos y cuánto cuesta cada render() en CPU ──
m.renders=[];m.renderer=null;m.fid=0;m.marks=[];(function tick(){m.fid++;requestAnimationFrame(tick)})();
var dev=new EventTarget();window.__THREE_DEVTOOLS__=dev;
dev.addEventListener('observe',function(ev){
  var r=ev.detail;if(!r||!r.info||typeof r.render!=='function'||!r.shadowMap)return;m.renderer=r;var orig=r.render.bind(r);
  r.render=function(scene,cam){
    var t=performance.now();orig(scene,cam);var dt=performance.now()-t;
    var i=r.info;
    m.renders.push({f:m.fid,t:t,ms:dt,calls:i.render.calls,tris:i.render.triangles,lines:i.render.lines,points:i.render.points});
    if(m.renders.length>4000)m.renders.shift();
  };
});
m.stats=function(sinceMs){
  var raw=m.renders.filter(function(x){return x.t>=(sinceMs||0)});
  if(!raw.length)return null;
  var fr={};raw.forEach(function(x){var g=fr[x.f]||(fr[x.f]={t:x.t,ms:0,calls:0,tris:0,n:0});g.ms+=x.ms;g.calls+=x.calls;g.tris+=x.tris;g.n++;});
  var r=Object.keys(fr).map(Number).sort(function(a,b){return a-b}).map(function(k){return fr[k]});
  function pct(a,p){a=a.slice().sort(function(x,y){return x-y});return a[Math.min(a.length-1,Math.floor(a.length*p))]}
  var ms=r.map(function(x){return x.ms}),calls=r.map(function(x){return x.calls}),tris=r.map(function(x){return x.tris});
  var span=(r[r.length-1].t-r[0].t)/1000;
  var gaps=[];for(var k=1;k<r.length;k++)gaps.push(r[k].t-r[k-1].t);
  var info=m.renderer&&m.renderer.info;
  return{frames:r.length,passesPerFrame:+(raw.length/r.length).toFixed(2),seconds:+span.toFixed(2),fps:span>0?+(r.length/span).toFixed(1):null,gapP95:gaps.length?+pct(gaps,.95).toFixed(1):null,
    cpuMsP50:+pct(ms,.5).toFixed(2),cpuMsP95:+pct(ms,.95).toFixed(2),cpuMsMax:+Math.max.apply(null,ms).toFixed(1),
    callsP50:pct(calls,.5),callsMax:Math.max.apply(null,calls),trisP50:pct(tris,.5),trisMax:Math.max.apply(null,tris),
    geometries:info&&info.memory.geometries,textures:info&&info.memory.textures,
    dpr:window.devicePixelRatio,canvas:(function(){var c=document.querySelector('canvas');return c?c.width+'x'+c.height:null})()};
};
m.report=function(){
  var r=performance.getEntriesByType('resource').map(function(e){return{n:e.name.replace(location.origin,''),t:e.initiatorType,b:e.transferSize,s:Math.round(e.startTime),e:Math.round(e.responseEnd)}});
  var nav=performance.getEntriesByType('navigation')[0];
  return{fcp:m.fcp,lcp:m.lcp,loadingScreen:m.loadingScreen,canvas:m.canvas,visible:m.visible,ready:m.ready,marks:m.marks,dcl:nav&&nav.domContentLoadedEventEnd,load:nav&&nav.loadEventEnd,res:r};
};
})();</script>`;

const cache = new Map();
function readFile(file, encoding) {
  const key = file + '|' + encoding;
  if (cache.has(key)) return cache.get(key);
  let body = fs.readFileSync(file);
  const ext = path.extname(file);
  if (path.basename(file) === 'index.html') body = Buffer.from(rewriteHtml(body.toString('utf8')));
  if (COMPRESSIBLE.has(ext)) {
    if (encoding === 'br') body = zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } });
    else if (encoding === 'gzip') body = zlib.gzipSync(body, { level: 6 });
  }
  cache.set(key, body);
  return body;
}

function rewriteHtml(html) {
  return html
    .replace(/https:\/\/fonts\.googleapis\.com/g, '/__gfonts')
    .replace(/https:\/\/fonts\.gstatic\.com/g, '/__gstatic')
    .replace('<head>', '<head>' + MEASURE);
}

// ─── Red simulada: un solo "tubo" compartido, reparto por turnos ───────────────────────
const CHUNK = 8192;
const active = [];
let pumping = false;
let sentBytes = 0;
async function pump() {
  if (pumping) return;
  pumping = true;
  let turn = 0;
  while (active.length) {
    turn = (turn + 1) % active.length;
    const s = active[turn];
    const piece = s.body.subarray(s.offset, s.offset + CHUNK);
    s.offset += piece.length;
    sentBytes += piece.length;
    const done = s.offset >= s.body.length;
    s.res.write(piece);
    if (done) {
      s.res.end();
      active.splice(turn, 1);
      turn -= 1;
    }
    await new Promise((r) => setTimeout(r, Math.max(0, (piece.length * 8) / kbps)));
  }
  pumping = false;
}
let firstRequestAt = 0;
function sendThrottled(res, status, headers, body) {
  // 1 RTT hasta el primer byte; el primer pedido de la sesión paga además DNS + TCP + TLS (~2 RTT).
  const warm = Date.now() - firstRequestAt < 0;
  const extra = firstRequestAt === 0 ? 2 * rtt : 0;
  if (firstRequestAt === 0) firstRequestAt = Date.now();
  setTimeout(() => {
    res.writeHead(status, { ...headers, 'Content-Length': body.length });
    if (!body.length) return res.end();
    active.push({ res, body, offset: 0 });
    pump();
  }, rtt + extra);
}

function proxy(res, host, targetPath, extraHeaders = {}, rewriteCss = false) {
  const key = 'proxy|' + host + targetPath;
  const reply = (status, headers, body) => sendThrottled(res, status, headers, body);
  if (cache.has(key)) {
    const c = cache.get(key);
    return reply(c.status, c.headers, c.body);
  }
  https
    .get({ host, path: targetPath, headers: { 'user-agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36', accept: '*/*', ...extraHeaders } }, (up) => {
      const chunks = [];
      up.on('data', (d) => chunks.push(d));
      up.on('end', () => {
        let body = Buffer.concat(chunks);
        if (rewriteCss) body = Buffer.from(body.toString('utf8').replace(/https:\/\/fonts\.gstatic\.com/g, '/__gstatic'));
        const headers = { 'Content-Type': up.headers['content-type'] || 'application/octet-stream', 'Cache-Control': 'no-store' };
        cache.set(key, { status: up.statusCode || 200, headers, body });
        reply(up.statusCode || 200, headers, body);
      });
    })
    .on('error', () => reply(502, {}, Buffer.alloc(0)));
}

function proxySupabase(req, res) {
  if (!supabaseUrl) return sendThrottled(res, 503, {}, Buffer.alloc(0));
  const target = new URL(supabaseUrl);
  const targetPath = req.url.replace('/__supabase', '') || '/';
  const chunks = [];
  req.on('data', (d) => chunks.push(d));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const headers = { ...req.headers, host: target.host };
    delete headers['accept-encoding'];
    delete headers.origin;
    delete headers.referer;
    const up = https.request({ host: target.host, path: targetPath, method: req.method, headers }, (u) => {
      const parts = [];
      u.on('data', (d) => parts.push(d));
      u.on('end', () => {
        const out = Buffer.concat(parts);
        sendThrottled(res, u.statusCode || 200, { 'Content-Type': u.headers['content-type'] || 'application/json', 'Cache-Control': 'no-store' }, out);
      });
    });
    up.on('error', () => sendThrottled(res, 502, {}, Buffer.alloc(0)));
    up.end(body);
  });
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/__profile') {
      if (url.searchParams.get('kbps')) kbps = Number(url.searchParams.get('kbps'));
      if (url.searchParams.get('rtt')) rtt = Number(url.searchParams.get('rtt'));
      if (url.searchParams.get('reset')) firstRequestAt = 0;
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ kbps, rtt, sentBytes }));
    }
    if (url.pathname.startsWith('/__supabase')) return proxySupabase(req, res);
    if (url.pathname.startsWith('/__gfonts')) return proxy(res, 'fonts.googleapis.com', url.pathname.replace('/__gfonts', '') + url.search, {}, true);
    if (url.pathname.startsWith('/__gstatic')) return proxy(res, 'fonts.gstatic.com', url.pathname.replace('/__gstatic', '') + url.search);
    if (url.pathname === '/sw.js') {
      res.writeHead(404);
      return res.end();
    }
    let file = path.join(dist, decodeURIComponent(url.pathname));
    if (!file.startsWith(path.resolve(dist)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
    const ext = path.extname(file);
    const accept = String(req.headers['accept-encoding'] || '');
    const encoding = COMPRESSIBLE.has(ext) ? (accept.includes('br') ? 'br' : accept.includes('gzip') ? 'gzip' : 'identity') : 'identity';
    const body = readFile(file, encoding);
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' };
    if (encoding !== 'identity') headers['Content-Encoding'] = encoding;
    sendThrottled(res, 200, headers, body);
  })
  .on('upgrade', (req, socket) => socket.destroy())
  .listen(port, () => console.log(`perf-server en http://localhost:${port} (${kbps} kbps, ${rtt} ms RTT) sirviendo ${dist}`));
