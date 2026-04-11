/*
 * CogniRunner - AI-powered workflow validation for Jira
 * Copyright (C) 2025 LeanZero
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React, { useState } from "react";
import { invoke } from "@forge/bridge";
import Tooltip from "./Tooltip";
import CustomSelect from "./CustomSelect";
import CodeEditor from "./CodeEditor";

const OPERATION_TYPES = [
  {
    value: "work_item_query",
    label: "JQL Search",
    meta: "Search Jira issues using JQL queries",
  },
  {
    value: "rest_api_internal",
    label: "Jira REST API",
    meta: "Call any Jira REST endpoint",
  },
  {
    value: "rest_api_external",
    label: "External API",
    meta: "Call an external HTTP endpoint",
  },
  {
    value: "confluence_api",
    label: "Confluence API",
    meta: "Read or write Confluence pages",
  },
  {
    value: "log_function",
    label: "Debug Log",
    meta: "Log a message for troubleshooting",
  },
];

const HTTP_METHODS = [
  { value: "GET", label: "GET", meta: "Read data" },
  { value: "POST", label: "POST", meta: "Create data" },
  { value: "PUT", label: "PUT", meta: "Update data" },
  { value: "DELETE", label: "DELETE", meta: "Delete data" },
  { value: "PATCH", label: "PATCH", meta: "Partial update" },
];

const CONFLUENCE_OPS = [
  { value: "GET_PAGE", label: "Get Page" },
  { value: "UPDATE_PAGE", label: "Update Page" },
  { value: "CREATE_PAGE", label: "Create Page" },
  { value: "DELETE_PAGE", label: "Delete Page" },
  { value: "ADD_COMMENT", label: "Add Comment" },
];

/**
 * Generate a code template based on operation type and description.
 */
function generateCode(operationType, prompt, endpoint, method, includeBackoff) {
  const header = `// ${(prompt || "").substring(0, 100)}`;
  const backoffPre = includeBackoff
    ? `\n// Retry wrapper with exponential backoff + jitter
async function withRetry(fn, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
      const jitter = Math.random() * delay * 0.3;
      await new Promise(r => setTimeout(r, delay + jitter));
      api.log("Retry " + (attempt + 1) + "/" + maxRetries + ": " + err.message);
    }
  }
}\n`
    : "";

  const wrap = (code) => includeBackoff
    ? `return await withRetry(async () => {\n  ${code.split("\n").join("\n  ")}\n});`
    : code;

  switch (operationType) {
    case "work_item_query":
      return `${header}${backoffPre}
${wrap(`const results = await api.searchJql("project = " + api.context.issueKey.split("-")[0] + " AND summary ~ \\"keyword\\"");
api.log("Found " + (results.issues?.length || 0) + " matching issues");
return results.issues || [];`)}`;

    case "rest_api_internal":
      if ((method || "GET") === "GET") {
        return `${header}${backoffPre}
${wrap(`const issue = await api.getIssue(api.context.issueKey);
api.log("Fetched issue: " + issue.key);
return issue;`)}`;
      }
      return `${header}${backoffPre}
// ${method} ${endpoint || "/rest/api/3/issue/{key}"}
${wrap(`await api.updateIssue(api.context.issueKey, {
  // fields to update
});
api.log("Updated issue " + api.context.issueKey);
return { success: true };`)}`;

    case "rest_api_external":
      return `${header}${backoffPre}
// External API: ${endpoint || "https://api.example.com/..."}
// Note: The domain must be whitelisted in manifest.yml > permissions.external.fetch
${wrap(`api.log("External call to: ${(endpoint || "").replace(/"/g, '\\"')}");
// Use fetch() for external calls — configure in manifest.yml
return null;`)}`;

    case "confluence_api":
      return `${header}${backoffPre}
// Confluence: ${method || "GET_PAGE"}
${wrap(`api.log("Confluence operation: ${method || "GET_PAGE"}");
return null;`)}`;

    case "log_function":
      return `${header}
const issue = await api.getIssue(api.context.issueKey);
api.log("Issue: " + issue.key + " | Status: " + issue.fields.status.name + " | ${(prompt || "debug").replace(/"/g, '\\"')}");`;

    default:
      return `${header}${backoffPre}
${wrap(`const issue = await api.getIssue(api.context.issueKey);
api.log("Processing: " + issue.key);
return { success: true };`)}`;
  }
}

export default function FunctionBlock({ index, functionData, onUpdate, onRemove, isOnly }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showApiRef, setShowApiRef] = useState(false);
  const [showContext, setShowContext] = useState(!!(functionData.contextDocs));
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testTarget, setTestTarget] = useState(""); // issue key or JQL
  const [showTestPanel, setShowTestPanel] = useState(false);

  const update = (field, value) => onUpdate({ [field]: value });

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const result = await invoke("generatePostFunctionCode", {
        prompt: functionData.operationPrompt,
        operationType: functionData.operationType || "work_item_query",
        endpoint: functionData.endpoint || "",
        method: functionData.method || "GET",
        includeBackoff: functionData.includeBackoff || false,
        contextDocs: functionData.contextDocs || "",
      });
      if (result.success && result.code) {
        onUpdate({ code: result.code });
      } else {
        // Fallback to local template if AI fails
        const code = generateCode(
          functionData.operationType,
          functionData.operationPrompt,
          functionData.endpoint,
          functionData.method,
          functionData.includeBackoff,
        );
        onUpdate({ code });
        console.warn("AI generation failed, used template:", result.error);
      }
    } catch (e) {
      // Fallback to local template on network error
      const code = generateCode(
        functionData.operationType,
        functionData.operationPrompt,
        functionData.endpoint,
        functionData.method,
        functionData.includeBackoff,
      );
      onUpdate({ code });
      console.warn("AI generation error, used template:", e.message);
    }
    setIsGenerating(false);
  };

  const hasPrompt = functionData.operationPrompt?.trim();
  const hasCode = functionData.code?.trim();
  const opType = functionData.operationType || "work_item_query";

  return (
    <div className="function-block">
      {/* Header */}
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

      {/* Description — what this step does */}
      <div className="form-group">
        <label className="label">
          What should this step do?
          <Tooltip text="Describe the action in plain language. AI will generate JavaScript code that runs automatically on every transition — no AI cost at runtime." />
        </label>
        <textarea
          className="textarea"
          rows={3}
          value={functionData.operationPrompt || ""}
          onChange={(e) => update("operationPrompt", e.target.value)}
          placeholder={'Example: "Find all issues in this project with the same summary and add a comment linking to them"'}
        />
      </div>

      {/* Operation type */}
      <div className="form-group">
        <label className="label">
          Operation Type
          <Tooltip text="Choose what kind of operation this step performs. This tells the AI code generator what APIs and patterns to use in the generated code." />
        </label>
        <CustomSelect
          value={opType}
          onChange={(v) => update("operationType", v)}
          options={OPERATION_TYPES}
        />
      </div>

      {/* Operation-specific fields */}
      {opType === "rest_api_internal" && (
        <div className="op-fields">
          <div className="form-group">
            <label className="label">
              HTTP Method
              <Tooltip text="The HTTP method for the Jira REST API call. GET reads data, POST creates, PUT replaces, PATCH partially updates, DELETE removes." />
            </label>
            <CustomSelect
              value={functionData.method || "GET"}
              onChange={(v) => update("method", v)}
              options={HTTP_METHODS}
            />
          </div>
          <div className="form-group">
            <label className="label">
              Endpoint
              <Tooltip text="The Jira REST API path. Use ${issueKey} for the current issue. Example: /rest/api/3/issue/${issueKey}/comment" />
            </label>
            <input
              type="text"
              className="input"
              value={functionData.endpoint || ""}
              onChange={(e) => update("endpoint", e.target.value)}
              placeholder="/rest/api/3/issue/${issueKey}"
            />
          </div>
        </div>
      )}

      {opType === "rest_api_external" && (
        <div className="form-group">
          <label className="label">
            External URL
            <Tooltip text="The full URL of the external API. The domain must be whitelisted in manifest.yml under permissions.external.fetch. Use ${variableName} to reference results from previous steps." />
          </label>
          <input
            type="text"
            className="input"
            value={functionData.endpoint || ""}
            onChange={(e) => update("endpoint", e.target.value)}
            placeholder="https://api.example.com/webhook"
          />
        </div>
      )}

      {opType === "confluence_api" && (
        <div className="op-fields">
          <div className="form-group">
            <label className="label">
              Confluence Operation
              <Tooltip text="The type of Confluence operation. Get, create, update, or delete pages, or add comments." />
            </label>
            <CustomSelect
              value={functionData.method || "GET_PAGE"}
              onChange={(v) => update("method", v)}
              options={CONFLUENCE_OPS}
            />
          </div>
          <div className="form-group">
            <label className="label">
              Space Key
              <Tooltip text="The Confluence space key to operate in (e.g., ENG, DOCS). Leave empty to let the code determine it." />
            </label>
            <input
              type="text"
              className="input"
              value={functionData.endpoint || ""}
              onChange={(e) => update("endpoint", e.target.value)}
              placeholder="e.g., ENG"
            />
          </div>
        </div>
      )}

      {/* Context documents — additional knowledge for AI code generation */}
      <div className="context-section">
        <button
          className="btn-context-toggle"
          onClick={() => setShowContext(!showContext)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span>{showContext ? "Hide" : "Add"} Context Documents</span>
          <Tooltip text="Paste API documentation, JSON schemas, field mappings, or any reference material. The AI uses this context to generate more accurate code tailored to your specific setup." />
          <span className={`toggle-chevron ${showContext ? "open" : ""}`}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
          </span>
        </button>

        {showContext && (
          <div className="context-body">
            <textarea
              className="textarea context-textarea"
              rows={8}
              value={functionData.contextDocs || ""}
              onChange={(e) => update("contextDocs", e.target.value)}
              placeholder={"Paste any reference material here:\n\n- API documentation (endpoints, request/response formats)\n- JSON schemas for custom fields\n- Field ID mappings (e.g., customfield_10050 = Sprint)\n- Business rules or requirements\n- Example payloads or data structures"}
            />
            <p className="hint">
              This context is sent to the AI alongside your description when generating code.
              Supports plain text, JSON, or any documentation format. Max ~10,000 characters.
            </p>
          </div>
        )}
      </div>

      {/* Reliability options — always visible */}
      <div className="reliability-section">
        <div className="reliability-header">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span className="reliability-title">Reliability</span>
        </div>
        <div className="reliability-options">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={functionData.includeBackoff || false}
              onChange={(e) => update("includeBackoff", e.target.checked)}
            />
            <span>
              Exponential backoff with jitter
              <Tooltip text="Automatically retries failed API calls up to 3 times with increasing delays (1s, 2s, 4s) plus random jitter to avoid thundering herd. Essential for external APIs and high-traffic Jira instances." />
            </span>
          </label>
        </div>
      </div>

      {/* Variable name — for chaining steps */}
      {opType !== "log_function" && (
        <div className="form-group">
          <label className="label">
            Result Variable
            <Tooltip text="Name for this step's return value so later steps can reference it. For example, if you name it 'searchResults', step 2 can use ${searchResults} to access the data. Leave empty if no other step needs this result." />
          </label>
          <input
            type="text"
            className="input"
            value={functionData.variableName || ""}
            onChange={(e) => update("variableName", e.target.value)}
            placeholder={`result${index + 1}`}
          />
        </div>
      )}

      {/* Generate / code section */}
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

      {hasCode && (
        <div className="form-group">
          <div className="code-header">
            <label className="label" style={{ margin: 0 }}>
              Generated Code
              <Tooltip text="This JavaScript runs on every workflow transition with no AI cost. You can edit it directly." />
            </label>
            <div className="code-header-actions">
              <button
                className="btn-api-ref"
                onClick={() => setShowApiRef(!showApiRef)}
              >
                {showApiRef ? "Hide" : "Show"} API Reference
              </button>
              <button
                className="btn-test-run"
                onClick={() => setShowTestPanel(!showTestPanel)}
              >
                {showTestPanel ? "Hide" : "Test Run"}
              </button>
            </div>
          </div>

          {/* API Reference panel */}
          {showApiRef && (
            <div className="api-ref-panel">
              <div className="api-ref-title">Available API</div>
              <div className="api-ref-grid">
                <div className="api-ref-item">
                  <code>api.getIssue(key)</code>
                  <span>Fetch issue data by key. Returns full issue object with fields.</span>
                </div>
                <div className="api-ref-item">
                  <code>api.updateIssue(key, fields)</code>
                  <span>Update issue fields. Pass an object like <code>{`{summary: "New title"}`}</code></span>
                </div>
                <div className="api-ref-item">
                  <code>api.searchJql(jql)</code>
                  <span>Search issues by JQL query. Returns <code>{`{issues: [...]}`}</code> (max 20 results).</span>
                </div>
                <div className="api-ref-item">
                  <code>api.transitionIssue(key, id)</code>
                  <span>Move an issue to a different status using the transition ID.</span>
                </div>
                <div className="api-ref-item">
                  <code>api.log(message)</code>
                  <span>Log a debug message. Visible in test results and execution logs.</span>
                </div>
                <div className="api-ref-item">
                  <code>api.context.issueKey</code>
                  <span>The current issue key (e.g., "PROJ-123") being transitioned.</span>
                </div>
              </div>
            </div>
          )}

          <CodeEditor
            value={functionData.code || ""}
            onChange={(v) => update("code", v)}
            rows={12}
          />

          {/* Test panel */}
          {showTestPanel && (
            <div className="test-panel">
              <div className="test-panel-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span className="test-panel-title">Test Run</span>
                <span className="test-panel-badge">Dry run — writes are logged, not executed</span>
              </div>

              <div className="test-panel-target">
                <label className="label" style={{ fontSize: "11px", marginBottom: "4px" }}>
                  Test against
                  <Tooltip text="Enter an issue key (e.g., PROJ-123) to test with real issue data. Or enter a JQL query to find an issue. Leave empty to use mock data." />
                </label>
                <div className="test-target-row">
                  <input
                    type="text"
                    className="input test-target-input"
                    value={testTarget}
                    onChange={(e) => setTestTarget(e.target.value)}
                    placeholder='Issue key (PROJ-123) or JQL (project = PROJ AND status = "To Do")'
                  />
                  <button
                    className="btn-run-test"
                    onClick={async () => {
                      setTestRunning(true);
                      setTestResult(null);
                      try {
                        const target = testTarget.trim();
                        const isJql = target && (target.includes("=") || target.includes("~") || target.startsWith("project") || target.startsWith("status") || target.startsWith("issuetype"));
                        const result = await invoke("testPostFunction", {
                          code: functionData.code,
                          issueKey: target && !isJql ? target : undefined,
                          jql: isJql ? target : undefined,
                        });
                        setTestResult(result);
                      } catch (e) {
                        setTestResult({ success: false, logs: ["Test error: " + e.message] });
                      }
                      setTestRunning(false);
                    }}
                    disabled={testRunning}
                  >
                    {testRunning ? "Running..." : "Run"}
                  </button>
                </div>
                <p className="hint" style={{ marginTop: "4px" }}>
                  {testTarget.trim()
                    ? "Reads will use real Jira data. Writes are always safe (dry run)."
                    : "No issue specified — will use mock data. Enter an issue key for real data."
                  }
                </p>
              </div>

              {/* Test result */}
              {testResult && (
                <div className={`test-result ${testResult.success ? "test-pass" : "test-fail"}`}>
                  <div className="test-result-header">
                    <span className={`test-badge ${testResult.success ? "test-badge-pass" : "test-badge-fail"}`}>
                      {testResult.success ? "PASS" : "FAIL"}
                    </span>
                    <span className="test-result-meta">
                      {testResult.mode === "live" ? `Tested against ${testResult.issueKey}` : "Mock data"}
                      {testResult.executionTimeMs ? ` — ${testResult.executionTimeMs}ms` : ""}
                    </span>
                    <button className="test-dismiss" onClick={() => setTestResult(null)}>&times;</button>
                  </div>
                  {testResult.logs && testResult.logs.length > 0 && (
                    <div className="test-logs">
                      <div className="test-logs-title">Execution log:</div>
                      {testResult.logs.map((log, i) => (
                        <div key={i} className="test-log-line"><code>{log}</code></div>
                      ))}
                    </div>
                  )}
                  {testResult.changes && testResult.changes.length > 0 && (
                    <div className="test-logs">
                      <div className="test-logs-title">Changes that would be made:</div>
                      {testResult.changes.map((c, i) => (
                        <div key={i} className="test-log-line">
                          <code>{c.action}({c.key}{c.fields ? ", " + JSON.stringify(c.fields) : ""})</code>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <p className="hint">
            This code runs as-is on every transition. Edit directly if needed.
          </p>
        </div>
      )}
    </div>
  );
}
