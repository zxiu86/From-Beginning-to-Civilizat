"""Physics, Collision & Local Steering Engine — terrain passability, soft separation, and bounded A* steering."""

from __future__ import annotations

import heapq
import math
from typing import Dict, Iterable, List, Optional, Tuple, TYPE_CHECKING

if TYPE_CHECKING:
    from .world import WorldEngine


DEEP_WATER_THRESHOLD = 75.0
CLIFF_SLOPE_THRESHOLD = 1.45


def is_cell_passable(world: "WorldEngine", col: int, row: int) -> bool:
    if col < 0 or col >= world.cols or row < 0 or row >= world.rows:
        return False
    idx = row * world.cols + col
    return world.water[idx] < DEEP_WATER_THRESHOLD and world.slope[idx] <= CLIFF_SLOPE_THRESHOLD


def cell_traversal_cost(world: "WorldEngine", col: int, row: int) -> float:
    idx = row * world.cols + col
    water_drag = 1.65 if world.water[idx] >= 35.0 else (1.15 if world.water[idx] > 0.0 else 1.0)
    slope_drag = 1.0 + world.slope[idx] * 1.15
    return water_drag * slope_drag


def find_nearest_passable(world: "WorldEngine", x: float, y: float, max_cell_radius: int = 8) -> Tuple[float, float]:
    """Return (x, y) on dry passable terrain closest to the requested world point."""
    cx, cy = world.clamp_coords(x, y)
    c0, r0 = world.cell_coords_at(cx, cy)
    if is_cell_passable(world, c0, r0):
        return cx, cy

    best_xy: Optional[Tuple[float, float]] = None
    best_d2 = float("inf")
    for rad in range(1, max_cell_radius + 1):
        for dr in range(-rad, rad + 1):
            rr = r0 + dr
            if not (0 <= rr < world.rows):
                continue
            for dc in range(-rad, rad + 1):
                cc = c0 + dc
                if not (0 <= cc < world.cols):
                    continue
                if is_cell_passable(world, cc, rr):
                    px = (cc + 0.5) * world.cell_size_m
                    py = (rr + 0.5) * world.cell_size_m
                    d2 = (px - cx) ** 2 + (py - cy) ** 2
                    if d2 < best_d2:
                        best_d2 = d2
                        best_xy = (px, py)
        if best_xy is not None:
            return best_xy
    return cx, cy


def bounded_astar_next_heading(
    world: "WorldEngine",
    start_x: float,
    start_y: float,
    goal_x: float,
    goal_y: float,
    max_expansions: int = 64,
) -> Tuple[float, float]:
    """
    Bounded local A* pathfinder on the 25m grid to steer cleanly around rivers, lakes, and steep cliffs.
    Returns a normalized unit direction vector (ux, uy) from start toward next waypoint.
    """
    sc, sr = world.cell_coords_at(start_x, start_y)
    gc, gr = world.cell_coords_at(goal_x, goal_y)
    if sc == gc and sr == gr:
        dx = goal_x - start_x
        dy = goal_y - start_y
        dist = math.hypot(dx, dy)
        return (dx / dist, dy / dist) if dist > 1e-4 else (0.0, 0.0)

    start = (sc, sr)
    goal = (gc, gr)
    frontier: List[Tuple[float, int, Tuple[int, int]]] = []
    heapq.heappush(frontier, (0.0, 0, start))
    came_from: Dict[Tuple[int, int], Optional[Tuple[int, int]]] = {start: None}
    cost_so_far: Dict[Tuple[int, int], float] = {start: 0.0}

    expansions = 0
    best_node = start
    best_h = math.hypot(gc - sc, gr - sr)
    uid = 1

    neighbors = (
        (1, 0, 1.0), (-1, 0, 1.0), (0, 1, 1.0), (0, -1, 1.0),
        (1, 1, 1.414), (1, -1, 1.414), (-1, 1, 1.414), (-1, -1, 1.414),
    )

    while frontier and expansions < max_expansions:
        _, _, current = heapq.heappop(frontier)
        expansions += 1
        if current == goal:
            best_node = current
            break

        h_cur = math.hypot(gc - current[0], gr - current[1])
        if h_cur < best_h:
            best_h = h_cur
            best_node = current

        for dc, dr, step_len in neighbors:
            nc, nr = current[0] + dc, current[1] + dr
            if not is_cell_passable(world, nc, nr):
                continue
            # Prevent diagonal corner cutting across impassable cardinal tiles
            if dc != 0 and dr != 0:
                if not (is_cell_passable(world, current[0] + dc, current[1]) and is_cell_passable(world, current[0], current[1] + dr)):
                    continue
            nxt = (nc, nr)
            new_cost = cost_so_far[current] + step_len * cell_traversal_cost(world, nc, nr)
            if nxt not in cost_so_far or new_cost < cost_so_far[nxt]:
                cost_so_far[nxt] = new_cost
                priority = new_cost + math.hypot(gc - nc, gr - nr) * 1.15
                heapq.heappush(frontier, (priority, uid, nxt))
                uid += 1
                came_from[nxt] = current

    # Walk back from best_node to find immediate child of start
    cur = best_node
    while cur in came_from and came_from[cur] is not None and came_from[cur] != start:
        cur = came_from[cur]  # type: ignore[assignment]

    if cur == start:
        dx = goal_x - start_x
        dy = goal_y - start_y
    else:
        wx = (cur[0] + 0.5) * world.cell_size_m
        wy = (cur[1] + 0.5) * world.cell_size_m
        dx = wx - start_x
        dy = wy - start_y

    dist = math.hypot(dx, dy)
    if dist < 1e-4:
        return (0.0, 0.0)
    return (dx / dist, dy / dist)


def attempt_steered_move(
    world: "WorldEngine",
    x: float,
    y: float,
    target_dx: float,
    target_dy: float,
    step_dist: float,
    nearby_obstacles: Optional[Iterable[Tuple[float, float]]] = None,
) -> Tuple[float, float, float]:
    """
    Move smoothly along a steered vector with terrain slope drag, obstacle/water avoidance,
    and soft personal-space separation from nearby entities.
    Returns (new_x, new_y, actual_distance_moved).
    """
    gx, gy = world.clamp_coords(x + target_dx * step_dist * 1.8, y + target_dy * step_dist * 1.8)
    ux, uy = bounded_astar_next_heading(world, x, y, gx, gy, max_expansions=48)
    if ux == 0.0 and uy == 0.0:
        mag = math.hypot(target_dx, target_dy)
        if mag > 1e-4:
            ux, uy = target_dx / mag, target_dy / mag

    # Soft repulsion from overlapping nearby peers / fauna
    rep_x, rep_y = 0.0, 0.0
    if nearby_obstacles is not None:
        min_sep = 2.2
        for ox, oy in nearby_obstacles:
            dx = x - ox
            dy = y - oy
            d = math.hypot(dx, dy)
            if 1e-3 < d < min_sep:
                push = (min_sep - d) / min_sep
                rep_x += (dx / d) * push
                rep_y += (dy / d) * push

    vx = ux * step_dist + rep_x * 2.5
    vy = uy * step_dist + rep_y * 2.5
    vmag = math.hypot(vx, vy)
    if vmag > step_dist * 1.15 and vmag > 1e-4:
        scale = (step_dist * 1.15) / vmag
        vx *= scale
        vy *= scale

    # Try full step, then half step, then orthogonal slide along boundary
    for frac in (1.0, 0.6, 0.3):
        nx, ny = world.clamp_coords(x + vx * frac, y + vy * frac)
        nc, nr = world.cell_coords_at(nx, ny)
        if is_cell_passable(world, nc, nr):
            return nx, ny, math.hypot(nx - x, ny - y)

    # Orthogonal wall-slide fallback
    for cand_dx, cand_dy in ((vx, 0.0), (0.0, vy)):
        nx, ny = world.clamp_coords(x + cand_dx * 0.65, y + cand_dy * 0.65)
        nc, nr = world.cell_coords_at(nx, ny)
        if is_cell_passable(world, nc, nr):
            return nx, ny, math.hypot(nx - x, ny - y)

    return x, y, 0.0
