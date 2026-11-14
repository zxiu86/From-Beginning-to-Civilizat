"""Society, Economy, Governance, Crime & Justice Engines — strictly non-forced emergence."""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Set, Tuple


@dataclass
class SocialGroup:
    group_id: int
    founder_id: int
    founded_tick: int
    member_ids: List[int] = field(default_factory=list)
    norms: List[str] = field(default_factory=list)  # e.g. "no_theft", "share_food", "no_murder", "electoral_renewal"
    governance_type: str = "informal"  # informal, elder_council, single_leader, elective_assembly
    leader_id: Optional[int] = None
    election_adopted_tick: Optional[int] = None
    next_election_tick: Optional[int] = None
    last_election_tick: Optional[int] = None
    sanction_count: int = 0
    resolved_disputes: int = 0
    active: bool = True

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "SocialGroup":
        return cls(**d)


@dataclass
class CrimeRecord:
    crime_id: int
    tick: int
    sim_date: str
    crime_type: str  # "murder", "assault", "theft", "deception"
    perpetrator_id: int
    victim_id: int
    x: float
    y: float
    witness_ids: List[int]
    known_to_society: bool
    resolved: bool = False
    resolution_type: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "CrimeRecord":
        return cls(**d)


class SocietyEngine:
    """
    Manages emergent groups, alliances, barter/trade, norms, governance, optional 10-year
    elections (ONLY if invented), and unblocked crime + conflict resolution metrics.
    """

    def __init__(self, election_cycle_ticks: int = 3600) -> None:
        self.election_cycle_ticks = election_cycle_ticks
        self.groups: Dict[int, SocialGroup] = {}
        self.next_group_id: int = 1
        self.crimes: List[CrimeRecord] = []
        self.next_crime_id: int = 1

        # Cumulative counters (preserved across pruning)
        self.total_crimes: int = 0
        self.crimes_by_type: Dict[str, int] = {
            "murder": 0,
            "assault": 0,
            "theft": 0,
            "deception": 0,
        }
        self.repeat_offenders: Dict[int, int] = {}
        self.disputes_resolved: int = 0
        self.total_barters: int = 0
        self.emergent_markets: int = 0
        self.exchange_hubs: Dict[Tuple[int, int], int] = {}  # (coarse_x, coarse_y) -> trade_count

        # Milestone ticks
        self.first_alliance_tick: Optional[int] = None
        self.first_conflict_tick: Optional[int] = None
        self.first_crime_tick: Optional[int] = None
        self.last_crime_tick: Optional[int] = None
        self.first_barter_tick: Optional[int] = None
        self.first_market_tick: Optional[int] = None
        self.first_norm_tick: Optional[int] = None
        self.first_governance_tick: Optional[int] = None
        self.first_currency_exchange_tick: Optional[int] = None
        self.collapsed_institutions_count: int = 0

    def record_crime(
        self,
        tick: int,
        sim_date: str,
        crime_type: str,
        perpetrator_id: int,
        victim_id: int,
        x: float,
        y: float,
        witness_ids: List[int],
    ) -> Tuple[CrimeRecord, List[dict]]:
        events: List[dict] = []
        known = len(witness_ids) > 0
        rec = CrimeRecord(
            crime_id=self.next_crime_id,
            tick=tick,
            sim_date=sim_date,
            crime_type=crime_type,
            perpetrator_id=perpetrator_id,
            victim_id=victim_id,
            x=round(x, 2),
            y=round(y, 2),
            witness_ids=list(witness_ids),
            known_to_society=known,
        )
        self.next_crime_id += 1
        self.crimes.append(rec)
        if len(self.crimes) > 3000:
            self.crimes = self.crimes[-3000:]

        self.total_crimes += 1
        self.crimes_by_type[crime_type] = self.crimes_by_type.get(crime_type, 0) + 1
        self.repeat_offenders[perpetrator_id] = self.repeat_offenders.get(perpetrator_id, 0) + 1
        self.last_crime_tick = tick

        if self.first_crime_tick is None:
            self.first_crime_tick = tick
            events.append({
                "event_type": "first_crime",
                "agent_ids": [perpetrator_id, victim_id],
                "x": x,
                "y": y,
                "description": f"First recorded crime ({crime_type}) by agent {perpetrator_id} against {victim_id}.",
            })
        if self.first_conflict_tick is None and crime_type in ("assault", "murder"):
            self.first_conflict_tick = tick
            events.append({
                "event_type": "first_conflict",
                "agent_ids": [perpetrator_id, victim_id],
                "x": x,
                "y": y,
                "description": f"First violent conflict ({crime_type}) between {perpetrator_id} and {victim_id}.",
            })
        return rec, events

    def record_barter(
        self,
        tick: int,
        agent_a: int,
        agent_b: int,
        x: float,
        y: float,
        used_token: bool = False,
    ) -> List[dict]:
        events: List[dict] = []
        self.total_barters += 1
        if self.first_barter_tick is None:
            self.first_barter_tick = tick
            events.append({
                "event_type": "first_resource_exchange",
                "agent_ids": [agent_a, agent_b],
                "x": x,
                "y": y,
                "description": f"First voluntary resource exchange between {agent_a} and {agent_b}.",
            })
        if used_token and self.first_currency_exchange_tick is None:
            self.first_currency_exchange_tick = tick
            events.append({
                "event_type": "emergent_exchange_token",
                "agent_ids": [agent_a, agent_b],
                "x": x,
                "y": y,
                "description": f"Agents {agent_a} and {agent_b} exchanged durable stone/craft tokens for food.",
            })

        hub = (int(x // 125.0), int(y // 125.0))
        self.exchange_hubs[hub] = self.exchange_hubs.get(hub, 0) + 1
        if self.exchange_hubs[hub] == 12:
            self.emergent_markets += 1
            if self.first_market_tick is None:
                self.first_market_tick = tick
                events.append({
                    "event_type": "emergent_market",
                    "agent_ids": [agent_a, agent_b],
                    "x": x,
                    "y": y,
                    "description": f"Repeated gathering & exchange formed an emergent market hub near ({int(x)}, {int(y)}).",
                })
        return events

    def maybe_form_or_evolve_group(
        self,
        tick: int,
        proposer_id: int,
        proposer_x: float,
        proposer_y: float,
        proposer_mediation_skill: float,
        allied_nearby_ids: List[int],
        rng: random.Random,
    ) -> List[dict]:
        """Allow agents to organically form alliances, adopt norms, or invent governance if conditions align."""
        events: List[dict] = []
        existing = self.get_agent_group(proposer_id)

        if existing is None and len(allied_nearby_ids) >= 2:
            gid = self.next_group_id
            self.next_group_id += 1
            members = [proposer_id] + allied_nearby_ids[:5]
            grp = SocialGroup(
                group_id=gid,
                founder_id=proposer_id,
                founded_tick=tick,
                member_ids=members,
            )
            self.groups[gid] = grp
            if self.first_alliance_tick is None:
                self.first_alliance_tick = tick
                events.append({
                    "event_type": "first_alliance",
                    "agent_ids": members,
                    "x": proposer_x,
                    "y": proposer_y,
                    "description": f"First social alliance (Group #{gid}) formed by {len(members)} trusting agents.",
                })
            return events

        if existing is not None and len(existing.member_ids) >= 3:
            # Organic norm emergence after conflict or mediation practice
            candidate_norms = ["no_theft", "no_murder", "share_surplus", "electoral_renewal"]
            unadopted = [n for n in candidate_norms if n not in existing.norms]
            if unadopted and rng.random() < (0.04 + 0.15 * proposer_mediation_skill):
                # Only allow electoral_renewal if basic norms/governance already exist
                if unadopted[0] == "electoral_renewal" and len(existing.norms) < 2:
                    return events
                new_norm = unadopted[0]
                existing.norms.append(new_norm)
                if self.first_norm_tick is None:
                    self.first_norm_tick = tick
                    events.append({
                        "event_type": "first_norm_or_law",
                        "agent_ids": list(existing.member_ids),
                        "x": proposer_x,
                        "y": proposer_y,
                        "description": f"Group #{existing.group_id} adopted social rule '{new_norm}'.",
                    })
                if existing.governance_type == "informal" and len(existing.norms) >= 2:
                    existing.governance_type = rng.choice(["elder_council", "single_leader"])
                    existing.leader_id = proposer_id
                    if self.first_governance_tick is None:
                        self.first_governance_tick = tick
                        events.append({
                            "event_type": "first_governance_emerged",
                            "agent_ids": list(existing.member_ids),
                            "x": proposer_x,
                            "y": proposer_y,
                            "description": f"Group #{existing.group_id} developed {existing.governance_type} leadership.",
                        })
                if new_norm == "electoral_renewal":
                    existing.governance_type = "elective_assembly"
                    existing.election_adopted_tick = tick
                    existing.next_election_tick = tick + self.election_cycle_ticks
                    events.append({
                        "event_type": "electoral_system_invented",
                        "agent_ids": list(existing.member_ids),
                        "x": proposer_x,
                        "y": proposer_y,
                        "description": f"Group #{existing.group_id} invented a 10-year electoral leadership cycle.",
                    })
        return events

    def resolve_dispute_in_group(
        self,
        tick: int,
        mediator_id: int,
        x: float,
        y: float,
    ) -> Optional[dict]:
        """Mediate a known unresolved crime among group/nearby members."""
        grp = self.get_agent_group(mediator_id)
        for c in reversed(self.crimes[-100:]):
            if c.known_to_society and not c.resolved:
                if grp is not None and (c.perpetrator_id in grp.member_ids or c.victim_id in grp.member_ids):
                    c.resolved = True
                    c.resolution_type = "group_mediation_sanction"
                    grp.resolved_disputes += 1
                    grp.sanction_count += 1
                    self.disputes_resolved += 1
                    return {
                        "event_type": "dispute_resolved",
                        "agent_ids": [mediator_id, c.perpetrator_id, c.victim_id],
                        "x": x,
                        "y": y,
                        "description": f"Dispute over {c.crime_type} (#{c.crime_id}) mediated by agent {mediator_id}.",
                    }
        return None

    def step_institutions(
        self,
        tick: int,
        living_agents: dict,
        rng: random.Random,
    ) -> List[dict]:
        """Maintain group membership, run voluntary 10-year elections if invented, and allow collapse."""
        events: List[dict] = []
        for grp in list(self.groups.values()):
            if not grp.active:
                continue
            grp.member_ids = [mid for mid in grp.member_ids if mid in living_agents and living_agents[mid].is_alive]
            if len(grp.member_ids) < 2:
                grp.active = False
                self.collapsed_institutions_count += 1
                events.append({
                    "event_type": "institution_collapsed",
                    "agent_ids": list(grp.member_ids),
                    "x": 0.0,
                    "y": 0.0,
                    "description": f"Group #{grp.group_id} ({grp.governance_type}) collapsed due to population loss.",
                })
                continue

            if grp.leader_id is not None and grp.leader_id not in grp.member_ids:
                # Leader died or left
                grp.leader_id = grp.member_ids[0]

            # 10-year election cycle ONLY if society adopted electoral_renewal
            if (
                grp.governance_type == "elective_assembly"
                and grp.next_election_tick is not None
                and tick >= grp.next_election_tick
            ):
                # Members vote based on trust impressions toward candidates inside their group
                votes: Dict[int, int] = {m: 0 for m in grp.member_ids}
                for voter_id in grp.member_ids:
                    voter = living_agents[voter_id]
                    if voter.age_years < 14.0:
                        continue  # Community norm: mature participants vote
                    best_cand = max(
                        grp.member_ids,
                        key=lambda cid: voter.memory.trust.get(cid, 0.0) + voter.memory.familiarity.get(cid, 0.0) * 0.3,
                    )
                    votes[best_cand] = votes.get(best_cand, 0) + 1
                winner = max(votes, key=lambda cid: (votes[cid], -cid))
                grp.leader_id = winner
                grp.last_election_tick = tick
                grp.next_election_tick = tick + self.election_cycle_ticks
                events.append({
                    "event_type": "community_election_held",
                    "agent_ids": list(grp.member_ids),
                    "x": living_agents[winner].x,
                    "y": living_agents[winner].y,
                    "description": f"Group #{grp.group_id} held 10-year renewal vote; agent {winner} selected.",
                })

        return events

    def get_agent_group(self, agent_id: int) -> Optional[SocialGroup]:
        for grp in self.groups.values():
            if grp.active and agent_id in grp.member_ids:
                return grp
        return None

    def crime_and_stability_metrics(self, tick: int, living_agents: dict) -> dict:
        pop = max(0, len(living_agents))
        scale = (1000.0 / pop) if pop > 0 else 0.0
        recidivists = sum(1 for cnt in self.repeat_offenders.values() if cnt >= 2)
        known_crimes = sum(1 for c in self.crimes if c.known_to_society)
        resolved_ratio = (self.disputes_resolved / max(1, self.total_crimes)) if self.total_crimes > 0 else 0.0

        # Social trust index across living pairs
        trust_vals: List[float] = []
        for ag in living_agents.values():
            if ag.is_alive and ag.memory.trust:
                trust_vals.extend(ag.memory.trust.values())
        avg_trust = (sum(trust_vals) / len(trust_vals)) if trust_vals else 0.0

        ticks_since_crime = (tick - self.last_crime_tick) if self.last_crime_tick is not None else None
        # Do not mistake tiny short runs (< 90 sim days or < 20 people) for genuine stability!
        sufficient_window = tick >= 90 and pop >= 20
        recent_crimes = sum(1 for c in self.crimes if (tick - c.tick) <= 180)
        recent_rate_per_1k = recent_crimes * scale

        if not sufficient_window:
            stability_index = None  # Insufficient observation window
        else:
            crime_drag = min(1.0, recent_rate_per_1k / 150.0)
            stability_index = round(
                max(0.0, min(1.0, 0.5 * (1.0 - crime_drag) + 0.3 * ((avg_trust + 1.0) / 2.0) + 0.2 * resolved_ratio)),
                4,
            )

        return {
            "total_crimes": self.total_crimes,
            "crimes_by_type": dict(self.crimes_by_type),
            "crimes_per_1000_pop": round(self.total_crimes * scale, 2),
            "recent_180d_crimes_per_1000": round(recent_rate_per_1k, 2),
            "murder_rate_per_1000": round(self.crimes_by_type.get("murder", 0) * scale, 2),
            "assault_rate_per_1000": round(self.crimes_by_type.get("assault", 0) * scale, 2),
            "theft_rate_per_1000": round(self.crimes_by_type.get("theft", 0) * scale, 2),
            "repeat_offenders_count": recidivists,
            "known_crimes_sample": known_crimes,
            "disputes_resolved": self.disputes_resolved,
            "dispute_resolution_rate": round(resolved_ratio, 4),
            "social_trust_index": round(avg_trust, 4),
            "stability_index": stability_index,
            "sufficient_observation_window": sufficient_window,
            "last_crime_tick": self.last_crime_tick,
            "ticks_since_last_crime": ticks_since_crime,
            "active_groups": sum(1 for g in self.groups.values() if g.active),
            "total_barters": self.total_barters,
            "emergent_markets": self.emergent_markets,
            "collapsed_institutions": self.collapsed_institutions_count,
        }

    def to_snapshot(self) -> dict:
        return {
            "election_cycle_ticks": self.election_cycle_ticks,
            "groups": [g.to_dict() for g in self.groups.values()],
            "next_group_id": self.next_group_id,
            "crimes": [c.to_dict() for c in self.crimes],
            "next_crime_id": self.next_crime_id,
            "total_crimes": self.total_crimes,
            "crimes_by_type": self.crimes_by_type,
            "repeat_offenders": {str(k): v for k, v in self.repeat_offenders.items()},
            "disputes_resolved": self.disputes_resolved,
            "total_barters": self.total_barters,
            "emergent_markets": self.emergent_markets,
            "exchange_hubs": {f"{k[0]},{k[1]}": v for k, v in self.exchange_hubs.items()},
            "first_alliance_tick": self.first_alliance_tick,
            "first_conflict_tick": self.first_conflict_tick,
            "first_crime_tick": self.first_crime_tick,
            "last_crime_tick": self.last_crime_tick,
            "first_barter_tick": self.first_barter_tick,
            "first_market_tick": self.first_market_tick,
            "first_norm_tick": self.first_norm_tick,
            "first_governance_tick": self.first_governance_tick,
            "first_currency_exchange_tick": self.first_currency_exchange_tick,
            "collapsed_institutions_count": self.collapsed_institutions_count,
        }

    @classmethod
    def from_snapshot(cls, data: dict) -> "SocietyEngine":
        eng = cls(election_cycle_ticks=int(data.get("election_cycle_ticks", 3600)))
        eng.groups = {int(g["group_id"]): SocialGroup.from_dict(g) for g in data.get("groups", [])}
        eng.next_group_id = int(data.get("next_group_id", 1))
        eng.crimes = [CrimeRecord.from_dict(c) for c in data.get("crimes", [])]
        eng.next_crime_id = int(data.get("next_crime_id", 1))
        eng.total_crimes = int(data.get("total_crimes", 0))
        eng.crimes_by_type = dict(data.get("crimes_by_type", {"murder": 0, "assault": 0, "theft": 0, "deception": 0}))
        eng.repeat_offenders = {int(k): int(v) for k, v in data.get("repeat_offenders", {}).items()}
        eng.disputes_resolved = int(data.get("disputes_resolved", 0))
        eng.total_barters = int(data.get("total_barters", 0))
        eng.emergent_markets = int(data.get("emergent_markets", 0))
        for k, v in data.get("exchange_hubs", {}).items():
            x_s, y_s = k.split(",", 1)
            eng.exchange_hubs[(int(x_s), int(y_s))] = int(v)
        eng.first_alliance_tick = data.get("first_alliance_tick")
        eng.first_conflict_tick = data.get("first_conflict_tick")
        eng.first_crime_tick = data.get("first_crime_tick")
        eng.last_crime_tick = data.get("last_crime_tick")
        eng.first_barter_tick = data.get("first_barter_tick")
        eng.first_market_tick = data.get("first_market_tick")
        eng.first_norm_tick = data.get("first_norm_tick")
        eng.first_governance_tick = data.get("first_governance_tick")
        eng.first_currency_exchange_tick = data.get("first_currency_exchange_tick")
        eng.collapsed_institutions_count = int(data.get("collapsed_institutions_count", 0))
        return eng
