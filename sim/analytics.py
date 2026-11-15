"""Real Telemetry & Analytics Engine — tracks ground-truth survival, 6-stage resource funnel, economy, social, and learning metrics."""

from __future__ import annotations

import math
import statistics
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, TYPE_CHECKING

if TYPE_CHECKING:
    from .agent import Agent, AgentEngine
    from .clock import SimulationClock
    from .communication import CommunicationEngine
    from .history import HistoryKnowledgeEngine
    from .perception import LocalPerception
    from .society import SocietyEngine
    from .world import WorldEngine


FUNNEL_STAGES = (
    "absent",
    "present_undiscovered",
    "discovered_no_decision",
    "decision_move_failed",
    "reached_consume_failed",
    "consumed_success",
)


def _empty_funnel() -> Dict[str, int]:
    return {k: 0 for k in FUNNEL_STAGES}


def categorize_death_cause(cause: Optional[str]) -> str:
    if not cause:
        return "other"
    c = cause.lower()
    if "starv" in c:
        return "starvation"
    if "dehydrat" in c:
        return "dehydration"
    if "murder" in c or "assault" in c or "attack" in c:
        return "murder"
    if "predator" in c:
        return "predator"
    if "expos" in c or "frost" in c or "heat" in c or "weather" in c:
        return "exposure"
    if "old_age" in c:
        return "old_age"
    if "disease" in c:
        return "disease"
    if "injury" in c:
        return "injury"
    if "illness" in c:
        return "disease"
    return "other"


@dataclass
class AnalyticsTracker:
    """Accumulates verified per-tick counters from real simulation execution (zero synthetic/mock values)."""

    food_funnel: Dict[str, int] = field(default_factory=_empty_funnel)
    water_funnel: Dict[str, int] = field(default_factory=_empty_funnel)

    food_consumed_total: float = 0.0
    water_consumed_total: float = 0.0
    food_produced_total: float = 0.0
    wood_gathered_total: float = 0.0
    stone_gathered_total: float = 0.0
    herb_gathered_total: float = 0.0
    tools_crafted_total: int = 0

    hunger_ticks_total: int = 0
    thirst_ticks_total: int = 0
    agents_ever_hungry: Set[int] = field(default_factory=set)
    agents_ever_thirsty: Set[int] = field(default_factory=set)

    nearby_food_reach_failures: int = 0
    nearby_water_reach_failures: int = 0

    food_discovery_events: int = 0
    food_reach_events: int = 0
    water_discovery_events: int = 0
    water_reach_events: int = 0

    cooperation_events: int = 0
    mutual_aid_events: int = 0
    teaching_events: int = 0
    knowledge_transfer_events: int = 0
    cultivation_events: int = 0

    experience_samples_recorded: int = 0
    repeated_failed_actions: int = 0
    post_negative_decision_switches: int = 0

    _prev_agent_action: Dict[int, str] = field(default_factory=dict)
    _prev_agent_reward: Dict[int, float] = field(default_factory=dict)
    _prev_food_seen: Dict[int, bool] = field(default_factory=dict)
    _prev_water_seen: Dict[int, bool] = field(default_factory=dict)
    _prev_food_local: Dict[int, bool] = field(default_factory=dict)
    _prev_water_local: Dict[int, bool] = field(default_factory=dict)

    @staticmethod
    def _has_resource_in_world_radius(
        world: "WorldEngine",
        x: float,
        y: float,
        radius_m: float,
        kind: str,
    ) -> bool:
        c0, r0 = world.cell_coords_at(x, y)
        span = max(1, min(6, int(math.ceil(radius_m / max(1.0, world.cell_size_m)))))
        for dr in range(-span, span + 1):
            rr = r0 + dr
            if 0 <= rr < world.rows:
                for dc in range(-span, span + 1):
                    cc = c0 + dc
                    if 0 <= cc < world.cols:
                        wx = (cc + 0.5) * world.cell_size_m
                        wy = (rr + 0.5) * world.cell_size_m
                        if math.hypot(wx - x, wy - y) > radius_m:
                            continue
                        idx = rr * world.cols + cc
                        if kind == "food" and world.food_flora[idx] > 0.4:
                            return True
                        if kind == "water" and world.water[idx] > 0.25:
                            return True
        return False

    @staticmethod
    def _move_alignment(action_name: str, dx: float, dy: float) -> float:
        dirs = {
            "move_north": (0.0, -1.0),
            "move_south": (0.0, 1.0),
            "move_east": (1.0, 0.0),
            "move_west": (-1.0, 0.0),
        }
        vec = dirs.get(action_name)
        if vec is None:
            return 0.0
        mag = math.hypot(dx, dy)
        if mag < 1e-6:
            return 0.0
        return (vec[0] * dx + vec[1] * dy) / mag

    def record_agent_step(
        self,
        agent: "Agent",
        perc: "LocalPerception",
        world: "WorldEngine",
        action_name: str,
        step_info: Dict[str, Any],
        reward: float,
        base_vision_radius_m: float = 120.0,
    ) -> None:
        aid = agent.agent_id
        moved_m = float(step_info.get("moved_m", 0.0))
        food_harvested = float(step_info.get("food_harvested", 0.0))
        food_consumed = float(step_info.get("food_consumed", 0.0))
        water_consumed = float(step_info.get("water_consumed", 0.0))

        self.food_consumed_total += food_consumed
        self.water_consumed_total += water_consumed
        self.food_produced_total += float(step_info.get("food_produced", 0.0))
        self.wood_gathered_total += float(step_info.get("wood_gathered", 0.0))
        self.stone_gathered_total += float(step_info.get("stone_gathered", 0.0))
        self.herb_gathered_total += float(step_info.get("herb_gathered", 0.0))
        if step_info.get("tool_crafted"):
            self.tools_crafted_total += 1
        if step_info.get("cooperation_event"):
            self.cooperation_events += 1
        if step_info.get("mutual_aid_event"):
            self.mutual_aid_events += 1
        if step_info.get("teaching_event"):
            self.teaching_events += 1
        self.knowledge_transfer_events += int(step_info.get("knowledge_transfer_events", 0))
        if step_info.get("cultivation_event"):
            self.cultivation_events += 1

        self.experience_samples_recorded += 1

        if agent.hunger >= 0.5:
            self.hunger_ticks_total += 1
            self.agents_ever_hungry.add(aid)
        if agent.thirst >= 0.5:
            self.thirst_ticks_total += 1
            self.agents_ever_thirsty.add(aid)

        # Repeated errors & post-negative decision switches
        prev_act = self._prev_agent_action.get(aid)
        prev_rew = self._prev_agent_reward.get(aid)
        if prev_act is not None and prev_rew is not None:
            if action_name == prev_act and prev_rew < -0.05 and reward < -0.05:
                self.repeated_failed_actions += 1
            if prev_rew < -0.25 and action_name != prev_act:
                self.post_negative_decision_switches += 1
        self._prev_agent_action[aid] = action_name
        self._prev_agent_reward[aid] = reward

        # Discovery & physical arrival events
        food_dx, food_dy = perc.obs_vector[18], perc.obs_vector[19]
        water_dx, water_dy = perc.obs_vector[20], perc.obs_vector[21]
        food_known = perc.local_food > 0.25 or abs(food_dx) > 0.01 or abs(food_dy) > 0.01
        water_known = perc.local_water > 0.25 or abs(water_dx) > 0.01 or abs(water_dy) > 0.01
        food_local_now = perc.local_food > 0.25
        water_local_now = perc.local_water > 0.25

        if food_known and not self._prev_food_seen.get(aid, False):
            self.food_discovery_events += 1
        if water_known and not self._prev_water_seen.get(aid, False):
            self.water_discovery_events += 1
        if food_local_now and not self._prev_food_local.get(aid, False):
            self.food_reach_events += 1
        if water_local_now and not self._prev_water_local.get(aid, False):
            self.water_reach_events += 1

        self._prev_food_seen[aid] = food_known
        self._prev_water_seen[aid] = water_known
        self._prev_food_local[aid] = food_local_now
        self._prev_water_local[aid] = water_local_now

        # 6-Stage Funnel: FOOD (evaluated whenever seeking or needing food, or actively eating/foraging)
        if agent.hunger > 0.25 or action_name in ("forage_food", "eat_inventory"):
            if food_consumed > 0.05:
                self.food_funnel["consumed_success"] += 1
            elif action_name in ("forage_food", "eat_inventory"):
                self.food_funnel["reached_consume_failed"] += 1
                if food_local_now or perc.local_food > 0.05:
                    self.nearby_food_reach_failures += 1
            elif food_local_now or agent.inventory.get("food", 0.0) >= 0.3:
                self.food_funnel["discovered_no_decision"] += 1
            elif abs(food_dx) > 0.01 or abs(food_dy) > 0.01:
                align = self._move_alignment(action_name, food_dx, food_dy)
                if align > 0.2:
                    if moved_m <= 0.2:
                        self.food_funnel["decision_move_failed"] += 1
                else:
                    self.food_funnel["discovered_no_decision"] += 1
            else:
                # Resource wasn't spotted in current sensory window; check if physically present in base horizon
                if self._has_resource_in_world_radius(world, agent.x, agent.y, base_vision_radius_m, "food"):
                    self.food_funnel["present_undiscovered"] += 1
                else:
                    self.food_funnel["absent"] += 1

        # 6-Stage Funnel: WATER (evaluated whenever thirsty or actively drinking)
        if agent.thirst > 0.25 or action_name == "drink_water" or water_consumed > 0.05:
            if water_consumed > 0.05:
                self.water_funnel["consumed_success"] += 1
            elif action_name == "drink_water":
                self.water_funnel["reached_consume_failed"] += 1
                if water_local_now or world.has_nearby_water(agent.x, agent.y, radius_m=55.0) is not None:
                    self.nearby_water_reach_failures += 1
            elif water_local_now:
                self.water_funnel["discovered_no_decision"] += 1
            elif abs(water_dx) > 0.01 or abs(water_dy) > 0.01:
                align = self._move_alignment(action_name, water_dx, water_dy)
                if align > 0.2:
                    if moved_m <= 0.2:
                        self.water_funnel["decision_move_failed"] += 1
                else:
                    self.water_funnel["discovered_no_decision"] += 1
            else:
                if self._has_resource_in_world_radius(world, agent.x, agent.y, base_vision_radius_m, "water"):
                    self.water_funnel["present_undiscovered"] += 1
                else:
                    self.water_funnel["absent"] += 1

    def to_dict(self) -> dict:
        return {
            "food_funnel": dict(self.food_funnel),
            "water_funnel": dict(self.water_funnel),
            "food_consumed_total": round(self.food_consumed_total, 4),
            "water_consumed_total": round(self.water_consumed_total, 4),
            "food_produced_total": round(self.food_produced_total, 4),
            "wood_gathered_total": round(self.wood_gathered_total, 4),
            "stone_gathered_total": round(self.stone_gathered_total, 4),
            "herb_gathered_total": round(self.herb_gathered_total, 4),
            "tools_crafted_total": self.tools_crafted_total,
            "hunger_ticks_total": self.hunger_ticks_total,
            "thirst_ticks_total": self.thirst_ticks_total,
            "agents_ever_hungry": sorted(self.agents_ever_hungry),
            "agents_ever_thirsty": sorted(self.agents_ever_thirsty),
            "nearby_food_reach_failures": self.nearby_food_reach_failures,
            "nearby_water_reach_failures": self.nearby_water_reach_failures,
            "food_discovery_events": self.food_discovery_events,
            "food_reach_events": self.food_reach_events,
            "water_discovery_events": self.water_discovery_events,
            "water_reach_events": self.water_reach_events,
            "cooperation_events": self.cooperation_events,
            "mutual_aid_events": self.mutual_aid_events,
            "teaching_events": self.teaching_events,
            "knowledge_transfer_events": self.knowledge_transfer_events,
            "cultivation_events": self.cultivation_events,
            "experience_samples_recorded": self.experience_samples_recorded,
            "repeated_failed_actions": self.repeated_failed_actions,
            "post_negative_decision_switches": self.post_negative_decision_switches,
        }

    @classmethod
    def from_dict(cls, data: Optional[dict]) -> "AnalyticsTracker":
        t = cls()
        if not data:
            return t
        ff = data.get("food_funnel", {})
        wf = data.get("water_funnel", {})
        t.food_funnel = {k: int(ff.get(k, 0)) for k in FUNNEL_STAGES}
        t.water_funnel = {k: int(wf.get(k, 0)) for k in FUNNEL_STAGES}
        t.food_consumed_total = float(data.get("food_consumed_total", 0.0))
        t.water_consumed_total = float(data.get("water_consumed_total", 0.0))
        t.food_produced_total = float(data.get("food_produced_total", 0.0))
        t.wood_gathered_total = float(data.get("wood_gathered_total", 0.0))
        t.stone_gathered_total = float(data.get("stone_gathered_total", 0.0))
        t.herb_gathered_total = float(data.get("herb_gathered_total", 0.0))
        t.tools_crafted_total = int(data.get("tools_crafted_total", 0))
        t.hunger_ticks_total = int(data.get("hunger_ticks_total", 0))
        t.thirst_ticks_total = int(data.get("thirst_ticks_total", 0))
        t.agents_ever_hungry = set(int(x) for x in data.get("agents_ever_hungry", []))
        t.agents_ever_thirsty = set(int(x) for x in data.get("agents_ever_thirsty", []))
        t.nearby_food_reach_failures = int(data.get("nearby_food_reach_failures", 0))
        t.nearby_water_reach_failures = int(data.get("nearby_water_reach_failures", 0))
        t.food_discovery_events = int(data.get("food_discovery_events", 0))
        t.food_reach_events = int(data.get("food_reach_events", 0))
        t.water_discovery_events = int(data.get("water_discovery_events", 0))
        t.water_reach_events = int(data.get("water_reach_events", 0))
        t.cooperation_events = int(data.get("cooperation_events", 0))
        t.mutual_aid_events = int(data.get("mutual_aid_events", 0))
        t.teaching_events = int(data.get("teaching_events", 0))
        t.knowledge_transfer_events = int(data.get("knowledge_transfer_events", 0))
        t.cultivation_events = int(data.get("cultivation_events", 0))
        t.experience_samples_recorded = int(data.get("experience_samples_recorded", 0))
        t.repeated_failed_actions = int(data.get("repeated_failed_actions", 0))
        t.post_negative_decision_switches = int(data.get("post_negative_decision_switches", 0))
        return t

    def build_report(
        self,
        clock: "SimulationClock",
        world: "WorldEngine",
        agents: "AgentEngine",
        comm: "CommunicationEngine",
        society: "SocietyEngine",
        history: "HistoryKnowledgeEngine",
    ) -> dict:
        all_list = list(agents.all_agents.values())
        living = [a for a in all_list if a.is_alive]
        deceased = [a for a in all_list if not a.is_alive]

        # 1. Population Analytics
        male_living = sum(1 for a in living if a.sex == "M")
        female_living = sum(1 for a in living if a.sex == "F")
        living_ages_y = [a.age_years for a in living]
        births_total = sum(1 for a in all_list if a.birth_tick > 0)
        deaths_total = len(deceased)
        denom_pop = max(1.0, (len(all_list) + len(living)) * 0.5)
        birth_rate_per_1000 = round((births_total / denom_pop) * 1000.0, 2) if births_total > 0 else 0.0
        death_rate_per_1000 = round((deaths_total / denom_pop) * 1000.0, 2) if deaths_total > 0 else 0.0
        net_growth_rate_per_1000 = round(birth_rate_per_1000 - death_rate_per_1000, 2)

        gen_counts: Dict[str, int] = {}
        for a in all_list:
            gk = str(a.generation)
            gen_counts[gk] = gen_counts.get(gk, 0) + 1

        # Family units: parents with >= 1 child, or living parent-child pairs
        parent_pairs: Dict[tuple, Set[int]] = {}
        for a in all_list:
            if a.parent_a_id is not None or a.parent_b_id is not None:
                key = tuple(sorted(x for x in (a.parent_a_id, a.parent_b_id) if x is not None))
                members = parent_pairs.setdefault(key, set(key))
                members.add(a.agent_id)
        avg_family_size = (
            round(sum(len(m) for m in parent_pairs.values()) / len(parent_pairs), 2)
            if parent_pairs
            else 0.0
        )

        independent_adults = sum(1 for a in living if a.life_stage in ("adult", "elder"))
        dependents = sum(1 for a in living if a.life_stage in ("infant", "child"))

        population_analytics = {
            "total_ever_lived": len(all_list),
            "living_count": len(living),
            "deceased_count": deaths_total,
            "births_total": births_total,
            "male_count": male_living,
            "female_count": female_living,
            "avg_age_years": round(sum(living_ages_y) / len(living_ages_y), 2) if living_ages_y else 0.0,
            "youngest_living_age_years": round(min(living_ages_y), 2) if living_ages_y else None,
            "oldest_living_age_years": round(max(living_ages_y), 2) if living_ages_y else None,
            "birth_rate_per_1000": birth_rate_per_1000,
            "death_rate_per_1000": death_rate_per_1000,
            "net_growth_rate_per_1000": net_growth_rate_per_1000,
            "max_generation": max((a.generation for a in all_list), default=0),
            "generations_breakdown": gen_counts,
            "family_units_count": len(parent_pairs),
            "avg_family_size": avg_family_size,
            "independent_adults_count": independent_adults,
            "dependents_count": dependents,
        }

        # 2. Survival Analytics
        dead_lifespans = [max(0, (a.death_tick or 0) - a.birth_tick) for a in deceased]
        if dead_lifespans:
            avg_life_t = round(sum(dead_lifespans) / len(dead_lifespans), 1)
            max_life_t = max(dead_lifespans)
            min_life_t = min(dead_lifespans)
        else:
            avg_life_t = 0.0
            max_life_t = max((a.age_ticks for a in living), default=0)
            min_life_t = min((a.age_ticks for a in living), default=0)

        cause_buckets = {
            "starvation": 0,
            "dehydration": 0,
            "disease": 0,
            "injury": 0,
            "murder": 0,
            "exposure": 0,
            "predator": 0,
            "old_age": 0,
            "other": 0,
        }
        premature_count = 0
        gen_surv_map: Dict[int, List[int]] = {}
        for a in all_list:
            span = (a.death_tick - a.birth_tick) if (not a.is_alive and a.death_tick is not None) else a.age_ticks
            gen_surv_map.setdefault(a.generation, []).append(max(0, span))
        for a in deceased:
            cat = categorize_death_cause(a.cause_of_death)
            cause_buckets[cat] = cause_buckets.get(cat, 0) + 1
            if cat != "old_age":
                premature_count += 1

        natural_deaths = cause_buckets["old_age"] + cause_buckets["disease"] + cause_buckets["exposure"] + cause_buckets["starvation"] + cause_buckets["dehydration"]
        violent_deaths = cause_buckets["murder"] + cause_buckets["predator"] + cause_buckets["injury"]

        survival_analytics = {
            "avg_lifespan_ticks": avg_life_t,
            "avg_lifespan_years": round(avg_life_t / 360.0, 2),
            "longest_lifespan_ticks": max_life_t,
            "longest_lifespan_years": round(max_life_t / 360.0, 2),
            "shortest_lifespan_ticks": min_life_t,
            "shortest_lifespan_years": round(min_life_t / 360.0, 2),
            "premature_deaths_count": premature_count,
            "premature_death_rate_pct": round((premature_count / len(deceased)) * 100.0, 1) if deceased else 0.0,
            "deaths_by_cause": cause_buckets,
            "natural_deaths_count": natural_deaths,
            "violent_deaths_count": violent_deaths,
            "avg_survival_by_generation_ticks": {
                str(g): round(sum(vals) / len(vals), 1)
                for g, vals in sorted(gen_surv_map.items())
            },
        }

        # 3. Food & Water Analytics + 6-Stage Funnel + Regional Breakdown
        total_food = sum(world.food_flora)
        avail_consumable_food = sum(max(0.0, f - 0.15) for f in world.food_flora if f > 0.4)
        total_water = sum(world.water)
        avail_water_cells = sum(1 for w in world.water if w > 0.25)

        half_w = world.width_m * 0.5
        half_h = world.height_m * 0.5
        regional: Dict[str, dict] = {
            q: {"food_biomass": 0.0, "water_volume": 0.0, "living_agents": 0}
            for q in ("NW", "NE", "SW", "SE")
        }
        for r in range(world.rows):
            wy = (r + 0.5) * world.cell_size_m
            ns = "N" if wy < half_h else "S"
            for c in range(world.cols):
                wx = (c + 0.5) * world.cell_size_m
                ew = "W" if wx < half_w else "E"
                idx = r * world.cols + c
                reg = regional[ns + ew]
                reg["food_biomass"] += world.food_flora[idx]
                reg["water_volume"] += world.water[idx]
        for a in living:
            ns = "N" if a.y < half_h else "S"
            ew = "W" if a.x < half_w else "E"
            regional[ns + ew]["living_agents"] += 1
        for q in regional:
            regional[q]["food_biomass"] = round(regional[q]["food_biomass"], 1)
            regional[q]["water_volume"] = round(regional[q]["water_volume"], 1)

        ticks_elapsed = max(1, clock.tick)
        food_water_analytics = {
            "total_food_biomass": round(total_food, 2),
            "available_consumable_food": round(avail_consumable_food, 2),
            "food_consumed_total": round(self.food_consumed_total, 2),
            "food_consumption_rate_per_tick": round(self.food_consumed_total / ticks_elapsed, 4),
            "total_water_volume": round(total_water, 2),
            "available_water_sources": avail_water_cells,
            "water_consumed_total": round(self.water_consumed_total, 2),
            "water_consumption_rate_per_tick": round(self.water_consumed_total / ticks_elapsed, 4),
            "agents_experienced_hunger": len(self.agents_ever_hungry),
            "agents_experienced_thirst": len(self.agents_ever_thirsty),
            "avg_hunger_duration_ticks": round(self.hunger_ticks_total / max(1, len(self.agents_ever_hungry)), 2),
            "avg_thirst_duration_ticks": round(self.thirst_ticks_total / max(1, len(self.agents_ever_thirsty)), 2),
            "starvation_deaths": cause_buckets["starvation"],
            "dehydration_deaths": cause_buckets["dehydration"],
            "nearby_food_reach_failures": self.nearby_food_reach_failures,
            "nearby_water_reach_failures": self.nearby_water_reach_failures,
            "food_funnel": dict(self.food_funnel),
            "water_funnel": dict(self.water_funnel),
            "regional_resources": regional,
        }

        # 4. Social, Civilization & Institutions
        social_ties_count = sum(len(a.memory.familiarity) for a in all_list) // 2
        active_groups = [g for g in society.groups.values() if g.active]
        norms_count = sum(len(g.norms) for g in active_groups)
        gov_structures = sum(1 for g in active_groups if g.governance_type != "informal")
        lang_sum = comm.summary()

        social_civilization_analytics = {
            "social_ties_count": social_ties_count,
            "active_groups_count": len(active_groups),
            "cooperation_events": self.cooperation_events,
            "mutual_aid_events": self.mutual_aid_events,
            "teaching_events": self.teaching_events,
            "knowledge_transfer_events": self.knowledge_transfer_events,
            "conflicts_count": society.crimes_by_type.get("assault", 0) + society.crimes_by_type.get("murder", 0),
            "crimes_total": society.total_crimes,
            "crimes_by_type": dict(society.crimes_by_type),
            "active_language_tokens": len({tok for ag in living for tok in ag.lexicon.keys()}),
            "stable_protowords_count": lang_sum["stable_protowords_count"],
            "surface_artifacts_count": len(history.artifacts),
            "cultivation_events": self.cultivation_events,
            "barters_count": society.total_barters,
            "emergent_markets_count": society.emergent_markets,
            "norms_count": norms_count,
            "governance_structures_count": gov_structures,
        }

        # 5. Economy & Resource Distribution
        stored_food = round(sum(a.inventory.get("food", 0.0) for a in living), 2)
        stored_wood = round(sum(a.inventory.get("wood", 0.0) for a in living), 2)
        stored_stone = round(sum(a.inventory.get("stone", 0.0) for a in living), 2)
        stored_herb = round(sum(a.inventory.get("herb", 0.0) for a in living), 2)
        stored_tool = round(sum(a.inventory.get("tool", 0.0) for a in living), 2)

        wealth_vals = sorted(
            sum(a.inventory.get(k, 0.0) for k in ("food", "wood", "stone", "herb", "tool"))
            for a in living
        )
        gini_val = 0.0
        top10_pct = 0.0
        if wealth_vals and sum(wealth_vals) > 0:
            n_w = len(wealth_vals)
            mean_w = sum(wealth_vals) / n_w
            diff_sum = sum(abs(x - y) for x in wealth_vals for y in wealth_vals)
            gini_val = round(diff_sum / (2.0 * (n_w ** 2) * mean_w), 4)
            k_top = max(1, n_w // 10)
            top10_pct = round((sum(wealth_vals[-k_top:]) / sum(wealth_vals)) * 100.0, 2)

        scarce_list = []
        if total_food < max(50.0, len(living) * 2.5):
            scarce_list.append("food")
        if avail_water_cells < max(5, len(living) // 4):
            scarce_list.append("water")
        if sum(world.herb_flora) < 50.0:
            scarce_list.append("herb")
        if sum(world.wood_flora) < 200.0:
            scarce_list.append("wood")

        economy_analytics = {
            "resource_produced": {
                "food_cultivated": round(self.food_produced_total, 2),
                "wood_gathered": round(self.wood_gathered_total, 2),
                "stone_gathered": round(self.stone_gathered_total, 2),
                "herb_gathered": round(self.herb_gathered_total, 2),
                "tools_crafted": self.tools_crafted_total,
            },
            "resource_consumed": {
                "food": round(self.food_consumed_total, 2),
                "water": round(self.water_consumed_total, 2),
            },
            "resource_stored_inventories": {
                "food": stored_food,
                "wood": stored_wood,
                "stone": stored_stone,
                "herb": stored_herb,
                "tool": stored_tool,
            },
            "scarce_resources": scarce_list,
            "wealth_distribution": {
                "gini_inventory": gini_val,
                "median_inventory": round(statistics.median(wealth_vals), 3) if wealth_vals else 0.0,
                "max_inventory": round(max(wealth_vals), 3) if wealth_vals else 0.0,
                "top10_share_pct": top10_pct,
            },
        }

        # 6. Intelligence & Learning
        total_skills = sum(len(a.memory.skills) for a in all_list)
        episodic_total = sum(len(a.memory.episodic) for a in all_list)
        spatial_total = sum(len(a.memory.spatial_map) for a in all_list)
        all_brains = [a.brain for a in all_list if a.brain is not None]
        update_counts = [b.total_updates for b in all_brains]
        reward_vals = [b.mean_recent_reward for b in all_brains if b.total_updates > 0]

        learning_intelligence_analytics = {
            "total_experiences_stored": self.experience_samples_recorded,
            "total_brain_updates": sum(update_counts),
            "total_skills_acquired": total_skills,
            "avg_skills_per_agent": round(total_skills / max(1, len(all_list)), 2),
            "food_discovery_events": self.food_discovery_events,
            "food_reach_events": self.food_reach_events,
            "water_discovery_events": self.water_discovery_events,
            "water_reach_events": self.water_reach_events,
            "episodic_memories_total": episodic_total,
            "spatial_memories_total": spatial_total,
            "intergenerational_transfers": comm.milestones.intergenerational_transmissions + self.knowledge_transfer_events,
            "individual_updates_std_dev": round(statistics.pstdev(update_counts), 3) if len(update_counts) > 1 else 0.0,
            "individual_reward_std_dev": round(statistics.pstdev(reward_vals), 4) if len(reward_vals) > 1 else 0.0,
            "repeated_failed_actions": self.repeated_failed_actions,
            "post_negative_decision_switches": self.post_negative_decision_switches,
            "telemetry_scope_note": "Statistical RL optimization metrics only — not general consciousness.",
        }

        return {
            "population": population_analytics,
            "survival": survival_analytics,
            "food_water": food_water_analytics,
            "social_civilization": social_civilization_analytics,
            "economy": economy_analytics,
            "learning_intelligence": learning_intelligence_analytics,
        }
