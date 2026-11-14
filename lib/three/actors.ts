import * as THREE from 'three';
import type {
  DeceasedAgentArchive,
  FaunaData,
  LivingAgentFull,
  WorldTerrainGrid,
} from '../observatory/types';
import {sampleElevationY, simToWorldXZ} from './terrain';

interface SharedResources {
  headGeo: THREE.SphereGeometry;
  torsoGeo: THREE.CylinderGeometry;
  limbGeo: THREE.CylinderGeometry;
  bellyGeo: THREE.SphereGeometry;
  hitProxyGeo: THREE.CylinderGeometry;
  ringGeo: THREE.RingGeometry;
  cairnGeo: THREE.ConeGeometry;
  cairnBaseGeo: THREE.CylinderGeometry;
  faunaBodyGeo: THREE.BoxGeometry;
  faunaHeadGeo: THREE.BoxGeometry;
  faunaLegGeo: THREE.CylinderGeometry;
  hornGeo: THREE.ConeGeometry;
  hitMat: THREE.MeshBasicMaterial;
  skinFMat: THREE.MeshStandardMaterial;
  skinMMat: THREE.MeshStandardMaterial;
  tunicHealthyF: THREE.MeshStandardMaterial;
  tunicHealthyM: THREE.MeshStandardMaterial;
  tunicStrained: THREE.MeshStandardMaterial;
  tunicCritical: THREE.MeshStandardMaterial;
  limbMat: THREE.MeshStandardMaterial;
  voiceRingMat: THREE.MeshBasicMaterial;
  selectRingMat: THREE.MeshBasicMaterial;
  replayRingMat: THREE.MeshBasicMaterial;
  cairnMat: THREE.MeshStandardMaterial;
  herbivoreMat: THREE.MeshStandardMaterial;
  predatorMat: THREE.MeshStandardMaterial;
}

function createSharedResources(): SharedResources {
  const headGeo = new THREE.SphereGeometry(0.68, 10, 8);
  const torsoGeo = new THREE.CylinderGeometry(0.62, 0.52, 1.85, 8);
  const limbGeo = new THREE.CylinderGeometry(0.2, 0.16, 1.45, 6);
  const bellyGeo = new THREE.SphereGeometry(0.55, 8, 6);
  const hitProxyGeo = new THREE.CylinderGeometry(2.1, 2.1, 5.2, 8);
  hitProxyGeo.translate(0, 2.6, 0);

  const ringGeo = new THREE.RingGeometry(2.3, 2.95, 24);
  ringGeo.rotateX(-Math.PI / 2);

  const cairnGeo = new THREE.ConeGeometry(0.95, 1.35, 6);
  cairnGeo.translate(0, 0.8, 0);
  const cairnBaseGeo = new THREE.CylinderGeometry(1.2, 1.35, 0.35, 7);
  cairnBaseGeo.translate(0, 0.175, 0);

  const faunaBodyGeo = new THREE.BoxGeometry(2.4, 1.15, 1.1);
  const faunaHeadGeo = new THREE.BoxGeometry(0.85, 0.72, 0.78);
  const faunaLegGeo = new THREE.CylinderGeometry(0.14, 0.12, 1.1, 5);
  const hornGeo = new THREE.ConeGeometry(0.12, 0.75, 4);

  return {
    headGeo,
    torsoGeo,
    limbGeo,
    bellyGeo,
    hitProxyGeo,
    ringGeo,
    cairnGeo,
    cairnBaseGeo,
    faunaBodyGeo,
    faunaHeadGeo,
    faunaLegGeo,
    hornGeo,
    hitMat: new THREE.MeshBasicMaterial({transparent: true, opacity: 0, depthWrite: false}),
    skinFMat: new THREE.MeshStandardMaterial({color: '#d2a17c', roughness: 0.78}),
    skinMMat: new THREE.MeshStandardMaterial({color: '#c28d68', roughness: 0.78}),
    tunicHealthyF: new THREE.MeshStandardMaterial({color: '#3498a8', roughness: 0.82}),
    tunicHealthyM: new THREE.MeshStandardMaterial({color: '#4e8c57', roughness: 0.82}),
    tunicStrained: new THREE.MeshStandardMaterial({color: '#d99b26', roughness: 0.8}),
    tunicCritical: new THREE.MeshStandardMaterial({color: '#cf4842', roughness: 0.78}),
    limbMat: new THREE.MeshStandardMaterial({color: '#3b332d', roughness: 0.88}),
    voiceRingMat: new THREE.MeshBasicMaterial({
      color: '#57b8d8',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.72,
    }),
    selectRingMat: new THREE.MeshBasicMaterial({
      color: '#f2be49',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
    }),
    replayRingMat: new THREE.MeshBasicMaterial({
      color: '#e66353',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
    }),
    cairnMat: new THREE.MeshStandardMaterial({color: '#6b7280', roughness: 0.95}),
    herbivoreMat: new THREE.MeshStandardMaterial({color: '#a3895d', roughness: 0.86}),
    predatorMat: new THREE.MeshStandardMaterial({color: '#8c3c32', roughness: 0.82}),
  };
}

export interface LivingActorHandle {
  agentId: number;
  root: THREE.Group;
  bodyPivot: THREE.Group;
  torsoMesh: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  bellyMesh: THREE.Mesh;
  voiceRing: THREE.Mesh;
  selectRing: THREE.Mesh;
  replayRing: THREE.Mesh;
  hitMesh: THREE.Mesh;
  lastAction: string;
  phase: number;
  baseScale: number;
  targetPos: THREE.Vector3;
}

export class ActorsManager {
  public readonly livingGroup = new THREE.Group();
  public readonly deceasedGroup = new THREE.Group();
  public readonly faunaGroup = new THREE.Group();

  private readonly res: SharedResources;
  private readonly livingMap = new Map<number, LivingActorHandle>();
  private readonly deceasedMap = new Map<number, THREE.Group>();
  private readonly faunaMap = new Map<number, THREE.Group>();
  private readonly hitTargets: THREE.Object3D[] = [];

  constructor() {
    this.res = createSharedResources();
  }

  public getRaycastTargets(): THREE.Object3D[] {
    return this.hitTargets;
  }

  private rebuildHitTargets(): void {
    this.hitTargets.length = 0;
    for (const h of this.livingMap.values()) {
      if (h.root.visible) this.hitTargets.push(h.hitMesh);
    }
    for (const d of this.deceasedMap.values()) {
      if (d.visible) this.hitTargets.push(d);
    }
    for (const f of this.faunaMap.values()) {
      if (f.visible) this.hitTargets.push(f);
    }
  }

  private createLivingActor(agent: LivingAgentFull, highQuality: boolean): LivingActorHandle {
    const root = new THREE.Group();
    const bodyPivot = new THREE.Group();
    root.add(bodyPivot);

    const skinMat = agent.sex === 'F' ? this.res.skinFMat : this.res.skinMMat;
    const head = new THREE.Mesh(this.res.headGeo, skinMat);
    head.position.set(0, 3.65, 0);
    head.castShadow = highQuality;

    const torso = new THREE.Mesh(this.res.torsoGeo, this.res.tunicHealthyM);
    torso.position.set(0, 2.25, 0);
    torso.castShadow = highQuality;

    const leftArm = new THREE.Mesh(this.res.limbGeo, skinMat);
    leftArm.position.set(-0.82, 2.25, 0);
    const rightArm = new THREE.Mesh(this.res.limbGeo, skinMat);
    rightArm.position.set(0.82, 2.25, 0);

    const leftLeg = new THREE.Mesh(this.res.limbGeo, this.res.limbMat);
    leftLeg.position.set(-0.32, 0.78, 0);
    const rightLeg = new THREE.Mesh(this.res.limbGeo, this.res.limbMat);
    rightLeg.position.set(0.32, 0.78, 0);

    const bellyMesh = new THREE.Mesh(this.res.bellyGeo, this.res.tunicHealthyF);
    bellyMesh.position.set(0, 1.9, 0.35);
    bellyMesh.visible = false;

    bodyPivot.add(head, torso, leftArm, rightArm, leftLeg, rightLeg, bellyMesh);

    const voiceRing = new THREE.Mesh(this.res.ringGeo, this.res.voiceRingMat);
    voiceRing.position.set(0, 0.28, 0);
    voiceRing.visible = false;

    const selectRing = new THREE.Mesh(this.res.ringGeo, this.res.selectRingMat);
    selectRing.position.set(0, 0.35, 0);
    selectRing.scale.setScalar(1.22);
    selectRing.visible = false;

    const replayRing = new THREE.Mesh(this.res.ringGeo, this.res.replayRingMat);
    replayRing.position.set(0, 0.32, 0);
    replayRing.scale.setScalar(1.45);
    replayRing.visible = false;

    const hitMesh = new THREE.Mesh(this.res.hitProxyGeo, this.res.hitMat);
    hitMesh.userData = {kind: 'agent', agentId: agent.agent_id};

    root.add(voiceRing, selectRing, replayRing, hitMesh);

    return {
      agentId: agent.agent_id,
      root,
      bodyPivot,
      torsoMesh: torso,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      bellyMesh,
      voiceRing,
      selectRing,
      replayRing,
      hitMesh,
      lastAction: agent.last_action,
      phase: (agent.agent_id * 1.37) % (Math.PI * 2),
      baseScale: 1,
      targetPos: new THREE.Vector3(),
    };
  }

  public reconcile(
    livingAgents: LivingAgentFull[],
    deceasedArchive: DeceasedAgentArchive[],
    faunaList: FaunaData[],
    terrain: WorldTerrainGrid | null,
    highQuality: boolean,
  ): void {
    const wM = terrain?.width_m ?? 2500;
    const hM = terrain?.height_m ?? 2000;

    // 1. Living Agents (keyed strictly by immutable agent_id)
    const incomingLiving = new Set<number>();
    for (const ag of livingAgents) {
      incomingLiving.add(ag.agent_id);
      let handle = this.livingMap.get(ag.agent_id);
      const isNew = !handle;
      if (!handle) {
        handle = this.createLivingActor(ag, highQuality);
        this.livingMap.set(ag.agent_id, handle);
        this.livingGroup.add(handle.root);
      }

      const {wx, wz} = simToWorldXZ(ag.x, ag.y, wM, hM);
      const wy = sampleElevationY(terrain, ag.x, ag.y);
      handle.targetPos.set(wx, wy, wz);
      if (isNew) {
        handle.root.position.copy(handle.targetPos);
      }

      const stageScale =
        ag.life_stage === 'infant'
          ? 0.48
          : ag.life_stage === 'child'
            ? 0.74
            : ag.life_stage === 'elder'
              ? 0.94
              : 1.04;
      handle.baseScale = stageScale;
      handle.bodyPivot.scale.setScalar(stageScale);

      // Update vitality tunic material
      if (ag.health < 0.38 || ag.hunger > 0.85 || ag.thirst > 0.85) {
        handle.torsoMesh.material = this.res.tunicCritical;
      } else if (ag.health < 0.68 || ag.hunger > 0.65 || ag.thirst > 0.65) {
        handle.torsoMesh.material = this.res.tunicStrained;
      } else {
        handle.torsoMesh.material =
          ag.sex === 'F' ? this.res.tunicHealthyF : this.res.tunicHealthyM;
      }

      handle.bellyMesh.visible = ag.is_pregnant;
      handle.lastAction = ag.last_action;
      handle.voiceRing.visible =
        ag.last_action === 'communicate' || ag.last_emitted_token !== null;
    }

    for (const [aid, handle] of this.livingMap.entries()) {
      if (!incomingLiving.has(aid)) {
        this.livingGroup.remove(handle.root);
        this.livingMap.delete(aid);
      }
    }

    // 2. Deceased Memorial Cairns (cap visible cairns on huge histories to last 180 for clarity, preserving inspector access to all)
    const recentDeceased = deceasedArchive.slice(-180);
    const incomingDeceased = new Set<number>();
    for (const d of recentDeceased) {
      incomingDeceased.add(d.agent_id);
      let marker = this.deceasedMap.get(d.agent_id);
      if (!marker) {
        marker = new THREE.Group();
        const base = new THREE.Mesh(this.res.cairnBaseGeo, this.res.cairnMat);
        const cone = new THREE.Mesh(this.res.cairnGeo, this.res.cairnMat);
        base.userData = {kind: 'deceased', agentId: d.agent_id};
        cone.userData = {kind: 'deceased', agentId: d.agent_id};
        marker.userData = {kind: 'deceased', agentId: d.agent_id};
        marker.add(base, cone);
        this.deceasedMap.set(d.agent_id, marker);
        this.deceasedGroup.add(marker);
      }
      const {wx, wz} = simToWorldXZ(d.x, d.y, wM, hM);
      const wy = sampleElevationY(terrain, d.x, d.y);
      marker.position.set(wx, wy, wz);
    }
    for (const [aid, marker] of this.deceasedMap.entries()) {
      if (!incomingDeceased.has(aid)) {
        this.deceasedGroup.remove(marker);
        this.deceasedMap.delete(aid);
      }
    }

    // 3. Fauna
    const incomingFauna = new Set<number>();
    for (const f of faunaList) {
      incomingFauna.add(f.fauna_id);
      let fGrp = this.faunaMap.get(f.fauna_id);
      if (!fGrp) {
        fGrp = new THREE.Group();
        const isPred = f.species === 'predator';
        const mat = isPred ? this.res.predatorMat : this.res.herbivoreMat;
        const body = new THREE.Mesh(this.res.faunaBodyGeo, mat);
        body.position.set(0, 1.3, 0);
        if (isPred) body.scale.set(1.12, 0.88, 0.86);

        const head = new THREE.Mesh(this.res.faunaHeadGeo, mat);
        head.position.set(1.35, 1.65, 0);

        fGrp.add(body, head);
        const legOffsets: Array<[number, number]> = [
          [-0.75, -0.35],
          [-0.75, 0.35],
          [0.75, -0.35],
          [0.75, 0.35],
        ];
        for (const [lx, lz] of legOffsets) {
          const leg = new THREE.Mesh(this.res.faunaLegGeo, mat);
          leg.position.set(lx, 0.55, lz);
          fGrp.add(leg);
        }
        if (!isPred) {
          const hornL = new THREE.Mesh(this.res.hornGeo, this.res.cairnMat);
          hornL.position.set(1.4, 2.2, -0.22);
          const hornR = new THREE.Mesh(this.res.hornGeo, this.res.cairnMat);
          hornR.position.set(1.4, 2.2, 0.22);
          fGrp.add(hornL, hornR);
        }
        fGrp.rotation.y = (f.fauna_id * 1.1) % (Math.PI * 2);
        fGrp.userData = {kind: 'fauna', faunaId: f.fauna_id};
        this.faunaMap.set(f.fauna_id, fGrp);
        this.faunaGroup.add(fGrp);
      }
      const {wx, wz} = simToWorldXZ(f.x, f.y, wM, hM);
      const wy = sampleElevationY(terrain, f.x, f.y);
      fGrp.position.set(wx, wy, wz);
    }
    for (const [fid, fGrp] of this.faunaMap.entries()) {
      if (!incomingFauna.has(fid)) {
        this.faunaGroup.remove(fGrp);
        this.faunaMap.delete(fid);
      }
    }

    this.rebuildHitTargets();
  }

  public applyFpvVisibility(
    observerAgentId: number | null,
    visibleAgentIds: Set<number> | null,
    visibleFaunaIds: Set<number> | null,
  ): void {
    const isFpv = observerAgentId !== null && visibleAgentIds !== null;
    for (const [aid, h] of this.livingMap.entries()) {
      if (!isFpv) {
        h.root.visible = true;
        h.bodyPivot.visible = true;
      } else if (aid === observerAgentId) {
        // Hide own head/body from FPV eye camera so camera doesn't clip inside self
        h.root.visible = true;
        h.bodyPivot.visible = false;
      } else {
        h.root.visible = visibleAgentIds.has(aid);
        h.bodyPivot.visible = h.root.visible;
      }
    }
    for (const d of this.deceasedMap.values()) {
      d.visible = !isFpv;
    }
    for (const [fid, fGrp] of this.faunaMap.entries()) {
      fGrp.visible = !isFpv || (visibleFaunaIds ? visibleFaunaIds.has(fid) : false);
    }
    this.rebuildHitTargets();
  }

  public highlightAgents(
    selectedAgentId: number | null,
    replayParticipantIds: Set<number>,
  ): void {
    for (const [aid, h] of this.livingMap.entries()) {
      h.selectRing.visible = selectedAgentId === aid;
      h.replayRing.visible = replayParticipantIds.has(aid);
    }
  }

  public getLivingActorPosition(agentId: number): THREE.Vector3 | null {
    const h = this.livingMap.get(agentId);
    return h ? h.root.position : null;
  }

  public tick(elapsedS: number, dt: number): void {
    const lerpAlpha = Math.min(1, dt * 6);
    for (const h of this.livingMap.values()) {
      if (!h.root.visible) continue;
      h.root.position.lerp(h.targetPos, lerpAlpha);

      const t = elapsedS * 3.4 + h.phase;
      const act = h.lastAction;

      if (act === 'rest') {
        h.bodyPivot.position.y = -0.55 * h.baseScale;
        h.bodyPivot.rotation.x = 0.35;
        h.leftArm.rotation.x = 0;
        h.rightArm.rotation.x = 0;
        h.leftLeg.rotation.x = 0;
        h.rightLeg.rotation.x = 0;
      } else if (act.startsWith('move_') || act === 'flee') {
        const swing = Math.sin(t * 1.4) * 0.48;
        h.bodyPivot.position.y = Math.abs(Math.sin(t * 1.4)) * 0.14;
        h.bodyPivot.rotation.x = 0.08;
        h.leftLeg.rotation.x = swing;
        h.rightLeg.rotation.x = -swing;
        h.leftArm.rotation.x = -swing * 0.85;
        h.rightArm.rotation.x = swing * 0.85;
      } else if (act === 'attack' || act === 'steal') {
        h.bodyPivot.position.y = 0;
        h.bodyPivot.rotation.x = 0.18;
        h.rightArm.rotation.x = -1.35 + Math.sin(t * 2.2) * 0.35;
        h.leftArm.rotation.x = -0.35;
      } else if (
        act === 'forage' ||
        act === 'drink' ||
        act === 'gather_wood' ||
        act === 'gather_stone' ||
        act === 'gather_herb' ||
        act === 'carve_artifact'
      ) {
        h.bodyPivot.position.y = 0;
        h.bodyPivot.rotation.x = 0.25 + Math.sin(t) * 0.08;
        h.rightArm.rotation.x = -0.65 + Math.sin(t * 1.6) * 0.25;
        h.leftArm.rotation.x = -0.45;
      } else {
        h.bodyPivot.position.y = 0;
        h.bodyPivot.rotation.x = Math.sin(t * 0.4) * 0.03;
        h.leftArm.rotation.x = Math.sin(t * 0.5) * 0.06;
        h.rightArm.rotation.x = -Math.sin(t * 0.5) * 0.06;
        h.leftLeg.rotation.x = 0;
        h.rightLeg.rotation.x = 0;
      }

      if (h.voiceRing.visible) {
        const pulse = 1 + ((elapsedS * 1.5 + h.phase) % 1) * 0.85;
        h.voiceRing.scale.setScalar(pulse);
      }
    }
  }

  public dispose(): void {
    this.res.headGeo.dispose();
    this.res.torsoGeo.dispose();
    this.res.limbGeo.dispose();
    this.res.bellyGeo.dispose();
    this.res.hitProxyGeo.dispose();
    this.res.ringGeo.dispose();
    this.res.cairnGeo.dispose();
    this.res.cairnBaseGeo.dispose();
    this.res.faunaBodyGeo.dispose();
    this.res.faunaHeadGeo.dispose();
    this.res.faunaLegGeo.dispose();
    this.res.hornGeo.dispose();

    this.res.hitMat.dispose();
    this.res.skinFMat.dispose();
    this.res.skinMMat.dispose();
    this.res.tunicHealthyF.dispose();
    this.res.tunicHealthyM.dispose();
    this.res.tunicStrained.dispose();
    this.res.tunicCritical.dispose();
    this.res.limbMat.dispose();
    this.res.voiceRingMat.dispose();
    this.res.selectRingMat.dispose();
    this.res.replayRingMat.dispose();
    this.res.cairnMat.dispose();
    this.res.herbivoreMat.dispose();
    this.res.predatorMat.dispose();
  }
}
