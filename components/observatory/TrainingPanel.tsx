'use client';

import React, {useMemo, useState} from 'react';
import {
  Award,
  CheckCircle2,
  History,
  Layers,
  Search,
  Skull,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import {safeDisplayText, safeFixed} from '@/lib/observatory/formatters';
import type {Translations} from '@/lib/observatory/i18n';
import type {
  ObservatorySnapshot,
  TrainingAgentRow,
  TrainingAttemptProgressionPoint,
} from '@/lib/observatory/types';

interface TrainingPanelProps {
  t: Translations;
  snapshot: ObservatorySnapshot;
  onSelectAgent: (agentId: number) => void;
}

type SortKey =
  | 'agent_id'
  | 'learning_level_score'
  | 'longest_survival_ticks'
  | 'avg_survival_ticks'
  | 'deaths'
  | 'food_consumed'
  | 'water_consumed';

function ProgressionChart({
  title,
  series,
  t,
}: {
  title: string;
  series: TrainingAttemptProgressionPoint[];
  t: Translations;
}) {
  if (series.length < 2) {
    return (
      <div className="rounded-md border border-white/10 bg-[#121821] p-4">
        <h3 className="mb-2 flex items-center gap-1.5 font-semibold text-[#57b8d8]">
          <TrendingUp className="h-4 w-4" />
          <span>{title}</span>
        </h3>
        <div className="rounded border border-white/10 bg-[#18212C] p-4 text-center text-[#9FB0C3]">
          {t.telemetryNoSeries}
        </div>
      </div>
    );
  }

  const width = 560;
  const height = 140;
  const padX = 12;
  const padY = 14;

  const maxSurv = Math.max(1, ...series.map((p) => p.avg_survival_ticks));
  const maxCons = Math.max(
    1,
    ...series.map((p) => Math.max(p.food_consumed_total, p.water_consumed_total)),
  );

  const buildPath = (accessor: (p: TrainingAttemptProgressionPoint) => number, maxVal: number) =>
    series
      .map((p, idx) => {
        const x = padX + (idx / Math.max(1, series.length - 1)) * (width - padX * 2);
        const y = height - padY - (accessor(p) / maxVal) * (height - padY * 2);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');

  return (
    <div className="space-y-2 rounded-md border border-white/10 bg-[#121821] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 font-semibold text-[#57b8d8]">
          <TrendingUp className="h-4 w-4" />
          <span>{title}</span>
        </h3>
        <div className="flex flex-wrap gap-3 text-[10px] text-[#9FB0C3]">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-[#F2BE49]" />
            {t.trainAvgSurvival}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            {t.foodConsumedTotal}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-[#57b8d8]" />
            {t.waterConsumedTotal}
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-36 w-full overflow-visible">
        <line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} stroke="rgba(255,255,255,0.1)" />
        <line x1={padX} y1={padY} x2={width - padX} y2={padY} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
        <path d={buildPath((p) => p.avg_survival_ticks, maxSurv)} fill="none" stroke="#F2BE49" strokeWidth={2.2} />
        <path d={buildPath((p) => p.food_consumed_total, maxCons)} fill="none" stroke="#34d399" strokeWidth={1.8} />
        <path d={buildPath((p) => p.water_consumed_total, maxCons)} fill="none" stroke="#57b8d8" strokeWidth={1.8} />
      </svg>
    </div>
  );
}

export default function TrainingPanel({t, snapshot, onSelectAgent}: TrainingPanelProps) {
  const train = snapshot.training_analytics;
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('learning_level_score');
  const [inspectedRowId, setInspectedRowId] = useState<number | null>(null);

  const sortedAgents = useMemo(() => {
    if (!train) return [];
    const q = search.trim().toLowerCase();
    const filtered = train.agents.filter((ag) => {
      if (!q) return true;
      return (
        String(ag.agent_id).includes(q) ||
        (ag.last_cause_of_death ?? '').toLowerCase().includes(q)
      );
    });
    return [...filtered].sort((a, b) => {
      if (sortBy === 'agent_id') return a.agent_id - b.agent_id;
      return (b[sortBy] ?? 0) - (a[sortBy] ?? 0);
    });
  }, [train, search, sortBy]);

  const inspectedAgent: TrainingAgentRow | null = useMemo(() => {
    if (!train || train.agents.length === 0) return null;
    if (inspectedRowId !== null) {
      const found = train.agents.find((a) => a.agent_id === inspectedRowId);
      if (found) return found;
    }
    return sortedAgents[0] ?? train.agents[0];
  }, [train, inspectedRowId, sortedAgents]);

  if (!train) {
    return (
      <div className="rounded-md border border-white/10 bg-[#121821] p-8 text-center text-xs text-[#9FB0C3]">
        {t.trainNoData}
      </div>
    );
  }

  const st = train.stage_totals;
  const causeEntries = Object.entries(train.death_causes_breakdown).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4 text-xs text-[#E6EDF3]">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold text-[#F2BE49]">
            <Layers className="h-4 w-4" />
            <span>{t.trainTitle}</span>
          </h2>
          <span className="rounded border border-[#3B82A6]/40 bg-[#3B82A6]/15 px-2 py-0.5 font-mono text-[11px] text-[#57b8d8]">
            {train.agent_count} agents · {train.phase}
          </span>
        </div>
        <p className="text-[11px] text-[#9FB0C3]">{t.trainSubtitle}</p>
      </div>

      {/* Top 5 KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="rounded-md border border-white/10 bg-[#121821] p-3">
          <div className="text-[11px] text-[#9FB0C3]">{t.trainTicksExec}</div>
          <div className="mt-1 font-mono text-lg font-bold tabular-nums text-[#E6EDF3]">
            {train.training_ticks_executed.toLocaleString()}
          </div>
        </div>
        <div className="rounded-md border border-white/10 bg-[#121821] p-3">
          <div className="text-[11px] text-[#9FB0C3]">{t.trainTotalAttempts}</div>
          <div className="mt-1 font-mono text-lg font-bold tabular-nums text-[#57b8d8]">
            {train.total_attempts.toLocaleString()}
          </div>
        </div>
        <div className="rounded-md border border-white/10 bg-[#121821] p-3">
          <div className="text-[11px] text-[#9FB0C3]">{t.trainTotalDeaths}</div>
          <div className="mt-1 font-mono text-lg font-bold tabular-nums text-red-300">
            {train.total_deaths.toLocaleString()}
          </div>
        </div>
        <div className="rounded-md border border-white/10 bg-[#121821] p-3">
          <div className="text-[11px] text-[#9FB0C3]">{t.trainAvgSurvival}</div>
          <div className="mt-1 font-mono text-lg font-bold tabular-nums text-[#F2BE49]">
            {safeFixed(train.survival_avg_ticks, 1)} <span className="text-xs font-normal text-[#9FB0C3]">{t.tickUnit}</span>
          </div>
        </div>
        <div className="rounded-md border border-white/10 bg-[#121821] p-3">
          <div className="text-[11px] text-[#9FB0C3]">{t.trainLongestSurvival}</div>
          <div className="mt-1 font-mono text-lg font-bold tabular-nums text-emerald-300">
            {train.longest_survival_ticks.toLocaleString()} <span className="text-xs font-normal text-[#9FB0C3]">{t.tickUnit}</span>
          </div>
        </div>
      </div>

      {/* 4-Stage Learning Matrix + Progression Chart */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="space-y-3 rounded-md border border-white/10 bg-[#121821] p-4">
          <h3 className="flex items-center gap-1.5 font-semibold text-[#F2BE49]">
            <Award className="h-4 w-4" />
            <span>{t.trainStageMatrixTitle}</span>
          </h3>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 rounded border border-white/10 bg-[#18212C] p-3">
              <div className="font-semibold text-[#F2BE49]">{t.foodBiomass}</div>
              <div className="grid grid-cols-4 gap-1 text-center font-mono text-[11px] tabular-nums">
                <div className="rounded bg-[#121821] p-1.5">
                  <div className="text-[9px] text-[#9FB0C3]">D</div>
                  <div className="font-bold">{st.food_discovered}</div>
                </div>
                <div className="rounded bg-[#121821] p-1.5">
                  <div className="text-[9px] text-[#9FB0C3]">Dec</div>
                  <div className="font-bold">{st.food_reach_decisions}</div>
                </div>
                <div className="rounded bg-[#121821] p-1.5">
                  <div className="text-[9px] text-[#9FB0C3]">R</div>
                  <div className="font-bold text-[#57b8d8]">{st.food_reached}</div>
                </div>
                <div className="rounded bg-[#121821] p-1.5">
                  <div className="text-[9px] text-[#9FB0C3]">C</div>
                  <div className="font-bold text-emerald-300">{st.food_consumed}</div>
                </div>
              </div>
            </div>

            <div className="space-y-1.5 rounded border border-white/10 bg-[#18212C] p-3">
              <div className="font-semibold text-[#57b8d8]">{t.waterTotal}</div>
              <div className="grid grid-cols-4 gap-1 text-center font-mono text-[11px] tabular-nums">
                <div className="rounded bg-[#121821] p-1.5">
                  <div className="text-[9px] text-[#9FB0C3]">D</div>
                  <div className="font-bold">{st.water_discovered}</div>
                </div>
                <div className="rounded bg-[#121821] p-1.5">
                  <div className="text-[9px] text-[#9FB0C3]">Dec</div>
                  <div className="font-bold">{st.water_reach_decisions}</div>
                </div>
                <div className="rounded bg-[#121821] p-1.5">
                  <div className="text-[9px] text-[#9FB0C3]">R</div>
                  <div className="font-bold text-[#57b8d8]">{st.water_reached}</div>
                </div>
                <div className="rounded bg-[#121821] p-1.5">
                  <div className="text-[9px] text-[#9FB0C3]">C</div>
                  <div className="font-bold text-emerald-300">{st.water_consumed}</div>
                </div>
              </div>
            </div>
          </div>

          {causeEntries.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {causeEntries.map(([cause, count]) => (
                <span
                  key={cause}
                  className="inline-flex items-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] text-red-200"
                >
                  <Skull className="h-3 w-3" />
                  <span>{t.causes[cause] ?? safeDisplayText(cause)}:</span>
                  <span className="font-mono font-bold">{count}</span>
                </span>
              ))}
            </div>
          )}
        </section>

        <ProgressionChart
          title={t.trainProgressionChartTitle}
          series={train.attempt_progression}
          t={t}
        />
      </div>

      {/* 100-Agent Comparison Table + Attempt History Drilldown */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="space-y-3 rounded-md border border-white/10 bg-[#121821] p-4 xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-[#E6EDF3]">
              {t.trainTableTitle} ({sortedAgents.length})
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 start-2 h-3.5 w-3.5 -translate-y-1/2 text-[#9FB0C3]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t.trainSearchPlaceholder}
                  className="w-44 rounded border border-white/10 bg-[#18212C] py-1 pe-2 ps-7 text-[11px] text-[#E6EDF3] placeholder:text-[#9FB0C3] focus:border-[#D99B26] focus:outline-none"
                />
              </div>
              <label className="flex items-center gap-1.5 text-[11px] text-[#9FB0C3]">
                <span>{t.trainSortBy}</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortKey)}
                  className="rounded border border-white/10 bg-[#18212C] px-2 py-1 text-[11px] text-[#E6EDF3]"
                >
                  <option value="learning_level_score">{t.trainColLearnScore}</option>
                  <option value="longest_survival_ticks">{t.trainColLongest}</option>
                  <option value="avg_survival_ticks">{t.trainColAvgSurv}</option>
                  <option value="food_consumed">{t.foodConsumedTotal}</option>
                  <option value="water_consumed">{t.waterConsumedTotal}</option>
                  <option value="deaths">{t.trainColDeaths}</option>
                  <option value="agent_id">{t.trainColAgent}</option>
                </select>
              </label>
            </div>
          </div>

          <div className="max-h-[420px] overflow-auto rounded border border-white/10">
            <table className="w-full text-start text-[11px]">
              <thead className="sticky top-0 bg-[#18212C] text-[#9FB0C3]">
                <tr className="border-b border-white/10">
                  <th className="px-2.5 py-2 text-start font-medium">{t.trainColAgent}</th>
                  <th className="px-2 py-2 text-end font-medium">{t.trainColAttempts}</th>
                  <th className="px-2 py-2 text-end font-medium">{t.trainColDeaths}</th>
                  <th className="px-2 py-2 text-end font-medium">{t.trainColLongest}</th>
                  <th className="px-2 py-2 text-end font-medium">{t.trainColAvgSurv}</th>
                  <th className="px-2 py-2 text-center font-medium">{t.trainColFoodStages}</th>
                  <th className="px-2 py-2 text-center font-medium">{t.trainColWaterStages}</th>
                  <th className="px-2 py-2 text-end font-medium">{t.trainColSkillsMem}</th>
                  <th className="px-2 py-2 text-end font-medium">{t.trainColLearnScore}</th>
                  <th className="px-2 py-2 text-start font-medium">{t.trainColLastCause}</th>
                  <th className="px-2 py-2 text-end font-medium">{t.trainColStatus}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono tabular-nums">
                {sortedAgents.map((row) => {
                  const selected = inspectedAgent?.agent_id === row.agent_id;
                  return (
                    <tr
                      key={row.agent_id}
                      onClick={() => setInspectedRowId(row.agent_id)}
                      className={`cursor-pointer transition ${
                        selected ? 'bg-[#D99B26]/15' : 'hover:bg-[#18212C]/80'
                      }`}
                    >
                      <td className="px-2.5 py-2 font-semibold text-[#F2BE49]">
                        #{row.agent_id}{' '}
                        <span className="text-[10px] font-normal text-[#9FB0C3]">({row.sex})</span>
                      </td>
                      <td className="px-2 py-2 text-end">{row.attempts}</td>
                      <td className="px-2 py-2 text-end text-red-300">{row.deaths}</td>
                      <td className="px-2 py-2 text-end text-emerald-300">{row.longest_survival_ticks}</td>
                      <td className="px-2 py-2 text-end">{safeFixed(row.avg_survival_ticks, 1)}</td>
                      <td className="px-2 py-2 text-center text-[10px]">
                        {row.food_discovered}/{row.food_reach_decisions}/{row.food_reached}/{row.food_consumed}
                      </td>
                      <td className="px-2 py-2 text-center text-[10px] text-[#57b8d8]">
                        {row.water_discovered}/{row.water_reach_decisions}/{row.water_reached}/{row.water_consumed}
                      </td>
                      <td className="px-2 py-2 text-end text-[10px] text-[#9FB0C3]">
                        {row.skills_count} / {row.episodic_memories_count + row.spatial_memories_count}
                      </td>
                      <td className="px-2 py-2 text-end font-bold text-[#F2BE49]">
                        {safeFixed(row.learning_level_score, 1)}
                      </td>
                      <td className="px-2 py-2 font-sans text-[10px] text-[#9FB0C3]">
                        {row.last_cause_of_death
                          ? (t.causes[row.last_cause_of_death] ?? safeDisplayText(row.last_cause_of_death))
                          : '—'}
                      </td>
                      <td className="px-2 py-2 text-end">
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>{row.status}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Attempt History Drilldown for Selected Row */}
        <section className="space-y-3 rounded-md border border-white/10 bg-[#121821] p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 font-semibold text-[#57b8d8]">
              <History className="h-4 w-4" />
              <span>{t.trainAttemptHistoryTitle}</span>
            </h3>
            {inspectedAgent && (
              <button
                type="button"
                onClick={() => onSelectAgent(inspectedAgent.agent_id)}
                className="flex items-center gap-1 rounded border border-[#D99B26]/50 bg-[#D99B26]/15 px-2 py-1 text-[10px] font-semibold text-[#F2BE49] hover:bg-[#D99B26]/25"
              >
                <UserCheck className="h-3 w-3" />
                <span>#{inspectedAgent.agent_id}</span>
              </button>
            )}
          </div>

          {!inspectedAgent ? (
            <div className="rounded border border-white/10 bg-[#18212C] p-6 text-center text-[#9FB0C3]">
              —
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2 rounded border border-white/10 bg-[#18212C] p-2.5 font-mono text-[11px]">
                <div>
                  <span className="text-[#9FB0C3]">{t.trainColAgent}: </span>
                  <span className="font-bold text-[#F2BE49]">#{inspectedAgent.agent_id}</span>
                </div>
                <div>
                  <span className="text-[#9FB0C3]">{t.totalBrainUpdates}: </span>
                  <span>{inspectedAgent.brain_updates}</span>
                </div>
                <div>
                  <span className="text-[#9FB0C3]">{t.trainColLearnScore}: </span>
                  <span className="text-emerald-300">{safeFixed(inspectedAgent.learning_level_score, 1)}</span>
                </div>
                <div>
                  <span className="text-[#9FB0C3]">{t.learningReward}: </span>
                  <span>{safeFixed(inspectedAgent.mean_recent_reward, 3)}</span>
                </div>
              </div>

              <div className="max-h-[320px] space-y-1.5 overflow-y-auto">
                {inspectedAgent.attempt_history.length === 0 ? (
                  <div className="rounded border border-white/10 bg-[#18212C] p-4 text-center text-[11px] text-[#9FB0C3]">
                    {t.noDeathsRecorded}
                  </div>
                ) : (
                  [...inspectedAgent.attempt_history].reverse().map((att) => (
                    <div
                      key={`${att.attempt}-${att.death_tick}`}
                      className="rounded border border-white/10 bg-[#18212C] p-2.5 text-[11px]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[#F2BE49]">
                          #{att.attempt} · {att.survival_ticks} {t.tickUnit}
                        </span>
                        <span className="font-mono text-[10px] text-red-300">
                          {t.causes[att.cause] ?? safeDisplayText(att.cause)} @ T{att.death_tick}
                        </span>
                      </div>
                      <div className="mt-1 text-[10px] text-[#9FB0C3]">
                        {t.currentAction}:{' '}
                        <span className="text-[#E6EDF3]">
                          {t.actions[att.last_action] ?? safeDisplayText(att.last_action)}
                        </span>
                      </div>
                      {att.perceived_cues.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {att.perceived_cues.map((cue, idx) => (
                            <span
                              key={idx}
                              className="rounded border border-white/10 bg-[#121821] px-1.5 py-0.5 font-mono text-[9px] text-[#57b8d8]"
                            >
                              {safeDisplayText(cue)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
