'use client';

import React from 'react';
import {Activity, Brain, Clock, Droplets} from 'lucide-react';
import {formatDurationSeconds} from '@/lib/observatory/adapter';
import {formatTimestampUtc, safeFixed} from '@/lib/observatory/formatters';
import type {Translations} from '@/lib/observatory/i18n';
import type {Locale, ObservatorySnapshot, TimelinePoint} from '@/lib/observatory/types';

interface TelemetryDrawerProps {
  t: Translations;
  locale: Locale;
  snapshot: ObservatorySnapshot;
}

function SvgSeriesChart({
  title,
  series,
  lines,
}: {
  title: string;
  series: TimelinePoint[];
  lines: Array<{label: string; color: string; accessor: (p: TimelinePoint) => number}>;
}) {
  const width = 420;
  const height = 125;
  const padX = 10;
  const padY = 12;

  let maxVal = 1;
  for (const p of series) {
    for (const l of lines) {
      const v = l.accessor(p);
      if (v > maxVal) maxVal = v;
    }
  }

  const buildPath = (accessor: (p: TimelinePoint) => number) => {
    if (series.length < 2) return '';
    return series
      .map((p, idx) => {
        const x = padX + (idx / (series.length - 1)) * (width - padX * 2);
        const y = height - padY - (accessor(p) / maxVal) * (height - padY * 2);
        return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  return (
    <div className="rounded border border-white/10 bg-[#18212C] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold text-[#E6EDF3]">{title}</h3>
        <span className="font-mono text-[10px] tabular-nums text-[#9FB0C3]">
          max {maxVal.toFixed(0)}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-32 w-full rounded bg-[#121821]">
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="rgba(255,255,255,0.06)" />
        {lines.map((l) => (
          <path
            key={l.label}
            d={buildPath(l.accessor)}
            fill="none"
            stroke={l.color}
            strokeWidth={2}
          />
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3 text-[10px]">
        {lines.map((l) => {
          const latest = series[series.length - 1];
          return (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{backgroundColor: l.color}} />
              <span className="text-[#9FB0C3]">{l.label}:</span>
              <span className="font-mono font-semibold tabular-nums text-[#E6EDF3]">
                {latest ? l.accessor(latest).toFixed(0) : '0'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TelemetryDrawer({t, locale, snapshot}: TelemetryDrawerProps) {
  const eco = snapshot.ecosystem;
  const series = snapshot.timeline_series;

  return (
    <div className="space-y-4 text-xs text-[#E6EDF3]">
      {/* Real Time vs Simulated Time & Snapshot Provenance */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-2 rounded border border-white/10 bg-[#18212C] p-3">
          <h3 className="flex items-center gap-1.5 font-semibold text-[#F2BE49]">
            <Clock className="h-3.5 w-3.5" />
            <span>
              {t.simClockLabel} / {t.realClockLabel}
            </span>
          </h3>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded bg-[#121821] p-2">
              <div className="text-[#9FB0C3]">{t.simClockLabel}</div>
              <div className="font-mono font-bold tabular-nums">{snapshot.clock.sim_date}</div>
            </div>
            <div className="rounded bg-[#121821] p-2">
              <div className="text-[#9FB0C3]">{t.realClockLabel}</div>
              <div className="font-mono font-bold tabular-nums">
                {formatDurationSeconds(snapshot.clock.real_elapsed_seconds)}
              </div>
            </div>
          </div>
          <div className="text-[10px] text-[#9FB0C3]">{t.clockRatioNote}</div>
          <div className="flex flex-wrap justify-between gap-2 border-t border-white/5 pt-2 font-mono text-[10px] text-[#9FB0C3]">
            <span>
              {t.worldIdLabel}: {snapshot.world_id}
            </span>
            <span>schema {snapshot.export_schema_version}</span>
          </div>
          <div className="font-mono text-[10px] text-[#9FB0C3]">
            {t.snapshotTimeLabel}: {formatTimestampUtc(snapshot.exported_at_utc, locale)}
          </div>
        </div>

        {/* Ecosystem Summary */}
        <div className="rounded border border-white/10 bg-[#18212C] p-3">
          <h3 className="mb-2 flex items-center gap-1.5 font-semibold text-emerald-300">
            <Droplets className="h-3.5 w-3.5" />
            <span>{t.weatherLabel} & Biomass</span>
          </h3>
          <div className="grid grid-cols-2 gap-2 font-mono text-[11px] tabular-nums">
            <div className="rounded bg-[#121821] p-2">
              <div className="font-sans text-[10px] text-[#9FB0C3]">{t.foodBiomass}</div>
              <div>{safeFixed(eco.total_food_biomass, 0)}</div>
            </div>
            <div className="rounded bg-[#121821] p-2">
              <div className="font-sans text-[10px] text-[#9FB0C3]">{t.woodBiomass}</div>
              <div>{safeFixed(eco.total_wood_biomass, 0)}</div>
            </div>
            <div className="rounded bg-[#121821] p-2">
              <div className="font-sans text-[10px] text-[#9FB0C3]">
                {t.herbivores} / {t.predators}
              </div>
              <div>
                {eco.herbivores_alive} / {eco.predators_alive}
              </div>
            </div>
            <div className="rounded bg-[#121821] p-2">
              <div className="font-sans text-[10px] text-[#9FB0C3]">{t.soilMoisture}</div>
              <div>{safeFixed(eco.avg_soil_moisture * 100, 1)}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Neural Learning Quick Telemetry */}
      {snapshot.learning_telemetry && (
        <div className="rounded border border-white/10 bg-[#18212C] p-3">
          <h3 className="mb-2 flex items-center gap-1.5 font-semibold text-[#57b8d8]">
            <Brain className="h-3.5 w-3.5" />
            <span>{t.learningSectionTitle}</span>
          </h3>
          <div className="grid grid-cols-2 gap-2 font-mono text-[11px] tabular-nums sm:grid-cols-4">
            <div className="rounded bg-[#121821] p-2">
              <div className="font-sans text-[10px] text-[#9FB0C3]">{t.learningUpdates}</div>
              <div>
                {safeFixed(snapshot.learning_telemetry.avg_updates_per_agent, 1)} (
                {snapshot.learning_telemetry.agents_with_updates}/
                {snapshot.learning_telemetry.living_brains_count})
              </div>
            </div>
            <div className="rounded bg-[#121821] p-2">
              <div className="font-sans text-[10px] text-[#9FB0C3]">{t.learningTdError}</div>
              <div>{safeFixed(snapshot.learning_telemetry.mean_td_error, 4)}</div>
            </div>
            <div className="rounded bg-[#121821] p-2">
              <div className="font-sans text-[10px] text-[#9FB0C3]">{t.learningEntropy}</div>
              <div>{safeFixed(snapshot.learning_telemetry.mean_policy_entropy, 4)}</div>
            </div>
            <div className="rounded bg-[#121821] p-2">
              <div className="font-sans text-[10px] text-[#9FB0C3]">{t.learningReward}</div>
              <div>{safeFixed(snapshot.learning_telemetry.mean_recent_reward, 4)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Time-Series SVG Charts */}
      {series.length < 2 ? (
        <div className="rounded border border-white/10 bg-[#18212C] p-3 text-[11px] text-[#9FB0C3]">
          <Activity className="mb-1 h-4 w-4 text-[#D99B26]" />
          {t.telemetryNoSeries}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SvgSeriesChart
            title={t.telemetryPopChart}
            series={series}
            lines={[
              {label: t.livingLabel, color: '#34d399', accessor: (p) => p.living_count},
              {label: t.deceasedLabel, color: '#f87171', accessor: (p) => p.deceased_count},
              {label: t.birthsTotal, color: '#f2be49', accessor: (p) => p.births_total},
            ]}
          />
          <SvgSeriesChart
            title={t.telemetryResourceChart}
            series={series}
            lines={[
              {label: t.foodBiomass, color: '#4ade80', accessor: (p) => p.food_total / 100},
              {label: t.herbivores, color: '#fbbf24', accessor: (p) => p.herbivores},
              {label: t.predators, color: '#f87171', accessor: (p) => p.predators},
            ]}
          />
          <SvgSeriesChart
            title={t.telemetryCultureCrimeChart}
            series={series}
            lines={[
              {label: t.activeTokens, color: '#57b8d8', accessor: (p) => p.active_tokens},
              {label: t.stableProtowords, color: '#a78bfa', accessor: (p) => p.protowords},
              {label: t.crimeRate1k, color: '#f87171', accessor: (p) => p.crime_rate_per_1000},
            ]}
          />
        </div>
      )}
    </div>
  );
}
