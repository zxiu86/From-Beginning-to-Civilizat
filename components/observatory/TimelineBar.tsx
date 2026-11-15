'use client';

import React from 'react';
import {
  GitBranch,
  History,
  Pause,
  Play,
  RotateCcw,
  StepForward,
} from 'lucide-react';
import type {Translations} from '@/lib/observatory/i18n';
import type {LiveTimelineSummary, ObservatorySnapshot} from '@/lib/observatory/types';

export type SimSpeed = 1 | 2 | 5 | 10 | 25 | 50;

interface TimelineBarProps {
  t: Translations;
  snapshot: ObservatorySnapshot | null;
  liveApiAvailable: boolean;
  liveTimelines: LiveTimelineSummary[];
  activeRunId: string | null;
  isPlaying: boolean;
  isStepping: boolean;
  speed: SimSpeed;
  frameTicks: number[];
  isHistoricalMode: boolean;
  historicalTick: number | null;
  onSelectRun: (runId: string) => void;
  onTogglePlay: () => void;
  onStepOnce: () => void;
  onChangeSpeed: (s: SimSpeed) => void;
  onScrubTick: (tick: number) => void;
  onReturnToLive: () => void;
  onBranchRebirth: () => void;
}

const SPEEDS: SimSpeed[] = [1, 2, 5, 10, 25, 50];

export default function TimelineBar({
  t,
  snapshot,
  liveApiAvailable,
  liveTimelines,
  activeRunId,
  isPlaying,
  isStepping,
  speed,
  frameTicks,
  isHistoricalMode,
  historicalTick,
  onSelectRun,
  onTogglePlay,
  onStepOnce,
  onChangeSpeed,
  onScrubTick,
  onReturnToLive,
  onBranchRebirth,
}: TimelineBarProps) {
  if (!snapshot) return null;

  const canBranchRebirth =
    liveApiAvailable &&
    activeRunId !== null &&
    snapshot.demographics.deceased_count > 0 &&
    !isHistoricalMode;

  const hasSavedFrames = frameTicks.length > 1;
  const activeFrameIndex =
    hasSavedFrames && historicalTick !== null
      ? Math.max(0, frameTicks.indexOf(historicalTick))
      : frameTicks.length - 1;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-16 z-20 flex justify-center px-2">
      <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2 rounded-md border border-white/15 bg-[#121821]/95 px-3 py-1.5 text-[11px] shadow-xl">
        {/* Timeline Branch Selector (Original vs Experimental Rebirth) */}
        {liveTimelines.length > 0 && (
          <div className="flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5 text-[#57b8d8]" />
            <select
              value={activeRunId ?? ''}
              onChange={(e) => onSelectRun(e.target.value)}
              className="max-w-[200px] rounded border border-white/10 bg-[#18212C] px-2 py-1 text-[11px] text-[#E6EDF3] focus:border-[#D99B26] focus:outline-none"
            >
              {liveTimelines.map((tl) => (
                <option key={tl.id} value={tl.id}>
                  {tl.timeline_kind === 'experimental_rebirth'
                    ? `${t.timelineExperimental} (${tl.id.slice(0, 10)})`
                    : `${t.timelineOriginal} (${tl.id.slice(0, 10)})`}{' '}
                  · T{tl.tick}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Historical Read-Only Scrubbing Slider (Strictly saved historical frames only) */}
        {hasSavedFrames && (
          <div className="flex items-center gap-2 border-s border-white/10 ps-2">
            <History className="h-3.5 w-3.5 text-[#D99B26]" />
            <input
              type="range"
              min={0}
              max={frameTicks.length - 1}
              step={1}
              value={activeFrameIndex}
              onChange={(e) => {
                const idx = Number.parseInt(e.target.value, 10);
                const targetTick = frameTicks[idx];
                if (typeof targetTick === 'number') onScrubTick(targetTick);
              }}
              className="h-1 w-28 accent-[#D99B26] sm:w-40"
            />
            <span className="font-mono text-[10px] tabular-nums text-[#9FB0C3]">
              {t.tickUnit} {frameTicks[activeFrameIndex] ?? snapshot.clock.tick}
            </span>
          </div>
        )}

        {isHistoricalMode ? (
          <div className="flex items-center gap-2 border-s border-white/10 ps-2">
            <span className="rounded border border-[#D99B26]/50 bg-[#D99B26]/15 px-2 py-0.5 font-medium text-[#F2BE49]">
              {t.tlHistoricalPreview}
            </span>
            <button
              type="button"
              onClick={onReturnToLive}
              className="flex items-center gap-1 rounded bg-[#D99B26] px-2 py-1 font-semibold text-[#0B0F14] hover:bg-[#F2BE49]"
            >
              <RotateCcw className="h-3 w-3" />
              <span>{t.tlReturnLive}</span>
            </button>
          </div>
        ) : (
          liveApiAvailable &&
          activeRunId && (
            <div className="flex items-center gap-1.5 border-s border-white/10 ps-2">
              <button
                type="button"
                onClick={onTogglePlay}
                className={`flex items-center gap-1 rounded px-2.5 py-1 font-semibold transition ${
                  isPlaying
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-[#D99B26] text-[#0B0F14] hover:bg-[#F2BE49]'
                }`}
              >
                {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                <span>{isPlaying ? t.tlPause : t.tlPlay}</span>
              </button>

              <button
                type="button"
                disabled={isPlaying || isStepping}
                onClick={onStepOnce}
                className="flex items-center gap-1 rounded border border-white/15 bg-[#18212C] px-2 py-1 text-[#E6EDF3] hover:border-[#D99B26]/60 disabled:opacity-45"
              >
                <StepForward className="h-3 w-3" />
                <span>{t.tlStep}</span>
              </button>

              <select
                value={speed}
                onChange={(e) => onChangeSpeed(Number(e.target.value) as SimSpeed)}
                aria-label={t.tlSpeed}
                className="rounded border border-white/10 bg-[#18212C] px-1.5 py-1 font-mono text-[11px] text-[#E6EDF3]"
              >
                {SPEEDS.map((s) => (
                  <option key={s} value={s}>
                    {s}x
                  </option>
                ))}
              </select>

              {canBranchRebirth && (
                <button
                  type="button"
                  disabled={isStepping}
                  onClick={onBranchRebirth}
                  className="flex items-center gap-1 rounded border border-[#3B82A6]/60 bg-[#3B82A6]/20 px-2.5 py-1 font-semibold text-[#57b8d8] transition hover:bg-[#3B82A6]/30 disabled:opacity-45"
                >
                  <GitBranch className="h-3 w-3" />
                  <span>{t.tlBranchRebirth}</span>
                </button>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
