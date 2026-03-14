/*
 * OpenAI Client - Handles OpenAI API integration for validation
 */

// Configuration constants
const MAX_TOOL_ROUNDS = 3;

/**
 * Download attachment from JIRA API
 */
export const downloadAttachment = async (attachmentId) => {
  try {
    const response = await api.asApp().requestJira(route`/rest/api/3/attachment/${attachmentId}`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      console.error("Failed to download attachment metadata:", response.status);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error downloading attachment:", error);
    return null;
  }
};

/**
 * Build attachment content parts for multimodal OpenAI calls
 */
export const buildAttachmentContentParts = async (attachments) => {
  if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
    return [];
  }

  const parts = [];

  for (const attachment of attachments) {
    try {
      // Download the attachment content
      const response = await api.asApp().requestJira(route`/rest/api/3/attachment/${attachment.id}`, {
        headers: { Accept: "*/*" },
      });

      if (!response.ok) {
        console.error(`Failed to download attachment ${attachment.id}:`, response.status);
        continue;
      }

      const blob = await response.blob();
      
      // Create a data URL for the attachment
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      parts.push({
        type: "image_url",
        image_url: {
          url: dataUrl,
        },
      });
    } catch (error) {
      console.error(`Error processing attachment ${attachment.id}:`, error);
      continue;
    }
  }

  return parts;
};

const MAX_JQL_RESULTS = 10;
const AGENTIC_TIMEOUT_MS = 22000; // 22s budget within Forge's 25s validator limit

/**
 * Get the OpenAI API key from environment variables
 */
export const getOpenAIKey = () => {
  return process.env.OPENAI_API_KEY;
};

/**
 * Get the OpenAI model from environment variables (defaults to gpt-5-mini)
 */
export const getOpenAIModel = () => {
  return process.env.OPENAI_MODEL || "gpt-5-mini";
};

// Tool trigger patterns for agentic mode
const TOOL_TRIGGER_PATTERN = /\b(duplicat(?:e[ds]?|ion)|already\s+(?:exists?|reported|created|filed|logged)|previously\s+(?:reported|created|filed|logged)|existing\s+(?:issues?|tickets?|bugs?|stor(?:y|ies)|tasks?)|redundan(?:t|cy)\s+(?:issues?|tickets?|bugs?|entries?)|identical\s+(?:issues?|tickets?|bugs?)|(?:similar|resembl(?:es?|ing))\s+(?:issues?|tickets?|bugs?|stor(?:y|ies)|tasks?|entries?)|no\s+duplicat|(?:search|query|check)\s+jira|find\s+(?:related|matching|existing)\s+(?:issues?|tickets?|bugs?|stor(?:y|ies)|tasks?)|cross[- ]?reference|compare\s+(?:against|with)\s+(?:existing|other|jira))\b/i;

/**
 * Check if a validation prompt's wording implies the need for JQL search tools.
 */
export const promptRequiresTools = (prompt) => {
  if (!prompt || typeof prompt !== "string") return false;
  return TOOL_TRIGGER_PATTERN.test(prompt);
};

// === Agentic tool infrastructure ===

/**
 * Tool registry — maps tool names to their OpenAI function definition and executor.
 */
export const TOOL_REGISTRY = {
  search_jira_issues: {
    definition: {
      type: "function",
      function: {
        name: "search_jira_issues",
        description: "Search for Jira issues using JQL (Jira Query Language). Use this to find similar issues, check for duplicates, or look up related work. Returns up to 10 issues with their key, summary, status, and the validated field's content (truncated to 500 chars).",
        parameters: {
          type: "object",
          properties: {
            jql: {
              type: "string",
              description: "A JQL query string. Must include a search restriction (project, text, summary, etc.). Examples: 'project = PROJ AND text ~ \"login error\"', 'summary ~ \"payment\" AND status != Done'",
            },
          },
          required: ["jql"],
        },
      },
    },
  },
};

/**
 * Call OpenAI API to validate text against a prompt
 */
export const callOpenAI = async (fieldValue, validationPrompt, attachmentParts) => {
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    console.error("OpenAI API key not configured");
    return {
      isValid: false,
      reason:
        "AI validation not configured. Please set OPENAI_API_KEY environment variable.",
    };
  }

  const model = getOpenAIModel();

  const hasAttachments = attachmentParts && attachmentParts.length > 0;

  const systemPrompt = hasAttachments
    ? `You are a validation assistant. Your job is to validate content (text, documents, images, and attachments) against specific criteria.
You must respond with ONLY a JSON object in this exact format:
{"isValid": true, "reason": "Brief explanation"}
or
{"isValid": false, "reason": "Brief explanation of why validation failed"}

When validating attachments, analyze the actual content of each file or image provided.
Do not include any other text, markdown, or explanation outside the JSON object.`
    : `You are a validation assistant. Your job is to validate text content against specific criteria.
You must respond with ONLY a JSON object in this exact format:
{"isValid": true, "reason": "Brief explanation"}
or
{"isValid": false, "reason": "Brief explanation of why validation failed"}

Do not include any other text, markdown, or explanation outside the JSON object.`;

  // Build user message content — multimodal when attachments are present
  let userContent;
  if (hasAttachments) {
    const textPart = {
      type: "text",
      text: `Validate the following content against the given criteria.

VALIDATION CRITERIA:
${validationPrompt}

${fieldValue ? `ADDITIONAL TEXT CONTEXT:\n${fieldValue}\n\n` : ""}The attached files/images are the primary content to validate. Analyze their contents thoroughly.

Respond with JSON only.`,
    };
    userContent = [textPart, ...attachmentParts];
  } else {
    userContent = `Validate the following text against the given criteria.

VALIDATION CRITERIA:
${validationPrompt}

TEXT TO VALIDATE:
${fieldValue || "(empty)"}

Respond with JSON only.`;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        max_completion_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      return {
        isValid: false,
        reason: `AI service error: ${response.status}`,
      };
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();

    if (!content) {
      return {
        isValid: false,
        reason: "Empty response from AI service",
      };
    }

    // Parse the JSON response
    const result = JSON.parse(content);
    return {
      isValid: result.isValid === true,
      reason: result.reason || "No reason provided",
    };
  } catch (error) {
    console.error("Error calling OpenAI:", error);
    return {
      isValid: false,
      reason: `AI validation error: ${error.message}`,
    };
  }
};

/**
 * Call OpenAI with tool-calling support for agentic validation.
 */
export const callOpenAIWithTools = async (fieldValue, validationPrompt, attachmentParts, issueContext, projectKey, validatedFieldId, deadline) => {
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    console.error("OpenAI API key not configured");
    return {
      isValid: false,
      reason: "AI validation not configured. Please set OPENAI_API_KEY environment variable.",
    };
  }

  const model = getOpenAIModel();
  const hasAttachments = attachmentParts && attachmentParts.length > 0;

  // Build tool definitions from registry
  const tools = Object.values(TOOL_REGISTRY).map((t) => t.definition);

  const projectScope = projectKey ? `project = ${projectKey}` : null;

  const systemPrompt = `You are a Jira workflow validation gate. You evaluate field content against criteria and return a pass/fail JSON verdict. Be concise, factual, and non-confrontational — users seeing a rejection are already frustrated.

CONTEXT:
${issueContext ? `- ${issueContext}` : "- No issue context available"}
${projectKey ? `- Project: ${projectKey}` : "- Project: unknown"}
- Validated field: ${validatedFieldId || "unknown"}

DECISION FRAMEWORK — when to use tools:
- The criteria involves comparing against OTHER Jira issues (duplicates, similarity, prior work) → SEARCH first, then judge.
- The criteria is about the quality, format, or completeness of THIS content alone → validate directly, do NOT search.

SEARCH STRATEGY (when searching):
- Always scope JQL to the project: ${projectScope ? `use "${projectScope} AND ..."` : "include a project clause if you can infer the project key from the issue context"}.
- The field being validated is "${validatedFieldId}". When the criteria is about comparing that field's content, prefer \`${validatedFieldId} ~ "phrase"\` over \`text ~ "phrase"\` so results are scoped to the same field. Use \`text ~\` only when you need broader cross-field coverage.
- Try multiple approaches: first search by key phrases from the content, then by broader topic terms.
- Extract 2-3 distinct concepts and build targeted queries. Combine with OR for broader coverage.
- If a query returns an error, simplify it and retry — don't waste rounds on syntax fixes.
- Search results include the validated field's content (truncated) so you can compare field values directly.

JUDGMENT CALIBRATION:
- Two issues are duplicates only if they describe the same problem, not merely the same feature area.
- Partial overlap in topic is not sufficient grounds for rejection.
- Different symptoms, environments, or user actions make issues distinct even if the root cause might be related.
- When in doubt, pass — false rejections are worse than missed duplicates.

RESPONSE FORMAT:
- When done, respond with ONLY a JSON object: {"isValid": true, "reason": "..."}  or  {"isValid": false, "reason": "..."}
- Keep reasons to 1-2 sentences.
- On rejection due to potential duplicates, list the specific issue keys and briefly explain why each matches.
- On pass, a simple confirmation is sufficient.
- Do not include any text outside the JSON object.`;

  // Build initial user message
  let userContent;
  if (hasAttachments) {
    const textPart = {
      type: "text",
      text: `Validate the following content against the given criteria.\n\nVALIDATION CRITERIA:\n${validationPrompt}\n\n${fieldValue ? `ADDITIONAL TEXT CONTEXT:\n${fieldValue}\n\n` : ""}The attached files/images are the primary content to validate.\n\nRespond with JSON only when you have your final answer.`,
    };
    userContent = [textPart, ...attachmentParts];
  } else {
    userContent = `Validate the following text against the given criteria.\n\nVALIDATION CRITERIA:\n${validationPrompt}\n\nTEXT TO VALIDATE:\n${fieldValue || "(empty)"}\n\nRespond with JSON only when you have your final answer.`;
  }

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];

  // Observability: track tool usage across the loop
  const toolMeta = {
    toolsUsed: false,
    toolRounds: 0,
    queries: [],
    totalResults: 0,
  };

  // Agentic loop: up to MAX_TOOL_ROUNDS tool-call iterations + 1 final answer iteration
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    // Timeout check
    if (Date.now() >= deadline) {
      console.log(`Agentic validation timed out at round ${round}`);
      return {
        isValid: true,
        reason: "Validation timed out while gathering context. Transition allowed.",
        toolMeta,
      };
    }

    try {
      const requestBody = {
        model,
        messages,
        max_completion_tokens: 1000,
      };

      // Offer tools only if we haven't exhausted tool-call rounds
      if (round < MAX_TOOL_ROUNDS) {
        requestBody.tools = tools;
        requestBody.tool_choice = "auto";
      }

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenAI API error (agentic):", response.status, errorText);
        return { isValid: false, reason: `AI service error: ${response.status}`, toolMeta };
      }

      const data = await response.json();
      const choice = data.choices[0];
      const message = choice.message;

      // Append assistant message to conversation history
      messages.push(message);

      // Check if the model wants to call tools
      if (message.tool_calls && message.tool_calls.length > 0) {
        toolMeta.toolsUsed = true;
        toolMeta.toolRounds++;
        console.log(`Agentic round ${round}: model requested ${message.tool_calls.length} tool call(s)`);

        for (const toolCall of message.tool_calls) {
          const toolName = toolCall.function.name;
          const tool = TOOL_REGISTRY[toolName];

          let toolResult;
          if (!tool) {
            toolResult = JSON.stringify({ error: `Unknown tool: ${toolName}` });
          } else if (Date.now() >= deadline) {
            toolResult = JSON.stringify({ error: "Timeout: cannot execute tool" });
          } else {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              console.log(`Executing tool "${toolName}":`, JSON.stringify(args));
              toolResult = await tool.execute(args, validatedFieldId);

              // Track JQL queries for observability
              if (toolName === "search_jira_issues" && args.jql) {
                const parsed = JSON.parse(toolResult);
                toolMeta.queries.push(args.jql);
                toolMeta.totalResults += parsed.total || 0;
              }
            } catch (e) {
              console.error(`Tool "${toolName}" execution error:`, e);
              toolResult = JSON.stringify({ error: `Tool execution error: ${e.message}` });
            }
          }

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: toolResult,
          });
        }

        continue; // Next iteration: model processes tool results
      }

      // Model gave a final text response (no tool calls)
      const content = message.content?.trim();
      if (!content) {
        return { isValid: false, reason: "Empty response from AI service", toolMeta };
      }

      const result = JSON.parse(content);
      return {
        isValid: result.isValid === true,
        reason: result.reason || "No reason provided",
        toolMeta,
      };
    } catch (error) {
      console.error(`Error in agentic loop round ${round}:`, error);
      return { isValid: false, reason: `AI validation error: ${error.message}`, toolMeta };
    }
  }

  // Exhausted all rounds without a final answer — fail open
  console.log("Agentic validation exhausted max tool-call rounds");
  return {
    isValid: true,
    reason: "Validation reached maximum tool-call rounds without a final answer. Transition allowed.",
    toolMeta,
  };
};