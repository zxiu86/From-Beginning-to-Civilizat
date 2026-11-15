'use client';

import React from 'react';
import {Activity, HeartCrack, Shield, Skull, TrendingUp} from 'lucide-react';
import {safeDisplayText, safeFixed} from '@/lib/observatory/formatters';
import type {Translations} from '@/lib/observatory/i18n';
import type {ObservatorySnapshot} from '@/lib/observatory/types';

interface SurvivalPanelProps {
  t: Translations;
  snapshot: ObservatorySnapshot;
}

export default function SurvivalPanel({t, snapshot}: SurvivalPanelProps) {
  const surv = snapshot.analytics.survival;
  const causeEntries = Object.entries(surv.deaths_by_cause).sort((a, b) => b[1] - a[1]);
  const totalRecordedCauses = causeEntries.reduce((acc, [, v]) => acc + v, 0);
  const maxCauseCount = Math.max(1, ...causeEntries.map(([, v]) => v));

  const genEntries = Object.entries(surv.avg_survival_by_generation_ticks).sort(
    (a, b) => Number(a[0]) - Number(b[0]),
  );

  const naturalPlusViolent = Math.max(1, surv.natural_deaths_count + surv.violent_deaths_count);
  const naturalPct = (surv.natural_deaths_count / naturalPlusViolent) * 100;
  const violentPct = (surv.violent_deaths_count / naturalPlusViolent) * 100;

  return (
    <div className="space-y-4 text-xs text-[#E6EDF3]">
      <div className="flex items-center gap-2">
        <HeartCrack className="h-4 w-4 text-[#D99B26]" />
        <h2 className="text-sm font-bold">{t.survTitle}</h2>
      </div>

      {/* Top Lifespan & Mortality KPI Grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="rounded-md border border-white/10 bg-[#121821] p-3">
          <div className="text-[11px] text-[#9FB0C3]">{t.avgLifespan}</div>
          <div className="mt-1 font-mono text-lg font-bold tabular-nums text-[#E6EDF3]">
            {safeFixed(surv.avg_lifespan_ticks, 1)} <span className="text-xs font-normal text-[#9FB0C3]">{t.tickUnit}</span>
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-[#57b8d8]">
            {safeFixed(surv.avg_lifespan_years, 2)} {t.ageYears}
          </div>
        </div>

        <div className="rounded-md border border-white/10 bg-[#121821] p-3">
          <div className="text-[11px] text-[#9FB0C3]">{t.longestLifespan}</div>
          <div className="mt-1 font-mono text-lg font-bold tabular-nums text-emerald-300">
            {surv.longest_lifespan_ticks} <span className="text-xs font-normal text-[#9FB0C3]">{t.tickUnit}</span>
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-[#9FB0C3]">
            {safeFixed(surv.longest_lifespan_years, 2)} {t.ageYears}
          </div>
        </div>

        <div className="rounded-md border border-white/10 bg-[#121821] p-3">
          <div className="text-[11px] text-[#9FB0C3]">{t.shortestLifespan}</div>
          <div className="mt-1 font-mono text-lg font-bold tabular-nums text-[#F2BE49]">
            {surv.shortest_lifespan_ticks} <span className="text-xs font-normal text-[#9FB0C3]">{t.tickUnit}</span>
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-[#9FB0C3]">
            {safeFixed(surv.shortest_lifespan_years, 2)} {t.ageYears}
          </div>
        </div>

        <div className="rounded-md border border-white/10 bg-[#121821] p-3">
          <div className="text-[11px] text-[#9FB0C3]">{t.prematureDeaths}</div>
          <div className="mt-1 font-mono text-lg font-bold tabular-nums text-red-300">
            {surv.premature_deaths_count}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-red-200/80">
            {t.prematureRate}: {safeFixed(surv.premature_death_rate_pct, 1)}%
          </div>
        </div>

        <div className="rounded-md border border-white/10 bg-[#121821] p-3">
          <div className="text-[11px] text-[#9FB0C3]">{t.naturalVsViolent}</div>
          <div className="mt-1 flex items-baseline gap-2 font-mono text-sm font-bold tabular-nums">
            <span className="text-[#57b8d8]">{surv.natural_deaths_count}</span>
            <span className="text-white/25">/</span>
            <span className="text-red-300">{surv.violent_deaths_count}</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded bg-[#18212C] flex">
            <div className="h-full bg-[#3B82A6]" style={{width: `${naturalPct}%`}} />
            <div className="h-full bg-red-500" style={{width: `${violentPct}%`}} />
          </div>
        </div>
      </div>

      {/* Main Split: Death Causes Bar Chart + Per-Generation Survival */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="space-y-3 rounded-md border border-white/10 bg-[#121821] p-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 font-semibold text-red-300">
              <Skull className="h-4 w-4" />
              <span>{t.deathsByCauseTitle}</span>
            </h3>
            <span className="font-mono text-[11px] text-[#9FB0C3]">
              {totalRecordedCauses} {t.deceasedLabel}
            </span>
          </div>

          {causeEntries.length === 0 ? (
            <div className="rounded border border-white/10 bg-[#18212C] p-6 text-center text-[#9FB0C3]">
              {t.noDeathsRecorded}
            </div>
          ) : (
            <div className="space-y-2.5">
              {causeEntries.map(([cause, count]) => {
                const label = t.causes[cause] ?? safeDisplayText(cause);
                const pctOfTotal = (count / Math.max(1, totalRecordedCauses)) * 100;
                const barWidth = Math.max(3, (count / maxCauseCount) * 100);
                const isViolence = cause === 'predator' || cause === 'murder' || cause === 'violence';
                return (
                  <div key={cause} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-[#E6EDF3]">{label}</span>
                      <span className="font-mono tabular-nums text-[#9FB0C3]">
                        {count} ({safeFixed(pctOfTotal, 1)}%)
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded bg-[#18212C]">
                      <div
                        className={`h-full rounded transition-all ${
                          isViolence ? 'bg-red-500' : 'bg-[#D99B26]'
                        }`}
                        style={{width: `${barWidth}%`}}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-md border border-white/10 bg-[#121821] p-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 font-semibold text-[#57b8d8]">
              <TrendingUp className="h-4 w-4" />
              <span>{t.survivalByGenTitle}</span>
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded border border-white/10 bg-[#18212C] p-2.5">
              <div className="flex items-center gap-1 text-[#9FB0C3]">
                <Shield className="h-3.5 w-3.5 text-[#57b8d8]" />
                <span>{t.naturalDeaths}</span>
              </div>
              <div className="mt-1 font-mono text-base font-bold tabular-nums text-[#E6EDF3]">
                {surv.natural_deaths_count}
              </div>
            </div>
            <div className="rounded border border-white/10 bg-[#18212C] p-2.5">
              <div className="flex items-center gap-1 text-[#9FB0C3]">
                <Activity className="h-3.5 w-3.5 text-red-400" />
                <span>{t.violentDeaths}</span>
              </div>
              <div className="mt-1 font-mono text-base font-bold tabular-nums text-red-300">
                {surv.violent_deaths_count}
              </div>
            </div>
          </div>

          {genEntries.length === 0 ? (
            <div className="rounded border border-white/10 bg-[#18212C] p-6 text-center text-[#9FB0C3]">
              {t.noDeathsRecorded}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-[11px]">
                <thead>
                  <tr className="border-b border-white/10 text-[#9FB0C3]">
                    <th className="py-2 text-start font-medium">{t.genShort}</th>
                    <th className="py-2 text-end font-medium">{t.avgLifespan}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {genEntries.map(([gen, avgTicks]) => (
                    <tr key={gen}>
                      <td className="py-2 font-mono font-semibold text-[#F2BE49]">
                        {t.genShort} {gen}
                      </td>
                      <td className="py-2 text-end font-mono tabular-nums text-[#E6EDF3]">
                        {safeFixed(avgTicks, 1)} {t.tickUnit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
