/*
 * Semantic Post Function Module - Handles semantic AI-based post function execution
 */

import api, { route } from '@forge/api';
import { callOpenAI, extractFieldDisplayValue } from '../validator/openai-client.js';

/**
 * Execute Semantic Post Function
 */
export const executeSemanticPostFunction = async ({ issueContext, conditionPrompt, actionPrompt, fieldId, actionFieldId, dryRun, changelog, transition, workflow }) => {
  console.log(`executeSemanticPostFunction: issue=${issueContext.key}, validationField=${fieldId}, actionField=${actionFieldId}`);
  
  // Log transition information (Forge best practice)
  if (transition?.executionId) {
    console.log(`Transition execution ID: ${transition.executionId}`);
  }
  if (changelog && changelog.length > 0) {
    console.log(`Changelog entries: ${changelog.length} field(s) changed`);
    changelog.forEach(entry => {
      console.log(`  - ${entry.field}: "${entry.from}" -> "${entry.to}"`);
    });
  }

  try {
    // Always get the modifiedFields from context if available (transition in progress)
    const modifiedFields = issueContext.modifiedFields || null;
    
    // For condition check, we evaluate against the field being validated
    let fieldValueToValidate = await getFieldValue(issueContext.key, fieldId, modifiedFields);
    
    if (conditionPrompt && conditionPrompt.trim()) {
      const conditionResult = await callOpenAI(fieldValueToValidate, conditionPrompt);
      
      if (!conditionResult.isValid) {
        return { success: true, skipped: true, reason: `Condition not met: ${conditionResult.reason}` };
      }
      console.log(`Semantic post function condition passed`);
    }

    // Now execute the action on the target field
    let currentActionFieldValue = await getFieldValue(issueContext.key, actionFieldId, modifiedFields);
    
    if (!actionPrompt || !actionPrompt.trim()) {
      return { success: false, error: "Action prompt is required for semantic post functions" };
    }
    
    const actionResult = await callOpenAI(currentActionFieldValue, actionPrompt);

    if (!actionResult.isValid) {
      console.log(`Action prompt returned invalid: ${actionResult.reason}`);
      return { success: true, skipped: true, reason: `Action not applied: ${actionResult.reason}` };
    }

    const newValue = actionResult.reason;

    if (dryRun) {
      return { success: true, dryRun: true, changes: [{ field: actionFieldId, oldValue: currentActionFieldValue, newValue }] };
    }

    try {
      console.log(`Updating issue ${issueContext.key} field ${actionFieldId} with new value`);
      const response = await api.asApp().requestJira(
        route`/rest/api/3/issue/${issueContext.key}`,
        { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields: { [actionFieldId]: newValue } }) }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to update issue: ${response.status} - ${errorBody}`);
      }

      return { success: true, changes: [{ field: actionFieldId, oldValue: currentActionFieldValue, newValue }] };
    } catch (error) {
      console.error("Failed to update field:", error);
      return { success: false, error: `Failed to update field "${actionFieldId}": ${error.message}` };
    }
  } catch (error) {
    console.error("executeSemanticPostFunction error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Get field value from issue
 */
export const getFieldValue = async (issueKey, fieldId, modifiedFields) => {
  let rawValue = null;

  // Check if the field was modified on the transition screen
  if (modifiedFields && fieldId in modifiedFields) {
    rawValue = modifiedFields[fieldId];
  } else if (!issueKey) {
    console.log(`No issue key available and field "${fieldId}" not in modifiedFields`);
    return null;
  } else {
    try {
      const response = await api.asApp().requestJira(
        route`/rest/api/3/issue/${issueKey}?fields=${fieldId}&expand=renderedFields`
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
          // Strip HTML tags to get plain text — use as fallback only if ADF extraction yields nothing
          const adfResult = extractFieldDisplayValue(rawValue);
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
  return extractFieldDisplayValue(rawValue);
};

// Re-export extractFieldDisplayValue for consumers of semantic.js module
export { extractFieldDisplayValue };
