/*
 * CogniRunner - AI-powered workflow validation for Jira
 * Copyright (C) 2025 LeanZero
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React, { useState } from "react";

const OPERATION_TYPES = [
  { id: "work_item_query", label: "JQL Search" },
  { id: "rest_api_internal", label: "Jira REST API" },
  { id: "rest_api_external", label: "External API" },
  { id: "confluence_api", label: "Confluence API" },
  { id: "log_function", label: "Debug Log" },
];

const CONFLUENCE_OPERATIONS = [
  "GET_PAGE", "UPDATE_PAGE", "CREATE_PAGE", "DELETE_PAGE", "ADD_COMMENT",
];

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"];

/**
 * Generate a code template stub based on operation type and prompts.
 */
function generateFunctionCode(conditionPrompt, operationType, operationPrompt, endpoint, method) {
  const lines = [
    `// Condition: ${(conditionPrompt || "").substring(0, 80)}`,
    `// Operation: ${operationType} - ${(operationPrompt || "").substring(0, 80)}`,
    ``,
  ];

  switch (operationType) {
    case "work_item_query":
      lines.push(
        `// JQL Search`,
        `const results = await api.searchJql("${(operationPrompt || "project = PROJ").replace(/"/g, '\\"')}");`,
        `return results.issues || [];`,
      );
      break;
    case "rest_api_internal":
      lines.push(
        `// Jira REST API: ${method || "GET"} ${endpoint || "/rest/api/3/issue/{key}"}`,
        `const issue = await api.getIssue(api.context.issueKey);`,
        `return issue;`,
      );
      break;
    case "rest_api_external":
      lines.push(
        `// External API call`,
        `// Note: External URLs must be whitelisted in manifest.yml`,
        `api.log("External call to: ${(endpoint || "").replace(/"/g, '\\"')}");`,
        `return null;`,
      );
      break;
    case "confluence_api":
      lines.push(
        `// Confluence API operation`,
        `api.log("Confluence operation: ${method || "GET_PAGE"}");`,
        `return null;`,
      );
      break;
    case "log_function":
      lines.push(
        `// Debug log`,
        `api.log("${(operationPrompt || "Debug message").replace(/"/g, '\\"')}");`,
      );
      break;
    default:
      lines.push(`// Unknown operation type`);
  }

  return lines.join("\n");
}

export default function FunctionBlock({ index, functionData, onUpdate, onRemove }) {
  const [isGenerating, setIsGenerating] = useState(false);

  const update = (field, value) => onUpdate({ [field]: value });

  const handleRegenerate = () => {
    setIsGenerating(true);
    const code = generateFunctionCode(
      functionData.conditionPrompt,
      functionData.operationType,
      functionData.operationPrompt,
      functionData.endpoint,
      functionData.method,
    );
    setTimeout(() => {
      onUpdate({ code });
      setIsGenerating(false);
    }, 300);
  };

  const hasPrompts = functionData.conditionPrompt?.trim() && functionData.operationPrompt?.trim();

  return (
    <div className="function-block">
      <div className="function-header">
        <span className="function-number">#{index + 1}</span>
        <input
          type="text"
          className="input function-name-input"
          value={functionData.name || ""}
          onChange={(e) => update("name", e.target.value)}
          placeholder="Function name (optional)"
        />
        <button
          className="btn-remove"
          onClick={() => onRemove(functionData.id)}
          title="Remove function"
        >
          &times;
        </button>
      </div>

      <div className="form-group">
        <label className="label">Condition Prompt</label>
        <textarea
          className="textarea"
          rows={3}
          value={functionData.conditionPrompt || ""}
          onChange={(e) => update("conditionPrompt", e.target.value)}
          placeholder="AI evaluates: run (true) or skip (false)"
        />
        <p className="hint">AI evaluates if this condition is met. Returns true (run) or false (skip).</p>
      </div>

      <div className="form-group">
        <label className="label">Operation Type</label>
        <select
          className="input"
          value={functionData.operationType || "work_item_query"}
          onChange={(e) => update("operationType", e.target.value)}
          style={{ cursor: "pointer" }}
        >
          {OPERATION_TYPES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Operation-specific fields */}
      {functionData.operationType === "work_item_query" && (
        <div className="form-group">
          <label className="label">JQL Search Prompt</label>
          <textarea
            className="textarea"
            rows={4}
            value={functionData.operationPrompt || ""}
            onChange={(e) => update("operationPrompt", e.target.value)}
            placeholder="Describe what to search for. AI generates JQL."
          />
        </div>
      )}

      {functionData.operationType === "rest_api_internal" && (
        <>
          <div className="form-group">
            <label className="label">Endpoint Template</label>
            <input
              type="text"
              className="input"
              value={functionData.endpoint || ""}
              onChange={(e) => update("endpoint", e.target.value)}
              placeholder="/rest/api/3/issue/${issueKey}"
            />
          </div>
          <div className="form-group">
            <label className="label">HTTP Method</label>
            <select
              className="input"
              value={functionData.method || "GET"}
              onChange={(e) => update("method", e.target.value)}
              style={{ cursor: "pointer" }}
            >
              {HTTP_METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Operation Description</label>
            <textarea
              className="textarea"
              rows={3}
              value={functionData.operationPrompt || ""}
              onChange={(e) => update("operationPrompt", e.target.value)}
              placeholder="Describe the REST API operation"
            />
          </div>
        </>
      )}

      {functionData.operationType === "rest_api_external" && (
        <>
          <div className="form-group">
            <label className="label">External URL Template</label>
            <input
              type="text"
              className="input"
              value={functionData.endpoint || ""}
              onChange={(e) => update("endpoint", e.target.value)}
              placeholder="https://api.example.com/resource/${variable}"
            />
            <p className="hint">{"Supports ${variable} references from previous functions."}</p>
          </div>
          <div className="form-group">
            <label className="label">Operation Description</label>
            <textarea
              className="textarea"
              rows={3}
              value={functionData.operationPrompt || ""}
              onChange={(e) => update("operationPrompt", e.target.value)}
              placeholder="Describe the external API operation"
            />
          </div>
        </>
      )}

      {functionData.operationType === "confluence_api" && (
        <>
          <div className="form-group">
            <label className="label">Confluence Operation</label>
            <select
              className="input"
              value={functionData.method || "GET_PAGE"}
              onChange={(e) => update("method", e.target.value)}
              style={{ cursor: "pointer" }}
            >
              {CONFLUENCE_OPERATIONS.map((op) => (
                <option key={op} value={op}>{op.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Space Key (optional)</label>
            <input
              type="text"
              className="input"
              value={functionData.operationPrompt || ""}
              onChange={(e) => update("operationPrompt", e.target.value)}
              placeholder="e.g., ENG"
            />
          </div>
        </>
      )}

      {functionData.operationType === "log_function" && (
        <div className="form-group">
          <label className="label">Log Message Template</label>
          <textarea
            className="textarea"
            rows={3}
            value={functionData.operationPrompt || ""}
            onChange={(e) => update("operationPrompt", e.target.value)}
            placeholder={"Issue ${issueKey} processed with result: ${previousResult}"}
          />
          <p className="hint">{"Supports ${variable} references from previous functions."}</p>
        </div>
      )}

      {/* Variable name — hidden for log_function */}
      {functionData.operationType !== "log_function" && (
        <div className="form-group">
          <label className="label">Variable Name</label>
          <input
            type="text"
            className="input"
            value={functionData.variableName || ""}
            onChange={(e) => update("variableName", e.target.value)}
            placeholder={`result${index + 1}`}
          />
          <p className="hint">
            {"Other functions can reference this result using ${" + (functionData.variableName || `result${index + 1}`) + "}."}
          </p>
        </div>
      )}

      {/* Generated code */}
      <div className="form-group">
        <label className="label">Generated Code</label>
        <textarea
          className="textarea code-editor"
          rows={8}
          value={functionData.code || ""}
          onChange={(e) => update("code", e.target.value)}
          readOnly={!hasPrompts}
          placeholder={hasPrompts ? "" : "Fill in condition and operation prompts to enable code editing"}
        />
        {hasPrompts && (
          <button
            className="btn-regenerate"
            onClick={handleRegenerate}
            disabled={isGenerating}
          >
            {isGenerating ? "Generating..." : "Regenerate Code"}
          </button>
        )}
        <div className="form-group" style={{ marginTop: "4px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-secondary)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={functionData.includeBackoff || false}
              onChange={(e) => update("includeBackoff", e.target.checked)}
            />
            Include exponential backoff for API calls (3 retries)
          </label>
        </div>
      </div>
    </div>
  );
}
