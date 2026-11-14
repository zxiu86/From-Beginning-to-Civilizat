import * as THREE from 'three';
import type {
  ExchangeHubItem,
  SurfaceArtifactItem,
  WorldTerrainGrid,
} from '../observatory/types';
import {sampleElevationY, simToWorldXZ} from './terrain';

const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler();

function seededUnit(idx: number, salt: number): number {
  const x = Math.sin(idx * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export interface PropsBundle {
  group: THREE.Group;
  artifactMeshes: Map<number, THREE.Object3D>;
  setFpvVisibleArtifacts: (visibleIds: Set<number> | null) => void;
  dispose: () => void;
}

export function buildWorldProps(
  terrain: WorldTerrainGrid | null,
  artifacts: SurfaceArtifactItem[],
  exchangeHubs: ExchangeHubItem[],
  hasShelterMilestone: boolean,
  season: string,
  highQuality: boolean,
): PropsBundle {
  const group = new THREE.Group();
  const disposables: Array<{dispose: () => void}> = [];
  const artifactMeshes = new Map<number, THREE.Object3D>();

  if (terrain) {
    const {cols, rows, width_m: wM, height_m: hM, cell_size_m: cellM} = terrain;
    const treeTransforms: Array<{x: number; y: number; z: number; s: number; rot: number}> = [];
    const foodTransforms: Array<{x: number; y: number; z: number; s: number}> = [];
    const herbTransforms: Array<{x: number; y: number; z: number; s: number}> = [];
    const stoneTransforms: Array<{x: number; y: number; z: number; sx: number; sy: number; sz: number; rot: number}> = [];

    const maxTrees = highQuality ? 1600 : 650;
    const maxFood = highQuality ? 1200 : 500;
    const maxHerbs = highQuality ? 550 : 220;
    const maxStones = highQuality ? 550 : 240;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const water = terrain.water[idx] ?? 0;
        if (water > 12) continue;

        const baseX = (c + 0.5) * cellM;
        const baseY = (r + 0.5) * cellM;

        const wood = terrain.wood_flora[idx] ?? 0;
        if (wood > 6 && treeTransforms.length < maxTrees) {
          const count = wood > 24 && highQuality ? 2 : 1;
          for (let k = 0; k < count; k++) {
            const ox = (seededUnit(idx, 1 + k) - 0.5) * cellM * 0.8;
            const oy = (seededUnit(idx, 2 + k) - 0.5) * cellM * 0.8;
            const sx = Math.max(5, Math.min(wM - 5, baseX + ox));
            const sy = Math.max(5, Math.min(hM - 5, baseY + oy));
            const {wx, wz} = simToWorldXZ(sx, sy, wM, hM);
            const wy = sampleElevationY(terrain, sx, sy);
            const s = 0.75 + Math.min(1.6, wood / 28) * 0.85;
            treeTransforms.push({x: wx, y: wy, z: wz, s, rot: seededUnit(idx, 3 + k) * Math.PI * 2});
          }
        }

        const food = terrain.food_flora[idx] ?? 0;
        if (food > 5 && foodTransforms.length < maxFood && (idx % (highQuality ? 2 : 3) === 0)) {
          const ox = (seededUnit(idx, 4) - 0.5) * cellM * 0.75;
          const oy = (seededUnit(idx, 5) - 0.5) * cellM * 0.75;
          const sx = Math.max(5, Math.min(wM - 5, baseX + ox));
          const sy = Math.max(5, Math.min(hM - 5, baseY + oy));
          const {wx, wz} = simToWorldXZ(sx, sy, wM, hM);
          const wy = sampleElevationY(terrain, sx, sy);
          foodTransforms.push({x: wx, y: wy, z: wz, s: 0.65 + Math.min(1.2, food / 24)});
        }

        const herb = terrain.herb_flora[idx] ?? 0;
        if (herb > 1.3 && herbTransforms.length < maxHerbs && idx % 3 === 1) {
          const sx = baseX + (seededUnit(idx, 6) - 0.5) * cellM * 0.6;
          const sy = baseY + (seededUnit(idx, 7) - 0.5) * cellM * 0.6;
          const {wx, wz} = simToWorldXZ(sx, sy, wM, hM);
          const wy = sampleElevationY(terrain, sx, sy);
          herbTransforms.push({x: wx, y: wy, z: wz, s: 0.7 + Math.min(0.8, herb * 0.2)});
        }

        const stone = terrain.stone_mineral[idx] ?? 0;
        if (stone > 6 && stoneTransforms.length < maxStones && idx % 2 === 0) {
          const sx = baseX + (seededUnit(idx, 8) - 0.5) * cellM * 0.65;
          const sy = baseY + (seededUnit(idx, 9) - 0.5) * cellM * 0.65;
          const {wx, wz} = simToWorldXZ(sx, sy, wM, hM);
          const wy = sampleElevationY(terrain, sx, sy);
          const s = 0.8 + Math.min(2.2, stone / 18);
          stoneTransforms.push({
            x: wx,
            y: wy,
            z: wz,
            sx: s * (0.8 + seededUnit(idx, 10) * 0.6),
            sy: s * (0.55 + seededUnit(idx, 11) * 0.5),
            sz: s * (0.8 + seededUnit(idx, 12) * 0.6),
            rot: seededUnit(idx, 13) * Math.PI,
          });
        }
      }
    }

    // Instanced Trees (trunk + canopy)
    if (treeTransforms.length > 0) {
      const trunkGeo = new THREE.CylinderGeometry(0.42, 0.7, 5.5, 6);
      trunkGeo.translate(0, 2.75, 0);
      const trunkMat = new THREE.MeshStandardMaterial({color: '#4f3a28', roughness: 0.95});
      const canopyGeo = new THREE.ConeGeometry(3.4, 8.2, 7);
      canopyGeo.translate(0, 8.0, 0);
      const canopyColor =
        season === 'autumn'
          ? '#8e5725'
          : season === 'winter'
            ? '#334d3e'
            : '#2c5b32';
      const canopyMat = new THREE.MeshStandardMaterial({color: canopyColor, roughness: 0.88});

      const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeTransforms.length);
      const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, treeTransforms.length);
      trunks.castShadow = highQuality;
      canopies.castShadow = highQuality;

      treeTransforms.forEach((t, i) => {
        _euler.set(0, t.rot, 0);
        _quat.setFromEuler(_euler);
        _pos.set(t.x, t.y, t.z);
        _scale.set(t.s, t.s, t.s);
        _mat4.compose(_pos, _quat, _scale);
        trunks.setMatrixAt(i, _mat4);
        canopies.setMatrixAt(i, _mat4);
      });
      trunks.instanceMatrix.needsUpdate = true;
      canopies.instanceMatrix.needsUpdate = true;
      trunks.computeBoundingSphere();
      canopies.computeBoundingSphere();

      group.add(trunks, canopies);
      disposables.push(trunkGeo, trunkMat, canopyGeo, canopyMat);
    }

    // Instanced Food Bushes
    if (foodTransforms.length > 0) {
      const bushGeo = new THREE.DodecahedronGeometry(1.75, 0);
      bushGeo.translate(0, 1.35, 0);
      const bushMat = new THREE.MeshStandardMaterial({
        color: season === 'winter' ? '#586246' : '#588234',
        roughness: 0.86,
      });
      const bushes = new THREE.InstancedMesh(bushGeo, bushMat, foodTransforms.length);
      foodTransforms.forEach((b, i) => {
        _quat.identity();
        _pos.set(b.x, b.y, b.z);
        _scale.set(b.s, b.s * 0.82, b.s);
        _mat4.compose(_pos, _quat, _scale);
        bushes.setMatrixAt(i, _mat4);
      });
      bushes.instanceMatrix.needsUpdate = true;
      bushes.computeBoundingSphere();
      group.add(bushes);
      disposables.push(bushGeo, bushMat);
    }

    // Instanced Medicinal Herbs
    if (herbTransforms.length > 0) {
      const herbGeo = new THREE.ConeGeometry(0.95, 1.8, 5);
      herbGeo.translate(0, 0.9, 0);
      const herbMat = new THREE.MeshStandardMaterial({color: '#2c9c78', roughness: 0.78});
      const herbs = new THREE.InstancedMesh(herbGeo, herbMat, herbTransforms.length);
      herbTransforms.forEach((h, i) => {
        _quat.identity();
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

    // Instanced Stone Outcrops
    if (stoneTransforms.length > 0) {
      const stoneGeo = new THREE.DodecahedronGeometry(2.1, 0);
      stoneGeo.translate(0, 1.1, 0);
      const stoneMat = new THREE.MeshStandardMaterial({color: '#6e7378', roughness: 0.94, metalness: 0.05});
      const stones = new THREE.InstancedMesh(stoneGeo, stoneMat, stoneTransforms.length);
      stones.castShadow = highQuality;
      stoneTransforms.forEach((st, i) => {
        _euler.set(0, st.rot, 0);
        _quat.setFromEuler(_euler);
        _pos.set(st.x, st.y, st.z);
        _scale.set(st.sx, st.sy, st.sz);
        _mat4.compose(_pos, _quat, _scale);
        stones.setMatrixAt(i, _mat4);
      });
      stones.instanceMatrix.needsUpdate = true;
      stones.computeBoundingSphere();
      group.add(stones);
      disposables.push(stoneGeo, stoneMat);
    }
  }

  // Authentic Surface Artifacts (earth_mark, stone_carving, tablet)
  const wM = terrain?.width_m ?? 2500;
  const hM = terrain?.height_m ?? 2000;

  const steleGeo = new THREE.BoxGeometry(1.4, 3.0, 0.55);
  steleGeo.translate(0, 1.5, 0);
  const earthMarkGeo = new THREE.CylinderGeometry(1.6, 1.8, 0.4, 8);
  earthMarkGeo.translate(0, 0.2, 0);
  const carvingMat = new THREE.MeshStandardMaterial({
    color: '#d99b26',
    emissive: '#593b08',
    emissiveIntensity: 0.35,
    roughness: 0.72,
  });
  const markMat = new THREE.MeshStandardMaterial({
    color: '#b57b3c',
    roughness: 0.88,
  });
  disposables.push(steleGeo, earthMarkGeo, carvingMat, markMat);

  for (const art of artifacts) {
    const {wx, wz} = simToWorldXZ(art.x, art.y, wM, hM);
    const wy = sampleElevationY(terrain, art.x, art.y);
    const mesh = new THREE.Mesh(
      art.artifact_kind === 'earth_mark' ? earthMarkGeo : steleGeo,
      art.artifact_kind === 'earth_mark' ? markMat : carvingMat,
    );
    mesh.position.set(wx, wy, wz);
    mesh.userData = {kind: 'artifact', artifactId: art.artifact_id};
    group.add(mesh);
    artifactMeshes.set(art.artifact_id, mesh);
  }

  // Authentic Exchange / Market Hubs (never fake buildings — simple stone ring / hearth post marker)
  if (exchangeHubs.length > 0) {
    const ringGeo = new THREE.RingGeometry(10, 12.2, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const hubMat = new THREE.MeshBasicMaterial({
      color: '#e5a93c',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    });
    const postGeo = new THREE.CylinderGeometry(0.45, 0.55, 5.2, 6);
    postGeo.translate(0, 2.6, 0);
    const postMat = new THREE.MeshStandardMaterial({
      color: hasShelterMilestone ? '#b87638' : '#9aa3ad',
      roughness: 0.85,
    });
    disposables.push(ringGeo, hubMat, postGeo, postMat);

    for (const hub of exchangeHubs) {
      const {wx, wz} = simToWorldXZ(hub.x, hub.y, wM, hM);
      const wy = sampleElevationY(terrain, hub.x, hub.y);
      const hubGrp = new THREE.Group();
      hubGrp.position.set(wx, wy + 0.3, wz);
      const ring = new THREE.Mesh(ringGeo, hubMat);
      hubGrp.add(ring);
      if (hub.is_market) {
        const post = new THREE.Mesh(postGeo, postMat);
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
