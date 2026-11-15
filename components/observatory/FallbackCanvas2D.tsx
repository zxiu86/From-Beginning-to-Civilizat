'use client';

import React, {useEffect, useRef, useState} from 'react';
import {AlertTriangle, RotateCcw} from 'lucide-react';
import type {Translations} from '@/lib/observatory/i18n';
import type {
  LivingAgentFull,
  ObservatorySnapshot,
  ReplayEventTarget,
} from '@/lib/observatory/types';

interface FallbackCanvas2DProps {
  t: Translations;
  snapshot: ObservatorySnapshot | null;
  selectedAgentId: number | null;
  fpvAgent: LivingAgentFull | null;
  replayTarget: ReplayEventTarget | null;
  reason: string;
  onSelectAgent: (agentId: number | null) => void;
  onRetryWebgl: () => void;
}

export default function FallbackCanvas2D({
  t,
  snapshot,
  selectedAgentId,
  fpvAgent,
  replayTarget,
  reason,
  onSelectAgent,
  onRetryWebgl,
}: FallbackCanvas2DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({x: 0, y: 0});
  const dragRef = useRef<{active: boolean; startX: number; startY: number; origX: number; origY: number}>({
    active: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parent = canvas.parentElement;
    const w = Math.max(320, parent?.clientWidth ?? 800);
    const h = Math.max(240, parent?.clientHeight ?? 600);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clear dark obsidian background
    ctx.fillStyle = '#0B0F14';
    ctx.fillRect(0, 0, w, h);

    if (!snapshot) {
      return;
    }

    const worldW = snapshot.world_terrain?.width_m ?? 2500;
    const worldH = snapshot.world_terrain?.height_m ?? 2000;
    const baseScale = Math.min((w - 40) / worldW, (h - 60) / worldH) * zoom;
    const drawW = worldW * baseScale;
    const drawH = worldH * baseScale;
    const offsetX = (w - drawW) * 0.5 + pan.x;
    const offsetY = (h - drawH) * 0.5 + pan.y;

    const toPxX = (sx: number) => offsetX + (sx / worldW) * drawW;
    const toPxY = (sy: number) => offsetY + (sy / worldH) * drawH;

    // 1. Terrain cells (elevation, water, fertility)
    const terrain = snapshot.world_terrain;
    if (terrain && terrain.cols > 0 && terrain.rows > 0) {
      const cellPxW = drawW / terrain.cols;
      const cellPxH = drawH / terrain.rows;
      for (let r = 0; r < terrain.rows; r++) {
        for (let c = 0; c < terrain.cols; c++) {
          const idx = r * terrain.cols + c;
          const water = terrain.water[idx] ?? 0;
          const elev = terrain.elevation[idx] ?? 20;
          const food = terrain.food_flora[idx] ?? 0;

          if (water > 0.35) {
            const depthAlpha = Math.min(0.95, 0.45 + water * 0.12);
            ctx.fillStyle = `rgba(34, 96, 138, ${depthAlpha})`;
          } else {
            const shade = Math.max(18, Math.min(64, Math.round(24 + (elev / 120) * 32)));
            const greenBoost = Math.min(26, Math.round(food * 2.4));
            ctx.fillStyle = `rgb(${shade}, ${shade + 8 + greenBoost}, ${shade - 4})`;
          }
          ctx.fillRect(
            offsetX + c * cellPxW,
            offsetY + r * cellPxH,
            cellPxW + 0.6,
            cellPxH + 0.6,
          );
        }
      }
    } else {
      ctx.fillStyle = '#141D26';
      ctx.fillRect(offsetX, offsetY, drawW, drawH);
    }

    // World border
    ctx.strokeStyle = 'rgba(217, 155, 38, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(offsetX, offsetY, drawW, drawH);

    // Bounded FPV visibility filter
    const visAgents = fpvAgent ? new Set(fpvAgent.local_perception.visible_agent_ids) : null;
    const visFauna = fpvAgent ? new Set(fpvAgent.local_perception.visible_fauna_ids) : null;

    if (fpvAgent) {
      const fx = toPxX(fpvAgent.x);
      const fy = toPxY(fpvAgent.y);
      const rPx = (fpvAgent.local_perception.vision_radius_m / worldW) * drawW;
      ctx.strokeStyle = 'rgba(87, 184, 216, 0.65)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(fx, fy, rPx, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 2. Fauna
    for (const f of snapshot.ecosystem.fauna) {
      if (visFauna && !visFauna.has(f.fauna_id)) continue;
      const px = toPxX(f.x);
      const py = toPxY(f.y);
      ctx.fillStyle = f.species === 'predator' ? '#ef4444' : '#a3e635';
      ctx.fillRect(px - 2, py - 2, 4, 4);
    }

    // 3. Deceased Markers (capped for smooth 2D draw)
    if (!fpvAgent) {
      ctx.fillStyle = 'rgba(159, 176, 195, 0.45)';
      for (const d of snapshot.deceased_agents_archive.slice(-250)) {
        const px = toPxX(d.x);
        const py = toPxY(d.y);
        ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
      }
    }

    // 4. Living Agents
    for (const ag of snapshot.living_agents_full) {
      if (fpvAgent && ag.agent_id !== fpvAgent.agent_id && !visAgents?.has(ag.agent_id)) {
        continue;
      }
      const px = toPxX(ag.x);
      const py = toPxY(ag.y);
      const isSelected = ag.agent_id === selectedAgentId;
      const radius = isSelected ? 6 : Math.max(3, Math.min(5, 2.5 + zoom * 0.6));

      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fillStyle = ag.sex === 'F' ? '#F2BE49' : '#57b8d8';
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // 5. Historical Event Replay Beacon
    if (replayTarget) {
      const rx = toPxX(replayTarget.x);
      const ry = toPxY(replayTarget.y);
      ctx.strokeStyle = '#e66353';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(rx, ry, 10, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, [snapshot, selectedAgentId, fpvAgent, replayTarget, zoom, pan]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!snapshot || fpvAgent) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const w = rect.width;
    const h = rect.height;
    const worldW = snapshot.world_terrain?.width_m ?? 2500;
    const worldH = snapshot.world_terrain?.height_m ?? 2000;
    const baseScale = Math.min((w - 40) / worldW, (h - 60) / worldH) * zoom;
    const drawW = worldW * baseScale;
    const drawH = worldH * baseScale;
    const offsetX = (w - drawW) * 0.5 + pan.x;
    const offsetY = (h - drawH) * 0.5 + pan.y;

    let bestId: number | null = null;
    let bestDist = 18;
    for (const ag of snapshot.living_agents_full) {
      const px = offsetX + (ag.x / worldW) * drawW;
      const py = offsetY + (ag.y / worldH) * drawH;
      const dist = Math.hypot(px - cx, py - cy);
      if (dist < bestDist) {
        bestDist = dist;
        bestId = ag.agent_id;
      }
    }
    if (bestId !== null) {
      onSelectAgent(bestId);
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0B0F14]">
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onWheel={(e) => {
          e.preventDefault();
          const factor = e.deltaY < 0 ? 1.15 : 0.87;
          setZoom((z) => Math.max(0.6, Math.min(8, z * factor)));
        }}
        onPointerDown={(e) => {
          dragRef.current = {
            active: true,
            startX: e.clientX,
            startY: e.clientY,
            origX: pan.x,
            origY: pan.y,
          };
        }}
        onPointerMove={(e) => {
          if (!dragRef.current.active) return;
          setPan({
            x: dragRef.current.origX + (e.clientX - dragRef.current.startX),
            y: dragRef.current.origY + (e.clientY - dragRef.current.startY),
          });
        }}
        onPointerUp={() => {
          dragRef.current.active = false;
        }}
        onPointerLeave={() => {
          dragRef.current.active = false;
        }}
        className="h-full w-full cursor-crosshair"
      />

      {/* Fallback Banner */}
      <div className="pointer-events-auto absolute top-3 start-3 z-10 flex max-w-md items-start gap-2 rounded border border-[#D99B26]/50 bg-[#121821]/95 px-3 py-2 text-xs shadow-xl">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#F2BE49]" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-[#F2BE49]">{t.fallbackBannerTitle}</div>
          <p className="mt-0.5 text-[11px] text-[#9FB0C3]">{t.fallbackBannerDesc}</p>
          {reason && (
            <div className="mt-1 truncate font-mono text-[10px] text-[#9FB0C3]/80" title={reason}>
              {reason}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onRetryWebgl}
          className="flex shrink-0 items-center gap-1 rounded border border-white/15 bg-[#18212C] px-2 py-1 text-[11px] font-medium text-[#E6EDF3] hover:border-[#D99B26]/60"
        >
          <RotateCcw className="h-3 w-3" />
          <span>{t.fallbackRetryWebgl}</span>
        </button>
      </div>
    </div>
  );
}
