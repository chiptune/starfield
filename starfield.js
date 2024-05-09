"use strict";

const VERSION = [0, 1, 3];

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
  "use strict";
  const LCG_MUL = 8121; // multiplier
  const LCG_INC = 28411; // increment
  const LCG_MOD = 134456; // modulus (2 ** 3 * 7 ** 5)
  window.seed = (LCG_MUL * window.seed + LCG_INC) % LCG_MOD;
  return window.seed / LCG_MOD;
};
const format = (nbr, decimal = 1) => {
  const sign = Number(nbr) < 0 ? "-" : "";
  const n = Math.abs(Number(nbr) || 0);
  if (n < 1e-3 && n !== 0) return `${sign}${n.toExponential(decimal)}`;
  if (n >= 0 && n < 1e3) return `${sign}${Number(Number(n).toFixed(decimal))}`;
  if (n >= 1e3 && n < 1e6) return `${sign}${Number(Number(n / 1e3).toFixed(decimal))}K`; // thousand
  if (n >= 1e6 && n < 1e9) return `${sign}${Number(Number(n / 1e6).toFixed(decimal))}M`; // million
  if (n >= 1e9 && n < 1e12) return `${sign}${Number(Number(n / 1e9).toFixed(decimal))}B`; // billion
  if (n >= 1e12) return `${sign}${Number(Number(n / 1e12).toFixed(decimal))}T`; // trillion
  return `${sign}${Number(n)}`;
};

const SCALE = [1, 2, 2.5, 4, 5, 8, 10];

const scale = (n, inverse = false) => {
  let nbr = n;
  let div = 1;
  if (Math.abs(n) < 1) {
    const decimal = 6;
    nbr = Number(n.toFixed(6).split(".")[1]);
    div = 1 / Math.pow(10, decimal);
  }
  const mul = Math.pow(10, String(Math.round(nbr)).length - 1);
  if (!inverse) {
    for (let i = 0; i < SCALE.length; i += 1) {
      if (SCALE[i] * mul >= nbr) return SCALE[i] * mul * div;
    }
  } else {
    for (let i = SCALE.length - 1; i >= 0; i -= 1) {
      if (SCALE[i] * mul < nbr) return SCALE[i] * mul * div;
    }
  }
  return mul;
};

class Starfield {
  SPACE = 256;
  DISTANCE = 0;
  path = "starfield";
  stars = [];
  vars = [
    ["_nb", "number", 0, 2048, 8, 1024],
    ["_s", "size", 0.01, 1, 0.01, 0.5],
    ["_w", "space", 8, this.SPACE * 2, 1, this.SPACE],
    ["_fp", "far_p", 8, this.SPACE * 2, 1, this.SPACE * 2],
    ["_np", "near_p", 1, this.SPACE * 2, 1, 1],
    ["_f", "focale", 1, 1024, 1, this.SPACE * 2],
    ["_cl", "light", 0.01, 6, 0.01, 3],
    ["_mo", "motion", -64, 64, 1, 16],
    ["_o", "opacity", 0.01, 1, 0.01, 0.5],
    ["_g", "gradient", 4, 24, 0.1, 14],
    ["_hl", "halo", 0.01, 0.5, 0.01, 0.1],
    ["_dof", "dof", 0.01, 1, 0.01, 0.1],
    ["_cs", "color", 0, 1, 0.01, 0.5],
    ["_cy", "cycle", 0, 360, 1, 180],
    ["_mi", "mirror", 0, 2, 0.01, 1],
    ["_ho", "horizon", 0, 32, 1, 16],
  ];
  steps = [
    ["intro", null, [6, 11, 19], [3]],
    ["points", [0, 1, 2], [3, 4, 15], [20]],
    ["depth", [3, 4], [6, 17], [1]],
    ["focale", [5], [6, 8]],
    ["light", [6], [7, 8], [16]],
    ["sorting", null, [[15, 23]], [4]],
    ["motion", [7, 8], [1, [13, 16], [19, 28]], [4]],
    ["gradient", [9, 10], [[12, 20]]],
    ["dof", [11], [[12, 15]]],
    ["blending", null, [1, [29, 34]]],
    ["color", [12, 13], [8, 9, 24, 25, [31, 34], 46]],
    ["spikes", null, [[24, 51]]],
    ["mirror", [14], [[25, 34]], [10]],
    ["horizon", [15], [], []],
  ];
  px = 0;
  py = 0;
  mx = 0;
  my = 0;
  drag = false;
  drago = false;
  wheel = false;
  key = null;
  shift = false;
  star_n = 0;
  time = performance.now();
  delta = performance.now();
  rti = 0;
  rtc = 128;
  rth = 56;
  rtmax = 120;
  rt = new Float32Array(128);

  constructor() {
    /* url params */
    this.root = document.location.origin + "/" + this.path + "/";
    this.url = new URL(document.location.href).searchParams;
    this.step = Number(this.url.get("step")) || 0;
    this.space = Number(this.url.get("space")) || this.SPACE;
    this.distance = Number(this.url.get("distance")) || this.DISTANCE;
    this.vx = Number(this.url.get("x")) || 0;
    this.vy = Number(this.url.get("y")) || 0;
    this.pause = Boolean(this.url.get("pause"));
    this.overlay = Boolean(this.url.get("overlay"));
    this.debug = Boolean(this.url.get("debug"));
    /* variables */
    this.vars.forEach((v) => {
      this[v[0]] = Number(this.url.get(v[0].slice(1)) || v[5]);
    });
    this.depth = this._fp - this._np;
    /* steps */
    this.steps.forEach((v, i) => {
      const btn = _c("input");
      btn.type = "button";
      btn.id = `step${i}_btn`;
      btn.className = "step";
      btn.value = v[0];
      _a(_i("steps"), btn);
      btn.addEventListener("click", () => {
        this.run(i);
      });
    });
    /* init canvas */
    this.cvs = _i("starfield");
    this.ctx = this.cvs.getContext("2d", { alpha: false });
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";
    this.ctx.lineCap = "round";
    /* events */
    _i("motion").addEventListener("change", () => {
      this.set_pause(!this.pause);
    });
    _i("overlay").addEventListener("change", () => {
      this.set_overlay(!this.overlay);
    });
    _i("debug").addEventListener("change", () => {
      this.set_debug(!this.debug);
    });
    addEventListener("resize", this.resize.bind(this));
    addEventListener("keydown", this.keydown.bind(this));
    addEventListener("keyup", this.keyup.bind(this));
    addEventListener("drop", () => false);
    addEventListener("mousemove", this.mousemove.bind(this));
    this.cvs.addEventListener("mousedown", this.mousedown.bind(this));
    addEventListener("mouseup", this.mouseup.bind(this));
    this.cvs.addEventListener("mousewheel", this.mousewheel.bind(this));
  }

  resize = () => {
    this.w = this.cvs.offsetWidth;
    this.h = this.cvs.offsetHeight;
    this.ox = this.w / 2 + Number(this.url.get("ox") || 0);
    this.oy = this.h / 2 - Number(this.url.get("oy") || 0);
    this.oz = 1e12;
    this.dpr = window.devicePixelRatio;
    this.cvs.width = this.w * this.dpr;
    this.cvs.height = this.h * this.dpr;
    this.cvs.style.width = this.w + "px";
    this.cvs.style.height = this.h + "px";
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);
    this.ctx.translate(this.ox, this.oy);
    this.generate_overlay();
    this.single_frame();
  };

  init = () => {
    step10_init();
    this.resize();
    this.set_pause(this.pause);
    this.set_overlay(this.overlay);
    this.set_debug(this.debug);
    this.run(this.step);
  };

  mousedown(e) {
    this.mx = e.pageX - this.cvs.offsetLeft - this.cvs.width / 2;
    this.my = e.pageY - this.cvs.offsetTop - this.cvs.height / 2;
    if (!this.shift) {
      this.drag = true;
    } else {
      this.drago = true;
    }
    this.cvs.style.cursor = "grab";
    this.start();
  }

  mouseup() {
    this.mx = 0;
    this.my = 0;
    if (this.drag) {
      for (let i = 0; i < this.stars.length; i++) {
        this.stars[i][0] += this.px;
        this.stars[i][1] += this.py;
      }
      this.vx += this.px;
      this.vy += this.py;
      this.drag = false;
    } else if (this.drago) {
      this.ox += this.px;
      this.oy += this.py;
      this.drago = false;
    }
    this.px = 0;
    this.py = 0;
    this.cvs.style.cursor = "crosshair";
    this.set_url();
    for (let i = 0; i < 4; i++) this.start();
  }

  mousemove(e) {
    const x = e.pageX - this.mx - this.cvs.offsetLeft - this.cvs.width / 2;
    const y = e.pageY - this.my - this.cvs.offsetTop - this.cvs.height / 2;
    if (this.drag || this.drago) {
      this.px = x;
      this.py = y;
    }
  }

  mousewheel(e) {
    e.preventDefault();
    clearTimeout(this.timeout);
    if (!this.wheel) {
      this.wheel = true;
      this.start();
    }
    this.distance -= (e.deltaY / 2 ** 15) * this._f * this._mo;
    this.timeout = setTimeout(() => {
      this.wheel = false;
      this.set_url();
    }, 250);
  }
  set_pause = (state) => {
    this.pause = state;
    _i("motion").checked = !this.pause;
    this.set_url();
    if (this.pause) {
      this.single_frame();
    } else {
      this.start();
    }
  };

  keyup = (e) => {
    this.shift = e.shiftKey;
    this.key = e.key;
  };

  keydown = (e) => {
    this.shift = e.shiftKey;
    this.ctrl = e.ctrlKey;
    this.alt = e.altKey;
    this.meta = e.metaKey;
    this.key = e.key;
    switch (e.key) {
      case "Escape":
      case "d":
        if (this.shift) {
          document.body.className = document.body.className === "" ? "debug" : "";
        } else {
          this.set_debug(!this.debug);
        }
        break;
      case "o":
        this.set_overlay(!this.overlay);
        break;
      case "Enter":
      case "p":
        this.set_pause(!this.pause);
        break;
      case "ArrowUp":
        if (this.shift) {
          this.oy = Math.round(this.oy - 1);
          this.start();
        } else {
          this.run((this.step + this.steps.length - 1) % this.steps.length);
        }
        break;
      case "ArrowDown":
        if (this.shift) {
          this.oy = Math.round(this.oy + 1);
          this.start();
        } else {
          this.run((this.step + 1) % this.steps.length);
        }
        break;
      case "ArrowLeft":
        if (this.shift) {
          this.ox = Math.round(this.ox - 1);
          this.start();
        } else {
          this.star_n = (this.star_n + this._nb - 1) % this._nb;
          this.single_frame();
        }
        break;
      case "ArrowRight":
        if (this.shift) {
          this.ox = Math.round(this.ox + 1);
          this.start();
        } else {
          this.star_n = (this.star_n + 1) % this._nb;
          this.single_frame();
        }
        break;
      case "PageUp":
        this.distance = Math.round(this.distance + this._mo);
        this.start();
        break;
      case "PageDown":
        this.distance = Math.round(this.distance - this._mo);
        this.start();
        break;
      case "c":
        this.ox = this.w / 2;
        this.oy = this.h / 2;
        this.vx = 0;
        this.vy = 0;
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(this.dpr, this.dpr);
        this.ctx.translate(this.ox, this.oy);
        this.set_url();
        step10_init();
        this.single_frame();
        break;
      case "r":
        if (this.meta) break;
        this.reset();
        this.set_url();
        this.code2text();
        step10_init();
        this.single_frame();
        break;
    }
  };

  set_overlay = (state) => {
    this.overlay = state;
    _i("overlay").checked = this.overlay;
    this.set_url();
    this.single_frame();
  };

  set_debug = (state) => {
    this.debug = state;
    _i("debug").checked = this.debug;
    this.set_url();
    this.single_frame();
  };

  set_url = (e) => {
    const title = "starfield" + (this.step > 0 ? ` > step${this.step}: ${this.steps[this.step][0]}` : "");
    document.title = title;
    let params = [
      this.step > 0 ? "step=" + this.step : null,
      this._nb !== this.vars[0][5] ? "nb=" + this._nb : null,
      this.vx !== 0 ? "x=" + this.vx : null,
      this.vy !== 0 ? "y=" + this.vy : null,
      this.ox !== this.w / 2 ? "ox=" + (this.ox - this.w / 2) : null,
      this.oy !== this.h / 2 ? "oy=" + -(this.oy - this.h / 2) : null, // Y up!
      Math.round(this.distance) !== this.DISTANCE ? "distance=" + Math.round(this.distance) : null,
      this.pause ? "pause=true" : null,
      this.overlay ? "overlay=true" : null,
      this.debug ? "debug=true" : null,
    ];
    params = params.filter((p) => p !== null);
    history.replaceState({ data: "" }, title, this.root + (params.length > 0 ? "?" : "") + params.join("&"));
  };

  generate_overlay = () => {
    this.ocvs = _c("canvas");
    this.ocvs.width = this.w * this.dpr;
    this.ocvs.height = this.h * this.dpr;
    this.octx = this.ocvs.getContext("2d", { alpha: false });
    this.octx.imageSmoothingEnabled = true;
    this.octx.imageSmoothingQuality = "high";
    this.octx.lineCap = "round";
    this.octx.setTransform(1, 0, 0, 1, 0, 0);
    this.octx.scale(this.dpr, this.dpr);
    /* background */
    this.octx.fillStyle = `rgb(0 0 0)`;
    this.octx.fillRect(0, 0, this.w, this.h);
    /* scanline */
    const dot = 1;
    this.octx.setLineDash([0, dot * 3]);
    this.octx.lineWidth = dot * 1.2;
    this.overlay_rgb(dot, 32, 1);
    this.octx.lineWidth = dot * 0.8;
    this.overlay_rgb(dot, 96, 1);
  };

  overlay_rgb = (dot, c, alpha) => {
    /* R */
    this.octx.strokeStyle = `rgba(${c * 4},${c},${c},${alpha})`;
    let y = dot / 2;
    for (let i = 0; i < this.h; i++) {
      this.octx.beginPath();
      this.octx.moveTo(0, y);
      this.octx.lineTo(this.w, y);
      this.octx.lineDashOffset = i % 2 === 0 ? 0 : dot * 1.5;
      this.octx.stroke();
      y += dot;
    }
    /* G */
    this.octx.strokeStyle = `rgba(${c},${c * 4},${c},${alpha})`;
    y = dot / 2;
    for (let i = 0; i < this.h; i++) {
      this.octx.beginPath();
      this.octx.moveTo(0, y);
      this.octx.lineTo(this.w, y);
      this.octx.lineDashOffset = dot + (i % 2 === 0 ? 0 : dot * 1.5);
      this.octx.stroke();
      y += dot;
    }
    /* B */
    this.octx.strokeStyle = `rgba(${c},${c},${c * 4},${alpha})`;
    y = dot / 2;
    for (let i = 0; i < this.h; i++) {
      this.octx.beginPath();
      this.octx.moveTo(0, y);
      this.octx.lineTo(this.w, y);
      this.octx.lineDashOffset = dot * 2 + (i % 2 === 0 ? 0 : dot * 1.5);
      this.octx.stroke();
      y += dot;
    }
  };

  single_frame = () => {
    if (!this.fn) return;
    const opacity = this._o;
    this._o = 1;
    this.fn();
    this._o = opacity;
  };

  start = () => {
    if (!this.fn) return;
    this.time = performance.now();
    cancelAnimationFrame(this.rid);
    this.rid = requestAnimationFrame(this.fn.bind(this));
  };

  stop = () => {
    cancelAnimationFrame(this.rid);
    this.rid = undefined;
  };

  tick = (fn) => {
    this.rt[this.rti] = Math.min(1000 / (this.time - this.delta), this.rtmax);
    this.rti = (this.rti + 1) % this.rtc;
    cancelAnimationFrame(this.rid);
    if (this.drag || this.drago || this.wheel || (this.step > 5 && !this.pause)) this.rid = requestAnimationFrame(fn);
  };

  get_p = (x, y, z) => {
    if (this.drag) {
      x += this.px;
      y += this.py;
    }
    z -= this.distance % this.depth;
    if (z < this._np) {
      z += this.depth;
    } else if (z > this._fp) {
      z -= this.depth;
    }
    return [x, y, z];
  };

  translate = () => {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);
    this.ctx.translate(this.ox + (this.drago ? this.px : 0), this.oy + (this.drago ? this.py : 0));
  };

  update_distance = () => {
    if (this.pause) return;
    this.distance += ((this.time - this.delta) / 1000) * this._mo;
  };

  overlay_draw = () => {
    if (!this.overlay) return;
    const x = -this.ox - (this.drago ? this.px : 0);
    const y = -this.oy - (this.drago ? this.py : 0);
    this.ctx.globalCompositeOperation = "overlay";
    this.ctx.globalAlpha = this._o;
    this.ctx.drawImage(
      this.ocvs,
      0,
      0,
      this.w * this.dpr,
      this.h * this.dpr,
      x,
      y,
      this.w * this.dpr,
      this.h * this.dpr,
    );
    this.ctx.globalAlpha = 1;
    this.ctx.globalCompositeOperation = "source-over";
  };

  debug_draw = () => {
    if (!this.debug) return;
    const { ctx, w, h, vx, vy, px, py, ox, oy, oz } = this;
    const { step, stars, star_n, distance, depth, drag, drago } = this;
    const { _nb, _s, _w, _f, _np, _fp, _g, _dof } = this;
    const { rt, rti, rtc, rth, rtmax } = this;
    const m = 4;
    ctx.globalCompositeOperation = "source-over";
    ctx.lineWidth = 2;
    ctx.textAlign = "center";
    ctx.font = "16px/16px hud";
    let x0, y0, r0;
    let x1, y1, r1, s1;
    let x2, y2, r2, s2;
    let x = drag ? px : 0;
    let y = drag ? py : 0;
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
    /* grid */
    ctx.strokeStyle = "#c50";
    x = (drago ? -px : 0) - ox;
    y = (drago ? -py : 0) - oy;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + 2);
    ctx.lineTo(x + w / 2, y + h - 4);
    ctx.moveTo(x + 2, y + h / 2);
    ctx.lineTo(x + w - 4, y + h / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = "#5c0";
    ctx.fillStyle = "#5c0";
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
      ctx.setLineDash([s1 / 64, s1 / 64]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    /* star position */
    const n = star_n % _nb;
    if (stars[n]) {
      ctx.strokeStyle = "#e50";
      ctx.fillStyle = "#e50";
      ctx.textAlign = "center";
      let p = Math.round(stars[n][0] - vx);
      p += "×" + Math.round(stars[n][1] - vy);
      let [x, y, z] = get_position(stars[n]);
      p += "×" + Math.round(z);
      z = step > 1 ? z : _fp;
      const r = step !== 2 ? _f / z : 1 / z;
      x *= r;
      y *= r;
      s1 = _s * r * 2 + m * 2;
      s2 = _g * r + m * 2;
      if (step > 0) {
        ctx.strokeRect(x - s1 / 2, y - s1 / 2, s1, s1);
        if (step < 7) ctx.fillText(p, x, y - s1 / 2 - 4);
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
      if (k > rtc - 1) k -= rtc;
      const v = (rth / rtmax) * rt[k];
      ctx.rect(x - rtc - 1 + i, y + rth - v - 1, 2, 2);
      if (i > rtc - 33) rtm += rt[k];
    }
    ctx.fill();
    ctx.restore();
    ctx.textAlign = "right";
    ctx.fillText(Math.floor(rtm / 32), x - m, y + m + 12);
    /* distance */
    ctx.fillText(`${format(Math.round(distance))} LY`, x, y + h - 16);
    /* border */
    ctx.strokeStyle = "#c50";
    x = (drago ? -px : 0) - ox;
    y = (drago ? -py : 0) - oy;
    squircle(ctx, x + 1, y + 1, w - 2, h - 2, 6);
    ctx.stroke();
  };

  run = (id) => {
    stop();
    for (let i = 0; i <= this.vars.length; i++) {
      _r(_i(`slider${i}`));
      _r(_i(`list${i}`));
    }
    let btn = _i(`step${this.step}_btn`);
    if (btn) btn.disabled = false;
    this.step = parseInt(id || 0);
    this.fn = window[`step${this.step}_draw`] || undefined;
    btn = _i(`step${this.step}_btn`);
    if (!btn) return;
    btn.disabled = true;
    const variables = _i("variables");
    let n = 0;
    for (let i = 0; i <= this.step; i++) {
      const v = this.steps[i][1];
      if (!v) continue;
      for (let j = 0; j < v.length; j++) {
        const [name, text, min, max, step] = this.vars[v[j]];
        const slider = _c("form");
        slider.id = `slider${n}`;
        slider.className = "slider";
        _a(variables, slider);
        const label = _c("label");
        label.id = `label${n}`;
        label.setAttribute("for", `range${n}`);
        label.textContent = text;
        label.style.float = "left";
        _a(slider, label);
        const range = _c("input");
        range.type = "range";
        range.id = `range${n}`;
        range.n = n;
        range.variable = name;
        range.min = min;
        range.max = max;
        range.step = step;
        range.addEventListener("input", this.update);
        _a(slider, range);
        range.value = this[range.variable];
        this.range_color(range);
        const value = _c("div");
        value.id = `value${n}`;
        value.textContent = range.value;
        value.className = `var var${n}`;
        _a(slider, value);
        n++;
      }
    }
    this.ctx.globalCompositeOperation = "source-over";
    this.set_url();
    this.update();
    this.single_frame();
  };

  update = (e) => {
    this.stop();
    const v = this.steps[this.step][1];
    const range = e?.srcElement || _i(`range${v ? v[0] : "?"}`);
    if (range) {
      this[range.variable] = Number(range.value);
      const value = _i(`value${range.n}`);
      if (value) value.textContent = range.value;
      this.range_color(range);
      step10_init();
    }
    this.depth = this._fp - this._np;
    this.code2text();
    this.start();
  };

  range_color = (range) => {
    const p = normalize(range.value, range.min, range.max);
    const r = 64;
    const g = 80;
    const b = 128;
    const c1 = `rgb(${r} ${g} ${b})`;
    const c2 = `rgb(${r + p * 64} ${g - p * 32} ${b - p * 64})`;
    range.style.backgroundImage = `linear-gradient(90deg,${c1} 0%,${c2} ${p * 100}%,#444 ${p * 100}%)`;
  };

  reset = () => {
    let range = document.getElementsByTagName("input");
    this.vars.forEach((v, i) => {
      this[v[0]] = v[5];
      for (let i = 0; i < range.length; i++) {
        if (range[i].variable === v[0]) {
          range[i].value = v[5];
          const value = _i(`value${range[i].n}`);
          if (value) value.textContent = range[i].value;
          this.range_color(range[i]);
          break;
        }
      }
    });
    this.distance = this.DISTANCE;
    this.depth = this._fp - this._np;
  };

  code2text = () => {
    const step = _i(`step${this.step}`);
    let text = step ? String(step.textContent) : "\n  draw = () => {\n    // ERROR! // NREM\n  };\n";
    text = text.replaceAll(`step${this.step}_`, "");
    text = text.replace("tick", "requestAnimationFrame");
    text = text.replaceAll("lcg", "Math.random");
    text = text.replaceAll("sfo.", "");
    text = text.replaceAll("vx + ", "");
    text = text.replaceAll("vy + ", "");
    ["(", ")", "[", "]", "{", "}"].forEach((v) => {
      text = text.replaceAll(v, `«sy1»${v}¤`);
    });
    [".", ",", "'", '"', "`", ":", ";", "="].forEach((v) => {
      text = text.replaceAll(v, `«sy2»${v}¤`);
    });
    ["$", "#", "@", "%", "&", "|", "<", ">"].forEach((v) => {
      text = text.replaceAll(v, `«sy3»${v}¤`);
    });
    ["if", "for", "while", "continue", "return", "new", "let", "const"].forEach((v) => {
      text = text.replaceAll(v, `«sy4»${v}¤`);
    });
    ["Math", "Float32Array", "requestAnimationFrame", "rgb", "hsl"].forEach((v) => {
      text = text.replaceAll(v, `«sy5»${v}¤`);
    });
    ["ctx", "stars", "distance", "depth", "time", "delta"].forEach((v) => {
      text = text.replaceAll(v, `«sy6»${v}¤`);
    });
    ["THRESHOLD", "CIRCLE"].forEach((v) => {
      text = text.replaceAll(v, `«sy7»${v}¤`);
    });
    ["init", "draw", "clear", "get_position"].forEach((v) => {
      text = text.replaceAll(v, `«sy8»${v}¤`);
    });
    this.vars
      .map((v) => v[0])
      .forEach((v, i) => {
        text = text.replaceAll(v, `«var var${i}»${this[v]}¤`);
      });
    ["-", "+", "*", " / "].forEach((v) => {
      text = text.replaceAll(v, `«op»${v}¤`);
    });
    text = text.replaceAll("*", "×");
    text = text
      .split("\n")
      .map((l) => l.slice(2))
      .join("\n");
    text = text.replaceAll("  ", "«tab»¤");
    text = text.split("\n").slice(1);
    text.pop();
    const code = _t("code")[0];
    code.textContent = "";
    let n = 0;
    let count = text.length;
    for (let i = 0; i < count; i++) {
      if (text[i].endsWith("// REM")) continue;
      if (text[i].endsWith("// NREM")) {
        text[i] = text[i].replace("// NREM", "");
        text[i] = text[i].replace("//", "");
      }
      const line = _c("div");
      line.id = "line" + n;
      line.className = "line";
      let txt = `«nbr»${n}¤${text[i] || "&nbsp;"}`;
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
    let hl = this.steps[this.step][2] || [];
    count = hl.length;
    for (let i = 0; i < count; i++) {
      let line;
      if (Array.isArray(hl[i])) {
        for (let j = hl[i][0]; j <= hl[i][1]; j++) {
          line = _i(`line${j}`);
          if (line) line.className = "line hl1";
        }
      } else {
        line = _i(`line${hl[i]}`);
        if (line) line.className = "line hl1";
      }
    }
    hl = this.steps[this.step][3] || [];
    count = hl.length;
    for (let i = 0; i < count; i++) {
      let line;
      if (Array.isArray(hl[i])) {
        for (let j = hl[i][0]; j <= hl[i][1]; j++) {
          line = _i(`line${j}`);
          if (line) line.className = "line hl2";
        }
      } else {
        line = _i(`line${hl[i]}`);
        if (line) line.className = "line hl2";
      }
    }
  };
}

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
  const ctx = canvas.getContext("2d", { alpha: true });
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
  const ctx = canvas.getContext("2d", { alpha: true });
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
  ctx.fillStyle = "#f8c800";
  ctx.fill();
  /* eyes */
  let x = size * 0.14;
  let y = size * 0.0;
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
  ctx.arc(-x - lash, -y - lash * 1.4, lash, CIRCLE / 4, CIRCLE / 4 + CIRCLE / 10);
  ctx.moveTo(x + lash, -y);
  ctx.arc(x + lash, -y - lash * 1.4, lash, CIRCLE / 4, CIRCLE / 4 - CIRCLE / 10, true);
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
  y = size * 0.14;
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

const init = () => {
  let font = new FontFace("hud", "url(fonts/chakra_petch.ttf)");
  font.load().then(function (font) {
    document.fonts.add(font);
  });
  font = new FontFace("hud", "url(fonts/hud.woff2)");
  font.load().then(function (font) {
    document.fonts.add(font);
  });
  generate_favicon();
  generate_logo();
  const cute_star = generate_cute_star(128);
  _i("cute_star").src = cute_star.toDataURL();
  _i("version").textContent = `v${VERSION.join(".")}`;
  _i("root").style.visibility = "visible";
  window.sfo = new Starfield();
  sfo.init();
};
