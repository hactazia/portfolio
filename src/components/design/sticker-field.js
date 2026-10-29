'use client';

/*
 * One canvas, one context, one shader pair — for every sticker on the page.
 *
 * The registry component this replaces built a WebGL context per sticker: each
 * one compiled its own programs, decoded its own logo, uploaded its own texture,
 * and ran its own animation frame. That is what made a sticker "load": a context
 * costs a few milliseconds, but swapping stickers in and out of the page cost
 * them over and over, and browsers stop serving contexts past ~16.
 *
 * Here there is a single context owned by this class. A sticker is just an entry
 * in a map — a texture reference plus its own little physics state. Logos are
 * uploaded once and shared by every sticker that uses them, and one render loop
 * updates and draws the whole pile.
 */

const GRID = 96;
const PAD = 0.18;
const MAX_TEXTURE = 1024;
const MASK_SIZE = 96;
const LIGHT_HEIGHT = 260;
const FINISHES = { gloss: 0, matte: 1, holo: 2 };
const SPEED_LIMIT = 2600;
/** Blur scratch buffers: one square, big enough for the largest sticker. */
const BLUR_SIZE = 160;

const VERTEX = `#version 300 es
in vec2 aGrid;
uniform vec2 uCanvas;
uniform vec2 uMesh;
uniform vec2 uCenter;
uniform vec2 uDir;
uniform float uFold;
uniform float uRadius;
uniform float uAngle;
uniform float uScale;
uniform float uLift;
uniform int uPass;
uniform vec2 uShadowOffset;
uniform vec2 uShadowSlope;
out vec2 vUv;
out float vFold;
out vec3 vNormal;
out vec3 vPos;
out float vHeight;
out float vCurl;
const float PI = 3.14159265;

void main() {
  vec2 local = (aGrid - 0.5) * uMesh;
  float s = dot(local, uDir);
  float d = uFold - s;
  vec3 normal = vec3(0.0, 0.0, 1.0);
  float z = 0.0;
  vec2 p = local;
  if (d > 0.0) {
    float theta = d / uRadius;
    float along = uFold + d - PI * uRadius;
    z = 2.0 * uRadius;
    normal = vec3(0.0, 0.0, -1.0);
    if (theta < PI) {
      along = uFold - uRadius * sin(theta);
      z = uRadius * (1.0 - cos(theta));
      normal = vec3(uDir * sin(theta), cos(theta));
    }
    p += (along - s) * uDir;
  }
  float c = cos(uAngle);
  float sn = sin(uAngle);
  vec2 turned = vec2(c * p.x - sn * p.y, sn * p.x + c * p.y) * uScale;
  vNormal = vec3(c * normal.x - sn * normal.y, sn * normal.x + c * normal.y, normal.z);
  vUv = aGrid;
  vFold = d;
  vCurl = z * uScale;
  float height = z * uScale + uLift;
  vec2 screen = uCenter + turned;
  float depth = 0.0;
  if (uPass == 0 || uPass == 2) {
    vHeight = uPass == 0 ? height : z * uScale;
    screen += uShadowOffset + uShadowSlope * vHeight;
  } else {
    vHeight = height;
    depth = clamp(-height / 1000.0, -1.0, 1.0);
  }
  vPos = vec3(uCenter + turned, height);
  gl_Position = vec4(screen.x / uCanvas.x * 2.0 - 1.0, 1.0 - screen.y / uCanvas.y * 2.0, depth, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uImage;
uniform int uPass;
uniform int uFinish;
uniform vec3 uBack;
uniform vec3 uLight;
uniform float uShine;
uniform float uShadow;
uniform float uTexel;
uniform float uLod;
uniform float uRadius;
uniform vec2 uGlint;
in vec2 vUv;
in float vFold;
in vec3 vNormal;
in vec3 vPos;
in float vHeight;
in float vCurl;
out vec4 outColor;

float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

vec3 spectrum(float t) {
  t = fract(t) * 6.0;
  vec3 a = vec3(1.0, 0.478, 0.46);
  vec3 b = vec3(1.0, 0.928, 0.38);
  vec3 c = vec3(0.659, 1.0, 0.38);
  vec3 d = vec3(0.52, 1.0, 0.968);
  vec3 e = vec3(0.48, 0.584, 1.0);
  vec3 f = vec3(0.68, 0.52, 1.0);
  if (t < 1.0) return mix(a, b, t);
  if (t < 2.0) return mix(b, c, t - 1.0);
  if (t < 3.0) return mix(c, d, t - 2.0);
  if (t < 4.0) return mix(d, e, t - 3.0);
  if (t < 5.0) return mix(e, f, t - 4.0);
  return mix(f, a, t - 5.0);
}

float bars(float t) {
  t = fract(t) * 12.0;
  if (t < 3.8) return mix(0.08, 0.6, t / 3.8);
  if (t < 4.5) return mix(0.6, 0.72, (t - 3.8) / 0.7);
  if (t < 5.2) return mix(0.72, 0.6, (t - 4.5) / 0.7);
  if (t < 10.0) return mix(0.6, 0.08, (t - 5.2) / 4.8);
  return 0.08;
}

void main() {
  if (uPass == 0) {
    float alpha;
    if (vFold > 0.0) {
      alpha = textureLod(uImage, vUv, log2(max(1.5 * uTexel, 1.0))).a * (1.0 - smoothstep(0.0, uRadius, vCurl));
    } else {
      alpha = textureLod(uImage, vUv, log2(max((1.2 + vHeight * 0.55) * uTexel, 1.0))).a;
    }
    outColor = vec4(0.0, 0.0, 0.0, alpha * uShadow / (1.0 + vHeight * 0.03));
    return;
  }
  if (uPass == 2) {
    if (vFold <= 0.0) discard;
    float alpha = textureLod(uImage, vUv, log2(max(uTexel, 1.0))).a * smoothstep(0.0, uRadius, vCurl);
    outColor = vec4(alpha);
    return;
  }
  if (uPass == 1 && vFold > 0.0) discard;
  if (uPass == 3 && vFold <= 0.0) discard;
  vec4 art = textureLod(uImage, vUv, uLod);
  if (art.a < 0.004) discard;
  bool front = vNormal.z >= 0.0;
  vec3 n = normalize(front ? vNormal : -vNormal);
  vec3 toLight = normalize(uLight - vPos);
  vec3 halfway = normalize(toLight + vec3(0.0, 0.0, 1.0));
  float diffuse = max(dot(n, toLight), 0.0);
  float nh = max(dot(n, halfway), 0.0);
  vec3 key = normalize(vec3(-0.45, -0.6, 0.66));
  float shade = clamp(0.5 + 0.25 * dot(n, key) / key.z + 0.25 * n.z, 0.5, front ? 1.0 : 1.08);
  if (uPass == 1) shade = 1.0;
  vec3 color;
  if (!front) {
    float grain = hash(floor(vUv * 700.0)) * 0.06 - 0.03;
    color = uBack * (0.7 + 0.3 * diffuse + grain) * art.a + vec3(pow(nh, 24.0) * 0.2 * uShine) * art.a;
  } else if (uFinish == 1) {
    color = art.rgb * (0.8 + 0.22 * diffuse) + vec3(pow(nh, 8.0) * 0.08 * uShine) * art.a;
  } else if (uFinish == 2) {
    vec3 albedo = art.rgb / art.a;
    float lum = dot(albedo, vec3(0.299, 0.587, 0.114));
    float foil = smoothstep(0.5, 0.92, lum);
    vec2 q = vUv - uGlint;
    float near = exp(-dot(q, q) * 3.0);
    float tilt = dot(n.xy, vec2(0.6, 0.8)) * 1.6;
    vec3 rainbow = spectrum((vUv.x + vUv.y) * 0.85 - (uGlint.x + uGlint.y) * 1.2 + tilt);
    float streak = bars((vUv.x - vUv.y) * 2.6 + uGlint.x * 1.8 - uGlint.y * 0.6 + tilt * 0.5);
    float band = smoothstep(0.32, 0.7, streak);
    vec3 silver = vec3(0.8, 0.82, 0.86) * (0.88 + 0.16 * diffuse);
    vec3 film = mix(silver, rainbow * 1.08, clamp(band * (0.55 + 0.45 * near) + 0.18 * near, 0.0, 1.0));
    vec3 ink = albedo * (0.86 + 0.14 * diffuse) + rainbow * band * 0.22 * (0.4 + 0.6 * near);
    vec3 base = mix(albedo * (0.86 + 0.14 * diffuse), mix(ink, film, foil), uShine * 0.6 + 0.4);
    vec2 cell = floor(vUv * 180.0);
    vec2 jitter = vec2(hash(cell), hash(cell + 7.3)) * 0.6 + 0.2;
    float dist = length(fract(vUv * 180.0) - jitter);
    vec3 facet = normalize(vec3(vec2(hash(cell + 2.1), hash(cell + 5.7)) * 2.0 - 1.0, 1.6));
    float glint = pow(max(dot(facet, halfway), 0.0), 60.0) * smoothstep(0.32, 0.05, dist) * step(0.55, hash(cell + 3.1)) * (0.15 + 0.85 * foil);
    color = (base + spectrum(hash(cell) + uGlint.x) * glint * 1.6 * uShine + vec3(pow(nh, 140.0) * 0.4 * uShine)) * art.a;
  } else {
    color = art.rgb * (0.86 + 0.16 * diffuse) + vec3(pow(nh, 220.0) * 0.4 + pow(nh, 24.0) * 0.03) * uShine * art.a;
  }
  float bend = uPass == 3 ? smoothstep(0.0, uRadius * 0.6, vCurl) : 0.0;
  float glare = pow(max(dot(n, normalize(key + vec3(0.0, 0.0, 1.0))), 0.0), 28.0) * bend * (0.18 + 0.3 * uShine);
  outColor = vec4(min(color * shade + vec3(glare) * art.a, vec3(art.a)), art.a);
}`;

const POST_VERTEX = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const POST_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform vec2 uStep;
uniform float uSigma;
uniform float uStrength;
uniform int uMode;
in vec2 vUv;
out vec4 outColor;

void main() {
  if (uMode == 1) {
    outColor = vec4(0.0, 0.0, 0.0, texture(uSource, vUv).a * uStrength);
    return;
  }
  vec4 sum = vec4(0.0);
  float total = 0.0;
  for (int i = -8; i <= 8; i++) {
    float offset = float(i);
    float weight = exp(-0.5 * offset * offset / (uSigma * uSigma));
    sum += texture(uSource, vUv + uStep * offset) * weight;
    total += weight;
  }
  outColor = sum / total;
}`;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
const toRadians = (degrees) => (degrees * Math.PI) / 180;
const toDegrees = (radians) => (radians * 180) / Math.PI;

const spring = (state, key, target, frequency, damping, dt) => {
  const omega = 2 * Math.PI * frequency;
  const velocity = `${key}V`;
  state[velocity] += (omega * omega * (target - state[key]) - 2 * damping * omega * state[velocity]) * dt;
  state[key] += state[velocity] * dt;
};

const compile = (gl, type, source) => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
};

const link = (gl, vertexSource, fragmentSource) => {
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.bindAttribLocation(program, 0, 'aGrid');
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  const uniforms = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    if (info) uniforms[info.name] = gl.getUniformLocation(program, info.name);
  }
  return { program, uniforms };
};

const convexHull = (points) => {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length < 3) return sorted;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  sorted.forEach((point) => {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
    lower.push(point);
  });
  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const point = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
    upper.push(point);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
};

/*
 * Rasterising an SVG, reading its pixels back, flood-filling the silhouette and
 * hulling it is the part that used to be paid per mount. It only depends on the
 * image, so it is memoised per source — shared by every sticker and every
 * remount for the lifetime of the page.
 */
const assetCache = new Map();
const assetPending = new Map();

const buildAsset = (image) => {
  const iw = image.naturalWidth || 1;
  const ih = image.naturalHeight || 1;
  const fit = Math.min(1, MAX_TEXTURE / (Math.max(iw, ih) * (1 + 2 * PAD)));
  const w = Math.max(1, Math.round(iw * fit));
  const h = Math.max(1, Math.round(ih * fit));
  const padX = Math.round(w * PAD);
  const padY = Math.round(h * PAD);

  const bitmap = document.createElement('canvas');
  bitmap.width = w + padX * 2;
  bitmap.height = h + padY * 2;
  bitmap.getContext('2d').drawImage(image, padX, padY, w, h);

  const maskW = Math.max(8, Math.round(MASK_SIZE * Math.min(1, iw / ih)));
  const maskH = Math.max(8, Math.round(MASK_SIZE * Math.min(1, ih / iw)));
  const probe = document.createElement('canvas');
  probe.width = maskW;
  probe.height = maskH;
  const probeContext = probe.getContext('2d', { willReadFrequently: true });
  probeContext.drawImage(image, 0, 0, maskW, maskH);
  const pixels = probeContext.getImageData(0, 0, maskW, maskH).data;

  const mask = new Uint8Array(maskW * maskH).fill(255);
  const queue = [];
  const visit = (x, y) => {
    const i = y * maskW + x;
    if (mask[i] === 0 || pixels[i * 4 + 3] > 100) return;
    mask[i] = 0;
    queue.push(i);
  };
  for (let x = 0; x < maskW; x += 1) {
    visit(x, 0);
    visit(x, maskH - 1);
  }
  for (let y = 0; y < maskH; y += 1) {
    visit(0, y);
    visit(maskW - 1, y);
  }
  while (queue.length) {
    const i = queue.pop();
    const x = i % maskW;
    const y = (i - x) / maskW;
    if (x > 0) visit(x - 1, y);
    if (x < maskW - 1) visit(x + 1, y);
    if (y > 0) visit(x, y - 1);
    if (y < maskH - 1) visit(x, y + 1);
  }

  const points = [];
  for (let y = 0; y < maskH; y += 1) {
    for (let x = 0; x < maskW; x += 1) {
      if (pixels[(y * maskW + x) * 4 + 3] > 127) points.push([(x + 0.5) / maskW - 0.5, (y + 0.5) / maskH - 0.5]);
    }
  }

  return {
    bitmap,
    mask,
    maskW,
    maskH,
    hull: convexHull(points),
    aspect: ih / iw,
    meshX: bitmap.width / w,
    meshY: bitmap.height / h,
    texel: bitmap.width,
  };
};

const prepareAsset = (src) => {
  const inflight = assetPending.get(src);
  if (inflight) return inflight;

  const job = new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onerror = () => {
      assetPending.delete(src);
      reject(new Error(`StickerField: cannot load ${src}`));
    };
    image.onload = () => {
      try {
        const asset = buildAsset(image);
        createImageBitmap(asset.bitmap).then(
          (bitmap) => resolve({ ...asset, image: bitmap }),
          () => resolve(asset),
        );
      } catch (error) {
        assetPending.delete(src);
        reject(error);
      }
    };
    image.src = src;
  });

  assetPending.set(src, job);
  job.catch(() => assetPending.delete(src));
  return job;
};

/** Warms every logo while the browser is idle, so nothing is decoded on hover. */
export const preloadStickerAssets = (sources = []) => {
  const pending = [...new Set(sources)].filter((src) => src && !assetCache.has(src));
  if (!pending.length) return;

  const idle =
    typeof window !== 'undefined' && window.requestIdleCallback
      ? (callback) => window.requestIdleCallback(callback, { timeout: 600 })
      : (callback) => setTimeout(callback, 32);

  const step = (index) => {
    if (index >= pending.length) return;
    prepareAsset(pending[index])
      .then((asset) => assetCache.set(pending[index], asset))
      .catch(() => {})
      .finally(() => idle(() => step(index + 1)));
  };

  idle(() => step(0));
};

/**
 * Every sticker on the page, drawn by one GL context.
 *
 * Positions are kept in *document* coordinates, so a sticker stays where it was
 * thrown when the page scrolls; the canvas itself is viewport-sized and pinned,
 * and each draw offsets by the current scroll.
 */
export class StickerField {
  constructor(canvas, { bounds }) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      desynchronized: true,
      depth: true,
      stencil: false,
    });
    this.stickers = new Map();
    this.textures = new Map();
    this.bounds = bounds ?? { width: 1, height: 1 };
    this.pointer = { x: 0, y: 0, inside: false };
    this.scrollY = 0;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.raf = 0;
    this.last = 0;
    this.alive = true;
    this.reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.back = [0.83, 0.83, 0.85];
    // A hidden tab pauses animation frames: coming back has to repaint.
    this.onVisible = () => {
      if (document.hidden) return;
      this.last = 0;
      this.wake();
    };
    document.addEventListener('visibilitychange', this.onVisible);

    const gl = this.gl;
    if (!gl) return;

    this.program = link(gl, VERTEX, FRAGMENT);
    this.post = link(gl, POST_VERTEX, POST_FRAGMENT);
    if (!this.program || !this.post) return;
    this.u = this.program.uniforms;
    this.pu = this.post.uniforms;

    this.targets = [0, 1].map(() => ({
      texture: gl.createTexture(),
      buffer: gl.createFramebuffer(),
      width: BLUR_SIZE,
      height: BLUR_SIZE,
    }));
    this.targets.forEach((target) => {
      gl.bindTexture(gl.TEXTURE_2D, target.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, BLUR_SIZE, BLUR_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.buffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.texture, 0);
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const vertices = new Float32Array((GRID + 1) * (GRID + 1) * 2);
    for (let y = 0; y <= GRID; y += 1) {
      for (let x = 0; x <= GRID; x += 1) {
        const i = (y * (GRID + 1) + x) * 2;
        vertices[i] = x / GRID;
        vertices[i + 1] = y / GRID;
      }
    }
    const indices = new Uint16Array(GRID * GRID * 6);
    let cursor = 0;
    for (let y = 0; y < GRID; y += 1) {
      for (let x = 0; x < GRID; x += 1) {
        const a = y * (GRID + 1) + x;
        const b = a + 1;
        const c = a + GRID + 1;
        const d = c + 1;
        indices.set([a, b, d, a, d, c], cursor);
        cursor += 6;
      }
    }
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    this.count = GRID * GRID * 6;

    this.resize();
    this.wake();
  }

  /* ---------------------------------------------------------------- canvas */

  resize() {
    if (!this.gl) return;
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (width === this.cssWidth && height === this.cssHeight && ratio === this.dpr) return;
    this.cssWidth = width;
    this.cssHeight = height;
    this.dpr = ratio;
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.wake();
  }

  setBounds(bounds) {
    this.bounds = bounds;
  }

  setScroll(scrollY) {
    if (scrollY === this.scrollY) return;
    this.scrollY = scrollY;
    this.wake();
  }

  /* -------------------------------------------------------------- stickers */

  /**
   * Registers a sticker once.
   *
   * Deliberately idempotent: React re-runs the effect that feeds the field
   * whenever its own state changes, and re-adding would drag a sticker back to
   * its seat — and, worse, re-upload a texture that is already on the GPU.
   */
  add(id, { src, width, rotate = 0, x, y }) {
    if (!this.gl || this.stickers.has(id)) return;
    const sticker = {
      id,
      src,
      width: Math.max(16, width),
      rotate: toRadians(rotate),
      x,
      y,
      vx: 0,
      vy: 0,
      swing: 0,
      swingV: 0,
      peel: 0,
      peelV: 0,
      lift: 0,
      liftV: 0,
      dir: 0,
      hover: false,
      local: { x: 0, y: 0 },
      press: null,
      pivotV: { x: 0, y: 0 },
      light: { x: 0, y: 0, z: LIGHT_HEIGHT },
      painted: false,
    };
    this.stickers.set(id, sticker);
    this.ensureTexture(sticker);
    this.wake();
  }

  position(id) {
    const sticker = this.stickers.get(id);
    if (!sticker) return null;
    return { x: sticker.x, y: sticker.y, rotate: toDegrees(sticker.rotate + sticker.swing) };
  }

  /** True once the sticker is at rest: nothing left to animate. */
  settled(id) {
    const sticker = this.stickers.get(id);
    if (!sticker) return true;
    return (
      !sticker.press &&
      sticker.vx === 0 &&
      sticker.vy === 0 &&
      Math.abs(sticker.swing) < 0.002 &&
      Math.abs(sticker.swingV) < 0.002 &&
      Math.abs(sticker.peel) < 0.002 &&
      Math.abs(sticker.peelV) < 0.002 &&
      Math.abs(sticker.lift) < 0.002 &&
      Math.abs(sticker.liftV) < 0.002
    );
  }

  paintedIds() {
    return [...this.stickers.values()].filter((sticker) => sticker.painted).map((sticker) => sticker.id);
  }

  /* ------------------------------------------------------------ pointers */

  pointerMove(clientX, clientY, inside = true) {
    this.pointer.x = clientX + window.scrollX;
    this.pointer.y = clientY + this.scrollY;
    this.pointer.inside = inside;
    for (const sticker of this.stickers.values()) {
      if (sticker.press) continue;
      const local = this.toLocal(sticker, this.pointer.x, this.pointer.y);
      sticker.local = local;
      sticker.hover = this.solid(sticker, local);
    }
    this.wake();
  }

  press(id, clientX, clientY) {
    const sticker = this.stickers.get(id);
    if (!sticker) return false;
    const x = clientX + window.scrollX;
    const y = clientY + this.scrollY;
    const local = this.toLocal(sticker, x, y);
    sticker.local = local;
    sticker.hover = this.solid(sticker, local);
    if (!sticker.hover) return false;
    sticker.press = {
      grab: local,
      origin: { x, y },
      pointer: { x, y },
      pivot: { x, y },
      moving: false,
      samples: [{ x, y, t: performance.now() }],
    };
    sticker.pivotV = { x: 0, y: 0 };
    sticker.vx = 0;
    sticker.vy = 0;
    this.wake();
    return true;
  }

  drag(id, clientX, clientY) {
    const sticker = this.stickers.get(id);
    if (!sticker?.press) return;
    const x = clientX + window.scrollX;
    const y = clientY + this.scrollY;
    const press = sticker.press;
    press.pointer = { x, y };
    if (!press.moving && Math.hypot(x - press.origin.x, y - press.origin.y) > 3) press.moving = true;
    press.samples.push({ x, y, t: performance.now() });
    if (press.samples.length > 8) press.samples.shift();
    this.wake();
  }

  /** Releases the press; returns true when it was a throw rather than a click. */
  release(id) {
    const sticker = this.stickers.get(id);
    const press = sticker?.press;
    if (!sticker || !press) return false;
    sticker.press = null;
    const now = performance.now();
    const recent = press.samples.filter((sample) => now - sample.t < 90);
    if (press.moving && recent.length > 1 && !this.reduce) {
      const a = recent[0];
      const b = recent[recent.length - 1];
      const span = Math.max(b.t - a.t, 16) / 1000;
      sticker.vx = clamp((b.x - a.x) / span, -SPEED_LIMIT, SPEED_LIMIT);
      sticker.vy = clamp((b.y - a.y) / span, -SPEED_LIMIT, SPEED_LIMIT);
    }
    this.wake();
    return press.moving;
  }

  /* --------------------------------------------------------------- internals */

  ensureTexture(sticker) {
    const gl = this.gl;
    const cached = this.textures.get(sticker.src);
    if (cached) {
      sticker.texture = cached;
      return;
    }
    const prepared = assetCache.get(sticker.src);
    const texture = { ready: false, texture: gl.createTexture() };
    this.textures.set(sticker.src, texture);
    sticker.texture = texture;

    const upload = (asset) => {
      if (!this.alive) return;
      gl.bindTexture(gl.TEXTURE_2D, texture.texture);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, asset.image ?? asset.bitmap);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      texture.mask = asset.mask;
      texture.maskW = asset.maskW;
      texture.maskH = asset.maskH;
      texture.hull = asset.hull;
      texture.aspect = asset.aspect;
      texture.meshX = asset.meshX;
      texture.meshY = asset.meshY;
      texture.texel = asset.texel;
      texture.ready = true;
      this.wake();
    };

    if (prepared) {
      upload(prepared);
      return;
    }
    prepareAsset(sticker.src)
      .then((asset) => {
        assetCache.set(sticker.src, asset);
        upload(asset);
      })
      .catch(() => {});
  }

  height(sticker) {
    return sticker.width * (sticker.texture?.aspect ?? 1);
  }

  toLocal(sticker, x, y) {
    const angle = -(sticker.rotate + sticker.swing);
    const scale = 1 + 0.07 * Math.max(0, sticker.lift);
    const dx = x - sticker.x;
    const dy = y - sticker.y;
    return {
      x: (Math.cos(angle) * dx - Math.sin(angle) * dy) / scale,
      y: (Math.sin(angle) * dx + Math.cos(angle) * dy) / scale,
    };
  }

  solid(sticker, local) {
    const texture = sticker.texture;
    if (!texture?.mask) return false;
    const mx = Math.floor((local.x / sticker.width + 0.5) * texture.maskW);
    const my = Math.floor((local.y / this.height(sticker) + 0.5) * texture.maskH);
    if (mx < 0 || my < 0 || mx >= texture.maskW || my >= texture.maskH) return false;
    return texture.mask[my * texture.maskW + mx] > 100;
  }

  reach(sticker) {
    const angle = sticker.rotate + sticker.swing;
    const grow = 1 + 0.07 * Math.max(0, sticker.lift);
    const w = (sticker.width / 2) * grow;
    const h = (this.height(sticker) / 2) * grow;
    const c = Math.abs(Math.cos(angle));
    const s = Math.abs(Math.sin(angle));
    return { x: w * c + h * s, y: w * s + h * c };
  }

  confine(sticker) {
    const half = this.reach(sticker);
    const { width, height } = this.bounds;
    const minX = Math.min(half.x, width / 2);
    const maxX = Math.max(width - half.x, width / 2);
    const minY = Math.min(half.y, height / 2);
    const maxY = Math.max(height - half.y, height / 2);
    if (sticker.x < minX) sticker.x = minX;
    else if (sticker.x > maxX) sticker.x = maxX;
    if (sticker.y < minY) sticker.y = minY;
    else if (sticker.y > maxY) sticker.y = maxY;
  }

  extentAlong(sticker, dx, dy) {
    const w = sticker.width;
    const h = this.height(sticker);
    const hull = sticker.texture?.hull ?? [];
    if (!hull.length) {
      const half = (Math.abs(dx) * w + Math.abs(dy) * h) / 2;
      return [-half, half];
    }
    let min = Infinity;
    let max = -Infinity;
    for (const [px, py] of hull) {
      const value = px * w * dx + py * h * dy;
      if (value < min) min = value;
      if (value > max) max = value;
    }
    return [min, max];
  }

  update(dt) {
    const pointer = this.pointer;
    for (const sticker of this.stickers.values()) {
      const h = this.height(sticker);
      const press = sticker.press;
      const drag = press?.moving ? press : null;

      if (drag) {
        const target = drag.pointer;
        const prev = drag.pivot;
        const smoothing = 1 - Math.exp(-dt / 0.045);
        const vx = sticker.pivotV.x + ((target.x - prev.x) / dt - sticker.pivotV.x) * smoothing;
        const vy = sticker.pivotV.y + ((target.y - prev.y) / dt - sticker.pivotV.y) * smoothing;
        const ax = (vx - sticker.pivotV.x) / dt;
        const ay = (vy - sticker.pivotV.y) / dt;
        sticker.pivotV.x = vx;
        sticker.pivotV.y = vy;
        drag.pivot = { x: target.x, y: target.y };
        const angle = sticker.rotate + sticker.swing;
        const rx = -(Math.cos(angle) * drag.grab.x - Math.sin(angle) * drag.grab.y);
        const ry = -(Math.sin(angle) * drag.grab.x + Math.cos(angle) * drag.grab.y);
        const inertia = (sticker.width * sticker.width + h * h) / 12 + rx * rx + ry * ry;
        const torque = (rx * -clamp(ay, -24000, 24000) - ry * -clamp(ax, -24000, 24000)) / inertia;
        const omega = 2 * Math.PI * 1.5;
        sticker.swingV += (torque * 1.1 - omega * omega * sticker.swing - 2 * 0.45 * omega * sticker.swingV) * dt;
        sticker.swing = clamp(sticker.swing + sticker.swingV * dt, -1.2, 1.2);
        const turned = sticker.rotate + sticker.swing;
        const grip = 1 + 0.07 * Math.max(0, sticker.lift);
        sticker.x = target.x - (Math.cos(turned) * drag.grab.x - Math.sin(turned) * drag.grab.y) * grip;
        sticker.y = target.y - (Math.sin(turned) * drag.grab.x + Math.cos(turned) * drag.grab.y) * grip;
        this.confine(sticker);
      } else {
        spring(sticker, 'swing', 0, 1.4, 0.32, dt);
        const decay = Math.exp(-dt * (1.5 + 9 * 0.45));
        sticker.vx *= decay;
        sticker.vy *= decay;
        if (Math.hypot(sticker.vx, sticker.vy) < 4) {
          sticker.vx = 0;
          sticker.vy = 0;
        }
        sticker.x += sticker.vx * dt;
        sticker.y += sticker.vy * dt;
        this.confine(sticker);
      }

      const peelTarget = press ? 0.46 : sticker.hover ? 0.28 : 0;
      spring(sticker, 'peel', peelTarget, press || sticker.hover ? 3 : 3.6, press || sticker.hover ? 0.7 : 0.62, dt);
      spring(sticker, 'lift', drag ? 1 : 0, 3.2, 0.55, dt);

      let dirTarget = 0;
      if (press && Math.hypot(press.grab.x, press.grab.y) > Math.min(sticker.width, h) * 0.12) {
        dirTarget = Math.atan2(press.grab.x, -press.grab.y);
      } else if (sticker.hover && Math.hypot(sticker.local.x, sticker.local.y) > Math.min(sticker.width, h) * 0.12) {
        dirTarget = Math.atan2(sticker.local.x, -sticker.local.y);
      }
      sticker.dir += wrapAngle(dirTarget - sticker.dir) * (1 - Math.exp(-dt / 0.12));

      const lightTarget = pointer.inside
        ? { x: pointer.x, y: pointer.y, z: LIGHT_HEIGHT }
        : { x: sticker.x - sticker.width * 0.45, y: sticker.y - h * 0.9, z: LIGHT_HEIGHT * 1.6 };
      const follow = 1 - Math.exp(-dt / 0.08);
      sticker.light.x += (lightTarget.x - sticker.light.x) * follow;
      sticker.light.y += (lightTarget.y - sticker.light.y) * follow;
      sticker.light.z += (lightTarget.z - sticker.light.z) * follow;
    }
  }

  moving() {
    const pointer = this.pointer;
    for (const sticker of this.stickers.values()) {
      if (sticker.press) return true;
      if (
        sticker.vx !== 0 ||
        sticker.vy !== 0 ||
        Math.abs(sticker.swing) > 0.0005 ||
        Math.abs(sticker.swingV) > 0.0005 ||
        Math.abs(sticker.peel) > 0.0005 ||
        Math.abs(sticker.peelV) > 0.0005 ||
        Math.abs(sticker.lift) > 0.0005 ||
        Math.abs(sticker.liftV) > 0.0005 ||
        Math.abs(sticker.dir) > 0.002
      ) {
        return true;
      }
      if (pointer.inside) {
        const target = sticker.light;
        const dx = pointer.x - target.x;
        const dy = pointer.y - target.y;
        if (Math.hypot(dx, dy) > 0.5) return true;
      }
    }
    return false;
  }

  drawSticker(sticker, originX, originY) {
    const gl = this.gl;
    const u = this.u;
    const texture = sticker.texture;
    if (!texture?.ready) return false;
    const w = sticker.width;
    const h = this.height(sticker);
    const cx = sticker.x - originX;
    const cy = sticker.y - originY;
    const pad = Math.max(w, h) * 0.9 + 80;
    if (cx < -pad || cy < -pad || cx > this.cssWidth + pad || cy > this.cssHeight + pad) return false;

    const dx = -Math.sin(sticker.dir);
    const dy = Math.cos(sticker.dir);
    const [start, end] = this.extentAlong(sticker, dx, dy);
    const peel = clamp(sticker.peel, 0, 1);
    const fold = start + peel * (end - start);
    const angle = sticker.rotate + sticker.swing;
    const scale = 1 + 0.07 * Math.max(0, sticker.lift);
    const lift = Math.max(0, sticker.lift);
    const peeled = peel > 0.001;

    gl.useProgram(this.program.program);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture.texture);
    gl.uniform1i(u.uImage, 0);
    gl.uniform2f(u.uCanvas, this.cssWidth, this.cssHeight);
    gl.uniform2f(u.uMesh, w * texture.meshX, h * texture.meshY);
    gl.uniform2f(u.uCenter, cx, cy);
    gl.uniform2f(u.uDir, dx, dy);
    gl.uniform1f(u.uFold, fold);
    gl.uniform1f(u.uRadius, 14);
    gl.uniform1f(u.uAngle, angle);
    gl.uniform1f(u.uScale, scale);
    gl.uniform1f(u.uLift, lift * 26);
    gl.uniform2f(u.uShadowOffset, 1.2, 2.4);
    gl.uniform2f(u.uShadowSlope, 0.28, 0.55);
    gl.uniform1i(u.uFinish, FINISHES.gloss);
    gl.uniform3fv(u.uBack, this.back);
    gl.uniform3f(u.uLight, sticker.light.x - sticker.x + cx, sticker.light.y - sticker.y + cy, sticker.light.z);
    gl.uniform1f(u.uShine, 0.55);
    gl.uniform1f(u.uShadow, 0.7 * 0.55);
    gl.uniform1f(u.uTexel, texture.texel / (w * texture.meshX));
    gl.uniform1f(u.uLod, Math.max(0, Math.log2(texture.texel / (w * texture.meshX * scale * this.dpr))));
    const glint = this.toLocal(sticker, sticker.light.x, sticker.light.y);
    gl.uniform2f(u.uGlint, glint.x / (w * texture.meshX) + 0.5, glint.y / (h * texture.meshY) + 0.5);

    gl.disable(gl.DEPTH_TEST);
    if (peeled) {
      const [first, second] = this.targets;
      gl.bindFramebuffer(gl.FRAMEBUFFER, first.buffer);
      gl.viewport(0, 0, first.width, first.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.disable(gl.BLEND);
      gl.uniform1i(u.uPass, 2);
      gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
      gl.useProgram(this.post.program);
      const pu = this.pu;
      gl.uniform1i(pu.uSource, 1);
      gl.uniform1i(pu.uMode, 0);
      gl.uniform1f(pu.uSigma, Math.min(4, (2.5 + 14 * 0.15) / 2));
      gl.activeTexture(gl.TEXTURE1);
      gl.bindFramebuffer(gl.FRAMEBUFFER, second.buffer);
      gl.bindTexture(gl.TEXTURE_2D, first.texture);
      gl.uniform2f(pu.uStep, 1 / first.width, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, first.buffer);
      gl.bindTexture(gl.TEXTURE_2D, second.texture);
      gl.uniform2f(pu.uStep, 0, 1 / first.height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.useProgram(this.program.program);
      gl.activeTexture(gl.TEXTURE0);
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform1i(u.uPass, 0);
    gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    gl.uniform1i(u.uPass, 1);
    gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    if (peeled) {
      gl.useProgram(this.post.program);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.targets[0].texture);
      gl.uniform1i(this.pu.uMode, 1);
      gl.uniform1f(this.pu.uStrength, 0.7 * 0.6);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.useProgram(this.program.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LESS);
      gl.uniform1i(u.uPass, 3);
      gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
      gl.disable(gl.DEPTH_TEST);
    }
    return true;
  }

  frame = (now) => {
    this.raf = 0;
    if (!this.alive || !this.gl) return;
    const dt = this.last ? clamp((now - this.last) / 1000, 0.001, 1 / 30) : 1 / 60;
    this.last = now;

    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    this.update(dt);
    for (const sticker of this.stickers.values()) {
      if (this.drawSticker(sticker, window.scrollX, this.scrollY)) sticker.painted = true;
    }

    if (this.moving()) this.raf = requestAnimationFrame(this.frame);
    else this.last = 0;
  };

  wake() {
    if (!this.alive || !this.gl || this.raf) return;
    if (document.hidden) return;
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    this.alive = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    document.removeEventListener('visibilitychange', this.onVisible);
    const gl = this.gl;
    if (!gl) return;
    for (const texture of this.textures.values()) gl.deleteTexture(texture.texture);
    this.targets.forEach((target) => {
      gl.deleteTexture(target.texture);
      gl.deleteFramebuffer(target.buffer);
    });
    if (this.program) gl.deleteProgram(this.program.program);
    if (this.post) gl.deleteProgram(this.post.program);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

export default StickerField;
