import { describe, expect, it } from "vitest";
import { isCloudflareEdgeBlock } from "../../../scripts/cloudflare-edge-response.mjs";

describe("Cloudflare edge response detection", () => {
  it("recognizes a Cloudflare challenge from the mitigation header", () => {
    const response = new Response("challenge", {
      status: 403,
      headers: { "cf-mitigated": "challenge" },
    });

    expect(isCloudflareEdgeBlock(response, "challenge")).toBe(true);
  });

  it("recognizes a Cloudflare WAF block page with an edge signature", () => {
    const response = {
      status: 403,
      headers: {
        Server: "cloudflare",
        "CF-Ray": "9abc1234-MDE",
      },
    };
    const body = "Sorry, you have been blocked. Error 1020.";

    expect(isCloudflareEdgeBlock(response, body)).toBe(true);
  });

  it("supports the Cloudflare signature returned by Fetch Headers", () => {
    const body = "Attention Required! Cloudflare Ray ID: abc";
    const response = new Response(body, {
      status: 403,
      headers: {
        server: "cloudflare",
        "cf-ray": "9abc1234-MDE",
      },
    });

    expect(isCloudflareEdgeBlock(response, body)).toBe(true);
  });

  it("does not classify an application 403 carrying its request ID", () => {
    const response = new Response("Forbidden", {
      status: 403,
      headers: {
        "x-request-id": "req_app_123",
        "cf-ray": "9abc1234-MDE",
        "cf-mitigated": "challenge",
      },
    });
    const body = "Sorry, you have been blocked";

    expect(isCloudflareEdgeBlock(response, body)).toBe(false);
  });

  it("does not classify an ordinary application 403 as an edge block", () => {
    const response = {
      status: 403,
      headers: { "content-type": "application/json" },
    };
    const body = '{"error":"FORBIDDEN"}';

    expect(isCloudflareEdgeBlock(response, body)).toBe(false);
  });

  it("requires an edge marker when only the Cloudflare server signature exists", () => {
    const response = {
      status: 403,
      headers: { server: "cloudflare", "cf-ray": "9abc1234-MDE" },
    };

    expect(isCloudflareEdgeBlock(response, "Forbidden")).toBe(false);
  });

  it("does not classify non-403 responses as edge blocks", () => {
    const response = {
      status: 503,
      headers: { "cf-mitigated": "challenge" },
    };

    expect(isCloudflareEdgeBlock(response, "Just a moment...")).toBe(false);
  });
});
