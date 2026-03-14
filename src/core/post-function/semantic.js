/*
 * Semantic Post Function Module - Handles semantic AI-based post function execution
 */

import { callOpenAI } from '../validator/openai-client.js';

/**
 * Execute Semantic Post Function
 */
export const executeSemanticPostFunction = async ({ issueContext, conditionPrompt, actionPrompt, fieldId, actionFieldId, dryRun }) => {
  console.log(`executeSemanticPostFunction: issue=${issueContext.key}, validationField=${fieldId}, actionField=${actionFieldId}`);

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
    } catch (error) {
      console.error("Error fetching issue:", error);
      return null;
    }
  }

  // Extract human-readable display value
  return extractFieldDisplayValue(rawValue);
};

/**
 * Extract a human-readable text value from any Jira field type
 */
export const extractFieldDisplayValue = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (Array.isArray(value)) {
    if (value.length > 0 && value[0].name !== undefined && value[0].checked !== undefined) {
      return value
        .map((item) => `[${item.checked ? "x" : " "}] ${item.name}`)
        .join("\n");
    }
    return value
      .map((item) => extractFieldDisplayValue(item))
      .filter((v) => v)
      .join(", ");
  }

  if (typeof value === "object") {
    // ADF content
    if (value.type === "doc" && value.content) {
      const parts = [];
      const blockTypes = new Set([
        "paragraph", "heading", "blockquote", "codeBlock",
        "rule", "mediaSingle", "mediaGroup", "bulletList",
        "orderedList", "listItem", "table", "tableRow",
        "tableHeader", "tableCell", "panel", "decisionList",
        "decisionItem", "taskList", "taskItem", "expand",
      ]);
      
      const extractFromNode = (node) => {
        if (!node) return;
        
        if (node.type === "text" && node.text) {
          parts.push(node.text);
        }
        
        if (node.content && Array.isArray(node.content)) {
          node.content.forEach((child, index) => {
            extractFromNode(child);
            if (blockTypes.has(child.type) && index < node.content.length - 1) {
              parts.push("\n");
            }
          });
        }
      };
      
      extractFromNode(value);
      return parts.join("").trim();
    }

    // Attachment
    if (value.filename && value.mimeType !== undefined) {
      const parts = [value.filename];
      if (value.size !== undefined) parts.push(`(${Math.round(value.size / 1024)}KB)`);
      if (value.mimeType) parts.push(`[${value.mimeType}]`);
      return parts.join(" ");
    }

    // User
    if (value.displayName) {
      return value.displayName;
    }
    
    // Project
    if (value.key && value.name) {
      return `${value.name} (${value.key})`;
    }

    // Status/Resolution/etc.
    if (value.name) {
      return value.name;
    }
    if (value.value) {
      return value.value;
    }

    try {
      const keys = Object.keys(value);
      if (keys.length <= 5) {
        const readable = keys
          .filter((k) => typeof value[k] === "string" || typeof value[k] === "number")
          .map((k) => `${k}: ${value[k]}`)
          .join(", ");
        if (readable) return readable;
      }
      return JSON.stringify(value);
    } catch {
      return "[Complex value]";
    }
  }

  return String(value);
};