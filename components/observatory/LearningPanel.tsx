'use client';

import React from 'react';
import {
  AlertTriangle,
  Award,
  Brain,
  Compass,
  Cpu,
  GitBranch,
  Info,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {formatCoords, safeFixed} from '@/lib/observatory/formatters';
import type {Translations} from '@/lib/observatory/i18n';
import type {ObservatorySnapshot} from '@/lib/observatory/types';

interface LearningPanelProps {
  t: Translations;
  snapshot: ObservatorySnapshot;
  onSelectAgent?: (agentId: number) => void;
}

export default function LearningPanel({t, snapshot, onSelectAgent}: LearningPanelProps) {
  const learn = snapshot.analytics.learning_intelligence;
  const lt = snapshot.learning_telemetry;

  const positiveOutcomes = (lt?.learned_action_outcomes ?? []).filter(
    (item) => item.weighted_avg_reward >= 0,
  );
  const negativeOutcomes = (lt?.learned_action_outcomes ?? [])
    .filter((item) => item.weighted_avg_reward < 0)
    .sort((a, b) => a.weighted_avg_reward - b.weighted_avg_reward);

  const renderAgentBtn = (agentId: number | null, accentClass = 'text-[#F2BE49]') => {
    if (agentId === null) return <span className="text-[#9FB0C3]">—</span>;
    if (!onSelectAgent) {
      return <span className={`font-mono ${accentClass}`}>#{agentId}</span>;
    }
    return (
      <button
        type="button"
        onClick={() => onSelectAgent(agentId)}
        className={`font-mono font-semibold hover:underline ${accentClass}`}
      >
        #{agentId}
      </button>
    );
  };

  return (
    <div className="space-y-4 text-xs text-[#E6EDF3]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-[#D99B26]" />
          <h2 className="text-sm font-bold">{t.learnTitle}</h2>
        </div>
        <div className="flex items-center gap-1.5 rounded border border-[#3B82A6]/50 bg-[#3B82A6]/15 px-2.5 py-1 text-[11px] font-medium text-[#57b8d8]">
          <Info className="h-3.5 w-3.5 shrink-0" />
          <span>{t.rlScopeBadge}</span>
        </div>
      </div>

      {/* Primary Learning KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-md border border-white/10 bg-[#121821] p-3">
          <div className="text-[11px] text-[#9FB0C3]">{t.totalBrainUpdates}</div>
          <div className="mt-1 font-mono text-lg font-bold tabular-nums text-[#F2BE49]">
            {learn.total_brain_updates.toLocaleString()}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-[#9FB0C3]">
            {t.expStored}: {learn.total_experiences_stored.toLocaleString()}
          </div>
        </div>

        <div className="rounded-md border border-white/10 bg-[#121821] p-3">
          <div className="text-[11px] text-[#9FB0C3]">{t.skillsAcquired}</div>
          <div className="mt-1 font-mono text-lg font-bold tabular-nums text-emerald-300">
            {learn.total_skills_acquired.toLocaleString()}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-[#9FB0C3]">
            {t.avgSkillsPerAgent}: {safeFixed(learn.avg_skills_per_agent, 2)}
          </div>
        </div>

        <div className="rounded-md border border-white/10 bg-[#121821] p-3">
          <div className="text-[11px] text-[#9FB0C3]">
            {t.episodicTotal} / {t.spatialTotal}
          </div>
          <div className="mt-1 font-mono text-lg font-bold tabular-nums text-[#57b8d8]">
            {learn.episodic_memories_total.toLocaleString()} /{' '}
            {learn.spatial_memories_total.toLocaleString()}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-[#9FB0C3]">
            {t.intergenTransfers}: {learn.intergenerational_transfers}
          </div>
        </div>

        <div className="rounded-md border border-white/10 bg-[#121821] p-3">
          <div className="text-[11px] text-[#9FB0C3]">{t.postNegSwitches}</div>
          <div className="mt-1 font-mono text-lg font-bold tabular-nums text-[#E6EDF3]">
            {learn.post_negative_decision_switches.toLocaleString()}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-red-300">
            {t.repeatedErrors}: {learn.repeated_failed_actions.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Discovery vs Reach + Neural Optimization & Architecture */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="space-y-3 rounded-md border border-white/10 bg-[#121821] p-4">
          <h3 className="flex items-center gap-1.5 font-semibold text-[#57b8d8]">
            <Compass className="h-4 w-4" />
            <span>
              {t.foodDiscoverReach} & {t.waterDiscoverReach}
            </span>
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded border border-white/10 bg-[#18212C] p-3">
              <div className="text-[11px] text-[#9FB0C3]">{t.foodDiscoverReach}</div>
              <div className="mt-1 font-mono text-base font-bold tabular-nums text-[#F2BE49]">
                {learn.food_discovery_events} / {learn.food_reach_events}
              </div>
            </div>
            <div className="rounded border border-white/10 bg-[#18212C] p-3">
              <div className="text-[11px] text-[#9FB0C3]">{t.waterDiscoverReach}</div>
              <div className="mt-1 font-mono text-base font-bold tabular-nums text-[#57b8d8]">
                {learn.water_discovery_events} / {learn.water_reach_events}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded border border-white/10 bg-[#18212C] p-3">
              <div className="text-[11px] text-[#9FB0C3]">{t.updatesStdDev}</div>
              <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-[#E6EDF3]">
                {safeFixed(learn.individual_updates_std_dev, 2)}
              </div>
            </div>
            <div className="rounded border border-white/10 bg-[#18212C] p-3">
              <div className="text-[11px] text-[#9FB0C3]">{t.rewardStdDev}</div>
              <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-[#E6EDF3]">
                {safeFixed(learn.individual_reward_std_dev, 3)}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3 rounded-md border border-white/10 bg-[#121821] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 font-semibold text-[#F2BE49]">
              <Cpu className="h-4 w-4" />
              <span>{t.learningSectionTitle}</span>
            </h3>
            {lt?.architecture && (
              <span className="font-mono text-[10px] text-[#57b8d8]">
                {lt.architecture.architecture} · {lt.architecture.obs_dim}→
                {lt.architecture.hidden_dim}→({lt.architecture.num_actions}/
                {lt.architecture.num_signals}/1)
              </span>
            )}
          </div>

          {lt ? (
            <>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                <div className="rounded border border-white/10 bg-[#18212C] p-2.5">
                  <div className="text-[10px] text-[#9FB0C3]">{t.livingLabel}</div>
                  <div className="mt-1 font-mono text-sm font-bold tabular-nums text-[#E6EDF3]">
                    {lt.agents_with_updates} / {lt.living_brains_count}
                  </div>
                </div>
                <div className="rounded border border-white/10 bg-[#18212C] p-2.5">
                  <div className="text-[10px] text-[#9FB0C3]">{t.learningUpdates}</div>
                  <div className="mt-1 font-mono text-sm font-bold tabular-nums text-[#F2BE49]">
                    {safeFixed(lt.avg_updates_per_agent, 1)}
                  </div>
                </div>
                <div className="rounded border border-white/10 bg-[#18212C] p-2.5">
                  <div className="text-[10px] text-[#9FB0C3]">{t.learningTdError}</div>
                  <div className="mt-1 font-mono text-sm font-bold tabular-nums text-[#57b8d8]">
                    {safeFixed(lt.mean_td_error, 4)}
                  </div>
                </div>
                <div className="rounded border border-white/10 bg-[#18212C] p-2.5">
                  <div className="text-[10px] text-[#9FB0C3]">{t.learningEntropy}</div>
                  <div className="mt-1 font-mono text-sm font-bold tabular-nums text-[#E6EDF3]">
                    {safeFixed(lt.mean_policy_entropy, 3)}
                  </div>
                </div>
                <div className="rounded border border-white/10 bg-[#18212C] p-2.5">
                  <div className="text-[10px] text-[#9FB0C3]">
                    {t.learningLoss} / {t.nnValueLoss}
                  </div>
                  <div className="mt-1 font-mono text-xs font-bold tabular-nums text-[#E6EDF3]">
                    {safeFixed(lt.mean_loss, 4)} / {safeFixed(lt.mean_value_loss, 4)}
                  </div>
                </div>
                <div className="rounded border border-white/10 bg-[#18212C] p-2.5">
                  <div className="text-[10px] text-[#9FB0C3]">{t.learningReward}</div>
                  <div
                    className={`mt-1 font-mono text-sm font-bold tabular-nums ${
                      lt.mean_recent_reward >= 0 ? 'text-emerald-300' : 'text-red-300'
                    }`}
                  >
                    {safeFixed(lt.mean_recent_reward, 3)}
                  </div>
                </div>
              </div>

              {/* Neural Architecture & Weight Norms Strip */}
              <div className="grid grid-cols-2 gap-2 rounded border border-white/10 bg-[#18212C] p-2.5 font-mono text-[10px] tabular-nums sm:grid-cols-4">
                <div>
                  <div className="font-sans text-[#9FB0C3]">{t.nnParameters}</div>
                  <div className="font-bold text-[#E6EDF3]">
                    {lt.architecture ? lt.architecture.parameter_count.toLocaleString() : '—'}
                  </div>
                </div>
                <div>
                  <div className="font-sans text-[#9FB0C3]">{t.nnOptimizer}</div>
                  <div className="font-bold text-[#57b8d8]">
                    {lt.architecture
                      ? `${lt.architecture.optimizer} (${lt.architecture.backend})`
                      : snapshot.backend}
                  </div>
                </div>
                <div>
                  <div className="font-sans text-[#9FB0C3]">{t.nnWeightNorm}</div>
                  <div className="font-bold text-[#F2BE49]">
                    {safeFixed(lt.avg_weight_l2_norm, 3)}
                  </div>
                </div>
                <div>
                  <div className="font-sans text-[#9FB0C3]">{t.nnHiddenNorm}</div>
                  <div className="font-bold text-emerald-300">
                    {safeFixed(lt.avg_hidden_l2_norm, 3)}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] tabular-nums text-[#9FB0C3]">
                <span>
                  {t.nnEntropyRange}: {safeFixed(lt.min_policy_entropy, 3)} –{' '}
                  {safeFixed(lt.mean_policy_entropy, 3)} – {safeFixed(lt.max_policy_entropy, 3)}
                </span>
                <span>
                  {t.nnExpBuffer}: {lt.total_experience_items.toLocaleString()}
                </span>
              </div>
            </>
          ) : (
            <div className="rounded border border-white/10 bg-[#18212C] p-6 text-center text-[#9FB0C3]">
              —
            </div>
          )}

          {learn.telemetry_scope_note && (
            <div className="flex items-start gap-1.5 rounded border border-white/10 bg-[#18212C] p-2.5 text-[11px] text-[#9FB0C3]">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#D99B26]" />
              <span>{learn.telemetry_scope_note}</span>
            </div>
          )}
        </section>
      </div>

      {/* What the Population Learned (Aggregated Action Outcomes) */}
      <section className="space-y-3 rounded-md border border-white/10 bg-[#121821] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 font-semibold text-[#F2BE49]">
            <Sparkles className="h-4 w-4" />
            <span>{t.whatLearnedSection}</span>
          </h3>
          <span className="text-[11px] text-[#9FB0C3]">{t.learnedBehaviorsNote}</span>
        </div>

        {positiveOutcomes.length === 0 && negativeOutcomes.length === 0 ? (
          <div className="rounded border border-white/10 bg-[#18212C] p-4 text-center text-[#9FB0C3]">
            {t.noLearnedOutcomesYet}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-1.5 rounded border border-emerald-500/20 bg-[#18212C] p-3">
              <div className="text-[11px] font-semibold text-emerald-300">
                {t.learnedPositiveHabits}
              </div>
              {positiveOutcomes.length === 0 ? (
                <div className="text-[11px] text-[#9FB0C3]">—</div>
              ) : (
                <div className="space-y-1.5">
                  {positiveOutcomes.slice(0, 8).map((item) => (
                    <div
                      key={`pop-pos-${item.action}`}
                      className="flex items-center justify-between rounded bg-[#121821] px-2.5 py-1.5 text-[11px]"
                    >
                      <span className="font-medium text-[#E6EDF3]">
                        {t.actions[item.action] ?? item.action}
                      </span>
                      <span className="font-mono tabular-nums text-emerald-300">
                        +{safeFixed(item.weighted_avg_reward, 3)} · {item.total_trials}{' '}
                        {t.trialsLabel} ({item.agents_count})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5 rounded border border-red-500/20 bg-[#18212C] p-3">
              <div className="text-[11px] font-semibold text-red-300">
                {t.learnedAvoidedActions}
              </div>
              {negativeOutcomes.length === 0 ? (
                <div className="text-[11px] text-[#9FB0C3]">—</div>
              ) : (
                <div className="space-y-1.5">
                  {negativeOutcomes.slice(0, 8).map((item) => (
                    <div
                      key={`pop-neg-${item.action}`}
                      className="flex items-center justify-between rounded bg-[#121821] px-2.5 py-1.5 text-[11px]"
                    >
                      <span className="font-medium text-[#E6EDF3]">
                        {t.actions[item.action] ?? item.action}
                      </span>
                      <span className="font-mono tabular-nums text-red-300">
                        {safeFixed(item.weighted_avg_reward, 3)} · {item.total_trials}{' '}
                        {t.trialsLabel} ({item.agents_count})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Trust & Distrust Network + Population Skill Mastery */}
      {lt && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Trust Network */}
          <section className="space-y-3 rounded-md border border-white/10 bg-[#121821] p-4">
            <h3 className="flex items-center gap-1.5 font-semibold text-[#57b8d8]">
              <ShieldCheck className="h-4 w-4" />
              <span>{t.trustNetworkSummaryTitle}</span>
            </h3>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded border border-white/10 bg-[#18212C] p-2">
                <div className="text-[10px] text-[#9FB0C3]">{t.trustedTiesCount}</div>
                <div className="font-mono text-sm font-bold tabular-nums text-emerald-300">
                  {lt.trust_network_summary.trusted_ties}
                </div>
              </div>
              <div className="rounded border border-white/10 bg-[#18212C] p-2">
                <div className="text-[10px] text-[#9FB0C3]">{t.distrustedTiesCount}</div>
                <div className="font-mono text-sm font-bold tabular-nums text-red-300">
                  {lt.trust_network_summary.distrusted_ties}
                </div>
              </div>
              <div className="rounded border border-white/10 bg-[#18212C] p-2">
                <div className="text-[10px] text-[#9FB0C3]">{t.avgTrustIndex}</div>
                <div className="font-mono text-sm font-bold tabular-nums text-[#E6EDF3]">
                  {safeFixed(lt.trust_network_summary.avg_trust, 3)}
                </div>
              </div>
              <div className="rounded border border-white/10 bg-[#18212C] p-2">
                <div className="text-[10px] text-[#9FB0C3]">{t.avgFamiliarityIndex}</div>
                <div className="font-mono text-sm font-bold tabular-nums text-[#57b8d8]">
                  {safeFixed(lt.trust_network_summary.avg_familiarity, 3)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 rounded border border-white/10 bg-[#18212C] p-2.5">
                <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-300">
                  <ShieldCheck className="h-3 w-3" />
                  <span>{t.mostTrustedTitle}</span>
                </div>
                {lt.trust_network_summary.top_trusted_agents.length === 0 ? (
                  <div className="text-[11px] text-[#9FB0C3]">{t.noTrustedYet}</div>
                ) : (
                  lt.trust_network_summary.top_trusted_agents.map((row) => (
                    <div
                      key={`most-tr-${row.agent_id}`}
                      className="flex items-center justify-between rounded bg-[#121821] px-2 py-1 text-[11px]"
                    >
                      {renderAgentBtn(row.agent_id, 'text-emerald-300')}
                      <span className="font-mono tabular-nums text-[#9FB0C3]">
                        +{safeFixed(row.avg_incoming_trust, 2)} ({row.incoming_trusted_count ?? 0}{' '}
                        {t.incomingTiesLabel})
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-1.5 rounded border border-white/10 bg-[#18212C] p-2.5">
                <div className="flex items-center gap-1 text-[10px] font-semibold text-red-300">
                  <ShieldAlert className="h-3 w-3" />
                  <span>{t.mostDistrustedTitle}</span>
                </div>
                {lt.trust_network_summary.top_distrusted_agents.length === 0 ? (
                  <div className="text-[11px] text-[#9FB0C3]">{t.noDistrustedYet}</div>
                ) : (
                  lt.trust_network_summary.top_distrusted_agents.map((row) => (
                    <div
                      key={`most-dis-${row.agent_id}`}
                      className="flex items-center justify-between rounded bg-[#121821] px-2 py-1 text-[11px]"
                    >
                      {renderAgentBtn(row.agent_id, 'text-red-300')}
                      <span className="font-mono tabular-nums text-[#9FB0C3]">
                        {safeFixed(row.avg_incoming_trust, 2)} (
                        {row.incoming_distrusted_count ?? 0} {t.incomingTiesLabel})
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Spatial Knowledge & Remembered Hazards */}
            <div className="space-y-1.5 rounded border border-white/10 bg-[#18212C] p-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 font-semibold text-[#F2BE49]">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>{t.spatialCoverageTitle}</span>
                </span>
                <span className="font-mono text-[10px] text-[#9FB0C3]">
                  {t.hazardsMappedTitle}:{' '}
                  <strong className="text-red-300">
                    {lt.spatial_knowledge_summary.totals_by_kind.hazard ?? 0}
                  </strong>
                </span>
              </div>
              <div className="flex flex-wrap gap-2 font-mono text-[10px] tabular-nums text-[#9FB0C3]">
                {Object.entries(lt.spatial_knowledge_summary.totals_by_kind).map(([kind, cnt]) => (
                  <span key={kind} className="rounded bg-[#121821] px-2 py-0.5">
                    {kind}: <strong className="text-[#E6EDF3]">{cnt}</strong>
                  </span>
                ))}
              </div>
              {lt.spatial_knowledge_summary.hazard_zones_sample.length > 0 && (
                <div className="grid grid-cols-1 gap-1 pt-1 sm:grid-cols-2">
                  {lt.spatial_knowledge_summary.hazard_zones_sample.slice(0, 6).map((hz, idx) => (
                    <div
                      key={`hz-zone-${idx}`}
                      className="flex items-center justify-between rounded bg-[#121821] px-2 py-1 font-mono text-[10px] tabular-nums"
                    >
                      <span className="text-red-300">{formatCoords(hz.x, hz.y)}</span>
                      <span className="text-[#9FB0C3]">
                        {hz.mentions} {t.mentionsLabel} · {safeFixed(hz.max_severity, 2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Population Skill Mastery */}
          <section className="space-y-3 rounded-md border border-white/10 bg-[#121821] p-4">
            <h3 className="flex items-center gap-1.5 font-semibold text-[#F2BE49]">
              <Award className="h-4 w-4" />
              <span>{t.skillLeaderboardTitle}</span>
            </h3>

            {lt.population_skills_summary.length === 0 ? (
              <div className="rounded border border-white/10 bg-[#18212C] p-4 text-center text-[#9FB0C3]">
                —
              </div>
            ) : (
              <div className="space-y-2">
                {lt.population_skills_summary.map((sk) => {
                  const avgPct = Math.max(0, Math.min(100, Math.round(sk.avg * 100)));
                  const maxPct = Math.max(0, Math.min(100, Math.round(sk.max * 100)));
                  return (
                    <div
                      key={sk.skill}
                      className="space-y-1 rounded border border-white/10 bg-[#18212C] p-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <span className="font-semibold text-[#E6EDF3]">
                          {t.skills[sk.skill] ?? sk.skill}
                        </span>
                        <div className="flex items-center gap-3 font-mono text-[10px] tabular-nums text-[#9FB0C3]">
                          <span>
                            {t.avgProficiency}: <strong className="text-[#F2BE49]">{avgPct}%</strong>
                          </span>
                          <span>
                            {t.peakProficiency}:{' '}
                            <strong className="text-emerald-300">{maxPct}%</strong>
                          </span>
                          <span>
                            {t.skilledAgentsCount}: {sk.trained_agents_count}
                          </span>
                          <span>
                            {t.topMasterLabel}: {renderAgentBtn(sk.top_agent_id)}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded bg-[#121821]">
                        <div className="h-full bg-[#D99B26]" style={{width: `${avgPct}%`}} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Top Trained Neural Brains Table */}
      {lt && lt.top_neural_agents.length > 0 && (
        <section className="space-y-2.5 rounded-md border border-white/10 bg-[#121821] p-4">
          <h3 className="flex items-center gap-1.5 font-semibold text-[#57b8d8]">
            <Cpu className="h-4 w-4" />
            <span>{t.nnTopBrainsTitle}</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-start font-mono text-[11px] tabular-nums">
              <thead>
                <tr className="border-b border-white/10 font-sans text-[10px] text-[#9FB0C3]">
                  <th className="py-2 pe-3 text-start">{t.trainColAgent}</th>
                  <th className="py-2 pe-3 text-start">{t.nnUpdatesCount}</th>
                  <th className="py-2 pe-3 text-start">{t.nnExpBuffer}</th>
                  <th className="py-2 pe-3 text-start">{t.nnPolicyLoss}</th>
                  <th className="py-2 pe-3 text-start">{t.nnValueLoss}</th>
                  <th className="py-2 pe-3 text-start">{t.nnEntropy}</th>
                  <th className="py-2 pe-3 text-start">{t.nnTdError}</th>
                  <th className="py-2 pe-3 text-start">{t.nnRecentReward}</th>
                  <th className="py-2 pe-3 text-start">{t.nnWeightNorm}</th>
                  <th className="py-2 pe-3 text-start">{t.nnHiddenNorm}</th>
                </tr>
              </thead>
              <tbody>
                {lt.top_neural_agents.map((row) => (
                  <tr key={row.agent_id} className="border-b border-white/5 hover:bg-[#18212C]/60">
                    <td className="py-1.5 pe-3">{renderAgentBtn(row.agent_id)}</td>
                    <td className="py-1.5 pe-3 text-[#F2BE49]">
                      {row.total_updates.toLocaleString()}
                    </td>
                    <td className="py-1.5 pe-3 text-[#9FB0C3]">
                      {row.experience_buffer_len}/{row.experience_buffer_capacity}
                    </td>
                    <td className="py-1.5 pe-3">{safeFixed(row.last_loss, 4)}</td>
                    <td className="py-1.5 pe-3">{safeFixed(row.value_loss, 4)}</td>
                    <td className="py-1.5 pe-3">{safeFixed(row.policy_entropy, 3)}</td>
                    <td className="py-1.5 pe-3 text-[#57b8d8]">{safeFixed(row.mean_td_error, 4)}</td>
                    <td
                      className={`py-1.5 pe-3 ${
                        row.mean_recent_reward >= 0 ? 'text-emerald-300' : 'text-red-300'
                      }`}
                    >
                      {row.mean_recent_reward >= 0 ? '+' : ''}
                      {safeFixed(row.mean_recent_reward, 3)}
                    </td>
                    <td className="py-1.5 pe-3">{safeFixed(row.weight_l2_norm, 3)}</td>
                    <td className="py-1.5 pe-3 text-emerald-300">
                      {safeFixed(row.hidden_state_l2_norm, 3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Discovery Counters Bar Comparison */}
      <section className="rounded-md border border-white/10 bg-[#121821] p-4">
        <div className="mb-2 flex items-center gap-1.5 font-semibold text-[#E6EDF3]">
          <GitBranch className="h-4 w-4 text-emerald-400" />
          <span>{t.learnTitle}</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-[#9FB0C3]">{t.foodDiscoverReach}</span>
              <span className="font-mono text-[#F2BE49]">
                {learn.food_reach_events} / {Math.max(1, learn.food_discovery_events)} (
                {safeFixed(
                  (learn.food_reach_events / Math.max(1, learn.food_discovery_events)) * 100,
                  1,
                )}
                %)
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded bg-[#18212C]">
              <div
                className="h-full bg-[#D99B26]"
                style={{
                  width: `${Math.min(
                    100,
                    (learn.food_reach_events / Math.max(1, learn.food_discovery_events)) * 100,
                  )}%`,
                }}
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-[#9FB0C3]">{t.waterDiscoverReach}</span>
              <span className="font-mono text-[#57b8d8]">
                {learn.water_reach_events} / {Math.max(1, learn.water_discovery_events)} (
                {safeFixed(
                  (learn.water_reach_events / Math.max(1, learn.water_discovery_events)) * 100,
                  1,
                )}
                %)
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded bg-[#18212C]">
              <div
                className="h-full bg-[#3B82A6]"
                style={{
                  width: `${Math.min(
                    100,
                    (learn.water_reach_events / Math.max(1, learn.water_discovery_events)) * 100,
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

