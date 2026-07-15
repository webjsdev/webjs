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

  /* == preset 0: Cosmic-web simulation flythrough (hero) === */

  // Deterministic position of web node k, CLUSTERED into superclusters. Each
  // node hangs off one of a handful of supercluster seeds with a falloff, so
  // the nodes lump into dense regions separated by large empty voids the way
  // real large-scale structure does, instead of spreading evenly.
  vec3 webNode(float k) {
    const float M = 10.0;              // supercluster seeds
    float parent = floor(grHash(k, 0.913) * M);
    vec3 seed = vec3(
      grHash(parent, 0.137) * 2.0 - 1.0,
      grHash(parent, 0.641) * 2.0 - 1.0,
      grHash(parent, 0.319) * 2.0 - 1.0
    ) * 0.8;
    vec3 off = vec3(
      grHash(k, 0.1237) * 2.0 - 1.0,
      grHash(k, 0.7411) * 2.0 - 1.0,
      grHash(k, 0.3319) * 2.0 - 1.0
    );
    float spread = 0.34 * pow(grHash(k, 0.55), 0.6);
    return clamp(seed + off * spread, vec3(-1.05), vec3(1.05));
  }

  // Node A's chosen neighbour: one of its three nearest nodes (weighted toward
  // the nearest), so filaments branch into a connected web.
  float webNeighbour(float ka, vec3 na, float pick) {
    float best1 = 1e9, best2 = 1e9, best3 = 1e9;
    float b1 = 0.0, b2 = 0.0, b3 = 0.0;
    for (int j = 0; j < 54; j++) {
      float kj = float(j);
      if (kj == ka) continue;
      float dj = distance(na, webNode(kj));
      if (dj < best1)      { best3 = best2; b3 = b2; best2 = best1; b2 = b1; best1 = dj; b1 = kj; }
      else if (dj < best2) { best3 = best2; b3 = b2; best2 = dj; b2 = kj; }
      else if (dj < best3) { best3 = dj; b3 = kj; }
    }
    return (pick < 0.5) ? b1 : ((pick < 0.82) ? b2 : b3);
  }

  // Colour of a single galaxy at the given brightness. Matches the JWST field:
  // mostly white / blue-white, a large minority warm gold-orange (redshifted
  // background galaxies), a few blue. The dark-matter GLOW (blue/magenta) is
  // the background pass; the galaxies themselves are white/gold/blue points.
  vec3 galaxyColor(float s, float lum) {
    float pick = grHash(s, 0.234);
    float hue, sat;
    if (pick < 0.60)      { hue = 0.62; sat = 0.07; }                        // white / blue-white
    else if (pick < 0.86) { hue = mix(0.055, 0.11, grHash(s, 0.5)); sat = 0.78; } // gold / orange
    else                  { hue = 0.60; sat = 0.5; }                         // blue
    return hsl2rgb(hue, sat, lum);
  }

  // A cosmic-web slice: bright warm NODES (clumps that have ignited) linked by
  // FILAMENTS strung with galaxy beads, faint dust in the VOIDS, and a
  // volumetric depth haze. Density maps to colour the way an IllustrisTNG /
  // Millennium false-colour render does: dense = warm/white/gold, diffuse =
  // cool violet/pink, empty = near-black.
  void presetRacetrack(float fi, int cnt, float time,
    float c0, float c1, float c2, float c3,
    float c4, float c5, float c6, float c7,
    out vec3 pos, out vec3 col)
  {
    const float N = 54.0;              // number of web nodes
    const vec3 WEB_SIZE = vec3(80.0, 60.0, 80.0);
    const vec3 WEB_CENTER = vec3(0.0, 2.0, -34.0);

    float fcnt = float(cnt);
    int idx = int(fi);
    float ang = time * 0.03;           // slow survey rotation of the volume

    // Budget: 15% cluster galaxies, 15% filament galaxy beads, 38% filament
    // galaxies, 32% scattered background-galaxy field. Every particle is a
    // galaxy; density (not hue) marks the structure, the way the real field is
    // packed with galaxies everywhere and densest on the clusters.
    int nodeCnt = int(fcnt * 0.15);
    int haloCnt = nodeCnt + int(fcnt * 0.15);
    int voidStart = int(fcnt * 0.68);

    vec3 lp;                           // local position in the [-1,1]^3 cell
    vec3 c;

    if (idx < nodeCnt) {
      // Cluster galaxies: a tight clump of galaxies on a node, densest and
      // brightest at the centre (the intracluster light washes to white).
      float ni = float(idx);
      float k = floor(grHash(ni, 0.53) * N);
      vec3 s = onSphere(grHash(ni, 0.618), grHash(ni, 0.412));
      float rr = pow(grHash(ni, 0.913), 2.2) * 0.10;
      lp = webNode(k) + s * rr;
      float dens = 1.0 - clamp(rr / 0.10, 0.0, 1.0);     // 1 at centre, 0 at edge
      c = galaxyColor(ni, 0.55 + 0.5 * dens);

    } else if (idx >= voidStart) {
      // Scattered background-galaxy field: fills the whole frame (voids
      // included) with faint galaxies, a few brighter, like the real image.
      float vi = float(idx - voidStart);
      lp = vec3(
        grHash(vi, 0.19) * 2.0 - 1.0,
        grHash(vi, 0.53) * 2.0 - 1.0,
        grHash(vi, 0.87) * 2.0 - 1.0
      ) * 1.15;
      float lum = 0.10 + 0.6 * pow(grHash(vi, 0.4), 3.0);
      c = galaxyColor(vi + 7.0, lum);

    } else {
      // Filament particles (diffuse thread) and galaxy beads both ride the same
      // node-to-neighbour segment; beads are tight bright clumps along it.
      bool isHalo = idx < haloCnt;
      float seed = isHalo ? float(idx - nodeCnt) + 1000.0 : float(idx - haloCnt);

      float ka = floor(grHash(seed, 0.53) * N);
      vec3 na = webNode(ka);
      float kb = webNeighbour(ka, na, grHash(seed, 0.87));
      vec3 nb = webNode(kb);

      float d = max(distance(na, nb), 1e-4);
      vec3 dir = (nb - na) / d;
      vec3 up = (abs(dir.y) > 0.9) ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
      vec3 perp1 = normalize(cross(dir, up));
      vec3 perp2 = cross(dir, perp1);

      // Coherent per-filament bow so threads curve gently, not dead straight.
      float seedF = ka * 64.0 + kb;
      float bowAng = grHash(seedF, 0.66) * 6.28318530718;
      vec3 bowDir = perp1 * cos(bowAng) + perp2 * sin(bowAng);

      float t = grHash(seed, 0.271);
      float bow = sin(t * 3.14159265) * 0.14 * (grHash(seedF, 0.5) - 0.15);
      vec3 base = mix(na, nb, t) + bowDir * bow;
      float ends = abs(t - 0.5) * 2.0;             // 0 mid-thread, 1 at the nodes

      if (isHalo) {
        // Galaxy bead: a tight bright clump of galaxies seated on the filament.
        vec3 s = onSphere(grHash(seed, 0.618), grHash(seed, 0.412));
        float rr = pow(grHash(seed, 0.913), 2.0) * 0.05;
        lp = base + s * rr;
        float dens = 1.0 - clamp(rr / 0.05, 0.0, 1.0);
        c = galaxyColor(seed, 0.5 + 0.5 * dens);
      } else {
        // Filament galaxies: thin mid-filament, swelling into the nodes.
        // Fainter than the clusters; brightening toward the nodes.
        float th = grHash(seed, 0.913) * 6.28318530718;
        float rr = sqrt(grHash(seed, 0.33)) * 0.04 * (0.45 + ends * 1.4);
        lp = base + (perp1 * cos(th) + perp2 * sin(th)) * rr;
        float lum = 0.16 + 0.42 * pow(ends, 1.5) + 0.08 * grHash(seed, 0.77);
        c = galaxyColor(seed, lum);
      }
    }

    vec3 wp = rotY(lp, ang) * WEB_SIZE + WEB_CENTER;
    // Volumetric depth haze: the far side of the volume dims into the dark, so
    // the structure reads with real depth instead of a flat sheet.
    float depth01 = clamp((wp.z + 128.0) / 170.0, 0.0, 1.0);   // 0 far, 1 near
    c *= mix(0.55, 1.0, depth01);

    pos = wp;
    col = c;
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
