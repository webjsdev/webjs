export interface ModelData {
  positions: Float32Array;
  colors: Float32Array | null;
}

const PTS_HEADER = 36;
const modelCache = new Map<string, Promise<ModelData>>();

async function fetchModelPoints(url: string): Promise<ModelData> {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Failed to fetch model: ${url} (${response.status})`);

  const buf = await response.arrayBuffer();
  const view = new DataView(buf);

  const magic = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3),
  );
  if (magic !== "PTS1") throw new Error(`Unknown model format: ${url}`);

  const count = view.getUint32(4, true);
  const hasColors = (view.getUint32(8, true) & 1) !== 0;

  const minX = view.getFloat32(12, true);
  const minY = view.getFloat32(16, true);
  const minZ = view.getFloat32(20, true);
  const maxX = view.getFloat32(24, true);
  const maxY = view.getFloat32(28, true);
  const maxZ = view.getFloat32(32, true);
  const rangeX = maxX - minX;
  const rangeY = maxY - minY;
  const rangeZ = maxZ - minZ;

  const positions = new Float32Array(count * 3);
  let offset = PTS_HEADER;
  for (let i = 0; i < count; i++) {
    const idx = i * 3;
    const qx = view.getInt16(offset, true);
    offset += 2;
    const qy = view.getInt16(offset, true);
    offset += 2;
    const qz = view.getInt16(offset, true);
    offset += 2;
    positions[idx] = minX + ((qx + 32767) / 65534) * rangeX;
    positions[idx + 1] = minY + ((qy + 32767) / 65534) * rangeY;
    positions[idx + 2] = minZ + ((qz + 32767) / 65534) * rangeZ;
  }

  let colors: Float32Array | null = null;
  if (hasColors) {
    colors = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
      colors[i] = view.getUint8(offset) / 255;
      offset++;
    }
  }

  return { positions, colors };
}

export function loadModelPoints(url: string): Promise<ModelData> {
  const cached = modelCache.get(url);
  if (cached) return cached;

  const pending = fetchModelPoints(url).catch((error) => {
    modelCache.delete(url);
    throw error;
  });

  modelCache.set(url, pending);
  return pending;
}
