'use client';

import React, {useState} from 'react';
import {AlertCircle, Beaker, FileUp, FolderOpen, Play, Terminal} from 'lucide-react';
import type {Translations} from '@/lib/observatory/i18n';

interface EmptyWorldOverlayProps {
  t: Translations;
  uploadError: string | null;
  loadingFixture: boolean;
  liveApiAvailable: boolean;
  creatingLiveWorld: boolean;
  onUploadFile: (file: File) => void;
  onUploadClick: () => void;
  onMultiImportClick: () => void;
  onLoadTestFixture: () => void;
  onStartLiveWorld: () => void;
}

export default function EmptyWorldOverlay({
  t,
  uploadError,
  loadingFixture,
  liveApiAvailable,
  creatingLiveWorld,
  onUploadFile,
  onUploadClick,
  onMultiImportClick,
  onLoadTestFixture,
  onStartLiveWorld,
}: EmptyWorldOverlayProps) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onUploadFile(file);
  };

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl items-center justify-center px-4 py-10">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`w-full rounded-md border bg-[#121821] p-6 text-[#E6EDF3] shadow-2xl transition ${
          dragging ? 'border-[#D99B26]' : 'border-white/15'
        }`}
      >
        <h2 className="text-lg font-bold tracking-tight md:text-xl">{t.emptyHeadline}</h2>
        <p className="mt-2 text-xs leading-relaxed text-[#9FB0C3] md:text-sm">{t.emptyBody}</p>

        {uploadError && (
          <div className="mt-3 flex items-start gap-2 rounded border border-red-500/40 bg-red-500/15 p-3 text-xs text-red-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-semibold">{t.uploadErrorTitle}</div>
              <div className="font-mono text-[11px]">{uploadError}</div>
            </div>
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {liveApiAvailable && (
            <button
              type="button"
              onClick={onStartLiveWorld}
              disabled={creatingLiveWorld}
              className="flex items-center justify-center gap-2 rounded border border-emerald-500/50 bg-emerald-500/20 px-4 py-2.5 text-xs font-bold text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              <span>{t.newWorldBtn}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onMultiImportClick}
            className="flex items-center justify-center gap-2 rounded border border-[#D99B26] bg-[#D99B26] px-4 py-2.5 text-xs font-bold text-[#0B0F14] transition hover:bg-[#e5a93c]"
          >
            <FolderOpen className="h-4 w-4" />
            <span>{t.multiImportBtn}</span>
          </button>

          <button
            type="button"
            onClick={onUploadClick}
            className="flex items-center justify-center gap-2 rounded border border-white/15 bg-[#18212C] px-4 py-2.5 text-xs font-medium text-[#E6EDF3] transition hover:border-[#D99B26]/60"
          >
            <FileUp className="h-4 w-4 text-[#D99B26]" />
            <span>{t.uploadSnapshotBtn}</span>
          </button>

          <button
            type="button"
            onClick={onLoadTestFixture}
            disabled={loadingFixture}
            className="flex items-center justify-center gap-2 rounded border border-white/15 bg-[#18212C] px-4 py-2.5 text-xs font-medium text-[#E6EDF3] transition hover:border-[#D99B26]/60 disabled:opacity-50"
          >
            <Beaker className="h-4 w-4 text-[#D99B26]" />
            <span>{t.loadTestFixtureBtn}</span>
          </button>
        </div>

        <p className="mt-2.5 text-center text-[11px] text-[#9FB0C3]">{t.emptyDropHint}</p>

        <div className="mt-5 rounded border border-white/10 bg-[#18212C] p-3.5 text-xs">
          <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-[#57b8d8]">
            <Terminal className="h-3.5 w-3.5" />
            <span>{t.emptyStepsTitle}</span>
          </div>
          <ul className="space-y-1 text-[11px] text-[#9FB0C3]">
            <li>{t.emptyStep1}</li>
            <li>{t.emptyStep2}</li>
            <li>{t.emptyStep3}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
