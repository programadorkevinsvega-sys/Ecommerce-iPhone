import { describe, expect, it } from "vitest";
import { TechnicianUser } from "./TechnicianUser";

describe("TechnicianUser", () => {
  it("normalizes the employee identity", () => {
    const user = TechnicianUser.create("tech-1", {
      email: " TECH@EXAMPLE.COM ",
      passwordHash: "stored-hash",
      firstName: "  Ana ",
      lastName: " Técnico ",
      active: true,
      failedLoginCount: 0,
    });

    expect(user.toPrimitives()).toMatchObject({
      id: "tech-1",
      email: "tech@example.com",
      firstName: "Ana",
      lastName: "Técnico",
      active: true,
      failedLoginCount: 0,
    });
  });

  it("locks after the configured failed-attempt threshold", () => {
    const now = new Date("2026-09-20T00:00:00.000Z");
    const user = TechnicianUser.create("tech-1", {
      email: "tech@example.com",
      passwordHash: "stored-hash",
      firstName: "Ana",
      lastName: "Técnico",
      active: true,
      failedLoginCount: 4,
    });

    user.recordFailedLogin(now, 5, 15);

    expect(user.toPrimitives().lockedUntil).toBe("2026-09-20T00:15:00.000Z");
    expect(user.toPrimitives().failedLoginCount).toBe(5);
  });

  it("clears lock state after a successful login", () => {
    const user = TechnicianUser.create("tech-1", {
      email: "tech@example.com",
      passwordHash: "stored-hash",
      firstName: "Ana",
      lastName: "Técnico",
      active: true,
      failedLoginCount: 5,
      lockedUntil: "2026-09-20T00:15:00.000Z",
    });

    user.recordSuccessfulLogin(new Date("2026-09-20T01:00:00.000Z"));

    expect(user.toPrimitives()).toMatchObject({
      failedLoginCount: 0,
      lastLoginAt: "2026-09-20T01:00:00.000Z",
    });
    expect(user.toPrimitives()).not.toHaveProperty("lockedUntil");
  });
});
