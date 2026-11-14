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
import type {
  ActiveDrawer,
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
import EmptyWorldOverlay from './EmptyWorldOverlay';
import FpvHud from './FpvHud';
import HistoryDrawer from './HistoryDrawer';
import PopulationDrawer from './PopulationDrawer';
import TelemetryDrawer from './TelemetryDrawer';
import TopBar from './TopBar';
import WorldCanvas3D from './WorldCanvas3D';

export default function ObservatoryShell() {
  const [locale, setLocale] = useState<Locale>('ar');
  const [snapshot, setSnapshot] = useState<ObservatorySnapshot | null>(null);
  const [sourceMode, setSourceMode] = useState<SnapshotSourceMode>('empty');
  const [quality, setQuality] = useState<QualityPreset>('high');
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

  const loadPublishedSnapshot = useCallback(async () => {
    try {
      const res = await fetch('./data/latest_snapshot.json', {cache: 'no-store'});
      if (!res.ok) return;
      const json: unknown = await res.json();
      const parsed = validateAndNormalizeSnapshot(json);
      setSnapshot(parsed);
      setSourceMode('published');
      setUploadError(null);
    } catch {
      // Remain cleanly in empty state if no published snapshot exists yet
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('./data/latest_snapshot.json', {cache: 'no-store'});
        if (!res.ok || !active) return;
        const json: unknown = await res.json();
        const parsed = validateAndNormalizeSnapshot(json);
        if (!active) return;
        setSnapshot(parsed);
        setSourceMode('published');
        setUploadError(null);
      } catch {
        // Remain cleanly in empty state if no published snapshot exists yet
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleUploadFile = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const raw: unknown = JSON.parse(text);
      const parsed = validateAndNormalizeSnapshot(raw);
      setSnapshot(parsed);
      setSourceMode('uploaded');
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
    try {
      const res = await fetch('./fixtures/test_world_snapshot.json', {cache: 'no-store'});
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const raw: unknown = await res.json();
      const parsed = validateAndNormalizeSnapshot(raw);
      setSnapshot(parsed);
      setSourceMode('test_fixture');
      setFpvAgentId(null);
      setReplayTarget(null);
      setResetSignal((n) => n + 1);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to load test fixture.');
    } finally {
      setLoadingFixture(false);
    }
  }, []);

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
              : '';

  return (
    <div
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#0B0F14] text-[#E6EDF3]"
    >
      {/* Hidden File Input for JSON Uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUploadFile(f);
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
          softwareGl={softwareGl}
          onToggleLocale={() => setLocale((prev) => (prev === 'ar' ? 'en' : 'ar'))}
          onToggleQuality={() => setQuality((prev) => (prev === 'high' ? 'low' : 'high'))}
          onUploadClick={() => fileInputRef.current?.click()}
          onRefreshPublished={loadPublishedSnapshot}
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
        />

        {/* Honest Empty State when no real snapshot is loaded */}
        {!snapshot && (
          <EmptyWorldOverlay
            t={t}
            uploadError={uploadError}
            loadingFixture={loadingFixture}
            onUploadFile={handleUploadFile}
            onUploadClick={() => fileInputRef.current?.click()}
            onLoadTestFixture={handleLoadTestFixture}
          />
        )}

        {/* Strictly Bounded First-Person View Sensory HUD */}
        {fpvAgent && !zenMode && (
          <FpvHud t={t} agent={fpvAgent} onExitFpv={() => setFpvAgentId(null)} />
        )}

        {/* Single Slide-Over Drawer (never crowds the 3D scene) */}
        <AnimatePresence>
          {snapshot && activeDrawer && !zenMode && !fpvAgent && (
            <motion.aside
              key={activeDrawer}
              initial={{opacity: 0, x: locale === 'ar' ? -24 : 24}}
              animate={{opacity: 1, x: 0}}
              exit={{opacity: 0, x: locale === 'ar' ? -24 : 24}}
              transition={{duration: 0.18}}
              className="pointer-events-auto absolute bottom-16 top-3 end-3 z-20 flex w-[calc(100%-1.5rem)] max-w-[430px] flex-col rounded-md border border-white/15 bg-[#121821]/95 shadow-2xl"
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
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

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
      </main>
    </div>
  );
}
