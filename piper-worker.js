"use strict";
/* Cadence natural voice: Piper (VITS) text-to-speech running on the device.
   onnxruntime-web runs the voice model, espeak-ng (piper_phonemize) turns text into phonemes; both are WebAssembly.
   Everything fetched here is stored with the Cache API, so after the first download it works offline. */
const ORT = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/";
const PH = "https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize";
const CACHE = "cadence-voice-v1";
/* [url, approximate bytes] - sizes only feed the progress bar */
const RUNTIME = [[ORT + "ort.wasm.min.js", 143e3], [ORT + "ort-wasm-simd.wasm", 10.6e6], [PH + ".js", 121e3], [PH + ".wasm", 635e3], [PH + ".data", 18.1e6]];
const MODEL_BYTES = 63.3e6;

let rt = null;      // { phModule, phData } once the runtime scripts are in
let voice = null;   // { id, session, cfg }

async function cached(url) { return (await caches.open(CACHE)).match(url); }
async function get(url, onBytes) {
  const c = await caches.open(CACHE), hit = await c.match(url);
  if (hit) return hit.blob();
  const net = await fetch(url);
  if (!net.ok) throw new Error("HTTP " + net.status + " for " + url);
  const reader = net.body.getReader(), chunks = [];
  for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); onBytes(value.length); }
  const blob = new Blob(chunks, { type: net.headers.get("Content-Type") || "application/octet-stream" });
  try { await c.put(url, new Response(blob)); } catch (e) { /* storage full: still usable for this session */ }
  return blob;
}

async function load(id, url, rid) {
  if (voice && voice.id === id) return;
  const files = [...(rt ? [] : RUNTIME), [url + ".json", 5e3], [url, MODEL_BYTES]];
  let total = 0, loaded = 0, lastPost = 0;
  for (const f of files) if (!(await cached(f[0]))) total += f[1];
  const onBytes = n => {
    loaded += n;
    const now = Date.now();
    if (now - lastPost > 150) { lastPost = now; postMessage({ t: "progress", rid, pct: total ? Math.min(99, Math.floor(loaded / total * 100)) : 99 }); }
  };
  if (total) postMessage({ t: "progress", rid, pct: 0 });
  if (!rt) {
    const blobs = [];
    for (const f of RUNTIME) blobs.push(await get(f[0], onBytes));
    const js = b => URL.createObjectURL(new Blob([b], { type: "text/javascript" }));
    importScripts(js(blobs[0]), js(blobs[2]));
    ort.env.wasm.numThreads = 1;   // threads need cross-origin isolation, which GitHub Pages can't provide
    ort.env.wasm.wasmPaths = { "ort-wasm-simd.wasm": URL.createObjectURL(new Blob([blobs[1]], { type: "application/wasm" })) };
    rt = { phModule: await WebAssembly.compile(await blobs[3].arrayBuffer()), phData: await blobs[4].arrayBuffer() };
  }
  const cfg = JSON.parse(await (await get(url + ".json", onBytes)).text());
  const model = new Uint8Array(await (await get(url, onBytes)).arrayBuffer());
  postMessage({ t: "progress", rid, pct: 100 });
  if (voice) { try { await voice.session.release(); } catch (e) {} voice = null; }
  const session = await ort.InferenceSession.create(model, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
  voice = { id, session, cfg };
}

/* text -> phoneme ids. The phonemizer is a one-shot program, so several lines go through one instance. */
async function phonemize(texts) {
  const out = [];
  const mod = await createPiperPhonemize({
    print: line => { try { const o = JSON.parse(line); if (o.phoneme_ids) out.push(o.phoneme_ids); } catch (e) {} },
    printErr: () => {},
    instantiateWasm: (imports, done) => { WebAssembly.instantiate(rt.phModule, imports).then(inst => done(inst, rt.phModule)); return {}; },
    getPreloadedPackage: () => rt.phData.slice(0)
  });
  try { mod.callMain(["-l", voice.cfg.espeak.voice, "--input", JSON.stringify(texts.map(text => ({ text }))), "--espeak_data", "/espeak-ng-data"]); }
  catch (e) { if (!e || e.name !== "ExitStatus") throw e; }
  return out;
}

/* drop the silence the model puts around a phrase, so a cue starts the instant it is played */
function trim(x, sr) {
  const th = 0.012; let a = 0, b = x.length - 1;
  while (a < b && Math.abs(x[a]) < th) a++;
  while (b > a && Math.abs(x[b]) < th) b--;
  a = Math.max(0, a - Math.round(sr * 0.012)); b = Math.min(x.length, b + Math.round(sr * 0.06));
  const out = x.slice(a, b), f = Math.min(out.length >> 1, Math.round(sr * 0.008));
  let peak = 0; for (let i = 0; i < out.length; i++) { const v = Math.abs(out[i]); if (v > peak) peak = v; }
  const g = peak > 0.02 ? Math.min(4, 0.85 / peak) : 1;   // even out loudness between short and long lines
  for (let i = 0; i < out.length; i++) out[i] *= g;
  for (let i = 0; i < f; i++) { out[i] *= i / f; out[out.length - 1 - i] *= i / f; }
  return out;
}
async function infer(ids, ls) {
  const inf = voice.cfg.inference || {};
  const feeds = {
    input: new ort.Tensor("int64", BigInt64Array.from(ids, v => BigInt(v)), [1, ids.length]),
    input_lengths: new ort.Tensor("int64", BigInt64Array.from([BigInt(ids.length)]), [1]),
    scales: new ort.Tensor("float32", Float32Array.from([inf.noise_scale ?? 0.667, (inf.length_scale ?? 1) * ls, inf.noise_w ?? 0.8]), [3])
  };
  if ((voice.cfg.num_speakers || 1) > 1) feeds.sid = new ort.Tensor("int64", BigInt64Array.from([0n]), [1]);
  const res = await voice.session.run(feeds);
  return trim((res.output || Object.values(res)[0]).data, voice.cfg.audio.sample_rate);
}

/* ---- job queue: loads and synthesis run strictly one after another ---- */
const queue = []; let busy = false;
const clean = t => { t = String(t).trim(); return /[.!?]$/.test(t) ? t : t + "."; };
async function pump() {
  if (busy) return; busy = true;
  await new Promise(r => setTimeout(r, 0));   // let a burst of requests arrive, so they share one phonemizer run
  while (queue.length) {
    const job = queue[0];
    try {
      if (job.t === "load") { await load(job.id, job.url, job.rid); postMessage({ t: "ok", rid: job.rid }); }
      else {
        if (!voice || voice.id !== job.vid) throw new Error("stale");   // a different voice was loaded meanwhile
        if (!job.ids) {
          const batch = queue.filter(j => j.t === "synth" && j.vid === voice.id && !j.ids);
          const ids = await phonemize(batch.map(j => clean(j.text)));
          if (ids.length === batch.length) batch.forEach((j, i) => { j.ids = ids[i]; });
          else job.ids = (await phonemize([clean(job.text)]))[0];
        }
        if (!job.ids || !job.ids.length) throw new Error("nothing to say");
        const pcm = await infer(job.ids, job.ls || 1);
        postMessage({ t: "ok", rid: job.rid, pcm, sr: voice.cfg.audio.sample_rate }, [pcm.buffer]);
      }
    } catch (e) { postMessage({ t: "err", rid: job.rid, msg: String(e && e.message || e) }); }
    queue.shift();
  }
  busy = false;
}
/* urgent jobs (a workout that's about to start) go ahead of background ones (lines being made ready for later) */
function place(job) {
  if (!job.pri) return queue.push(job);
  let i = busy && queue.length ? 1 : 0;
  while (i < queue.length && queue[i].pri) i++;
  queue.splice(i, 0, job);
}
onmessage = e => {
  const m = e.data;
  if (m.t === "bump") {
    const i = queue.findIndex(j => j.rid === m.rid);
    if (i > 0 && !queue[i].pri) { const [j] = queue.splice(i, 1); j.pri = true; place(j); }
    return;
  }
  place(m); pump();
};
