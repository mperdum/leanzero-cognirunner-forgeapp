/*
 * CogniRunner - AI-powered workflow validation for Jira
 * Copyright (C) 2025 LeanZero
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React, { useState } from "react";
import Tooltip from "./Tooltip";

/**
 * Generate a starter code template from a natural language description.
 * This is a client-side stub — in production, this would call the backend
 * to use OpenAI for real code generation.
 */
function generateCodeFromPrompt(prompt) {
  const p = (prompt || "").toLowerCase();

  if (p.includes("jql") || p.includes("search") || p.includes("find") || p.includes("duplicate")) {
    return `// ${prompt}
const results = await api.searchJql("project = " + api.context.issueKey.split("-")[0] + " AND summary ~ \\"keyword\\"");
api.log("Found " + (results.issues?.length || 0) + " results");
return results.issues || [];`;
  }

  if (p.includes("update") || p.includes("set") || p.includes("change") || p.includes("modify")) {
    return `// ${prompt}
const issue = await api.getIssue(api.context.issueKey);
await api.updateIssue(api.context.issueKey, {
  // Add fields to update here
  // summary: "Updated summary",
});
api.log("Updated issue " + api.context.issueKey);
return { success: true };`;
  }

  if (p.includes("transition") || p.includes("move") || p.includes("status")) {
    return `// ${prompt}
// Find the target transition ID first
await api.transitionIssue(api.context.issueKey, "TRANSITION_ID");
api.log("Transitioned issue " + api.context.issueKey);
return { success: true };`;
  }

  if (p.includes("log") || p.includes("debug") || p.includes("print")) {
    return `// ${prompt}
const issue = await api.getIssue(api.context.issueKey);
api.log("Issue: " + issue.key + " Status: " + issue.fields.status.name);`;
  }

  // Generic template
  return `// ${prompt}
const issue = await api.getIssue(api.context.issueKey);
api.log("Processing issue: " + issue.key);

// Your logic here — use the available API:
//   api.getIssue(key)        - Fetch issue data
//   api.updateIssue(key, {}) - Update issue fields
//   api.searchJql(jql)       - Search issues by JQL
//   api.transitionIssue(key, transitionId) - Move issue
//   api.log(message)         - Debug logging
//   api.context.issueKey     - Current issue key

return { success: true };`;
}

export default function FunctionBlock({ index, functionData, onUpdate, onRemove, isOnly }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(
    !!(functionData.variableName || functionData.includeBackoff),
  );

  const update = (field, value) => onUpdate({ [field]: value });

  const handleGenerate = () => {
    setIsGenerating(true);
    const code = generateCodeFromPrompt(functionData.operationPrompt);
    setTimeout(() => {
      onUpdate({ code });
      setIsGenerating(false);
    }, 400);
  };

  const hasPrompt = functionData.operationPrompt?.trim();
  const hasCode = functionData.code?.trim();

  return (
    <div className="function-block">
      <div className="function-header">
        <span className="function-number">#{index + 1}</span>
        <input
          type="text"
          className="input function-name-input"
          value={functionData.name || ""}
          onChange={(e) => update("name", e.target.value)}
          placeholder={`Step ${index + 1} name (optional)`}
        />
        {!isOnly && (
          <button
            className="btn-remove"
            onClick={() => onRemove(functionData.id)}
            title="Remove this step"
          >
            &times;
          </button>
        )}
      </div>

      {/* Main prompt — the core input */}
      <div className="form-group">
        <label className="label">
          What should this step do?
          <Tooltip text="Describe the action in plain language. AI will generate JavaScript code that runs automatically on every transition — no AI cost at runtime." />
        </label>
        <textarea
          className="textarea"
          rows={4}
          value={functionData.operationPrompt || ""}
          onChange={(e) => update("operationPrompt", e.target.value)}
          placeholder={"Example: \"Find all issues in this project with the same summary and add a comment linking to them\""}
        />
      </div>

      {/* Generate button */}
      <div className="generate-row">
        <button
          className={`btn-generate ${hasCode ? "btn-generate-secondary" : ""}`}
          onClick={handleGenerate}
          disabled={isGenerating || !hasPrompt}
        >
          {isGenerating ? "Generating..." : hasCode ? "Regenerate Code" : "Generate Code"}
        </button>
        {!hasPrompt && (
          <span className="generate-hint">Describe what this step does to enable code generation</span>
        )}
      </div>

      {/* Generated code — only shown after generation or if already has code */}
      {hasCode && (
        <div className="form-group">
          <label className="label">
            Generated Code
            <Tooltip text="This JavaScript runs on every workflow transition. You can edit it directly. The code has access to api.getIssue(), api.updateIssue(), api.searchJql(), api.transitionIssue(), api.log(), and api.context." />
          </label>
          <textarea
            className="textarea code-editor"
            rows={10}
            value={functionData.code || ""}
            onChange={(e) => update("code", e.target.value)}
          />
          <p className="hint">
            This code runs as-is on every transition. Edit directly if needed.
          </p>
        </div>
      )}

      {/* Advanced options — collapsed by default */}
      {hasCode && (
        <div className="advanced-section">
          <button
            className="btn-advanced-toggle"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? "Hide" : "Show"} advanced options
            <span className={`toggle-chevron ${showAdvanced ? "open" : ""}`}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
            </span>
          </button>

          {showAdvanced && (
            <div className="advanced-options">
              <div className="form-group">
                <label className="label">
                  Result Variable Name
                  <Tooltip text="If you chain multiple steps, this step's return value is available to later steps via ${variableName}. Leave empty if this step doesn't produce a result needed by other steps." />
                </label>
                <input
                  type="text"
                  className="input"
                  value={functionData.variableName || ""}
                  onChange={(e) => update("variableName", e.target.value)}
                  placeholder={`result${index + 1}`}
                />
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={functionData.includeBackoff || false}
                  onChange={(e) => update("includeBackoff", e.target.checked)}
                />
                Include retry logic with exponential backoff (3 retries)
                <Tooltip text="Wraps API calls in retry logic so transient failures (rate limits, timeouts) are handled automatically." />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
