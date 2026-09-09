export class DomainError extends Error {
  readonly code: string;

  constructor(code: string, message?: string) {
    const resolvedMessage = message ?? code;
    super(resolvedMessage);
    this.name = "DomainError";
    this.code = message === undefined ? "DOMAIN_ERROR" : code;
  }
}
