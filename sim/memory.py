"""Private Individual Memory Engine — strictly non-shared across individuals or death."""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Tuple


@dataclass
class EpisodicRecord:
    tick: int
    event_kind: str  # resource_found, danger, attack_suffered, aid_received, signal_learned, birth, death_witnessed
    x: float
    y: float
    other_agent_id: Optional[int]
    valence: float  # -1.0 (pain/threat) to +1.0 (reward/safety)
    detail: str


@dataclass
class SpatialTrace:
    cell_idx: int
    x: float
    y: float
    kind: str  # "water", "food", "wood", "stone", "herb", "hazard"
    last_seen_tick: int
    richness: float


class MemoryEngine:
    """
    Personal episodic, spatial, and social memory for a single individual.
    Newborns start with empty personal memories; dead agents' memories are never copied.
    """

    def __init__(self, max_episodic: int = 80, max_spatial: int = 40) -> None:
        self.max_episodic = max_episodic
        self.max_spatial = max_spatial
        self.episodic: List[EpisodicRecord] = []
        self.spatial_map: Dict[Tuple[int, str], SpatialTrace] = {}
        # Personal familiarity (0..1) and interpersonal trust (-1..+1) per known agent_id
        self.familiarity: Dict[int, float] = {}
        self.trust: Dict[int, float] = {}
        # Personal learned skill proficiencies (0..1) acquired via practice or social observation/teaching
        self.skills: Dict[str, float] = {
            "foraging": 0.10,
            "tool_shaping": 0.0,
            "shelter_building": 0.0,
            "cultivation": 0.0,
            "healing": 0.0,
            "symbol_marking": 0.0,
            "mediation": 0.0,
        }

    def record_episode(
        self,
        tick: int,
        event_kind: str,
        x: float,
        y: float,
        other_agent_id: Optional[int],
        valence: float,
        detail: str = "",
    ) -> None:
        self.episodic.append(
            EpisodicRecord(
                tick=tick,
                event_kind=event_kind,
                x=round(x, 2),
                y=round(y, 2),
                other_agent_id=other_agent_id,
                valence=max(-1.0, min(1.0, round(valence, 4))),
                detail=detail,
            )
        )
        if len(self.episodic) > self.max_episodic:
            # Retain emotionally salient memories longer than neutral ones
            self.episodic.sort(key=lambda e: (abs(e.valence) * 0.4 + (e.tick / max(1, tick)) * 0.6))
            self.episodic = self.episodic[-self.max_episodic:]

    def remember_location(self, tick: int, cell_idx: int, x: float, y: float, kind: str, richness: float) -> None:
        key = (cell_idx, kind)
        self.spatial_map[key] = SpatialTrace(
            cell_idx=cell_idx,
            x=round(x, 2),
            y=round(y, 2),
            kind=kind,
            last_seen_tick=tick,
            richness=round(richness, 3),
        )
        if len(self.spatial_map) > self.max_spatial:
            oldest_key = min(self.spatial_map, key=lambda k: self.spatial_map[k].last_seen_tick)
            del self.spatial_map[oldest_key]

    def recall_nearest(self, x: float, y: float, kind: str) -> Optional[SpatialTrace]:
        candidates = [tr for tr in self.spatial_map.values() if tr.kind == kind and tr.richness > 0.05]
        if not candidates:
            return None
        return min(candidates, key=lambda tr: (tr.x - x) ** 2 + (tr.y - y) ** 2)

    def forget_depleted_near(self, x: float, y: float, kind: str, radius_m: float = 45.0) -> None:
        r2 = radius_m * radius_m
        stale = [
            k for k, tr in self.spatial_map.items()
            if tr.kind == kind and ((tr.x - x) ** 2 + (tr.y - y) ** 2) <= r2
        ]
        for k in stale:
            del self.spatial_map[k]

    def update_social(self, other_id: int, fam_delta: float, trust_delta: float) -> None:
        f = self.familiarity.get(other_id, 0.0) + fam_delta
        t = self.trust.get(other_id, 0.0) + trust_delta
        self.familiarity[other_id] = round(max(0.0, min(1.0, f)), 4)
        self.trust[other_id] = round(max(-1.0, min(1.0, t)), 4)

    def practice_skill(self, skill_name: str, amount: float) -> None:
        cur = self.skills.get(skill_name, 0.0)
        self.skills[skill_name] = round(max(0.0, min(1.0, cur + amount * (1.0 - 0.5 * cur))), 4)

    def to_dict(self) -> dict:
        return {
            "episodic": [asdict(e) for e in self.episodic],
            "spatial_map": [asdict(s) for s in self.spatial_map.values()],
            "familiarity": {str(k): v for k, v in self.familiarity.items()},
            "trust": {str(k): v for k, v in self.trust.items()},
            "skills": dict(self.skills),
        }

    @classmethod
    def from_dict(cls, data: dict) -> "MemoryEngine":
        mem = cls()
        mem.episodic = [EpisodicRecord(**e) for e in data.get("episodic", [])]
        for s in data.get("spatial_map", []):
            tr = SpatialTrace(**s)
            mem.spatial_map[(tr.cell_idx, tr.kind)] = tr
        mem.familiarity = {int(k): float(v) for k, v in data.get("familiarity", {}).items()}
        mem.trust = {int(k): float(v) for k, v in data.get("trust", {}).items()}
        if "skills" in data:
            mem.skills.update({str(k): float(v) for k, v in data["skills"].items()})
        return mem
