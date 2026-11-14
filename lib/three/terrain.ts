import * as THREE from 'three';
import type {WeatherStateData, WorldTerrainGrid} from '../observatory/types';

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

export function buildTerrainGroup(
  terrain: WorldTerrainGrid | null,
  season: string,
  highQuality: boolean,
): {group: THREE.Group; dispose: () => void} {
  const group = new THREE.Group();
  const widthM = terrain?.width_m ?? 2500;
  const heightM = terrain?.height_m ?? 2000;
  const cols = terrain?.cols ?? 100;
  const rows = terrain?.rows ?? 80;

  const geo = new THREE.PlaneGeometry(widthM, heightM, cols - 1, rows - 1);
  geo.rotateX(-Math.PI / 2);

  const posAttr = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(posAttr.count * 3);
  const cTmp = new THREE.Color();

  const seasonTint =
    season === 'autumn'
      ? new THREE.Color('#6f5830')
      : season === 'winter'
        ? new THREE.Color('#5a6772')
        : season === 'summer'
          ? new THREE.Color('#475c31')
          : new THREE.Color('#3e6238');

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

    let wy = elev * ELEVATION_SCALE;
    if (water > 18) {
      // Slightly carve river/lake channels for clear shoreline silhouette
      wy -= Math.min(8, (water - 18) * 0.08);
      waterHeightSum += elev * ELEVATION_SCALE;
      waterCellCount++;
    }
    posAttr.setY(i, wy);

    if (water > 22) {
      cTmp.setRGB(0.11, 0.24, 0.32);
    } else if (water > 6) {
      cTmp.setRGB(0.32, 0.34, 0.26); // damp silt shore
    } else if (elev > 70 || stone > 12) {
      // Rocky highlands
      cTmp.setRGB(0.32, 0.31, 0.30);
    } else {
      const drySoil = new THREE.Color('#4a3d2b');
      const lushGrass = seasonTint.clone();
      const mixFactor = Math.max(0.08, Math.min(1, fert * 0.72 + moist * 0.42));
      cTmp.copy(drySoil).lerp(lushGrass, mixFactor);
      if (season === 'winter' && elev > 56) {
        cTmp.lerp(new THREE.Color('#cbd5df'), 0.45);
      }
    }

    colors[i * 3] = cTmp.r;
    colors[i * 3 + 1] = cTmp.g;
    colors[i * 3 + 2] = cTmp.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.93,
    metalness: 0.02,
    flatShading: !highQuality,
  });

  const terrainMesh = new THREE.Mesh(geo, terrainMat);
  terrainMesh.receiveShadow = highQuality;
  terrainMesh.name = 'terrain_surface';
  group.add(terrainMesh);

  // Water bodies mesh: build localized water surface patches where water > 14 so springs/lakes follow terrain contour
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
      const surfaceY = Math.max(elev * ELEVATION_SCALE - 0.35, avgWaterY - 2.0);
      wPos.setY(i, surfaceY);
    } else {
      // Sink below dry ground so only real water basins show
      wPos.setY(i, elev * ELEVATION_SCALE - 9.0);
    }
  }
  waterGeo.computeVertexNormals();

  const waterMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1a526e'),
    roughness: 0.16,
    metalness: 0.25,
    transparent: true,
    opacity: 0.84,
  });
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.receiveShadow = highQuality;
  waterMesh.name = 'water_bodies';
  group.add(waterMesh);

  // Subtle boundary rim marking the 5 km^2 (2500m x 2000m) simulation bounds
  const borderPts = [
    new THREE.Vector3(-widthM * 0.5, 40 * ELEVATION_SCALE, -heightM * 0.5),
    new THREE.Vector3(widthM * 0.5, 40 * ELEVATION_SCALE, -heightM * 0.5),
    new THREE.Vector3(widthM * 0.5, 40 * ELEVATION_SCALE, heightM * 0.5),
    new THREE.Vector3(-widthM * 0.5, 40 * ELEVATION_SCALE, heightM * 0.5),
    new THREE.Vector3(-widthM * 0.5, 40 * ELEVATION_SCALE, -heightM * 0.5),
  ];
  const borderGeo = new THREE.BufferGeometry().setFromPoints(borderPts);
  const borderMat = new THREE.LineBasicMaterial({
    color: new THREE.Color('#d99b26'),
    transparent: true,
    opacity: 0.28,
  });
  group.add(new THREE.Line(borderGeo, borderMat));

  return {
    group,
    dispose: () => {
      geo.dispose();
      terrainMat.dispose();
      waterGeo.dispose();
      waterMat.dispose();
      borderGeo.dispose();
      borderMat.dispose();
    },
  };
}

export interface AtmosphereRig {
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  fill: THREE.DirectionalLight;
  skyColor: THREE.Color;
}

export function createAtmosphereRig(scene: THREE.Scene, highQuality: boolean): AtmosphereRig {
  const hemi = new THREE.HemisphereLight('#a8c8e8', '#332b20', 0.85);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight('#fff1d6', 1.65);
  sun.position.set(700, 920, 480);
  sun.castShadow = highQuality;
  sun.shadow.mapSize.set(highQuality ? 2048 : 512, highQuality ? 2048 : 512);
  sun.shadow.camera.near = 100;
  sun.shadow.camera.far = 3200;
  const d = 1400;
  sun.shadow.camera.left = -d;
  sun.shadow.camera.right = d;
  sun.shadow.camera.top = d;
  sun.shadow.camera.bottom = -d;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  const fill = new THREE.DirectionalLight('#7ea6cc', 0.42);
  fill.position.set(-650, 420, -520);
  scene.add(fill);

  const skyColor = new THREE.Color('#0b1118');
  scene.background = skyColor;
  scene.fog = new THREE.FogExp2(skyColor.getHex(), 0.00028);

  return {hemi, sun, fill, skyColor};
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

  if (isNight) {
    rig.skyColor.set('#070b12');
    rig.sun.color.set('#7fa5d6');
    rig.sun.intensity = 0.55;
    rig.sun.position.set(-550, 700, -400);
    rig.hemi.color.set('#385378');
    rig.hemi.groundColor.set('#14171d');
    rig.hemi.intensity = 0.55;
    rig.fill.intensity = 0.25;
  } else if (cond === 'storm' || cond === 'flood') {
    rig.skyColor.set('#18212b');
    rig.sun.color.set('#b8c7d8');
    rig.sun.intensity = 0.95;
    rig.sun.position.set(500, 820, 420);
    rig.hemi.color.set('#667b91');
    rig.hemi.groundColor.set('#262825');
    rig.hemi.intensity = 0.78;
    rig.fill.intensity = 0.42;
  } else if (cond === 'drought') {
    rig.skyColor.set('#261d14');
    rig.sun.color.set('#ffcf91');
    rig.sun.intensity = 1.9;
    rig.sun.position.set(780, 960, 440);
    rig.hemi.color.set('#d4a875');
    rig.hemi.groundColor.set('#3d2e1e');
    rig.hemi.intensity = 0.85;
    rig.fill.intensity = 0.35;
  } else if (cond === 'frost' || season === 'winter') {
    rig.skyColor.set('#16202a');
    rig.sun.color.set('#e1efff');
    rig.sun.intensity = 1.35;
    rig.sun.position.set(620, 740, 520);
    rig.hemi.color.set('#9ec0de');
    rig.hemi.groundColor.set('#2d3640');
    rig.hemi.intensity = 0.85;
    rig.fill.intensity = 0.45;
  } else {
    rig.skyColor.set(season === 'autumn' ? '#1c1917' : '#101b27');
    rig.sun.color.set('#fff0d2');
    rig.sun.intensity = 1.68;
    rig.sun.position.set(700, 920, 480);
    rig.hemi.color.set('#a7c8eb');
    rig.hemi.groundColor.set('#332b20');
    rig.hemi.intensity = 0.88;
    rig.fill.intensity = 0.44;
  }

  scene.background = rig.skyColor;

  if (fpvVisionRadiusM !== null && fpvVisionRadiusM > 0) {
    // Strictly bound visual horizon to the engine's exact computed vision_radius_m!
    // Exponential fog density calibrated so visibility effectively terminates at vision_radius_m
    const density = Math.max(0.012, 3.1 / fpvVisionRadiusM);
    scene.fog = new THREE.FogExp2(rig.skyColor.getHex(), density);
  } else {
    const baseDensity =
      cond === 'storm' || cond === 'flood' ? 0.00052 : isNight ? 0.00046 : 0.00024;
    scene.fog = new THREE.FogExp2(rig.skyColor.getHex(), baseDensity);
  }
}
