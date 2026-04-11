/*
 * Semantic Post Function Module - Handles agentic AI-based post function execution
 */

import api, { route } from '@forge/api';
import { callOpenAIWithTools, extractFieldDisplayValue } from '../validator/openai-client.js';

// For testing purposes
export const isTestEnv = process.env.NODE_ENV === 'test';

/**
 * Execute a semantic post-function using an agentic approach.
 * This combines condition checking and action generation into a single AI call
 * to reduce latency/cost and allow the use of Jira tools for smarter decisions.
 *
 * @param {Object} issueContext - The context of the issue being transitioned (includes projectKey, etc.).
 * @param {string} [combinedPrompt] - A unified prompt that describes both the condition AND the action.
 * @param {string} [conditionPrompt] - Condition criteria (used when combinedPrompt is not provided).
 * @param {string} [actionPrompt] - Action description (used when combinedPrompt is not provided).
 * @param {string} fieldId - The ID of the field used in the condition (for context).
 * @param {string} actionFieldId - The ID of the field that should be updated.
 * @param {Object} options - Additional options like dryRun, transition, etc.
 * @returns {Promise<Object>} An object indicating success or failure and whether the post-function was skipped.
 */
export const executeSemanticPostFunction = async (
  { issueContext, combinedPrompt, conditionPrompt, actionPrompt, fieldId, actionFieldId, dryRun, transition },
  dependencies = {}
) => {
  const {
    api: injectedApi = api,
    route: injectedRoute = route,
    callOpenAIWithTools: injectedCallOpenAIWithTools = callOpenAIWithTools,
    getFieldValue: injectedGetFieldValue = getFieldValue
  } = dependencies;

  try {
    console.log(`Executing agentic semantic post-function: ${fieldId} -> ${actionFieldId}`);

    // 1. Get the current value of the field to provide context for the AI
    const fieldValue = await injectedGetFieldValue(
      issueContext.key,
      fieldId,
      issueContext.modifiedFields,
      dependencies
    );
    console.log(`Current value for ${fieldId}: ${fieldValue}`);

    // 2. Use Agentic AI to evaluate condition and decide on action in one pass
    console.log("Running agentic decision loop...");
    const deadline = Date.now() + 20000; // 20s budget for the process

    // Build the criteria text from either combinedPrompt or conditionPrompt+actionPrompt
    const criteriaText = combinedPrompt
      || [conditionPrompt, actionPrompt].filter(Boolean).join("\n\nACTION INSTRUCTIONS:\n");

    // Construct a specialized prompt that instructs the AI to return a structured JSON verdict
    const unifiedPrompt = `
      You are an automated Jira workflow agent. Your goal is to evaluate a condition and perform an action based on it.

      CONDITION:
      Does the current state of the issue satisfy this criteria?
      Criteria: ${criteriaText}
      Current value of "${fieldId}": ${fieldValue || "(empty)"}

      ACTION:
      If (and only if) the condition is satisfied, determine the new value for the field "${actionFieldId}".

      DECISION RULES:
      - If the condition is NOT met, you must decide to SKIP.
      - If the condition IS met, you must decide to UPDATE and provide the new value for "${actionFieldId}".

      REQUIRED JSON RESPONSE FORMAT:
      You MUST respond with ONLY a valid JSON object in this format:
      {
        "decision": "UPDATE" | "SKIP",
        "value": "the new value if updating, otherwise null",
        "reason": "short explanation of your decision"
      }

      Do not include any text, markdown, or explanations outside the JSON object.
    `;

    const agenticResult = await injectedCallOpenAIWithTools(
      fieldValue,
      unifiedPrompt,
      [], // No attachments for this specific logic currently
      issueContext.summary || "",
      issueContext.projectKey || "",
      fieldId,
      deadline,
      dependencies
    );

    // Handle AI service failures or timeouts (fail open to allow transition)
    if (agenticResult.reason?.includes("timed out")) {
        console.log("Agentic loop timed out. Failing open (allowing transition).");
        return { success: true, skipped: true };
    }

    // Extract decision from the parsed JSON response in 'reason'
    let decision, newValue, finalReason;
    try {
        const parsedResponse = JSON.parse(agenticResult.reason);
        decision = parsedResponse.decision;
        newValue = parsedResponse.value;
        finalReason = parsedResponse.reason;
    } catch (e) {
        console.error("Failed to parse agentic decision JSON from reason field:", e, "Reason content:", agenticResult.reason);
        // If parsing fails, we fail open to avoid blocking the user's transition
        return { success: true, skipped: true };
    }

    console.log(`Agent Decision: ${decision} (Reason: ${finalReason})`);

    if (decision === "SKIP") {
      console.log("Condition not met or agent decided to skip. Skipping post-function.");
      return { success: true, skipped: true, reason: finalReason };
    }

      if (decision === "UPDATE") {
        if (!newValue) {
          throw new Error("Agent decided to UPDATE but provided no value.");
        }

        // 3. Update the target field in Jira
        console.log(`Updating ${actionFieldId} with value: ${newValue}`);
        
        if (dryRun) {
          console.log("[DRY RUN] Skipping actual update");
          return { success: true, dryRun: true, changes: [{ field: actionFieldId, newValue }] };
        }

        const response = await injectedApi.asApp().requestJira(
          injectedRoute`/rest/api/3/issue/${issueContext.key}`,
          { 
            method: "PUT", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({ fields: { [actionFieldId]: newValue } }) 
          }
        );

        if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to update issue: ${response.status} - ${errorBody}`);
      }

      console.log("Agentic semantic post-function executed successfully.");
      return { success: true, skipped: false, changes: [{ field: actionFieldId, newValue }] };
    }

    return { success: true, skipped: true };

  } catch (error) {
    console.error(`Error executing agentic semantic post-function: ${error.message}`);
    // Return success: true to avoid blocking the workflow transition unless it's a critical failure
    return { success: false, error: error.message };
  }
};

/**
 * Get field value from issue
 */
export const getFieldValue = async (issueKey, fieldId, modifiedFields, dependencies = {}) => {
  const {
    api: injectedApi = api,
    route: injectedRoute = route,
    extractFieldDisplayValue: injectedExtractFieldDisplayValue = extractFieldDisplayValue
  } = dependencies;

  let rawValue = null;

  // Check if the field was modified on the transition screen
  if (modifiedFields && fieldId in modifiedFields) {
    rawValue = modifiedFields[fieldId];
  } else if (!issueKey) {
    console.log(`No issue key available and field "${fieldId}" not in modifiedFields`);
    return null;
  } else {
    try {
      const response = await injectedApi.asApp().requestJira(
        injectedRoute`/rest/api/3/issue/${issueKey}?fields=${fieldId}&expand=renderedFields`
      );

      if (!response.ok) {
        console.error("Failed to fetch issue:", response.status);
        return null;
      }

      const issue = await response.json();
      rawValue = issue.fields?.[fieldId];

      // If the raw value is complex (ADF/object), try renderedFields as a pre-rendered HTML fallback
      if (rawValue && typeof rawValue === "object" && issue.renderedFields?.[fieldId]) {
        const rendered = issue.renderedFields[fieldId];
        if (typeof rendered === "string" && rendered.length > 0) {
          // Strip HTML tags to get plain text — as a fallback only if ADF extraction yields nothing
          const adfResult = injectedExtractFieldDisplayValue(rawValue);
          if (!adfResult || adfResult === "[Complex value]" || adfResult === "[ADF content]") {
            return rendered.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
          }
          return adfResult;
        }
      }
    } catch (error) {
      console.error("Error fetching issue:", error);
      return null;
    }
  }

  // Extract human-readable display value
  return injectedExtractFieldDisplayValue(rawValue);
};

// Re-export extractFieldDisplayValue for consumers of semantic.js module
export { extractFieldDisplayValue };