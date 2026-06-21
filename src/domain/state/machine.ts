import { InvalidTransitionError } from "../errors";
import { logger } from "@/observability/logger";
import { MarketEvent } from "@/observability/events";

// Generic finite-state-machine guard. Each domain entity defines an adjacency
// map of allowed transitions; assertTransition enforces it and throws a typed
// error on any illegal move. This is the ONLY sanctioned way to change status —
// services must not mutate status fields directly without going through here.

export type TransitionMap<S extends string> = Readonly<Record<S, readonly S[]>>;

export function canTransition<S extends string>(
  map: TransitionMap<S>,
  from: S,
  to: S,
): boolean {
  if (from === to) return true; // idempotent no-op transitions are allowed
  return map[from]?.includes(to) ?? false;
}

export function assertTransition<S extends string>(
  entity: string,
  map: TransitionMap<S>,
  from: S,
  to: S,
): void {
  if (!canTransition(map, from, to)) {
    logger.event(MarketEvent.INVALID_TRANSITION, { entity, from, to });
    throw new InvalidTransitionError(entity, from, to);
  }
}
