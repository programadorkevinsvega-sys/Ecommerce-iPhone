export type Result<T, E = DomainError> = Success<T> | Failure<E>;

export type Success<T> = {
  readonly ok: true;
  readonly value: T;
};

export type Failure<E> = {
  readonly ok: false;
  readonly error: E;
};

import type { DomainError } from "./DomainError";

export const Result = {
  ok<T>(value: T): Success<T> {
    return { ok: true, value };
  },

  fail<E>(error: E): Failure<E> {
    return { ok: false, error };
  },
};
