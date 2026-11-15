"""World Engine & Environment Engine — 5 km^2 coupled ecosystem with finite regenerating resources."""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Tuple


@dataclass
class FaunaEntity:
    fauna_id: int
    species: str  # "herbivore" or "predator"
    x: float
    y: float
    energy: float
    health: float
    age_ticks: int
    alive: bool = True

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "FaunaEntity":
        return cls(**d)


@dataclass
class WeatherState:
    temperature_c: float = 18.0
    rainfall_mm: float = 1.5
    wind_mps: float = 3.0
    condition: str = "clear"  # clear, rain, storm, drought, flood, frost
    drought_streak_days: int = 0
    flood_severity: float = 0.0
    disease_pressure: float = 0.02

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "WeatherState":
        return cls(**d)


class WorldEngine:
    """
    5 km^2 (2500m x 2000m) terrain, hydrology, soil, finite flora, minerals, fauna, and climate.
    Uses flat lists of size cols * rows (8,000 cells at 25m resolution) for low RAM and fast CPU iteration.
    """

    def __init__(
        self,
        width_m: float = 2500.0,
        height_m: float = 2000.0,
        cell_size_m: float = 25.0,
        seed: int = 42,
    ) -> None:
        self.width_m = width_m
        self.height_m = height_m
        self.cell_size_m = cell_size_m
        self.cols = int(width_m // cell_size_m)
        self.rows = int(height_m // cell_size_m)
        self.num_cells = self.cols * self.rows
        self.seed = seed

        # Cell-level arrays (length = num_cells)
        self.elevation: List[float] = [0.0] * self.num_cells
        self.slope: List[float] = [0.0] * self.num_cells
        self.fertility: List[float] = [0.0] * self.num_cells
        self.moisture: List[float] = [0.0] * self.num_cells
        self.water: List[float] = [0.0] * self.num_cells
        self.food_flora: List[float] = [0.0] * self.num_cells
        self.food_max: List[float] = [0.0] * self.num_cells
        self.wood_flora: List[float] = [0.0] * self.num_cells
        self.wood_max: List[float] = [0.0] * self.num_cells
        self.herb_flora: List[float] = [0.0] * self.num_cells
        self.stone_mineral: List[float] = [0.0] * self.num_cells

        self.weather = WeatherState()
        self.fauna: Dict[int, FaunaEntity] = {}
        self.next_fauna_id: int = 1
        self.spring_cells: List[int] = []

    def generate(self, rng: random.Random) -> None:
        """Procedurally generate realistic watersheds, ridges, fertile valleys, and ecosystems."""
        p1 = rng.uniform(0.0, 6.28)
        p2 = rng.uniform(0.0, 6.28)
        river_offset = rng.uniform(-220.0, 220.0)
        lake_cx = self.width_m * rng.uniform(0.35, 0.65)
        lake_cy = self.height_m * rng.uniform(0.35, 0.65)

        for r in range(self.rows):
            wy = (r + 0.5) * self.cell_size_m
            for c in range(self.cols):
                wx = (c + 0.5) * self.cell_size_m
                idx = r * self.cols + c

                # Multi-frequency elevation (0m to 180m)
                ridge = (
                    45.0 * math.sin(wx * 0.0028 + p1) * math.cos(wy * 0.0025 + p2)
                    + 28.0 * math.sin((wx + wy) * 0.0045 + p2)
                    + 15.0 * math.cos(wx * 0.009 - wy * 0.007)
                )
                # Meandering river valley running west-to-east
                river_y = (
                    self.height_m * 0.52
                    + river_offset * 0.35
                    + 260.0 * math.sin(wx * 0.0032 + p1)
                )
                dist_river = abs(wy - river_y)
                dist_lake = math.hypot(wx - lake_cx, wy - lake_cy)

                valley_cut = max(0.0, 42.0 - dist_river * 0.12)
                lake_cut = max(0.0, 38.0 - dist_lake * 0.18)
                elev = max(0.0, 55.0 + ridge - valley_cut - lake_cut)
                self.elevation[idx] = round(elev, 3)

                # Natural water bodies: river channel, central lake, occasional natural springs
                is_river = dist_river < 55.0
                is_lake = dist_lake < 145.0
                is_spring = (elev > 85.0 and rng.random() < 0.006) or (elev < 65.0 and rng.random() < 0.012)
                if is_lake:
                    water_amt = 120.0
                elif is_river:
                    water_amt = 80.0
                elif is_spring:
                    water_amt = 40.0
                    self.spring_cells.append(idx)
                else:
                    water_amt = 0.0
                self.water[idx] = water_amt

        # Compute terrain slope from cardinal neighbors
        for r in range(self.rows):
            for c in range(self.cols):
                idx = r * self.cols + c
                left = self.elevation[r * self.cols + max(0, c - 1)]
                right = self.elevation[r * self.cols + min(self.cols - 1, c + 1)]
                up = self.elevation[max(0, r - 1) * self.cols + c]
                down = self.elevation[min(self.rows - 1, r + 1) * self.cols + c]
                dz_dx = (right - left) / (2.0 * self.cell_size_m)
                dz_dy = (down - up) / (2.0 * self.cell_size_m)
                slope_val = math.hypot(dz_dx, dz_dy)
                self.slope[idx] = round(min(2.0, slope_val), 4)

                # Soil fertility peaks in low/moderate slopes near alluvial valleys, drops on steep rocky ridges
                water_prox = 1.0 if self.water[idx] > 0 else 0.0
                if not water_prox:
                    # Check 4-cell neighborhood for moisture diffusion
                    for dr in range(-4, 5):
                        rr = r + dr
                        if 0 <= rr < self.rows:
                            for dc in range(-4, 5):
                                cc = c + dc
                                if 0 <= cc < self.cols and self.water[rr * self.cols + cc] > 0:
                                    d = math.hypot(dr, dc)
                                    water_prox = max(water_prox, max(0.0, 1.0 - d / 5.5))

                raw_fert = (
                    0.55 * (1.0 - min(1.0, self.elevation[idx] / 140.0))
                    + 0.35 * water_prox
                    - 0.45 * min(1.0, slope_val)
                    + rng.uniform(-0.08, 0.12)
                )
                fert = max(0.05, min(1.0, raw_fert))
                self.fertility[idx] = round(fert, 4)

                moist = max(0.08, min(1.0, 0.25 + 0.65 * water_prox + rng.uniform(-0.05, 0.08)))
                self.moisture[idx] = round(moist, 4)

                if self.water[idx] >= 60.0:
                    # Deep river/lake cells do not grow terrestrial trees/berries
                    self.food_max[idx] = 1.5
                    self.food_flora[idx] = 1.5
                    self.wood_max[idx] = 0.0
                    self.wood_flora[idx] = 0.0
                    self.herb_flora[idx] = 0.5
                    self.stone_mineral[idx] = 2.0
                else:
                    f_cap = max(0.0, round(18.0 * fert * (0.4 + 0.6 * moist), 3))
                    w_cap = max(0.0, round(24.0 * fert * (0.5 + 0.5 * moist) if slope_val < 0.7 else 4.0, 3))
                    self.food_max[idx] = f_cap
                    self.food_flora[idx] = round(f_cap * rng.uniform(0.65, 1.0), 3)
                    self.wood_max[idx] = w_cap
                    self.wood_flora[idx] = round(w_cap * rng.uniform(0.65, 1.0), 3)
                    self.herb_flora[idx] = round(4.0 * fert * rng.uniform(0.3, 1.0), 3)
                    # Stone/flint/mineral outcrops more frequent on rocky higher slopes
                    rocky = max(0.0, (self.elevation[idx] - 55.0) / 80.0 + slope_val * 0.6)
                    self.stone_mineral[idx] = round(
                        (12.0 + rng.uniform(0.0, 22.0)) * rocky if rng.random() < 0.22 + 0.35 * rocky else rng.uniform(0.0, 2.5),
                        3,
                    )

        # Spawn natural fauna (herbivores in fertile meadows, balanced apex predators)
        self.fauna.clear()
        self.next_fauna_id = 1
        for _ in range(65):
            fx, fy = self._pick_habitable_point(rng)
            self._spawn_fauna("herbivore", fx, fy, rng)
        for _ in range(6):
            fx, fy = self._pick_habitable_point(rng)
            self._spawn_fauna("predator", fx, fy, rng)

    def _pick_habitable_point(self, rng: random.Random) -> Tuple[float, float]:
        for _ in range(30):
            x = rng.uniform(50.0, self.width_m - 50.0)
            y = rng.uniform(50.0, self.height_m - 50.0)
            if self.water[self.cell_index_at(x, y)] < 50.0:
                return x, y
        return self.width_m * 0.5, self.height_m * 0.5

    def _spawn_fauna(self, species: str, x: float, y: float, rng: random.Random) -> FaunaEntity:
        fid = self.next_fauna_id
        self.next_fauna_id += 1
        ent = FaunaEntity(
            fauna_id=fid,
            species=species,
            x=x,
            y=y,
            energy=rng.uniform(0.65, 1.0),
            health=1.0,
            age_ticks=rng.randint(30, 400),
            alive=True,
        )
        self.fauna[fid] = ent
        return ent

    def clamp_coords(self, x: float, y: float) -> Tuple[float, float]:
        return (
            max(0.0, min(self.width_m - 0.001, x)),
            max(0.0, min(self.height_m - 0.001, y)),
        )

    def cell_coords_at(self, x: float, y: float) -> Tuple[int, int]:
        cx, cy = self.clamp_coords(x, y)
        c = min(self.cols - 1, max(0, int(cx // self.cell_size_m)))
        r = min(self.rows - 1, max(0, int(cy // self.cell_size_m)))
        return c, r

    def cell_index_at(self, x: float, y: float) -> int:
        c, r = self.cell_coords_at(x, y)
        return r * self.cols + c

    def has_nearby_water(self, x: float, y: float, radius_m: float = 35.0) -> Optional[int]:
        c0, r0 = self.cell_coords_at(x, y)
        cell_rad = max(1, int(math.ceil(radius_m / self.cell_size_m)))
        best_idx = None
        best_amt = 0.0
        for dr in range(-cell_rad, cell_rad + 1):
            rr = r0 + dr
            if 0 <= rr < self.rows:
                for dc in range(-cell_rad, cell_rad + 1):
                    cc = c0 + dc
                    if 0 <= cc < self.cols:
                        idx = rr * self.cols + cc
                        if self.water[idx] > best_amt:
                            best_amt = self.water[idx]
                            best_idx = idx
        return best_idx

    def consume_water(self, idx: int, amount: float) -> float:
        avail = self.water[idx]
        taken = min(avail, max(0.0, amount))
        # Large rivers/lakes buffer inflow, springs/puddles deplete directly
        if avail < 60.0:
            self.water[idx] = max(0.0, round(avail - taken, 4))
        return taken

    def harvest_food(self, idx: int, amount: float) -> float:
        taken = min(self.food_flora[idx], max(0.0, amount))
        new_val = round(self.food_flora[idx] - taken, 4)
        self.food_flora[idx] = new_val
        if taken > 0.2 and new_val < 0.25 * max(0.1, self.food_max[idx]):
            self.fertility[idx] = max(0.04, round(self.fertility[idx] - 0.004 * taken, 4))
        return taken

    def harvest_wood(self, idx: int, amount: float) -> float:
        taken = min(self.wood_flora[idx], max(0.0, amount))
        new_val = round(self.wood_flora[idx] - taken, 4)
        self.wood_flora[idx] = new_val
        if taken > 0.2 and new_val < 0.2 * max(0.1, self.wood_max[idx]):
            self.fertility[idx] = max(0.04, round(self.fertility[idx] - 0.003 * taken, 4))
        return taken

    def harvest_herb(self, idx: int, amount: float) -> float:
        taken = min(self.herb_flora[idx], max(0.0, amount))
        self.herb_flora[idx] = round(self.herb_flora[idx] - taken, 4)
        return taken

    def harvest_stone(self, idx: int, amount: float) -> float:
        taken = min(self.stone_mineral[idx], max(0.0, amount))
        self.stone_mineral[idx] = round(self.stone_mineral[idx] - taken, 4)
        return taken

    def step_environment(self, tick: int, season: str, month: int, rng: random.Random) -> List[dict]:
        """Advance weather, climate disasters, resource regeneration, and fauna ecology."""
        events: List[dict] = []

        # Seasonal baseline temperature and rainfall probability
        seasonal_temp = {
            "spring": 17.5,
            "summer": 28.5,
            "autumn": 15.0,
            "winter": 3.5,
        }[season]
        rain_prob = {
            "spring": 0.32,
            "summer": 0.14,
            "autumn": 0.28,
            "winter": 0.26,
        }[season]

        temp_wave = 3.5 * math.sin(tick * 0.17) + rng.gauss(0.0, 2.2)
        self.weather.temperature_c = round(seasonal_temp + temp_wave, 2)
        self.weather.wind_mps = round(max(0.2, rng.gauss(3.8, 2.0)), 2)

        is_raining = rng.random() < rain_prob
        if is_raining:
            rain = max(0.5, rng.expovariate(0.18))
            self.weather.rainfall_mm = round(min(90.0, rain), 2)
            self.weather.drought_streak_days = 0
        else:
            self.weather.rainfall_mm = 0.0
            self.weather.drought_streak_days += 1

        prev_cond = self.weather.condition
        if self.weather.temperature_c <= 0.0:
            self.weather.condition = "frost"
            self.weather.flood_severity = max(0.0, self.weather.flood_severity - 0.15)
        elif self.weather.rainfall_mm >= 36.0:
            self.weather.condition = "flood"
            self.weather.flood_severity = min(1.0, (self.weather.rainfall_mm - 30.0) / 40.0)
            if prev_cond != "flood":
                events.append({
                    "event_type": "environmental_disaster",
                    "subtype": "flood",
                    "severity": round(self.weather.flood_severity, 3),
                    "description": f"Heavy rainfall ({self.weather.rainfall_mm} mm) triggered localized flooding.",
                })
        elif self.weather.rainfall_mm >= 14.0:
            self.weather.condition = "storm"
            self.weather.flood_severity = max(0.0, self.weather.flood_severity - 0.1)
        elif self.weather.rainfall_mm > 0.0:
            self.weather.condition = "rain"
            self.weather.flood_severity = max(0.0, self.weather.flood_severity - 0.12)
        elif self.weather.drought_streak_days >= 24:
            self.weather.condition = "drought"
            self.weather.flood_severity = 0.0
            if prev_cond != "drought":
                events.append({
                    "event_type": "environmental_disaster",
                    "subtype": "drought",
                    "severity": round(min(1.0, self.weather.drought_streak_days / 60.0), 3),
                    "description": f"Extended dry spell ({self.weather.drought_streak_days} days) caused drought.",
                })
        else:
            self.weather.condition = "clear"
            self.weather.flood_severity = max(0.0, self.weather.flood_severity - 0.15)

        # Disease pressure increases with flood stagnation, extreme heat/cold, or high humidity shifts
        self.weather.disease_pressure = round(
            min(
                0.35,
                0.015
                + 0.08 * self.weather.flood_severity
                + (0.04 if self.weather.condition == "drought" else 0.0)
                + (0.03 if self.weather.temperature_c < 1.0 or self.weather.temperature_c > 34.0 else 0.0),
            ),
            4,
        )

        # Coupled ecological update: moisture + finite flora regeneration
        # Regeneration depends on moisture, soil fertility, season, and surviving seed stock!
        # If a patch is stripped completely to 0, it recovers VERY slowly only via neighbor/seedbank dispersal.
        season_growth = {
            "spring": 1.35,
            "summer": 1.0,
            "autumn": 0.55,
            "winter": 0.12,
        }[season]
        rain_moist_gain = self.weather.rainfall_mm * 0.006
        evap = 0.012 + max(0.0, (self.weather.temperature_c - 15.0) * 0.0012)
        drought_penalty = 0.25 if self.weather.condition == "drought" else 1.0

        for idx in range(self.num_cells):
            m = self.moisture[idx] + rain_moist_gain - evap
            if self.water[idx] > 10.0:
                m = max(m, 0.72)
            m = max(0.03, min(1.0, m))
            self.moisture[idx] = m

            # Flood damage on low-elevation flora
            if self.weather.flood_severity > 0.3 and self.elevation[idx] < 38.0:
                self.food_flora[idx] *= (1.0 - 0.04 * self.weather.flood_severity)

            f_max = self.food_max[idx]
            if f_max > 0.0:
                cur_f = self.food_flora[idx]
                if cur_f < f_max:
                    # Logistic-like regrowth proportional to surviving stock + tiny dormant seedbank
                    seed_factor = (cur_f / f_max) + 0.015
                    regrow = 0.035 * f_max * self.fertility[idx] * m * season_growth * drought_penalty * seed_factor
                    self.food_flora[idx] = min(f_max, cur_f + regrow)

            w_max = self.wood_max[idx]
            if w_max > 0.0:
                cur_w = self.wood_flora[idx]
                if cur_w < w_max:
                    seed_factor = (cur_w / w_max) + 0.008
                    regrow_w = 0.010 * w_max * self.fertility[idx] * m * season_growth * drought_penalty * seed_factor
                    self.wood_flora[idx] = min(w_max, cur_w + regrow_w)

            if self.herb_flora[idx] < 4.0 * self.fertility[idx]:
                self.herb_flora[idx] = min(
                    4.0 * self.fertility[idx],
                    self.herb_flora[idx] + 0.012 * self.fertility[idx] * m * season_growth * drought_penalty,
                )

            # Organic soil fertility recovery when vegetation & moisture coexist
            if m > 0.38 and self.food_flora[idx] > 1.0 and self.fertility[idx] < 0.85:
                self.fertility[idx] = min(0.85, self.fertility[idx] + 0.0005 * m * season_growth * drought_penalty)

        # Rainfall gently recharges natural springs (still dries up during drought or over-extraction)
        if self.weather.rainfall_mm > 0.5 and self.spring_cells:
            recharge = min(8.0, self.weather.rainfall_mm * 0.45)
            for s_idx in self.spring_cells:
                self.water[s_idx] = min(45.0, self.water[s_idx] + recharge)

        # Fauna simulation (herbivores graze flora; predators hunt herbivores)
        self._step_fauna(rng)
        return events

    def _step_fauna(self, rng: random.Random) -> None:
        living_fauna = [f for f in self.fauna.values() if f.alive]
        herbivores = [f for f in living_fauna if f.species == "herbivore"]
        new_spawns: List[Tuple[str, float, float]] = []

        for f in living_fauna:
            f.age_ticks += 1
            # Movement: predators stalk nearby herbivores when hungry; herbivores drift toward greener patches
            step_dist = 35.0 if f.species == "herbivore" else 55.0
            angle = rng.uniform(0.0, 2.0 * math.pi)
            if f.species == "predator" and f.energy < 0.68 and herbivores:
                nearest_prey = None
                nearest_d = 240.0
                for h in herbivores:
                    if h.alive:
                        d = math.hypot(h.x - f.x, h.y - f.y)
                        if d < nearest_d:
                            nearest_d = d
                            nearest_prey = h
                if nearest_prey is not None and nearest_d > 5.0:
                    angle = math.atan2(nearest_prey.y - f.y, nearest_prey.x - f.x) + rng.uniform(-0.35, 0.35)
            elif f.species == "herbivore" and f.energy < 0.6:
                c_here, r_here = self.cell_coords_at(f.x, f.y)
                best_food = self.food_flora[r_here * self.cols + c_here]
                best_dir: Optional[float] = None
                for dr in (-2, 0, 2):
                    rr = r_here + dr
                    if 0 <= rr < self.rows:
                        for dc in (-2, 0, 2):
                            cc = c_here + dc
                            if 0 <= cc < self.cols and self.water[rr * self.cols + cc] < 70.0:
                                val = self.food_flora[rr * self.cols + cc]
                                if val > best_food + 0.5:
                                    best_food = val
                                    best_dir = math.atan2(dr, dc)
                if best_dir is not None:
                    angle = best_dir + rng.uniform(-0.25, 0.25)

            nx, ny = self.clamp_coords(f.x + math.cos(angle) * step_dist, f.y + math.sin(angle) * step_dist)
            nidx = self.cell_index_at(nx, ny)
            if self.water[nidx] < 70.0 and self.slope[nidx] <= 1.45:
                f.x, f.y = nx, ny

            cidx = self.cell_index_at(f.x, f.y)
            f.energy -= 0.028 if f.species == "herbivore" else 0.013

            if f.species == "herbivore":
                grazed = self.harvest_food(cidx, 0.25)
                f.energy = min(1.0, f.energy + grazed * 0.28)
                if f.energy > 0.82 and len(herbivores) < 130 and rng.random() < 0.018:
                    new_spawns.append(("herbivore", f.x, f.y))
            else:
                # Predator stalks & ambushes nearby herbivore only when hungry
                prey = None
                if f.energy < 0.72:
                    for h in herbivores:
                        if h.alive and math.hypot(h.x - f.x, h.y - f.y) <= 120.0:
                            prey = h
                            break
                if prey is not None and rng.random() < 0.22:
                    prey.alive = False
                    prey.health = 0.0
                    f.energy = min(1.0, f.energy + 0.55)
                pred_count = sum(1 for lf in living_fauna if lf.species == "predator")
                if f.energy > 0.85 and pred_count < 16 and rng.random() < 0.004:
                    new_spawns.append(("predator", f.x, f.y))

            max_age = 1800 if f.species == "herbivore" else 2200
            if f.energy <= 0.0 or f.age_ticks > max_age:
                f.alive = False
                f.health = 0.0

        # Prune dead fauna records periodically so world dict doesn't grow unbounded
        dead_ids = [fid for fid, ent in self.fauna.items() if not ent.alive]
        for fid in dead_ids:
            del self.fauna[fid]

        for sp, sx, sy in new_spawns:
            self._spawn_fauna(sp, sx, sy, rng)

    def ecosystem_summary(self) -> dict:
        total_food = sum(self.food_flora)
        total_wood = sum(self.wood_flora)
        total_herbs = sum(self.herb_flora)
        total_stone = sum(self.stone_mineral)
        avg_moisture = sum(self.moisture) / self.num_cells
        herb_count = sum(1 for f in self.fauna.values() if f.alive and f.species == "herbivore")
        pred_count = sum(1 for f in self.fauna.values() if f.alive and f.species == "predator")
        return {
            "total_food_biomass": round(total_food, 2),
            "total_wood_biomass": round(total_wood, 2),
            "total_herb_biomass": round(total_herbs, 2),
            "total_stone_mineral": round(total_stone, 2),
            "avg_soil_moisture": round(avg_moisture, 4),
            "herbivores_alive": herb_count,
            "predators_alive": pred_count,
            "weather": self.weather.to_dict(),
        }

    def to_snapshot(self) -> dict:
        return {
            "width_m": self.width_m,
            "height_m": self.height_m,
            "cell_size_m": self.cell_size_m,
            "cols": self.cols,
            "rows": self.rows,
            "seed": self.seed,
            "elevation": self.elevation,
            "slope": self.slope,
            "fertility": self.fertility,
            "moisture": self.moisture,
            "water": self.water,
            "food_flora": self.food_flora,
            "food_max": self.food_max,
            "wood_flora": self.wood_flora,
            "wood_max": self.wood_max,
            "herb_flora": self.herb_flora,
            "stone_mineral": self.stone_mineral,
            "weather": self.weather.to_dict(),
            "fauna": [f.to_dict() for f in self.fauna.values()],
            "next_fauna_id": self.next_fauna_id,
            "spring_cells": self.spring_cells,
        }

    @classmethod
    def from_snapshot(cls, data: dict) -> "WorldEngine":
        world = cls(
            width_m=float(data["width_m"]),
            height_m=float(data["height_m"]),
            cell_size_m=float(data["cell_size_m"]),
            seed=int(data["seed"]),
        )
        world.elevation = list(data["elevation"])
        world.slope = list(data["slope"])
        world.fertility = list(data["fertility"])
        world.moisture = list(data["moisture"])
        world.water = list(data["water"])
        world.food_flora = list(data["food_flora"])
        world.food_max = list(data["food_max"])
        world.wood_flora = list(data["wood_flora"])
        world.wood_max = list(data["wood_max"])
        world.herb_flora = list(data["herb_flora"])
        world.stone_mineral = list(data["stone_mineral"])
        world.weather = WeatherState.from_dict(data["weather"])
        world.next_fauna_id = int(data["next_fauna_id"])
        world.spring_cells = [int(i) for i in data.get("spring_cells", [])]
        world.fauna = {
            int(f["fauna_id"]): FaunaEntity.from_dict(f)
            for f in data.get("fauna", [])
        }
        return world
