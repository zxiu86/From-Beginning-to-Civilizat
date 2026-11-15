import * as THREE from 'three';
import type {QualityPreset, WeatherStateData, WorldTerrainGrid} from '../observatory/types';

export const ELEVATION_SCALE = 1.65;

export function simToWorldXZ(
  xM: number,
  yM: number,
  widthM = 2500,
  heightM = 2000,
): {wx: number; wz: number} {
  return {
    wx: xM - widthM * 0.5,
    wz: yM - heightM * 0.5,
  };
}

export function worldXZToSim(
  wx: number,
  wz: number,
  widthM = 2500,
  heightM = 2000,
): {xM: number; yM: number} {
  return {
    xM: wx + widthM * 0.5,
    yM: wz + heightM * 0.5,
  };
}

function hash2D(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function valueNoise2D(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2D(ix, iy);
  const b = hash2D(ix + 1, iy);
  const c = hash2D(ix, iy + 1);
  const d = hash2D(ix + 1, iy + 1);
  return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
}

export function sampleGridValue(
  grid: number[],
  cols: number,
  rows: number,
  widthM: number,
  heightM: number,
  xM: number,
  yM: number,
  fallback = 0,
): number {
  if (!grid || grid.length !== cols * rows || cols < 2 || rows < 2) return fallback;
  const u = Math.max(0, Math.min(cols - 1.001, (xM / widthM) * (cols - 1)));
  const v = Math.max(0, Math.min(rows - 1.001, (yM / heightM) * (rows - 1)));
  const c0 = Math.floor(u);
  const r0 = Math.floor(v);
  const c1 = Math.min(cols - 1, c0 + 1);
  const r1 = Math.min(rows - 1, r0 + 1);
  const tx = u - c0;
  const tz = v - r0;

  const v00 = grid[r0 * cols + c0] ?? fallback;
  const v10 = grid[r0 * cols + c1] ?? fallback;
  const v01 = grid[r1 * cols + c0] ?? fallback;
  const v11 = grid[r1 * cols + c1] ?? fallback;

  const top = v00 * (1 - tx) + v10 * tx;
  const bot = v01 * (1 - tx) + v11 * tx;
  return top * (1 - tz) + bot * tz;
}

export function sampleElevationY(terrain: WorldTerrainGrid | null, xM: number, yM: number): number {
  if (!terrain) return 30 * ELEVATION_SCALE;
  const e = sampleGridValue(
    terrain.elevation,
    terrain.cols,
    terrain.rows,
    terrain.width_m,
    terrain.height_m,
    xM,
    yM,
    42,
  );
  return e * ELEVATION_SCALE;
}

function createProceduralGroundTextures(): {
  albedoTex: THREE.CanvasTexture;
  bumpTex: THREE.CanvasTexture;
  waterBumpTex: THREE.CanvasTexture;
  dispose: () => void;
} {
  const size = 256;

  // Neutral organic grain albedo overlay (multiplies cleanly with biome vertex colors)
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const aCtx = albedoCanvas.getContext('2d')!;
  const aImg = aCtx.createImageData(size, size);

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;
  const bImg = bCtx.createImageData(size, size);

  const waterCanvas = document.createElement('canvas');
  waterCanvas.width = size;
  waterCanvas.height = size;
  const wCtx = waterCanvas.getContext('2d')!;
  const wImg = wCtx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const n1 = valueNoise2D(x * 0.08, y * 0.08);
      const n2 = valueNoise2D(x * 0.28 + 13.7, y * 0.28 + 7.1);
      const grain = hash2D(x, y);
      const val = Math.round(205 + (n1 * 0.5 + n2 * 0.35 + grain * 0.15) * 48);
      aImg.data[idx] = val;
      aImg.data[idx + 1] = val;
      aImg.data[idx + 2] = val;
      aImg.data[idx + 3] = 255;

      const bVal = Math.round((n1 * 0.45 + n2 * 0.35 + grain * 0.2) * 255);
      bImg.data[idx] = bVal;
      bImg.data[idx + 1] = bVal;
      bImg.data[idx + 2] = bVal;
      bImg.data[idx + 3] = 255;

      // Water wave interference pattern (tileable)
      const u = (x / size) * Math.PI * 2;
      const v = (y / size) * Math.PI * 2;
      const wave =
        0.5 +
        0.22 * Math.sin(u * 4 + v * 2) +
        0.18 * Math.cos(u * 3 - v * 5) +
        0.1 * Math.sin(u * 8 + v * 7);
      const wVal = Math.max(0, Math.min(255, Math.round(wave * 255)));
      wImg.data[idx] = wVal;
      wImg.data[idx + 1] = wVal;
      wImg.data[idx + 2] = wVal;
      wImg.data[idx + 3] = 255;
    }
  }

  aCtx.putImageData(aImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);
  wCtx.putImageData(wImg, 0, 0);

  const albedoTex = new THREE.CanvasTexture(albedoCanvas);
  albedoTex.wrapS = THREE.RepeatWrapping;
  albedoTex.wrapT = THREE.RepeatWrapping;
  albedoTex.repeat.set(42, 34);
  albedoTex.colorSpace = THREE.SRGBColorSpace;

  const bumpTex = new THREE.CanvasTexture(bumpCanvas);
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.RepeatWrapping;
  bumpTex.repeat.set(42, 34);

  const waterBumpTex = new THREE.CanvasTexture(waterCanvas);
  waterBumpTex.wrapS = THREE.RepeatWrapping;
  waterBumpTex.wrapT = THREE.RepeatWrapping;
  waterBumpTex.repeat.set(36, 28);

  return {
    albedoTex,
    bumpTex,
    waterBumpTex,
    dispose: () => {
      albedoTex.dispose();
      bumpTex.dispose();
      waterBumpTex.dispose();
    },
  };
}

export interface TerrainBundle {
  group: THREE.Group;
  tick: (elapsedS: number) => void;
  dispose: () => void;
}

export function buildTerrainGroup(
  terrain: WorldTerrainGrid | null,
  season: string,
  quality: QualityPreset,
): TerrainBundle {
  const group = new THREE.Group();
  const widthM = terrain?.width_m ?? 2500;
  const heightM = terrain?.height_m ?? 2000;
  const cols = terrain?.cols ?? 100;
  const rows = terrain?.rows ?? 80;

  // Quality-scaled terrain subdivision for balanced vertex budgets vs ridge fidelity
  const segX =
    quality === 'ultra'
      ? Math.min(240, Math.round((cols - 1) * 2.4))
      : quality === 'high'
        ? Math.min(200, (cols - 1) * 2)
        : quality === 'medium'
          ? cols - 1
          : Math.max(64, Math.round((cols - 1) * 0.75));
  const segZ =
    quality === 'ultra'
      ? Math.min(192, Math.round((rows - 1) * 2.4))
      : quality === 'high'
        ? Math.min(160, (rows - 1) * 2)
        : quality === 'medium'
          ? rows - 1
          : Math.max(52, Math.round((rows - 1) * 0.75));

  const geo = new THREE.PlaneGeometry(widthM, heightM, segX, segZ);
  geo.rotateX(-Math.PI / 2);

  const posAttr = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(posAttr.count * 3);
  const cTmp = new THREE.Color();

  const lushSpring = new THREE.Color('#476e3b');
  const lushSummer = new THREE.Color('#516b35');
  const autumnMeadow = new THREE.Color('#806636');
  const winterMeadow = new THREE.Color('#647279');
  const dryEarth = new THREE.Color('#5a4933');
  const sandShore = new THREE.Color('#968565');
  const wetSilt = new THREE.Color('#3b3c31');
  const highlandRock = new THREE.Color('#5a5d61');
  const alpineSnow = new THREE.Color('#d2dce6');

  const seasonMeadow =
    season === 'autumn'
      ? autumnMeadow
      : season === 'winter'
        ? winterMeadow
        : season === 'summer'
          ? lushSummer
          : lushSpring;

  let waterHeightSum = 0;
  let waterCellCount = 0;

  for (let i = 0; i < posAttr.count; i++) {
    const wx = posAttr.getX(i);
    const wz = posAttr.getZ(i);
    const xM = wx + widthM * 0.5;
    const yM = wz + heightM * 0.5;

    const elev = terrain
      ? sampleGridValue(terrain.elevation, cols, rows, widthM, heightM, xM, yM, 44)
      : 44;
    const water = terrain
      ? sampleGridValue(terrain.water, cols, rows, widthM, heightM, xM, yM, 0)
      : 0;
    const fert = terrain
      ? sampleGridValue(terrain.fertility, cols, rows, widthM, heightM, xM, yM, 0.45)
      : 0.45;
    const moist = terrain
      ? sampleGridValue(terrain.moisture, cols, rows, widthM, heightM, xM, yM, 0.35)
      : 0.35;
    const stone = terrain
      ? sampleGridValue(terrain.stone_mineral, cols, rows, widthM, heightM, xM, yM, 0)
      : 0;

    // Subtle sub-cell organic relief on dry land (does not distort water channels)
    const micro =
      water > 6 ? 0 : (valueNoise2D(xM * 0.03, yM * 0.03) - 0.5) * 2.2;

    let wy = elev * ELEVATION_SCALE + micro;
    if (water > 16) {
      wy -= Math.min(9.5, (water - 16) * 0.085);
      waterHeightSum += elev * ELEVATION_SCALE;
      waterCellCount++;
    }
    posAttr.setY(i, wy);

    // Estimate local slope quickly from nearby elevation samples
    const eRight = terrain
      ? sampleGridValue(terrain.elevation, cols, rows, widthM, heightM, xM + 20, yM, elev)
      : elev;
    const eDown = terrain
      ? sampleGridValue(terrain.elevation, cols, rows, widthM, heightM, xM, yM + 20, elev)
      : elev;
    const localSlope = Math.hypot(eRight - elev, eDown - elev) / 20;

    if (water > 22) {
      cTmp.setRGB(0.11, 0.22, 0.28);
    } else if (water > 9) {
      cTmp.copy(wetSilt).lerp(sandShore, 0.45);
    } else if (water > 1.5) {
      cTmp.copy(sandShore).lerp(seasonMeadow, 0.3);
    } else if (localSlope > 0.38 || elev > 88 || stone > 14) {
      const rockMix = Math.min(1, Math.max((localSlope - 0.28) * 1.8, stone / 22));
      cTmp.copy(dryEarth).lerp(highlandRock, Math.max(0.35, rockMix));
    } else {
      const mixFactor = Math.max(0.08, Math.min(1, fert * 0.72 + moist * 0.42));
      cTmp.copy(dryEarth).lerp(seasonMeadow, mixFactor);
      // Natural micro-patch color variance
      const patch = valueNoise2D(xM * 0.015 + 4, yM * 0.015 + 9);
      cTmp.offsetHSL((patch - 0.5) * 0.03, 0, (patch - 0.5) * 0.045);
    }

    if (season === 'winter' && elev > 54 && water <= 8) {
      const snowBlend = Math.min(0.82, (elev - 54) / 55);
      cTmp.lerp(alpineSnow, snowBlend);
    }

    colors[i * 3] = cTmp.r;
    colors[i * 3 + 1] = cTmp.g;
    colors[i * 3 + 2] = cTmp.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const textures = createProceduralGroundTextures();

  const terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: textures.albedoTex,
    bumpMap: textures.bumpTex,
    bumpScale: quality === 'low' ? 0.5 : quality === 'medium' ? 0.9 : 1.35,
    roughness: 0.91,
    metalness: 0.02,
  });

  const terrainMesh = new THREE.Mesh(geo, terrainMat);
  terrainMesh.receiveShadow = quality !== 'low';
  terrainMesh.name = 'terrain_surface';
  group.add(terrainMesh);

  // Shimmering realistic water surface
  const waterGeo = new THREE.PlaneGeometry(widthM, heightM, cols - 1, rows - 1);
  waterGeo.rotateX(-Math.PI / 2);
  const wPos = waterGeo.attributes.position as THREE.BufferAttribute;
  const avgWaterY = waterCellCount > 0 ? waterHeightSum / waterCellCount - 0.5 : 34 * ELEVATION_SCALE;

  for (let i = 0; i < wPos.count; i++) {
    const wx = wPos.getX(i);
    const wz = wPos.getZ(i);
    const xM = wx + widthM * 0.5;
    const yM = wz + heightM * 0.5;
    const water = terrain
      ? sampleGridValue(terrain.water, cols, rows, widthM, heightM, xM, yM, 0)
      : 0;
    const elev = terrain
      ? sampleGridValue(terrain.elevation, cols, rows, widthM, heightM, xM, yM, 44)
      : 44;

    if (water > 10) {
      const surfaceY = Math.max(elev * ELEVATION_SCALE - 0.4, avgWaterY - 1.8);
      wPos.setY(i, surfaceY);
    } else {
      wPos.setY(i, elev * ELEVATION_SCALE - 9.5);
    }
  }
  waterGeo.computeVertexNormals();

  const waterMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#195975'),
    roughness: 0.12,
    metalness: 0.35,
    bumpMap: textures.waterBumpTex,
    bumpScale: 0.45,
    transparent: true,
    opacity: 0.86,
  });
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.receiveShadow = quality !== 'low';
  waterMesh.name = 'water_bodies';
  group.add(waterMesh);

  // Subtle boundary markers for the 5 km^2 domain
  const borderPts = [
    new THREE.Vector3(-widthM * 0.5, 42 * ELEVATION_SCALE, -heightM * 0.5),
    new THREE.Vector3(widthM * 0.5, 42 * ELEVATION_SCALE, -heightM * 0.5),
    new THREE.Vector3(widthM * 0.5, 42 * ELEVATION_SCALE, heightM * 0.5),
    new THREE.Vector3(-widthM * 0.5, 42 * ELEVATION_SCALE, heightM * 0.5),
    new THREE.Vector3(-widthM * 0.5, 42 * ELEVATION_SCALE, -heightM * 0.5),
  ];
  const borderGeo = new THREE.BufferGeometry().setFromPoints(borderPts);
  const borderMat = new THREE.LineBasicMaterial({
    color: new THREE.Color('#d99b26'),
    transparent: true,
    opacity: 0.22,
  });
  group.add(new THREE.Line(borderGeo, borderMat));

  return {
    group,
    tick: (elapsedS: number) => {
      textures.waterBumpTex.offset.x = (elapsedS * 0.025) % 1;
      textures.waterBumpTex.offset.y = (elapsedS * 0.018) % 1;
    },
    dispose: () => {
      geo.dispose();
      terrainMat.dispose();
      waterGeo.dispose();
      waterMat.dispose();
      borderGeo.dispose();
      borderMat.dispose();
      textures.dispose();
    },
  };
}

export interface AtmosphereRig {
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  fill: THREE.DirectionalLight;
  skyColor: THREE.Color;
  skyDome: THREE.Mesh;
  skyUniforms: {
    uTopColor: {value: THREE.Color};
    uHorizonColor: {value: THREE.Color};
  };
  celestialOrb: THREE.Mesh;
  cloudsGroup: THREE.Group;
  rainPoints: THREE.Points;
  dispose: () => void;
}

export function createAtmosphereRig(
  scene: THREE.Scene,
  quality: QualityPreset,
  shadowsAllowed = true,
): AtmosphereRig {
  const hemi = new THREE.HemisphereLight('#b8d6f5', '#3d3326', 0.92);
  scene.add(hemi);

  const castShadows = shadowsAllowed && quality !== 'low';
  const shadowSize = quality === 'medium' ? 1024 : 2048;

  const sun = new THREE.DirectionalLight('#fff0d1', 1.85);
  sun.position.set(780, 960, 520);
  sun.castShadow = castShadows;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.camera.near = 100;
  sun.shadow.camera.far = 3400;
  const d = 1450;
  sun.shadow.camera.left = -d;
  sun.shadow.camera.right = d;
  sun.shadow.camera.top = d;
  sun.shadow.camera.bottom = -d;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  const fill = new THREE.DirectionalLight('#86add4', 0.45);
  fill.position.set(-700, 460, -560);
  scene.add(fill);

  // Gradient atmospheric sky dome
  const skyUniforms = {
    uTopColor: {value: new THREE.Color('#132942')},
    uHorizonColor: {value: new THREE.Color('#4c6b82')},
  };
  const skyGeo = new THREE.SphereGeometry(5200, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uTopColor;
      uniform vec3 uHorizonColor;
      varying vec3 vWorldPos;
      void main() {
        float h = normalize(vWorldPos).y;
        float t = pow(clamp(h, 0.0, 1.0), 0.55);
        gl_FragColor = vec4(mix(uHorizonColor, uTopColor, t), 1.0);
      }
    `,
  });
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  scene.add(skyDome);

  // Sun / Moon orb positioned near key light direction
  const orbGeo = new THREE.SphereGeometry(62, 16, 12);
  const orbMat = new THREE.MeshBasicMaterial({color: '#ffe5a3', fog: false});
  const celestialOrb = new THREE.Mesh(orbGeo, orbMat);
  celestialOrb.position.set(1700, 1950, 1100);
  scene.add(celestialOrb);

  // Soft high-altitude cloud clusters
  const cloudsGroup = new THREE.Group();
  const puffGeo = new THREE.IcosahedronGeometry(38, 1);
  const cloudMat = new THREE.MeshStandardMaterial({
    color: '#dce6f0',
    roughness: 1.0,
    metalness: 0,
    transparent: true,
    opacity: 0.72,
    fog: false,
  });
  const cloudCount =
    quality === 'ultra' ? 24 : quality === 'high' ? 16 : quality === 'medium' ? 10 : 4;
  for (let i = 0; i < cloudCount; i++) {
    const cluster = new THREE.Group();
    const cx = (hash2D(i, 11) - 0.5) * 2800;
    const cy = 620 + hash2D(i, 12) * 180;
    const cz = (hash2D(i, 13) - 0.5) * 2400;
    cluster.position.set(cx, cy, cz);
    const puffs = 3 + Math.floor(hash2D(i, 14) * 3);
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(puffGeo, cloudMat);
      puff.position.set((p - 1.5) * 36, (hash2D(i, 20 + p) - 0.5) * 12, (hash2D(i, 30 + p) - 0.5) * 24);
      const s = 0.8 + hash2D(i, 40 + p) * 1.1;
      puff.scale.set(s * 1.5, s * 0.55, s * 1.1);
      cluster.add(puff);
    }
    cloudsGroup.add(cluster);
  }
  scene.add(cloudsGroup);

  // Atmospheric rain particles (toggled during rain/storm/flood)
  const rainCount =
    quality === 'ultra' ? 2400 : quality === 'high' ? 1600 : quality === 'medium' ? 900 : 350;
  const rainPos = new Float32Array(rainCount * 3);
  for (let i = 0; i < rainCount; i++) {
    rainPos[i * 3] = (hash2D(i, 51) - 0.5) * 2400;
    rainPos[i * 3 + 1] = hash2D(i, 52) * 420;
    rainPos[i * 3 + 2] = (hash2D(i, 53) - 0.5) * 2000;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.PointsMaterial({
    color: '#9ec5e6',
    size: 2.6,
    transparent: true,
    opacity: 0.55,
  });
  const rainPoints = new THREE.Points(rainGeo, rainMat);
  rainPoints.visible = false;
  scene.add(rainPoints);

  const skyColor = new THREE.Color('#273b4f');
  scene.background = skyColor;
  scene.fog = new THREE.FogExp2(skyColor.getHex(), 0.00024);

  return {
    hemi,
    sun,
    fill,
    skyColor,
    skyDome,
    skyUniforms,
    celestialOrb,
    cloudsGroup,
    rainPoints,
    dispose: () => {
      skyGeo.dispose();
      skyMat.dispose();
      orbGeo.dispose();
      orbMat.dispose();
      puffGeo.dispose();
      cloudMat.dispose();
      rainGeo.dispose();
      rainMat.dispose();
    },
  };
}

export function applyWeatherAndLighting(
  scene: THREE.Scene,
  rig: AtmosphereRig,
  isNight: boolean,
  season: string,
  weather: WeatherStateData,
  fpvVisionRadiusM: number | null,
): void {
  const cond = weather.condition;
  const isRaining = cond === 'rain' || cond === 'storm' || cond === 'flood';
  rig.rainPoints.visible = isRaining;

  if (isNight) {
    rig.skyColor.set('#0a111c');
    rig.skyUniforms.uTopColor.value.set('#050912');
    rig.skyUniforms.uHorizonColor.value.set('#142238');
    (rig.celestialOrb.material as THREE.MeshBasicMaterial).color.set('#d9e7ff');
    rig.celestialOrb.position.set(-1300, 1650, -950);

    rig.sun.color.set('#8ab0de');
    rig.sun.intensity = 0.68;
    rig.sun.position.set(-550, 720, -420);
    rig.hemi.color.set('#3d5b85');
    rig.hemi.groundColor.set('#161b22');
    rig.hemi.intensity = 0.62;
    rig.fill.intensity = 0.28;
    rig.cloudsGroup.visible = true;
  } else if (isRaining) {
    rig.skyColor.set('#27333f');
    rig.skyUniforms.uTopColor.value.set('#1b242e');
    rig.skyUniforms.uHorizonColor.value.set('#404f5e');
    (rig.celestialOrb.material as THREE.MeshBasicMaterial).color.set('#a8b7c7');
    rig.celestialOrb.position.set(1100, 1700, 880);

    rig.sun.color.set('#bdccdb');
    rig.sun.intensity = 1.05;
    rig.sun.position.set(520, 840, 420);
    rig.hemi.color.set('#73899e');
    rig.hemi.groundColor.set('#282b27');
    rig.hemi.intensity = 0.85;
    rig.fill.intensity = 0.45;
    rig.cloudsGroup.visible = true;
  } else if (cond === 'drought') {
    rig.skyColor.set('#473525');
    rig.skyUniforms.uTopColor.value.set('#2c3c4f');
    rig.skyUniforms.uHorizonColor.value.set('#87623e');
    (rig.celestialOrb.material as THREE.MeshBasicMaterial).color.set('#ffd28a');
    rig.celestialOrb.position.set(1850, 1980, 960);

    rig.sun.color.set('#ffd394');
    rig.sun.intensity = 2.05;
    rig.sun.position.set(780, 960, 440);
    rig.hemi.color.set('#dec095');
    rig.hemi.groundColor.set('#453522');
    rig.hemi.intensity = 0.9;
    rig.fill.intensity = 0.36;
    rig.cloudsGroup.visible = false;
  } else if (cond === 'frost' || season === 'winter') {
    rig.skyColor.set('#2b3b4a');
    rig.skyUniforms.uTopColor.value.set('#1e3042');
    rig.skyUniforms.uHorizonColor.value.set('#647c91');
    (rig.celestialOrb.material as THREE.MeshBasicMaterial).color.set('#f2f7ff');
    rig.celestialOrb.position.set(1450, 1550, 1100);

    rig.sun.color.set('#e6f2ff');
    rig.sun.intensity = 1.48;
    rig.sun.position.set(620, 760, 520);
    rig.hemi.color.set('#a8c8e6');
    rig.hemi.groundColor.set('#303a45');
    rig.hemi.intensity = 0.92;
    rig.fill.intensity = 0.48;
    rig.cloudsGroup.visible = true;
  } else {
    const horizonHex = season === 'autumn' ? '#6e5c4c' : '#4a6b85';
    const topHex = season === 'autumn' ? '#1e2c3d' : '#15304d';
    rig.skyColor.set(horizonHex);
    rig.skyUniforms.uTopColor.value.set(topHex);
    rig.skyUniforms.uHorizonColor.value.set(horizonHex);
    (rig.celestialOrb.material as THREE.MeshBasicMaterial).color.set('#ffebad');
    rig.celestialOrb.position.set(1700, 1950, 1100);

    rig.sun.color.set('#fff1d4');
    rig.sun.intensity = 1.85;
    rig.sun.position.set(780, 960, 520);
    rig.hemi.color.set('#b2d3f5');
    rig.hemi.groundColor.set('#3b3224');
    rig.hemi.intensity = 0.92;
    rig.fill.intensity = 0.46;
    rig.cloudsGroup.visible = true;
  }

  scene.background = rig.skyColor;

  if (fpvVisionRadiusM !== null && fpvVisionRadiusM > 0) {
    const density = Math.max(0.012, 3.1 / fpvVisionRadiusM);
    scene.fog = new THREE.FogExp2(rig.skyColor.getHex(), density);
  } else {
    const baseDensity =
      cond === 'storm' || cond === 'flood' ? 0.00048 : isNight ? 0.00042 : 0.00021;
    scene.fog = new THREE.FogExp2(rig.skyColor.getHex(), baseDensity);
  }
}

export function animateAtmosphere(rig: AtmosphereRig, dt: number): void {
  if (rig.cloudsGroup.visible) {
    for (const c of rig.cloudsGroup.children) {
      c.position.x += dt * 4.5;
      if (c.position.x > 1600) c.position.x = -1600;
    }
  }
  if (rig.rainPoints.visible) {
    const pos = rig.rainPoints.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) - dt * 160;
      if (y < 0) y = 420;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  }
}
