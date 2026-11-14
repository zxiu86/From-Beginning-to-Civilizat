'use client';

import React from 'react';
import {
  Clock,
  Globe,
  RefreshCw,
  SlidersHorizontal,
  Upload,
  Users,
  AlertTriangle,
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
  softwareGl: boolean;
  onToggleLocale: () => void;
  onToggleQuality: () => void;
  onUploadClick: () => void;
  onRefreshPublished: () => void;
}

export default function TopBar({
  t,
  locale,
  snapshot,
  sourceMode,
  quality,
  softwareGl,
  onToggleLocale,
  onToggleQuality,
  onUploadClick,
  onRefreshPublished,
}: TopBarProps) {
  const sourceLabel =
    sourceMode === 'published'
      ? t.sourcePublished
      : sourceMode === 'uploaded'
        ? t.sourceUploaded
        : sourceMode === 'test_fixture'
          ? t.sourceTestFixture
          : t.sourceEmpty;

  const sourceAccent =
    sourceMode === 'test_fixture'
      ? 'border-[#D99B26]/60 bg-[#D99B26]/15 text-[#F2BE49]'
      : sourceMode === 'published' || sourceMode === 'uploaded'
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
            </div>
            <p className="hidden truncate text-[11px] text-[#9FB0C3] lg:block">{t.appSubtitle}</p>
          </div>
        </div>

        {/* Zone 2: World Clock & Live KPIs (strictly separated Real vs Simulated Time) */}
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

        {/* Zone 3: Actions & Preferences */}
        <div className="order-2 flex items-center gap-1.5 lg:order-3">
          <button
            type="button"
            onClick={onUploadClick}
            className="flex items-center gap-1.5 rounded border border-[#D99B26]/50 bg-[#D99B26]/15 px-2.5 py-1.5 text-xs font-medium text-[#F2BE49] transition hover:bg-[#D99B26]/25"
          >
            <Upload className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t.uploadSnapshotBtn}</span>
          </button>

          <button
            type="button"
            onClick={onRefreshPublished}
            title={t.refreshPublishedBtn}
            className="flex items-center gap-1 rounded border border-white/10 bg-[#18212C] px-2 py-1.5 text-xs text-[#9FB0C3] transition hover:border-white/25 hover:text-[#E6EDF3]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={onToggleQuality}
            title={quality === 'high' ? t.qualityHigh : t.qualityLow}
            className="flex items-center gap-1 rounded border border-white/10 bg-[#18212C] px-2 py-1.5 text-xs text-[#9FB0C3] transition hover:border-white/25 hover:text-[#E6EDF3]"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden md:inline">
              {quality === 'high' ? t.qualityHigh : t.qualityLow}
            </span>
          </button>

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
