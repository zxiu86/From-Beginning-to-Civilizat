'use client';

import React from 'react';
import {Brain, Compass, Cpu, GitBranch, Info, Sparkles} from 'lucide-react';
import {safeFixed} from '@/lib/observatory/formatters';
import type {Translations} from '@/lib/observatory/i18n';
import type {ObservatorySnapshot} from '@/lib/observatory/types';

interface LearningPanelProps {
  t: Translations;
  snapshot: ObservatorySnapshot;
}

export default function LearningPanel({t, snapshot}: LearningPanelProps) {
  const learn = snapshot.analytics.learning_intelligence;
  const lt = snapshot.learning_telemetry;

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
          <div className="text-[11px] text-[#9FB0C3]">{t.episodicTotal} / {t.spatialTotal}</div>
          <div className="mt-1 font-mono text-lg font-bold tabular-nums text-[#57b8d8]">
            {learn.episodic_memories_total.toLocaleString()} / {learn.spatial_memories_total.toLocaleString()}
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

      {/* Discovery vs Reach + Variance + Policy Optimization */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="space-y-3 rounded-md border border-white/10 bg-[#121821] p-4">
          <h3 className="flex items-center gap-1.5 font-semibold text-[#57b8d8]">
            <Compass className="h-4 w-4" />
            <span>{t.foodDiscoverReach} & {t.waterDiscoverReach}</span>
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
          <h3 className="flex items-center gap-1.5 font-semibold text-[#F2BE49]">
            <Cpu className="h-4 w-4" />
            <span>{t.learningSectionTitle}</span>
          </h3>

          {lt ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded border border-white/10 bg-[#18212C] p-3">
                <div className="text-[10px] text-[#9FB0C3]">{t.livingLabel}</div>
                <div className="mt-1 font-mono text-sm font-bold tabular-nums text-[#E6EDF3]">
                  {lt.agents_with_updates} / {lt.living_brains_count}
                </div>
              </div>
              <div className="rounded border border-white/10 bg-[#18212C] p-3">
                <div className="text-[10px] text-[#9FB0C3]">{t.learningUpdates}</div>
                <div className="mt-1 font-mono text-sm font-bold tabular-nums text-[#F2BE49]">
                  {safeFixed(lt.avg_updates_per_agent, 1)}
                </div>
              </div>
              <div className="rounded border border-white/10 bg-[#18212C] p-3">
                <div className="text-[10px] text-[#9FB0C3]">{t.learningTdError}</div>
                <div className="mt-1 font-mono text-sm font-bold tabular-nums text-[#57b8d8]">
                  {safeFixed(lt.mean_td_error, 3)}
                </div>
              </div>
              <div className="rounded border border-white/10 bg-[#18212C] p-3">
                <div className="text-[10px] text-[#9FB0C3]">{t.learningEntropy}</div>
                <div className="mt-1 font-mono text-sm font-bold tabular-nums text-[#E6EDF3]">
                  {safeFixed(lt.mean_policy_entropy, 3)}
                </div>
              </div>
              <div className="rounded border border-white/10 bg-[#18212C] p-3">
                <div className="text-[10px] text-[#9FB0C3]">{t.learningLoss}</div>
                <div className="mt-1 font-mono text-sm font-bold tabular-nums text-[#E6EDF3]">
                  {safeFixed(lt.mean_loss, 4)}
                </div>
              </div>
              <div className="rounded border border-white/10 bg-[#18212C] p-3">
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
