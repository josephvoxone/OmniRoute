type RequestShapeBody = Record<string, unknown> | null | undefined;

export type RequestShape = {
  payloadBytes: number;
  itemCount: number;
  toolCount: number;
};

export type RequestShapeSkipResult = {
  skip: boolean;
  reason: string;
};

export const LARGE_PAYLOAD_BYTES = 10 * 1024 * 1024;
export const VERY_LARGE_PAYLOAD_BYTES = 25 * 1024 * 1024;
export const LARGE_HISTORY_ITEMS = 250;
export const VERY_LARGE_HISTORY_ITEMS = 400;
export const TOOL_HEAVY_COUNT = 15;

function countArrayField(body: RequestShapeBody, field: "input" | "messages" | "tools"): number {
  const value = body?.[field];
  return Array.isArray(value) ? value.length : 0;
}

export function measureRequestShape(body: RequestShapeBody): RequestShape {
  let payloadBytes = 0;
  try {
    payloadBytes = Buffer.byteLength(JSON.stringify(body ?? {}), "utf8");
  } catch {
    payloadBytes = 0;
  }

  const inputCount = countArrayField(body, "input");
  const messageCount = countArrayField(body, "messages");

  return {
    payloadBytes,
    itemCount: Math.max(inputCount, messageCount),
    toolCount: countArrayField(body, "tools"),
  };
}

export function shouldSkipTargetForRequestShape(
  provider: string | null | undefined,
  modelStr: string | null | undefined,
  shape: RequestShape
): RequestShapeSkipResult {
  const normalizedProvider = (provider || "").toLowerCase();
  const normalizedModel = (modelStr || "").toLowerCase();
  const longContext = shape.itemCount >= LARGE_HISTORY_ITEMS;
  const veryLongContext = shape.itemCount >= VERY_LARGE_HISTORY_ITEMS;
  const largePayload = shape.payloadBytes >= LARGE_PAYLOAD_BYTES;
  const veryLargePayload = shape.payloadBytes >= VERY_LARGE_PAYLOAD_BYTES;
  const toolHeavy = shape.toolCount >= TOOL_HEAVY_COUNT;

  if (normalizedProvider === "github" && (largePayload || longContext || toolHeavy)) {
    return {
      skip: true,
      reason: `github_unsuitable_for_large_responses_payload:${shape.payloadBytes}_items:${shape.itemCount}_tools:${shape.toolCount}`,
    };
  }

  if (normalizedProvider === "claude" && (veryLongContext || veryLargePayload)) {
    return {
      skip: true,
      reason: `claude_long_context_extra_usage_risk_payload:${shape.payloadBytes}_items:${shape.itemCount}`,
    };
  }

  if (
    normalizedProvider === "antigravity" &&
    normalizedModel.includes("claude") &&
    veryLargePayload
  ) {
    return {
      skip: true,
      reason: `antigravity_claude_very_large_payload_risk:${shape.payloadBytes}`,
    };
  }

  return { skip: false, reason: "" };
}
