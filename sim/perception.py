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
    local_mate_id: Optional[int] = None
    local_mate_dx: float = 0.0
    local_mate_dy: float = 0.0
    local_mate_dist: float = 999.0
    local_kin_need_id: Optional[int] = None
    local_kin_need_dx: float = 0.0
    local_kin_need_dy: float = 0.0
    local_hazard_dx: float = 0.0
    local_hazard_dy: float = 0.0
    local_hazard_dist: float = 999.0
    local_soil_fertility: float = 0.0
    local_soil_moisture: float = 0.0


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
        tick: Optional[int] = None,
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
        local_mate_id: Optional[int] = None
        local_mate_dist = vision_r + 1.0
        local_kin_need_id: Optional[int] = None
        local_kin_need_score = -1.0

        can_seek_mate = (
            (agent.sex == "F" and not agent.is_pregnant and 16.0 <= agent.age_years <= 44.0)
            or (agent.sex == "M" and 16.0 <= agent.age_years <= 55.0)
        )
        child_set = set(agent.children_ids)

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

                        # Local mate readiness within visual range
                        if can_seek_mate and other.sex != agent.sex:
                            other_ready = (
                                (other.sex == "F" and not other.is_pregnant and 16.0 <= other.age_years <= 44.0 and other.health >= 0.65)
                                or (other.sex == "M" and 16.0 <= other.age_years <= 55.0 and other.health >= 0.60)
                            )
                            if other_ready and agent.memory.trust.get(other_id, 0.0) >= -0.05:
                                if dist < local_mate_dist:
                                    local_mate_dist = dist
                                    local_mate_id = other_id

                        # Local dependent child / kin need within visual range
                        is_child_or_parent = (
                            other_id in child_set
                            or other_id == agent.parent_a_id
                            or other_id == agent.parent_b_id
                        )
                        if is_child_or_parent and (other.hunger > 0.45 or other.health < 0.65):
                            need_score = other.hunger * 1.4 + (1.0 - other.health)
                            if other.age_years < 14.0:
                                need_score += 0.6
                            if need_score > local_kin_need_score:
                                local_kin_need_score = need_score
                                local_kin_need_id = other_id

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

        # Immediate 3x3 reachable resources + wider vision scan up to vision_r
        c0, r0 = world.cell_coords_at(agent.x, agent.y)
        local_water = 0.0
        local_food = 0.0
        local_wood = 0.0
        local_stone = 0.0
        local_herb = 0.0
        best_food_xy: Optional[Tuple[float, float]] = None
        best_food_score = -1.0
        best_water_xy: Optional[Tuple[float, float]] = None
        best_water_dist = float("inf")

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

        vis_span = min(5, max(1, int(vision_r // world.cell_size_m)))
        for dr in range(-vis_span, vis_span + 1):
            rr = r0 + dr
            if 0 <= rr < world.rows:
                for dc in range(-vis_span, vis_span + 1):
                    cc = c0 + dc
                    if 0 <= cc < world.cols:
                        idx = rr * world.cols + cc
                        wx = (cc + 0.5) * world.cell_size_m
                        wy = (rr + 0.5) * world.cell_size_m
                        dist = math.hypot(wx - agent.x, wy - agent.y)
                        if dist > vision_r:
                            continue
                        if world.water[idx] > 0.25 and dist < best_water_dist:
                            best_water_dist = dist
                            best_water_xy = (wx, wy)
                        if world.food_flora[idx] > 0.4:
                            score = world.food_flora[idx] / (1.0 + dist * 0.02)
                            if score > best_food_score:
                                best_food_score = score
                                best_food_xy = (wx, wy)

        # Local fauna within vision radius
        pred_dist = vision_r + 1.0
        herb_dist = vision_r + 1.0
        nearest_pred_xy: Optional[Tuple[float, float]] = None
        for f in world.fauna.values():
            if not f.alive:
                continue
            d = math.hypot(f.x - agent.x, f.y - agent.y)
            if d <= vision_r:
                if f.species == "predator" and d < pred_dist:
                    pred_dist = d
                    nearest_pred_xy = (f.x, f.y)
                elif f.species == "herbivore" and d < herb_dist:
                    herb_dist = d

        # Directional hints strictly from local perception or own memory (never global oracle)
        def _dir_unit(tx: float, ty: float) -> Tuple[float, float]:
            dx = tx - agent.x
            dy = ty - agent.y
            d = math.hypot(dx, dy)
            if d < 1.0:
                return 0.0, 0.0
            return round(dx / d, 4), round(dy / d, 4)

        food_dx, food_dy = 0.0, 0.0
        if best_food_xy is not None:
            food_dx, food_dy = _dir_unit(best_food_xy[0], best_food_xy[1])
        else:
            mem_food = agent.memory.recall_nearest(agent.x, agent.y, "food")
            if mem_food is not None:
                food_dx, food_dy = _dir_unit(mem_food.x, mem_food.y)

        water_dx, water_dy = 0.0, 0.0
        if best_water_xy is not None:
            water_dx, water_dy = _dir_unit(best_water_xy[0], best_water_xy[1])
        else:
            mem_water = agent.memory.recall_nearest(agent.x, agent.y, "water")
            if mem_water is not None:
                water_dx, water_dy = _dir_unit(mem_water.x, mem_water.y)

        near_dx, near_dy = 0.0, 0.0
        if nearest_id is not None and nearest_id in living_agents:
            other = living_agents[nearest_id]
            near_dx = max(-1.0, min(1.0, (other.x - agent.x) / max(1.0, vision_r)))
            near_dy = max(-1.0, min(1.0, (other.y - agent.y) / max(1.0, vision_r)))

        mate_dx, mate_dy = 0.0, 0.0
        if local_mate_id is not None and local_mate_id in living_agents:
            mate = living_agents[local_mate_id]
            mate_dx, mate_dy = _dir_unit(mate.x, mate.y)

        kin_need_dx, kin_need_dy = 0.0, 0.0
        if local_kin_need_id is not None and local_kin_need_id in living_agents:
            kin = living_agents[local_kin_need_id]
            kin_need_dx, kin_need_dy = _dir_unit(kin.x, kin.y)

        hazard_dx, hazard_dy = 0.0, 0.0
        hazard_dist = vision_r + 1.0
        if nearest_pred_xy is not None:
            hazard_dx, hazard_dy = _dir_unit(nearest_pred_xy[0], nearest_pred_xy[1])
            hazard_dist = pred_dist
        else:
            mem_haz = (
                agent.memory.recall_nearest_hazard(tick, agent.x, agent.y)
                if tick is not None
                else agent.memory.recall_nearest(agent.x, agent.y, "hazard")
            )
            if mem_haz is not None:
                hd = math.hypot(mem_haz.x - agent.x, mem_haz.y - agent.y)
                if hd <= vision_r:
                    hazard_dx, hazard_dy = _dir_unit(mem_haz.x, mem_haz.y)
                    hazard_dist = hd

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
            local_mate_id=local_mate_id,
            local_mate_dx=mate_dx,
            local_mate_dy=mate_dy,
            local_mate_dist=local_mate_dist,
            local_kin_need_id=local_kin_need_id,
            local_kin_need_dx=kin_need_dx,
            local_kin_need_dy=kin_need_dy,
            local_hazard_dx=hazard_dx,
            local_hazard_dy=hazard_dy,
            local_hazard_dist=hazard_dist,
            local_soil_fertility=world.fertility[cidx],
            local_soil_moisture=world.moisture[cidx],
        )
