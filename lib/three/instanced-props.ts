import * as THREE from 'three';
import type {
  ExchangeHubItem,
  QualityPreset,
  SurfaceArtifactItem,
  WorldTerrainGrid,
} from '../observatory/types';
import {sampleElevationY, simToWorldXZ} from './terrain';

const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler();
const _color = new THREE.Color();

function seededUnit(idx: number, salt: number): number {
  const x = Math.sin(idx * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function jitterGeometry(geo: THREE.BufferGeometry, amount: number, salt: number): void {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const n = (seededUnit(Math.round((x + y * 7 + z * 13) * 100), salt) - 0.5) * 2 * amount;
    pos.setXYZ(i, x * (1 + n), y * (1 + n * 0.7), z * (1 + n));
  }
  geo.computeVertexNormals();
}

export interface PropsBundle {
  group: THREE.Group;
  artifactMeshes: Map<number, THREE.Object3D>;
  setFpvVisibleArtifacts: (visibleIds: Set<number> | null) => void;
  dispose: () => void;
}

const QUALITY_BUDGETS: Record<
  QualityPreset,
  {trees: number; food: number; herbs: number; stones: number; reeds: number; shadows: boolean; doubleTrees: boolean}
> = {
  low: {trees: 450, food: 320, herbs: 140, stones: 160, reeds: 160, shadows: false, doubleTrees: false},
  medium: {trees: 1050, food: 750, herbs: 350, stones: 380, reeds: 420, shadows: true, doubleTrees: false},
  high: {trees: 1850, food: 1300, herbs: 600, stones: 650, reeds: 750, shadows: true, doubleTrees: true},
  ultra: {trees: 2600, food: 1800, herbs: 850, stones: 900, reeds: 1000, shadows: true, doubleTrees: true},
};

export function buildWorldProps(
  terrain: WorldTerrainGrid | null,
  artifacts: SurfaceArtifactItem[],
  exchangeHubs: ExchangeHubItem[],
  hasShelterMilestone: boolean,
  season: string,
  quality: QualityPreset,
): PropsBundle {
  const group = new THREE.Group();
  const disposables: Array<{dispose: () => void}> = [];
  const artifactMeshes = new Map<number, THREE.Object3D>();
  const budget = QUALITY_BUDGETS[quality] ?? QUALITY_BUDGETS.high;

  if (terrain) {
    const {cols, rows, width_m: wM, height_m: hM, cell_size_m: cellM} = terrain;
    const treeTransforms: Array<{x: number; y: number; z: number; s: number; rot: number; tint: number}> = [];
    const foodTransforms: Array<{x: number; y: number; z: number; s: number; rot: number; tint: number}> = [];
    const herbTransforms: Array<{x: number; y: number; z: number; s: number; rot: number}> = [];
    const stoneTransforms: Array<{x: number; y: number; z: number; sx: number; sy: number; sz: number; rot: number; tint: number}> = [];
    const reedTransforms: Array<{x: number; y: number; z: number; s: number; rot: number}> = [];

    const maxTrees = budget.trees;
    const maxFood = budget.food;
    const maxHerbs = budget.herbs;
    const maxStones = budget.stones;
    const maxReeds = budget.reeds;
    const foodModulo = quality === 'low' ? 3 : quality === 'medium' ? 2 : 1;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const water = terrain.water[idx] ?? 0;
        const baseX = (c + 0.5) * cellM;
        const baseY = (r + 0.5) * cellM;

        if (water > 3 && water <= 16 && reedTransforms.length < maxReeds) {
          const sx = baseX + (seededUnit(idx, 41) - 0.5) * cellM * 0.7;
          const sy = baseY + (seededUnit(idx, 42) - 0.5) * cellM * 0.7;
          const {wx, wz} = simToWorldXZ(sx, sy, wM, hM);
          const wy = sampleElevationY(terrain, sx, sy);
          reedTransforms.push({
            x: wx,
            y: wy,
            z: wz,
            s: 0.75 + seededUnit(idx, 43) * 0.7,
            rot: seededUnit(idx, 44) * Math.PI * 2,
          });
        }

        if (water > 11) continue;

        const wood = terrain.wood_flora[idx] ?? 0;
        if (wood > 5.5 && treeTransforms.length < maxTrees) {
          const count = wood > 22 && budget.doubleTrees ? 2 : 1;
          for (let k = 0; k < count; k++) {
            const ox = (seededUnit(idx, 1 + k) - 0.5) * cellM * 0.85;
            const oy = (seededUnit(idx, 2 + k) - 0.5) * cellM * 0.85;
            const sx = Math.max(5, Math.min(wM - 5, baseX + ox));
            const sy = Math.max(5, Math.min(hM - 5, baseY + oy));
            const {wx, wz} = simToWorldXZ(sx, sy, wM, hM);
            const wy = sampleElevationY(terrain, sx, sy);
            const s = 0.72 + Math.min(1.65, wood / 26) * 0.85;
            treeTransforms.push({
              x: wx,
              y: wy,
              z: wz,
              s,
              rot: seededUnit(idx, 3 + k) * Math.PI * 2,
              tint: seededUnit(idx, 25 + k),
            });
          }
        }

        const food = terrain.food_flora[idx] ?? 0;
        if (food > 4.5 && foodTransforms.length < maxFood && (idx % foodModulo === 0)) {
          const ox = (seededUnit(idx, 4) - 0.5) * cellM * 0.78;
          const oy = (seededUnit(idx, 5) - 0.5) * cellM * 0.78;
          const sx = Math.max(5, Math.min(wM - 5, baseX + ox));
          const sy = Math.max(5, Math.min(hM - 5, baseY + oy));
          const {wx, wz} = simToWorldXZ(sx, sy, wM, hM);
          const wy = sampleElevationY(terrain, sx, sy);
          foodTransforms.push({
            x: wx,
            y: wy,
            z: wz,
            s: 0.62 + Math.min(1.15, food / 24),
            rot: seededUnit(idx, 18) * Math.PI * 2,
            tint: seededUnit(idx, 19),
          });
        }

        const herb = terrain.herb_flora[idx] ?? 0;
        if (herb > 1.2 && herbTransforms.length < maxHerbs && idx % 3 === 1) {
          const sx = baseX + (seededUnit(idx, 6) - 0.5) * cellM * 0.65;
          const sy = baseY + (seededUnit(idx, 7) - 0.5) * cellM * 0.65;
          const {wx, wz} = simToWorldXZ(sx, sy, wM, hM);
          const wy = sampleElevationY(terrain, sx, sy);
          herbTransforms.push({
            x: wx,
            y: wy,
            z: wz,
            s: 0.75 + Math.min(0.85, herb * 0.2),
            rot: seededUnit(idx, 28) * Math.PI * 2,
          });
        }

        const stone = terrain.stone_mineral[idx] ?? 0;
        if (stone > 5.5 && stoneTransforms.length < maxStones && idx % 2 === 0) {
          const sx = baseX + (seededUnit(idx, 8) - 0.5) * cellM * 0.68;
          const sy = baseY + (seededUnit(idx, 9) - 0.5) * cellM * 0.68;
          const {wx, wz} = simToWorldXZ(sx, sy, wM, hM);
          const wy = sampleElevationY(terrain, sx, sy);
          const s = 0.8 + Math.min(2.3, stone / 17);
          stoneTransforms.push({
            x: wx,
            y: wy,
            z: wz,
            sx: s * (0.85 + seededUnit(idx, 10) * 0.65),
            sy: s * (0.5 + seededUnit(idx, 11) * 0.55),
            sz: s * (0.85 + seededUnit(idx, 12) * 0.65),
            rot: seededUnit(idx, 13) * Math.PI,
            tint: seededUnit(idx, 14),
          });
        }
      }
    }

    if (treeTransforms.length > 0) {
      const trunkGeo = new THREE.CylinderGeometry(0.32, 0.72, 5.8, 7);
      trunkGeo.translate(0, 2.8, 0);
      const trunkMat = new THREE.MeshStandardMaterial({color: '#4a3525', roughness: 0.96});

      const lowerCrownGeo = new THREE.IcosahedronGeometry(3.2, 1);
      jitterGeometry(lowerCrownGeo, 0.22, 3);
      lowerCrownGeo.scale(1.05, 0.82, 1.05);
      lowerCrownGeo.translate(0, 6.9, 0);

      const upperCrownGeo = new THREE.IcosahedronGeometry(2.35, 1);
      jitterGeometry(upperCrownGeo, 0.2, 7);
      upperCrownGeo.scale(0.95, 1.08, 0.95);
      upperCrownGeo.translate(0.35, 9.6, -0.25);

      const canopyMat = new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.88,
        metalness: 0.02,
      });

      const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeTransforms.length);
      const lowerCrowns = new THREE.InstancedMesh(lowerCrownGeo, canopyMat, treeTransforms.length);
      const upperCrowns = new THREE.InstancedMesh(upperCrownGeo, canopyMat, treeTransforms.length);
      trunks.castShadow = budget.shadows;
      lowerCrowns.castShadow = budget.shadows;
      upperCrowns.castShadow = budget.shadows;
      lowerCrowns.receiveShadow = budget.shadows;

      treeTransforms.forEach((t, i) => {
        _euler.set(0, t.rot, 0);
        _quat.setFromEuler(_euler);
        _pos.set(t.x, t.y, t.z);
        _scale.set(t.s, t.s, t.s);
        _mat4.compose(_pos, _quat, _scale);
        trunks.setMatrixAt(i, _mat4);
        lowerCrowns.setMatrixAt(i, _mat4);
        upperCrowns.setMatrixAt(i, _mat4);

        if (season === 'autumn') {
          _color.set('#8f5424').lerp(new THREE.Color('#b8832c'), t.tint);
        } else if (season === 'winter') {
          _color.set('#2c4438').lerp(new THREE.Color('#475c54'), t.tint);
        } else {
          _color.set('#274f2b').lerp(new THREE.Color('#486e33'), t.tint);
        }
        lowerCrowns.setColorAt(i, _color);
        _color.offsetHSL(0.01, 0, 0.04);
        upperCrowns.setColorAt(i, _color);
      });

      trunks.instanceMatrix.needsUpdate = true;
      lowerCrowns.instanceMatrix.needsUpdate = true;
      upperCrowns.instanceMatrix.needsUpdate = true;
      if (lowerCrowns.instanceColor) lowerCrowns.instanceColor.needsUpdate = true;
      if (upperCrowns.instanceColor) upperCrowns.instanceColor.needsUpdate = true;
      trunks.computeBoundingSphere();
      lowerCrowns.computeBoundingSphere();
      upperCrowns.computeBoundingSphere();

      group.add(trunks, lowerCrowns, upperCrowns);
      disposables.push(trunkGeo, trunkMat, lowerCrownGeo, upperCrownGeo, canopyMat);
    }

    if (foodTransforms.length > 0) {
      const bushGeo = new THREE.IcosahedronGeometry(1.55, 1);
      jitterGeometry(bushGeo, 0.24, 11);
      bushGeo.scale(1.15, 0.72, 1.1);
      bushGeo.translate(0, 1.0, 0);

      const bushMat = new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.88,
      });
      const bushes = new THREE.InstancedMesh(bushGeo, bushMat, foodTransforms.length);
      bushes.castShadow = budget.shadows;

      foodTransforms.forEach((b, i) => {
        _euler.set(0, b.rot, 0);
        _quat.setFromEuler(_euler);
        _pos.set(b.x, b.y, b.z);
        _scale.set(b.s, b.s, b.s);
        _mat4.compose(_pos, _quat, _scale);
        bushes.setMatrixAt(i, _mat4);

        if (season === 'winter') {
          _color.set('#4c5944').lerp(new THREE.Color('#636854'), b.tint);
        } else {
          _color.set('#48732d').lerp(new THREE.Color('#708a38'), b.tint);
        }
        bushes.setColorAt(i, _color);
      });
      bushes.instanceMatrix.needsUpdate = true;
      if (bushes.instanceColor) bushes.instanceColor.needsUpdate = true;
      bushes.computeBoundingSphere();
      group.add(bushes);
      disposables.push(bushGeo, bushMat);
    }

    if (herbTransforms.length > 0) {
      const herbGeo = new THREE.ConeGeometry(0.85, 1.6, 5);
      jitterGeometry(herbGeo, 0.16, 17);
      herbGeo.translate(0, 0.8, 0);
      const herbMat = new THREE.MeshStandardMaterial({color: '#2d8f6e', roughness: 0.82});
      const herbs = new THREE.InstancedMesh(herbGeo, herbMat, herbTransforms.length);
      herbTransforms.forEach((h, i) => {
        _euler.set(0, h.rot, 0);
        _quat.setFromEuler(_euler);
        _pos.set(h.x, h.y, h.z);
        _scale.set(h.s, h.s, h.s);
        _mat4.compose(_pos, _quat, _scale);
        herbs.setMatrixAt(i, _mat4);
      });
      herbs.instanceMatrix.needsUpdate = true;
      herbs.computeBoundingSphere();
      group.add(herbs);
      disposables.push(herbGeo, herbMat);
    }

    if (reedTransforms.length > 0) {
      const reedGeo = new THREE.CylinderGeometry(0.12, 0.25, 2.8, 4);
      reedGeo.translate(0, 1.35, 0);
      const reedMat = new THREE.MeshStandardMaterial({color: '#737d3d', roughness: 0.9});
      const reeds = new THREE.InstancedMesh(reedGeo, reedMat, reedTransforms.length);
      reedTransforms.forEach((rd, i) => {
        _euler.set(0.08, rd.rot, 0);
        _quat.setFromEuler(_euler);
        _pos.set(rd.x, rd.y, rd.z);
        _scale.set(rd.s, rd.s, rd.s);
        _mat4.compose(_pos, _quat, _scale);
        reeds.setMatrixAt(i, _mat4);
      });
      reeds.instanceMatrix.needsUpdate = true;
      reeds.computeBoundingSphere();
      group.add(reeds);
      disposables.push(reedGeo, reedMat);
    }

    if (stoneTransforms.length > 0) {
      const stoneGeo = new THREE.DodecahedronGeometry(2.15, 0);
      jitterGeometry(stoneGeo, 0.26, 29);
      stoneGeo.translate(0, 1.0, 0);
      const stoneMat = new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.95,
        metalness: 0.04,
        flatShading: true,
      });
      const stones = new THREE.InstancedMesh(stoneGeo, stoneMat, stoneTransforms.length);
      stones.castShadow = budget.shadows;
      stones.receiveShadow = budget.shadows;
      stoneTransforms.forEach((st, i) => {
        _euler.set(st.tint * 0.25, st.rot, 0);
        _quat.setFromEuler(_euler);
        _pos.set(st.x, st.y, st.z);
        _scale.set(st.sx, st.sy, st.sz);
        _mat4.compose(_pos, _quat, _scale);
        stones.setMatrixAt(i, _mat4);

        _color.set('#5c6066').lerp(new THREE.Color('#7a746a'), st.tint);
        stones.setColorAt(i, _color);
      });
      stones.instanceMatrix.needsUpdate = true;
      if (stones.instanceColor) stones.instanceColor.needsUpdate = true;
      stones.computeBoundingSphere();
      group.add(stones);
      disposables.push(stoneGeo, stoneMat);
    }
  }

  // Authentic Surface Artifacts (earth_mark, stone_carving, tablet)
  const wM = terrain?.width_m ?? 2500;
  const hM = terrain?.height_m ?? 2000;

  const steleGeo = new THREE.BoxGeometry(1.35, 3.1, 0.52);
  steleGeo.translate(0, 1.55, 0);
  const tabletGeo = new THREE.BoxGeometry(1.6, 2.2, 0.35);
  tabletGeo.translate(0, 1.1, 0);
  const earthMarkGeo = new THREE.CylinderGeometry(1.7, 1.9, 0.35, 10);
  earthMarkGeo.translate(0, 0.18, 0);
  const carvingMat = new THREE.MeshStandardMaterial({
    color: '#d99b26',
    emissive: '#4f3305',
    emissiveIntensity: 0.3,
    roughness: 0.78,
  });
  const tabletMat = new THREE.MeshStandardMaterial({
    color: '#c9a66b',
    emissive: '#3b2e16',
    emissiveIntensity: 0.22,
    roughness: 0.84,
  });
  const markMat = new THREE.MeshStandardMaterial({
    color: '#a87039',
    roughness: 0.92,
  });
  disposables.push(steleGeo, tabletGeo, earthMarkGeo, carvingMat, tabletMat, markMat);

  for (const art of artifacts) {
    const {wx, wz} = simToWorldXZ(art.x, art.y, wM, hM);
    const wy = sampleElevationY(terrain, art.x, art.y);
    const geo =
      art.artifact_kind === 'earth_mark'
        ? earthMarkGeo
        : art.artifact_kind === 'tablet'
          ? tabletGeo
          : steleGeo;
    const mat =
      art.artifact_kind === 'earth_mark'
        ? markMat
        : art.artifact_kind === 'tablet'
          ? tabletMat
          : carvingMat;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(wx, wy, wz);
    mesh.rotation.y = (art.artifact_id * 0.9) % (Math.PI * 2);
    mesh.castShadow = budget.shadows;
    mesh.userData = {kind: 'artifact', artifactId: art.artifact_id};
    group.add(mesh);
    artifactMeshes.set(art.artifact_id, mesh);
  }

  // Authentic Exchange / Market Hubs
  if (exchangeHubs.length > 0) {
    const ringGeo = new THREE.RingGeometry(9.5, 11.4, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const hubMat = new THREE.MeshBasicMaterial({
      color: '#e5a93c',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
    });
    const postGeo = new THREE.CylinderGeometry(0.38, 0.52, 5.4, 7);
    postGeo.translate(0, 2.7, 0);
    const postMat = new THREE.MeshStandardMaterial({
      color: hasShelterMilestone ? '#945d2c' : '#858d96',
      roughness: 0.88,
    });
    disposables.push(ringGeo, hubMat, postGeo, postMat);

    for (const hub of exchangeHubs) {
      const {wx, wz} = simToWorldXZ(hub.x, hub.y, wM, hM);
      const wy = sampleElevationY(terrain, hub.x, hub.y);
      const hubGrp = new THREE.Group();
      hubGrp.position.set(wx, wy + 0.35, wz);
      const ring = new THREE.Mesh(ringGeo, hubMat);
      hubGrp.add(ring);
      if (hub.is_market) {
        const post = new THREE.Mesh(postGeo, postMat);
        post.castShadow = budget.shadows;
        hubGrp.add(post);
      }
      group.add(hubGrp);
    }
  }

  return {
    group,
    artifactMeshes,
    setFpvVisibleArtifacts: (visibleIds) => {
      for (const [id, mesh] of artifactMeshes.entries()) {
        mesh.visible = visibleIds === null || visibleIds.has(id);
      }
    },
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
