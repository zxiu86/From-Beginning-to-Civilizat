"""Three-Layer History & Knowledge Engine — strict isolation between Ground Truth and Agent Knowledge."""

from __future__ import annotations

import random
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional


@dataclass
class TruthEvent:
    """Layer 1: Objective ground truth. Strictly NEVER readable by simulation agents."""

    event_id: int
    tick: int
    sim_date: str
    event_type: str
    agent_ids: List[int]
    x: float
    y: float
    certainty: float
    source: str
    description: str
    metadata: Dict[str, object] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "TruthEvent":
        return cls(**d)


@dataclass
class SurfaceArtifact:
    """Physical rock carving, earth mark, or portable token created by an agent in the world."""

    artifact_id: int
    creator_id: int
    created_tick: int
    x: float
    y: float
    medium: str  # "earth_mark", "stone_carving", "tablet"
    symbol_tokens: List[int]
    intended_topic: str
    linked_agent_ids: List[int]
    durability: float  # 0..1; earth marks decay quickly, stone carvings persist across generations

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "SurfaceArtifact":
        return cls(**d)


@dataclass
class WitnessAccount:
    """Layer 2: Subjective, potentially biased or incomplete witness/chronicler record."""

    account_id: int
    author_id: int
    tick_recorded: int
    sim_date_recorded: str
    topic: str
    claimed_agent_ids: List[int]
    x: float
    y: float
    confidence: float
    distortion_score: float  # 0 = accurate, >0 = biased/misremembered/exaggerated
    symbol_tokens: List[int]
    narrative_summary: str
    artifact_id: Optional[int] = None

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "WitnessAccount":
        return cls(**d)


@dataclass
class GenerationalInterpretation:
    """Layer 3: How a later generation interprets surviving Layer 2 records and physical artifacts."""

    interpretation_id: int
    interpreter_id: int
    tick_formed: int
    generation_depth: int
    source_account_ids: List[int]
    source_artifact_ids: List[int]
    inferred_topic: str
    inferred_agent_ids: List[int]
    belief_confidence: float
    is_revisionist: bool
    accuracy_vs_reality: Optional[float]  # Computed ONLY for external observer analysis, never seen by agents
    summary: str

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "GenerationalInterpretation":
        return cls(**d)


class HistoryKnowledgeEngine:
    """
    Maintains three completely separated layers:
      - Layer 1: ground_truth (Observer/Engine ONLY — inaccessible to agents)
      - Layer 2: witness_accounts + physical SurfaceArtifacts (created and read locally by agents)
      - Layer 3: interpretations (later-generation synthesis & revisionism)
    """

    def __init__(self) -> None:
        self._truth_events: List[TruthEvent] = []  # Private by convention & API separation
        self.pending_truth_flush: List[TruthEvent] = []
        self.next_truth_id: int = 1

        self.artifacts: List[SurfaceArtifact] = []
        self.next_artifact_id: int = 1

        self.witness_accounts: List[WitnessAccount] = []
        self.next_account_id: int = 1

        self.interpretations: List[GenerationalInterpretation] = []
        self.next_interpretation_id: int = 1

        # Milestone flags
        self.first_documentation_tick: Optional[int] = None
        self.first_history_written_tick: Optional[int] = None

    def record_truth(
        self,
        tick: int,
        sim_date: str,
        event_type: str,
        agent_ids: List[int],
        x: float,
        y: float,
        description: str,
        source: str = "engine_observation",
        certainty: float = 1.0,
        metadata: Optional[dict] = None,
    ) -> TruthEvent:
        ev = TruthEvent(
            event_id=self.next_truth_id,
            tick=tick,
            sim_date=sim_date,
            event_type=event_type,
            agent_ids=list(agent_ids),
            x=round(x, 2),
            y=round(y, 2),
            certainty=certainty,
            source=source,
            description=description,
            metadata=metadata or {},
        )
        self.next_truth_id += 1
        self._truth_events.append(ev)
        self.pending_truth_flush.append(ev)
        # Keep bounded in-memory tail while Persistence flushes full history to compressed JSONL
        if len(self._truth_events) > 5000:
            self._truth_events = self._truth_events[-5000:]
        return ev

    @property
    def truth_events(self) -> List[TruthEvent]:
        """External Observer / Engine property ONLY. Never exposed on Agent or Perception."""
        return self._truth_events

    @truth_events.setter
    def truth_events(self, value: List[TruthEvent]) -> None:
        self._truth_events = list(value)

    def observer_get_truth_tail(self, limit: int = 200) -> List[TruthEvent]:
        """For external Observer / tests ONLY. Never pass into Agent or Perception."""
        return list(self._truth_events[-limit:])

    def create_artifact_and_chronicle(
        self,
        tick: int,
        sim_date: str,
        author_id: int,
        x: float,
        y: float,
        medium: str,
        symbol_tokens: List[int],
        topic: str,
        observed_agent_ids: List[int],
        author_skill: float,
        author_bias: float,
        rng: random.Random,
    ) -> Tuple[SurfaceArtifact, WitnessAccount, List[TruthEvent]]:
        """Agent records what they personally saw/heard onto earth, stone, or tablet."""
        emitted_truth: List[TruthEvent] = []
        durability = {"earth_mark": 0.25, "stone_carving": 0.95, "tablet": 0.85}.get(medium, 0.5)
        art = SurfaceArtifact(
            artifact_id=self.next_artifact_id,
            creator_id=author_id,
            created_tick=tick,
            x=round(x, 2),
            y=round(y, 2),
            medium=medium,
            symbol_tokens=list(symbol_tokens),
            intended_topic=topic,
            linked_agent_ids=list(observed_agent_ids),
            durability=durability,
        )
        self.next_artifact_id += 1
        self.artifacts.append(art)

        # Subjective distortion: low skill or strong personal bias can drop or misattribute participants
        claimed_ids = list(observed_agent_ids)
        distortion = max(0.0, min(1.0, (1.0 - author_skill) * 0.5 + abs(author_bias) * 0.4))
        if claimed_ids and rng.random() < distortion * 0.4:
            # Witness omits or misremembers one participant
            claimed_ids = claimed_ids[:-1]

        acc = WitnessAccount(
            account_id=self.next_account_id,
            author_id=author_id,
            tick_recorded=tick,
            sim_date_recorded=sim_date,
            topic=topic,
            claimed_agent_ids=claimed_ids,
            x=round(x, 2),
            y=round(y, 2),
            confidence=round(max(0.2, min(1.0, 0.4 + 0.5 * author_skill)), 3),
            distortion_score=round(distortion, 3),
            symbol_tokens=list(symbol_tokens),
            narrative_summary=f"Witness {author_id} inscribed {medium} about {topic} using tokens {symbol_tokens}.",
            artifact_id=art.artifact_id,
        )
        self.next_account_id += 1
        self.witness_accounts.append(acc)

        if self.first_documentation_tick is None:
            self.first_documentation_tick = tick
            emitted_truth.append(
                self.record_truth(
                    tick, sim_date, "first_documentation", [author_id], x, y,
                    f"First external symbol/marking created ({medium}) by agent {author_id}.",
                )
            )
        if self.first_history_written_tick is None and medium in ("stone_carving", "tablet") and len(symbol_tokens) >= 2:
            self.first_history_written_tick = tick
            emitted_truth.append(
                self.record_truth(
                    tick, sim_date, "first_history_written", [author_id], x, y,
                    f"First multi-symbol historical chronicle carved by agent {author_id}.",
                )
            )

        if len(self.artifacts) > 1500:
            # Keep durable artifacts longest
            self.artifacts.sort(key=lambda a: (a.durability, a.created_tick))
            self.artifacts = self.artifacts[-1500:]
        if len(self.witness_accounts) > 2000:
            self.witness_accounts = self.witness_accounts[-2000:]

        return art, acc, emitted_truth

    def attempt_generational_interpretation(
        self,
        tick: int,
        interpreter_id: int,
        interpreter_age_years: float,
        nearby_artifacts: List[SurfaceArtifact],
        rng: random.Random,
    ) -> Optional[GenerationalInterpretation]:
        """
        Later-generation agent examines surviving local artifacts & older witness accounts
        to form Layer 3 interpretations—which may accurately reconstruct or misread the past.
        """
        older_arts = [a for a in nearby_artifacts if (tick - a.created_tick) >= 180]
        if not older_arts:
            return None

        target_art = rng.choice(older_arts)
        matching_accounts = [
            w for w in self.witness_accounts if w.artifact_id == target_art.artifact_id
        ]
        is_revisionist = len(matching_accounts) > 0 and rng.random() < 0.30

        # Decode error grows if symbols eroded or interpreter lacks matching lexicon
        decode_noise = (1.0 - target_art.durability) * 0.5 + rng.uniform(0.0, 0.35)
        inferred_topic = target_art.intended_topic
        if decode_noise > 0.65:
            inferred_topic = rng.choice(["ancestral_conflict", "resource_omen", "lost_pact", "unknown_rite"])

        inferred_ids = list(target_art.linked_agent_ids)
        if decode_noise > 0.55 and inferred_ids:
            inferred_ids = inferred_ids[:1]

        # Accuracy metric computed strictly for external observer diagnostics
        topic_match = 1.0 if inferred_topic == target_art.intended_topic else 0.2
        id_overlap = (
            len(set(inferred_ids) & set(target_art.linked_agent_ids))
            / max(1, len(set(target_art.linked_agent_ids)))
        )
        accuracy = round(0.6 * topic_match + 0.4 * id_overlap, 3)

        interp = GenerationalInterpretation(
            interpretation_id=self.next_interpretation_id,
            interpreter_id=interpreter_id,
            tick_formed=tick,
            generation_depth=max(1, int((tick - target_art.created_tick) // 7200) + 1),
            source_account_ids=[w.account_id for w in matching_accounts],
            source_artifact_ids=[target_art.artifact_id],
            inferred_topic=inferred_topic,
            inferred_agent_ids=inferred_ids,
            belief_confidence=round(max(0.15, min(0.95, 0.85 - decode_noise * 0.5)), 3),
            is_revisionist=is_revisionist,
            accuracy_vs_reality=accuracy,
            summary=f"Generation-{max(1, int((tick - target_art.created_tick) // 7200) + 1)} reading of artifact #{target_art.artifact_id} as '{inferred_topic}'.",
        )
        self.next_interpretation_id += 1
        self.interpretations.append(interp)
        if len(self.interpretations) > 1500:
            self.interpretations = self.interpretations[-1500:]
        return interp

    def decay_artifacts(self, weather_condition: str) -> None:
        erosion = 0.004 if weather_condition in ("rain", "storm", "flood") else 0.001
        surviving: List[SurfaceArtifact] = []
        for art in self.artifacts:
            rate = erosion * (4.0 if art.medium == "earth_mark" else 0.15)
            art.durability = round(art.durability - rate, 4)
            if art.durability > 0.05:
                surviving.append(art)
        self.artifacts = surviving

    def to_snapshot(self) -> dict:
        return {
            "next_truth_id": self.next_truth_id,
            "next_artifact_id": self.next_artifact_id,
            "next_account_id": self.next_account_id,
            "next_interpretation_id": self.next_interpretation_id,
            "first_documentation_tick": self.first_documentation_tick,
            "first_history_written_tick": self.first_history_written_tick,
            "truth_tail": [e.to_dict() for e in self._truth_events[-500:]],
            "artifacts": [a.to_dict() for a in self.artifacts],
            "witness_accounts": [w.to_dict() for w in self.witness_accounts],
            "interpretations": [i.to_dict() for i in self.interpretations],
        }

    @classmethod
    def from_snapshot(cls, data: dict) -> "HistoryKnowledgeEngine":
        eng = cls()
        eng.next_truth_id = int(data.get("next_truth_id", 1))
        eng.next_artifact_id = int(data.get("next_artifact_id", 1))
        eng.next_account_id = int(data.get("next_account_id", 1))
        eng.next_interpretation_id = int(data.get("next_interpretation_id", 1))
        eng.first_documentation_tick = data.get("first_documentation_tick")
        eng.first_history_written_tick = data.get("first_history_written_tick")
        eng._truth_events = [TruthEvent.from_dict(e) for e in data.get("truth_tail", [])]
        eng.artifacts = [SurfaceArtifact.from_dict(a) for a in data.get("artifacts", [])]
        eng.witness_accounts = [WitnessAccount.from_dict(w) for w in data.get("witness_accounts", [])]
        eng.interpretations = [GenerationalInterpretation.from_dict(i) for i in data.get("interpretations", [])]
        return eng
