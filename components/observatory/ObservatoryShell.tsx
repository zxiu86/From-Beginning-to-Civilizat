'use client';

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {X} from 'lucide-react';
import {
  buildAgentLookupMap,
  SnapshotValidationError,
  validateAndNormalizeSnapshot,
} from '@/lib/observatory/adapter';
import {getTranslations} from '@/lib/observatory/i18n';
import type {ImportedTimelineBundle} from '@/lib/observatory/importer';
import type {
  ActiveDrawer,
  LiveTimelineSummary,
  LivingAgentFull,
  Locale,
  ObservatorySnapshot,
  QualityPreset,
  ReplayEventTarget,
  SnapshotSourceMode,
} from '@/lib/observatory/types';
import AgentInspector from './AgentInspector';
import BottomDock from './BottomDock';
import CivilizationDrawer from './CivilizationDrawer';
import ComparisonDrawer from './ComparisonDrawer';
import EmptyWorldOverlay from './EmptyWorldOverlay';
import FpvHud from './FpvHud';
import HistoryDrawer from './HistoryDrawer';
import JsonImporterModal from './JsonImporterModal';
import PopulationDrawer from './PopulationDrawer';
import TelemetryDrawer from './TelemetryDrawer';
import TimelineBar, {type SimSpeed} from './TimelineBar';
import TopBar from './TopBar';
import WorldCanvas3D from './WorldCanvas3D';

export default function ObservatoryShell() {
  const [locale, setLocale] = useState<Locale>('ar');
  const [snapshot, setSnapshot] = useState<ObservatorySnapshot | null>(null);
  const [sourceMode, setSourceMode] = useState<SnapshotSourceMode>('empty');
  const [quality, setQuality] = useState<QualityPreset>('high');
  const [fps, setFps] = useState<number>(0);
  const [softwareGl, setSoftwareGl] = useState(false);

  const [activeDrawer, setActiveDrawer] = useState<ActiveDrawer>(null);
  const [zenMode, setZenMode] = useState(false);

  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [followAgent, setFollowAgent] = useState(false);
  const [fpvAgentId, setFpvAgentId] = useState<number | null>(null);
  const [replayTarget, setReplayTarget] = useState<ReplayEventTarget | null>(null);

  const [resetSignal, setResetSignal] = useState(0);
  const [flyToSignal, setFlyToSignal] = useState(0);

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [loadingFixture, setLoadingFixture] = useState(false);

  // Live Python Engine API & Timeline Playback State
  const [liveApiAvailable, setLiveApiAvailable] = useState(false);
  const [liveTimelines, setLiveTimelines] = useState<LiveTimelineSummary[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [creatingLiveWorld, setCreatingLiveWorld] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isStepping, setIsStepping] = useState(false);
  const [simSpeed, setSimSpeed] = useState<SimSpeed>(5);
  const [frameTicks, setFrameTicks] = useState<number[]>([]);
  const [isHistoricalMode, setIsHistoricalMode] = useState(false);
  const [historicalTick, setHistoricalTick] = useState<number | null>(null);

  // Multi-File JSON Importer + Rollback + Imported Frame Cache
  const [importerOpen, setImporterOpen] = useState(false);
  const [importedFrames, setImportedFrames] = useState<Record<number, ObservatorySnapshot>>({});
  const [importedPairSnapshots, setImportedPairSnapshots] = useState<{
    original: ObservatorySnapshot;
    experimental: ObservatorySnapshot;
  } | null>(null);
  const [rollbackState, setRollbackState] = useState<{
    snapshot: ObservatorySnapshot | null;
    sourceMode: SnapshotSourceMode;
    frameTicks: number[];
    importedFrames: Record<number, ObservatorySnapshot>;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const t = useMemo(() => getTranslations(locale), [locale]);
  const agentLookup = useMemo(() => buildAgentLookupMap(snapshot), [snapshot]);

  // Keep <html dir & lang> synced with locale
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale]);

  // Auto-detect mobile screen width asynchronously after hydration for sensible default quality
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const onChange = () => setQuality(mql.matches ? 'low' : 'high');
    mql.addEventListener('change', onChange);
    const raf = requestAnimationFrame(() => {
      if (mql.matches) setQuality('low');
    });
    return () => {
      cancelAnimationFrame(raf);
      mql.removeEventListener('change', onChange);
    };
  }, []);

  const refreshLiveStatus = useCallback(async (): Promise<LiveTimelineSummary[]> => {
    try {
      const res = await fetch('/api/sim/status', {cache: 'no-store'});
      if (!res.ok) return [];
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) return [];
      const data = await res.json();
      if (data?.available) {
        setLiveApiAvailable(true);
        const list = Array.isArray(data.timelines) ? (data.timelines as LiveTimelineSummary[]) : [];
        setLiveTimelines(list);
        return list;
      }
    } catch {
      // Static export / GitHub Pages mode without live server API
    }
    return [];
  }, []);

  const loadPublishedSnapshot = useCallback(async () => {
    try {
      const res = await fetch('./data/latest_snapshot.json', {cache: 'no-store'});
      if (!res.ok) return;
      const json: unknown = await res.json();
      const parsed = validateAndNormalizeSnapshot(json);
      setSnapshot(parsed);
      setSourceMode('published');
      setUploadError(null);
      setFrameTicks([]);
      setIsHistoricalMode(false);
      setHistoricalTick(null);
    } catch {
      // Remain cleanly in empty state if no published snapshot exists yet
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const timelines = await refreshLiveStatus();
      if (!active) return;
      if (timelines.length > 0) {
        const chosen = timelines[timelines.length - 1];
        try {
          const res = await fetch(`/api/sim/snapshot?id=${encodeURIComponent(chosen.id)}`, {
            cache: 'no-store',
          });
          if (res.ok && active) {
            const payload = await res.json();
            const parsed = validateAndNormalizeSnapshot(payload.snapshot);
            setSnapshot(parsed);
            setSourceMode('live_runner');
            setActiveRunId(chosen.id);
            setFrameTicks(Array.isArray(payload.frame_ticks) ? payload.frame_ticks : []);
            setIsHistoricalMode(false);
            setHistoricalTick(null);
            return;
          }
        } catch {
          // Fall through to published snapshot
        }
      }
      await loadPublishedSnapshot();
    })();
    return () => {
      active = false;
    };
  }, [refreshLiveStatus, loadPublishedSnapshot]);

  const handleUploadFile = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const raw: unknown = JSON.parse(text);
      const parsed = validateAndNormalizeSnapshot(raw);
      setIsPlaying(false);
      setSnapshot(parsed);
      setSourceMode('uploaded');
      setActiveRunId(null);
      setFrameTicks([parsed.clock.tick]);
      setImportedFrames({[parsed.clock.tick]: parsed});
      setIsHistoricalMode(false);
      setHistoricalTick(null);
      setUploadError(null);
      setFpvAgentId(null);
      setReplayTarget(null);
      setResetSignal((n) => n + 1);
    } catch (err) {
      const msg =
        err instanceof SnapshotValidationError || err instanceof Error
          ? err.message
          : 'Invalid JSON file.';
      setUploadError(msg);
    }
  }, []);

  const handleLoadTestFixture = useCallback(async () => {
    setLoadingFixture(true);
    setUploadError(null);
    setIsPlaying(false);
    try {
      const res = await fetch('./fixtures/test_world_snapshot.json', {cache: 'no-store'});
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const raw: unknown = await res.json();
      const parsed = validateAndNormalizeSnapshot(raw);
      setSnapshot(parsed);
      setSourceMode('test_fixture');
      setActiveRunId(null);
      setFrameTicks([parsed.clock.tick]);
      setIsHistoricalMode(false);
      setHistoricalTick(null);
      setFpvAgentId(null);
      setReplayTarget(null);
      setResetSignal((n) => n + 1);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to load test fixture.');
    } finally {
      setLoadingFixture(false);
    }
  }, []);

  const handleStartLiveWorld = useCallback(async () => {
    if (!liveApiAvailable || creatingLiveWorld) return;
    setCreatingLiveWorld(true);
    setIsPlaying(false);
    setUploadError(null);
    try {
      const res = await fetch('/api/sim/new', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({seed: Math.floor(Date.now() % 100000), initial_population: 40, max_ticks: 10}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      const parsed = validateAndNormalizeSnapshot(payload.snapshot);
      setSnapshot(parsed);
      setSourceMode('live_runner');
      setActiveRunId(payload.id);
      setFrameTicks(Array.isArray(payload.frame_ticks) ? payload.frame_ticks : [parsed.clock.tick]);
      setIsHistoricalMode(false);
      setHistoricalTick(null);
      setFpvAgentId(null);
      setReplayTarget(null);
      setResetSignal((n) => n + 1);
      await refreshLiveStatus();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to start live world.');
    } finally {
      setCreatingLiveWorld(false);
    }
  }, [liveApiAvailable, creatingLiveWorld, refreshLiveStatus]);

  const handleSelectLiveRun = useCallback(async (runId: string) => {
    if (!runId) return;
    setIsPlaying(false);
    try {
      const res = await fetch(`/api/sim/snapshot?id=${encodeURIComponent(runId)}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const payload = await res.json();
      const parsed = validateAndNormalizeSnapshot(payload.snapshot);
      setSnapshot(parsed);
      setSourceMode('live_runner');
      setActiveRunId(runId);
      setFrameTicks(Array.isArray(payload.frame_ticks) ? payload.frame_ticks : []);
      setIsHistoricalMode(false);
      setHistoricalTick(null);
      setFpvAgentId(null);
      setReplayTarget(null);
    } catch {
      // ignore transient fetch errors
    }
  }, []);

  const stepLiveSimulation = useCallback(
    async (ticksToAdvance: number) => {
      if (!activeRunId || isStepping) return;
      setIsStepping(true);
      try {
        const res = await fetch('/api/sim/step', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            id: activeRunId,
            ticks: ticksToAdvance,
            frame_stride: ticksToAdvance > 10 ? 5 : 1,
          }),
        });
        if (!res.ok) {
          setIsPlaying(false);
          return;
        }
        const payload = await res.json();
        const parsed = validateAndNormalizeSnapshot(payload.snapshot);
        setSnapshot(parsed);
        setFrameTicks(Array.isArray(payload.frame_ticks) ? payload.frame_ticks : []);
        if (parsed.demographics.living_count === 0) {
          setIsPlaying(false);
        }
        await refreshLiveStatus();
      } catch {
        setIsPlaying(false);
      } finally {
        setIsStepping(false);
      }
    },
    [activeRunId, isStepping, refreshLiveStatus],
  );

  // Playback timer loop when Play is active
  useEffect(() => {
    if (!isPlaying || !liveApiAvailable || !activeRunId || isHistoricalMode) return;
    const ticksPerBatch = simSpeed >= 25 ? 25 : simSpeed >= 10 ? 10 : simSpeed >= 5 ? 5 : simSpeed;
    const intervalMs = simSpeed >= 10 ? 700 : 900;
    const timer = window.setInterval(() => {
      if (!isStepping) {
        void stepLiveSimulation(ticksPerBatch);
      }
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [isPlaying, liveApiAvailable, activeRunId, isHistoricalMode, simSpeed, isStepping, stepLiveSimulation]);

  const handleScrubTick = useCallback(
    async (targetTick: number) => {
      setIsPlaying(false);
      if (sourceMode === 'uploaded' && importedFrames[targetTick]) {
        setSnapshot(importedFrames[targetTick]);
        setIsHistoricalMode(targetTick !== frameTicks[frameTicks.length - 1]);
        setHistoricalTick(targetTick);
        return;
      }
      if (liveApiAvailable && activeRunId) {
        try {
          const res = await fetch(
            `/api/sim/snapshot?id=${encodeURIComponent(activeRunId)}&tick=${targetTick}`,
            {cache: 'no-store'},
          );
          if (!res.ok) return;
          const payload = await res.json();
          const parsed = validateAndNormalizeSnapshot(payload.snapshot);
          setSnapshot(parsed);
          setIsHistoricalMode(true);
          setHistoricalTick(targetTick);
        } catch {
          // ignore
        }
      }
    },
    [sourceMode, importedFrames, frameTicks, liveApiAvailable, activeRunId],
  );

  const handleReturnToLive = useCallback(async () => {
    if (sourceMode === 'uploaded' && frameTicks.length > 0) {
      const latestTick = frameTicks[frameTicks.length - 1];
      if (importedFrames[latestTick]) {
        setSnapshot(importedFrames[latestTick]);
      }
      setIsHistoricalMode(false);
      setHistoricalTick(null);
      return;
    }
    if (liveApiAvailable && activeRunId) {
      await handleSelectLiveRun(activeRunId);
    }
  }, [sourceMode, frameTicks, importedFrames, liveApiAvailable, activeRunId, handleSelectLiveRun]);

  const handleBranchRebirth = useCallback(async () => {
    if (!liveApiAvailable || !activeRunId || isStepping) return;
    setIsPlaying(false);
    setIsStepping(true);
    try {
      const res = await fetch('/api/sim/branch-rebirth', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({source_id: activeRunId}),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setUploadError(errBody.error || `HTTP ${res.status}`);
        return;
      }
      const payload = await res.json();
      const parsed = validateAndNormalizeSnapshot(payload.snapshot);
      setSnapshot(parsed);
      setSourceMode('live_runner');
      setActiveRunId(payload.id);
      setFrameTicks(Array.isArray(payload.frame_ticks) ? payload.frame_ticks : [parsed.clock.tick]);
      setIsHistoricalMode(false);
      setHistoricalTick(null);
      setActiveDrawer('comparison');
      await refreshLiveStatus();
    } finally {
      setIsStepping(false);
    }
  }, [liveApiAvailable, activeRunId, isStepping, refreshLiveStatus]);

  const handleCommitImportedBundle = useCallback(
    (bundle: ImportedTimelineBundle, allBundles: ImportedTimelineBundle[]) => {
      setRollbackState({
        snapshot,
        sourceMode,
        frameTicks,
        importedFrames,
      });
      setIsPlaying(false);
      setSnapshot(bundle.snapshot);
      setSourceMode('uploaded');
      setActiveRunId(null);
      setImportedFrames(bundle.framesByTick);
      setFrameTicks(bundle.orderedTicks);
      setIsHistoricalMode(false);
      setHistoricalTick(null);
      setUploadError(null);
      setFpvAgentId(null);
      setReplayTarget(null);
      setResetSignal((n) => n + 1);

      const orig = allBundles.find((b) => !b.haltedDueToCycle && b.timelineKind !== 'experimental_rebirth');
      const exp = allBundles.find((b) => !b.haltedDueToCycle && b.timelineKind === 'experimental_rebirth');
      if (orig && exp) {
        setImportedPairSnapshots({original: orig.snapshot, experimental: exp.snapshot});
      }
    },
    [snapshot, sourceMode, frameTicks, importedFrames],
  );

  const handleRollbackImport = useCallback(() => {
    if (!rollbackState) return;
    setSnapshot(rollbackState.snapshot);
    setSourceMode(rollbackState.sourceMode);
    setFrameTicks(rollbackState.frameTicks);
    setImportedFrames(rollbackState.importedFrames);
    setIsHistoricalMode(false);
    setHistoricalTick(null);
    setRollbackState(null);
  }, [rollbackState]);

  const selectedAgent = useMemo(
    () => (selectedAgentId !== null ? agentLookup.get(selectedAgentId) ?? null : null),
    [selectedAgentId, agentLookup],
  );

  const fpvAgent: LivingAgentFull | null = useMemo(() => {
    if (fpvAgentId === null) return null;
    const ag = agentLookup.get(fpvAgentId);
    return ag && ag.is_alive ? ag : null;
  }, [fpvAgentId, agentLookup]);

  const handleSelectAgentFrom3D = useCallback((id: number | null) => {
    setSelectedAgentId(id);
    if (id !== null) {
      setActiveDrawer('inspector');
      setZenMode(false);
    }
  }, []);

  const handleFlyToAgent = useCallback((id: number) => {
    setSelectedAgentId(id);
    setFpvAgentId(null);
    setFlyToSignal((n) => n + 1);
  }, []);

  const handleEnterFpv = useCallback((id: number) => {
    setSelectedAgentId(id);
    setFollowAgent(false);
    setReplayTarget(null);
    setActiveDrawer(null);
    setFpvAgentId(id);
  }, []);

  const handleReplayEvent = useCallback((ev: ReplayEventTarget) => {
    setFpvAgentId(null);
    setFollowAgent(false);
    setReplayTarget(ev);
  }, []);

  const drawerTitle =
    activeDrawer === 'inspector'
      ? t.tabInspector
      : activeDrawer === 'population'
        ? t.tabPopulation
        : activeDrawer === 'civilization'
          ? t.tabCivilization
          : activeDrawer === 'history'
            ? t.tabHistory
            : activeDrawer === 'telemetry'
              ? t.tabTelemetry
              : activeDrawer === 'comparison'
                ? t.tabComparison
                : '';

  return (
    <div
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#0B0F14] text-[#E6EDF3]"
    >
      {/* Hidden Single-File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleUploadFile(f);
          e.target.value = '';
        }}
      />

      {!zenMode && (
        <TopBar
          t={t}
          locale={locale}
          snapshot={snapshot}
          sourceMode={sourceMode}
          quality={quality}
          fps={fps}
          softwareGl={softwareGl}
          liveApiAvailable={liveApiAvailable}
          creatingLiveWorld={creatingLiveWorld}
          onToggleLocale={() => setLocale((prev) => (prev === 'ar' ? 'en' : 'ar'))}
          onChangeQuality={setQuality}
          onUploadClick={() => fileInputRef.current?.click()}
          onOpenMultiImporter={() => setImporterOpen(true)}
          onStartLiveWorld={() => void handleStartLiveWorld()}
          onRefreshPublished={() => void loadPublishedSnapshot()}
        />
      )}

      {/* Full-Bleed 3D World Canvas */}
      <main className="relative flex-1 overflow-hidden">
        <WorldCanvas3D
          snapshot={snapshot}
          quality={quality}
          selectedAgentId={selectedAgentId}
          followAgent={followAgent}
          fpvAgent={fpvAgent}
          replayTarget={replayTarget}
          resetSignal={resetSignal}
          flyToSignal={flyToSignal}
          onSelectAgent={handleSelectAgentFrom3D}
          onSoftwareGlDetected={setSoftwareGl}
          onFpsUpdate={setFps}
        />

        {/* Honest Empty State when no real snapshot is loaded */}
        {!snapshot && (
          <EmptyWorldOverlay
            t={t}
            uploadError={uploadError}
            loadingFixture={loadingFixture}
            liveApiAvailable={liveApiAvailable}
            creatingLiveWorld={creatingLiveWorld}
            onUploadFile={(f) => void handleUploadFile(f)}
            onUploadClick={() => fileInputRef.current?.click()}
            onMultiImportClick={() => setImporterOpen(true)}
            onLoadTestFixture={() => void handleLoadTestFixture()}
            onStartLiveWorld={() => void handleStartLiveWorld()}
          />
        )}

        {/* Strictly Bounded First-Person View Sensory HUD */}
        {fpvAgent && !zenMode && (
          <FpvHud t={t} agent={fpvAgent} onExitFpv={() => setFpvAgentId(null)} />
        )}

        {/* Single Slide-Over Drawer */}
        <AnimatePresence>
          {snapshot && activeDrawer && !zenMode && !fpvAgent && (
            <motion.aside
              key={activeDrawer}
              initial={{opacity: 0, x: locale === 'ar' ? -24 : 24}}
              animate={{opacity: 1, x: 0}}
              exit={{opacity: 0, x: locale === 'ar' ? -24 : 24}}
              transition={{duration: 0.18}}
              className="pointer-events-auto absolute bottom-28 top-3 end-3 z-20 flex w-[calc(100%-1.5rem)] max-w-[440px] flex-col rounded-md border border-white/15 bg-[#121821]/95 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
                <h2 className="text-sm font-bold text-[#E6EDF3]">{drawerTitle}</h2>
                <button
                  type="button"
                  onClick={() => setActiveDrawer(null)}
                  className="rounded p-1 text-[#9FB0C3] transition hover:bg-white/10 hover:text-[#E6EDF3]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3.5">
                {activeDrawer === 'inspector' && (
                  <AgentInspector
                    t={t}
                    agent={selectedAgent}
                    agentLookup={agentLookup}
                    onSelectAgent={(id) => setSelectedAgentId(id)}
                    onFlyToAgent={handleFlyToAgent}
                    onEnterFpv={handleEnterFpv}
                  />
                )}
                {activeDrawer === 'population' && (
                  <PopulationDrawer
                    t={t}
                    snapshot={snapshot}
                    selectedAgentId={selectedAgentId}
                    agentLookup={agentLookup}
                    onSelectAgent={(id) => {
                      setSelectedAgentId(id);
                    }}
                    onFlyToAgent={handleFlyToAgent}
                  />
                )}
                {activeDrawer === 'civilization' && (
                  <CivilizationDrawer t={t} snapshot={snapshot} />
                )}
                {activeDrawer === 'history' && (
                  <HistoryDrawer
                    t={t}
                    snapshot={snapshot}
                    replayTarget={replayTarget}
                    onReplayEvent={handleReplayEvent}
                    onClearReplay={() => setReplayTarget(null)}
                    onSelectAgent={(id) => {
                      setSelectedAgentId(id);
                      setActiveDrawer('inspector');
                      handleFlyToAgent(id);
                    }}
                  />
                )}
                {activeDrawer === 'telemetry' && (
                  <TelemetryDrawer t={t} snapshot={snapshot} />
                )}
                {activeDrawer === 'comparison' && (
                  <ComparisonDrawer
                    t={t}
                    snapshot={snapshot}
                    liveApiAvailable={liveApiAvailable}
                    liveTimelines={liveTimelines}
                    importedPairSnapshots={importedPairSnapshots}
                    onSelectAgent={(id) => {
                      setSelectedAgentId(id);
                      setActiveDrawer('inspector');
                      handleFlyToAgent(id);
                    }}
                  />
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Interactive Timeline Bar */}
        {!zenMode && !fpvAgent && (
          <TimelineBar
            t={t}
            snapshot={snapshot}
            liveApiAvailable={liveApiAvailable}
            liveTimelines={liveTimelines}
            activeRunId={activeRunId}
            isPlaying={isPlaying}
            isStepping={isStepping}
            speed={simSpeed}
            frameTicks={frameTicks}
            isHistoricalMode={isHistoricalMode}
            historicalTick={historicalTick}
            onSelectRun={(id) => void handleSelectLiveRun(id)}
            onTogglePlay={() => setIsPlaying((p) => !p)}
            onStepOnce={() => void stepLiveSimulation(1)}
            onChangeSpeed={setSimSpeed}
            onScrubTick={(tk) => void handleScrubTick(tk)}
            onReturnToLive={() => void handleReturnToLive()}
            onBranchRebirth={() => void handleBranchRebirth()}
          />
        )}

        {/* Bottom Command Dock */}
        <BottomDock
          t={t}
          hasSnapshot={Boolean(snapshot)}
          activeDrawer={activeDrawer}
          zenMode={zenMode}
          hasSelectedAgent={selectedAgentId !== null}
          followAgent={followAgent}
          isFpv={Boolean(fpvAgent)}
          onSelectDrawer={setActiveDrawer}
          onToggleZen={() => setZenMode((prev) => !prev)}
          onResetCamera={() => {
            setFollowAgent(false);
            setReplayTarget(null);
            setResetSignal((n) => n + 1);
          }}
          onToggleFollow={() => setFollowAgent((prev) => !prev)}
        />

        {/* Unlimited Multi-File JSON Importer Modal */}
        <JsonImporterModal
          t={t}
          open={importerOpen}
          canRollback={rollbackState !== null}
          onClose={() => setImporterOpen(false)}
          onCommitBundle={handleCommitImportedBundle}
          onRollback={handleRollbackImport}
        />
      </main>
    </div>
  );
}
