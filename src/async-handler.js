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

// In-memory model cache (same as index.js)
let _cachedKey = null;
let _cachedKeyChecked = false;

const getOpenAIKey = async () => {
  if (_cachedKeyChecked) return _cachedKey || process.env.OPENAI_API_KEY;
  try {
    const byokKey = await storage.get("COGNIRUNNER_OPENAI_API_KEY");
    _cachedKeyChecked = true;
    if (byokKey) { _cachedKey = byokKey; return byokKey; }
  } catch (e) { /* fall through */ }
  _cachedKeyChecked = true;
  return process.env.OPENAI_API_KEY;
};

const getOpenAIModel = async () => {
  try {
    const byokKey = await storage.get("COGNIRUNNER_OPENAI_API_KEY");
    if (byokKey) {
      const savedModel = await storage.get("COGNIRUNNER_OPENAI_MODEL");
      if (savedModel) return savedModel;
    }
  } catch (e) { /* fall through */ }
  return process.env.OPENAI_MODEL || "gpt-5.4-mini";
};

/**
 * Execute an AI review of a configuration.
 */
const executeReview = async (params) => {
  const { configType, config } = params;
  const apiKey = await getOpenAIKey();
  if (!apiKey) return { success: false, error: "No OpenAI API key configured" };
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

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Review this configuration:\n\n${configDescription}` },
      ],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    return { success: false, error: `AI review failed (HTTP ${response.status}). ${errBody.substring(0, 100)}` };
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return { success: false, error: "Empty response from AI" };

  try {
    const review = JSON.parse(content.replace(/^```json\s*\n?/i, "").replace(/\n?```\s*$/i, ""));
    return { success: true, review, tokens: data.usage?.total_tokens };
  } catch {
    return { success: true, review: { verdict: "good", summary: content.substring(0, 200), items: [] }, tokens: data.usage?.total_tokens };
  }
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
