// Shared GLSL chunk: preset helpers, all preset functions, and the
// `computePreset(id, fi, cnt, time, c0..c7, out pos, out col)` dispatcher.
//
// The chunk depends on these uniforms being declared by the caller:
//   uniform sampler2D uModelTex0..3;
//   uniform float     uModelCount0..3;
//   uniform float     uCarLaneOffset;
//   uniform float     uCarLaneActivity;
//   uniform float     uCarPosY;
//
// The `id` passed to `computePreset` is the ShaderId enum from
// `particle-boot.ts` (SHADER_ID_TO_INT). Keep that map and this file's
// dispatch branches in sync.
//
// This is the space / universe theme: a deep-space starfield flythrough, an
// alien spacecraft, an astronaut, a ringed planet, and a galaxy. Every scene
// is generated procedurally from the particle index, so no point-cloud models
// are needed (the model samplers stay declared but unused).

export const MODEL_TEX_W = 512;
export const MODEL_TEX_H = 256;

export const PRESET_GLSL = /* glsl */ `
  /* == helpers ============================================= */

  vec3 hsl2rgb(float h, float s, float l) {
    float c = (1.0 - abs(2.0 * l - 1.0)) * s;
    float hp = h * 6.0;
    float x = c * (1.0 - abs(mod(hp, 2.0) - 1.0));
    float m = l - c * 0.5;
    vec3 rgb;
    if      (hp < 1.0) rgb = vec3(c, x, 0.0);
    else if (hp < 2.0) rgb = vec3(x, c, 0.0);
    else if (hp < 3.0) rgb = vec3(0.0, c, x);
    else if (hp < 4.0) rgb = vec3(0.0, x, c);
    else if (hp < 5.0) rgb = vec3(x, 0.0, c);
    else               rgb = vec3(c, 0.0, x);
    return rgb + m;
  }

  float grHash(float fi, float k) {
    float hi = floor(fi * 0.0078125);
    float lo = fi - hi * 128.0;
    return fract(fract(hi * fract(128.0 * k)) + fract(lo * k));
  }

  float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
  }

  vec3 brandGradient(float ratio, float t) {
    float hue = fract(ratio + t * 0.51);
    float sat = 0.8 + sin(t + ratio * 10.0) * 0.2;
    float lum = 0.55 + 0.35 * cos(t + ratio * 3.14159);
    return hsl2rgb(hue, clamp(sat, 0.5, 1.0), clamp(lum, 0.2, 0.85));
  }

  vec3 sampleModelTex(sampler2D tex, float cnt, float fi) {
    float idx = (cnt > 0.0) ? mod(fi, cnt) : 0.0;
    float u = (mod(idx, ${MODEL_TEX_W}.0) + 0.5) / ${MODEL_TEX_W}.0;
    float v = (floor(idx / ${MODEL_TEX_W}.0) + 0.5) / ${MODEL_TEX_H}.0;
    return texture(tex, vec2(u, v)).xyz;
  }

  // A point on the unit sphere from two 0..1 samples (uniform by area).
  vec3 onSphere(float u, float v) {
    float ct = 2.0 * u - 1.0;
    float st = sqrt(max(0.0, 1.0 - ct * ct));
    float ph = v * 6.28318530718;
    return vec3(st * cos(ph), ct, st * sin(ph));
  }

  // Rotate a point about the Y axis.
  vec3 rotY(vec3 p, float a) {
    float c = cos(a), s = sin(a);
    return vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);
  }

  // Rotate a point about the X axis.
  vec3 rotX(vec3 p, float a) {
    float c = cos(a), s = sin(a);
    return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
  }

  /* == preset 0: Deep-space starfield flythrough (hero) ==== */

  void presetRacetrack(float fi, int cnt, float time,
    float c0, float c1, float c2, float c3,
    float c4, float c5, float c6, float c7,
    out vec3 pos, out vec3 col)
  {
    float speed = c0 + c7;
    float fcnt = float(cnt);
    int idx = int(fi);

    // 82 percent streaming stars, 18 percent drifting nebula dust.
    int nebStart = int(floor(fcnt * 0.82));

    if (idx < nebStart) {
      float depth = 320.0;
      float zNear = 72.0;
      float zFar = zNear - depth;

      // Each star cycles forward in z over time, wrapping when it passes.
      float phase = grHash(fi, 0.6180339887);
      float cyc = fract(phase + time * speed * 0.028);
      float zc = zFar + cyc * depth;
      float near01 = cyc;

      // Radial layout so stars stream outward as they approach the camera.
      float ang = grHash(fi, 0.3571) * 6.28318530718;
      float rad = 6.0 + grHash(fi, 0.9137) * 150.0;
      float expand = 0.55 + near01 * near01 * 0.9;
      float x = cos(ang) * rad * expand;
      float y = sin(ang) * rad * expand;
      pos = vec3(x, y, zc);

      float temp = grHash(fi, 0.2917);
      float hue = mix(0.55, 0.70, temp);
      float sat = 0.25 + 0.35 * (1.0 - near01);
      float lumBoost = 1.0;
      // Baryonic-gas temperature scale: recolour ~45% of the stars (the field
      // stays majority white) in realistic proportions, the hottest gas being
      // rarest. Hottest, densest gas reads bright white-gold, warm-hot filament
      // gas orange-red, cold void gas blue-violet. An independent hash keeps
      // this a clean, still-minority slice.
      float tcol = grHash(fi, 0.417);
      if (tcol > 0.960)      { hue = 0.14;  sat = max(sat, 0.60); lumBoost = 1.6; } // ~4% hottest: white-gold
      else if (tcol > 0.840) { hue = 0.045; sat = max(sat, 0.85); lumBoost = 1.25; } // ~12% warm-hot: orange-red
      else if (tcol > 0.550) { hue = 0.71;  sat = max(sat, 0.65); }                // ~29% cold void: blue-violet
      float twinkle = 0.8 + 0.2 * sin(time * (2.0 + grHash(fi, 0.51) * 6.0) + fi * 1.31);
      float bright = pow(near01, 1.6) * (0.45 + 0.55 * grHash(fi, 0.77));
      float lum = (0.12 + 0.9 * bright) * twinkle * lumBoost;
      col = hsl2rgb(hue, sat, clamp(lum, 0.0, 1.0));

    } else {
      float ni = float(idx - nebStart);
      float cluster = floor(grHash(ni, 0.19) * 5.0);
      vec3 cc = vec3(
        sin(cluster * 1.7) * 66.0,
        cos(cluster * 2.3) * 30.0 - 4.0,
        -55.0 - cluster * 26.0
      );
      float r = grHash(ni, 0.41);
      vec3 dir = onSphere(grHash(ni, 0.73), grHash(ni, 0.29));
      vec3 off = dir * pow(r, 0.5) * 48.0;
      float sw = time * 0.05;
      float ox = off.x * cos(sw) - off.z * sin(sw);
      float oz = off.x * sin(sw) + off.z * cos(sw);
      pos = cc + vec3(ox, off.y, oz);
      float hue = fract(0.74 + cluster * 0.07 + r * 0.12);
      float lum = 0.04 + 0.09 * (1.0 - r);
      col = hsl2rgb(hue, 0.72, lum);
    }
  }

  /* == preset 1: Alien spacecraft (saucer) ================ */

  void presetRacecar(float fi, int cnt, float time,
    float c0, float c1, float c2, float c3,
    float c4, float c5, float c6, float c7,
    out vec3 pos, out vec3 col)
  {
    float scale = c0;
    float spin = c1;
    float fcnt = float(cnt);
    int idx = int(fi);

    int rimEnd = int(floor(fcnt * 0.16));
    int domeEnd = rimEnd + int(floor(fcnt * 0.20));
    float R = 1.0;
    vec3 p;
    vec3 c;

    if (idx < rimEnd) {
      // Ring of running lights under the hull rim.
      float ri = float(idx);
      float th = grHash(ri, 0.618) * 6.28318530718;
      float rr = R * 1.03;
      p = vec3(cos(th) * rr, -0.03 + sin(th * 9.0) * 0.012, sin(th) * rr);
      float seg = floor(th / 6.28318530718 * 22.0);
      float pulse = 0.5 + 0.5 * sin(time * 3.2 + seg * 1.7);
      float hue = mix(0.50, 0.86, hash11(seg));
      c = hsl2rgb(hue, 0.95, 0.32 + 0.5 * pulse);

    } else if (idx < domeEnd) {
      // Glass dome cockpit (upper cap, tighter radius).
      float di = float(idx - rimEnd);
      float u = grHash(di, 0.618);
      float v = grHash(di, 0.271);
      float rd = 0.44;
      float phi = acos(mix(0.12, 1.0, u));
      float th = v * 6.28318530718;
      float sr = rd * sin(phi);
      p = vec3(cos(th) * sr, rd * cos(phi) * 0.92 + 0.13, sin(th) * sr);
      c = hsl2rgb(0.52, 0.55, 0.42 + 0.22 * cos(phi));

    } else {
      // Biconvex hull lens.
      float hi = float(idx - domeEnd);
      float rr = sqrt(grHash(hi, 0.618)) * R;
      float th = grHash(hi, 0.271) * 6.28318530718;
      float top = step(0.5, hash11(hi * 1.7));
      float k = 1.0 - (rr / R) * (rr / R);
      float yy = (top > 0.5) ? 0.19 * pow(k, 0.7) : -0.12 * pow(k, 0.6);
      p = vec3(cos(th) * rr, yy, sin(th) * rr);
      float ring = 0.5 + 0.5 * sin(rr * 42.0);
      float lum = 0.20 + 0.12 * ring + 0.16 * (1.0 - rr / R);
      c = hsl2rgb(0.60, 0.18, lum);
    }

    // Slow spin about Y with a fixed tilt so the disc reads as 3D.
    p = rotY(p, time * spin * 0.5);
    p = rotX(p, 0.34);
    pos = p * scale;
    col = c;
  }

  /* == preset 2: Astronaut ================================ */

  void presetRunner(float fi, int cnt, float time,
    float c0, float c1, float c2, float c3,
    float c4, float c5, float c6, float c7,
    out vec3 pos, out vec3 col)
  {
    float scale = c0 * 0.62;
    float spin = c1;
    float fcnt = float(cnt);
    int idx = int(fi);

    // Body-part index ranges (fractions of the particle budget).
    int helmetEnd = int(floor(fcnt * 0.16));
    int torsoEnd  = helmetEnd + int(floor(fcnt * 0.28));
    int packEnd   = torsoEnd  + int(floor(fcnt * 0.10));
    int hipEnd    = packEnd   + int(floor(fcnt * 0.06));
    int armEnd    = hipEnd    + int(floor(fcnt * 0.18));
    // remainder: legs

    vec3 p;
    vec3 c;
    // Kept dim so the additive bloom does not blow the suit to a solid mass;
    // the visor and accent lights carry the brightness.
    vec3 white = vec3(0.34, 0.36, 0.44);

    if (idx < helmetEnd) {
      float hh = float(idx);
      vec3 s = onSphere(grHash(hh, 0.618), grHash(hh, 0.271));
      p = vec3(0.0, 0.66, 0.0) + s * 0.27;
      // Gold visor on the front-facing cap.
      float visor = smoothstep(0.15, 0.55, s.z) * step(-0.15, s.y) * step(s.y, 0.45);
      c = mix(white * 1.05, hsl2rgb(0.11, 0.85, 0.52), visor);

    } else if (idx < torsoEnd) {
      float ti = float(idx - helmetEnd);
      vec3 s = onSphere(grHash(ti, 0.618), grHash(ti, 0.271));
      s *= pow(grHash(ti, 0.913), 0.5);
      p = vec3(0.0, 0.28, 0.0) + s * vec3(0.27, 0.28, 0.2);
      // A small chest control light.
      float chest = smoothstep(0.9, 1.0, s.z) * step(0.0, s.y);
      c = mix(white, hsl2rgb(0.5, 0.9, 0.6), chest * 0.8);

    } else if (idx < packEnd) {
      float bi = float(idx - torsoEnd);
      vec3 s = vec3(grHash(bi, 0.618), grHash(bi, 0.271), grHash(bi, 0.913)) - 0.5;
      p = vec3(0.0, 0.34, -0.24) + s * vec3(0.4, 0.44, 0.2);
      c = hsl2rgb(0.6, 0.06, 0.34) + hsl2rgb(0.86, 0.8, 0.5) * step(0.42, grHash(bi, 0.5)) * 0.12;

    } else if (idx < hipEnd) {
      float pi = float(idx - packEnd);
      vec3 s = onSphere(grHash(pi, 0.618), grHash(pi, 0.271));
      s *= pow(grHash(pi, 0.913), 0.5);
      p = vec3(0.0, 0.02, 0.0) + s * vec3(0.24, 0.13, 0.19);
      c = white * 0.95;

    } else if (idx < armEnd) {
      float ai = float(idx - hipEnd);
      float side = (hash11(ai) < 0.5) ? -1.0 : 1.0;
      float t = grHash(ai, 0.618);
      vec3 sh = vec3(side * 0.28, 0.46, 0.0);
      vec3 hand = vec3(side * 0.34, 0.02, 0.06);
      vec3 ctr = mix(sh, hand, t);
      float th = grHash(ai, 0.271) * 6.28318530718;
      float rr = sqrt(grHash(ai, 0.913)) * 0.095;
      p = ctr + vec3(cos(th) * rr, 0.0, sin(th) * rr);
      c = white;

    } else {
      float li = float(idx - armEnd);
      float side = (hash11(li) < 0.5) ? -1.0 : 1.0;
      float t = grHash(li, 0.618);
      vec3 hipp = vec3(side * 0.13, 0.0, 0.0);
      vec3 foot = vec3(side * 0.14, -0.64, 0.03);
      vec3 ctr = mix(hipp, foot, t);
      float th = grHash(li, 0.271) * 6.28318530718;
      float rr = sqrt(grHash(li, 0.913)) * 0.115;
      p = ctr + vec3(cos(th) * rr, 0.0, sin(th) * rr);
      // Boots read slightly darker.
      c = white * mix(1.0, 0.7, step(0.85, t));
    }

    // Gentle float and slow turn.
    p.y += sin(time * 0.8) * 0.03;
    p = rotY(p, time * spin * 0.4 + 0.3);
    pos = p * scale;
    col = c;
  }

  /* == preset 3: Ringed planet ============================ */

  void presetRemixLogo(float fi, int cnt, float time,
    float c0, float c1, float c2, float c3,
    float c4, float c5, float c6, float c7,
    out vec3 pos, out vec3 col)
  {
    float scale = c0 * 0.5;
    float fcnt = float(cnt);
    int idx = int(fi);

    int planetEnd = int(floor(fcnt * 0.6));
    int ringEnd = planetEnd + int(floor(fcnt * 0.36));
    vec3 p;
    vec3 c;
    float axisTilt = 0.42;

    if (idx < planetEnd) {
      // Gas-giant surface with latitude bands and a swirl.
      float pi = float(idx);
      vec3 s = onSphere(grHash(pi, 0.618), grHash(pi, 0.271));
      p = s * 1.0;
      float lat = s.y;
      float band = sin(lat * 9.0 + sin(lat * 3.0 + time * 0.2) * 1.2);
      float hue = mix(0.5, 0.86, 0.5 + 0.5 * band);
      float lum = 0.28 + 0.14 * band + 0.1 * s.z;
      c = hsl2rgb(hue, 0.6, clamp(lum, 0.1, 0.7));
      p = rotY(p, time * 0.12);

    } else if (idx < ringEnd) {
      // Flat ring belt with gaps and brightness banding.
      float ri = float(idx - planetEnd);
      float rr = mix(1.45, 2.5, grHash(ri, 0.618));
      float th = grHash(ri, 0.271) * 6.28318530718 + time * (0.3 / rr);
      float gap = smoothstep(0.02, 0.08, abs(fract(rr * 3.0) - 0.5));
      float yy = (grHash(ri, 0.913) - 0.5) * 0.02;
      p = vec3(cos(th) * rr, yy, sin(th) * rr);
      float bandN = 0.5 + 0.5 * sin(rr * 26.0);
      float hue = mix(0.52, 0.8, bandN);
      c = hsl2rgb(hue, 0.5, (0.18 + 0.2 * bandN) * gap);

    } else {
      // A couple of small moons on inclined orbits.
      float mi = float(idx - ringEnd);
      float moon = floor(grHash(mi, 0.19) * 2.0);
      float orbR = 3.0 + moon * 0.9;
      float orbA = time * (0.25 - moon * 0.08) + moon * 2.1;
      vec3 s = onSphere(grHash(mi, 0.618), grHash(mi, 0.271)) * 0.16;
      vec3 ctr = vec3(cos(orbA) * orbR, sin(orbA) * orbR * 0.35, sin(orbA) * orbR);
      p = ctr + s;
      c = hsl2rgb(0.6, 0.05, 0.4);
    }

    p = rotX(p, axisTilt);
    pos = p * scale;
    col = c;
  }

  /* == preset 4: Galaxy ==================================== */

  void presetTesseract(float fi, int cnt, float time,
    float c0, float c1, float c2, float c3,
    float c4, float c5, float c6, float c7,
    out vec3 pos, out vec3 col)
  {
    // Retained but unused (kept out of the dispatcher).
    pos = vec3(0.0);
    col = vec3(0.0);
  }

  void presetRacetrackCar(float fi, int cnt, float time,
    float c0, float c1, float c2, float c3,
    float c4, float c5, float c6, float c7,
    out vec3 pos, out vec3 col)
  {
    float fcnt = float(cnt);
    int idx = int(fi);
    float scale = 26.0;

    int coreEnd = int(floor(fcnt * 0.2));
    int armEnd = int(floor(fcnt * 0.92));
    vec3 p;
    vec3 c;
    float rot = time * 0.08;

    if (idx < coreEnd) {
      // Bright central bulge.
      float ci = float(idx);
      vec3 s = onSphere(grHash(ci, 0.618), grHash(ci, 0.271));
      float r = pow(grHash(ci, 0.913), 1.5) * 0.4;
      p = s * r * vec3(1.0, 0.55, 1.0);
      float lum = 0.5 + 0.4 * (1.0 - r / 0.4);
      // Densest centre saturates toward white-hot, fading out to gold: the
      // ignited-node gradient (white -> gold) at the galaxy core.
      float sat = mix(0.12, 0.72, clamp(r / 0.4, 0.0, 1.0));
      c = hsl2rgb(mix(0.12, 0.06, grHash(ci, 0.5)), sat, lum);

    } else if (idx < armEnd) {
      // Two logarithmic spiral arms with scatter.
      float ai = float(idx - coreEnd);
      float r = pow(grHash(ai, 0.618), 0.6) * 2.4 + 0.2;
      float arm = floor(grHash(ai, 0.19) * 2.0);
      float winds = 2.4;
      float baseA = r * winds + arm * 3.14159265 + rot * (0.6 / (0.25 + r));
      float scatter = (grHash(ai, 0.73) - 0.5) * (0.5 + 0.5 / r);
      float a = baseA + scatter;
      float thick = (grHash(ai, 0.29) - 0.5) * 0.12 * (0.4 + r * 0.3);
      p = vec3(cos(a) * r, thick, sin(a) * r);
      float rn = clamp(r / 2.6, 0.0, 1.0);
      float hue = mix(0.09, 0.6, rn) + (grHash(ai, 0.41) - 0.5) * 0.08;
      float lum = 0.2 + 0.4 * (1.0 - rn) + 0.1 * grHash(ai, 0.87);
      c = hsl2rgb(hue, 0.75, lum);

    } else {
      // Sparse halo stars around the disk.
      float hi = float(idx - armEnd);
      vec3 s = onSphere(grHash(hi, 0.618), grHash(hi, 0.271));
      p = s * (2.6 + grHash(hi, 0.913) * 2.0) * vec3(1.0, 0.4, 1.0);
      float lum = 0.15 + 0.4 * pow(grHash(hi, 0.5), 3.0);
      c = hsl2rgb(mix(0.55, 0.72, grHash(hi, 0.37)), 0.3, lum);
    }

    p = rotX(p, 1.05);
    p = rotY(p, rot);
    pos = p * scale;
    col = c;
  }

  /* == dispatch =========================================== */

  void computePreset(int id, float fi, int cnt, float time,
    float c0, float c1, float c2, float c3,
    float c4, float c5, float c6, float c7,
    out vec3 pos, out vec3 col)
  {
    // The integer 'id' is a ShaderId enum set up in particle-boot.ts
    // (SHADER_ID_TO_INT), not a position in the presets array. Keep the
    // JS-side map in sync whenever a branch is added or reordered here.
    if      (id == 0) presetRacetrack    (fi, cnt, time, c0,c1,c2,c3,c4,c5,c6,c7, pos, col);
    else if (id == 1) presetRacecar      (fi, cnt, time, c0,c1,c2,c3,c4,c5,c6,c7, pos, col);
    else if (id == 2) presetRunner       (fi, cnt, time, c0,c1,c2,c3,c4,c5,c6,c7, pos, col);
    else if (id == 3) presetRemixLogo    (fi, cnt, time, c0,c1,c2,c3,c4,c5,c6,c7, pos, col);
    else              presetRacetrackCar (fi, cnt, time, c0,c1,c2,c3,c4,c5,c6,c7, pos, col);
  }
`;

// Uniform declarations the chunk depends on. Surrounding shaders should
// concatenate this before `PRESET_GLSL`. Keeps presets and their dependencies
// declared in one place.
export const PRESET_UNIFORMS_GLSL = /* glsl */ `
  uniform sampler2D uModelTex0;
  uniform sampler2D uModelTex1;
  uniform sampler2D uModelTex2;
  uniform sampler2D uModelTex3;
  uniform float uModelCount0;
  uniform float uModelCount1;
  uniform float uModelCount2;
  uniform float uModelCount3;
  uniform float uCarLaneOffset;
  uniform float uCarLaneActivity;
  uniform float uCarPosY;
`;
