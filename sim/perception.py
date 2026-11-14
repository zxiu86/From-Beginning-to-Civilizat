"""Sensory Locality & Perception Engine — strict local observability with zero global leakage."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple, TYPE_CHECKING

if TYPE_CHECKING:
    from .agent import Agent
    from .communication import VocalEmission
    from .history import SurfaceArtifact
    from .world import WorldEngine


@dataclass
class LocalPerception:
    """Snapshot of everything one agent can legitimately sense at this tick."""

    vision_radius_m: float
    hearing_radius_m: float
    nearby_agent_ids: List[int]
    nearest_agent_id: Optional[int]
    nearest_agent_dist: float
    nearest_agent_trust: float
    nearest_agent_familiarity: float
    heard_emissions: List["VocalEmission"]
    nearby_artifacts: List["SurfaceArtifact"]
    local_water: float
    local_food: float
    local_wood: float
    local_stone: float
    local_herb: float
    local_predator_dist: float
    local_herbivore_dist: float
    obs_vector: List[float]


class PerceptionEngine:
    """Computes strictly local sensory windows modulated by light, weather, and terrain."""

    @staticmethod
    def compute_sensory_radii(
        world: "WorldEngine",
        is_night: bool,
        base_vision: float,
        base_hearing: float,
    ) -> Tuple[float, float]:
        vision = base_vision
        hearing = base_hearing

        if is_night:
            vision *= 0.55
        cond = world.weather.condition
        if cond == "storm":
            vision *= 0.6
            hearing *= 0.65
        elif cond == "rain":
            vision *= 0.8
            hearing *= 0.85
        elif cond == "flood":
            vision *= 0.75

        return round(vision, 2), round(hearing, 2)

    @staticmethod
    def perceive(
        agent: "Agent",
        world: "WorldEngine",
        living_agents: Dict[int, "Agent"],
        spatial_buckets: Dict[Tuple[int, int], List[int]],
        recent_emissions: List["VocalEmission"],
        artifacts: List["SurfaceArtifact"],
        is_night: bool,
        base_vision: float,
        base_hearing: float,
        bucket_size: float = 150.0,
    ) -> LocalPerception:
        vision_r, hearing_r = PerceptionEngine.compute_sensory_radii(
            world, is_night, base_vision, base_hearing
        )

        # Query only nearby spatial buckets (prevents O(N^2) global scan and enforces locality)
        bx = int(agent.x // bucket_size)
        by = int(agent.y // bucket_size)
        cell_span = max(1, int(math.ceil(vision_r / bucket_size)))

        nearby_ids: List[int] = []
        nearest_id: Optional[int] = None
        nearest_dist = vision_r + 1.0

        for dx_b in range(-cell_span, cell_span + 1):
            for dy_b in range(-cell_span, cell_span + 1):
                for other_id in spatial_buckets.get((bx + dx_b, by + dy_b), ()):
                    if other_id == agent.agent_id:
                        continue
                    other = living_agents.get(other_id)
                    if other is None or not other.is_alive:
                        continue
                    dist = math.hypot(other.x - agent.x, other.y - agent.y)
                    if dist <= vision_r:
                        nearby_ids.append(other_id)
                        if dist < nearest_dist:
                            nearest_dist = dist
                            nearest_id = other_id

        # Progressive recognition: unfamiliar individuals have blurred identity signals until repeated contact
        nearest_fam = 0.0
        nearest_trust = 0.0
        if nearest_id is not None:
            nearest_fam = agent.memory.familiarity.get(nearest_id, 0.0)
            nearest_trust = agent.memory.trust.get(nearest_id, 0.0) * min(1.0, 0.25 + nearest_fam)

        # Heard vocalizations strictly bounded by hearing radius
        heard = [
            em for em in recent_emissions
            if em.speaker_id != agent.agent_id
            and math.hypot(em.x - agent.x, em.y - agent.y) <= hearing_r
        ]

        # Nearby surface markings/artifacts within vision radius
        near_arts = [
            art for art in artifacts
            if math.hypot(art.x - agent.x, art.y - agent.y) <= vision_r
        ]

        # Local grid resources (current cell + immediate 1-cell ring within vision)
        c0, r0 = world.cell_coords_at(agent.x, agent.y)
        local_water = 0.0
        local_food = 0.0
        local_wood = 0.0
        local_stone = 0.0
        local_herb = 0.0
        best_food_xy: Optional[Tuple[float, float]] = None
        best_food_val = 0.0
        best_water_xy: Optional[Tuple[float, float]] = None
        best_water_val = 0.0

        for dr in (-1, 0, 1):
            rr = r0 + dr
            if 0 <= rr < world.rows:
                for dc in (-1, 0, 1):
                    cc = c0 + dc
                    if 0 <= cc < world.cols:
                        idx = rr * world.cols + cc
                        local_water = max(local_water, world.water[idx])
                        local_food += world.food_flora[idx]
                        local_wood += world.wood_flora[idx]
                        local_stone += world.stone_mineral[idx]
                        local_herb += world.herb_flora[idx]
                        wx = (cc + 0.5) * world.cell_size_m
                        wy = (rr + 0.5) * world.cell_size_m
                        if world.food_flora[idx] > best_food_val:
                            best_food_val = world.food_flora[idx]
                            best_food_xy = (wx, wy)
                        if world.water[idx] > best_water_val:
                            best_water_val = world.water[idx]
                            best_water_xy = (wx, wy)

        # Local fauna within vision radius
        pred_dist = vision_r + 1.0
        herb_dist = vision_r + 1.0
        for f in world.fauna.values():
            if not f.alive:
                continue
            d = math.hypot(f.x - agent.x, f.y - agent.y)
            if d <= vision_r:
                if f.species == "predator" and d < pred_dist:
                    pred_dist = d
                elif f.species == "herbivore" and d < herb_dist:
                    herb_dist = d

        # Directional hints strictly from local perception or own memory (never global oracle)
        food_dx, food_dy = 0.0, 0.0
        if best_food_xy is not None and best_food_val > 0.2:
            food_dx = max(-1.0, min(1.0, (best_food_xy[0] - agent.x) / 50.0))
            food_dy = max(-1.0, min(1.0, (best_food_xy[1] - agent.y) / 50.0))
        else:
            mem_food = agent.memory.recall_nearest(agent.x, agent.y, "food")
            if mem_food is not None:
                food_dx = max(-1.0, min(1.0, (mem_food.x - agent.x) / 250.0))
                food_dy = max(-1.0, min(1.0, (mem_food.y - agent.y) / 250.0))

        water_dx, water_dy = 0.0, 0.0
        if best_water_xy is not None and best_water_val > 0.2:
            water_dx = max(-1.0, min(1.0, (best_water_xy[0] - agent.x) / 50.0))
            water_dy = max(-1.0, min(1.0, (best_water_xy[1] - agent.y) / 50.0))
        else:
            mem_water = agent.memory.recall_nearest(agent.x, agent.y, "water")
            if mem_water is not None:
                water_dx = max(-1.0, min(1.0, (mem_water.x - agent.x) / 250.0))
                water_dy = max(-1.0, min(1.0, (mem_water.y - agent.y) / 250.0))

        near_dx, near_dy = 0.0, 0.0
        if nearest_id is not None and nearest_id in living_agents:
            other = living_agents[nearest_id]
            near_dx = max(-1.0, min(1.0, (other.x - agent.x) / max(1.0, vision_r)))
            near_dy = max(-1.0, min(1.0, (other.y - agent.y) / max(1.0, vision_r)))

        cidx = r0 * world.cols + c0
        last_heard_token_norm = (heard[-1].token / 23.0) if heard else 0.0
        heard_meaning_conf = 0.0
        if heard:
            tok = heard[-1].token
            assoc = agent.lexicon.get(tok, {})
            if assoc:
                heard_meaning_conf = max(assoc.values())

        # Fixed 36-float local observation vector
        obs = [
            agent.hunger,
            agent.thirst,
            agent.energy,
            agent.health,
            agent.injury,
            agent.disease_load,
            1.0 if agent.is_pregnant else 0.0,
            min(1.0, agent.age_years / 70.0),
            max(-1.0, min(1.0, (world.weather.temperature_c - 18.0) / 20.0)),
            min(1.0, world.weather.rainfall_mm / 40.0),
            1.0 if is_night else 0.0,
            min(1.0, world.elevation[cidx] / 150.0),
            min(1.0, world.slope[cidx]),
            min(1.0, local_water / 80.0),
            min(1.0, local_food / 40.0),
            min(1.0, local_wood / 50.0),
            min(1.0, local_stone / 30.0),
            min(1.0, local_herb / 12.0),
            food_dx,
            food_dy,
            water_dx,
            water_dy,
            min(1.0, len(nearby_ids) / 10.0),
            min(1.0, nearest_dist / max(1.0, vision_r)),
            near_dx,
            near_dy,
            nearest_fam,
            nearest_trust,
            min(1.0, len(heard) / 5.0),
            last_heard_token_norm,
            heard_meaning_conf,
            min(1.0, len(near_arts) / 4.0),
            1.0 - min(1.0, pred_dist / max(1.0, vision_r)),
            1.0 - min(1.0, herb_dist / max(1.0, vision_r)),
            min(1.0, agent.inventory.get("food", 0.0) / 5.0),
            min(1.0, (agent.inventory.get("stone", 0.0) + agent.inventory.get("tool", 0.0)) / 5.0),
        ]

        return LocalPerception(
            vision_radius_m=vision_r,
            hearing_radius_m=hearing_r,
            nearby_agent_ids=nearby_ids,
            nearest_agent_id=nearest_id,
            nearest_agent_dist=nearest_dist,
            nearest_agent_trust=nearest_trust,
            nearest_agent_familiarity=nearest_fam,
            heard_emissions=heard,
            nearby_artifacts=near_arts,
            local_water=local_water,
            local_food=local_food,
            local_wood=local_wood,
            local_stone=local_stone,
            local_herb=local_herb,
            local_predator_dist=pred_dist,
            local_herbivore_dist=herb_dist,
            obs_vector=obs,
        )
