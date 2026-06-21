// Typed domain errors. Services throw these; the UI/API layer maps them to
// responses. Never throw bare strings or generic Errors from the domain.

export type DomainErrorCode =
  | "INVALID_TRANSITION"
  | "VALIDATION_FAILED"
  | "AI_OUTPUT_INVALID"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "CONFLICT"
  | "PRECONDITION_FAILED"
  | "NO_AVAILABILITY"
  | "POLICY_VIOLATION";

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: DomainErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
  }
}

export class InvalidTransitionError extends DomainError {
  constructor(entity: string, from: string, to: string) {
    super(
      "INVALID_TRANSITION",
      `Invalid ${entity} transition: ${from} -> ${to}`,
      { entity, from, to },
    );
    this.name = "InvalidTransitionError";
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("VALIDATION_FAILED", message, details);
    this.name = "ValidationError";
  }
}

export class AiOutputError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("AI_OUTPUT_INVALID", message, details);
    this.name = "AiOutputError";
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id?: string) {
    super("NOT_FOUND", `${entity}${id ? ` (${id})` : ""} not found`, {
      entity,
      id,
    });
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = "Not authorized") {
    super("FORBIDDEN", message);
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("CONFLICT", message, details);
    this.name = "ConflictError";
  }
}

export class PolicyViolationError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("POLICY_VIOLATION", message, details);
    this.name = "PolicyViolationError";
  }
}
