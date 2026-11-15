import * as THREE from 'three';
import type {
  DeceasedAgentArchive,
  FaunaData,
  LivingAgentFull,
  QualityPreset,
  WorldTerrainGrid,
} from '../observatory/types';
import {sampleElevationY, simToWorldXZ} from './terrain';

interface SharedResources {
  headGeo: THREE.SphereGeometry;
  hairCapGeo: THREE.SphereGeometry;
  neckGeo: THREE.CylinderGeometry;
  torsoGeo: THREE.CylinderGeometry;
  sashGeo: THREE.CylinderGeometry;
  armGeo: THREE.CylinderGeometry;
  legGeo: THREE.CylinderGeometry;
  bellyGeo: THREE.SphereGeometry;
  carriedItemGeo: THREE.BoxGeometry;
  midProxyGeo: THREE.CapsuleGeometry;
  farDotGeo: THREE.SphereGeometry;
  shadowDiscGeo: THREE.CircleGeometry;
  hitProxyGeo: THREE.CylinderGeometry;
  ringGeo: THREE.RingGeometry;
  cairnGeo: THREE.ConeGeometry;
  cairnMidGeo: THREE.DodecahedronGeometry;
  cairnBaseGeo: THREE.CylinderGeometry;
  faunaBodyGeo: THREE.CapsuleGeometry;
  faunaNeckGeo: THREE.CylinderGeometry;
  faunaHeadGeo: THREE.DodecahedronGeometry;
  faunaSnoutGeo: THREE.BoxGeometry;
  faunaLegGeo: THREE.CylinderGeometry;
  faunaTailGeo: THREE.CylinderGeometry;
  hornGeo: THREE.ConeGeometry;
  earGeo: THREE.ConeGeometry;
  hitMat: THREE.MeshBasicMaterial;
  shadowDiscMat: THREE.MeshBasicMaterial;
  skinMats: THREE.MeshStandardMaterial[];
  hairDarkMat: THREE.MeshStandardMaterial;
  hairBrownMat: THREE.MeshStandardMaterial;
  hairElderMat: THREE.MeshStandardMaterial;
  tunicHealthyF: THREE.MeshStandardMaterial;
  tunicHealthyM: THREE.MeshStandardMaterial;
  tunicStrained: THREE.MeshStandardMaterial;
  tunicCritical: THREE.MeshStandardMaterial;
  carriedItemMats: Record<string, THREE.MeshStandardMaterial>;
  farDotHealthyMat: THREE.MeshBasicMaterial;
  farDotStrainedMat: THREE.MeshBasicMaterial;
  sashMat: THREE.MeshStandardMaterial;
  limbMat: THREE.MeshStandardMaterial;
  voiceRingMat: THREE.MeshBasicMaterial;
  selectRingMat: THREE.MeshBasicMaterial;
  replayRingMat: THREE.MeshBasicMaterial;
  cairnMat: THREE.MeshStandardMaterial;
  herbivoreMat: THREE.MeshStandardMaterial;
  predatorMat: THREE.MeshStandardMaterial;
}

function createSharedResources(): SharedResources {
  const headGeo = new THREE.SphereGeometry(0.64, 14, 12);
  const hairCapGeo = new THREE.SphereGeometry(0.67, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.56);
  const neckGeo = new THREE.CylinderGeometry(0.22, 0.25, 0.34, 8);
  const torsoGeo = new THREE.CylinderGeometry(0.68, 0.52, 1.82, 10);
  const sashGeo = new THREE.CylinderGeometry(0.54, 0.56, 0.28, 10);
  const armGeo = new THREE.CylinderGeometry(0.18, 0.14, 1.48, 8);
  const legGeo = new THREE.CylinderGeometry(0.22, 0.16, 1.52, 8);
  const bellyGeo = new THREE.SphereGeometry(0.56, 10, 8);
  const carriedItemGeo = new THREE.BoxGeometry(0.46, 0.46, 0.46);
  const midProxyGeo = new THREE.CapsuleGeometry(0.58, 2.2, 4, 6);
  midProxyGeo.translate(0, 1.9, 0);
  const farDotGeo = new THREE.SphereGeometry(1.15, 6, 4);
  farDotGeo.translate(0, 2.2, 0);

  const shadowDiscGeo = new THREE.CircleGeometry(1.15, 16);
  shadowDiscGeo.rotateX(-Math.PI / 2);

  const hitProxyGeo = new THREE.CylinderGeometry(2.1, 2.1, 5.2, 8);
  hitProxyGeo.translate(0, 2.6, 0);

  const ringGeo = new THREE.RingGeometry(2.3, 2.95, 28);
  ringGeo.rotateX(-Math.PI / 2);

  const cairnBaseGeo = new THREE.CylinderGeometry(1.25, 1.42, 0.38, 7);
  cairnBaseGeo.translate(0, 0.19, 0);
  const cairnMidGeo = new THREE.DodecahedronGeometry(0.88, 0);
  cairnMidGeo.translate(0, 0.72, 0);
  const cairnGeo = new THREE.ConeGeometry(0.75, 1.05, 6);
  cairnGeo.translate(0, 1.42, 0);

  const faunaBodyGeo = new THREE.CapsuleGeometry(0.62, 1.45, 6, 10);
  faunaBodyGeo.rotateZ(Math.PI / 2);
  const faunaNeckGeo = new THREE.CylinderGeometry(0.28, 0.42, 0.95, 8);
  const faunaHeadGeo = new THREE.DodecahedronGeometry(0.52, 1);
  const faunaSnoutGeo = new THREE.BoxGeometry(0.56, 0.34, 0.38);
  const faunaLegGeo = new THREE.CylinderGeometry(0.15, 0.1, 1.18, 7);
  const faunaTailGeo = new THREE.CylinderGeometry(0.08, 0.05, 0.95, 6);
  const hornGeo = new THREE.ConeGeometry(0.11, 0.82, 5);
  const earGeo = new THREE.ConeGeometry(0.12, 0.34, 4);

  return {
    headGeo,
    hairCapGeo,
    neckGeo,
    torsoGeo,
    sashGeo,
    armGeo,
    legGeo,
    bellyGeo,
    carriedItemGeo,
    midProxyGeo,
    farDotGeo,
    shadowDiscGeo,
    hitProxyGeo,
    ringGeo,
    cairnGeo,
    cairnMidGeo,
    cairnBaseGeo,
    faunaBodyGeo,
    faunaNeckGeo,
    faunaHeadGeo,
    faunaSnoutGeo,
    faunaLegGeo,
    faunaTailGeo,
    hornGeo,
    earGeo,
    hitMat: new THREE.MeshBasicMaterial({transparent: true, opacity: 0, depthWrite: false}),
    shadowDiscMat: new THREE.MeshBasicMaterial({
      color: '#06080b',
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    }),
    skinMats: [
      new THREE.MeshStandardMaterial({color: '#d8aa86', roughness: 0.74}),
      new THREE.MeshStandardMaterial({color: '#c28c64', roughness: 0.76}),
      new THREE.MeshStandardMaterial({color: '#9e6c4b', roughness: 0.78}),
    ],
    hairDarkMat: new THREE.MeshStandardMaterial({color: '#1e1a18', roughness: 0.92}),
    hairBrownMat: new THREE.MeshStandardMaterial({color: '#4f3524', roughness: 0.9}),
    hairElderMat: new THREE.MeshStandardMaterial({color: '#adb5bd', roughness: 0.88}),
    tunicHealthyF: new THREE.MeshStandardMaterial({color: '#2e8899', roughness: 0.84}),
    tunicHealthyM: new THREE.MeshStandardMaterial({color: '#467d4e', roughness: 0.84}),
    tunicStrained: new THREE.MeshStandardMaterial({color: '#d99b26', roughness: 0.8}),
    tunicCritical: new THREE.MeshStandardMaterial({color: '#cf4842', roughness: 0.78}),
    carriedItemMats: {
      food: new THREE.MeshStandardMaterial({color: '#7ab344', roughness: 0.8}),
      wood: new THREE.MeshStandardMaterial({color: '#704a2b', roughness: 0.92}),
      stone: new THREE.MeshStandardMaterial({color: '#889099', roughness: 0.9}),
      herb: new THREE.MeshStandardMaterial({color: '#2d9e77', roughness: 0.8}),
      tool: new THREE.MeshStandardMaterial({color: '#d99b26', roughness: 0.65, metalness: 0.2}),
    },
    farDotHealthyMat: new THREE.MeshBasicMaterial({color: '#63b8c9'}),
    farDotStrainedMat: new THREE.MeshBasicMaterial({color: '#d99b26'}),
    sashMat: new THREE.MeshStandardMaterial({color: '#4e3928', roughness: 0.9}),
    limbMat: new THREE.MeshStandardMaterial({color: '#342c26', roughness: 0.88}),
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
    cairnMat: new THREE.MeshStandardMaterial({color: '#6b7278', roughness: 0.95}),
    herbivoreMat: new THREE.MeshStandardMaterial({color: '#9c7f53', roughness: 0.84}),
    predatorMat: new THREE.MeshStandardMaterial({color: '#733128', roughness: 0.8}),
  };
}

export interface LivingActorHandle {
  agentId: number;
  root: THREE.Group;
  bodyPivot: THREE.Group;
  midProxyMesh: THREE.Mesh;
  farDotMesh: THREE.Mesh;
  hairMesh: THREE.Mesh;
  torsoMesh: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  bellyMesh: THREE.Mesh;
  carriedMesh: THREE.Mesh;
  voiceRing: THREE.Mesh;
  selectRing: THREE.Mesh;
  replayRing: THREE.Mesh;
  hitMesh: THREE.Mesh;
  lastAction: string;
  lastPartnerId: number | null;
  phase: number;
  baseScale: number;
  isFpvSelfHidden: boolean;
  targetPos: THREE.Vector3;
}

const _frustum = new THREE.Frustum();
const _projScreenMatrix = new THREE.Matrix4();
const _actorSphere = new THREE.Sphere(new THREE.Vector3(), 6);

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

  private createLivingActor(agent: LivingAgentFull, castShadows: boolean): LivingActorHandle {
    const root = new THREE.Group();
    const bodyPivot = new THREE.Group();
    root.add(bodyPivot);

    const skinMat = this.res.skinMats[Math.abs(agent.agent_id) % this.res.skinMats.length];
    const head = new THREE.Mesh(this.res.headGeo, skinMat);
    head.position.set(0, 3.68, 0);
    head.castShadow = castShadows;

    const hairMat = agent.agent_id % 3 === 0 ? this.res.hairBrownMat : this.res.hairDarkMat;
    const hairMesh = new THREE.Mesh(this.res.hairCapGeo, hairMat);
    hairMesh.position.set(0, 3.74, -0.03);
    hairMesh.rotation.x = -0.18;
    hairMesh.castShadow = castShadows;

    const neck = new THREE.Mesh(this.res.neckGeo, skinMat);
    neck.position.set(0, 3.12, 0);

    const torso = new THREE.Mesh(this.res.torsoGeo, this.res.tunicHealthyM);
    torso.position.set(0, 2.24, 0);
    torso.castShadow = castShadows;

    const sash = new THREE.Mesh(this.res.sashGeo, this.res.sashMat);
    sash.position.set(0, 1.56, 0);

    const leftArm = new THREE.Mesh(this.res.armGeo, skinMat);
    leftArm.position.set(-0.84, 2.22, 0);
    leftArm.castShadow = castShadows;
    const rightArm = new THREE.Mesh(this.res.armGeo, skinMat);
    rightArm.position.set(0.84, 2.22, 0);
    rightArm.castShadow = castShadows;

    const carriedMesh = new THREE.Mesh(
      this.res.carriedItemGeo,
      this.res.carriedItemMats.food,
    );
    carriedMesh.position.set(0, -0.78, 0.25);
    carriedMesh.visible = false;
    rightArm.add(carriedMesh);

    const leftLeg = new THREE.Mesh(this.res.legGeo, this.res.limbMat);
    leftLeg.position.set(-0.3, 0.78, 0);
    leftLeg.castShadow = castShadows;
    const rightLeg = new THREE.Mesh(this.res.legGeo, this.res.limbMat);
    rightLeg.position.set(0.3, 0.78, 0);
    rightLeg.castShadow = castShadows;

    const bellyMesh = new THREE.Mesh(this.res.bellyGeo, this.res.tunicHealthyF);
    bellyMesh.position.set(0, 1.9, 0.35);
    bellyMesh.visible = false;

    const contactShadow = new THREE.Mesh(this.res.shadowDiscGeo, this.res.shadowDiscMat);
    contactShadow.position.set(0, 0.08, 0);

    bodyPivot.add(
      head,
      hairMesh,
      neck,
      torso,
      sash,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      bellyMesh,
    );

    const midProxyMesh = new THREE.Mesh(this.res.midProxyGeo, this.res.tunicHealthyM);
    midProxyMesh.visible = false;

    const farDotMesh = new THREE.Mesh(this.res.farDotGeo, this.res.farDotHealthyMat);
    farDotMesh.visible = false;

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

    root.add(
      midProxyMesh,
      farDotMesh,
      contactShadow,
      voiceRing,
      selectRing,
      replayRing,
      hitMesh,
    );

    return {
      agentId: agent.agent_id,
      root,
      bodyPivot,
      midProxyMesh,
      farDotMesh,
      hairMesh,
      torsoMesh: torso,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      bellyMesh,
      carriedMesh,
      voiceRing,
      selectRing,
      replayRing,
      hitMesh,
      lastAction: agent.last_action,
      lastPartnerId: agent.last_partner_id,
      phase: (agent.agent_id * 1.37) % (Math.PI * 2),
      baseScale: 1,
      isFpvSelfHidden: false,
      targetPos: new THREE.Vector3(),
    };
  }

  public reconcile(
    livingAgents: LivingAgentFull[],
    deceasedArchive: DeceasedAgentArchive[],
    faunaList: FaunaData[],
    terrain: WorldTerrainGrid | null,
    castShadows: boolean,
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
        handle = this.createLivingActor(ag, castShadows);
        this.livingMap.set(ag.agent_id, handle);
        this.livingGroup.add(handle.root);
      }

      const {wx, wz} = simToWorldXZ(ag.x, ag.y, wM, hM);
      const wy = sampleElevationY(terrain, ag.x, ag.y);
      handle.targetPos.set(wx, wy, wz);
      if (isNew) {
        handle.root.position.copy(handle.targetPos);
        handle.root.rotation.y = (ag.agent_id * 2.13) % (Math.PI * 2);
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
      handle.midProxyMesh.scale.setScalar(stageScale);

      if (ag.life_stage === 'elder') {
        handle.hairMesh.material = this.res.hairElderMat;
      } else {
        handle.hairMesh.material =
          ag.agent_id % 3 === 0 ? this.res.hairBrownMat : this.res.hairDarkMat;
      }

      const isCritical = ag.health < 0.38 || ag.hunger > 0.85 || ag.thirst > 0.85;
      const isStrained = ag.health < 0.68 || ag.hunger > 0.65 || ag.thirst > 0.65;
      const tunicMat = isCritical
        ? this.res.tunicCritical
        : isStrained
          ? this.res.tunicStrained
          : ag.sex === 'F'
            ? this.res.tunicHealthyF
            : this.res.tunicHealthyM;
      handle.torsoMesh.material = tunicMat;
      handle.midProxyMesh.material = tunicMat;
      handle.farDotMesh.material =
        isCritical || isStrained ? this.res.farDotStrainedMat : this.res.farDotHealthyMat;

      if (ag.carried_item && this.res.carriedItemMats[ag.carried_item]) {
        handle.carriedMesh.material = this.res.carriedItemMats[ag.carried_item];
        handle.carriedMesh.visible = true;
      } else {
        handle.carriedMesh.visible = false;
      }

      handle.bellyMesh.visible = ag.is_pregnant;
      handle.lastAction = ag.last_action;
      handle.lastPartnerId = ag.last_partner_id;
      handle.voiceRing.visible =
        ag.last_action === 'communicate' ||
        ag.last_action === 'communicate_or_teach' ||
        ag.last_emitted_token !== null;
    }

    for (const [aid, handle] of this.livingMap.entries()) {
      if (!incomingLiving.has(aid)) {
        this.livingGroup.remove(handle.root);
        this.livingMap.delete(aid);
      }
    }

    // 2. Deceased Memorial Cairns (cap visible cairns to last 180)
    const recentDeceased = deceasedArchive.slice(-180);
    const incomingDeceased = new Set<number>();
    for (const d of recentDeceased) {
      incomingDeceased.add(d.agent_id);
      let marker = this.deceasedMap.get(d.agent_id);
      if (!marker) {
        marker = new THREE.Group();
        const base = new THREE.Mesh(this.res.cairnBaseGeo, this.res.cairnMat);
        const mid = new THREE.Mesh(this.res.cairnMidGeo, this.res.cairnMat);
        const cone = new THREE.Mesh(this.res.cairnGeo, this.res.cairnMat);
        base.castShadow = castShadows;
        mid.castShadow = castShadows;
        base.userData = {kind: 'deceased', agentId: d.agent_id};
        mid.userData = {kind: 'deceased', agentId: d.agent_id};
        cone.userData = {kind: 'deceased', agentId: d.agent_id};
        marker.userData = {kind: 'deceased', agentId: d.agent_id};
        marker.add(base, mid, cone);
        marker.rotation.y = (d.agent_id * 0.87) % (Math.PI * 2);
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

    // 3. Articulated Fauna
    const incomingFauna = new Set<number>();
    for (const f of faunaList) {
      incomingFauna.add(f.fauna_id);
      let fGrp = this.faunaMap.get(f.fauna_id);
      if (!fGrp) {
        fGrp = new THREE.Group();
        const isPred = f.species === 'predator';
        const mat = isPred ? this.res.predatorMat : this.res.herbivoreMat;

        const body = new THREE.Mesh(this.res.faunaBodyGeo, mat);
        body.position.set(0, 1.38, 0);
        body.castShadow = castShadows;
        if (isPred) body.scale.set(1.08, 0.84, 0.82);

        const neck = new THREE.Mesh(this.res.faunaNeckGeo, mat);
        neck.position.set(1.08, isPred ? 1.56 : 1.72, 0);
        neck.rotation.z = isPred ? -0.95 : -0.58;

        const head = new THREE.Mesh(this.res.faunaHeadGeo, mat);
        head.position.set(1.48, isPred ? 1.72 : 2.02, 0);
        head.scale.set(1.05, 0.85, 0.82);

        const snout = new THREE.Mesh(this.res.faunaSnoutGeo, mat);
        snout.position.set(1.92, isPred ? 1.66 : 1.94, 0);

        const tail = new THREE.Mesh(this.res.faunaTailGeo, mat);
        tail.position.set(-1.38, isPred ? 1.48 : 1.32, 0);
        tail.rotation.z = isPred ? 0.95 : 0.45;

        const shadow = new THREE.Mesh(this.res.shadowDiscGeo, this.res.shadowDiscMat);
        shadow.position.set(0, 0.08, 0);
        shadow.scale.set(1.4, 1, 0.9);

        fGrp.add(shadow, body, neck, head, snout, tail);

        const legOffsets: Array<[number, number]> = [
          [-0.78, -0.34],
          [-0.78, 0.34],
          [0.78, -0.34],
          [0.78, 0.34],
        ];
        for (const [lx, lz] of legOffsets) {
          const leg = new THREE.Mesh(this.res.faunaLegGeo, mat);
          leg.position.set(lx, 0.59, lz);
          leg.castShadow = castShadows;
          fGrp.add(leg);
        }

        if (!isPred) {
          const hornL = new THREE.Mesh(this.res.hornGeo, this.res.cairnMat);
          hornL.position.set(1.45, 2.48, -0.2);
          hornL.rotation.z = -0.32;
          const hornR = new THREE.Mesh(this.res.hornGeo, this.res.cairnMat);
          hornR.position.set(1.45, 2.48, 0.2);
          hornR.rotation.z = -0.32;
          fGrp.add(hornL, hornR);
        } else {
          const earL = new THREE.Mesh(this.res.earGeo, mat);
          earL.position.set(1.36, 2.15, -0.22);
          const earR = new THREE.Mesh(this.res.earGeo, mat);
          earR.position.set(1.36, 2.15, 0.22);
          fGrp.add(earL, earR);
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
        h.isFpvSelfHidden = false;
      } else if (aid === observerAgentId) {
        h.root.visible = true;
        h.isFpvSelfHidden = true;
        h.bodyPivot.visible = false;
        h.midProxyMesh.visible = false;
        h.farDotMesh.visible = false;
      } else {
        h.root.visible = visibleAgentIds.has(aid);
        h.isFpvSelfHidden = false;
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

  public tick(
    elapsedS: number,
    dt: number,
    camera?: THREE.Camera,
    quality: QualityPreset = 'high',
  ): void {
    const lerpAlpha = Math.min(1, dt * 6);
    if (camera) {
      camera.updateMatrixWorld();
      _projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      _frustum.setFromProjectionMatrix(_projScreenMatrix);
    }

    const nearCutoffSq = quality === 'low' ? 120 * 120 : quality === 'medium' ? 160 * 160 : 210 * 210;
    const midCutoffSq = quality === 'low' ? 380 * 380 : quality === 'medium' ? 500 * 500 : 620 * 620;

    for (const h of this.livingMap.values()) {
      if (!h.root.visible) continue;

      h.root.position.lerp(h.targetPos, lerpAlpha);

      if (h.isFpvSelfHidden) {
        h.bodyPivot.visible = false;
        h.midProxyMesh.visible = false;
        h.farDotMesh.visible = false;
        continue;
      }

      // Frustum culling + 3-Tier Distance LOD
      let inFrustum = true;
      let distSq = 0;
      if (camera) {
        _actorSphere.center.copy(h.root.position);
        inFrustum = _frustum.intersectsSphere(_actorSphere);
        distSq = camera.position.distanceToSquared(h.root.position);
      }

      if (!inFrustum) {
        h.bodyPivot.visible = false;
        h.midProxyMesh.visible = false;
        h.farDotMesh.visible = false;
        continue;
      }

      if (distSq > midCutoffSq) {
        h.bodyPivot.visible = false;
        h.midProxyMesh.visible = false;
        h.farDotMesh.visible = true;
        continue;
      }

      if (distSq > nearCutoffSq) {
        h.bodyPivot.visible = false;
        h.midProxyMesh.visible = true;
        h.farDotMesh.visible = false;
        continue;
      }

      h.bodyPivot.visible = true;
      h.midProxyMesh.visible = false;
      h.farDotMesh.visible = false;

      // Orient smoothly toward partner if interacting, otherwise along travel heading
      if (h.lastPartnerId !== null) {
        const partner = this.livingMap.get(h.lastPartnerId);
        if (partner) {
          const pdx = partner.root.position.x - h.root.position.x;
          const pdz = partner.root.position.z - h.root.position.z;
          if (pdx * pdx + pdz * pdz > 0.05) {
            h.bodyPivot.rotation.y = Math.atan2(pdx, pdz);
          }
        }
      } else {
        const dx = h.targetPos.x - h.root.position.x;
        const dz = h.targetPos.z - h.root.position.z;
        if (dx * dx + dz * dz > 0.04) {
          h.bodyPivot.rotation.y = Math.atan2(dx, dz);
        }
      }

      const t = elapsedS * 3.4 + h.phase;
      const act = h.lastAction;

      if (act === 'rest') {
        h.bodyPivot.position.y = -0.52 * h.baseScale;
        h.bodyPivot.rotation.x = 0.35;
        h.leftArm.rotation.x = 0;
        h.rightArm.rotation.x = 0;
        h.leftLeg.rotation.x = 0;
        h.rightLeg.rotation.x = 0;
      } else if (act.startsWith('move_') || act === 'flee') {
        const swing = Math.sin(t * 1.45) * 0.52;
        h.bodyPivot.position.y = Math.abs(Math.sin(t * 1.45)) * 0.14;
        h.bodyPivot.rotation.x = 0.08;
        h.leftLeg.rotation.x = swing;
        h.rightLeg.rotation.x = -swing;
        h.leftArm.rotation.x = -swing * 0.85;
        h.rightArm.rotation.x = swing * 0.85;
      } else if (act === 'assault_or_kill' || act === 'attack' || act === 'steal') {
        h.bodyPivot.position.y = 0;
        h.bodyPivot.rotation.x = 0.2;
        h.rightArm.rotation.x = -1.42 + Math.sin(t * 2.4) * 0.38;
        h.leftArm.rotation.x = -0.38;
        h.leftLeg.rotation.x = 0.2;
        h.rightLeg.rotation.x = -0.2;
      } else if (
        act === 'forage_food' ||
        act === 'forage' ||
        act === 'drink_water' ||
        act === 'drink' ||
        act === 'gather_wood' ||
        act === 'gather_stone' ||
        act === 'gather_herb' ||
        act === 'craft_or_build' ||
        act === 'craft_or_invent' ||
        act === 'mark_symbol_record' ||
        act === 'carve_artifact'
      ) {
        h.bodyPivot.position.y = 0;
        h.bodyPivot.rotation.x = 0.26 + Math.sin(t) * 0.08;
        h.rightArm.rotation.x = -0.7 + Math.sin(t * 1.65) * 0.28;
        h.leftArm.rotation.x = -0.45;
        h.leftLeg.rotation.x = 0;
        h.rightLeg.rotation.x = 0;
      } else if (act === 'eat_inventory') {
        h.bodyPivot.position.y = 0;
        h.bodyPivot.rotation.x = 0.05;
        h.rightArm.rotation.x = -1.15 + Math.sin(t * 1.8) * 0.15;
        h.leftArm.rotation.x = -0.15;
        h.leftLeg.rotation.x = 0;
        h.rightLeg.rotation.x = 0;
      } else if (
        act === 'communicate_or_teach' ||
        act === 'communicate' ||
        act === 'share_or_barter' ||
        act === 'cooperate_share' ||
        act === 'barter' ||
        act === 'socialize_mate_or_mediate' ||
        act === 'care_for_other' ||
        act === 'seek_mate'
      ) {
        // Partner-facing conversational / barter hand gesture
        h.bodyPivot.position.y = 0;
        h.bodyPivot.rotation.x = 0.04;
        h.rightArm.rotation.x = -0.75 + Math.sin(t * 1.5) * 0.24;
        h.leftArm.rotation.x = -0.45 + Math.cos(t * 1.3) * 0.18;
        h.leftLeg.rotation.x = 0;
        h.rightLeg.rotation.x = 0;
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
    this.res.hairCapGeo.dispose();
    this.res.neckGeo.dispose();
    this.res.torsoGeo.dispose();
    this.res.sashGeo.dispose();
    this.res.armGeo.dispose();
    this.res.legGeo.dispose();
    this.res.bellyGeo.dispose();
    this.res.carriedItemGeo.dispose();
    this.res.midProxyGeo.dispose();
    this.res.farDotGeo.dispose();
    this.res.shadowDiscGeo.dispose();
    this.res.hitProxyGeo.dispose();
    this.res.ringGeo.dispose();
    this.res.cairnGeo.dispose();
    this.res.cairnMidGeo.dispose();
    this.res.cairnBaseGeo.dispose();
    this.res.faunaBodyGeo.dispose();
    this.res.faunaNeckGeo.dispose();
    this.res.faunaHeadGeo.dispose();
    this.res.faunaSnoutGeo.dispose();
    this.res.faunaLegGeo.dispose();
    this.res.faunaTailGeo.dispose();
    this.res.hornGeo.dispose();
    this.res.earGeo.dispose();

    this.res.hitMat.dispose();
    this.res.shadowDiscMat.dispose();
    for (const sm of this.res.skinMats) sm.dispose();
    this.res.hairDarkMat.dispose();
    this.res.hairBrownMat.dispose();
    this.res.hairElderMat.dispose();
    this.res.tunicHealthyF.dispose();
    this.res.tunicHealthyM.dispose();
    this.res.tunicStrained.dispose();
    this.res.tunicCritical.dispose();
    for (const cm of Object.values(this.res.carriedItemMats)) cm.dispose();
    this.res.farDotHealthyMat.dispose();
    this.res.farDotStrainedMat.dispose();
    this.res.sashMat.dispose();
    this.res.limbMat.dispose();
    this.res.voiceRingMat.dispose();
    this.res.selectRingMat.dispose();
    this.res.replayRingMat.dispose();
    this.res.cairnMat.dispose();
    this.res.herbivoreMat.dispose();
    this.res.predatorMat.dispose();
  }
}
