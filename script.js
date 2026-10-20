/* ---------- Data ---------- */
const CLASSES = ["Entire home/apt", "Private room", "Shared room"]; // order of predict_proba (alphabetical)
const CLASS_META = {
  "Entire home/apt": { c: "#ff4d45", s: "E" },
  "Private room":    { c: "#4a8dff", s: "P" },
  "Shared room":     { c: "#2fd47c", s: "S" }
};
const BOROUGHS = {
  "Manhattan":     { c: "#f5a623", s: "M",  n: "Harlem,40.8116,-73.9465|East Harlem,40.7957,-73.9389|Upper West Side,40.7870,-73.9754|Upper East Side,40.7736,-73.9566|Midtown,40.7549,-73.9840|Hell's Kitchen,40.7638,-73.9918|Chelsea,40.7465,-74.0014|East Village,40.7265,-73.9815|West Village,40.7358,-74.0036|Greenwich Village,40.7335,-73.9990|SoHo,40.7233,-74.0030|Lower East Side,40.7150,-73.9843|Chinatown,40.7158,-73.9970|Financial District,40.7075,-74.0089|Washington Heights,40.8417,-73.9393|Inwood,40.8677,-73.9212|Murray Hill,40.7479,-73.9757|Gramercy,40.7368,-73.9845|Tribeca,40.7163,-74.0086" },
  "Brooklyn":      { c: "#e8426f", s: "B",  n: "Williamsburg,40.7081,-73.9571|Bedford-Stuyvesant,40.6872,-73.9418|Bushwick,40.6944,-73.9213|Greenpoint,40.7304,-73.9515|Crown Heights,40.6694,-73.9422|Park Slope,40.6710,-73.9814|Flatbush,40.6410,-73.9630|Clinton Hill,40.6896,-73.9681|Fort Greene,40.6892,-73.9742|Prospect-Lefferts Gardens,40.6598,-73.9550|Sunset Park,40.6454,-74.0124|Bay Ridge,40.6264,-74.0299|DUMBO,40.7033,-73.9881|Red Hook,40.6733,-74.0083|Brooklyn Heights,40.6959,-73.9955|Carroll Gardens,40.6795,-73.9991|Coney Island,40.5755,-73.9707" },
  "Queens":        { c: "#9b6bff", s: "Q",  n: "Astoria,40.7644,-73.9235|Long Island City,40.7447,-73.9485|Flushing,40.7675,-73.8331|Ridgewood,40.7043,-73.9018|Sunnyside,40.7433,-73.9196|Jamaica,40.7027,-73.7890|Woodside,40.7454,-73.9063|Forest Hills,40.7185,-73.8448|Jackson Heights,40.7557,-73.8831|Elmhurst,40.7365,-73.8774" },
  "Bronx":         { c: "#2cc3c3", s: "Bx", n: "Mott Haven,40.8089,-73.9229|Concourse,40.8265,-73.9226|Fordham,40.8610,-73.8903|Kingsbridge,40.8814,-73.9028|Riverdale,40.8900,-73.9126|Longwood,40.8164,-73.8987|Morrisania,40.8316,-73.9096|Port Morris,40.8010,-73.9108" },
  "Staten Island": { c: "#8fd14f", s: "SI", n: "St. George,40.6444,-74.0795|Tompkinsville,40.6367,-74.0791|Stapleton,40.6272,-74.0757|New Brighton,40.6403,-74.0877|Great Kills,40.5547,-74.1500|Tottenville,40.5083,-74.2442" }
};
for (const b of Object.values(BOROUGHS))
  b.hoods = b.n.split("|").map(s => { const [name, lat, lng] = s.split(","); return { name, lat: +lat, lng: +lng }; });

const SAMPLES = {
  loft: { group: "Manhattan", hood: "SoHo", price: 320, minimum_nights: 3, number_of_reviews: 41, reviews_per_month: 1.4, calculated_host_listings_count: 1, availability_365: 210 },
  room: { group: "Brooklyn", hood: "Bushwick", price: 62, minimum_nights: 2, number_of_reviews: 88, reviews_per_month: 2.6, calculated_host_listings_count: 3, availability_365: 300 },
  bunk: { group: "Queens", hood: "Jamaica", price: 28, minimum_nights: 1, number_of_reviews: 6, reviews_per_month: 0.4, calculated_host_listings_count: 5, availability_365: 355 }
};

/* ---------- Helpers ---------- */
const $ = id => document.getElementById(id);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fmtMoney = n => "$" + Number(n).toLocaleString();
const FIELDS = ["latitude", "longitude", "price", "minimum_nights", "number_of_reviews",
  "reviews_per_month", "calculated_host_listings_count", "availability_365"];

let group = "Manhattan";

/* ---------- Boroughs + neighbourhoods ---------- */
function buildBoroughs() {
  $("boroughs").innerHTML = Object.entries(BOROUGHS).map(([name, b]) => `
    <label class="borough" style="--c:${b.c}">
      <input type="radio" name="borough" value="${name}" ${name === group ? "checked" : ""}>
      <i>${b.s}</i>${name}
    </label>`).join("");
  $("boroughs").addEventListener("change", e => setGroup(e.target.value));
}
function setGroup(name, hoodName) {
  group = name;
  const hoods = BOROUGHS[name].hoods;
  $("neighbourhood").innerHTML = hoods.map(h => `<option>${h.name}</option>`).join("");
  if (hoodName) $("neighbourhood").value = hoodName;
  document.querySelector(`input[name=borough][value="${name}"]`).checked = true;
  applyHood();
}
function applyHood() {
  const h = BOROUGHS[group].hoods.find(x => x.name === $("neighbourhood").value);
  if (!h) return;
  $("latitude").value = h.lat.toFixed(4);
  $("longitude").value = h.lng.toFixed(4);
  syncMap();
}

/* ---------- Sliders ---------- */
function paintRange(r) { r.style.setProperty("--p", ((r.value - r.min) / (r.max - r.min)) * 100 + "%"); }
function syncPrice(fromRange = true) {
  const r = $("priceRange");
  if (fromRange) $("price").value = r.value;
  else r.value = Math.min(+$("price").value, +r.max);
  $("priceOut").textContent = fmtMoney($("price").value);
  paintRange(r);
}
function syncAvail() {
  const r = $("availability_365");
  $("availOut").textContent = r.value + " days";
  paintRange(r);
}

/* ---------- Map canvas ---------- */
const BOUNDS = { latMin: 40.49, latMax: 40.92, lngMin: -74.26, lngMax: -73.70 };
const canvas = $("map"), ctx = canvas.getContext("2d");
let W = 0, H = 0, dpr = 1, dots = [], t0 = performance.now();
const marker = { lat: 40.7549, lng: -73.984, tLat: 40.7549, tLng: -73.984 };
let pulse = { color: "#ffffff", start: -1, kind: "idle" };

function project(lat, lng) {
  const pad = 26;
  return [
    pad + ((lng - BOUNDS.lngMin) / (BOUNDS.lngMax - BOUNDS.lngMin)) * (W - pad * 2),
    pad + (1 - (lat - BOUNDS.latMin) / (BOUNDS.latMax - BOUNDS.latMin)) * (H - pad * 2)
  ];
}
function seedDots() {
  dots = [];
  for (const b of Object.values(BOROUGHS))
    for (const h of b.hoods)
      for (let i = 0; i < 26; i++) {
        const g = () => (Math.random() + Math.random() + Math.random() - 1.5) * 0.012;
        dots.push({ lat: h.lat + g(), lng: h.lng + g() * 1.3, c: b.c, r: Math.random() * 1.6 + .7, d: Math.random() });
      }
}
function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  const r = canvas.getBoundingClientRect();
  W = r.width; H = r.height;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function draw(now) {
  const t = (now - t0) / 1000;
  ctx.clearRect(0, 0, W, H);

  // faint grid
  ctx.strokeStyle = "rgba(255,255,255,.045)"; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 36) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 36) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // listing dots: one-time reveal on page load, then a slow shimmer
  const reveal = reduceMotion ? 1 : Math.min(t / 1.6, 1);
  for (const d of dots) {
    const a = Math.max(0, Math.min((reveal * 1.5 - d.d * .5), 1));
    const [x, y] = project(d.lat, d.lng);
    ctx.globalAlpha = a * (.28 + .12 * Math.sin(t * 1.3 + d.d * 20));
    ctx.fillStyle = d.c;
    ctx.beginPath(); ctx.arc(x, y, d.r, 0, 6.283); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // glide marker
  const k = reduceMotion ? 1 : .09;
  marker.lat += (marker.tLat - marker.lat) * k;
  marker.lng += (marker.tLng - marker.lng) * k;
  const [mx, my] = project(marker.lat, marker.lng);

  // crosshair guides
  ctx.strokeStyle = "rgba(255,255,255,.14)"; ctx.setLineDash([4, 6]);
  ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, H); ctx.moveTo(0, my); ctx.lineTo(W, my); ctx.stroke();
  ctx.setLineDash([]);

  // rings
  let ringColor = pulse.color;
  const ring = (phase, maxR, alpha) => {
    ctx.strokeStyle = ringColor; ctx.globalAlpha = (1 - phase) * alpha; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(mx, my, 8 + phase * maxR, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1;
  };
  if (pulse.kind === "loading") {
    ring(((t * 1.2) % 1), 90, .9); ring(((t * 1.2 + .5) % 1), 90, .9);
  } else if (pulse.kind === "done") {
    const p = (now - pulse.start) / 1400;
    if (p < 1) ring(p, 120, 1);
    ring(((t * .6) % 1), 40, .45);
  } else ring(((t * .5) % 1), 34, .35);

  ctx.fillStyle = ringColor;
  ctx.shadowColor = ringColor; ctx.shadowBlur = 18;
  ctx.beginPath(); ctx.arc(mx, my, 6, 0, 6.283); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mx, my, 6, 0, 6.283); ctx.stroke();

  requestAnimationFrame(draw);
}
function syncMap() {
  const lat = parseFloat($("latitude").value), lng = parseFloat($("longitude").value);
  if (isFinite(lat) && isFinite(lng)) {
    marker.tLat = Math.min(Math.max(lat, BOUNDS.latMin), BOUNDS.latMax);
    marker.tLng = Math.min(Math.max(lng, BOUNDS.lngMin), BOUNDS.lngMax);
  }
  $("mapTag").textContent = $("neighbourhood").value + ", " + group;
}

/* ---------- Result UI ---------- */
function setState(s) { $("result").dataset.state = s; }
function setAccent(c) { document.documentElement.style.setProperty("--accent", c); pulse.color = c; }

function countUp(el, to, ms = 1100) {
  if (reduceMotion) { el.textContent = Math.round(to); return; }
  const s = performance.now();
  (function step(n) {
    const p = Math.min((n - s) / ms, 1), e = 1 - Math.pow(1 - p, 4);
    el.textContent = Math.round(to * e);
    if (p < 1) requestAnimationFrame(step);
  })(s);
}
function showResult(label, probs) {
  const meta = CLASS_META[label] || { c: "#8892ab", s: "?" };
  const pct = probs.map(p => p * 100);
  const top = Math.max(...pct);

  $("verdict").textContent = label;
  $("bullet").textContent = meta.s;
  $("bars").innerHTML = CLASSES.map((c, i) => `
    <li class="${pct[i] === top ? "top" : ""}" style="--c:${CLASS_META[c].c}">
      <span>${c}</span><div class="track"><i class="fill"></i></div><b data-v="${pct[i]}">0%</b>
    </li>`).join("");

  setAccent(meta.c);
  pulse = { color: meta.c, start: performance.now(), kind: "done" };
  setState("done");

  // restart bullet animation each time
  const b = $("bullet"); b.style.animation = "none"; void b.offsetWidth; b.style.animation = "";

  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.querySelectorAll(".bars li").forEach(li => {
      const v = +li.querySelector("b").dataset.v;
      li.querySelector(".fill").style.width = v + "%";
      const out = li.querySelector("b"), t0 = performance.now();
      (function step(n) {
        const p = Math.min((n - t0) / 1100, 1), e = 1 - Math.pow(1 - p, 4);
        out.textContent = (v * e).toFixed(1) + "%";
        if (p < 1 && !reduceMotion) requestAnimationFrame(step); else out.textContent = v.toFixed(1) + "%";
      })(t0);
    });
    countUp($("confNum"), top);
  }));
}
function showFail(msg) {
  $("failMsg").textContent = msg;
  setAccent("#ff4d45");
  pulse.kind = "idle";
  setState("fail");
}

/* ---------- Validation + submit ---------- */
const RULES = {
  latitude: [-90, 90], longitude: [-180, 180], price: [0.01, Infinity], minimum_nights: [1, 365],
  number_of_reviews: [0, Infinity], reviews_per_month: [0, Infinity],
  calculated_host_listings_count: [0, Infinity], availability_365: [0, 365]
};
const INTS = ["minimum_nights", "number_of_reviews", "calculated_host_listings_count", "availability_365"];

function buildPayload() {
  const payload = {}, bad = [];
  for (const f of FIELDS) {
    const el = $(f), v = parseFloat(el.value);
    const [lo, hi] = RULES[f];
    const ok = isFinite(v) && v >= lo && v <= hi && (!INTS.includes(f) || Number.isInteger(v));
    el.classList.toggle("invalid", !ok);
    if (!ok) bad.push(f.replace(/_/g, " "));
    payload[f] = v;
  }
  payload.neighbourhood_group = group;
  payload.neighbourhood = $("neighbourhood").value;
  return { payload, bad };
}

async function submit(e) {
  e.preventDefault();
  const err = $("formError"); err.hidden = true;
  const { payload, bad } = buildPayload();
  if (bad.length) { err.textContent = "Check these fields: " + bad.join(", ") + "."; err.hidden = false; return; }

  const btn = $("submit");
  btn.classList.add("busy");
  setState("loading");
  pulse.kind = "loading"; setAccent("#8892ab");
  const started = performance.now();

  try {
    const base = $("apiUrl").value.trim().replace(/\/+$/, "");
    const res = await fetch(base + "/predict", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    });
    if (!res.ok) {
      let detail = "The server returned status " + res.status + ".";
      try {
        const j = await res.json();
        if (Array.isArray(j.detail)) detail = j.detail.map(d => d.loc.slice(1).join(".") + ": " + d.msg).join("; ");
      } catch {}
      throw new Error(detail);
    }
    const data = await res.json();
    const wait = Math.max(0, 700 - (performance.now() - started)); // let the scan animation read
    await new Promise(r => setTimeout(r, wait));
    showResult(data.Predicted_room_type, data.Probability);
    pingApi();
  } catch (ex) {
    const offline = ex instanceof TypeError;
    showFail(offline
      ? "Start the backend with “uvicorn main:app --reload” and check the URL under API connection."
      : ex.message);
    pingApi();
  } finally {
    btn.classList.remove("busy");
  }
}

/* ---------- API status ---------- */
async function pingApi() {
  const dot = $("apiDot");
  try {
    const r = await fetch($("apiUrl").value.trim().replace(/\/+$/, "") + "/");
    dot.className = "dot " + (r.ok ? "ok" : "bad");
  } catch { dot.className = "dot bad"; }
}

/* ---------- Samples ---------- */
function loadSample(key) {
  const s = SAMPLES[key];
  setGroup(s.group, s.hood);
  for (const f of ["price", "minimum_nights", "number_of_reviews", "reviews_per_month", "calculated_host_listings_count", "availability_365"])
    $(f).value = s[f];
  $("priceRange").value = Math.min(s.price, 1000);
  syncPrice(false); syncAvail();
  document.querySelectorAll(".invalid").forEach(el => el.classList.remove("invalid"));
  setState("idle"); pulse.kind = "idle"; setAccent("#8892ab");
}

/* ---------- Init ---------- */
buildBoroughs();
setGroup("Manhattan", "Midtown");
syncPrice(); syncAvail(); paintRange($("availability_365"));
seedDots(); resize();
addEventListener("resize", resize);
requestAnimationFrame(draw);

$("neighbourhood").addEventListener("change", applyHood);
["latitude", "longitude"].forEach(id => $(id).addEventListener("input", syncMap));
$("priceRange").addEventListener("input", () => syncPrice(true));
$("price").addEventListener("input", () => syncPrice(false));
$("availability_365").addEventListener("input", syncAvail);
$("form").addEventListener("submit", submit);
$("apiUrl").addEventListener("change", pingApi);
document.querySelectorAll("[data-sample]").forEach(b => b.addEventListener("click", () => loadSample(b.dataset.sample)));
FIELDS.forEach(f => $(f).addEventListener("input", () => $(f).classList.remove("invalid")));
pingApi();