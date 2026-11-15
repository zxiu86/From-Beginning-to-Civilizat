'use client';

import React from 'react';
import {
  AlertTriangle,
  Clock,
  FolderOpen,
  Globe,
  Play,
  RefreshCw,
  SlidersHorizontal,
  Upload,
  Users,
} from 'lucide-react';
import {formatDurationSeconds} from '@/lib/observatory/adapter';
import type {Translations} from '@/lib/observatory/i18n';
import type {
  Locale,
  ObservatorySnapshot,
  QualityPreset,
  SnapshotSourceMode,
} from '@/lib/observatory/types';

interface TopBarProps {
  t: Translations;
  locale: Locale;
  snapshot: ObservatorySnapshot | null;
  sourceMode: SnapshotSourceMode;
  quality: QualityPreset;
  fps: number;
  softwareGl: boolean;
  liveApiAvailable: boolean;
  creatingLiveWorld: boolean;
  onToggleLocale: () => void;
  onChangeQuality: (q: QualityPreset) => void;
  onUploadClick: () => void;
  onOpenMultiImporter: () => void;
  onStartLiveWorld: () => void;
  onRefreshPublished: () => void;
}

export default function TopBar({
  t,
  locale,
  snapshot,
  sourceMode,
  quality,
  fps,
  softwareGl,
  liveApiAvailable,
  creatingLiveWorld,
  onToggleLocale,
  onChangeQuality,
  onUploadClick,
  onOpenMultiImporter,
  onStartLiveWorld,
  onRefreshPublished,
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

  return (
    <header className="pointer-events-auto relative z-30 flex flex-col border-b border-white/10 bg-[#121821]/95 text-[#E6EDF3]">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 md:px-5">
        {/* Zone 1: Brand & Source */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-[#D99B26]/40 bg-[#D99B26]/10 text-[#D99B26]">
            <Globe className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-semibold tracking-tight md:text-base">
                {t.appTitle}
              </h1>
              <span className={`hidden rounded border px-2 py-0.5 text-[11px] font-medium sm:inline-block ${sourceAccent}`}>
                {sourceLabel}
              </span>
              {snapshot && snapshot.timeline_kind === 'experimental_rebirth' && (
                <span className="hidden rounded border border-[#3B82A6]/50 bg-[#3B82A6]/20 px-2 py-0.5 text-[11px] font-medium text-[#57b8d8] md:inline-block">
                  {t.timelineExperimental}
                </span>
              )}
            </div>
            <p className="hidden truncate text-[11px] text-[#9FB0C3] lg:block">{t.appSubtitle}</p>
          </div>
        </div>

        {/* Zone 2: World Clock & Live KPIs */}
        {snapshot && (
          <div className="order-3 flex w-full flex-wrap items-center justify-start gap-x-4 gap-y-1 border-t border-white/5 pt-1.5 text-xs lg:order-2 lg:w-auto lg:border-t-0 lg:pt-0">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-[#D99B26]" />
              <span className="text-[#9FB0C3]">{t.simClockLabel}:</span>
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
              <span className="font-mono font-semibold tabular-nums text-[#E6EDF3]">
                {snapshot.demographics.living_count}
              </span>
              <span className="text-[#9FB0C3]">{t.livingLabel}</span>
              <span className="text-white/20">·</span>
              <span className="font-mono tabular-nums text-[#9FB0C3]">
                {snapshot.demographics.deceased_count}
              </span>
              <span className="text-[#9FB0C3]">{t.deceasedLabel}</span>
              <span className="hidden text-white/20 md:inline">·</span>
              <span className="hidden font-mono tabular-nums text-[#D99B26] md:inline">
                {t.genShort} {snapshot.demographics.max_generation}
              </span>
            </div>

            <div className="hidden items-center gap-1.5 xl:flex">
              <span className="text-[#9FB0C3]">
                {t.seasons[snapshot.clock.season] ?? snapshot.clock.season}
              </span>
              <span className="text-white/20">·</span>
              <span className="text-[#9FB0C3]">
                {t.weather[snapshot.ecosystem.weather.condition] ?? snapshot.ecosystem.weather.condition}
              </span>
              <span className="font-mono tabular-nums text-[#E6EDF3]">
                {snapshot.ecosystem.weather.temperature_c.toFixed(1)}°C
              </span>
            </div>
          </div>
        )}

        {/* Zone 3: Actions & 4-Tier Quality Selector */}
        <div className="order-2 flex items-center gap-1.5 lg:order-3">
          {liveApiAvailable && (
            <button
              type="button"
              disabled={creatingLiveWorld}
              onClick={onStartLiveWorld}
              className="flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/25 disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">{t.newWorldBtn}</span>
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
            className="flex items-center gap-1 rounded border border-white/10 bg-[#18212C] px-2 py-1.5 text-xs text-[#9FB0C3] transition hover:border-white/25 hover:text-[#E6EDF3]"
          >
            <Upload className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={onRefreshPublished}
            title={t.refreshPublishedBtn}
            className="flex items-center gap-1 rounded border border-white/10 bg-[#18212C] px-2 py-1.5 text-xs text-[#9FB0C3] transition hover:border-white/25 hover:text-[#E6EDF3]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>

          <div className="flex items-center gap-1 rounded border border-white/10 bg-[#18212C] px-1.5 py-1 text-xs">
            <SlidersHorizontal className="h-3.5 w-3.5 text-[#9FB0C3]" />
            <select
              value={quality}
              onChange={(e) => onChangeQuality(e.target.value as QualityPreset)}
              className="bg-transparent text-xs text-[#E6EDF3] focus:outline-none"
            >
              <option value="low" className="bg-[#121821]">
                {t.qualityLow}
              </option>
              <option value="medium" className="bg-[#121821]">
                {t.qualityMedium}
              </option>
              <option value="high" className="bg-[#121821]">
                {t.qualityHigh}
              </option>
              <option value="ultra" className="bg-[#121821]">
                {t.qualityUltra}
              </option>
            </select>
            {fps > 0 && (
              <span className="hidden border-s border-white/10 ps-1.5 font-mono text-[10px] tabular-nums text-[#9FB0C3] md:inline">
                {fps} {t.fpsLabel}
              </span>
            )}
          </div>

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

      {softwareGl && (
        <div className="flex items-center justify-center gap-2 border-t border-white/5 bg-[#18212C] px-3 py-1 text-[11px] text-[#9FB0C3]">
          <span>{t.softwareGlBanner}</span>
        </div>
      )}
    </header>
  );
}
