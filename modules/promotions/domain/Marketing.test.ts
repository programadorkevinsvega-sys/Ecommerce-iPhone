import { describe, expect, it } from "vitest";
import { calculateDiscount, validateApplicability, validateDiscount, validateWindow } from "./Marketing";

describe("marketing domain",()=>{
 it("calculates capped percentage and fixed discounts",()=>{ expect(calculateDiscount("PERCENT",25,10000)).toBe(2500); expect(calculateDiscount("FIXED",15000,10000)).toBe(10000); });
 it("accepts valid percentage and fixed discounts",()=>{
  expect(()=>validateDiscount("PERCENT",100)).not.toThrow();
  expect(()=>validateDiscount("FIXED",5000)).not.toThrow();
 });
 it("rejects invalid percentage and windows",()=>{
  expect(()=>validateDiscount("PERCENT",101)).toThrow("INVALID_PERCENT_DISCOUNT");
  expect(()=>validateDiscount("FIXED",0)).toThrow("INVALID_FIXED_DISCOUNT");
  expect(()=>validateWindow("2026-10-02T00:00:00Z","2026-10-01T00:00:00Z")).toThrow("INVALID_MARKETING_WINDOW");
 });
 it("bounds applicability targets",()=>{
  expect(()=>validateApplicability({productIds:[""],categoryIds:[]})).toThrow("INVALID_MARKETING_TARGET");
 });
});