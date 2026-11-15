'use client';

import React, {useRef, useState} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  GitBranch,
  RotateCcw,
  ShieldAlert,
  Upload,
  X,
} from 'lucide-react';
import type {Translations} from '@/lib/observatory/i18n';
import {
  processJsonImportBatch,
  type ImportedTimelineBundle,
  type ImportProgress,
  type MultiImportReport,
} from '@/lib/observatory/importer';

interface JsonImporterModalProps {
  t: Translations;
  open: boolean;
  canRollback: boolean;
  onClose: () => void;
  onCommitBundle: (bundle: ImportedTimelineBundle, allBundles: ImportedTimelineBundle[]) => void;
  onRollback: () => void;
}

export default function JsonImporterModal({
  t,
  open,
  canRollback,
  onClose,
  onCommitBundle,
  onRollback,
}: JsonImporterModalProps) {
  const filesInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [report, setReport] = useState<MultiImportReport | null>(null);
  const [selectedTimelineKey, setSelectedTimelineKey] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);

  if (!open) return null;

  const runBatch = async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    if (arr.length === 0) return;
    setProcessing(true);
    setProgress({stage: 'scan', processed: 0, total: arr.length});
    try {
      const res = await processJsonImportBatch(arr, (p) => setProgress(p));
      setReport(res);
      const firstValid = res.timelines.find((tl) => !tl.haltedDueToCycle) ?? res.timelines[0];
      if (firstValid) {
        setSelectedTimelineKey(`${firstValid.timelineId}::${firstValid.timelineKind}`);
      }
    } finally {
      setProcessing(false);
    }
  };

  const selectedBundle =
    report?.timelines.find(
      (tl) => `${tl.timelineId}::${tl.timelineKind}` === selectedTimelineKey,
    ) ?? null;

  const progressPct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-md border border-white/15 bg-[#121821] text-xs text-[#E6EDF3] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-[#D99B26]" />
            <h2 className="text-sm font-bold">{t.impTitle}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[#9FB0C3] hover:bg-white/10 hover:text-[#E6EDF3]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <input
            ref={filesInputRef}
            type="file"
            multiple
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void runBatch(e.target.files);
              e.target.value = '';
            }}
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            // @ts-expect-error webkitdirectory is supported by Chromium/Firefox/Safari browsers
            webkitdirectory=""
            directory=""
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void runBatch(e.target.files);
              e.target.value = '';
            }}
          />

          {/* Drop & Browse Area */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (e.dataTransfer.files?.length) {
                void runBatch(e.dataTransfer.files);
              }
            }}
            className={`rounded border border-dashed p-4 text-center transition ${
              dragActive
                ? 'border-[#F2BE49] bg-[#D99B26]/10'
                : 'border-white/20 bg-[#18212C]'
            }`}
          >
            <p className="mb-3 text-[11px] text-[#9FB0C3]">{t.emptyDropHint}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                disabled={processing}
                onClick={() => filesInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded border border-[#D99B26]/50 bg-[#D99B26]/20 px-3 py-1.5 font-semibold text-[#F2BE49] hover:bg-[#D99B26]/30 disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>{t.impSelectFiles}</span>
              </button>
              <button
                type="button"
                disabled={processing}
                onClick={() => folderInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded border border-white/15 bg-[#121821] px-3 py-1.5 font-medium text-[#E6EDF3] hover:border-[#D99B26]/50 disabled:opacity-50"
              >
                <FolderOpen className="h-3.5 w-3.5 text-[#57b8d8]" />
                <span>{t.impSelectFolder}</span>
              </button>
            </div>
          </div>

          {/* Async Progress Bar */}
          {processing && progress && (
            <div className="space-y-1.5 rounded border border-white/10 bg-[#18212C] p-3">
              <div className="flex justify-between text-[11px]">
                <span className="text-[#F2BE49]">{t.impProcessing}</span>
                <span className="font-mono tabular-nums text-[#9FB0C3]">
                  {progress.stage} · {progress.processed}/{progress.total} ({progressPct}%)
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded bg-[#121821]">
                <div
                  className="h-full bg-[#D99B26] transition-all"
                  style={{width: `${progressPct}%`}}
                />
              </div>
            </div>
          )}

          {/* Validation & Sequencing Report */}
          {report && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2.5">
                  <div className="text-[10px] text-[#9FB0C3]">{t.impAccepted}</div>
                  <div className="font-mono text-base font-bold tabular-nums text-emerald-300">
                    {report.acceptedCount} / {report.totalFiles}
                  </div>
                </div>
                <div className="rounded border border-red-500/30 bg-red-500/10 p-2.5">
                  <div className="text-[10px] text-[#9FB0C3]">{t.impQuarantined}</div>
                  <div className="font-mono text-base font-bold tabular-nums text-red-300">
                    {report.quarantinedFiles.length}
                  </div>
                </div>
                <div className="rounded border border-[#D99B26]/30 bg-[#D99B26]/10 p-2.5">
                  <div className="text-[10px] text-[#9FB0C3]">{t.impUnindexed}</div>
                  <div className="font-mono text-base font-bold tabular-nums text-[#F2BE49]">
                    {report.unindexedQueue.length}
                  </div>
                </div>
                <div className="rounded border border-white/10 bg-[#18212C] p-2.5">
                  <div className="text-[10px] text-[#9FB0C3]">{t.impWarnings}</div>
                  <div className="font-mono text-base font-bold tabular-nums text-[#E6EDF3]">
                    {report.warnings.length}
                  </div>
                </div>
              </div>

              {/* Dependency Cycles */}
              {report.cycleErrors.length > 0 && (
                <div className="space-y-1 rounded border border-red-500/40 bg-red-500/10 p-3">
                  <div className="flex items-center gap-1.5 font-semibold text-red-300">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    <span>{t.impCycles}</span>
                  </div>
                  {report.cycleErrors.map((err, idx) => (
                    <div key={idx} className="text-[11px] text-red-200">
                      {err}
                    </div>
                  ))}
                </div>
              )}

              {/* Isolated Timelines Selector */}
              {report.timelines.length > 0 && (
                <div className="space-y-2 rounded border border-white/10 bg-[#18212C] p-3">
                  <div className="flex items-center gap-1.5 font-semibold text-[#57b8d8]">
                    <GitBranch className="h-3.5 w-3.5" />
                    <span>
                      {t.tlTimelineSelector} ({report.timelines.length})
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {report.timelines.map((tl) => {
                      const key = `${tl.timelineId}::${tl.timelineKind}`;
                      const selected = key === selectedTimelineKey;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSelectedTimelineKey(key)}
                          className={`flex w-full items-center justify-between rounded border px-3 py-2 text-start transition ${
                            selected
                              ? 'border-[#D99B26] bg-[#D99B26]/15'
                              : 'border-white/10 bg-[#121821] hover:border-white/25'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 font-mono text-[11px]">
                              <span className="font-semibold text-[#F2BE49]">
                                {tl.timelineKind === 'experimental_rebirth'
                                  ? t.timelineExperimental
                                  : t.timelineOriginal}
                              </span>
                              <span className="text-[#9FB0C3]">{tl.timelineId.slice(0, 12)}</span>
                            </div>
                            <div className="text-[10px] text-[#9FB0C3]">
                              {tl.orderedFiles.length} files · ticks{' '}
                              {tl.orderedTicks.length > 0
                                ? `${tl.orderedTicks[0]} → ${tl.orderedTicks[tl.orderedTicks.length - 1]}`
                                : 'event-only'}
                            </div>
                          </div>
                          {tl.haltedDueToCycle ? (
                            <span className="font-mono text-[10px] text-red-400">HALTED (CYCLE)</span>
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Warnings / Gaps / Duplicates */}
              {report.warnings.length > 0 && (
                <div className="max-h-32 space-y-1 overflow-y-auto rounded border border-white/10 bg-[#18212C] p-3">
                  <div className="flex items-center gap-1.5 font-semibold text-[#F2BE49]">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>{t.impWarnings}</span>
                  </div>
                  {report.warnings.slice(0, 30).map((w, idx) => (
                    <div key={idx} className="text-[11px] text-[#9FB0C3]">
                      • {w}
                    </div>
                  ))}
                </div>
              )}

              {/* Quarantined Corrupt Files */}
              {report.quarantinedFiles.length > 0 && (
                <div className="max-h-32 space-y-1 overflow-y-auto rounded border border-red-500/30 bg-red-500/5 p-3">
                  <div className="font-semibold text-red-300">{t.impQuarantined}</div>
                  {report.quarantinedFiles.slice(0, 30).map((q, idx) => (
                    <div key={idx} className="font-mono text-[10px] text-red-200/90">
                      {q.relativePath}: {q.reason}
                    </div>
                  ))}
                </div>
              )}

              {/* Unindexed Manual Review Queue */}
              {report.unindexedQueue.length > 0 && (
                <div className="max-h-32 space-y-1 overflow-y-auto rounded border border-[#D99B26]/30 bg-[#D99B26]/5 p-3">
                  <div className="font-semibold text-[#F2BE49]">{t.impUnindexed}</div>
                  {report.unindexedQueue.slice(0, 30).map((u, idx) => (
                    <div key={idx} className="font-mono text-[10px] text-[#9FB0C3]">
                      {u.relativePath} — {u.reason}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-4 py-3">
          <div>
            {canRollback && (
              <button
                type="button"
                onClick={() => {
                  onRollback();
                  onClose();
                }}
                className="flex items-center gap-1.5 rounded border border-white/15 bg-[#18212C] px-3 py-1.5 text-[11px] text-[#9FB0C3] hover:border-[#D99B26]/50 hover:text-[#E6EDF3]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{t.impRollbackBtn}</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-white/15 bg-[#18212C] px-3 py-1.5 text-[11px] text-[#9FB0C3] hover:text-[#E6EDF3]"
            >
              {t.impCloseBtn}
            </button>
            {selectedBundle && !selectedBundle.haltedDueToCycle && (
              <button
                type="button"
                onClick={() => {
                  onCommitBundle(selectedBundle, report?.timelines ?? []);
                  onClose();
                }}
                className="rounded bg-[#D99B26] px-3.5 py-1.5 text-[11px] font-bold text-[#0B0F14] transition hover:bg-[#F2BE49]"
              >
                {t.impCommitBtn}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
