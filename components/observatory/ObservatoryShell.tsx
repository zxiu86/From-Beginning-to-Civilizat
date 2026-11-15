'use client';

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {
  Activity,
  Brain,
  CloudSun,
  Coins,
  Droplets,
  HeartCrack,
  History,
  Info,
  Landmark,
  Layers,
  LayoutDashboard,
  Milestone,
  Sprout,
  Users,
} from 'lucide-react';
import {
  buildAgentLookupMap,
  SnapshotValidationError,
  validateAndNormalizeSnapshot,
} from '@/lib/observatory/adapter';
import {
  getDiagnosticEntries,
  reportClientError,
  subscribeDiagnostics,
} from '@/lib/observatory/diagnostics';
import {safeFixed} from '@/lib/observatory/formatters';
import {getTranslations} from '@/lib/observatory/i18n';
import type {ImportedTimelineBundle} from '@/lib/observatory/importer';
import type {
  LiveTimelineSummary,
  Locale,
  ObservatorySection,
  ObservatorySnapshot,
  ReplayEventTarget,
  SnapshotSourceMode,
} from '@/lib/observatory/types';
import AgentInspector from './AgentInspector';
import CivilizationDrawer from './CivilizationDrawer';
import ComparisonDrawer from './ComparisonDrawer';
import DiagnosticsModal from './DiagnosticsModal';
import EmptyWorldOverlay from './EmptyWorldOverlay';
import ErrorBoundary from './ErrorBoundary';
import HistoryDrawer from './HistoryDrawer';
import JsonImporterModal from './JsonImporterModal';
import LearningPanel from './LearningPanel';
import PopulationDrawer from './PopulationDrawer';
import ResourcesPanel from './ResourcesPanel';
import SurvivalPanel from './SurvivalPanel';
import TelemetryDrawer from './TelemetryDrawer';
import TimelineBar, {type SimSpeed} from './TimelineBar';
import TopBar from './TopBar';
import TrainingPanel from './TrainingPanel';

export default function ObservatoryShell() {
  const [locale, setLocale] = useState<Locale>('ar');
  const [snapshot, setSnapshot] = useState<ObservatorySnapshot | null>(null);
  const [sourceMode, setSourceMode] = useState<SnapshotSourceMode>('empty');
  const [activeSection, setActiveSection] = useState<ObservatorySection>('overview');

  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [replayTarget, setReplayTarget] = useState<ReplayEventTarget | null>(null);

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

  // Diagnostics
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [diagnosticErrorCount, setDiagnosticErrorCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const syncCount = () => setDiagnosticErrorCount(getDiagnosticEntries().length);
    syncCount();
    return subscribeDiagnostics(syncCount);
  }, []);

  const t = useMemo(() => getTranslations(locale), [locale]);
  const agentLookup = useMemo(() => buildAgentLookupMap(snapshot), [snapshot]);

  // Keep <html dir & lang> synced with locale
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale]);

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
      setReplayTarget(null);
      if (parsed.simulation_phase === 'training') {
        setActiveSection('training');
      }
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
      setReplayTarget(null);
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
        body: JSON.stringify({seed: Math.floor(Date.now() % 100000), initial_population: 100, max_ticks: 10}),
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
      setReplayTarget(null);
      await refreshLiveStatus();
    } catch (err) {
      reportClientError('ObservatoryShell:handleStartLiveWorld', err);
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
        if (
          parsed.demographics.living_count === 0 &&
          !parsed.recovery_state?.auto_recover_on_extinction
        ) {
          setIsPlaying(false);
        }
        await refreshLiveStatus();
      } catch (stepErr) {
        reportClientError('ObservatoryShell:stepLiveSimulation', stepErr);
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
      setActiveSection('history');
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
      setReplayTarget(null);

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

  const handleInspectAgent = useCallback((id: number) => {
    setSelectedAgentId(id);
    setActiveSection('population');
  }, []);

  const navItems: Array<{id: ObservatorySection; label: string; icon: React.ReactNode}> = [
    {id: 'overview', label: t.navOverview, icon: <LayoutDashboard className="h-3.5 w-3.5" />},
    {id: 'population', label: t.navPopulation, icon: <Users className="h-3.5 w-3.5" />},
    {id: 'survival', label: t.navSurvival, icon: <HeartCrack className="h-3.5 w-3.5" />},
    {id: 'resources', label: t.navResources, icon: <Sprout className="h-3.5 w-3.5" />},
    {id: 'civilization', label: t.navCivilization, icon: <Landmark className="h-3.5 w-3.5" />},
    {id: 'learning', label: t.navLearning, icon: <Brain className="h-3.5 w-3.5" />},
    {id: 'training', label: t.navTraining, icon: <Layers className="h-3.5 w-3.5" />},
    {id: 'history', label: t.navHistory, icon: <History className="h-3.5 w-3.5" />},
  ];

  const achievedMilestones = useMemo(() => {
    if (!snapshot) return [];
    return Object.entries(snapshot.history_layers.milestones)
      .filter(([, tick]) => tick !== null)
      .sort((a, b) => (a[1] ?? 0) - (b[1] ?? 0));
  }, [snapshot]);

  return (
    <div
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className="flex min-h-screen w-full flex-col bg-[#0B0F14] text-[#E6EDF3]"
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

      <TopBar
        t={t}
        locale={locale}
        snapshot={snapshot}
        sourceMode={sourceMode}
        liveApiAvailable={liveApiAvailable}
        creatingLiveWorld={creatingLiveWorld}
        diagnosticErrorCount={diagnosticErrorCount}
        onToggleLocale={() => setLocale((prev) => (prev === 'ar' ? 'en' : 'ar'))}
        onUploadClick={() => fileInputRef.current?.click()}
        onOpenMultiImporter={() => setImporterOpen(true)}
        onStartLiveWorld={() => void handleStartLiveWorld()}
        onRefreshPublished={() => void loadPublishedSnapshot()}
        onOpenDiagnostics={() => setDiagnosticsOpen(true)}
      />

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

      {/* Section Navigation Bar */}
      {snapshot && (
        <nav className="border-b border-white/10 bg-[#121821]/80">
          <div className="mx-auto flex w-full max-w-[1600px] items-center gap-1 overflow-x-auto px-3 py-2 md:px-6">
            {navItems.map((item) => {
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? 'border-[#D99B26] bg-[#D99B26]/15 text-[#F2BE49]'
                      : 'border-white/10 bg-[#18212C] text-[#9FB0C3] hover:border-white/25 hover:text-[#E6EDF3]'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.id === 'training' && snapshot.training_analytics && (
                    <span className="font-mono text-[10px] text-[#57b8d8]">
                      ({snapshot.training_analytics.agent_count})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-3 py-5 md:px-6">
        <ErrorBoundary
          scope="observatory_dashboard"
          diagnosticsLabel={t.diagButton}
          onOpenDiagnostics={() => setDiagnosticsOpen(true)}
        >
          {!snapshot ? (
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
          ) : (
            <div className="space-y-4">
              {uploadError && (
                <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {t.uploadErrorTitle}: {uploadError}
                </div>
              )}

              {!snapshot.analytics.available_from_engine && (
                <div className="flex items-start gap-2 rounded border border-[#D99B26]/40 bg-[#D99B26]/10 px-3 py-2 text-xs text-[#F2BE49]">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{t.legacyAnalyticsNotice}</span>
                </div>
              )}

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSection}
                  initial={{opacity: 0, y: 6}}
                  animate={{opacity: 1, y: 0}}
                  exit={{opacity: 0, y: -4}}
                  transition={{duration: 0.16}}
                >
                  {activeSection === 'overview' && (
                    <div className="space-y-5 text-xs">
                      {/* Executive KPI Strip */}
                      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
                        <div className="rounded-md border border-white/10 bg-[#121821] p-3">
                          <div className="flex items-center gap-1.5 text-[11px] text-[#9FB0C3]">
                            <Users className="h-3.5 w-3.5 text-[#57b8d8]" />
                            <span>{t.livingLabel} / {t.totalEverLived}</span>
                          </div>
                          <div className="mt-1 font-mono text-lg font-bold tabular-nums text-emerald-300">
                            {snapshot.analytics.population.living_count}{' '}
                            <span className="text-xs font-normal text-[#9FB0C3]">
                              / {snapshot.analytics.population.total_ever_lived}
                            </span>
                          </div>
                          <div className="mt-0.5 font-mono text-[10px] text-[#9FB0C3]">
                            {t.birthsTotal}: {snapshot.analytics.population.births_total}
                          </div>
                        </div>

                        <div className="rounded-md border border-white/10 bg-[#121821] p-3">
                          <div className="flex items-center gap-1.5 text-[11px] text-[#9FB0C3]">
                            <HeartCrack className="h-3.5 w-3.5 text-red-400" />
                            <span>{t.avgLifespan}</span>
                          </div>
                          <div className="mt-1 font-mono text-lg font-bold tabular-nums text-[#E6EDF3]">
                            {safeFixed(snapshot.analytics.survival.avg_lifespan_ticks, 1)}{' '}
                            <span className="text-xs font-normal text-[#9FB0C3]">{t.tickUnit}</span>
                          </div>
                          <div className="mt-0.5 font-mono text-[10px] text-red-300">
                            {t.prematureRate}: {safeFixed(snapshot.analytics.survival.premature_death_rate_pct, 1)}%
                          </div>
                        </div>

                        <div className="rounded-md border border-white/10 bg-[#121821] p-3">
                          <div className="flex items-center gap-1.5 text-[11px] text-[#9FB0C3]">
                            <Sprout className="h-3.5 w-3.5 text-emerald-400" />
                            <span>{t.foodConsumedTotal}</span>
                          </div>
                          <div className="mt-1 font-mono text-lg font-bold tabular-nums text-[#F2BE49]">
                            {safeFixed(snapshot.analytics.food_water.food_consumed_total, 1)}
                          </div>
                          <div className="mt-0.5 font-mono text-[10px] text-[#9FB0C3]">
                            {t.availConsumableFood}: {safeFixed(snapshot.analytics.food_water.available_consumable_food, 0)}
                          </div>
                        </div>

                        <div className="rounded-md border border-white/10 bg-[#121821] p-3">
                          <div className="flex items-center gap-1.5 text-[11px] text-[#9FB0C3]">
                            <Droplets className="h-3.5 w-3.5 text-[#57b8d8]" />
                            <span>{t.waterConsumedTotal}</span>
                          </div>
                          <div className="mt-1 font-mono text-lg font-bold tabular-nums text-[#57b8d8]">
                            {safeFixed(snapshot.analytics.food_water.water_consumed_total, 1)}
                          </div>
                          <div className="mt-0.5 font-mono text-[10px] text-[#9FB0C3]">
                            {t.availWaterSources}: {snapshot.analytics.food_water.available_water_sources}
                          </div>
                        </div>

                        <div className="rounded-md border border-white/10 bg-[#121821] p-3">
                          <div className="flex items-center gap-1.5 text-[11px] text-[#9FB0C3]">
                            <Coins className="h-3.5 w-3.5 text-[#D99B26]" />
                            <span>{t.totalBarters} / {t.giniIndex}</span>
                          </div>
                          <div className="mt-1 font-mono text-lg font-bold tabular-nums text-[#E6EDF3]">
                            {snapshot.analytics.social_civilization.barters_count}{' '}
                            <span className="text-xs font-normal text-[#57b8d8]">
                              · {safeFixed(snapshot.analytics.economy.wealth_distribution.gini_inventory, 3)}
                            </span>
                          </div>
                          <div className="mt-0.5 font-mono text-[10px] text-[#9FB0C3]">
                            {t.activeGroups}: {snapshot.analytics.social_civilization.active_groups_count}
                          </div>
                        </div>

                        <div className="rounded-md border border-white/10 bg-[#121821] p-3">
                          <div className="flex items-center gap-1.5 text-[11px] text-[#9FB0C3]">
                            <Brain className="h-3.5 w-3.5 text-[#F2BE49]" />
                            <span>{t.totalBrainUpdates}</span>
                          </div>
                          <div className="mt-1 font-mono text-lg font-bold tabular-nums text-[#F2BE49]">
                            {snapshot.analytics.learning_intelligence.total_brain_updates.toLocaleString()}
                          </div>
                          <div className="mt-0.5 font-mono text-[10px] text-[#9FB0C3]">
                            {t.skillsAcquired}: {snapshot.analytics.learning_intelligence.total_skills_acquired}
                          </div>
                        </div>
                      </div>

                      {/* Training Banner Summary if Present */}
                      {snapshot.training_analytics && (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#3B82A6]/50 bg-[#3B82A6]/10 p-4">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 font-semibold text-[#57b8d8]">
                              <Layers className="h-4 w-4" />
                              <span>{t.trainTitle}</span>
                            </div>
                            <div className="text-[11px] text-[#9FB0C3]">
                              {t.trainTicksExec}: {snapshot.training_analytics.training_ticks_executed} ·{' '}
                              {t.trainTotalAttempts}: {snapshot.training_analytics.total_attempts} ·{' '}
                              {t.trainAvgSurvival}: {safeFixed(snapshot.training_analytics.survival_avg_ticks, 1)} {t.tickUnit} ·{' '}
                              {t.trainLongestSurvival}: {snapshot.training_analytics.longest_survival_ticks} {t.tickUnit}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveSection('training')}
                            className="rounded border border-[#D99B26]/60 bg-[#D99B26]/20 px-3 py-1.5 text-xs font-semibold text-[#F2BE49] hover:bg-[#D99B26]/30"
                          >
                            {t.navTraining}
                          </button>
                        </div>
                      )}

                      {/* Ecosystem Conditions & Milestones */}
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <section className="space-y-2.5 rounded-md border border-white/10 bg-[#121821] p-4">
                          <h3 className="flex items-center gap-1.5 font-semibold text-emerald-300">
                            <CloudSun className="h-4 w-4" />
                            <span>
                              {t.weatherLabel}: {t.weather[snapshot.ecosystem.weather.condition] ?? snapshot.ecosystem.weather.condition} (
                              {safeFixed(snapshot.ecosystem.weather.temperature_c, 1)}°C)
                            </span>
                          </h3>
                          <div className="grid grid-cols-2 gap-2 font-mono text-[11px] sm:grid-cols-3">
                            <div className="rounded border border-white/10 bg-[#18212C] p-2">
                              <div className="text-[10px] text-[#9FB0C3]">{t.foodBiomass}</div>
                              <div className="font-bold text-emerald-300">{safeFixed(snapshot.ecosystem.total_food_biomass, 0)}</div>
                            </div>
                            <div className="rounded border border-white/10 bg-[#18212C] p-2">
                              <div className="text-[10px] text-[#9FB0C3]">{t.woodBiomass}</div>
                              <div className="font-bold text-[#F2BE49]">{safeFixed(snapshot.ecosystem.total_wood_biomass, 0)}</div>
                            </div>
                            <div className="rounded border border-white/10 bg-[#18212C] p-2">
                              <div className="text-[10px] text-[#9FB0C3]">{t.soilMoisture}</div>
                              <div className="font-bold text-[#57b8d8]">
                                {safeFixed(snapshot.ecosystem.avg_soil_moisture * 100, 1)}%
                              </div>
                            </div>
                            <div className="rounded border border-white/10 bg-[#18212C] p-2">
                              <div className="text-[10px] text-[#9FB0C3]">{t.herbivores}</div>
                              <div className="font-bold text-[#E6EDF3]">{snapshot.ecosystem.herbivores_alive}</div>
                            </div>
                            <div className="rounded border border-white/10 bg-[#18212C] p-2">
                              <div className="text-[10px] text-[#9FB0C3]">{t.predators}</div>
                              <div className="font-bold text-red-300">{snapshot.ecosystem.predators_alive}</div>
                            </div>
                            <div className="rounded border border-white/10 bg-[#18212C] p-2">
                              <div className="text-[10px] text-[#9FB0C3]">{t.stabilityIndex}</div>
                              <div className="font-bold text-[#57b8d8]">
                                {snapshot.crime_and_stability.stability_index !== null
                                  ? `${safeFixed(snapshot.crime_and_stability.stability_index * 100, 0)}%`
                                  : '—'}
                              </div>
                            </div>
                          </div>
                        </section>

                        <section className="space-y-2.5 rounded-md border border-white/10 bg-[#121821] p-4">
                          <h3 className="flex items-center gap-1.5 font-semibold text-[#F2BE49]">
                            <Milestone className="h-4 w-4" />
                            <span>{t.milestonesTitle}</span>
                          </h3>
                          {achievedMilestones.length === 0 ? (
                            <div className="rounded border border-white/10 bg-[#18212C] p-4 text-center text-[#9FB0C3]">
                              {t.notYetInvented}
                            </div>
                          ) : (
                            <div className="grid max-h-40 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
                              {achievedMilestones.map(([k, tickVal]) => (
                                <div
                                  key={k}
                                  className="flex items-center justify-between rounded border border-white/10 bg-[#18212C] px-2.5 py-1.5 text-[11px]"
                                >
                                  <span className="truncate text-[#E6EDF3]">{t.milestones[k] ?? k}</span>
                                  <span className="font-mono text-[#F2BE49]">T{tickVal}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </section>
                      </div>

                      {/* Time-Series Telemetry Charts */}
                      <TelemetryDrawer t={t} locale={locale} snapshot={snapshot} />
                    </div>
                  )}

                  {activeSection === 'population' && (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                      <div className="lg:col-span-7">
                        <PopulationDrawer
                          t={t}
                          snapshot={snapshot}
                          selectedAgentId={selectedAgentId}
                          agentLookup={agentLookup}
                          onSelectAgent={(id) => setSelectedAgentId(id)}
                        />
                      </div>
                      <div className="lg:col-span-5">
                        <div className="sticky top-20 rounded-md border border-white/10 bg-[#121821] p-4">
                          <AgentInspector
                            t={t}
                            agent={selectedAgent}
                            agentLookup={agentLookup}
                            onSelectAgent={(id) => setSelectedAgentId(id)}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {activeSection === 'survival' && <SurvivalPanel t={t} snapshot={snapshot} />}
                  {activeSection === 'resources' && <ResourcesPanel t={t} snapshot={snapshot} />}
                  {activeSection === 'civilization' && (
                    <CivilizationDrawer t={t} snapshot={snapshot} />
                  )}
                  {activeSection === 'learning' && <LearningPanel t={t} snapshot={snapshot} />}
                  {activeSection === 'training' && (
                    <TrainingPanel t={t} snapshot={snapshot} onSelectAgent={handleInspectAgent} />
                  )}

                  {activeSection === 'history' && (
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                      <div className="xl:col-span-7">
                        <HistoryDrawer
                          t={t}
                          snapshot={snapshot}
                          replayTarget={replayTarget}
                          onReplayEvent={setReplayTarget}
                          onClearReplay={() => setReplayTarget(null)}
                          onSelectAgent={handleInspectAgent}
                        />
                      </div>
                      <div className="xl:col-span-5">
                        <div className="rounded-md border border-white/10 bg-[#121821] p-4">
                          <ComparisonDrawer
                            t={t}
                            snapshot={snapshot}
                            liveApiAvailable={liveApiAvailable}
                            liveTimelines={liveTimelines}
                            importedPairSnapshots={importedPairSnapshots}
                            onSelectAgent={handleInspectAgent}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Subtle Activity Footer Line */}
              <div className="flex items-center justify-between border-t border-white/10 pt-3 text-[11px] text-[#9FB0C3]">
                <span className="flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-[#3B82A6]" />
                  <span>{t.worldIdLabel}: {snapshot.world_id}</span>
                </span>
                <span className="font-mono">
                  v{snapshot.export_schema_version} · {snapshot.backend}
                </span>
              </div>
            </div>
          )}
        </ErrorBoundary>
      </main>

      {/* Unlimited Multi-File JSON Importer Modal */}
      <JsonImporterModal
        t={t}
        open={importerOpen}
        canRollback={rollbackState !== null}
        onClose={() => setImporterOpen(false)}
        onCommitBundle={handleCommitImportedBundle}
        onRollback={handleRollbackImport}
      />

      {/* Client Diagnostics & Error Guard Modal */}
      <DiagnosticsModal
        t={t}
        open={diagnosticsOpen}
        snapshot={snapshot}
        sourceMode={sourceMode}
        onClose={() => setDiagnosticsOpen(false)}
      />
    </div>
  );
}
