const VERSION = [0, 1, 1];

/* DOM manipulation shortcuts */
const _i = (id) => document.getElementById(String(id));
const _t = (t) => document.getElementsByTagName(String(t));
const _c = (e) => document.createElement(String(e));
const _a = (p, e) => (p ? p.appendChild(e) : undefined);
const _r = (e) => (e ? e.parentNode.removeChild(e) : undefined);

const NBSP = "\u00A0";

/* math functions */
const clamp = (n, min, max) => Math.max(min, Math.min(n, max));
const lerp = (n, min, max) => min + n * (max - min);
const normalize = (n, min, max) => (n - min) / (max - min);
const lcg = () => {
  const LCG_MUL = 8121; // multiplier
  const LCG_INC = 28411; // increment
  const LCG_MOD = 134456; // modulus (2 ** 3 * 7 ** 5)
  seed = (LCG_MUL * seed + LCG_INC) % LCG_MOD;
  return seed / LCG_MOD;
};

path = "starfield";
root = document.location.origin + "/" + path + "/";
const url = new URL(document.location.href).searchParams;
step = Number(url.get("step")) || 0;
space = 256;
distance = Number(url.get("distance")) || 232;
depth = 0;
stars = [];
vars = [
  ["_nb", "number", 0, 4096, 8, 1024],
  ["_s", "size", 0.01, 1, 0.01, 0.5],
  ["_w", "space", 8, space * 2, 1, space],
  ["_fp", "far_p", 8, space * 2, 1, space],
  ["_np", "near_p", 1, space * 2, 1, 8],
  ["_f", "focale", 1, 1024, 1, space],
  ["_cl", "color 1", 0.01, 6, 0.01, 3],
  ["_m", "motion", -64, 64, 1, 8],
  ["_o", "opacity", 0.01, 1, 0.01, 0.5],
  ["_g", "gradient", 1, 16, 0.1, 12],
  ["_h", "halo", 0.01, 0.5, 0.01, 0.1],
  ["_dof", "dof", 0.01, 1, 0.01, 0.15],
  ["_cs", "color 2", 0, 1, 0.01, 0.75],
  ["_k", "spike", 2, 16, 0.1, 6],
  ["_t1", "tunnel 1", 0, 128, 1, 36],
  ["_t2", "tunnel 2", 0, 64, 1, 12],
];
steps = [
  ["intro", null, [6, 11, 19], [3]],
  ["points", [0, 1, 2], [3, 4, 15], [20]],
  ["depth", [3, 4], [6, 17], [1]],
  ["focale", [5], [5, 8]],
  ["color #1", [6], [7, 8], [16]],
  ["sorting", null, [4, 15, 16, 17, 18, 19, 20, 21, 22]],
  [
    "motion",
    [7, 8],
    [4, 13, 14, 15, 16, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28],
  ],
  ["gradient", [9, 10], [11, 12, 13, 14, 15, 16, 17, 18, 19]],
  ["dof", [11], [10, 11, 12, 13]],
  ["blending", null, [1, 27, 28, 29, 30, 31, 32]],
  ["color #2", [12], [9, 10, 23, 24, 30, 31, 32, 33, 45]],
  [
    "spikes",
    [13],
    [
      23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
      41, 42, 43, 44, 45, 46, 47, 48, 49,
    ],
  ],
  [
    "tunnel",
    [14, 15],
    [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26],
  ],
];
ox = 0;
oy = 0;
oz = 1e12;
vx = Number(url.get("x"));
vy = Number(url.get("y"));
px = 0;
py = 0;
mx = 0;
my = 0;
pause = Boolean(url.get("pause"));
overlay = Boolean(url.get("overlay"));
debug = Boolean(url.get("debug"));
drag = false;
drago = false;
wheel = false;
star_n = 0;
time = performance.now();
delta = performance.now();
rti = 0;
rtc = 128;
rth = 56;
rtmax = 120;
rt = new Float32Array(rtc);

const font = new FontFace("hud", "url(fonts/hud.woff2)");
font.load().then(function (font) {
  document.fonts.add(font);
});

const generate_favicon = () => {
  const dpr = window.devicePixelRatio;
  const canvas = _c("canvas");
  const w = 32 * dpr;
  const h = 32 * dpr;
  const r = 6 * dpr;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { alpha: false });
  squircle(ctx, 0, 0, w, h, r);
  ctx.clip();
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.lineWidth = 4 * dpr;
  ctx.strokeStyle = "#777";
  ctx.stroke();
  for (let y = 4 * dpr; y < h - 4 * dpr; y += dpr) {
    const x = 4 * dpr + Math.round(Math.random() * (w - 8 * dpr));
    const c = Math.round(Math.random() * 255.999).toString(16);
    ctx.fillStyle = "#" + c + c + c;
    ctx.fillRect(x - dpr, y - dpr, 2 * dpr, 2 * dpr);
  }
  const icon = _c("link");
  icon.rel = "icon";
  icon.type = "image/png";
  icon.href = canvas.toDataURL();
  _a(document.head, icon);
};

const generate_logo = () => {
  const dpr = window.devicePixelRatio;
  const size = _i("logo").offsetWidth;
  const canvas = _c("canvas");
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + "px";
  canvas.style.height = size + "px";
  ctx = canvas.getContext("2d", { alpha: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.lineCap = "round";
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  //ctx.fillStyle = '#0f0';
  //ctx.fillRect(0, 0, size, size);
  /* border */
  squircle(ctx, 1, 1, size - 2, size - 2, 10);
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#777";
  ctx.stroke();
  /* star */
  squircle(ctx, 4, 4, size - 8, size - 8, 8);
  ctx.clip();
  ctx.fillStyle = "#fff";
  spike(ctx, size * 0.4, size * 0.6, size * 0.6, size * 0.03);
  ctx.fill();
  spike(ctx, size * 0.7, size * 0.3, size * 0.4, 0);
  ctx.fill();
  _i("logo").src = canvas.toDataURL();
};

const squircle = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.arc(x + r, y + r, r, CIRCLE / 2, (CIRCLE / 4) * 3);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, (CIRCLE / 4) * 3, CIRCLE);
  ctx.lineTo(x + w, y + h - r);
  ctx.arc(x + w - r, y + h - r, r, 0, CIRCLE / 4);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + h - r, r, CIRCLE / 4, CIRCLE / 2);
  ctx.closePath();
};

const spike = (ctx, x, y, r, t) => {
  const sw = r * 0.4;
  const sr = sw - t;
  ctx.beginPath();
  ctx.arc(x - sw, y - sw, sr, CIRCLE / 4, 0, true);
  ctx.lineTo(x - t, y - r);
  ctx.lineTo(x + t, y - r);
  ctx.arc(x + sw, y - sw, sr, CIRCLE / 2, CIRCLE / 4, true);
  ctx.lineTo(x + r, y - t);
  ctx.lineTo(x + r, y + t);
  ctx.arc(x + sw, y + sw, sr, -CIRCLE / 4, CIRCLE / 2, true);
  ctx.lineTo(x + t, y + r);
  ctx.lineTo(x - t, y + r);
  ctx.arc(x - sw, y + sw, sr, 0, -CIRCLE / 4, true);
  ctx.lineTo(x - r, y + t);
  ctx.lineTo(x - r, y - t);
  ctx.closePath();
};

const generate_cute_star = (size) => {
  const dpr = window.devicePixelRatio;
  const canvas = _c("canvas");
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + "px";
  canvas.style.height = size + "px";
  ctx = canvas.getContext("2d", { alpha: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.lineCap = "round";
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  /* background */
  //ctx.strokeStyle = '#0f0';
  //ctx.strokeRect(0, 0, size, size);
  /* star */
  ctx.translate(size / 2, size / 2);
  ctx.rotate(-CIRCLE / 100);
  const n = 5;
  const r1 = size * 0.5;
  const r2 = size * 0.34;
  let a = -CIRCLE / 4 - CIRCLE / n / 2;
  let b = CIRCLE / n / 7;
  ctx.beginPath();
  ctx.lineTo(r2 * Math.cos(a), r2 * Math.sin(a));
  for (let i = 0; i < n; i++) {
    a += CIRCLE / n / 2;
    const x1 = r1 * Math.cos(a);
    const y1 = r1 * Math.sin(a);
    const c1x = r1 * Math.cos(a - b);
    const c1y = r1 * Math.sin(a - b);
    const c2x = r1 * Math.cos(a + b);
    const c2y = r1 * Math.sin(a + b);
    a += CIRCLE / n / 2;
    const x2 = r2 * Math.cos(a);
    const y2 = r2 * Math.sin(a);
    ctx.quadraticCurveTo(c1x, c1y, x1, y1);
    ctx.quadraticCurveTo(c2x, c2y, x2, y2);
  }
  ctx.closePath();
  ctx.fillStyle = "#ec0";
  ctx.fill();
  /* eyes */
  let x = size * 0.14;
  let y = size * 0.05;
  const eye = size * 0.07;
  const lash = size * 0.05;
  const el = eye * 0.3;
  ctx.beginPath();
  ctx.arc(-x, -y, eye, 0, CIRCLE);
  ctx.moveTo(x + eye, y);
  ctx.arc(x, -y, eye, 0, CIRCLE);
  ctx.fillStyle = "#539";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(
    -x - lash,
    -y - lash * 1.4,
    lash,
    CIRCLE / 4,
    CIRCLE / 4 + CIRCLE / 10
  );
  ctx.moveTo(x + lash, -y);
  ctx.arc(
    x + lash,
    -y - lash * 1.4,
    lash,
    CIRCLE / 4,
    CIRCLE / 4 - CIRCLE / 10,
    true
  );
  ctx.lineWidth = size * 0.04;
  ctx.strokeStyle = "#539";
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-x + el, -y - el, eye / 3, 0, CIRCLE);
  ctx.moveTo(x + eye, y);
  ctx.arc(x + el, -y - el, eye / 3, 0, CIRCLE);
  ctx.fillStyle = "#97d";
  ctx.fill();
  /* mouth */
  ctx.beginPath();
  ctx.arc(0, size * 0.08, size * 0.06, 0, CIRCLE / 2);
  ctx.lineWidth = size * 0.04;
  ctx.strokeStyle = "#846";
  ctx.stroke();
  /* blush */
  x = size * 0.2;
  y = size * 0.1;
  const blush1 = size * 0.11;
  const blush2 = size * 0.08;
  ctx.beginPath();
  ctx.ellipse(-x, y, blush1, blush2, 0, 0, CIRCLE);
  ctx.moveTo(x + blush1, y);
  ctx.ellipse(x, y, blush1, blush2, 0, 0, CIRCLE);
  ctx.fillStyle = "#e8b";
  ctx.fill();
  return canvas;
};

const generate_overlay = () => {
  ocvs = _c("canvas");
  ocvs.width = w * dpr;
  ocvs.height = h * dpr;
  octx = ocvs.getContext("2d", { alpha: false });
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = "high";
  octx.lineCap = "round";
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.scale(dpr, dpr);
  /* background */
  octx.fillStyle = `rgb(0,0,0)`;
  octx.fillRect(0, 0, w, h);
  /* scanline */
  const dot = 1;
  octx.setLineDash([0, dot * 3]);
  //octx.lineWidth = dot * 1.2;
  //overlay_rgb(dot, 64, 0.4);
  octx.lineWidth = dot;
  overlay_rgb(dot, 96, 1);
};

const overlay_rgb = (dot, c, alpha) => {
  /* R */
  octx.strokeStyle = `rgba(255.999,${c},${c},${alpha})`;
  y = dot / 2;
  for (let i = 0; i < h; i++) {
    octx.beginPath();
    octx.moveTo(0, y);
    octx.lineTo(w, y);
    octx.lineDashOffset = i % 2 === 0 ? 0 : dot * 1.5;
    octx.stroke();
    y += dot;
  }
  /* G */
  octx.strokeStyle = `rgba(${c},255.999,${c},${alpha})`;
  y = dot / 2;
  for (let i = 0; i < h; i++) {
    octx.beginPath();
    octx.moveTo(0, y);
    octx.lineTo(w, y);
    octx.lineDashOffset = dot + (i % 2 === 0 ? 0 : dot * 1.5);
    octx.stroke();
    y += dot;
  }
  /* B */
  octx.strokeStyle = `rgba(${c},${c},255.999,${alpha})`;
  y = dot / 2;
  for (let i = 0; i < h; i++) {
    octx.beginPath();
    octx.moveTo(0, y);
    octx.lineTo(w, y);
    octx.lineDashOffset = dot * 2 + (i % 2 === 0 ? 0 : dot * 1.5);
    octx.stroke();
    y += dot;
  }
};

function mousedown(e) {
  window.mx = e.pageX - sf.offsetLeft - sf.width / 2;
  window.my = e.pageY - sf.offsetTop - sf.height / 2;
  if (!window.shift) {
    window.drag = true;
  } else {
    window.drago = true;
  }
  sf.style.cursor = "grab";
  start();
}

function mouseup() {
  window.mx = 0;
  window.my = 0;
  if (window.drag) {
    for (let i = 0; i < window.stars.length; i++) {
      window.stars[i][0] += window.px;
      window.stars[i][1] += window.py;
    }
    window.vx += window.px;
    window.vy += window.py;
    window.drag = false;
  } else if (window.drago) {
    window.ox += window.px;
    window.oy += window.py;
    window.drago = false;
  }
  window.px = 0;
  window.py = 0;
  _i("starfield").style.cursor = "crosshair";
  set_url();
  for (let i = 0; i < 4; i++) {
    start();
  }
}

function mousemove(e) {
  x = e.pageX - window.mx - sf.offsetLeft - sf.width / 2;
  y = e.pageY - window.my - sf.offsetTop - sf.height / 2;
  if (window.drag || window.drago) {
    window.px = x;
    window.py = y;
  }
}

function mousewheel(e) {
  e.preventDefault();
  clearTimeout(window.timeout);
  if (!window.wheel) {
    window.wheel = true;
    start();
  }
  window.distance -= (e.deltaY / 2 ** 12) * window._f;
  window.distance = window.distance % (window.depth * 2);
  window.timeout = setTimeout(() => {
    window.wheel = false;
    set_url();
  }, 250);
}

const init = () => {
  generate_favicon();
  generate_logo();
  cute_star = generate_cute_star(128);
  _i("cute_star").src = cute_star.toDataURL();
  _i("version").textContent = `v${VERSION.join(".")}`;
  /* init canvas */
  dpr = window.devicePixelRatio;
  sf = _i("starfield");
  ctx = sf.getContext("2d", { alpha: false });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.lineCap = "round";
  /* steps */
  vars.forEach((v) => {
    window[v[0]] = Number(url.get(v[0].slice(1)) || v[5]);
    //window[v[0]] = v[5];
  });
  steps.forEach((v, i) => {
    const btn = _c("input");
    btn.type = "button";
    btn.id = `step${i}_btn`;
    btn.className = "step";
    btn.value = `step${i}: ${v[0]}`;
    _a(_i("steps"), btn);
    btn.addEventListener("click", () => {
      run(i);
    });
  });
  /* events */
  _i("motion").addEventListener("change", () => {
    set_pause(!pause);
  });
  _i("overlay").addEventListener("change", () => {
    set_overlay(!overlay);
  });
  _i("debug").addEventListener("change", () => {
    set_debug(!debug);
  });
  addEventListener("resize", resize);
  addEventListener("keydown", keydown);
  addEventListener("keyup", keyup);
  addEventListener("drop", () => false);
  addEventListener("mousemove", mousemove);
  sf.addEventListener("mousedown", mousedown);
  addEventListener("mouseup", mouseup);
  sf.addEventListener("mousewheel", mousewheel);
  /* start */
  step12_init();
  resize();
  set_pause(pause);
  set_overlay(overlay);
  set_debug(debug);
  run(step);
  _i("root").style.visibility = "visible";
};

const reset = () => {
  let range = document.getElementsByTagName("input");
  vars.forEach((v, i) => {
    window[v[0]] = v[5];
    for (let i = 0; i < range.length; i++) {
      if (range[i].variable === v[0]) {
        range[i].value = v[5];
        const value = _i(`value${range[i].n}`);
        if (value) {
          value.textContent = range[i].value;
        }
        range_color(range[i]);
        break;
      }
    }
  });
};

const resize = () => {
  const style = getComputedStyle(document.body);
  const padding = parseInt(style.getPropertyValue("--padding"));
  const margin = parseInt(style.getPropertyValue("--margin"));
  const border = parseInt(style.getPropertyValue("--border"));
  const var_h = parseInt(style.getPropertyValue("--slider-height"));
  const var_m = parseInt(style.getPropertyValue("--slider-margin"));
  w = sf.offsetWidth;
  h = sf.offsetHeight;
  ox = w / 2 + Number(url.get("ox"));
  oy = h / 2 - Number(url.get("oy"));
  sf.width = w * dpr;
  sf.height = h * dpr;
  sf.style.width = w + "px";
  sf.style.height = h + "px";
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ctx.translate(ox, oy);
  generate_overlay();
  single_frame();
};

const run = (id) => {
  stop();
  for (let i = 0; i <= vars.length; i++) {
    _r(_i("slider" + i));
    _r(_i("list" + i));
  }
  let btn = _i(`step${step}_btn`);
  if (btn) {
    btn.disabled = false;
  }
  step = parseInt(id || 0);
  btn = _i(`step${step}_btn`);
  if (!btn) {
    return;
  }
  btn.disabled = true;
  const variables = _i("variables");
  let n = 0;
  for (let i = 0; i <= step; i++) {
    const v = steps[i][1];
    if (!v) continue;
    for (let j = 0; j < v.length; j++) {
      const [name, text, min, max, step] = vars[v[j]];
      const slider = _c("form");
      slider.id = "slider" + n;
      slider.className = "slider";
      _a(variables, slider);
      const label = _c("label");
      label.id = "label" + n;
      label.setAttribute("for", "range" + n);
      label.textContent = text;
      label.style.float = "left";
      _a(slider, label);
      const range = _c("input");
      range.type = "range";
      range.id = "range" + n;
      range.n = n;
      range.variable = name;
      range.min = min;
      range.max = max;
      range.step = step;
      range.addEventListener("input", update);
      _a(slider, range);
      range.value = window[range.variable];
      range_color(range);
      const value = _c("output");
      value.id = "value" + n;
      value.textContent = range.value;
      value.className = "var var" + n;
      _a(slider, value);
      n++;
    }
  }
  ctx.globalCompositeOperation = "source-over";
  set_url();
  update();
  single_frame();
};

const set_url = (e) => {
  const title =
    "starfield" + (step > 0 ? ` > step${step}: ${steps[step][0]}` : "");
  document.title = title;
  let params = [
    step > 0 ? "step=" + step : null,
    _nb !== vars[0][5] ? "nb=" + _nb : null,
    vx !== 0 ? "x=" + vx : null,
    vy !== 0 ? "y=" + vy : null,
    ox !== w / 2 ? "ox=" + (ox - w / 2) : null,
    oy !== h / 2 ? "oy=" + -(oy - h / 2) : null, // Y up!
    distance !== 232 ? "distance=" + Math.round(distance) : null,
    pause ? "pause=true" : null,
    overlay ? "overlay=true" : null,
    debug ? "debug=true" : null,
  ];
  params = params.filter((p) => p !== null);
  history.replaceState(
    { data: "" },
    title,
    root + (params.length > 0 ? "?" : "") + params.join("&")
  );
};

const update = (e) => {
  stop();
  const v = steps[step][1];
  const range = e?.srcElement || _i("range" + (v ? v[0] : "?"));
  if (range) {
    window[range.variable] = Number(range.value);
    const value = _i("value" + range.n);
    if (value) {
      value.textContent = range.value;
    }
    range_color(range);
    step12_init();
  }
  code2text();
  start();
};

const range_color = (range) => {
  const p = normalize(range.value, range.min, range.max);
  const r = 64;
  const g = 80;
  const b = 128;
  const c1 = `rgb(${r},${g},${b})`;
  const c2 = `rgb(${r + p * 64},${g - p * 32},${b - p * 64})`;
  range.style.backgroundImage = `linear-gradient(90deg,${c1} 0%,${c2} ${
    p * 100
  }%,#444 ${p * 100}%)`;
};

const tick = (fn) => {
  rt[rti] = Math.min(1000 / (time - delta), rtmax);
  rti = (rti + 1) % rtc;
  if (
    window.drag ||
    window.drago ||
    window.wheel ||
    (step > 5 && !window.pause)
  ) {
    window.rid = requestAnimationFrame(fn);
  }
};

const single_frame = () => {
  const opacity = window["_o"];
  window["_o"] = 1;
  start();
  window["_o"] = opacity;
};

const start = () => {
  stop();
  window.time = performance.now();
  window[`step${window.step}_draw`]();
};

const stop = () => {
  cancelAnimationFrame(window.rid);
  window.rid = undefined;
};

const set_pause = (state) => {
  window.pause = state;
  _i("motion").checked = !window.pause;
  set_url();
  if (window.pause) {
    single_frame();
  } else {
    start();
  }
};

const set_overlay = (state) => {
  window.overlay = state;
  _i("overlay").checked = window.overlay;
  set_url();
  single_frame();
};

const set_debug = (state) => {
  window.debug = state;
  _i("debug").checked = window.debug;
  set_url();
  single_frame();
};

const code2text = () => {
  let text = String(_i("step" + step).textContent);
  text = text.replaceAll("step" + step + "_", "");
  text = text.replace("tick", "requestAnimationFrame");
  text = text.replaceAll("lcg", "Math.random");
  text = text.replaceAll("vx + ", "");
  text = text.replaceAll("vy + ", "");
  ["(", ")", "[", "]", "{", "}"].forEach((v) => {
    text = text.replaceAll(v, "«sy1»" + v + "¤");
  });
  [".", ",", "'", "`", ":", ";", "="].forEach((v) => {
    text = text.replaceAll(v, "«sy2»" + v + "¤");
  });
  ["$", "#", "@", "%", "&", "|", "<", ">"].forEach((v) => {
    text = text.replaceAll(v, "«sy3»" + v + "¤");
  });
  ["if", "for", "continue", "return", "new", "let", "const"].forEach((v) => {
    text = text.replaceAll(v, "«sy4»" + v + "¤");
  });
  ["Math", "Float32Array", "requestAnimationFrame"].forEach((v) => {
    text = text.replaceAll(v, "«sy5»" + v + "¤");
  });
  ["ctx", "stars", "distance", "depth", "dof"].forEach((v) => {
    text = text.replaceAll(v, "«sy6»" + v + "¤");
  });
  ["THRESHOLD", "CIRCLE"].forEach((v) => {
    text = text.replaceAll(v, "«sy7»" + v + "¤");
  });
  ["init", "draw", "clear", "get_position"].forEach((v) => {
    text = text.replaceAll(v, "«sy8»" + v + "¤");
  });
  vars
    .map((v) => v[0])
    .forEach((v, i) => {
      text = text.replaceAll(v, "«var var" + i + "»" + window[v] + "¤");
    });
  ["-", "+", "*", " / "].forEach((v) => {
    text = text.replaceAll(v, "«op»" + v + "¤");
  });
  text = text
    .split("\n")
    .map((l) => l.slice(2))
    .join("\n");
  text = text.replaceAll("  ", "«tab»│ ¤");
  text = text.split("\n").slice(1);
  text.pop();
  const code = _t("code")[0];
  code.textContent = "";
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i].endsWith("// REM")) continue;
    if (text[i].endsWith("// NREM")) {
      text[i] = text[i].replace("// NREM", "");
      text[i] = text[i].replace("//", "");
    }
    const line = _c("div");
    line.id = "line" + n;
    line.className = "line";
    let txt = "«nbr»" + n + "¤" + text[i] || "&nbsp;";
    if (text[i].startsWith("//")) {
      line.className += " rem";
      txt = txt.replaceAll("//", "");
    }
    txt = txt.replaceAll("«", '<div class="');
    txt = txt.replaceAll("»", '">');
    txt = txt.replaceAll("¤", "</div>");
    line.innerHTML = txt;
    line.childNodes.forEach((e) => {
      e.textContent = String(e.textContent).replace(" ", NBSP);
    });
    _a(code, line);
    n++;
  }
  let hl = steps[step][2] || [];
  for (let i = 0; i < hl.length; i++) {
    const line = _i("line" + hl[i]);
    if (line) line.className = "line hl1";
  }
  hl = steps[step][3] || [];
  for (let i = 0; i < hl.length; i++) {
    const line = _i("line" + hl[i]);
    if (line) line.className = "line hl2";
  }
};

const keydown = (e) => {
  shift = e.shiftKey;
  key = e.key;
  let id;
  switch (e.key) {
    case "Escape":
    case "d":
      if (shift) {
        const root = _i("root");
        root.className = root.className === "" ? "debug" : "";
      } else {
        set_debug(!debug);
      }
      break;
    case "o":
      set_overlay(!overlay);
      break;
    case "Enter":
    case "p":
      set_pause(!pause);
      break;
    case "ArrowUp":
      run((step + steps.length - 1) % steps.length);
      break;
    case "ArrowDown":
      run((step + 1) % steps.length);
      break;
    case "ArrowLeft":
      star_n = (star_n + _nb - 1) % _nb;
      single_frame();
      break;
    case "ArrowRight":
      star_n = (star_n + 1) % _nb;
      single_frame();
      break;
    case "c":
      ox = w / 2;
      oy = h / 2;
      vx = 0;
      vy = 0;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.translate(ox, oy);
      set_url();
      step12_init();
      single_frame();
      break;
    case "r":
      reset();
      set_url();
      code2text();
      step12_init();
      single_frame();
      break;
  }
};

const keyup = (e) => {
  shift = e.shiftKey;
  key = e.key;
};

get_p = (x, y, z) => {
  if (drag) {
    x += px;
    y += py;
  }
  depth = _fp - _np;
  z -= distance % depth;
  if (z < _np) {
    z += depth;
  } else if (z > _fp) {
    z -= depth;
  }
  return [x, y, z];
};

translate = () => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  x = ox + (drago ? px : 0);
  y = oy + (drago ? py : 0);
  ctx.translate(x, y);
};

update_distance = () => {
  if (!pause) {
    distance += ((time - delta) / 1000) * _m;
    distance = distance % (depth * 2);
  }
};

overlay_draw = () => {
  if (!overlay) {
    return;
  }
  x = -ox - (drago ? px : 0);
  y = -oy - (drago ? py : 0);
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = _o;
  ctx.drawImage(ocvs, 0, 0, w * dpr, h * dpr, x, y, w * dpr, h * dpr);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
};

debug_draw = () => {
  if (!debug) {
    return;
  }
  const m = 4;
  ctx.globalCompositeOperation = "source-over";
  ctx.lineWidth = 2;
  ctx.textAlign = "center";
  ctx.font = "16px/16px hud";
  ctx.strokeStyle = "#5c0";
  ctx.fillStyle = "#5c0";
  let x0, y0, z0, r0, s0;
  let x1, y1, z1, r1, s1;
  let x2, y2, z2, r2, s2;
  x = drag ? px : 0;
  y = drag ? py : 0;
  if (step === 1) {
    x0 = drago ? px : vx;
    y0 = drago ? py : vy;
    x0 = vx + x;
    y0 = vy + y;
    x1 = vx + x - _w / 2 - m;
    y1 = vy + y - _w / 2 - m;
    s1 = _w + m * 2;
  } else if (step === 2) {
    x0 = (vx + x) / oz;
    y0 = (vy + y) / oz;
    x1 = (vx + x - _w / 2) / _fp - m;
    y1 = (vy + y - _w / 2) / _fp - m;
    s1 = _w / _fp + m * 2;
    x2 = (vx + x - _w / 2) / _np - m;
    y2 = (vy + y - _w / 2) / _np - m;
    s2 = _w / _np + m * 2;
  } else {
    r0 = _f / oz;
    x0 = (vx + x) * r0;
    y0 = (vy + y) * r0;
    r1 = _f / _fp;
    x1 = (vx + x - _w / 2) * r1 - m;
    y1 = (vy + y - _w / 2) * r1 - m;
    s1 = _w * r1 + m * 2;
    r2 = _f / _np;
    x2 = (vx + x - _w / 2) * r2 - m;
    y2 = (vy + y - _w / 2) * r2 - m;
    s2 = _w * r2 + m * 2;
  }
  if (step === 0) {
    //ctx.fillText('HEY!', 48, -40);
  } else if (step === 1) {
    ctx.strokeRect(x1, y1, s1, s1);
    ctx.fillText(_w + "×" + _w, x1 + s1 / 2, y1 - 5);
  } else {
    ctx.beginPath();
    ctx.rect(x1, y1, s1, s1);
    ctx.rect(x2, y2, s2, s2);
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.moveTo(x1 + s1, y1);
    ctx.lineTo(x2 + s2, y2);
    ctx.moveTo(x1 + s1, y1 + s1);
    ctx.lineTo(x2 + s2, y2 + s2);
    ctx.moveTo(x1, y1 + s1);
    ctx.lineTo(x2, y2 + s2);
    ctx.stroke();
    ctx.fillText(_w + "×" + _w + "×" + (_fp - _np), x1 + s1 / 2, y1 - 4);
  }
  if (step > 1) {
    ctx.beginPath();
    ctx.moveTo(x0 - m, y0);
    ctx.lineTo(x0 + m, y0);
    ctx.moveTo(x0, y0 - m);
    ctx.lineTo(x0, y0 + m);
    ctx.stroke();
    ctx.lineDashOffset = 2;
    ctx.setLineDash([2, 8]);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1 + s1 / 2, y1 + s1 / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(x1 + s1 / 2, y1 + s1 / 2, (_w / 128) * r1, 0, CIRCLE);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x2 + s2 / 2, y2 + s2 / 2, (_w / 128) * r2, 0, CIRCLE);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x2 + s2 / 2, y2 + s2 / 2, 2, 0, CIRCLE);
    ctx.stroke();
    ctx.lineDashOffset = 8;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(x1 + s1 / 2, y1 + s1 / 2);
    ctx.lineTo(x2 + s2 / 2, y2 + s2 / 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  /* origin */
  x = Math.round(ox - w / 2 + (drago ? px : 0));
  y = Math.round(oy - h / 2 + (drago ? py : 0));
  ctx.fillText(x + "×" + -y, x0, y0 + 16);
  /* center */
  if (step === 12) {
    ctx.beginPath();
    ctx.arc(x1 + s1 / 2, y1 + s1 / 2, (_w / 8) * r1, 0, CIRCLE);
    ctx.setLineDash([s1 / 64, s1 / 64]);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x2 + s2 / 2, y2 + s2 / 2, (_w / 8) * r2, 0, CIRCLE);
    ctx.setLineDash([s2 / 64, s2 / 64]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  /* depth */
  if (step > 7) {
    x = drag ? px : 0;
    y = drag ? py : 0;
    r1 = _f / (_np + _dof * depth);
    x1 = (vx + x - _w / 2) * r1;
    y1 = (vy + y - _w / 2) * r1;
    s1 = _w * r1;
    ctx.beginPath();
    ctx.rect(x1 - 2, y1 - 2, s1 + 4, s1 + 4);
    if (step === 12) {
      ctx.moveTo(x1 + s1 / 2 + s1 / 8, y1 + s1 / 2);
      ctx.arc(x1 + s1 / 2, y1 + s1 / 2, s1 / 8, 0, CIRCLE);
    }
    ctx.setLineDash([s1 / 64, s1 / 64]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  /* star position */
  star_n = star_n % _nb;
  if (stars[star_n]) {
    ctx.strokeStyle = "#e50";
    ctx.fillStyle = "#e50";
    ctx.textAlign = "center";
    let p = Math.round(stars[star_n][0] - vx);
    p += "×" + Math.round(stars[star_n][1] - vy);
    [x, y, z] = get_position(stars[star_n]);
    p += "×" + Math.round(z);
    z = step > 1 ? z : _fp;
    r = step !== 2 ? _f / z : 1 / z;
    x *= r;
    y *= r;
    s1 = _s * r * 2 + m * 2;
    s2 = _g * r + m * 2;
    if (step > 0) {
      ctx.strokeRect(x - s1 / 2, y - s1 / 2, s1, s1);
      if (step < 7) {
        ctx.fillText(p, x, y - s1 / 2 - 4);
      }
    }
    if (step > 6) {
      ctx.strokeRect(x - s2 / 2, y - s2 / 2, s2, s2);
      ctx.fillText(p, x, y - s2 / 2 - 4);
    }
  }
  /* rendertime */
  x = (drago ? -px : 0) - ox + w - 8;
  y = (drago ? -py : 0) - oy + 8;
  ctx.strokeStyle = "#d90";
  ctx.fillStyle = "#d90";
  squircle(ctx, x - rtc, y, rtc, rth, 3);
  ctx.stroke();
  ctx.save();
  ctx.clip();
  ctx.beginPath();
  let rtm = 0;
  for (let i = 0; i < rtc; i++) {
    let k = rti + i;
    if (k > rtc - 1) {
      k -= rtc;
    }
    const v = (rth / rtmax) * rt[k];
    ctx.rect(x - rtc - 1 + i, y + rth - v - 1, 2, 2);
    if (i > rtc - 33) {
      rtm += rt[k];
    }
  }
  ctx.fill();
  ctx.restore();
  ctx.textAlign = "right";
  ctx.fillText(Math.floor(rtm / 32), x - m, y + m + 12);
  /* distance */
  ctx.fillText(Math.round(distance) + " LY", x, y + h - 16);
};
