import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyCalcomSignature } from "../src/calcom/verifySignature";

const secret = "test-secret";
const body = JSON.stringify({ triggerEvent: "BOOKING_CREATED" });
const validSignature = createHmac("sha256", secret).update(body).digest("hex");

describe("verifyCalcomSignature", () => {
  it("accepts a correctly signed body", () => {
    expect(verifyCalcomSignature(body, validSignature, secret)).toBe(true);
  });

  it("rejects a tampered body", () => {
    expect(verifyCalcomSignature(body + "x", validSignature, secret)).toBe(false);
  });

  it("rejects the wrong secret", () => {
    expect(verifyCalcomSignature(body, validSignature, "wrong-secret")).toBe(false);
  });

  it("rejects a missing signature header", () => {
    expect(verifyCalcomSignature(body, undefined, secret)).toBe(false);
  });
});
