/*
 * CogniRunner - AI-powered workflow validation for Jira
 * Copyright (C) 2025 LeanZero
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React, { useState, useRef, useCallback } from "react";
import { invoke } from "@forge/bridge";
import Tooltip from "./Tooltip";
import CustomSelect from "./CustomSelect";
import CodeEditor from "./CodeEditor";
import DocRepository from "./DocRepository";
import IssuePicker from "./IssuePicker";

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

export default function FunctionBlock({ index, functionData, priorSteps, onUpdate, onRemove, isOnly }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showApiRef, setShowApiRef] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState(functionData.selectedDocIds || []);
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testTarget, setTestTarget] = useState("");
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [opSuggested, setOpSuggested] = useState(false);
  const suggestTimer = useRef(null);

  const update = (field, value) => onUpdate({ [field]: value });

  // Auto-suggest operation type from prompt text (client-side heuristic, instant)
  const suggestOperationType = useCallback((text) => {
    if (!text || text.length < 10) return;
    const t = text.toLowerCase();

    let suggested = null;
    if (/\b(search|find|query|jql|duplicate|look\s*up|fetch\s+issues|list\s+issues)\b/.test(t)) {
      suggested = "work_item_query";
    } else if (/\b(log|debug|print|trace|monitor)\b/.test(t)) {
      suggested = "log_function";
    } else if (/\b(confluence|wiki|page|space\s+key)\b/.test(t)) {
      suggested = "confluence_api";
    } else if (/\b(external|webhook|http|third.party|slack|teams|api\.example|outside\s+jira)\b/.test(t)) {
      suggested = "rest_api_external";
    } else if (/\b(update|modify|set|change|assign|transition|move|create|delete|comment|link|field|summary|description|priority|label|component|version)\b/.test(t)) {
      suggested = "rest_api_internal";
    }

    if (suggested && suggested !== functionData.operationType) {
      onUpdate({ operationType: suggested });
      setOpSuggested(true);
      // Clear the "suggested" badge after 4 seconds
      setTimeout(() => setOpSuggested(false), 4000);
    }
  }, [functionData.operationType, onUpdate]);

  const handlePromptChange = (e) => {
    const val = e.target.value;
    update("operationPrompt", val);

    // Debounce suggestion — wait 800ms after user stops typing
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    suggestTimer.current = setTimeout(() => suggestOperationType(val), 800);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      // Fetch selected doc contents
      let contextDocs = functionData.contextDocs || "";
      if (selectedDocs.length > 0) {
        const docContents = await Promise.all(
          selectedDocs.map((id) => invoke("getContextDocContent", { id })),
        );
        const docsText = docContents
          .filter((r) => r.success && r.doc)
          .map((r) => `### ${r.doc.title}\n${r.doc.content}`)
          .join("\n\n---\n\n");
        contextDocs = contextDocs ? `${contextDocs}\n\n${docsText}` : docsText;
      }

      // Build prior steps context so the AI knows what variables are available
      const priorVars = (priorSteps || [])
        .filter((s) => s.variableName)
        .map((s, i) => ({
          step: i + 1,
          name: s.name || `Step ${i + 1}`,
          variable: s.variableName,
          description: s.operationPrompt || "",
        }));

      const result = await invoke("generatePostFunctionCode", {
        prompt: functionData.operationPrompt,
        operationType: functionData.operationType || "work_item_query",
        endpoint: functionData.endpoint || "",
        method: functionData.method || "GET",
        includeBackoff: functionData.includeBackoff || false,
        contextDocs,
        priorSteps: priorVars,
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

      {/* Available variables from prior steps */}
      {priorSteps && priorSteps.filter((s) => s.variableName).length > 0 && (
        <div className="prior-vars-bar">
          <div className="prior-vars-header">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            <span className="prior-vars-label">Variables from previous steps</span>
          </div>
          <div className="prior-vars-list">
            {priorSteps.filter((s) => s.variableName).map((s, i) => (
              <div key={i} className="prior-var-item">
                <code className="prior-var-tag">{s.variableName}</code>
                <span className="prior-var-desc">
                  Step {i + 1}{s.name ? `: ${s.name}` : ""}{s.operationPrompt ? ` — ${s.operationPrompt.substring(0, 60)}` : ""}
                </span>
              </div>
            ))}
          </div>
          <p className="prior-vars-hint">
            Use these in your description or code. The AI knows about them and will reference them automatically.
          </p>
        </div>
      )}

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
          onChange={handlePromptChange}
          placeholder={'Example: "Find all issues in this project with the same summary and add a comment linking to them"'}
        />
      </div>

      {/* Operation type */}
      <div className="form-group">
        <label className="label">
          Operation Type
          {opSuggested && <span className="op-suggested-badge">auto-detected</span>}
          <Tooltip text="Auto-detected from your description. You can override it. This tells the AI code generator what APIs and patterns to use." />
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

      {/* Documentation library — shared reference docs for AI code generation */}
      <DocRepository
        selectedDocs={selectedDocs}
        onSelectionChange={(ids) => { setSelectedDocs(ids); onUpdate({ selectedDocIds: ids }); }}
      />

      {/* Inline context — for one-off notes not worth saving to the library */}
      <div className="form-group">
        <label className="label" style={{ fontSize: "11px" }}>
          Additional Context (optional)
          <Tooltip text="One-off notes for this specific step. For reusable documentation, add it to the library above instead." />
        </label>
        <textarea
          className="textarea context-textarea"
          rows={3}
          value={functionData.contextDocs || ""}
          onChange={(e) => update("contextDocs", e.target.value)}
          placeholder="Any extra context for this step (field IDs, specific requirements...)"
        />
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
              <Tooltip text="Retries failed API calls up to 3 times with increasing delays (1s, 2s, 4s) plus random jitter. Tradeoff: retries can add up to ~15 seconds of execution time. Forge post-functions have a 30-second hard limit — if you chain multiple steps with backoff enabled, later steps may time out. Best for: single-step functions, external APIs, or steps that must not fail silently. Skip for: multi-step chains where speed matters, or when the API is reliable." />
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
                  Test against issue
                  <Tooltip text="Search for a Jira issue to test your code with real data. api.getIssue() and api.searchJql() will return real results. Writes (updateIssue, transitionIssue) are always safe — they log what would happen but never change anything." />
                </label>
                <div className="test-target-row">
                  <IssuePicker
                    value={testTarget}
                    onChange={setTestTarget}
                  />
                  <button
                    className="btn-run-test"
                    onClick={async () => {
                      setTestRunning(true);
                      setTestResult(null);
                      try {
                        const target = testTarget.trim();
                        const isKey = /^[A-Z]+-\d+$/i.test(target);
                        const result = await invoke("testPostFunction", {
                          code: functionData.code,
                          issueKey: isKey ? target : undefined,
                          jql: target && !isKey ? target : undefined,
                        });
                        setTestResult(result);
                      } catch (e) {
                        setTestResult({ success: false, logs: ["Test error: " + e.message] });
                      }
                      setTestRunning(false);
                    }}
                    disabled={testRunning || !functionData.code?.trim()}
                  >
                    {testRunning ? "Running..." : "Run Test"}
                  </button>
                </div>
                <p className="hint" style={{ marginTop: "4px" }}>
                  {testTarget.trim()
                    ? "Reads use real Jira data. Writes are always safe (dry run)."
                    : "No issue selected — will use mock data. Search for an issue for real results."
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
