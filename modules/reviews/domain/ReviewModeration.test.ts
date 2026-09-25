import {describe,expect,it} from "vitest";
import {assertModerationTransition,validateReport} from "./ReviewModeration";

describe("review moderation domain",()=>{
 it("allows only valid moderation transitions",()=>{
  expect(()=>assertModerationTransition("PENDING","APPROVED")).not.toThrow();
  expect(()=>assertModerationTransition("PENDING","REJECTED")).not.toThrow();
  expect(()=>assertModerationTransition("APPROVED","REJECTED")).not.toThrow();
  expect(()=>assertModerationTransition("APPROVED","APPROVED")).toThrow("INVALID_REVIEW_MODERATION_TRANSITION");
  expect(()=>assertModerationTransition("REJECTED","REJECTED")).toThrow("INVALID_REVIEW_MODERATION_TRANSITION");
 });
 it("validates report payload limits",()=>{
  expect(()=>validateReport("spam")).not.toThrow();
  expect(()=>validateReport(" ".repeat(201))).toThrow("INVALID_REVIEW_REPORT");
  expect(()=>validateReport("spam","x".repeat(2001))).toThrow("INVALID_REVIEW_REPORT_DETAILS");
 });
});
