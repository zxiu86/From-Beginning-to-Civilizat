"""Agent Engine — biology, reproduction, permanent death, lineage, action execution, and social learning."""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Tuple, TYPE_CHECKING

from .brain import AgentBrain
from .communication import SEMANTIC_CONTEXTS
from .memory import MemoryEngine
from .physics import attempt_steered_move

if TYPE_CHECKING:
    from .communication import CommunicationEngine
    from .history import HistoryKnowledgeEngine
    from .perception import LocalPerception
    from .society import SocietyEngine
    from .world import WorldEngine


ACTION_NAMES = (
    "rest",
    "move_north",
    "move_south",
    "move_east",
    "move_west",
    "forage_food",
    "drink_water",
    "gather_wood",
    "gather_stone",
    "gather_herb",
    "eat_inventory",
    "craft_or_build",
    "communicate_or_teach",
    "share_or_barter",
    "steal",
    "assault_or_kill",
    "mark_symbol_record",
    "socialize_mate_or_mediate",
)


@dataclass
class PersonalityTraits:
    boldness: float
    empathy: float
    curiosity: float
    aggression: float
    cooperation: float

    @classmethod
    def random_init(cls, rng: random.Random) -> "PersonalityTraits":
        return cls(
            boldness=round(rng.uniform(0.1, 0.95), 3),
            empathy=round(rng.uniform(0.1, 0.95), 3),
            curiosity=round(rng.uniform(0.1, 0.95), 3),
            aggression=round(rng.uniform(0.05, 0.9), 3),
            cooperation=round(rng.uniform(0.1, 0.95), 3),
        )


@dataclass
class Agent:
    """
    Independent biological & cognitive individual.
    Identity `agent_id` is permanently unique and preserved forever even after death.
    """

    agent_id: int
    sex: str  # "F" or "M"
    x: float
    y: float
    birth_tick: int
    generation: int = 0
    parent_a_id: Optional[int] = None
    parent_b_id: Optional[int] = None
    children_ids: List[int] = field(default_factory=list)

    # Biological state
    is_alive: bool = True
    death_tick: Optional[int] = None
    cause_of_death: Optional[str] = None
    age_ticks: int = 0
    health: float = 1.0
    hunger: float = 0.10  # 0 = full, 1 = starving
    thirst: float = 0.10  # 0 = hydrated, 1 = dehydrated
    energy: float = 0.85
    injury: float = 0.0
    disease_load: float = 0.0
    is_pregnant: bool = False
    gestation_ticks: int = 0
    mate_father_id: Optional[int] = None
    max_lifespan_ticks: int = 21600  # ~60 sim years +/- genetics

    # Inventory & personal emergent lexicon
    inventory: Dict[str, float] = field(
        default_factory=lambda: {"food": 2.0, "wood": 0.0, "stone": 0.0, "herb": 0.0, "tool": 0.0}
    )
    lexicon: Dict[int, Dict[str, float]] = field(default_factory=dict)  # token -> {context: confidence}
    last_emitted_token: Optional[int] = None
    last_action: str = "rest"
    carried_item: Optional[str] = None
    last_partner_id: Optional[int] = None
    last_move_dx: float = 0.0
    last_move_dy: float = 0.0

    # Rebirth & experimental timeline metadata
    rebirth_count: int = 0
    rebirth_tick: Optional[int] = None
    original_death_tick: Optional[int] = None
    original_death_date: Optional[str] = None
    original_cause_of_death: Optional[str] = None
    death_penalty_record: Optional[dict] = None

    traits: PersonalityTraits = field(default_factory=lambda: PersonalityTraits(0.5, 0.5, 0.5, 0.3, 0.5))
    memory: MemoryEngine = field(default_factory=MemoryEngine)
    brain: Optional[AgentBrain] = field(default=None, repr=False)

    @property
    def age_years(self) -> float:
        return self.age_ticks / 360.0

    @property
    def life_stage(self) -> str:
        yrs = self.age_years
        if yrs < 4.0:
            return "infant"
        if yrs < 14.0:
            return "child"
        if yrs < 48.0:
            return "adult"
        return "elder"

    def to_registry_dict(self) -> dict:
        """Serializable state excluding large neural weights (stored separately in brain bundle)."""
        return {
            "agent_id": self.agent_id,
            "sex": self.sex,
            "x": self.x,
            "y": self.y,
            "birth_tick": self.birth_tick,
            "generation": self.generation,
            "parent_a_id": self.parent_a_id,
            "parent_b_id": self.parent_b_id,
            "children_ids": list(self.children_ids),
            "is_alive": self.is_alive,
            "death_tick": self.death_tick,
            "cause_of_death": self.cause_of_death,
            "age_ticks": self.age_ticks,
            "health": self.health,
            "hunger": self.hunger,
            "thirst": self.thirst,
            "energy": self.energy,
            "injury": self.injury,
            "disease_load": self.disease_load,
            "is_pregnant": self.is_pregnant,
            "gestation_ticks": self.gestation_ticks,
            "mate_father_id": self.mate_father_id,
            "max_lifespan_ticks": self.max_lifespan_ticks,
            "inventory": dict(self.inventory),
            "lexicon": {str(tok): ctx_map for tok, ctx_map in self.lexicon.items()},
            "last_emitted_token": self.last_emitted_token,
            "last_action": self.last_action,
            "carried_item": self.carried_item,
            "last_partner_id": self.last_partner_id,
            "last_move_dx": round(self.last_move_dx, 3),
            "last_move_dy": round(self.last_move_dy, 3),
            "rebirth_count": self.rebirth_count,
            "rebirth_tick": self.rebirth_tick,
            "original_death_tick": self.original_death_tick,
            "original_death_date": self.original_death_date,
            "original_cause_of_death": self.original_cause_of_death,
            "death_penalty_record": self.death_penalty_record,
            "traits": asdict(self.traits),
            "memory": self.memory.to_dict(),
        }

    @classmethod
    def from_registry_dict(cls, d: dict, brain: Optional[AgentBrain] = None) -> "Agent":
        ag = cls(
            agent_id=int(d["agent_id"]),
            sex=str(d["sex"]),
            x=float(d["x"]),
            y=float(d["y"]),
            birth_tick=int(d["birth_tick"]),
            generation=int(d.get("generation", 0)),
            parent_a_id=d.get("parent_a_id"),
            parent_b_id=d.get("parent_b_id"),
            children_ids=[int(c) for c in d.get("children_ids", [])],
            is_alive=bool(d["is_alive"]),
            death_tick=d.get("death_tick"),
            cause_of_death=d.get("cause_of_death"),
            age_ticks=int(d["age_ticks"]),
            health=float(d["health"]),
            hunger=float(d["hunger"]),
            thirst=float(d["thirst"]),
            energy=float(d["energy"]),
            injury=float(d.get("injury", 0.0)),
            disease_load=float(d.get("disease_load", 0.0)),
            is_pregnant=bool(d.get("is_pregnant", False)),
            gestation_ticks=int(d.get("gestation_ticks", 0)),
            mate_father_id=d.get("mate_father_id"),
            max_lifespan_ticks=int(d.get("max_lifespan_ticks", 21600)),
            inventory={str(k): float(v) for k, v in d.get("inventory", {}).items()},
            lexicon={
                int(tok): {str(ctx): float(val) for ctx, val in ctx_map.items()}
                for tok, ctx_map in d.get("lexicon", {}).items()
            },
            last_emitted_token=d.get("last_emitted_token"),
            last_action=str(d.get("last_action", "rest")),
            carried_item=d.get("carried_item"),
            last_partner_id=d.get("last_partner_id"),
            last_move_dx=float(d.get("last_move_dx", 0.0)),
            last_move_dy=float(d.get("last_move_dy", 0.0)),
            rebirth_count=int(d.get("rebirth_count", 0)),
            rebirth_tick=d.get("rebirth_tick"),
            original_death_tick=d.get("original_death_tick"),
            original_death_date=d.get("original_death_date"),
            original_cause_of_death=d.get("original_cause_of_death"),
            death_penalty_record=d.get("death_penalty_record"),
            traits=PersonalityTraits(**d["traits"]),
            memory=MemoryEngine.from_dict(d["memory"]),
            brain=brain,
        )
        return ag


class AgentEngine:
    """Manages initial 100-agent creation, biological metabolism, actions, learning, births, and final deaths."""

    def __init__(self, require_torch: bool = False) -> None:
        self.all_agents: Dict[int, Agent] = {}  # Immutable archive of BOTH living and deceased individuals
        self.next_agent_id: int = 1
        self.require_torch = require_torch
        self.first_movement_tick: Optional[int] = None
        self.first_interaction_tick: Optional[int] = None
        self.first_birth_tick: Optional[int] = None
        self.first_death_tick: Optional[int] = None
        self.discovered_techs: Dict[str, int] = {}  # tech_name -> tick first discovered

    def living_agents(self) -> Dict[int, Agent]:
        return {aid: ag for aid, ag in self.all_agents.items() if ag.is_alive}

    def spawn_initial_population(
        self,
        count: int,
        world: "WorldEngine",
        rng: random.Random,
        obs_dim: int,
        hidden_dim: int,
        num_actions: int,
        num_signals: int,
        learning_rate: float,
    ) -> None:
        """Spawn 100 distinct independent individuals with zero pre-built language, laws, or culture."""
        for i in range(count):
            # Pick dry habitable land within initial watershed sensory horizon (~110m of water)
            x, y = world.width_m * 0.5, world.height_m * 0.5
            for attempt in range(120):
                tx = rng.uniform(120.0, world.width_m - 120.0)
                ty = rng.uniform(120.0, world.height_m - 120.0)
                cidx = world.cell_index_at(tx, ty)
                rad = 110.0 if attempt < 90 else 160.0
                if world.water[cidx] < 50.0 and world.food_flora[cidx] > 1.0 and world.has_nearby_water(tx, ty, rad) is not None:
                    x, y = tx, ty
                    break

            aid = self.next_agent_id
            self.next_agent_id += 1
            brain = AgentBrain(
                agent_id=aid,
                obs_dim=obs_dim,
                hidden_dim=hidden_dim,
                num_actions=num_actions,
                num_signals=num_signals,
                learning_rate=learning_rate,
                seed=rng.randint(1, 2_000_000_000),
                require_torch=self.require_torch,
            )
            ag = Agent(
                agent_id=aid,
                sex="F" if (i % 2 == 0) else "M",
                x=x,
                y=y,
                birth_tick=0,
                generation=0,
                age_ticks=rng.randint(16 * 360, 26 * 360),  # Young adults ready to explore/learn
                max_lifespan_ticks=rng.randint(18000, 27000),
                traits=PersonalityTraits.random_init(rng),
                brain=brain,
            )
            self.all_agents[aid] = ag

    def spawn_newborn(
        self,
        tick: int,
        mother: Agent,
        father_id: Optional[int],
        rng: random.Random,
        obs_dim: int,
        hidden_dim: int,
        num_actions: int,
        num_signals: int,
        learning_rate: float,
    ) -> Agent:
        """
        Birth creates a brand-new independent agent with its OWN fresh neural weights
        and EMPTY personal memories (never cloning dead or parental brains).
        """
        aid = self.next_agent_id
        self.next_agent_id += 1
        brain = AgentBrain(
            agent_id=aid,
            obs_dim=obs_dim,
            hidden_dim=hidden_dim,
            num_actions=num_actions,
            num_signals=num_signals,
            learning_rate=learning_rate,
            seed=rng.randint(1, 2_000_000_000),
            require_torch=self.require_torch,
        )
        # Subtle heritable temperament drift (NOT memories or knowledge!)
        father = self.all_agents.get(father_id) if father_id is not None else None
        def mix_trait(a: float, b: float) -> float:
            return round(max(0.05, min(0.95, 0.5 * (a + b) + rng.gauss(0.0, 0.1))), 3)

        traits = PersonalityTraits(
            boldness=mix_trait(mother.traits.boldness, father.traits.boldness if father else 0.5),
            empathy=mix_trait(mother.traits.empathy, father.traits.empathy if father else 0.5),
            curiosity=mix_trait(mother.traits.curiosity, father.traits.curiosity if father else 0.5),
            aggression=mix_trait(mother.traits.aggression, father.traits.aggression if father else 0.3),
            cooperation=mix_trait(mother.traits.cooperation, father.traits.cooperation if father else 0.5),
        )
        child = Agent(
            agent_id=aid,
            sex=rng.choice(["F", "M"]),
            x=mother.x + rng.uniform(-4.0, 4.0),
            y=mother.y + rng.uniform(-4.0, 4.0),
            birth_tick=tick,
            generation=mother.generation + 1,
            parent_a_id=mother.agent_id,
            parent_b_id=father_id,
            age_ticks=0,
            health=0.95,
            hunger=0.15,
            thirst=0.15,
            energy=0.80,
            inventory={"food": 0.4, "wood": 0.0, "stone": 0.0, "herb": 0.0, "tool": 0.0},
            traits=traits,
            memory=MemoryEngine(),  # Strictly empty memory at birth!
            brain=brain,
        )
        # Initial family bond only (no knowledge/words pre-installed)
        child.memory.update_social(mother.agent_id, 0.35, 0.45)
        mother.memory.update_social(aid, 0.45, 0.65)
        mother.children_ids.append(aid)
        if father is not None:
            father.children_ids.append(aid)
            if father.is_alive:
                child.memory.update_social(father.agent_id, 0.2, 0.25)
                father.memory.update_social(aid, 0.3, 0.45)

        self.all_agents[aid] = child
        return child

    def kill_agent(
        self,
        agent: Agent,
        tick: int,
        sim_date: str,
        cause: str,
        history: "HistoryKnowledgeEngine",
    ) -> None:
        """
        Permanent death in the current timeline: halts living agency while archiving full identity,
        applying local evidence-based death-penalty neural learning, and preserving neural weights
        and pre-death personal memory strictly bounded to <= death_tick for archival/experimental rebirth.
        """
        if not agent.is_alive:
            return
        agent.is_alive = False
        agent.health = 0.0
        agent.energy = 0.0
        agent.is_pregnant = False
        agent.last_partner_id = None
        agent.death_tick = tick
        agent.cause_of_death = cause
        if agent.original_death_tick is None:
            agent.original_death_tick = tick
            agent.original_death_date = sim_date
            agent.original_cause_of_death = cause

        # Apply cause-linked local neural penalty strictly from this agent's own preceding perceived trace
        if agent.brain is not None:
            agent.death_penalty_record = agent.brain.apply_death_penalty_learning(
                cause=cause,
                death_tick=tick,
                perceived_cues={
                    "hunger": agent.hunger,
                    "thirst": agent.thirst,
                    "injury": agent.injury,
                    "disease": agent.disease_load,
                },
            )

        if self.first_death_tick is None:
            self.first_death_tick = tick
            history.record_truth(
                tick, sim_date, "first_death", [agent.agent_id], agent.x, agent.y,
                f"First individual death: agent {agent.agent_id} died of {cause} at age {agent.age_years:.1f}y.",
            )
        history.record_truth(
            tick, sim_date, "death", [agent.agent_id], agent.x, agent.y,
            f"Agent {agent.agent_id} died permanently ({cause}).",
        )

    def compute_action_bias(self, agent: Agent, perc: "LocalPerception") -> List[float]:
        """
        Homeostatic biological urges & strictly local sensory directional cues.
        Neural weights still learn and drive individualized choices.
        """
        bias = [0.0] * len(ACTION_NAMES)
        food_dx, food_dy = perc.obs_vector[18], perc.obs_vector[19]
        water_dx, water_dy = perc.obs_vector[20], perc.obs_vector[21]
        near_dx, near_dy = perc.obs_vector[24], perc.obs_vector[25]

        # Persistent exploration heading when blindly searching (avoids stationary E-W oscillation)
        phase = ((agent.agent_id * 37 + agent.age_ticks // 10) % 4)
        search_move = (1, 3, 2, 4)[phase]  # N, E, S, W sweep

        # Thirst drive: drink ONLY if water is actually in reach; otherwise move toward sensed/remembered water
        if agent.thirst > 0.35:
            urgency = 1.45 if agent.thirst > 0.65 else 1.0
            if perc.local_water > 0.25:
                bias[6] += 5.2 * agent.thirst * urgency  # drink_water
            else:
                bias[6] -= 2.5
                if abs(water_dx) > 0.02 or abs(water_dy) > 0.02:
                    bias[3 if water_dx > 0 else 4] += 4.6 * agent.thirst * urgency * abs(water_dx)
                    bias[2 if water_dy > 0 else 1] += 4.6 * agent.thirst * urgency * abs(water_dy)
                else:
                    bias[search_move] += 2.6 * agent.thirst * urgency

        # Hunger drive: eat inventory or forage if local food exists; otherwise move toward sensed/remembered food
        if agent.hunger > 0.38:
            if agent.inventory.get("food", 0.0) >= 0.4:
                bias[10] += 4.0 * agent.hunger  # eat_inventory
            elif perc.local_food > 0.25:
                bias[5] += 3.6 * agent.hunger  # forage_food
            else:
                bias[5] -= 1.5
                if abs(food_dx) > 0.02 or abs(food_dy) > 0.02:
                    bias[3 if food_dx > 0 else 4] += 3.2 * agent.hunger * abs(food_dx)
                    bias[2 if food_dy > 0 else 1] += 3.2 * agent.hunger * abs(food_dy)
                else:
                    bias[search_move] += 1.6 * agent.hunger

        if agent.energy < 0.25:
            bias[0] += 2.6  # rest

        # Infants stay close to their mother and nurse/learn safely rather than wandering away alone
        if agent.life_stage == "infant":
            bias[0] += 1.4
            bias[14] -= 3.5
            bias[15] -= 4.0
            if agent.parent_a_id is not None and agent.parent_a_id in perc.nearby_agent_ids:
                mom = self.all_agents.get(agent.parent_a_id)
                if mom is not None and mom.is_alive:
                    mdx = mom.x - agent.x
                    mdy = mom.y - agent.y
                    mdist = math.hypot(mdx, mdy)
                    if mdist > 20.0:
                        bias[3 if mdx > 0 else 4] += 2.8 * (abs(mdx) / mdist)
                        bias[2 if mdy > 0 else 1] += 2.8 * (abs(mdy) / mdist)

        # Natural social bonding / mating readiness when basic biological needs are satisfied
        if agent.thirst < 0.45 and agent.hunger < 0.45 and agent.health > 0.70 and agent.life_stage != "infant":
            if perc.nearest_agent_id is not None and perc.nearest_agent_dist <= 32.0:
                bias[17] += 1.5 * agent.traits.cooperation + 0.55
                bias[12] += 0.75 * agent.traits.cooperation
            elif perc.nearest_agent_id is not None:
                bias[3 if near_dx > 0 else 4] += 0.75 * abs(near_dx)
                bias[2 if near_dy > 0 else 1] += 0.75 * abs(near_dy)

        # Personality & motive modulation (crimes remain 100% unblocked, driven by real aggression/desperation/grudge)
        bias[12] += 0.35 * agent.traits.cooperation
        bias[13] += 0.35 * agent.traits.empathy
        bias[16] += 0.35 * agent.traits.curiosity

        if perc.nearest_agent_id is None or perc.nearest_agent_dist > 35.0:
            bias[14] -= 2.0
            bias[15] -= 2.2
        else:
            trust = perc.nearest_agent_trust
            theft_motive = max(0.0, agent.hunger - 0.45) * 2.2 + 0.45 * (1.0 - agent.traits.empathy) - 0.7 * agent.traits.cooperation - max(0.0, trust) * 0.8 - 0.4
            violence_motive = 1.0 * agent.traits.aggression + 1.5 * max(0.0, -trust) - 1.15 * agent.traits.empathy - 0.55 * agent.traits.cooperation - 0.7
            bias[14] += theft_motive
            bias[15] += violence_motive
        return bias

    def execute_action(
        self,
        agent: Agent,
        action_idx: int,
        signal_idx: int,
        perc: "LocalPerception",
        tick: int,
        sim_date: str,
        world: "WorldEngine",
        comm: "CommunicationEngine",
        society: "SocietyEngine",
        history: "HistoryKnowledgeEngine",
        rng: random.Random,
    ) -> float:
        """Execute chosen action with real biological/material costs and return experiential reward."""
        act = ACTION_NAMES[action_idx]
        agent.last_action = act
        agent.last_partner_id = None
        agent.last_move_dx = 0.0
        agent.last_move_dy = 0.0
        reward = 0.0

        # Base daily metabolism
        agent.age_ticks += 1
        agent.hunger = min(1.0, agent.hunger + 0.032)
        agent.thirst = min(1.0, agent.thirst + 0.038)
        if world.weather.rainfall_mm >= 1.5:
            agent.thirst = max(0.0, agent.thirst - 0.08)
        agent.energy = max(0.0, agent.energy - 0.025)

        # Infant nursing/care transfer from nearby mother if hungry
        if agent.life_stage == "infant" and agent.parent_a_id in perc.nearby_agent_ids:
            mom = self.all_agents.get(agent.parent_a_id)
            if mom and mom.is_alive and mom.hunger < 0.75:
                agent.hunger = max(0.0, agent.hunger - 0.09)
                agent.thirst = max(0.0, agent.thirst - 0.09)

        cidx = world.cell_index_at(agent.x, agent.y)
        carry_load = (
            agent.inventory.get("wood", 0.0) * 0.015
            + agent.inventory.get("stone", 0.0) * 0.02
            + agent.inventory.get("tool", 0.0) * 0.01
        )
        carry_drag = max(0.75, 1.0 - min(0.25, carry_load))
        move_speed = 38.0 * max(0.35, 1.0 - 0.45 * world.slope[cidx]) * carry_drag * (0.4 if agent.life_stage == "infant" else 1.0)
        if world.weather.condition in ("storm", "flood"):
            move_speed *= 0.65

        # Update or invalidate local spatial memories accurately
        if perc.local_food > 0.6:
            agent.memory.remember_location(tick, cidx, agent.x, agent.y, "food", perc.local_food)
        elif perc.local_food < 0.15:
            agent.memory.forget_depleted_near(agent.x, agent.y, "food", radius_m=45.0)

        w_near_idx = world.has_nearby_water(agent.x, agent.y, radius_m=40.0)
        if w_near_idx is not None and world.water[w_near_idx] > 0.5:
            wc, wr = w_near_idx % world.cols, w_near_idx // world.cols
            agent.memory.remember_location(
                tick,
                w_near_idx,
                (wc + 0.5) * world.cell_size_m,
                (wr + 0.5) * world.cell_size_m,
                "water",
                world.water[w_near_idx],
            )
        elif perc.local_water < 0.25:
            agent.memory.forget_depleted_near(agent.x, agent.y, "water", radius_m=45.0)

        if act == "rest":
            agent.energy = min(1.0, agent.energy + 0.22)
            agent.injury = max(0.0, agent.injury - 0.04)
            if agent.inventory.get("herb", 0.0) >= 0.3 and agent.disease_load > 0.15:
                agent.inventory["herb"] -= 0.3
                agent.disease_load = max(0.0, agent.disease_load - 0.25)
                agent.memory.practice_skill("healing", 0.08)
                reward += 0.25
            reward += 0.08 if agent.energy < 0.4 else -0.02

        elif act in ("move_north", "move_south", "move_east", "move_west"):
            dir_x, dir_y = {
                "move_north": (0.0, -1.0),
                "move_south": (0.0, 1.0),
                "move_east": (1.0, 0.0),
                "move_west": (-1.0, 0.0),
            }[act]
            nearby_coords = [
                (self.all_agents[nid].x, self.all_agents[nid].y)
                for nid in perc.nearby_agent_ids[:12]
                if nid in self.all_agents and self.all_agents[nid].is_alive
            ]
            nx, ny, moved_m = attempt_steered_move(
                world=world,
                x=agent.x,
                y=agent.y,
                target_dx=dir_x + rng.uniform(-0.15, 0.15),
                target_dy=dir_y + rng.uniform(-0.15, 0.15),
                step_dist=move_speed,
                nearby_obstacles=nearby_coords,
            )
            if moved_m > 0.2:
                agent.last_move_dx = nx - agent.x
                agent.last_move_dy = ny - agent.y
                agent.x, agent.y = nx, ny
                nidx = world.cell_index_at(nx, ny)
                slope_cost = 0.04 * (1.0 + 0.5 * world.slope[nidx])
                agent.energy = max(0.0, agent.energy - slope_cost)
                if self.first_movement_tick is None:
                    self.first_movement_tick = tick
                    history.record_truth(
                        tick, sim_date, "first_movement", [agent.agent_id], nx, ny,
                        f"First purposeful movement recorded by agent {agent.agent_id}.",
                    )
                reward += 0.03
            else:
                reward -= 0.02

        elif act == "forage_food":
            skill_bonus = 1.0 + 0.6 * agent.memory.skills.get("foraging", 0.1)
            tool_bonus = 1.35 if agent.inventory.get("tool", 0.0) >= 1.0 else 1.0
            # Harvest best cell within immediate 3x3 reach (matching PerceptionEngine.local_food)
            c0, r0 = world.cell_coords_at(agent.x, agent.y)
            best_idx = cidx
            best_val = world.food_flora[cidx]
            for dr in (-1, 0, 1):
                rr = r0 + dr
                if 0 <= rr < world.rows:
                    for dc in (-1, 0, 1):
                        cc = c0 + dc
                        if 0 <= cc < world.cols:
                            idx_n = rr * world.cols + cc
                            if world.food_flora[idx_n] > best_val:
                                best_val = world.food_flora[idx_n]
                                best_idx = idx_n
            gathered = world.harvest_food(best_idx, 1.35 * skill_bonus * tool_bonus)
            agent.energy = max(0.0, agent.energy - 0.045)
            agent.memory.practice_skill("foraging", 0.04)
            if gathered > 0.05:
                agent.inventory["food"] = min(10.0, agent.inventory.get("food", 0.0) + gathered)
                # Eat immediately if hungry
                if agent.hunger > 0.15 and agent.inventory["food"] >= 0.3:
                    consume = min(agent.inventory["food"], 0.9)
                    agent.inventory["food"] -= consume
                    agent.hunger = max(0.0, agent.hunger - consume * 0.75)
                reward += 0.45 * min(1.5, gathered)
            else:
                reward -= 0.12

        elif act == "drink_water":
            w_idx = world.has_nearby_water(agent.x, agent.y, radius_m=40.0)
            if w_idx is not None:
                taken = world.consume_water(w_idx, 0.8)
                if taken > 0.05:
                    agent.thirst = max(0.0, agent.thirst - 0.75)
                    wc, wr = w_idx % world.cols, w_idx // world.cols
                    if world.water[w_idx] > 0.5:
                        agent.memory.remember_location(
                            tick,
                            w_idx,
                            (wc + 0.5) * world.cell_size_m,
                            (wr + 0.5) * world.cell_size_m,
                            "water",
                            world.water[w_idx],
                        )
                    else:
                        agent.memory.forget_depleted_near(agent.x, agent.y, "water", radius_m=45.0)
                    reward += 0.55
                else:
                    agent.memory.forget_depleted_near(agent.x, agent.y, "water", radius_m=45.0)
                    reward -= 0.10
            else:
                agent.memory.forget_depleted_near(agent.x, agent.y, "water", radius_m=45.0)
                reward -= 0.15

        elif act == "gather_wood":
            taken = world.harvest_wood(cidx, 0.8)
            agent.energy = max(0.0, agent.energy - 0.05)
            if taken > 0.05:
                agent.inventory["wood"] = min(10.0, agent.inventory.get("wood", 0.0) + taken)
                agent.carried_item = "wood"
                reward += 0.18
            else:
                reward -= 0.08

        elif act == "gather_stone":
            taken = world.harvest_stone(cidx, 0.7)
            agent.energy = max(0.0, agent.energy - 0.06)
            if taken > 0.05:
                agent.inventory["stone"] = min(10.0, agent.inventory.get("stone", 0.0) + taken)
                agent.carried_item = "stone"
                reward += 0.18
            else:
                reward -= 0.08

        elif act == "gather_herb":
            taken = world.harvest_herb(cidx, 0.5)
            agent.energy = max(0.0, agent.energy - 0.04)
            if taken > 0.05:
                agent.inventory["herb"] = min(5.0, agent.inventory.get("herb", 0.0) + taken)
                agent.carried_item = "herb"
                reward += 0.15
            else:
                reward -= 0.06

        elif act == "eat_inventory":
            if agent.inventory.get("food", 0.0) >= 0.3:
                amt = min(agent.inventory["food"], 0.7)
                agent.inventory["food"] -= amt
                agent.hunger = max(0.0, agent.hunger - amt * 0.75)
                reward += 0.40
            else:
                reward -= 0.12

        elif act == "craft_or_build":
            agent.energy = max(0.0, agent.energy - 0.06)
            if agent.inventory.get("stone", 0.0) >= 0.6 and agent.inventory.get("wood", 0.0) >= 0.4:
                agent.inventory["stone"] -= 0.6
                agent.inventory["wood"] -= 0.4
                agent.inventory["tool"] = min(4.0, agent.inventory.get("tool", 0.0) + 1.0)
                agent.memory.practice_skill("tool_shaping", 0.12)
                if "stone_toolmaking" not in self.discovered_techs:
                    self.discovered_techs["stone_toolmaking"] = tick
                    history.record_truth(
                        tick, sim_date, "tech_discovered", [agent.agent_id], agent.x, agent.y,
                        f"Agent {agent.agent_id} shaped the first composite stone-and-wood tool.",
                    )
                reward += 0.40
            elif agent.inventory.get("wood", 0.0) >= 1.2:
                agent.inventory["wood"] -= 1.2
                agent.memory.practice_skill("shelter_building", 0.12)
                agent.energy = min(1.0, agent.energy + 0.10)
                if "simple_shelter" not in self.discovered_techs:
                    self.discovered_techs["simple_shelter"] = tick
                    history.record_truth(
                        tick, sim_date, "tech_discovered", [agent.agent_id], agent.x, agent.y,
                        f"Agent {agent.agent_id} constructed the first primitive wooden shelter.",
                    )
                reward += 0.32
            else:
                reward -= 0.08

        elif act == "communicate_or_teach":
            ctx = self._infer_current_context(agent, perc)
            gesture = signal_idx % 8
            em, comm_evs = comm.emit(
                tick=tick,
                speaker_id=agent.agent_id,
                x=agent.x,
                y=agent.y,
                token=signal_idx,
                gesture=gesture,
                context_tag=ctx,
                prev_token=agent.last_emitted_token,
            )
            agent.last_emitted_token = signal_idx
            # Strengthen speaker's own association
            tok_map = agent.lexicon.setdefault(signal_idx, {})
            tok_map[ctx] = round(min(1.0, tok_map.get(ctx, 0.0) + 0.15), 4)

            for ev in comm_evs:
                history.record_truth(
                    tick, sim_date, ev["event_type"], ev["agent_ids"], ev["x"], ev["y"], ev["description"]
                )

            # Nearby listeners learn through observation/imitation (with transmission noise/mutation)
            if perc.nearby_agent_ids:
                agent.last_partner_id = perc.nearby_agent_ids[0]
                if self.first_interaction_tick is None:
                    self.first_interaction_tick = tick
                    history.record_truth(
                        tick, sim_date, "first_interaction", [agent.agent_id, perc.nearby_agent_ids[0]],
                        agent.x, agent.y, f"First direct social interaction near ({int(agent.x)}, {int(agent.y)}).",
                    )
                for lid in perc.nearby_agent_ids[:4]:
                    listener = self.all_agents.get(lid)
                    if listener is None or not listener.is_alive:
                        continue
                    # Listener infers context ONLY from what THEY locally sense (no telepathy!)
                    inferred_ctx = self._infer_current_context(listener, perc)
                    # Transmission noise: listener may slightly mishear or adapt meaning
                    if rng.random() < 0.12:
                        inferred_ctx = rng.choice(SEMANTIC_CONTEXTS)
                    l_map = listener.lexicon.setdefault(signal_idx, {})
                    l_map[inferred_ctx] = round(min(1.0, l_map.get(inferred_ctx, 0.0) + 0.14), 4)
                    listener.memory.update_social(agent.agent_id, 0.05, 0.03)
                    agent.memory.update_social(lid, 0.05, 0.03)

                    # Social skill teaching/imitation (NOT copying private memory!)
                    for sk, prof in agent.memory.skills.items():
                        if prof > listener.memory.skills.get(sk, 0.0) + 0.08:
                            # Imperfect transfer: child/learner absorbs partial skill with random drift
                            transfer = (prof - listener.memory.skills[sk]) * rng.uniform(0.08, 0.22)
                            listener.memory.practice_skill(sk, transfer)

                    align_evs = comm.observe_shared_alignment(
                        tick=tick,
                        listener_id=lid,
                        speaker_id=agent.agent_id,
                        token=signal_idx,
                        inferred_context=inferred_ctx,
                        x=agent.x,
                        y=agent.y,
                        listener_confidence=l_map[inferred_ctx],
                        is_cross_generation=(listener.generation != agent.generation),
                    )
                    for ev in align_evs:
                        history.record_truth(
                            tick, sim_date, ev["event_type"], ev["agent_ids"], ev["x"], ev["y"], ev["description"]
                        )
                reward += 0.16
            else:
                reward += 0.01

        elif act == "share_or_barter":
            target_id = perc.nearest_agent_id
            if target_id is not None and perc.nearest_agent_dist <= 38.0:
                other = self.all_agents.get(target_id)
                if other and other.is_alive:
                    agent.last_partner_id = other.agent_id
                    if self.first_interaction_tick is None:
                        self.first_interaction_tick = tick
                        history.record_truth(
                            tick, sim_date, "first_interaction", [agent.agent_id, other.agent_id],
                            agent.x, agent.y, "First cooperative interaction via resource sharing.",
                        )
                    # Voluntary food gift or barter
                    if agent.inventory.get("food", 0.0) >= 0.8 and other.hunger > 0.45:
                        gift = 0.5
                        agent.inventory["food"] -= gift
                        other.inventory["food"] = min(10.0, other.inventory.get("food", 0.0) + gift)
                        agent.memory.update_social(other.agent_id, 0.10, 0.14)
                        other.memory.update_social(agent.agent_id, 0.12, 0.20)
                        other.memory.record_episode(tick, "aid_received", agent.x, agent.y, agent.agent_id, 0.7, "food_gift")
                        used_token = False
                        if other.inventory.get("stone", 0.0) >= 0.4:
                            other.inventory["stone"] -= 0.4
                            agent.inventory["stone"] = min(10.0, agent.inventory.get("stone", 0.0) + 0.4)
                            used_token = True
                        barter_evs = society.record_barter(tick, agent.agent_id, other.agent_id, agent.x, agent.y, used_token=used_token)
                        for ev in barter_evs:
                            history.record_truth(
                                tick, sim_date, ev["event_type"], ev["agent_ids"], ev["x"], ev["y"], ev["description"]
                            )
                        reward += 0.30
                    else:
                        reward -= 0.04
            else:
                reward -= 0.08

        elif act == "steal":
            target_id = perc.nearest_agent_id
            if target_id is not None and perc.nearest_agent_dist <= 35.0 and agent.life_stage != "infant":
                victim = self.all_agents.get(target_id)
                if victim and victim.is_alive and victim.inventory.get("food", 0.0) >= 0.35:
                    agent.last_partner_id = victim.agent_id
                    stolen = min(0.7, victim.inventory["food"])
                    victim.inventory["food"] -= stolen
                    agent.inventory["food"] = min(10.0, agent.inventory.get("food", 0.0) + stolen)
                    witnesses = [wid for wid in perc.nearby_agent_ids if wid != victim.agent_id]
                    witnesses.append(victim.agent_id)
                    victim.memory.update_social(agent.agent_id, 0.15, -0.55)
                    victim.memory.record_episode(tick, "theft_suffered", agent.x, agent.y, agent.agent_id, -0.8, "stolen_food")
                    for wid in witnesses:
                        w_ag = self.all_agents.get(wid)
                        if w_ag and w_ag.is_alive:
                            w_ag.memory.update_social(agent.agent_id, 0.08, -0.35)
                    _, crime_evs = society.record_crime(
                        tick, sim_date, "theft", agent.agent_id, victim.agent_id, agent.x, agent.y, witnesses
                    )
                    history.record_truth(
                        tick, sim_date, "crime_theft", [agent.agent_id, victim.agent_id], agent.x, agent.y,
                        f"Agent {agent.agent_id} stole {stolen:.2f} food from agent {victim.agent_id}.",
                    )
                    for ev in crime_evs:
                        history.record_truth(
                            tick, sim_date, ev["event_type"], ev["agent_ids"], ev["x"], ev["y"], ev["description"]
                        )
                    reward += 0.25 if agent.hunger > 0.5 else 0.05
                else:
                    reward -= 0.08
            else:
                reward -= 0.08

        elif act == "assault_or_kill":
            target_id = perc.nearest_agent_id
            if target_id is not None and perc.nearest_agent_dist <= 32.0 and agent.life_stage != "infant":
                victim = self.all_agents.get(target_id)
                if victim and victim.is_alive:
                    agent.last_partner_id = victim.agent_id
                    agent.energy = max(0.0, agent.energy - 0.12)
                    dmg = rng.uniform(0.18, 0.38) + (0.20 if agent.inventory.get("tool", 0.0) >= 1.0 else 0.0)
                    victim.health = max(0.0, victim.health - dmg)
                    victim.injury = min(1.0, victim.injury + dmg * 0.7)
                    witnesses = [wid for wid in perc.nearby_agent_ids if wid != victim.agent_id]
                    for wid in witnesses:
                        w_ag = self.all_agents.get(wid)
                        if w_ag and w_ag.is_alive:
                            w_ag.memory.update_social(agent.agent_id, 0.15, -0.70)
                            w_ag.memory.record_episode(tick, "violence_witnessed", agent.x, agent.y, agent.agent_id, -0.85, "assault")

                    if victim.health <= 0.0:
                        self.kill_agent(victim, tick, sim_date, f"murdered_by_{agent.agent_id}", history)
                        _, crime_evs = society.record_crime(
                            tick, sim_date, "murder", agent.agent_id, victim.agent_id, agent.x, agent.y, witnesses
                        )
                        history.record_truth(
                            tick, sim_date, "crime_murder", [agent.agent_id, victim.agent_id], agent.x, agent.y,
                            f"Agent {agent.agent_id} killed agent {victim.agent_id}.",
                        )
                    else:
                        victim.memory.update_social(agent.agent_id, 0.20, -0.85)
                        victim.memory.record_episode(tick, "attack_suffered", agent.x, agent.y, agent.agent_id, -0.95, "assault")
                        _, crime_evs = society.record_crime(
                            tick, sim_date, "assault", agent.agent_id, victim.agent_id, agent.x, agent.y, witnesses
                        )
                        history.record_truth(
                            tick, sim_date, "crime_assault", [agent.agent_id, victim.agent_id], agent.x, agent.y,
                            f"Agent {agent.agent_id} assaulted agent {victim.agent_id}.",
                        )
                    for ev in crime_evs:
                        history.record_truth(
                            tick, sim_date, ev["event_type"], ev["agent_ids"], ev["x"], ev["y"], ev["description"]
                        )
                    reward -= 0.10
                else:
                    reward -= 0.08
            else:
                reward -= 0.08

        elif act == "mark_symbol_record":
            # Agent attempts to carve/mark an external symbol record from personal episodic memories
            if agent.memory.episodic and (len(agent.lexicon) >= 1 or agent.traits.curiosity > 0.5):
                recent_ep = agent.memory.episodic[-1]
                medium = "stone_carving" if agent.inventory.get("stone", 0.0) >= 0.4 else "earth_mark"
                if medium == "stone_carving":
                    agent.inventory["stone"] -= 0.4
                tokens = sorted(agent.lexicon.keys())[:3] or [signal_idx]
                obs_ids = [recent_ep.other_agent_id] if recent_ep.other_agent_id is not None else [agent.agent_id]
                _, _, doc_truths = history.create_artifact_and_chronicle(
                    tick=tick,
                    sim_date=sim_date,
                    author_id=agent.agent_id,
                    x=agent.x,
                    y=agent.y,
                    medium=medium,
                    symbol_tokens=tokens,
                    topic=recent_ep.event_kind,
                    observed_agent_ids=obs_ids,
                    author_skill=agent.memory.skills.get("symbol_marking", 0.0),
                    author_bias=(agent.traits.aggression - agent.traits.empathy),
                    rng=rng,
                )
                agent.memory.practice_skill("symbol_marking", 0.10)
                reward += 0.15
            else:
                reward -= 0.05

            # Also allow younger generations to inspect nearby old artifacts (Layer 3 interpretation!)
            if perc.nearby_artifacts and agent.generation >= 1:
                history.attempt_generational_interpretation(
                    tick=tick,
                    interpreter_id=agent.agent_id,
                    interpreter_age_years=agent.age_years,
                    nearby_artifacts=perc.nearby_artifacts,
                    rng=rng,
                )

        elif act == "socialize_mate_or_mediate":
            if perc.nearest_agent_id is not None:
                agent.last_partner_id = perc.nearest_agent_id
            # 1) Try group formation / norm proposal / dispute mediation if trusting peers nearby
            allies = [
                oid for oid in perc.nearby_agent_ids
                if agent.memory.trust.get(oid, 0.0) >= 0.15
            ]
            grp_evs = society.maybe_form_or_evolve_group(
                tick=tick,
                proposer_id=agent.agent_id,
                proposer_x=agent.x,
                proposer_y=agent.y,
                proposer_mediation_skill=agent.memory.skills.get("mediation", 0.0),
                allied_nearby_ids=allies,
                rng=rng,
            )
            for ev in grp_evs:
                history.record_truth(
                    tick, sim_date, ev["event_type"], ev["agent_ids"], ev["x"], ev["y"], ev["description"]
                )
            disp_ev = society.resolve_dispute_in_group(tick, agent.agent_id, agent.x, agent.y)
            if disp_ev is not None:
                agent.memory.practice_skill("mediation", 0.12)
                history.record_truth(
                    tick, sim_date, disp_ev["event_type"], disp_ev["agent_ids"], disp_ev["x"], disp_ev["y"], disp_ev["description"]
                )
                reward += 0.25

            # 2) Biological & social reproduction check (never timer-based!)
            if (
                agent.sex == "F"
                and not agent.is_pregnant
                and 16.0 <= agent.age_years <= 44.0
                and agent.health >= 0.70
                and agent.hunger < 0.50
                and agent.thirst < 0.50
            ):
                for oid in perc.nearby_agent_ids:
                    partner = self.all_agents.get(oid)
                    if (
                        partner is not None
                        and partner.is_alive
                        and partner.sex == "M"
                        and 16.0 <= partner.age_years <= 55.0
                        and partner.health >= 0.65
                        and math.hypot(partner.x - agent.x, partner.y - agent.y) <= 35.0
                        and agent.memory.trust.get(oid, 0.0) >= -0.05
                    ):
                        p_conceive = 0.48 if agent.memory.trust.get(oid, 0.0) >= 0.08 else 0.32
                        if rng.random() < p_conceive:
                            agent.is_pregnant = True
                            agent.gestation_ticks = 0
                            agent.mate_father_id = partner.agent_id
                            agent.memory.update_social(partner.agent_id, 0.25, 0.30)
                            partner.memory.update_social(agent.agent_id, 0.25, 0.30)
                            reward += 0.30
                            break

        # Post-action biological updates: starvation, dehydration, disease, weather exposure, predator risk
        if agent.hunger >= 0.95:
            agent.health -= 0.06
            reward -= 0.60
        if agent.thirst >= 0.95:
            agent.health -= 0.08
            reward -= 0.75

        # Weather cold/heat stress without shelter/energy
        if world.weather.temperature_c < 2.0 or world.weather.temperature_c > 36.0:
            shelter_mitigation = min(0.7, agent.memory.skills.get("shelter_building", 0.0))
            agent.energy = max(0.0, agent.energy - 0.025 * (1.0 - shelter_mitigation))

        # Environmental disease exposure
        if agent.disease_load <= 0.0 and rng.random() < world.weather.disease_pressure * (1.2 - 0.5 * agent.health):
            agent.disease_load = 0.25
        elif agent.disease_load > 0.0:
            agent.health -= 0.015 * agent.disease_load
            if agent.health > 0.6 and rng.random() < 0.08:
                agent.disease_load = max(0.0, agent.disease_load - 0.1)

        # Predator hazard in immediate vicinity
        if perc.local_predator_dist < 28.0 and rng.random() < 0.08:
            tool_def = 0.45 if agent.inventory.get("tool", 0.0) >= 1.0 else 1.0
            agent.health -= 0.22 * tool_def
            agent.injury = min(1.0, agent.injury + 0.20 * tool_def)
            agent.memory.record_episode(tick, "danger_predator", agent.x, agent.y, None, -0.8, "predator_attack")
            reward -= 0.45

        # Natural recovery when well-fed and hydrated
        if agent.hunger < 0.45 and agent.thirst < 0.45 and agent.energy > 0.4 and agent.disease_load < 0.15:
            agent.health = min(1.0, agent.health + 0.02)

        # Check fatal biological failure or old age
        if agent.health <= 0.0:
            cause = "starvation" if agent.hunger >= 0.9 else ("dehydration" if agent.thirst >= 0.9 else "illness_or_injury")
            self.kill_agent(agent, tick, sim_date, cause, history)
            return reward - 2.0
        if agent.age_ticks >= agent.max_lifespan_ticks:
            self.kill_agent(agent, tick, sim_date, "old_age", history)
            return reward

        return reward

    def _infer_current_context(self, agent: Agent, perc: "LocalPerception") -> str:
        if perc.local_predator_dist < 75.0:
            return "ctx_predator"
        if agent.injury > 0.35:
            return "ctx_hostile"
        if perc.local_food > 2.0 and agent.hunger > 0.3:
            return "ctx_food"
        if perc.local_water > 10.0 and agent.thirst > 0.3:
            return "ctx_water"
        if agent.hunger > 0.7 or agent.health < 0.45:
            return "ctx_aid"
        if perc.nearby_artifacts:
            return "ctx_record"
        if agent.parent_a_id in perc.nearby_agent_ids or any(c in perc.nearby_agent_ids for c in agent.children_ids):
            return "ctx_kin"
        return "ctx_share"
