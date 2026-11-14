'use client';

import React from 'react';
import {Ear, Eye, LogOut, Volume2} from 'lucide-react';
import type {Translations} from '@/lib/observatory/i18n';
import type {LivingAgentFull} from '@/lib/observatory/types';

interface FpvHudProps {
  t: Translations;
  agent: LivingAgentFull;
  onExitFpv: () => void;
}

export default function FpvHud({t, agent, onExitFpv}: FpvHudProps) {
  const lp = agent.local_perception;

  return (
    <div className="pointer-events-none fixed inset-x-3 top-20 z-20 flex flex-col justify-between gap-3 md:flex-row">
      {/* Strictly Local Sensory Status */}
      <div className="pointer-events-auto max-w-sm rounded-md border border-[#3B82A6]/50 bg-[#121821]/95 p-3 text-xs text-[#E6EDF3] shadow-xl">
        <div className="mb-2 flex items-center justify-between gap-3 border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-[#57b8d8]" />
            <div>
              <div className="font-semibold">
                {t.fpvTitle} — #{agent.agent_id}
              </div>
              <div className="text-[11px] text-[#9FB0C3]">{t.fpvSubtitle}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded bg-[#18212C] px-2 py-1.5">
            <div className="text-[10px] text-[#9FB0C3]">{t.fpvVisionRadius}</div>
            <div className="font-mono font-semibold tabular-nums text-[#57b8d8]">
              {lp.vision_radius_m.toFixed(0)} m
            </div>
          </div>
          <div className="rounded bg-[#18212C] px-2 py-1.5">
            <div className="text-[10px] text-[#9FB0C3]">{t.fpvHearingRadius}</div>
            <div className="font-mono font-semibold tabular-nums text-[#D99B26]">
              {lp.hearing_radius_m.toFixed(0)} m
            </div>
          </div>
          <div className="rounded bg-[#18212C] px-2 py-1.5">
            <div className="text-[10px] text-[#9FB0C3]">{t.fpvVisibleAgents}</div>
            <div className="font-mono font-semibold tabular-nums">
              {lp.visible_agent_ids.length}
            </div>
          </div>
          <div className="rounded bg-[#18212C] px-2 py-1.5">
            <div className="text-[10px] text-[#9FB0C3]">{t.fpvVisibleFauna} / {t.fpvVisibleArtifacts}</div>
            <div className="font-mono font-semibold tabular-nums">
              {lp.visible_fauna_ids.length} / {lp.visible_artifact_ids.length}
            </div>
          </div>
        </div>

        <div className="mt-2 rounded border border-white/10 bg-[#18212C] p-2">
          <div className="mb-1 text-[10px] text-[#9FB0C3]">{t.fpvLocalResources}</div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] tabular-nums">
            <span>W: {lp.local_water.toFixed(1)}</span>
            <span>F: {lp.local_food.toFixed(1)}</span>
            <span>Wd: {lp.local_wood.toFixed(1)}</span>
            <span>St: {lp.local_stone.toFixed(1)}</span>
            <span>Hb: {lp.local_herb.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* Exit Button + Strictly Non-Telepathic Heard Signals */}
      <div className="pointer-events-auto flex max-w-sm flex-col items-end gap-2">
        <button
          type="button"
          onClick={onExitFpv}
          className="flex items-center gap-1.5 rounded border border-red-400/50 bg-[#121821]/95 px-3 py-2 text-xs font-semibold text-red-300 shadow-lg transition hover:bg-red-500/20"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>{t.exitFpv}</span>
        </button>

        <div className="w-full rounded-md border border-white/10 bg-[#121821]/95 p-3 text-xs text-[#E6EDF3] shadow-xl">
          <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-[#D99B26]">
            <Ear className="h-3.5 w-3.5" />
            <span>{t.fpvHeardSignals}</span>
          </div>
          <p className="mb-2 text-[10px] text-[#9FB0C3]">{t.fpvBlindNotice}</p>

          {lp.heard_emissions.length === 0 ? (
            <div className="text-[11px] text-[#9FB0C3]">{t.fpvNoSignals}</div>
          ) : (
            <div className="max-h-36 space-y-1 overflow-y-auto">
              {lp.heard_emissions.map((em, i) => (
                <div
                  key={`${em.speaker_id}-${em.tick}-${i}`}
                  className="flex items-center justify-between gap-2 rounded bg-[#18212C] px-2 py-1 font-mono text-[11px] tabular-nums"
                >
                  <span className="flex items-center gap-1 text-[#57b8d8]">
                    <Volume2 className="h-3 w-3" />
                    #{em.speaker_id}
                  </span>
                  <span>T-{em.token}</span>
                  <span className="text-[#9FB0C3]">G-{em.gesture}</span>
                  <span className="text-[#9FB0C3]">{em.distance_m}m</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
