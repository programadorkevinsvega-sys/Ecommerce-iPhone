import { describe, expect, it } from "vitest";
import { assertModerationTransition, validateReport } from "./ReviewModeration";

describe("review moderation domain",()=>{
 it("allows controlled moderation transitions",()=>{
  expect(()=>assertModerationTransition("PENDING","APPROVED")).not.toThrow();
  expect(()=>assertModerationTransition("APPROVED","REJECTED")).not.toThrow();
 });
 it("rejects same-state and invalid transitions",()=>{
  expect(()=>assertModerationTransition("PENDING","PENDING")).toThrow("INVALID_REVIEW_MODERATION_TRANSITION");
 });
 it("validates report content",()=>{
  expect(()=>validateReport("")).toThrow("INVALID_REVIEW_REPORT");
  expect(()=>validateReport("spam","x".repeat(2001))).toThrow("INVALID_REVIEW_REPORT_DETAILS");
 });
});