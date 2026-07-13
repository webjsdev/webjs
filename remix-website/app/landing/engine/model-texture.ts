import { DataTexture, FloatType, NearestFilter, RGBAFormat } from "three";
import type { ModelData } from "./model-loader.ts";

const TEX_WIDTH = 512;
const TEX_HEIGHT = 256;

export function createModelTexture(model: ModelData): DataTexture {
  const data = new Float32Array(TEX_WIDTH * TEX_HEIGHT * 4);
  const count = Math.min(model.positions.length / 3, TEX_WIDTH * TEX_HEIGHT);
  for (let i = 0; i < count; i++) {
    const si = i * 3;
    const di = i * 4;
    data[di] = model.positions[si];
    data[di + 1] = model.positions[si + 1];
    data[di + 2] = model.positions[si + 2];
    data[di + 3] = 0;
  }
  const tex = new DataTexture(
    data,
    TEX_WIDTH,
    TEX_HEIGHT,
    RGBAFormat,
    FloatType,
  );
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  tex.needsUpdate = true;
  return tex;
}
