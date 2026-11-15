'use client';

import React from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bug,
  Clock,
  FolderOpen,
  Layers,
  Play,
  RefreshCw,
  Upload,
  Users,
} from 'lucide-react';
import {formatDurationSeconds} from '@/lib/observatory/adapter';
import {formatTimestampUtc, safeFixed} from '@/lib/observatory/formatters';
import type {Translations} from '@/lib/observatory/i18n';
import type {
  Locale,
  ObservatorySnapshot,
  SnapshotSourceMode,
} from '@/lib/observatory/types';

interface TopBarProps {
  t: Translations;
  locale: Locale;
  snapshot: ObservatorySnapshot | null;
  sourceMode: SnapshotSourceMode;
  liveApiAvailable: boolean;
  creatingLiveWorld: boolean;
  diagnosticErrorCount?: number;
  onToggleLocale: () => void;
  onUploadClick: () => void;
  onOpenMultiImporter: () => void;
  onStartLiveWorld: () => void;
  onRefreshPublished: () => void;
  onOpenDiagnostics?: () => void;
}

export default function TopBar({
  t,
  locale,
  snapshot,
  sourceMode,
  liveApiAvailable,
  creatingLiveWorld,
  diagnosticErrorCount = 0,
  onToggleLocale,
  onUploadClick,
  onOpenMultiImporter,
  onStartLiveWorld,
  onRefreshPublished,
  onOpenDiagnostics,
}: TopBarProps) {
  const sourceLabel =
    sourceMode === 'live_runner'
      ? t.sourceLiveRunner
      : sourceMode === 'published'
        ? t.sourcePublished
        : sourceMode === 'uploaded'
          ? t.sourceUploaded
          : sourceMode === 'test_fixture'
            ? t.sourceTestFixture
            : t.sourceEmpty;

  const sourceAccent =
    sourceMode === 'test_fixture'
      ? 'border-[#D99B26]/60 bg-[#D99B26]/15 text-[#F2BE49]'
      : sourceMode === 'live_runner' || sourceMode === 'published' || sourceMode === 'uploaded'
        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
        : 'border-white/10 bg-[#18212C] text-[#9FB0C3]';

  const phaseLabel =
    snapshot?.simulation_phase === 'training' ? t.phaseTraining : t.phaseCivilization;

  return (
    <header className="sticky top-0 z-30 flex flex-col border-b border-white/10 bg-[#121821]/95 backdrop-blur text-[#E6EDF3]">
      <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-2 px-3 py-2.5 md:px-6">
        {/* Zone 1: Brand, Provenance & Phase */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-[#D99B26]/40 bg-[#D99B26]/10 text-[#D99B26]">
            <BarChart3 className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-sm font-semibold tracking-tight md:text-base">
                {t.appTitle}
              </h1>
              <span className={`rounded border px-2 py-0.5 text-[11px] font-medium ${sourceAccent}`}>
                {sourceLabel}
              </span>
              {snapshot && (
                <span className="hidden items-center gap-1 rounded border border-[#3B82A6]/50 bg-[#3B82A6]/15 px-2 py-0.5 text-[11px] font-medium text-[#57b8d8] sm:inline-flex">
                  <Layers className="h-3 w-3" />
                  <span>{phaseLabel}</span>
                </span>
              )}
            </div>
            <div className="hidden items-center gap-2 text-[11px] text-[#9FB0C3] lg:flex">
              <span className="truncate">{t.appSubtitle}</span>
              {snapshot && (
                <>
                  <span className="text-white/20">·</span>
                  <span className="font-mono text-[10px] text-[#9FB0C3]">
                    {t.snapshotTimeLabel}: {formatTimestampUtc(snapshot.exported_at_utc, locale)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Zone 2: Clock & Population Summary */}
        {snapshot && (
          <div className="order-3 flex w-full flex-wrap items-center justify-start gap-x-4 gap-y-1 border-t border-white/5 pt-2 text-xs xl:order-2 xl:w-auto xl:border-t-0 xl:pt-0">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-[#D99B26]" />
              <span className="font-mono font-semibold tabular-nums text-[#E6EDF3]">
                {snapshot.clock.sim_date}
              </span>
              <span className="font-mono text-[11px] tabular-nums text-[#9FB0C3]">
                ({snapshot.clock.tick} {t.tickUnit})
              </span>
            </div>

            <div className="hidden items-center gap-1.5 sm:flex">
              <span className="text-[#9FB0C3]">{t.realClockLabel}:</span>
              <span className="font-mono tabular-nums text-[#E6EDF3]">
                {formatDurationSeconds(snapshot.clock.real_elapsed_seconds)}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-[#3B82A6]" />
              <span className="font-mono font-semibold tabular-nums text-emerald-300">
                {snapshot.demographics.living_count}
              </span>
              <span className="text-[#9FB0C3]">{t.livingLabel}</span>
              <span className="text-white/20">·</span>
              <span className="font-mono tabular-nums text-[#9FB0C3]">
                {snapshot.demographics.deceased_count}
              </span>
              <span className="text-[#9FB0C3]">{t.deceasedLabel}</span>
              <span className="text-white/20">·</span>
              <span className="font-mono tabular-nums text-[#D99B26]">
                {t.genShort} {snapshot.demographics.max_generation}
              </span>
            </div>

            <div className="hidden items-center gap-1.5 md:flex">
              <span className="text-[#9FB0C3]">
                {t.seasons[snapshot.clock.season] ?? snapshot.clock.season}
              </span>
              <span className="text-white/20">·</span>
              <span className="text-[#9FB0C3]">
                {t.weather[snapshot.ecosystem.weather.condition] ?? snapshot.ecosystem.weather.condition}
              </span>
              <span className="font-mono tabular-nums text-[#E6EDF3]">
                {safeFixed(snapshot.ecosystem.weather.temperature_c, 1)}°C
              </span>
            </div>
          </div>
        )}

        {/* Zone 3: Actions */}
        <div className="order-2 flex items-center gap-1.5 xl:order-3">
          {liveApiAvailable && (
            <button
              type="button"
              disabled={creatingLiveWorld}
              onClick={onStartLiveWorld}
              className="flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/25 disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.newWorldBtn}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenMultiImporter}
            className="flex items-center gap-1.5 rounded border border-[#D99B26]/50 bg-[#D99B26]/15 px-2.5 py-1.5 text-xs font-medium text-[#F2BE49] transition hover:bg-[#D99B26]/25"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t.multiImportBtn}</span>
          </button>

          <button
            type="button"
            onClick={onUploadClick}
            title={t.uploadSnapshotBtn}
            className="flex items-center gap-1 rounded border border-white/10 bg-[#18212C] px-2.5 py-1.5 text-xs text-[#9FB0C3] transition hover:border-white/25 hover:text-[#E6EDF3]"
          >
            <Upload className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">{t.uploadSnapshotBtn}</span>
          </button>

          <button
            type="button"
            onClick={onRefreshPublished}
            title={t.refreshPublishedBtn}
            className="flex items-center gap-1 rounded border border-white/10 bg-[#18212C] px-2 py-1.5 text-xs text-[#9FB0C3] transition hover:border-white/25 hover:text-[#E6EDF3]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>

          {onOpenDiagnostics && (
            <button
              type="button"
              onClick={onOpenDiagnostics}
              title={t.diagTitle}
              className={`flex items-center gap-1 rounded border px-2 py-1.5 text-xs transition ${
                diagnosticErrorCount > 0
                  ? 'border-red-500/50 bg-red-500/15 text-red-200 hover:bg-red-500/25'
                  : 'border-white/10 bg-[#18212C] text-[#9FB0C3] hover:border-white/25 hover:text-[#E6EDF3]'
              }`}
            >
              <Bug className="h-3.5 w-3.5" />
              {diagnosticErrorCount > 0 && (
                <span className="font-mono text-[10px] font-bold">{diagnosticErrorCount}</span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onToggleLocale}
            className="rounded border border-white/10 bg-[#18212C] px-2.5 py-1.5 font-mono text-xs font-semibold text-[#E6EDF3] transition hover:border-white/25"
          >
            {locale === 'ar' ? 'EN' : 'AR'}
          </button>
        </div>
      </div>

      {/* Explicit Test Fixture Warning Banner */}
      {sourceMode === 'test_fixture' && (
        <div className="flex items-center justify-center gap-2 border-t border-[#D99B26]/30 bg-[#D99B26]/15 px-3 py-1 text-xs font-medium text-[#F2BE49]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>{t.testFixtureWarning}</span>
        </div>
      )}
    </header>
  );
}
