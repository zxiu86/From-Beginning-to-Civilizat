'use client';

import React, {useEffect, useRef, useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import type {
  LivingAgentFull,
  ObservatorySnapshot,
  QualityPreset,
  ReplayEventTarget,
} from '@/lib/observatory/types';
import {ActorsManager} from '@/lib/three/actors';
import {buildWorldProps, type PropsBundle} from '@/lib/three/instanced-props';
import {
  applyWeatherAndLighting,
  buildTerrainGroup,
  createAtmosphereRig,
  ELEVATION_SCALE,
  sampleElevationY,
  simToWorldXZ,
  type AtmosphereRig,
} from '@/lib/three/terrain';

interface WorldCanvas3DProps {
  snapshot: ObservatorySnapshot | null;
  quality: QualityPreset;
  selectedAgentId: number | null;
  followAgent: boolean;
  fpvAgent: LivingAgentFull | null;
  replayTarget: ReplayEventTarget | null;
  resetSignal: number;
  flyToSignal: number;
  onSelectAgent: (agentId: number | null) => void;
  onSoftwareGlDetected: (detected: boolean) => void;
}

const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _goalPos = new THREE.Vector3();
const _goalTarget = new THREE.Vector3();
const _deltaOffset = new THREE.Vector3();

function detectSoftwareGl(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return false;
    const renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
    return /SwiftShader|llvmpipe|Software|Microsoft Basic Render/i.test(renderer);
  } catch {
    return false;
  }
}

export default function WorldCanvas3D({
  snapshot,
  quality,
  selectedAgentId,
  followAgent,
  fpvAgent,
  replayTarget,
  resetSignal,
  flyToSignal,
  onSelectAgent,
  onSoftwareGlDetected,
}: WorldCanvas3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [contextLost, setContextLost] = useState(false);

  // Latest props in refs for animation loop without tearing down WebGL context
  const onSelectRef = useRef(onSelectAgent);
  const followRef = useRef(followAgent);
  const selectedIdRef = useRef(selectedAgentId);
  const fpvAgentRef = useRef(fpvAgent);
  const snapshotRef = useRef(snapshot);

  useEffect(() => {
    onSelectRef.current = onSelectAgent;
    followRef.current = followAgent;
    selectedIdRef.current = selectedAgentId;
    fpvAgentRef.current = fpvAgent;
    snapshotRef.current = snapshot;
  }, [onSelectAgent, followAgent, selectedAgentId, fpvAgent, snapshot]);

  const runtimeRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    rig: AtmosphereRig;
    actors: ActorsManager;
    terrainCleanup: (() => void) | null;
    terrainGroup: THREE.Group | null;
    propsBundle: PropsBundle | null;
    fpvHorizonRing: THREE.Mesh;
    replayBeacon: THREE.Group;
    flyActive: boolean;
    flyPos: THREE.Vector3;
    flyTarget: THREE.Vector3;
    lastTerrainWorldKey: string;
  } | null>(null);

  // Initialize WebGL Scene once per quality change
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const highQuality = quality === 'high';

    const probeCanvas = document.createElement('canvas');
    const probeGl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    const isSoftwareGl = probeGl ? detectSoftwareGl(probeGl) : false;
    onSoftwareGlDetected(isSoftwareGl);

    const effectiveShadow = highQuality && !isSoftwareGl;
    const width = Math.max(320, container.clientWidth);
    const height = Math.max(240, container.clientHeight);

    const renderer = new THREE.WebGLRenderer({
      antialias: highQuality && !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, highQuality ? 2 : 1.25),
    );
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = effectiveShadow;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    // Subtle procedural IBL using RoomEnvironment
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    const camera = new THREE.PerspectiveCamera(48, width / height, 1.0, 9500);
    camera.position.set(0, 740, 1280);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.485;
    controls.minDistance = 8;
    controls.maxDistance = 3600;
    controls.target.set(0, 40 * ELEVATION_SCALE, 0);
    controls.update();

    const rig = createAtmosphereRig(scene, effectiveShadow);
    const actors = new ActorsManager();
    scene.add(actors.livingGroup, actors.deceasedGroup, actors.faunaGroup);

    // FPV Sensory Horizon Ring (placed at exact vision_radius_m)
    const fpvRingGeo = new THREE.RingGeometry(0.985, 1.0, 64);
    fpvRingGeo.rotateX(-Math.PI / 2);
    const fpvRingMat = new THREE.MeshBasicMaterial({
      color: '#57b8d8',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55,
    });
    const fpvHorizonRing = new THREE.Mesh(fpvRingGeo, fpvRingMat);
    fpvHorizonRing.visible = false;
    scene.add(fpvHorizonRing);

    // Historical Event Replay Beacon
    const replayBeacon = new THREE.Group();
    const rRingGeo = new THREE.RingGeometry(14, 18, 32);
    rRingGeo.rotateX(-Math.PI / 2);
    const rRingMat = new THREE.MeshBasicMaterial({
      color: '#e66353',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const rPillarGeo = new THREE.CylinderGeometry(1.4, 1.4, 95, 10);
    rPillarGeo.translate(0, 47.5, 0);
    const rPillarMat = new THREE.MeshBasicMaterial({
      color: '#e66353',
      transparent: true,
      opacity: 0.25,
    });
    replayBeacon.add(new THREE.Mesh(rRingGeo, rRingMat), new THREE.Mesh(rPillarGeo, rPillarMat));
    replayBeacon.visible = false;
    scene.add(replayBeacon);

    const rt = {
      scene,
      camera,
      renderer,
      controls,
      rig,
      actors,
      terrainCleanup: null as (() => void) | null,
      terrainGroup: null as THREE.Group | null,
      propsBundle: null as PropsBundle | null,
      fpvHorizonRing,
      replayBeacon,
      flyActive: false,
      flyPos: new THREE.Vector3(),
      flyTarget: new THREE.Vector3(),
      lastTerrainWorldKey: '',
    };
    runtimeRef.current = rt;

    const handlePointerDownCancelFly = () => {
      rt.flyActive = false;
    };
    controls.addEventListener('start', handlePointerDownCancelFly);

    let downX = 0;
    let downY = 0;
    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };
    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (dist > 6) return; // Dragged camera, not a click
      if (fpvAgentRef.current) return; // Do not switch agent accidentally mid-FPV click

      const rect = renderer.domElement.getBoundingClientRect();
      _ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      _raycaster.setFromCamera(_ndc, camera);

      const hits = _raycaster.intersectObjects(actors.getRaycastTargets(), true);
      if (hits.length > 0) {
        let obj: THREE.Object3D | null = hits[0].object;
        while (obj) {
          if (typeof obj.userData?.agentId === 'number') {
            onSelectRef.current(obj.userData.agentId);
            return;
          }
          obj = obj.parent;
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(320, entry.contentRect.width);
        const h = Math.max(240, entry.contentRect.height);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    ro.observe(container);

    let rafId = 0;
    let prevTime = performance.now();
    let lastDraw = 0;
    const startTime = prevTime;

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);
      if (isSoftwareGl && now - lastDraw < 80) return;
      lastDraw = now;

      const dt = Math.min(0.1, (now - prevTime) / 1000);
      prevTime = now;
      const elapsedS = (now - startTime) / 1000;

      actors.tick(elapsedS, dt);

      if (replayBeacon.visible) {
        const pulse = 1 + Math.sin(elapsedS * 4.0) * 0.14;
        replayBeacon.scale.set(pulse, 1, pulse);
      }

      if (rt.flyActive) {
        const alpha = 1 - Math.exp(-6.0 * dt);
        camera.position.lerp(rt.flyPos, alpha);
        controls.target.lerp(rt.flyTarget, alpha);
        if (
          camera.position.distanceTo(rt.flyPos) < 1.2 &&
          controls.target.distanceTo(rt.flyTarget) < 1.2
        ) {
          rt.flyActive = false;
        }
      } else if (followRef.current && selectedIdRef.current !== null && !fpvAgentRef.current) {
        const pos = actors.getLivingActorPosition(selectedIdRef.current);
        if (pos) {
          _deltaOffset.copy(pos).sub(controls.target);
          controls.target.lerp(pos, Math.min(1, dt * 5));
          camera.position.addScaledVector(_deltaOffset, Math.min(1, dt * 5));
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };
    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      controls.removeEventListener('start', handlePointerDownCancelFly);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      controls.dispose();

      if (rt.terrainCleanup) rt.terrainCleanup();
      if (rt.propsBundle) rt.propsBundle.dispose();
      actors.dispose();
      fpvRingGeo.dispose();
      fpvRingMat.dispose();
      rRingGeo.dispose();
      rRingMat.dispose();
      rPillarGeo.dispose();
      rPillarMat.dispose();
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      runtimeRef.current = null;
    };
  }, [quality, onSoftwareGlDetected]);

  // Reconcile Snapshot Data -> Terrain, Props, Actors
  useEffect(() => {
    const rt = runtimeRef.current;
    if (!rt) return;

    if (!snapshot) {
      // Build subtle calm barren backdrop terrain when in empty state
      const emptyKey = `empty_${quality}`;
      if (rt.lastTerrainWorldKey !== emptyKey) {
        if (rt.terrainGroup) rt.scene.remove(rt.terrainGroup);
        if (rt.terrainCleanup) rt.terrainCleanup();
        if (rt.propsBundle) {
          rt.scene.remove(rt.propsBundle.group);
          rt.propsBundle.dispose();
          rt.propsBundle = null;
        }
        const built = buildTerrainGroup(null, 'spring', quality === 'high');
        rt.terrainGroup = built.group;
        rt.terrainCleanup = built.dispose;
        rt.scene.add(built.group);
        rt.lastTerrainWorldKey = emptyKey;
      }
      rt.actors.reconcile([], [], [], null, quality === 'high');
      applyWeatherAndLighting(
        rt.scene,
        rt.rig,
        false,
        'spring',
        {
          condition: 'clear',
          temperature_c: 18,
          rainfall_mm: 0,
          wind_mps: 3,
          drought_streak_days: 0,
          flood_severity: 0,
          disease_pressure: 0,
        },
        null,
      );
      return;
    }

    const terrainKey = `${snapshot.world_id}_${snapshot.clock.tick}_${snapshot.clock.season}_${quality}`;
    if (rt.lastTerrainWorldKey !== terrainKey) {
      if (rt.terrainGroup) rt.scene.remove(rt.terrainGroup);
      if (rt.terrainCleanup) rt.terrainCleanup();
      if (rt.propsBundle) {
        rt.scene.remove(rt.propsBundle.group);
        rt.propsBundle.dispose();
      }

      const built = buildTerrainGroup(
        snapshot.world_terrain,
        snapshot.clock.season,
        quality === 'high',
      );
      rt.terrainGroup = built.group;
      rt.terrainCleanup = built.dispose;
      rt.scene.add(built.group);

      const props = buildWorldProps(
        snapshot.world_terrain,
        snapshot.history_layers.layer_2_surface_artifacts,
        snapshot.crime_and_stability.exchange_hubs,
        snapshot.engine_capabilities.has_shelter_tech_milestone,
        snapshot.clock.season,
        quality === 'high',
      );
      rt.propsBundle = props;
      rt.scene.add(props.group);
      rt.lastTerrainWorldKey = terrainKey;
    }

    rt.actors.reconcile(
      snapshot.living_agents_full,
      snapshot.deceased_agents_archive,
      snapshot.ecosystem.fauna,
      snapshot.world_terrain,
      quality === 'high',
    );
  }, [snapshot, quality]);

  // Apply Selection, Replay Highlights, and Strictly Bounded FPV Visibility
  useEffect(() => {
    const rt = runtimeRef.current;
    if (!rt) return;

    const replayIds = new Set<number>(replayTarget ? replayTarget.agent_ids : []);
    rt.actors.highlightAgents(selectedAgentId, replayIds);

    if (fpvAgent && snapshot) {
      const wM = snapshot.world_terrain?.width_m ?? 2500;
      const hM = snapshot.world_terrain?.height_m ?? 2000;
      const {wx, wz} = simToWorldXZ(fpvAgent.x, fpvAgent.y, wM, hM);
      const wy = sampleElevationY(snapshot.world_terrain, fpvAgent.x, fpvAgent.y);

      const visAgents = new Set(fpvAgent.local_perception.visible_agent_ids);
      const visFauna = new Set(fpvAgent.local_perception.visible_fauna_ids);
      const visArts = new Set(fpvAgent.local_perception.visible_artifact_ids);

      rt.actors.applyFpvVisibility(fpvAgent.agent_id, visAgents, visFauna);
      rt.propsBundle?.setFpvVisibleArtifacts(visArts);

      applyWeatherAndLighting(
        rt.scene,
        rt.rig,
        snapshot.clock.is_night,
        snapshot.clock.season,
        snapshot.ecosystem.weather,
        fpvAgent.local_perception.vision_radius_m,
      );

      // Position sensory boundary ring at exact engine vision_radius_m
      rt.fpvHorizonRing.visible = true;
      rt.fpvHorizonRing.position.set(wx, wy + 0.5, wz);
      rt.fpvHorizonRing.scale.setScalar(fpvAgent.local_perception.vision_radius_m);

      // Move camera to eye height
      rt.controls.maxPolarAngle = Math.PI * 0.72;
      rt.controls.minDistance = 0.5;
      rt.controls.maxDistance = 6;
      const eyeY = wy + (fpvAgent.life_stage === 'infant' ? 1.8 : 3.9);
      rt.camera.position.set(wx, eyeY, wz);
      rt.controls.target.set(wx + 2.2, eyeY - 0.1, wz + 0.8);
      rt.flyActive = false;
      rt.controls.update();
    } else if (snapshot) {
      rt.actors.applyFpvVisibility(null, null, null);
      rt.propsBundle?.setFpvVisibleArtifacts(null);
      rt.fpvHorizonRing.visible = false;
      rt.controls.maxPolarAngle = Math.PI * 0.485;
      rt.controls.minDistance = 8;
      rt.controls.maxDistance = 3600;

      applyWeatherAndLighting(
        rt.scene,
        rt.rig,
        snapshot.clock.is_night,
        snapshot.clock.season,
        snapshot.ecosystem.weather,
        null,
      );
    }
  }, [fpvAgent, selectedAgentId, replayTarget, snapshot]);

  // Fly Camera to Selected Agent on explicit flyToSignal
  useEffect(() => {
    const rt = runtimeRef.current;
    if (!rt || !snapshot || selectedAgentId === null || fpvAgent || flyToSignal === 0) return;

    const living = snapshot.living_agents_full.find((a) => a.agent_id === selectedAgentId);
    const dead = !living
      ? snapshot.deceased_agents_archive.find((a) => a.agent_id === selectedAgentId)
      : null;
    const target = living || dead;
    if (!target) return;

    const wM = snapshot.world_terrain?.width_m ?? 2500;
    const hM = snapshot.world_terrain?.height_m ?? 2000;
    const {wx, wz} = simToWorldXZ(target.x, target.y, wM, hM);
    const wy = sampleElevationY(snapshot.world_terrain, target.x, target.y);

    _goalTarget.set(wx, wy + 2.5, wz);
    _goalPos.set(wx + 42, wy + 34, wz + 48);
    rt.flyTarget.copy(_goalTarget);
    rt.flyPos.copy(_goalPos);
    rt.flyActive = true;
  }, [flyToSignal, selectedAgentId, snapshot, fpvAgent]);

  // Fly Camera to Historical Event Replay coordinates
  useEffect(() => {
    const rt = runtimeRef.current;
    if (!rt || !snapshot) return;

    if (!replayTarget) {
      rt.replayBeacon.visible = false;
      return;
    }

    const wM = snapshot.world_terrain?.width_m ?? 2500;
    const hM = snapshot.world_terrain?.height_m ?? 2000;
    const {wx, wz} = simToWorldXZ(replayTarget.x, replayTarget.y, wM, hM);
    const wy = sampleElevationY(snapshot.world_terrain, replayTarget.x, replayTarget.y);

    rt.replayBeacon.position.set(wx, wy + 0.4, wz);
    rt.replayBeacon.visible = true;

    if (!fpvAgent) {
      rt.flyTarget.set(wx, wy + 3, wz);
      rt.flyPos.set(wx + 95, wy + 78, wz + 105);
      rt.flyActive = true;
    }
  }, [replayTarget, snapshot, fpvAgent]);

  // Reset Camera to Full 5 km^2 World Overview
  useEffect(() => {
    const rt = runtimeRef.current;
    if (!rt || resetSignal === 0) return;

    const snap = snapshotRef.current;
    const wM = snap?.world_terrain?.width_m ?? 2500;
    const hM = snap?.world_terrain?.height_m ?? 2000;
    const centerY = sampleElevationY(snap?.world_terrain ?? null, wM * 0.5, hM * 0.5);

    rt.flyTarget.set(0, centerY, 0);
    rt.flyPos.set(0, 740, 1280);
    rt.flyActive = true;
  }, [resetSignal]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0B0F14]">
      <div ref={mountRef} className="absolute inset-0 h-full w-full" />
      {contextLost && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#0B0F14]/90 text-sm text-[#E6EDF3]">
          WebGL context interrupted — restoring 3D world...
        </div>
      )}
    </div>
  );
}
