'use client';

import React, {useState} from 'react';
import {
  AlertTriangle,
  Baby,
  Cpu,
  Eye,
  GraduationCap,
  HeartPulse,
  MessageSquare,
  Navigation,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Skull,
  Sparkles,
  Users,
} from 'lucide-react';
import {formatCoords, safeFixed} from '@/lib/observatory/formatters';
import type {Translations} from '@/lib/observatory/i18n';
import type {AnyAgentRecord, LivingAgentFull} from '@/lib/observatory/types';

interface AgentInspectorProps {
  t: Translations;
  agent: AnyAgentRecord | null;
  agentLookup: Map<number, AnyAgentRecord>;
  onSelectAgent: (agentId: number) => void;
}

function MeterBar({label, value, dangerWhenHigh = false}: {label: string; value: number; dangerWhenHigh?: boolean}) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  const isBad = dangerWhenHigh ? value > 0.72 : value < 0.35;
  const isWarn = dangerWhenHigh ? value > 0.48 : value < 0.62;
  const barColor = isBad ? 'bg-red-500' : isWarn ? 'bg-[#D99B26]' : 'bg-emerald-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span className="text-[#9FB0C3]">{label}</span>
        <span className="font-mono tabular-nums text-[#E6EDF3]">{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded bg-[#18212C]">
        <div className={`h-full ${barColor}`} style={{width: `${pct}%`}} />
      </div>
    </div>
  );
}

export default function AgentInspector({
  t,
  agent,
  agentLookup,
  onSelectAgent,
}: AgentInspectorProps) {
  const [searchId, setSearchId] = useState('');
  const [notFound, setNotFound] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const id = Number(searchId.trim());
    if (!Number.isFinite(id) || !agentLookup.has(id)) {
      setNotFound(true);
      return;
    }
    setNotFound(false);
    onSelectAgent(id);
  };

  const livingAgent: LivingAgentFull | null = agent && agent.is_alive ? agent : null;
  const showRebirthCard =
    agent !== null &&
    (agent.rebirth_count > 0 ||
      agent.original_death_tick !== null ||
      agent.death_penalty_record !== null);

  return (
    <div className="space-y-4 text-xs text-[#E6EDF3]">
      {/* Search by ID */}
      <form onSubmit={handleSearch} className="flex gap-1.5">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-2.5 start-2.5 h-3.5 w-3.5 text-[#9FB0C3]" />
          <input
            type="number"
            value={searchId}
            onChange={(e) => {
              setSearchId(e.target.value);
              setNotFound(false);
            }}
            placeholder={t.searchAgentPlaceholder}
            className="w-full rounded border border-white/10 bg-[#18212C] py-1.5 pe-2 ps-8 text-xs text-[#E6EDF3] placeholder:text-[#9FB0C3]/60 focus:border-[#D99B26] focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded border border-white/10 bg-[#18212C] px-3 py-1.5 font-medium text-[#E6EDF3] transition hover:border-[#D99B26]/60"
        >
          {t.searchButton}
        </button>
      </form>
      {notFound && <div className="text-[11px] text-red-400">{t.agentNotFound}</div>}

      {!agent ? (
        <div className="rounded border border-white/10 bg-[#18212C] p-4 text-center text-[#9FB0C3]">
          {t.selectAgentPrompt}
        </div>
      ) : (
        <>
          {/* Header Card */}
          <div className="rounded border border-white/10 bg-[#18212C] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold text-[#F2BE49]">
                  #{agent.agent_id}
                </span>
                <span className="rounded border border-white/10 bg-[#121821] px-1.5 py-0.5 text-[11px]">
                  {agent.sex === 'F' ? t.sexF : t.sexM}
                </span>
                <span className="rounded border border-white/10 bg-[#121821] px-1.5 py-0.5 text-[11px]">
                  {t.lifeStages[agent.life_stage] ?? agent.life_stage}
                </span>
              </div>
              <span
                className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium ${
                  agent.is_alive
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'bg-red-500/15 text-red-300'
                }`}
              >
                {agent.is_alive ? (
                  <HeartPulse className="h-3 w-3" />
                ) : (
                  <Skull className="h-3 w-3" />
                )}
                {agent.is_alive ? t.statusAlive : t.statusDeceased}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-[11px] tabular-nums text-[#9FB0C3]">
              <div>
                {safeFixed(agent.age_years, 1)} {t.ageYears}
              </div>
              <div>
                {t.genShort} {agent.generation}
              </div>
              <div>{formatCoords(agent.x, agent.y)}</div>
            </div>
          </div>

          {/* Isolated Training History Summary (preserved post-promotion) */}
          {agent.training_stats && (
            <div className="space-y-2 rounded border border-[#D99B26]/40 bg-[#D99B26]/10 p-3">
              <h3 className="flex items-center gap-1.5 font-semibold text-[#F2BE49]">
                <GraduationCap className="h-3.5 w-3.5" />
                <span>{t.trainTitle}</span>
              </h3>
              <div className="grid grid-cols-2 gap-2 font-mono text-[11px] tabular-nums sm:grid-cols-3">
                <div className="rounded bg-[#121821] p-2">
                  <div className="font-sans text-[10px] text-[#9FB0C3]">{t.trainColAttempts}</div>
                  <div className="font-bold">{agent.training_stats.training_attempts}</div>
                </div>
                <div className="rounded bg-[#121821] p-2">
                  <div className="font-sans text-[10px] text-[#9FB0C3]">{t.trainColDeaths}</div>
                  <div className="font-bold">{agent.training_stats.training_deaths}</div>
                </div>
                <div className="rounded bg-[#121821] p-2">
                  <div className="font-sans text-[10px] text-[#9FB0C3]">{t.trainColLongest}</div>
                  <div className="font-bold text-emerald-300">
                    {agent.training_stats.longest_survival_ticks}
                  </div>
                </div>
                <div className="rounded bg-[#121821] p-2">
                  <div className="font-sans text-[10px] text-[#9FB0C3]">{t.trainColFoodStages}</div>
                  <div>
                    {agent.training_stats.food_discovered_count}/
                    {agent.training_stats.food_reach_decisions_count}/
                    {agent.training_stats.food_reached_count}/
                    {agent.training_stats.food_consumed_count}
                  </div>
                </div>
                <div className="rounded bg-[#121821] p-2">
                  <div className="font-sans text-[10px] text-[#9FB0C3]">{t.trainColWaterStages}</div>
                  <div>
                    {agent.training_stats.water_discovered_count}/
                    {agent.training_stats.water_reach_decisions_count}/
                    {agent.training_stats.water_reached_count}/
                    {agent.training_stats.water_consumed_count}
                  </div>
                </div>
                <div className="rounded bg-[#121821] p-2">
                  <div className="font-sans text-[10px] text-[#9FB0C3]">{t.trainColLearnScore}</div>
                  <div className="font-bold text-[#57b8d8]">
                    {safeFixed(agent.training_stats.learning_level_score, 2)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Rebirth & Death-Penalty Learning Card */}
          {showRebirthCard && (
            <div className="space-y-2 rounded border border-[#3B82A6]/50 bg-[#3B82A6]/10 p-3">
              <h3 className="flex items-center gap-1.5 font-semibold text-[#57b8d8]">
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{t.rebirthSection}</span>
              </h3>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded bg-[#121821] p-2">
                  <div className="text-[#9FB0C3]">{t.rebirthCountLabel}</div>
                  <div className="font-mono font-bold tabular-nums">{agent.rebirth_count}</div>
                </div>
                <div className="rounded bg-[#121821] p-2">
                  <div className="text-[#9FB0C3]">{t.rebirthTickLabel}</div>
                  <div className="font-mono font-bold tabular-nums">
                    {agent.rebirth_tick !== null ? `${t.tickUnit} ${agent.rebirth_tick}` : '—'}
                  </div>
                </div>
              </div>
              {agent.original_death_tick !== null && (
                <div className="rounded bg-[#121821] p-2 text-[11px]">
                  <span className="text-[#9FB0C3]">{t.originalDeathLabel}: </span>
                  <span className="font-mono text-[#E6EDF3]">
                    {t.tickUnit} {agent.original_death_tick} ·{' '}
                    {agent.original_cause_of_death
                      ? t.causes[agent.original_cause_of_death] ?? agent.original_cause_of_death
                      : '—'}
                  </span>
                </div>
              )}
              {agent.brain_fingerprint && (
                <div className="rounded bg-[#121821] p-2 font-mono text-[10px] text-[#9FB0C3]">
                  {t.brainFingerprintLabel}:{' '}
                  <span className="text-[#E6EDF3]">{agent.brain_fingerprint}</span>
                </div>
              )}
              {agent.death_penalty_record && (
                <div className="space-y-1 rounded bg-[#121821] p-2 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-[#9FB0C3]">{t.deathPenaltyLabel}</span>
                    <span
                      className={
                        agent.death_penalty_record.applied
                          ? 'font-semibold text-emerald-300'
                          : 'text-[#9FB0C3]'
                      }
                    >
                      {agent.death_penalty_record.applied ? 'applied' : 'none'}
                    </span>
                  </div>
                  {agent.death_penalty_record.perceived_cues &&
                    agent.death_penalty_record.perceived_cues.length > 0 && (
                      <div className="text-[10px] text-[#9FB0C3]">
                        {t.evidenceCuesLabel}:{' '}
                        <span className="font-mono text-[#E6EDF3]">
                          {agent.death_penalty_record.perceived_cues.join(', ')}
                        </span>
                      </div>
                    )}
                  {agent.death_penalty_record.pre_weight_fingerprint &&
                    agent.death_penalty_record.post_weight_fingerprint && (
                      <div className="font-mono text-[10px] text-[#9FB0C3]">
                        {agent.death_penalty_record.pre_weight_fingerprint} →{' '}
                        {agent.death_penalty_record.post_weight_fingerprint}
                      </div>
                    )}
                </div>
              )}
            </div>
          )}

          {/* Vitals OR Death Record */}
          {livingAgent ? (
            <div className="space-y-2.5 rounded border border-white/10 bg-[#18212C] p-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-[#E6EDF3]">{t.vitalsSection}</h3>
                {livingAgent.is_pregnant && (
                  <span className="flex items-center gap-1 text-[11px] text-[#F2BE49]">
                    <Baby className="h-3.5 w-3.5" />
                    {t.pregnant}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <MeterBar label={t.health} value={livingAgent.health} />
                <MeterBar label={t.energy} value={livingAgent.energy} />
                <MeterBar label={t.hunger} value={livingAgent.hunger} dangerWhenHigh />
                <MeterBar label={t.thirst} value={livingAgent.thirst} dangerWhenHigh />
                <MeterBar label={t.injury} value={livingAgent.injury} dangerWhenHigh />
                <MeterBar label={t.disease} value={livingAgent.disease_load} dangerWhenHigh />
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-white/5 pt-2 text-[11px]">
                <div>
                  <div className="text-[#9FB0C3]">{t.currentAction}</div>
                  <div className="font-medium text-[#E6EDF3]">
                    {t.actions[livingAgent.last_action] ?? livingAgent.last_action}
                  </div>
                </div>
                <div>
                  <div className="text-[#9FB0C3]">{t.lastSignal}</div>
                  <div className="font-mono text-[#57b8d8]">
                    {livingAgent.last_emitted_token !== null
                      ? `T-${livingAgent.last_emitted_token}`
                      : '—'}
                    {livingAgent.carried_item ? ` · [${livingAgent.carried_item}]` : ''}
                  </div>
                </div>
              </div>
            </div>
          ) : !agent.is_alive ? (
            <div className="space-y-1 rounded border border-red-500/30 bg-red-500/10 p-3 text-[11px]">
              <div>
                <span className="text-[#9FB0C3]">{t.causeOfDeath}: </span>
                <span className="font-semibold text-red-300">
                  {agent.cause_of_death ? t.causes[agent.cause_of_death] ?? agent.cause_of_death : '—'}
                </span>
              </div>
              <div className="font-mono tabular-nums text-[#9FB0C3]">
                {t.deathTick}: {agent.death_tick ?? '—'}
              </div>
            </div>
          ) : null}

          {/* Family Links */}
          <div className="space-y-2 rounded border border-white/10 bg-[#18212C] p-3">
            <h3 className="flex items-center gap-1.5 font-semibold">
              <Users className="h-3.5 w-3.5 text-[#D99B26]" />
              <span>{t.familySection}</span>
            </h3>

            <div>
              <div className="mb-1 text-[11px] text-[#9FB0C3]">{t.parentsLabel}</div>
              {agent.parent_a_id === null && agent.parent_b_id === null ? (
                <div className="text-[11px] text-[#9FB0C3]/80">{t.noParentsFounders}</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {[agent.parent_a_id, agent.parent_b_id]
                    .filter((pid): pid is number => pid !== null)
                    .map((pid, idx) => {
                      const rel = agentLookup.get(pid);
                      return (
                        <button
                          key={`parent-${pid}-${idx}`}
                          type="button"
                          onClick={() => onSelectAgent(pid)}
                          className="rounded border border-white/10 bg-[#121821] px-2 py-1 font-mono text-[11px] hover:border-[#D99B26]/60"
                        >
                          #{pid} {rel ? (rel.is_alive ? '●' : '†') : ''}
                        </button>
                      );
                    })}
                </div>
              )}
            </div>

            <div>
              <div className="mb-1 text-[11px] text-[#9FB0C3]">
                {t.childrenLabel} ({agent.children_ids.length})
              </div>
              {agent.children_ids.length === 0 ? (
                <div className="text-[11px] text-[#9FB0C3]/80">{t.noChildrenYet}</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {agent.children_ids.map((cid, idx) => {
                    const rel = agentLookup.get(cid);
                    return (
                      <button
                        key={`child-${cid}-${idx}`}
                        type="button"
                        onClick={() => onSelectAgent(cid)}
                        className="rounded border border-white/10 bg-[#121821] px-2 py-1 font-mono text-[11px] hover:border-[#D99B26]/60"
                      >
                        #{cid} {rel ? (rel.is_alive ? '●' : '†') : ''}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Traits & Skills */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 rounded border border-white/10 bg-[#18212C] p-3">
              <h3 className="font-semibold">{t.traitsSection}</h3>
              {Object.entries(agent.traits).map(([k, v]) => {
                const pct = Math.max(0, Math.min(100, Math.round(v * 100)));
                return (
                  <div key={k} className="space-y-0.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-[#9FB0C3]">{t.traits[k] ?? k}</span>
                      <span className="font-mono tabular-nums">{safeFixed(v, 2)}</span>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded bg-[#121821]">
                      <div className="h-full bg-[#3B82A6]" style={{width: `${pct}%`}} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2 rounded border border-white/10 bg-[#18212C] p-3">
              <h3 className="font-semibold">{t.skillsSection}</h3>
              {Object.keys(agent.skills).length === 0 ? (
                <div className="text-[11px] text-[#9FB0C3]">—</div>
              ) : (
                <div className="space-y-1.5">
                  {Object.entries(agent.skills)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, v]) => {
                      const pct = Math.max(0, Math.min(100, Math.round(v * 100)));
                      return (
                        <div key={k} className="space-y-0.5 text-[11px]">
                          <div className="flex justify-between">
                            <span className="text-[#9FB0C3]">{t.skills[k] ?? k}</span>
                            <span className="font-mono tabular-nums text-[#F2BE49]">{pct}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded bg-[#121821]">
                            <div className="h-full bg-[#D99B26]" style={{width: `${pct}%`}} />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          {/* What This Agent Learned (Action Outcomes & Recent Contexts) */}
          <div className="space-y-2.5 rounded border border-white/10 bg-[#18212C] p-3">
            <h3 className="flex items-center gap-1.5 font-semibold text-[#F2BE49]">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{t.whatLearnedSection}</span>
            </h3>
            {(() => {
              const outcomes = Object.entries(agent.action_outcomes ?? {}).sort(
                (a, b) => b[1].ema_reward - a[1].ema_reward,
              );
              const positive = outcomes.filter(([, s]) => s.ema_reward >= 0);
              const negative = outcomes.filter(([, s]) => s.ema_reward < 0).reverse();
              const contexts = agent.neural_network
                ? Object.entries(agent.neural_network.recent_contexts ?? {}).sort(
                    (a, b) => b[1] - a[1],
                  )
                : [];
              if (outcomes.length === 0 && contexts.length === 0) {
                return <div className="text-[11px] text-[#9FB0C3]">{t.noLearnedOutcomesYet}</div>;
              }
              return (
                <div className="space-y-2.5">
                  {positive.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[10px] font-medium text-emerald-300">
                        {t.learnedPositiveHabits}
                      </div>
                      <div className="max-h-32 space-y-1 overflow-y-auto">
                        {positive.slice(0, 8).map(([act, stat]) => (
                          <div
                            key={`pos-${act}`}
                            className="flex items-center justify-between rounded bg-[#121821] px-2 py-1 text-[11px]"
                          >
                            <span className="text-[#E6EDF3]">{t.actions[act] ?? act}</span>
                            <span className="font-mono tabular-nums text-emerald-300">
                              +{safeFixed(stat.ema_reward, 3)} · {stat.count} {t.trialsLabel}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {negative.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[10px] font-medium text-red-300">
                        {t.learnedAvoidedActions}
                      </div>
                      <div className="max-h-28 space-y-1 overflow-y-auto">
                        {negative.slice(0, 6).map(([act, stat]) => (
                          <div
                            key={`neg-${act}`}
                            className="flex items-center justify-between rounded bg-[#121821] px-2 py-1 text-[11px]"
                          >
                            <span className="text-[#E6EDF3]">{t.actions[act] ?? act}</span>
                            <span className="font-mono tabular-nums text-red-300">
                              {safeFixed(stat.ema_reward, 3)} · {stat.count} {t.trialsLabel}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {contexts.length > 0 && (
                    <div className="space-y-1 border-t border-white/5 pt-2">
                      <div className="text-[10px] text-[#9FB0C3]">{t.recentCognitiveContexts}</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {contexts.slice(0, 6).map(([ctx, cnt]) => (
                          <div
                            key={ctx}
                            className="flex items-center justify-between rounded bg-[#121821] px-2 py-1 text-[10px]"
                          >
                            <span className="truncate text-[#9FB0C3]">
                              {t.contexts[ctx] ?? ctx}
                            </span>
                            <span className="font-mono tabular-nums text-[#57b8d8]">{cnt}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Neural Network Telemetry Card */}
          <div className="space-y-2.5 rounded border border-[#3B82A6]/40 bg-[#18212C] p-3">
            <h3 className="flex items-center gap-1.5 font-semibold text-[#57b8d8]">
              <Cpu className="h-3.5 w-3.5" />
              <span>{t.neuralNetworkTitle}</span>
            </h3>
            {agent.neural_network ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded bg-[#121821] px-2.5 py-1.5 text-[10px]">
                  <span className="font-mono text-[#E6EDF3]">
                    {agent.neural_network.obs_dim} → GRU({agent.neural_network.hidden_dim}) →{' '}
                    {agent.neural_network.num_actions}/{agent.neural_network.num_signals}/1
                  </span>
                  <span className="font-mono text-[#9FB0C3]">
                    {agent.neural_network.backend} · {agent.neural_network.optimizer}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 font-mono text-[11px] tabular-nums sm:grid-cols-3">
                  <div className="rounded bg-[#121821] p-2">
                    <div className="font-sans text-[10px] text-[#9FB0C3]">{t.nnParameters}</div>
                    <div className="font-bold text-[#E6EDF3]">
                      {agent.neural_network.parameter_count.toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded bg-[#121821] p-2">
                    <div className="font-sans text-[10px] text-[#9FB0C3]">{t.nnUpdatesCount}</div>
                    <div className="font-bold text-[#F2BE49]">
                      {agent.neural_network.total_updates.toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded bg-[#121821] p-2">
                    <div className="font-sans text-[10px] text-[#9FB0C3]">{t.nnLearningRate}</div>
                    <div className="font-bold text-[#E6EDF3]">
                      {safeFixed(agent.neural_network.learning_rate, 4)}
                    </div>
                  </div>
                  <div className="rounded bg-[#121821] p-2">
                    <div className="font-sans text-[10px] text-[#9FB0C3]">{t.nnPolicyLoss}</div>
                    <div className="font-bold text-[#E6EDF3]">
                      {safeFixed(agent.neural_network.last_loss, 4)}
                    </div>
                  </div>
                  <div className="rounded bg-[#121821] p-2">
                    <div className="font-sans text-[10px] text-[#9FB0C3]">{t.nnValueLoss}</div>
                    <div className="font-bold text-[#E6EDF3]">
                      {safeFixed(agent.neural_network.value_loss, 4)}
                    </div>
                  </div>
                  <div className="rounded bg-[#121821] p-2">
                    <div className="font-sans text-[10px] text-[#9FB0C3]">{t.nnTdError}</div>
                    <div className="font-bold text-[#57b8d8]">
                      {safeFixed(agent.neural_network.mean_td_error, 4)}
                    </div>
                  </div>
                  <div className="rounded bg-[#121821] p-2">
                    <div className="font-sans text-[10px] text-[#9FB0C3]">{t.nnEntropy}</div>
                    <div className="font-bold text-[#E6EDF3]">
                      {safeFixed(agent.neural_network.policy_entropy, 3)}
                    </div>
                  </div>
                  <div className="rounded bg-[#121821] p-2">
                    <div className="font-sans text-[10px] text-[#9FB0C3]">{t.nnRecentReward}</div>
                    <div
                      className={`font-bold ${
                        agent.neural_network.mean_recent_reward >= 0
                          ? 'text-emerald-300'
                          : 'text-red-300'
                      }`}
                    >
                      {agent.neural_network.mean_recent_reward >= 0 ? '+' : ''}
                      {safeFixed(agent.neural_network.mean_recent_reward, 3)}
                    </div>
                  </div>
                  <div className="rounded bg-[#121821] p-2">
                    <div className="font-sans text-[10px] text-[#9FB0C3]">{t.nnDeathPenalties}</div>
                    <div className="font-bold text-red-300">
                      {agent.neural_network.death_penalty_count}
                    </div>
                  </div>
                </div>

                {/* Experience Buffer Bar */}
                <div className="space-y-1 rounded bg-[#121821] p-2">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-[#9FB0C3]">{t.nnExpBuffer}</span>
                    <span className="font-mono tabular-nums text-[#E6EDF3]">
                      {agent.neural_network.experience_buffer_len} /{' '}
                      {agent.neural_network.experience_buffer_capacity}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded bg-[#18212C]">
                    <div
                      className="h-full bg-[#57b8d8]"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            (agent.neural_network.experience_buffer_len /
                              Math.max(1, agent.neural_network.experience_buffer_capacity)) *
                              100,
                          ),
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 font-mono text-[10px] tabular-nums text-[#9FB0C3]">
                  <div className="rounded bg-[#121821] px-2 py-1.5">
                    {t.nnWeightNorm}:{' '}
                    <span className="text-[#E6EDF3]">
                      {safeFixed(agent.neural_network.weight_l2_norm, 3)}
                    </span>
                  </div>
                  <div className="rounded bg-[#121821] px-2 py-1.5">
                    {t.nnHiddenNorm}:{' '}
                    <span className="text-[#E6EDF3]">
                      {safeFixed(agent.neural_network.hidden_state_l2_norm, 3)}
                    </span>
                  </div>
                </div>

                {agent.neural_network.weight_fingerprint && (
                  <div className="rounded bg-[#121821] px-2 py-1 font-mono text-[10px] text-[#9FB0C3]">
                    {t.nnWeightFingerprint}:{' '}
                    <span className="text-[#F2BE49]">
                      {agent.neural_network.weight_fingerprint}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1 text-[11px] text-[#9FB0C3]">
                {agent.brain_fingerprint && (
                  <div className="rounded bg-[#121821] px-2 py-1 font-mono text-[10px]">
                    {t.nnWeightFingerprint}:{' '}
                    <span className="text-[#E6EDF3]">{agent.brain_fingerprint}</span>
                  </div>
                )}
                <div>{t.nnLegacyUnavailable}</div>
              </div>
            )}
          </div>

          {/* Inventory */}
          {livingAgent && (
            <div className="rounded border border-white/10 bg-[#18212C] p-3">
              <h3 className="mb-1.5 font-semibold">{t.inventorySection}</h3>
              {Object.values(livingAgent.inventory).every((v) => v <= 0) ? (
                <div className="text-[11px] text-[#9FB0C3]">{t.emptyInventory}</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(livingAgent.inventory)
                    .filter(([, val]) => val > 0)
                    .map(([k, val]) => (
                      <div
                        key={k}
                        className="rounded border border-white/10 bg-[#121821] px-2 py-1 font-mono text-[11px] tabular-nums"
                      >
                        {k}: {safeFixed(val, 1)}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Personal Lexicon */}
          {livingAgent && (
            <div className="rounded border border-white/10 bg-[#18212C] p-3">
              <h3 className="mb-1.5 flex items-center gap-1.5 font-semibold">
                <MessageSquare className="h-3.5 w-3.5 text-[#57b8d8]" />
                <span>
                  {t.lexiconSection} ({livingAgent.lexicon_size})
                </span>
              </h3>
              {Object.keys(livingAgent.lexicon).length === 0 ? (
                <div className="text-[11px] text-[#9FB0C3]">{t.noLexiconYet}</div>
              ) : (
                <div className="max-h-36 space-y-1 overflow-y-auto">
                  {Object.entries(livingAgent.lexicon)
                    .slice(0, 18)
                    .map(([tok, ctxMap]) => {
                      const topCtx = Object.entries(ctxMap).sort((a, b) => b[1] - a[1])[0];
                      return (
                        <div
                          key={tok}
                          className="flex items-center justify-between rounded bg-[#121821] px-2 py-1 text-[11px]"
                        >
                          <span className="font-mono text-[#57b8d8]">T-{tok}</span>
                          {topCtx && (
                            <span className="text-[#9FB0C3]">
                              {t.contexts[topCtx[0]] ?? topCtx[0]} ({safeFixed(topCtx[1], 2)})
                            </span>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* Trust & Distrust Network + Remembered Hazards */}
          <div className="space-y-2.5 rounded border border-white/10 bg-[#18212C] p-3">
            {(() => {
              const trusted = [...agent.social_ties]
                .filter((tie) => tie.trust > 0.15)
                .sort((a, b) => b.trust - a.trust);
              const distrusted = [...agent.social_ties]
                .filter((tie) => tie.trust < -0.15)
                .sort((a, b) => a.trust - b.trust);
              const neutral = [...agent.social_ties]
                .filter((tie) => tie.trust >= -0.15 && tie.trust <= 0.15)
                .sort((a, b) => b.familiarity - a.familiarity);
              const hazards = livingAgent
                ? livingAgent.spatial_memories.filter((sm) => sm.resource_kind === 'hazard')
                : [];

              return (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-[#E6EDF3]">{t.trustDistrustTitle}</h3>
                    <span className="font-mono text-[10px] tabular-nums text-[#9FB0C3]">
                      +{trusted.length} / -{distrusted.length} / ={neutral.length}
                    </span>
                  </div>

                  {agent.social_ties.length === 0 && hazards.length === 0 ? (
                    <div className="text-[11px] text-[#9FB0C3]">{t.noTiesYet}</div>
                  ) : (
                    <div className="space-y-2">
                      {/* Trusted Allies */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-[10px] font-medium text-emerald-300">
                          <ShieldCheck className="h-3 w-3" />
                          <span>
                            {t.trustedAllies} ({trusted.length})
                          </span>
                        </div>
                        {trusted.length === 0 ? (
                          <div className="text-[10px] text-[#9FB0C3]">{t.noTrustedYet}</div>
                        ) : (
                          <div className="max-h-24 space-y-1 overflow-y-auto">
                            {trusted.slice(0, 8).map((tie) => (
                              <button
                                key={`tr-${tie.agent_id}`}
                                type="button"
                                onClick={() => onSelectAgent(tie.agent_id)}
                                className="flex w-full items-center justify-between rounded border border-emerald-500/20 bg-[#121821] px-2 py-1 text-[11px] hover:border-emerald-400"
                              >
                                <span className="font-mono text-emerald-300">
                                  #{tie.agent_id}
                                </span>
                                <span className="font-mono tabular-nums text-[#9FB0C3]">
                                  {t.trustScore}: +{safeFixed(tie.trust, 2)} ·{' '}
                                  {t.familiarityScore}: {safeFixed(tie.familiarity, 2)}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Distrusted Agents */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-[10px] font-medium text-red-300">
                          <ShieldAlert className="h-3 w-3" />
                          <span>
                            {t.distrustedAgents} ({distrusted.length})
                          </span>
                        </div>
                        {distrusted.length === 0 ? (
                          <div className="text-[10px] text-[#9FB0C3]">{t.noDistrustedYet}</div>
                        ) : (
                          <div className="max-h-24 space-y-1 overflow-y-auto">
                            {distrusted.slice(0, 8).map((tie) => (
                              <button
                                key={`dis-${tie.agent_id}`}
                                type="button"
                                onClick={() => onSelectAgent(tie.agent_id)}
                                className="flex w-full items-center justify-between rounded border border-red-500/25 bg-[#121821] px-2 py-1 text-[11px] hover:border-red-400"
                              >
                                <span className="font-mono text-red-300">#{tie.agent_id}</span>
                                <span className="font-mono tabular-nums text-[#9FB0C3]">
                                  {t.trustScore}: {safeFixed(tie.trust, 2)} ·{' '}
                                  {t.familiarityScore}: {safeFixed(tie.familiarity, 2)}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Neutral Acquaintances */}
                      {neutral.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-[10px] text-[#9FB0C3]">
                            {t.neutralAcquaintances} ({neutral.length})
                          </div>
                          <div className="flex max-h-20 flex-wrap gap-1 overflow-y-auto">
                            {neutral.slice(0, 10).map((tie) => (
                              <button
                                key={`neu-${tie.agent_id}`}
                                type="button"
                                onClick={() => onSelectAgent(tie.agent_id)}
                                className="rounded border border-white/10 bg-[#121821] px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-[#9FB0C3] hover:border-[#D99B26]/50"
                              >
                                #{tie.agent_id} ({safeFixed(tie.trust, 2)})
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Remembered Spatial Hazards */}
                      {hazards.length > 0 && (
                        <div className="space-y-1 border-t border-white/5 pt-2">
                          <div className="flex items-center gap-1 text-[10px] font-medium text-[#F2BE49]">
                            <AlertTriangle className="h-3 w-3" />
                            <span>
                              {t.avoidedHazards} ({hazards.length})
                            </span>
                          </div>
                          <div className="max-h-20 space-y-1 overflow-y-auto">
                            {hazards.slice(0, 5).map((hz, idx) => (
                              <div
                                key={`hz-${idx}`}
                                className="flex justify-between rounded bg-[#121821] px-2 py-1 font-mono text-[10px] tabular-nums text-red-300"
                              >
                                <span>{formatCoords(hz.x, hz.y)}</span>
                                <span>
                                  {t.severityLabel}: {safeFixed(hz.estimated_amount, 2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* Local Sensory Perception */}
          {livingAgent && (
            <div className="space-y-2 rounded border border-white/10 bg-[#18212C] p-3">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 font-semibold text-[#57b8d8]">
                  <Eye className="h-3.5 w-3.5" />
                  <span>{t.sensoryPerceptionTitle}</span>
                </h3>
                <span className="font-mono text-[10px] tabular-nums text-[#9FB0C3]">
                  {t.visionRangeLabel}: {safeFixed(livingAgent.local_perception.vision_radius_m, 0)}m ·{' '}
                  {t.hearingRangeLabel}: {safeFixed(livingAgent.local_perception.hearing_radius_m, 0)}m
                </span>
              </div>

              <div className="rounded bg-[#121821] p-2">
                <div className="mb-1 text-[10px] text-[#9FB0C3]">{t.localResourcesSpot}</div>
                <div className="grid grid-cols-5 gap-1 font-mono text-[10px] tabular-nums">
                  <div>
                    W:{safeFixed(livingAgent.local_perception.local_water, 2)}
                  </div>
                  <div>
                    F:{safeFixed(livingAgent.local_perception.local_food, 2)}
                  </div>
                  <div>
                    Wd:{safeFixed(livingAgent.local_perception.local_wood, 2)}
                  </div>
                  <div>
                    St:{safeFixed(livingAgent.local_perception.local_stone, 2)}
                  </div>
                  <div>
                    Hb:{safeFixed(livingAgent.local_perception.local_herb, 2)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="rounded bg-[#121821] p-2">
                  <div className="text-[#9FB0C3]">{t.nearbyFaunaVisible}</div>
                  <div className="font-mono font-bold tabular-nums">
                    {livingAgent.local_perception.visible_fauna_ids.length}
                  </div>
                </div>
                <div className="rounded bg-[#121821] p-2">
                  <div className="text-[#9FB0C3]">{t.nearbyArtifactsVisible}</div>
                  <div className="font-mono font-bold tabular-nums">
                    {livingAgent.local_perception.visible_artifact_ids.length}
                  </div>
                </div>
              </div>

              {livingAgent.local_perception.visible_agent_ids.length > 0 && (
                <div>
                  <div className="mb-1 text-[10px] text-[#9FB0C3]">
                    {t.nearbyAgentsVisible} ({livingAgent.local_perception.visible_agent_ids.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {livingAgent.local_perception.visible_agent_ids.slice(0, 14).map((vid) => (
                      <button
                        key={`vis-${vid}`}
                        type="button"
                        onClick={() => onSelectAgent(vid)}
                        className="rounded border border-white/10 bg-[#121821] px-1.5 py-0.5 font-mono text-[10px] text-[#F2BE49] hover:border-[#D99B26]"
                      >
                        #{vid}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="mb-1 text-[10px] text-[#9FB0C3]">{t.heardSignalsTitle}</div>
                {livingAgent.local_perception.heard_emissions.length === 0 ? (
                  <div className="text-[10px] text-[#9FB0C3]/80">{t.noSignalsHeard}</div>
                ) : (
                  <div className="max-h-24 space-y-1 overflow-y-auto">
                    {livingAgent.local_perception.heard_emissions.slice(0, 8).map((em, idx) => (
                      <div
                        key={`em-${idx}`}
                        className="flex items-center justify-between rounded bg-[#121821] px-2 py-1 font-mono text-[10px] tabular-nums"
                      >
                        <button
                          type="button"
                          onClick={() => onSelectAgent(em.speaker_id)}
                          className="text-[#F2BE49] hover:underline"
                        >
                          #{em.speaker_id}
                        </button>
                        <span className="text-[#57b8d8]">T-{em.token}</span>
                        <span className="text-[#9FB0C3]">{safeFixed(em.distance_m, 1)}m</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Episodic & Spatial Memories */}
          <div className="rounded border border-white/10 bg-[#18212C] p-3">
            <h3 className="mb-1.5 font-semibold">{t.episodicMemorySection}</h3>
            {agent.episodic_memories.length === 0 ? (
              <div className="text-[11px] text-[#9FB0C3]">{t.noMemoriesYet}</div>
            ) : (
              <div className="max-h-40 space-y-1.5 overflow-y-auto">
                {[...agent.episodic_memories].reverse().slice(0, 12).map((mem, idx) => (
                  <div key={`${mem.tick}-${idx}`} className="rounded bg-[#121821] p-2 text-[11px]">
                    <div className="flex justify-between font-mono text-[10px] text-[#9FB0C3]">
                      <span>
                        {t.tickUnit} {mem.tick}
                      </span>
                      <span className={mem.valence >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {mem.valence >= 0 ? '+' : ''}
                        {safeFixed(mem.valence, 2)}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[#E6EDF3]">{mem.note || mem.event_type}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {livingAgent && livingAgent.spatial_memories.length > 0 && (
            <div className="rounded border border-white/10 bg-[#18212C] p-3">
              <h3 className="mb-1.5 flex items-center gap-1.5 font-semibold">
                <Navigation className="h-3.5 w-3.5 text-[#D99B26]" />
                <span>{t.spatialMemorySection}</span>
              </h3>
              <div className="max-h-32 space-y-1 overflow-y-auto">
                {livingAgent.spatial_memories.slice(0, 12).map((sm, idx) => (
                  <div
                    key={`${sm.resource_kind}-${idx}`}
                    className="flex justify-between rounded bg-[#121821] px-2 py-1 font-mono text-[11px] tabular-nums"
                  >
                    <span
                      className={sm.resource_kind === 'hazard' ? 'text-red-300' : 'text-[#E6EDF3]'}
                    >
                      {sm.resource_kind}
                    </span>
                    <span className="text-[#9FB0C3]">
                      {formatCoords(sm.x, sm.y)} · {safeFixed(sm.estimated_amount, 1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
