"""Communication & Emergent Proto-Language Engine — zero pre-seeded human dictionaries."""

from __future__ import annotations

import math
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Tuple


# Abstract internal semantic referents (NOT human words — purely perceptual/situational categories)
SEMANTIC_CONTEXTS = (
    "ctx_food",
    "ctx_water",
    "ctx_predator",
    "ctx_hostile",
    "ctx_aid",
    "ctx_share",
    "ctx_shelter",
    "ctx_kin",
    "ctx_norm",
    "ctx_record",
)


@dataclass
class VocalEmission:
    tick: int
    speaker_id: int
    x: float
    y: float
    token: int  # Abstract acoustic unit 0..23
    gesture: int  # Abstract body posture 0..7
    context_tag: str  # Speaker's ground-truth intent/situation (not directly readable by listener!)
    sequence_prev_token: Optional[int] = None


@dataclass
class LanguageMilestones:
    first_communication_tick: Optional[int] = None
    first_repeated_signal_tick: Optional[int] = None
    first_shared_symbol_tick: Optional[int] = None
    first_stable_protoword_tick: Optional[int] = None
    first_grammar_sequence_tick: Optional[int] = None
    first_dialect_divergence_tick: Optional[int] = None
    stable_protowords: Dict[str, dict] = field(default_factory=dict)  # "tok_<id>" -> {context, adopters, generation_span}
    bigram_sequences: Dict[str, int] = field(default_factory=dict)  # "t1->t2" -> count
    dialect_clusters: Dict[str, Dict[str, int]] = field(default_factory=dict)  # quadrant -> {context: dominant_token}
    semantic_drift_events: int = 0
    intergenerational_transmissions: int = 0
    extinct_tokens_count: int = 0


class CommunicationEngine:
    """
    Manages local acoustic/gesture signaling and tracks emergent proto-language evolution
    without injecting any pre-existing Arabic, English, or human vocabulary.
    """

    def __init__(self) -> None:
        self.recent_emissions: List[VocalEmission] = []
        # Observer-side pairing statistics: (speaker_region, token, context) -> count
        self.token_context_hits: Dict[Tuple[int, str], int] = {}
        self.token_adopters: Dict[Tuple[int, str], set] = {}
        self.previous_dominant_by_ctx: Dict[str, int] = {}
        self.milestones = LanguageMilestones()

    def clear_tick_emissions(self) -> None:
        self.recent_emissions.clear()

    def emit(
        self,
        tick: int,
        speaker_id: int,
        x: float,
        y: float,
        token: int,
        gesture: int,
        context_tag: str,
        prev_token: Optional[int] = None,
    ) -> Tuple[VocalEmission, List[dict]]:
        events: List[dict] = []
        em = VocalEmission(
            tick=tick,
            speaker_id=speaker_id,
            x=x,
            y=y,
            token=token,
            gesture=gesture,
            context_tag=context_tag,
            sequence_prev_token=prev_token,
        )
        self.recent_emissions.append(em)

        if self.milestones.first_communication_tick is None:
            self.milestones.first_communication_tick = tick
            events.append({
                "event_type": "first_communication",
                "agent_ids": [speaker_id],
                "x": x,
                "y": y,
                "description": f"First communicative vocal/gesture signal (token={token}, gesture={gesture}).",
            })

        key = (token, context_tag)
        self.token_context_hits[key] = self.token_context_hits.get(key, 0) + 1
        adopters = self.token_adopters.setdefault(key, set())
        adopters.add(speaker_id)

        if self.milestones.first_repeated_signal_tick is None and self.token_context_hits[key] >= 4:
            self.milestones.first_repeated_signal_tick = tick
            events.append({
                "event_type": "first_repeated_signal",
                "agent_ids": [speaker_id],
                "x": x,
                "y": y,
                "description": f"First repeated contextual vocalization (token={token} in {context_tag}).",
            })

        if prev_token is not None and prev_token != token:
            seq_key = f"{prev_token}->{token}"
            self.milestones.bigram_sequences[seq_key] = self.milestones.bigram_sequences.get(seq_key, 0) + 1
            if (
                self.milestones.first_grammar_sequence_tick is None
                and self.milestones.bigram_sequences[seq_key] >= 6
            ):
                self.milestones.first_grammar_sequence_tick = tick
                events.append({
                    "event_type": "emergent_protogrammar",
                    "agent_ids": [speaker_id],
                    "x": x,
                    "y": y,
                    "description": f"Repeated multi-token sequence {seq_key} observed across speakers.",
                })

        return em, events

    def observe_shared_alignment(
        self,
        tick: int,
        listener_id: int,
        speaker_id: int,
        token: int,
        inferred_context: str,
        x: float,
        y: float,
        listener_confidence: float,
        is_cross_generation: bool,
    ) -> List[dict]:
        events: List[dict] = []
        key = (token, inferred_context)
        adopters = self.token_adopters.setdefault(key, set())
        adopters.add(listener_id)

        if is_cross_generation and listener_confidence >= 0.35:
            self.milestones.intergenerational_transmissions += 1

        if (
            self.milestones.first_shared_symbol_tick is None
            and len(adopters) >= 2
            and listener_confidence >= 0.30
        ):
            self.milestones.first_shared_symbol_tick = tick
            events.append({
                "event_type": "first_shared_symbol",
                "agent_ids": [speaker_id, listener_id],
                "x": x,
                "y": y,
                "description": f"First shared signal alignment on token={token} for {inferred_context}.",
            })

        if len(adopters) >= 5 and listener_confidence >= 0.45:
            pw_key = f"tok_{token}"
            if pw_key not in self.milestones.stable_protowords:
                self.milestones.stable_protowords[pw_key] = {
                    "token": token,
                    "context": inferred_context,
                    "first_stabilized_tick": tick,
                    "adopter_count": len(adopters),
                }
                if self.milestones.first_stable_protoword_tick is None:
                    self.milestones.first_stable_protoword_tick = tick
                    events.append({
                        "event_type": "first_stable_protoword",
                        "agent_ids": [speaker_id, listener_id],
                        "x": x,
                        "y": y,
                        "description": f"First stable proto-word tok_{token} adopted by {len(adopters)} agents for {inferred_context}.",
                    })
            else:
                prev_ctx = self.milestones.stable_protowords[pw_key]["context"]
                self.milestones.stable_protowords[pw_key]["adopter_count"] = len(adopters)
                if prev_ctx != inferred_context and self.token_context_hits.get(key, 0) > 12:
                    self.milestones.stable_protowords[pw_key]["context"] = inferred_context
                    self.milestones.semantic_drift_events += 1

        return events

    def evaluate_dialects(self, tick: int, living_agents: dict, world_w: float, world_h: float) -> List[dict]:
        """Measure whether spatially separated clusters converge on different tokens for the same context."""
        events: List[dict] = []
        quadrant_votes: Dict[str, Dict[str, Dict[int, float]]] = {}
        for ag in living_agents.values():
            if not ag.is_alive or not ag.lexicon:
                continue
            q = ("W" if ag.x < world_w * 0.5 else "E") + ("S" if ag.y < world_h * 0.5 else "N")
            q_map = quadrant_votes.setdefault(q, {})
            for tok, ctx_map in ag.lexicon.items():
                for ctx, weight in ctx_map.items():
                    if weight > 0.25:
                        c_map = q_map.setdefault(ctx, {})
                        c_map[tok] = c_map.get(tok, 0.0) + weight

        summary: Dict[str, Dict[str, int]] = {}
        for q, ctx_dict in quadrant_votes.items():
            summary[q] = {}
            for ctx, tok_scores in ctx_dict.items():
                if tok_scores:
                    summary[q][ctx] = max(tok_scores, key=lambda t: tok_scores[t])
        self.milestones.dialect_clusters = summary

        # Check divergence across quadrants
        if self.milestones.first_dialect_divergence_tick is None and len(summary) >= 2:
            for ctx in SEMANTIC_CONTEXTS:
                tokens_seen = {q_map[ctx] for q_map in summary.values() if ctx in q_map}
                if len(tokens_seen) >= 2:
                    self.milestones.first_dialect_divergence_tick = tick
                    events.append({
                        "event_type": "dialect_divergence",
                        "agent_ids": [],
                        "x": world_w * 0.5,
                        "y": world_h * 0.5,
                        "description": f"Regional dialect divergence emerged for {ctx}: tokens {sorted(tokens_seen)}.",
                    })
                    break
        return events

    def summary(self) -> dict:
        return {
            "first_communication_tick": self.milestones.first_communication_tick,
            "first_repeated_signal_tick": self.milestones.first_repeated_signal_tick,
            "first_shared_symbol_tick": self.milestones.first_shared_symbol_tick,
            "first_stable_protoword_tick": self.milestones.first_stable_protoword_tick,
            "first_grammar_sequence_tick": self.milestones.first_grammar_sequence_tick,
            "first_dialect_divergence_tick": self.milestones.first_dialect_divergence_tick,
            "stable_protowords_count": len(self.milestones.stable_protowords),
            "stable_protowords": self.milestones.stable_protowords,
            "top_bigrams": sorted(
                self.milestones.bigram_sequences.items(), key=lambda kv: kv[1], reverse=True
            )[:10],
            "dialect_clusters": self.milestones.dialect_clusters,
            "semantic_drift_events": self.milestones.semantic_drift_events,
            "intergenerational_transmissions": self.milestones.intergenerational_transmissions,
        }

    def to_dict(self) -> dict:
        return {
            "token_context_hits": {f"{t}|{c}": cnt for (t, c), cnt in self.token_context_hits.items()},
            "token_adopters": {f"{t}|{c}": sorted(ids) for (t, c), ids in self.token_adopters.items()},
            "recent_emissions": [asdict(em) for em in self.recent_emissions],
            "milestones": {
                "first_communication_tick": self.milestones.first_communication_tick,
                "first_repeated_signal_tick": self.milestones.first_repeated_signal_tick,
                "first_shared_symbol_tick": self.milestones.first_shared_symbol_tick,
                "first_stable_protoword_tick": self.milestones.first_stable_protoword_tick,
                "first_grammar_sequence_tick": self.milestones.first_grammar_sequence_tick,
                "first_dialect_divergence_tick": self.milestones.first_dialect_divergence_tick,
                "stable_protowords": self.milestones.stable_protowords,
                "bigram_sequences": self.milestones.bigram_sequences,
                "dialect_clusters": self.milestones.dialect_clusters,
                "semantic_drift_events": self.milestones.semantic_drift_events,
                "intergenerational_transmissions": self.milestones.intergenerational_transmissions,
                "extinct_tokens_count": self.milestones.extinct_tokens_count,
            },
        }

    @classmethod
    def from_dict(cls, data: dict) -> "CommunicationEngine":
        eng = cls()
        for k, cnt in data.get("token_context_hits", {}).items():
            t_s, c = k.split("|", 1)
            eng.token_context_hits[(int(t_s), c)] = int(cnt)
        for k, ids in data.get("token_adopters", {}).items():
            t_s, c = k.split("|", 1)
            eng.token_adopters[(int(t_s), c)] = set(int(i) for i in ids)
        eng.recent_emissions = [VocalEmission(**em) for em in data.get("recent_emissions", [])]
        m = data.get("milestones", {})
        eng.milestones = LanguageMilestones(
            first_communication_tick=m.get("first_communication_tick"),
            first_repeated_signal_tick=m.get("first_repeated_signal_tick"),
            first_shared_symbol_tick=m.get("first_shared_symbol_tick"),
            first_stable_protoword_tick=m.get("first_stable_protoword_tick"),
            first_grammar_sequence_tick=m.get("first_grammar_sequence_tick"),
            first_dialect_divergence_tick=m.get("first_dialect_divergence_tick"),
            stable_protowords=dict(m.get("stable_protowords", {})),
            bigram_sequences=dict(m.get("bigram_sequences", {})),
            dialect_clusters=dict(m.get("dialect_clusters", {})),
            semantic_drift_events=int(m.get("semantic_drift_events", 0)),
            intergenerational_transmissions=int(m.get("intergenerational_transmissions", 0)),
            extinct_tokens_count=int(m.get("extinct_tokens_count", 0)),
        )
        return eng
