import assert from "node:assert/strict";
import test from "node:test";

import {
  LARGE_HISTORY_ITEMS,
  LARGE_PAYLOAD_BYTES,
  TOOL_HEAVY_COUNT,
  VERY_LARGE_HISTORY_ITEMS,
  VERY_LARGE_PAYLOAD_BYTES,
  measureRequestShape,
  shouldSkipTargetForRequestShape,
} from "../../open-sse/services/requestShapePolicy.ts";

test("measureRequestShape records payload size, max history count, and tool count", () => {
  const body = {
    input: Array.from({ length: 3 }, (_, index) => ({ role: "user", content: String(index) })),
    messages: Array.from({ length: 5 }, (_, index) => ({ role: "user", content: String(index) })),
    tools: [{ type: "function", name: "x" }],
  };

  const shape = measureRequestShape(body);

  assert.equal(shape.itemCount, 5);
  assert.equal(shape.toolCount, 1);
  assert.ok(shape.payloadBytes > 0);
});

test("request shape policy skips GitHub for large Responses payloads", () => {
  const decision = shouldSkipTargetForRequestShape("github", "github/claude-sonnet-4.6", {
    payloadBytes: LARGE_PAYLOAD_BYTES,
    itemCount: 12,
    toolCount: 0,
  });

  assert.equal(decision.skip, true);
  assert.match(decision.reason, /github_unsuitable_for_large_responses_payload/);
});

test("request shape policy skips GitHub for tool-heavy Codex sessions", () => {
  const decision = shouldSkipTargetForRequestShape("github", "github/claude-sonnet-4.6", {
    payloadBytes: 1024,
    itemCount: 12,
    toolCount: TOOL_HEAVY_COUNT,
  });

  assert.equal(decision.skip, true);
  assert.match(decision.reason, /github_unsuitable_for_large_responses_payload/);
});

test("request shape policy skips Claude for very long contexts", () => {
  const decision = shouldSkipTargetForRequestShape("claude", "claude/claude-sonnet-4-6", {
    payloadBytes: 1024,
    itemCount: VERY_LARGE_HISTORY_ITEMS,
    toolCount: 0,
  });

  assert.equal(decision.skip, true);
  assert.match(decision.reason, /claude_long_context_extra_usage_risk/);
});

test("request shape policy skips Antigravity Claude only for very large payloads", () => {
  const normal = shouldSkipTargetForRequestShape("antigravity", "antigravity/claude-sonnet-4-6", {
    payloadBytes: LARGE_PAYLOAD_BYTES,
    itemCount: LARGE_HISTORY_ITEMS,
    toolCount: TOOL_HEAVY_COUNT,
  });
  const veryLarge = shouldSkipTargetForRequestShape(
    "antigravity",
    "antigravity/claude-sonnet-4-6",
    {
      payloadBytes: VERY_LARGE_PAYLOAD_BYTES,
      itemCount: LARGE_HISTORY_ITEMS,
      toolCount: TOOL_HEAVY_COUNT,
    }
  );

  assert.equal(normal.skip, false);
  assert.equal(veryLarge.skip, true);
  assert.match(veryLarge.reason, /antigravity_claude_very_large_payload_risk/);
});

test("request shape policy keeps Codex available for large long-context sessions", () => {
  const decision = shouldSkipTargetForRequestShape("codex", "codex/gpt-5.5", {
    payloadBytes: VERY_LARGE_PAYLOAD_BYTES,
    itemCount: VERY_LARGE_HISTORY_ITEMS,
    toolCount: TOOL_HEAVY_COUNT,
  });

  assert.equal(decision.skip, false);
});
