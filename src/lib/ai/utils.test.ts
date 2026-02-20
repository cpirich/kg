import { describe, expect, it } from "vitest";
import { parseJsonResponse } from "./utils";

describe("parseJsonResponse", () => {
  it("parses a valid JSON object", () => {
    const result = parseJsonResponse('{"key": "value", "num": 42}');
    expect(result).toEqual({ key: "value", num: 42 });
  });

  it("parses a valid JSON array", () => {
    const result = parseJsonResponse("[1, 2, 3]");
    expect(result).toEqual([1, 2, 3]);
  });

  it("parses nested JSON objects", () => {
    const input = JSON.stringify({
      outer: { inner: { deep: [1, { x: true }] } },
    });
    const result = parseJsonResponse(input);
    expect(result).toEqual({
      outer: { inner: { deep: [1, { x: true }] } },
    });
  });

  it("extracts JSON from ```json code block", () => {
    const input = '```json\n{"key": "value"}\n```';
    const result = parseJsonResponse(input);
    expect(result).toEqual({ key: "value" });
  });

  it("extracts JSON from ``` code block without language tag", () => {
    const input = '```\n{"key": "value"}\n```';
    const result = parseJsonResponse(input);
    expect(result).toEqual({ key: "value" });
  });

  it("extracts JSON from code block with surrounding text", () => {
    const input =
      'Here is the result:\n```json\n{"answer": 42}\n```\nHope that helps!';
    const result = parseJsonResponse(input);
    expect(result).toEqual({ answer: 42 });
  });

  it("handles whitespace inside code block", () => {
    const input = '```json\n  \n  {"key": "value"}  \n  \n```';
    const result = parseJsonResponse(input);
    expect(result).toEqual({ key: "value" });
  });

  it("extracts only the first code block when multiple are present", () => {
    const input =
      '```json\n{"first": true}\n```\nsome text\n```json\n{"second": true}\n```';
    const result = parseJsonResponse(input);
    expect(result).toEqual({ first: true });
  });

  it("throws on completely invalid non-JSON text", () => {
    expect(() => parseJsonResponse("this is not json at all")).toThrow(
      "Failed to parse JSON response",
    );
  });

  it("throws on empty string", () => {
    expect(() => parseJsonResponse("")).toThrow(
      "Failed to parse JSON response",
    );
  });

  it("throws when code block contains invalid JSON", () => {
    const input = "```json\n{invalid json}\n```";
    expect(() => parseJsonResponse(input)).toThrow();
  });

  it("includes truncated input in error message", () => {
    const longText = "x".repeat(300);
    expect(() => parseJsonResponse(longText)).toThrow("x".repeat(200));
  });
});
