'use client';

import React, {useMemo, useState} from 'react';
import {Bug, Check, Copy, Download, Trash2, X} from 'lucide-react';
import {
  buildDiagnosticReport,
  clearDiagnostics,
  getDiagnosticEntries,
  safeFixed,
} from '@/lib/observatory/diagnostics';
import type {Translations} from '@/lib/observatory/i18n';
import type {ObservatorySnapshot, SnapshotSourceMode} from '@/lib/observatory/types';

interface DiagnosticsModalProps {
  t: Translations;
  open: boolean;
  snapshot: ObservatorySnapshot | null;
  sourceMode: SnapshotSourceMode;
  onClose: () => void;
}

export default function DiagnosticsModal({
  t,
  open,
  snapshot,
  sourceMode,
  onClose,
}: DiagnosticsModalProps) {
  const [copied, setCopied] = useState(false);
  const [clearTick, setClearTick] = useState(0);

  const entries = useMemo(() => {
    void clearTick;
    return open ? getDiagnosticEntries() : [];
  }, [open, clearTick]);

  const report = useMemo(() => {
    void clearTick;
    return open ? buildDiagnosticReport(snapshot, sourceMode) : {};
  }, [open, snapshot, sourceMode, clearTick]);

  if (!open) return null;

  const reportJson = JSON.stringify(report, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reportJson);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked in sandbox
    }
  };

  const handleDownload = () => {
    const blob = new Blob([reportJson], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `observatory_diagnostics_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const lt = snapshot?.learning_telemetry;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-md border border-white/15 bg-[#121821] text-xs text-[#E6EDF3] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <Bug className="h-4 w-4 text-[#D99B26]" />
            <h2 className="text-sm font-bold">{t.diagTitle}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[#9FB0C3] hover:bg-white/10 hover:text-[#E6EDF3]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {/* Runtime & Schema Status */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded border border-white/10 bg-[#18212C] p-2.5">
              <div className="text-[10px] text-[#9FB0C3]">{t.diagModeLabel}</div>
              <div className="mt-0.5 font-mono font-semibold text-[#57b8d8]">
                {snapshot?.simulation_phase === 'training' ? t.phaseTraining : t.phaseCivilization}
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-[#9FB0C3]">source: {sourceMode}</div>
            </div>

            <div className="rounded border border-white/10 bg-[#18212C] p-2.5">
              <div className="text-[10px] text-[#9FB0C3]">{t.diagCycleLabel}</div>
              <div className="mt-0.5 font-mono font-semibold text-[#E6EDF3]">
                {snapshot?.recovery_state
                  ? `#${snapshot.recovery_state.current_cycle_number} (${snapshot.recovery_state.recovery_cycle_count} recoveries)`
                  : 'Cycle #1'}
              </div>
            </div>

            <div className="rounded border border-white/10 bg-[#18212C] p-2.5">
              <div className="text-[10px] text-[#9FB0C3]">{t.diagSchemaLabel}</div>
              <div className="mt-0.5 font-mono font-semibold text-[#E6EDF3]">
                {snapshot ? `${snapshot.export_schema_version} · T${snapshot.clock.tick}` : 'No snapshot'}
              </div>
              {snapshot && (
                <div className="mt-0.5 font-mono text-[10px] text-[#9FB0C3]">
                  engineAnalytics={String(snapshot.analytics.available_from_engine)} · training={String(Boolean(snapshot.training_analytics))}
                </div>
              )}
            </div>
          </div>

          {/* Learning Telemetry Quick Check */}
          {lt && (
            <div className="rounded border border-white/10 bg-[#18212C] p-3">
              <div className="mb-1.5 font-semibold text-[#F2BE49]">{t.learningSectionTitle}</div>
              <div className="grid grid-cols-2 gap-2 font-mono text-[11px] tabular-nums sm:grid-cols-4">
                <div>
                  <span className="text-[#9FB0C3]">{t.learningUpdates}: </span>
                  {safeFixed(lt.avg_updates_per_agent, 1)}
                </div>
                <div>
                  <span className="text-[#9FB0C3]">{t.learningTdError}: </span>
                  {safeFixed(lt.mean_td_error, 3)}
                </div>
                <div>
                  <span className="text-[#9FB0C3]">{t.learningEntropy}: </span>
                  {safeFixed(lt.mean_policy_entropy, 3)}
                </div>
                <div>
                  <span className="text-[#9FB0C3]">{t.learningLoss}: </span>
                  {safeFixed(lt.mean_loss, 4)}
                </div>
              </div>
            </div>
          )}

          {/* Client Runtime Error Log */}
          <div className="rounded border border-white/10 bg-[#18212C] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-semibold">
                {t.diagErrorLogLabel} ({entries.length})
              </span>
              {entries.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    clearDiagnostics();
                    setClearTick((n) => n + 1);
                  }}
                  className="flex items-center gap-1 rounded border border-white/10 bg-[#121821] px-2 py-1 text-[10px] text-[#9FB0C3] hover:text-[#E6EDF3]"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>{t.diagClearBtn}</span>
                </button>
              )}
            </div>
            {entries.length === 0 ? (
              <div className="rounded bg-[#121821] p-3 text-center text-[11px] text-emerald-300">
                {t.diagNoErrors}
              </div>
            ) : (
              <div className="max-h-56 space-y-2 overflow-y-auto">
                {[...entries].reverse().map((ent) => (
                  <div
                    key={ent.id}
                    className="rounded border border-red-500/30 bg-[#121821] p-2 font-mono text-[10px]"
                  >
                    <div className="flex justify-between text-[#F2BE49]">
                      <span>{ent.source}</span>
                      <span className="text-[#9FB0C3]">{ent.timestamp}</span>
                    </div>
                    <div className="mt-1 text-red-300">{ent.message}</div>
                    {ent.detail && <div className="mt-0.5 text-[#9FB0C3]">{ent.detail}</div>}
                    {ent.stack && (
                      <pre className="mt-1 max-h-20 overflow-auto text-[9px] text-[#9FB0C3]/80">
                        {ent.stack}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-4 py-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="flex items-center gap-1.5 rounded border border-white/15 bg-[#18212C] px-3 py-1.5 font-medium text-[#E6EDF3] hover:border-[#D99B26]/60"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? t.diagCopied : t.diagCopyBtn}</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 rounded border border-white/15 bg-[#18212C] px-3 py-1.5 font-medium text-[#E6EDF3] hover:border-[#D99B26]/60"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{t.diagDownloadBtn}</span>
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-[#D99B26] px-4 py-1.5 font-semibold text-[#0B0F14] hover:bg-[#F2BE49]"
          >
            {t.impCloseBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
