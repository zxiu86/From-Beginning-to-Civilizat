'use client';

import React from 'react';
import {AlertTriangle, Compass, Droplets, Sprout} from 'lucide-react';
import {safeFixed} from '@/lib/observatory/formatters';
import type {Translations} from '@/lib/observatory/i18n';
import type {ObservatorySnapshot, ResourceFunnel} from '@/lib/observatory/types';

interface ResourcesPanelProps {
  t: Translations;
  snapshot: ObservatorySnapshot;
}

const FUNNEL_KEYS: Array<keyof ResourceFunnel> = [
  'absent',
  'present_undiscovered',
  'discovered_no_decision',
  'decision_move_failed',
  'reached_consume_failed',
  'consumed_success',
];

function FunnelCard({
  title,
  funnel,
  stageLabels,
  accent,
}: {
  title: string;
  funnel: ResourceFunnel;
  stageLabels: Record<string, string>;
  accent: 'amber' | 'cyan';
}) {
  const total = FUNNEL_KEYS.reduce((acc, k) => acc + (funnel[k] ?? 0), 0);

  return (
    <section className="space-y-3 rounded-md border border-white/10 bg-[#121821] p-4">
      <div className="flex items-center justify-between">
        <h3
          className={`font-semibold ${accent === 'amber' ? 'text-[#F2BE49]' : 'text-[#57b8d8]'}`}
        >
          {title}
        </h3>
        <span className="font-mono text-[11px] tabular-nums text-[#9FB0C3]">n={total}</span>
      </div>

      <div className="space-y-2.5">
        {FUNNEL_KEYS.map((key) => {
          const val = funnel[key] ?? 0;
          const pct = total > 0 ? (val / total) * 100 : 0;
          const isSuccess = key === 'consumed_success';
          const isFailure = key === 'decision_move_failed' || key === 'reached_consume_failed';
          const barColor = isSuccess
            ? 'bg-emerald-500'
            : isFailure
              ? 'bg-red-500/80'
              : accent === 'amber'
                ? 'bg-[#D99B26]'
                : 'bg-[#3B82A6]';

          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#E6EDF3]">{stageLabels[key] ?? key}</span>
                <span className="font-mono tabular-nums text-[#9FB0C3]">
                  {val.toLocaleString()} ({safeFixed(pct, 1)}%)
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded bg-[#18212C]">
                <div
                  className={`h-full rounded transition-all ${barColor}`}
                  style={{width: `${total > 0 ? Math.max(val > 0 ? 2 : 0, pct) : 0}%`}}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function ResourcesPanel({t, snapshot}: ResourcesPanelProps) {
  const fw = snapshot.analytics.food_water;
  const regions = Object.entries(fw.regional_resources);

  return (
    <div className="space-y-4 text-xs text-[#E6EDF3]">
      <div className="flex items-center gap-2">
        <Sprout className="h-4 w-4 text-emerald-400" />
        <h2 className="text-sm font-bold">{t.resTitle}</h2>
      </div>

      {/* Food & Water Top KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-md border border-white/10 bg-[#121821] p-3">
          <div className="flex items-center gap-1.5 text-[11px] text-[#9FB0C3]">
            <Sprout className="h-3.5 w-3.5 text-emerald-400" />
            <span>{t.availConsumableFood}</span>
          </div>
          <div className="mt-1 font-mono text-lg font-bold tabular-nums text-emerald-300">
            {safeFixed(fw.available_consumable_food, 0)}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-[#9FB0C3]">
            {t.foodConsumedTotal}: {safeFixed(fw.food_consumed_total, 1)} ({safeFixed(fw.food_consumption_rate_per_tick, 2)}/t)
          </div>
        </div>

        <div className="rounded-md border border-white/10 bg-[#121821] p-3">
          <div className="flex items-center gap-1.5 text-[11px] text-[#9FB0C3]">
            <Droplets className="h-3.5 w-3.5 text-[#57b8d8]" />
            <span>{t.availWaterSources}</span>
          </div>
          <div className="mt-1 font-mono text-lg font-bold tabular-nums text-[#57b8d8]">
            {fw.available_water_sources.toLocaleString()}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-[#9FB0C3]">
            {t.waterConsumedTotal}: {safeFixed(fw.water_consumed_total, 1)} ({safeFixed(fw.water_consumption_rate_per_tick, 2)}/t)
          </div>
        </div>

        <div className="rounded-md border border-white/10 bg-[#121821] p-3">
          <div className="text-[11px] text-[#9FB0C3]">{t.agentsHungry} / {t.agentsThirsty}</div>
          <div className="mt-1 font-mono text-lg font-bold tabular-nums text-[#F2BE49]">
            {fw.agents_experienced_hunger} / {fw.agents_experienced_thirst}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-[#9FB0C3]">
            {t.avgHungerDur}: {safeFixed(fw.avg_hunger_duration_ticks, 1)} · {t.avgThirstDur}: {safeFixed(fw.avg_thirst_duration_ticks, 1)}
          </div>
        </div>

        <div className="rounded-md border border-red-500/20 bg-[#121821] p-3">
          <div className="flex items-center gap-1.5 text-[11px] text-red-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>{t.starvationDeaths} / {t.dehydrationDeaths}</span>
          </div>
          <div className="mt-1 font-mono text-lg font-bold tabular-nums text-red-300">
            {fw.starvation_deaths} / {fw.dehydration_deaths}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-[#9FB0C3]">
            {t.nearbyFoodFailures}: {fw.nearby_food_reach_failures} · {t.nearbyWaterFailures}: {fw.nearby_water_reach_failures}
          </div>
        </div>
      </div>

      {/* 6-Stage Resource Funnels */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FunnelCard
          title={t.foodFunnelTitle}
          funnel={fw.food_funnel}
          stageLabels={t.funnelStages}
          accent="amber"
        />
        <FunnelCard
          title={t.waterFunnelTitle}
          funnel={fw.water_funnel}
          stageLabels={t.funnelStages}
          accent="cyan"
        />
      </div>

      {/* Regional Quadrants Comparison */}
      <section className="space-y-3 rounded-md border border-white/10 bg-[#121821] p-4">
        <h3 className="flex items-center gap-1.5 font-semibold text-[#57b8d8]">
          <Compass className="h-4 w-4" />
          <span>{t.regionalResourcesTitle}</span>
        </h3>
        {regions.length === 0 ? (
          <div className="rounded border border-white/10 bg-[#18212C] p-4 text-center text-[#9FB0C3]">
            —
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-[11px]">
              <thead>
                <tr className="border-b border-white/10 text-[#9FB0C3]">
                  <th className="py-2 text-start font-medium">{t.regionLabel}</th>
                  <th className="py-2 text-end font-medium">{t.foodBiomass}</th>
                  <th className="py-2 text-end font-medium">{t.waterTotal}</th>
                  <th className="py-2 text-end font-medium">{t.livingLabel}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono tabular-nums">
                {regions.map(([region, slice]) => (
                  <tr key={region}>
                    <td className="py-2 font-semibold text-[#F2BE49]">{region}</td>
                    <td className="py-2 text-end text-emerald-300">{safeFixed(slice.food_biomass, 1)}</td>
                    <td className="py-2 text-end text-[#57b8d8]">{safeFixed(slice.water_volume, 1)}</td>
                    <td className="py-2 text-end text-[#E6EDF3]">{slice.living_agents}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
