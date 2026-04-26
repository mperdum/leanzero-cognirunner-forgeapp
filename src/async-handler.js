/*
 * CogniRunner - AI-powered workflow validation for Jira
 * Copyright (C) 2025 LeanZero
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Async event consumer for long-running AI tasks.
 * This handler runs with a 120s timeout (vs 25s for resolvers).
 *
 * Pattern:
 * 1. Resolver pushes task to queue with {taskType, taskId, params}
 * 2. This consumer executes the task
 * 3. Result is stored in KVS keyed by taskId
 * 4. Frontend polls the resolver for the result
 */

import { storage } from "@forge/api";
import api, { route, fetch } from "@forge/api";

const TASK_PREFIX = "async_task:";
const TASK_TTL_HOURS = 1; // Results expire after 1 hour

// Per-provider KVS key helpers (same scheme as index.js)
const providerKeySlot = (provider) => `COGNIRUNNER_KEY_${provider}`;
const providerModelSlot = (provider) => `COGNIRUNNER_MODEL_${provider}`;

let _cachedKey = null;
let _cachedKeyChecked = false;

const getOpenAIKey = async () => {
  if (_cachedKeyChecked) return _cachedKey || process.env.OPENAI_API_KEY;
  try {
    const { provider } = await getProviderConfig();
    let byokKey = await storage.get(providerKeySlot(provider));
    // Legacy migration fallback
    if (!byokKey) {
      const legacy = await storage.get("COGNIRUNNER_OPENAI_API_KEY");
      if (legacy) { byokKey = legacy; }
    }
    _cachedKeyChecked = true;
    if (byokKey) { _cachedKey = byokKey; return byokKey; }
  } catch (e) { /* fall through */ }
  _cachedKeyChecked = true;
  return process.env.OPENAI_API_KEY;
};

const getOpenAIModel = async () => {
  try {
    const { provider } = await getProviderConfig();
    const byokKey = await storage.get(providerKeySlot(provider));
    if (byokKey) {
      const savedModel = await storage.get(providerModelSlot(provider));
      if (savedModel) return savedModel;
    }
  } catch (e) { /* fall through */ }
  return process.env.OPENAI_MODEL || "gpt-5.4-mini";
};

const PROVIDERS = {
  openai: { baseUrl: "https://api.openai.com/v1" },
  azure: { baseUrl: null },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1" },
  anthropic: { baseUrl: "https://api.anthropic.com" },
  lmstudio: { baseUrl: null }, // user-supplied tunnel root (no /v1)
};

const getProviderConfig = async () => {
  try {
    const provider = (await storage.get("COGNIRUNNER_AI_PROVIDER")) || "openai";
    const customUrl = await storage.get("COGNIRUNNER_AI_BASE_URL");
    const baseUrl = customUrl || (PROVIDERS[provider] && PROVIDERS[provider].baseUrl) || PROVIDERS.openai.baseUrl;
    return { provider, baseUrl };
  } catch (e) {
    return { provider: "openai", baseUrl: PROVIDERS.openai.baseUrl };
  }
};

/**
 * Simple AI chat call with Anthropic support (no tools/attachments needed here).
 *
 * @param {object} opts
 * @param {boolean} [opts.jsonMode] — for OpenAI/Azure/LM Studio, sends
 *   `response_format: { type: "json_object" }` to constrain output. Silently
 *   skipped for providers that don't support it (Anthropic uses its system
 *   prompt; OpenRouter passes through and not all upstream models accept it).
 */
const callAIChatSimple = async ({ apiKey, model, systemPrompt, userMessage, jsonMode }) => {
  const { provider, baseUrl } = await getProviderConfig();

  if (provider === "anthropic") {
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });
    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      return { ok: false, status: response.status, error: errBody };
    }
    const data = await response.json();
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    const tokens = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
    return { ok: true, content: text, tokens };
  }

  // OpenAI-compatible (OpenAI, Azure, OpenRouter, LM Studio)
  const openaiHeaders = { "Content-Type": "application/json" };
  if (provider === "azure") {
    openaiHeaders["api-key"] = apiKey;
  } else if (provider === "lmstudio") {
    // LM Studio: auth is optional. Sending `Bearer ` with empty token can 401 on some builds.
    if (apiKey) openaiHeaders["Authorization"] = `Bearer ${apiKey}`;
  } else {
    openaiHeaders["Authorization"] = `Bearer ${apiKey}`;
  }
  if (provider === "openrouter") {
    openaiHeaders["HTTP-Referer"] = "https://leanzero.atlascrafted.com";
    openaiHeaders["X-OpenRouter-Title"] = "CogniRunner";
  }
  // LM Studio's baseUrl is the tunnel root (no /v1) — append the OpenAI-compat path here.
  const inferenceUrl = provider === "lmstudio"
    ? `${baseUrl}/v1/chat/completions`
    : `${baseUrl}/chat/completions`;
  const requestBody = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  };
  // Constrain to JSON only on providers that reliably honor response_format.
  // Skip for openrouter (passes through; many upstream models reject the field).
  if (jsonMode && (provider === "openai" || provider === "azure" || provider === "lmstudio")) {
    requestBody.response_format = { type: "json_object" };
  }
  const response = await fetch(inferenceUrl, {
    method: "POST",
    headers: openaiHeaders,
    body: JSON.stringify(requestBody),
  });
  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    return { ok: false, status: response.status, error: errBody };
  }
  const data = await response.json();
  return { ok: true, content: data.choices?.[0]?.message?.content, tokens: data.usage?.total_tokens };
};

/**
 * Execute an AI review of a configuration.
 */
const executeReview = async (params) => {
  const { configType, config } = params;
  const apiKey = await getOpenAIKey();
  if (!apiKey) return { success: false, error: "No API key configured" };
  const model = await getOpenAIModel();

  let configDescription = "";

  if (configType === "validator" || configType === "condition") {
    configDescription = `## Validator / Condition Configuration
- **Field to validate:** ${config.fieldId || "(not set)"}
- **Validation prompt:** ${config.prompt || "(empty)"}
- **JQL Search (agentic mode):** ${config.enableTools === true ? "Always enabled" : config.enableTools === false ? "Disabled" : "Auto-detect from prompt"}
- **Context documents attached:** ${config.selectedDocIds?.length || 0}

This runs on EVERY workflow transition where it's configured. Each run costs one OpenAI API call.`;
  } else if (configType === "postfunction-semantic") {
    configDescription = `## Semantic Post-Function Configuration
- **Source field:** ${config.fieldId || "description"}
- **Condition prompt:** ${config.conditionPrompt || "(empty)"}
- **Action prompt:** ${config.actionPrompt || "(empty)"}
- **Target field to update:** ${config.actionFieldId || "(not set)"}
- **Context documents attached:** ${config.selectedDocIds?.length || 0}

This runs on EVERY workflow transition. Each run costs one OpenAI API call.`;
  } else if (configType === "postfunction-static") {
    const fns = config.functions || [];
    const fnDescriptions = fns.map((fn, i) => {
      const name = fn.name || `Step ${i + 1}`;
      const hasCode = fn.code && fn.code.trim().length > 0;
      return `### Step ${i + 1}: ${name}
- Operation type: ${fn.operationType || "not set"}
- Description: ${fn.operationPrompt || "(empty)"}
- Has code: ${hasCode ? "Yes" : "No"}
- Backoff enabled: ${fn.includeBackoff ? "Yes" : "No"}
${hasCode ? `- Code:\n\`\`\`javascript\n${fn.code.substring(0, 2000)}\n\`\`\`` : ""}`;
    }).join("\n\n");

    configDescription = `## Static Post-Function Configuration
- **Number of steps:** ${fns.length}

This runs on EVERY workflow transition. The code runs directly — NO AI cost at runtime.

${fnDescriptions}`;
  }

  const systemPrompt = `You review CogniRunner workflow automation configs. Be concise, helpful, and actionable.

RULES:
- Maximum 4 items total.
- First item should ALWAYS be type "success" summarizing what the config does. One sentence.
- Only add warnings for REAL problems: logical errors, missing fields, potential data issues.
- Do NOT warn about AI/API costs — the user already knows.
- Do NOT warn about "runs on every transition" — that's by design.
- Every "warning" MUST include a workaround in the same message. Format: "[Problem]. Fix: [solution]."
- "error" = will break. "warning" = risk with fix. "tip" = optional improvement with how-to.
- Keep messages concise but include the fix. Max 150 chars per item.
- Do NOT repeat the same concern.

Respond with ONLY valid JSON:
{"verdict":"good|needs_attention|has_issues","summary":"One short sentence","items":[{"type":"success|error|warning|tip","message":"Feedback with fix if warning"}]}`;

  const result = await callAIChatSimple({
    apiKey, model, systemPrompt,
    userMessage: `Review this configuration:\n\n${configDescription}`,
    jsonMode: true,
  });

  if (!result.ok) {
    return { success: false, error: `AI review failed (HTTP ${result.status}). ${(result.error || "").substring(0, 100)}` };
  }

  if (!result.content) return { success: false, error: "Empty response from AI" };

  // Tolerant JSON parse: handles ```json, ```js, plain ```, and prose wrapping.
  let parsed = null;
  let cleaned = String(result.content).trim()
    .replace(/^```(?:json|javascript|js)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
  if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
  }
  try { parsed = JSON.parse(cleaned); } catch { /* fall through */ }

  if (!parsed) {
    // Graceful fallback — never crash. Surface the raw AI text in the summary so the user
    // still sees something useful instead of a hard error.
    return {
      success: true,
      review: {
        verdict: "good",
        summary: String(result.content).substring(0, 200) || "Could not parse review response.",
        items: [],
      },
      tokens: result.tokens,
    };
  }

  // Validate shape — clamp to known values so the frontend's VERDICT_STYLES lookup works.
  const allowedVerdicts = new Set(["good", "needs_attention", "has_issues"]);
  if (!allowedVerdicts.has(parsed.verdict)) parsed.verdict = "good";
  if (typeof parsed.summary !== "string") parsed.summary = "Review complete.";
  if (!Array.isArray(parsed.items)) parsed.items = [];
  const allowedTypes = new Set(["success", "error", "warning", "tip"]);
  parsed.items = parsed.items
    .filter((item) => item && typeof item.message === "string")
    .map((item) => ({
      type: allowedTypes.has(item.type) ? item.type : "tip",
      message: String(item.message).substring(0, 300),
    }))
    .slice(0, 6); // hard cap

  return { success: true, review: parsed, tokens: result.tokens };
};

// === Task registry — add new async task types here ===
const TASK_HANDLERS = {
  "review": executeReview,
};

/**
 * Main async event handler. Routes to the correct task handler.
 */
export async function handler(event) {
  const { taskType, taskId, params } = event.body || {};

  if (!taskType || !taskId) {
    console.error("Async handler: missing taskType or taskId");
    return;
  }

  console.log(`Async handler: executing ${taskType} (${taskId})`);

  const taskHandler = TASK_HANDLERS[taskType];
  if (!taskHandler) {
    await storage.set(`${TASK_PREFIX}${taskId}`, { status: "error", error: `Unknown task type: ${taskType}` });
    return;
  }

  try {
    // Mark as processing
    await storage.set(`${TASK_PREFIX}${taskId}`, { status: "processing" });

    // Execute the task
    const result = await taskHandler(params);

    // Store result
    await storage.set(`${TASK_PREFIX}${taskId}`, { status: "done", result });
    console.log(`Async handler: ${taskType} (${taskId}) completed`);
  } catch (error) {
    console.error(`Async handler error (${taskType}):`, error);
    await storage.set(`${TASK_PREFIX}${taskId}`, { status: "error", error: error.message });
  }
}
