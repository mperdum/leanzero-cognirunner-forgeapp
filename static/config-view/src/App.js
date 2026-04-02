/*
 * CogniRunner - AI-powered workflow validation for Jira
 * Copyright (C) 2025 LeanZero
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import React, { useState, useEffect } from "react";

// Inject styles directly
const injectStyles = () => {
  if (document.getElementById("app-styles")) return;

  const style = document.createElement("style");
  style.id = "app-styles";
  style.textContent = `
    :root {
      --bg-color: transparent;
      --text-color: #172B4D;
      --text-secondary: #5E6C84;
      --text-muted: #7A869A;
      --primary-color: #0052CC;
      --code-bg: #F4F5F7;
      --success-color: #006644;
      --error-color: #DE350B;
      --border-color: #DFE1E6;
      --card-bg: #FFFFFF;
    }

    html[data-color-mode="dark"] {
      --bg-color: transparent;
      --text-color: #B6C2CF;
      --text-secondary: #9FADBC;
      --text-muted: #8C9BAB;
      --primary-color: #579DFF;
      --code-bg: #1D2125;
      --success-color: #4BCE97;
      --error-color: #F87168;
      --border-color: #454F59;
      --card-bg: #22272B;
    }

    *, *::before, *::after { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: var(--bg-color);
      color: var(--text-color);
      font-size: 13px;
      line-height: 1.4;
    }

    .container { padding: 8px 12px; }

    .empty {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text-muted);
    }

    .config-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 6px;
    }

    .config-item:last-child { margin-bottom: 0; }

    .label {
      font-weight: 600;
      font-size: 12px;
      flex-shrink: 0;
      min-width: 50px;
      color: var(--text-secondary);
    }

    .value {
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 12px;
      font-family: SFMono-Regular, Consolas, monospace;
      background-color: var(--code-bg);
      color: var(--primary-color);
    }

    .prompt-value {
      font-size: 12px;
      word-break: break-word;
      color: var(--text-color);
    }

    .loading-text {
      font-size: 12px;
      color: var(--text-muted);
    }

    .logs-section {
      margin-top: 16px;
      border-top: 1px solid var(--border-color);
      padding-top: 12px;
    }

    .logs-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .logs-title {
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-secondary);
    }

    .logs-actions {
      display: flex;
      gap: 8px;
    }

    .btn-small {
      padding: 4px 8px;
      font-size: 11px;
      border: 1px solid var(--border-color);
      border-radius: 3px;
      background: var(--card-bg);
      color: var(--text-color);
      cursor: pointer;
    }

    .btn-small:hover:not(:disabled) {
      background: var(--code-bg);
    }
    .btn-small:disabled { opacity: 0.6; cursor: default; }

    .logs-list {
      max-height: 300px;
      overflow-y: auto;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background: var(--card-bg);
    }

    .log-entry {
      padding: 8px 10px;
      border-bottom: 1px solid var(--border-color);
      font-size: 11px;
    }

    .log-entry:last-child {
      border-bottom: none;
    }

    .log-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }

    .log-status {
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .log-status.valid {
      background: rgba(0, 102, 68, 0.1);
      color: var(--success-color);
    }

    .log-status.invalid {
      background: rgba(222, 53, 11, 0.1);
      color: var(--error-color);
    }

    .log-time {
      color: var(--text-muted);
      font-size: 10px;
    }

    .log-issue {
      font-weight: 600;
      color: var(--primary-color);
    }

    .log-details {
      color: var(--text-secondary);
      margin-top: 4px;
    }

    .log-reason {
      margin-top: 4px;
      padding: 4px 8px;
      background: var(--code-bg);
      border-radius: 3px;
      color: var(--text-color);
    }

    .log-tools {
      margin-top: 4px;
      font-size: 10px;
      color: var(--text-muted);
    }

    .log-tools-badge {
      display: inline-block;
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: 600;
      background: rgba(0, 82, 204, 0.1);
      color: var(--primary-color);
      margin-right: 6px;
    }

    html[data-color-mode="dark"] .log-tools-badge {
      background: rgba(87, 157, 255, 0.15);
    }

    .log-queries {
      margin-top: 3px;
      padding: 3px 6px;
      background: var(--code-bg);
      border-radius: 3px;
      font-family: SFMono-Regular, Consolas, monospace;
      font-size: 10px;
      word-break: break-all;
      color: var(--text-secondary);
    }

    .no-logs {
      padding: 16px;
      text-align: center;
      color: var(--text-muted);
      font-size: 12px;
    }

    .license-banner {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 10px;
      border-radius: 4px;
      font-size: 11px;
      margin-bottom: 10px;
      border: 1px solid;
    }

    .license-active {
      background: rgba(0, 102, 68, 0.1);
      border-color: var(--success-color);
      color: var(--success-color);
    }

    .license-inactive {
      background: rgba(222, 53, 11, 0.1);
      border-color: var(--error-color);
      color: var(--error-color);
    }

    .rule-status-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 4px;
      font-size: 11px;
      margin-bottom: 10px;
      border: 1px solid;
    }

    .status-disabled-banner {
      border-color: var(--error-color);
      background: rgba(222, 53, 11, 0.08);
      color: var(--error-color);
    }

    .status-active-banner {
      border-color: var(--success-color);
      background: rgba(0, 102, 68, 0.08);
      color: var(--success-color);
    }

    .rule-status-content {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .btn-enable {
      color: var(--success-color);
      border-color: var(--success-color);
      flex-shrink: 0;
    }

    .btn-enable:hover {
      background: rgba(0, 102, 68, 0.1);
    }

    .btn-danger {
      color: var(--error-color);
      border-color: var(--error-color);
      flex-shrink: 0;
    }

    .btn-danger:hover {
      background: rgba(222, 53, 11, 0.1);
    }

    .alert {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      padding: 8px 10px;
      border-radius: 4px;
      font-size: 11px;
      margin-bottom: 10px;
      border: 1px solid;
    }

    .alert-error {
      background: rgba(222, 53, 11, 0.08);
      border-color: var(--error-color);
      color: var(--error-color);
    }

    .alert-warning {
      background: rgba(255, 153, 31, 0.08);
      border-color: #FF991F;
      color: #FF991F;
    }

    .alert-success {
      background: rgba(0, 102, 68, 0.08);
      border-color: var(--success-color);
      color: var(--success-color);
    }

    html[data-color-mode="dark"] .alert-warning {
      color: #F5CD47;
      border-color: #F5CD47;
    }

    html[data-color-mode="dark"] .alert-success {
      color: var(--success-color);
      border-color: var(--success-color);
    }

    .alert-dismiss {
      margin-left: auto;
      background: none;
      border: none;
      color: inherit;
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      padding: 0 2px;
      opacity: 0.7;
    }

    .alert-dismiss:hover { opacity: 1; }

    /* Post Function Type Badges */
    .post-function-badge {
      display: inline-block;
      padding: 1px 5px;
      font-size: 9px;
      border-radius: 3px;
      font-weight: 600;
    }

    .post-function-semantic {
      background: rgba(0, 102, 68, 0.1);
      color: #006644;
    }

    .post-function-static {
      background: rgba(255, 153, 31, 0.1);
      color: #FF991F;
    }
  `;
  document.head.appendChild(style);
};

let invoke;

function App() {
  const [config, setConfig] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [licenseActive, setLicenseActive] = useState(null);
  const [ruleDisabled, setRuleDisabled] = useState(null);
  const [ruleId, setRuleId] = useState(null);
  const [workflowContext, setWorkflowContext] = useState(null);
  const [toggling, setToggling] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);

  const fetchLogs = async () => {
    if (!invoke) return;
    setLogsLoading(true);
    try {
      const result = await invoke("getLogs");
      if (result.success) {
        setLogs(result.logs || []);
      }
    } catch (e) {
      console.error("Failed to fetch logs:", e);
    }
    setLogsLoading(false);
  };

  const clearLogs = async () => {
    if (!invoke) return;
    setClearingLogs(true);
    try {
      await invoke("clearLogs");
      setLogs([]);
      setSuccessMessage("Logs cleared successfully");
    } catch (e) {
      console.error("Failed to clear logs:", e);
    }
    setClearingLogs(false);
  };

  const [toggleError, setToggleError] = useState(null);
  const [toggleWarning, setToggleWarning] = useState(null);
  
  // Success toast for enable/disable operations
  const [successMessage, setSuccessMessage] = useState("");
  
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(""), 2500);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleToggleRule = async () => {
    if (!invoke || !ruleId) return;
    
    // Optimistic update
    setRuleDisabled(!ruleDisabled);
    
    setToggling(true);
    setToggleError(null);
    setToggleWarning(null);
    try {
      const action = ruleDisabled ? "enableRule" : "disableRule";
      const result = await invoke(action, { id: ruleId });
      if (result.success) {
        // Update with server response
        setRuleDisabled(result.disabled);
        if (result.warning) {
          setToggleWarning(result.warning);
        }
      } else {
        // Rollback on error
        setRuleDisabled(ruleDisabled);
        setToggleError(result.error || "Failed to update rule. Please try again.");
      }
    } catch (e) {
      console.error("Failed to toggle rule:", e);
      // Rollback on error
      setRuleDisabled(ruleDisabled);
      setToggleError("Failed to communicate with the server. Please try again.");
    }
    setToggling(false);
    
    // Show success message after successful toggle
    if (!toggleError && !toggleWarning) {
      const actionName = ruleDisabled ? "enabled" : "disabled";
      setSuccessMessage(`Rule ${actionName} successfully`);
    }
  };

  const formatTime = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return timestamp;
    }
  };

  useEffect(() => {
    injectStyles();

    const init = async () => {
      try {
        const bridge = await import("@forge/bridge");
        invoke = bridge.invoke;

        // Enable theming for dark mode support
        if (bridge.view && bridge.view.theme && bridge.view.theme.enable) {
          await bridge.view.theme.enable();
        }

        const context = await bridge.view.getContext();
        console.log("config-view context:", JSON.stringify(context, null, 2));

        // Try multiple possible locations for the config
        const possibleConfig =
          context?.extension?.validatorConfig ||
          context?.extension?.conditionConfig ||
          context?.extension?.postFunctionConfig ||
          context?.extension?.configuration ||
          context?.extension?.config;

        if (possibleConfig) {
          // Config is stored as JSON string, parse it
          if (typeof possibleConfig === "string") {
            try {
              setConfig(JSON.parse(possibleConfig));
            } catch {
              // Fallback if not valid JSON
            }
          } else {
            setConfig(possibleConfig);
          }
        }

        // Derive rule ID and workflow context (same pattern as config-ui)
        const ext = context?.extension || {};
        const derivedRuleId = ext.entryPoint || ext.key || null;
        if (derivedRuleId) {
          setRuleId(derivedRuleId);
        }

        // Capture workflow context for API lookups
        const wfCtx = {};
        if (ext.workflowId) wfCtx.workflowId = ext.workflowId;
        if (ext.workflowName) wfCtx.workflowName = ext.workflowName;
        if (ext.scopedProjectId) wfCtx.projectId = ext.scopedProjectId;
        if (ext.transitionContext) {
          wfCtx.transitionId = ext.transitionContext.id;
          wfCtx.transitionFromName = ext.transitionContext.from?.name;
          wfCtx.transitionToName = ext.transitionContext.to?.name;
        }
        if (context?.siteUrl) wfCtx.siteUrl = context.siteUrl;
        if (Object.keys(wfCtx).length > 0) {
          setWorkflowContext(wfCtx);
        }

        // Check license status from context
        const licenseStatus = context?.license?.active;
        if (licenseStatus !== undefined) {
          setLicenseActive(licenseStatus);
        }
      } catch (e) {
        console.log("Could not load config:", e);
      }

      // Also check license via resolver (more reliable for paid apps)
      try {
        const licenseResult = await invoke("checkLicense");
        if (licenseResult?.isActive !== undefined) {
          setLicenseActive(licenseResult.isActive);
        }
      } catch (e) {
        console.log("Could not check license:", e);
      }

      setLoading(false);
    };
    init();
  }, []);

  // Check rule disabled status using all available identifiers
  useEffect(() => {
    if (!invoke) return;
    // Need at least one identifier to look up
    if (!ruleId && !config?.fieldId) return;
    const checkStatus = async () => {
      try {
        const result = await invoke("getRuleStatus", {
          id: ruleId,
          fieldId: config?.fieldId,
          prompt: config?.prompt,
          workflow: workflowContext,
        });
        if (result.found) {
          setRuleDisabled(result.disabled);
          // Always use the registryId from KVS — ext.entryPoint gives "view" which
          // doesn't match the actual KVS config id (registered by config-ui)
          if (result.registryId) {
            setRuleId(result.registryId);
          }
        }
      } catch (e) {
        console.log("Could not check rule status:", e);
      }
    };
    checkStatus();
  }, [ruleId, config, workflowContext]);

  if (loading) {
    return (
      <div className="container">
        <span className="loading-text">Loading...</span>
      </div>
    );
  }

  const statusBanner = ruleDisabled === true ? (
    <div className="rule-status-banner status-disabled-banner">
      <div className="rule-status-content">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
        </svg>
        <span>This rule is <strong>disabled</strong>. It will not run on transitions.</span>
      </div>
      <button
        className="btn-small btn-enable"
        onClick={handleToggleRule}
        disabled={toggling}
      >
        {toggling ? "Enabling..." : "Enable"}
      </button>
    </div>
  ) : ruleDisabled === false ? (
    <div className="rule-status-banner status-active-banner">
      <div className="rule-status-content">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        <span>This rule is <strong>active</strong>.</span>
      </div>
      <button
        className="btn-small btn-danger"
        onClick={handleToggleRule}
        disabled={toggling}
      >
        {toggling ? "Disabling..." : "Disable"}
      </button>
    </div>
  ) : null;

  const licenseBanner = licenseActive === false ? (
    <div className="license-banner license-inactive">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>License inactive — AI validation is disabled. Transitions will pass through without checks.</span>
    </div>
  ) : licenseActive === true ? (
    <div className="license-banner license-active">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 6L9 17l-5-5" />
      </svg>
      <span>License active</span>
    </div>
  ) : null;

  const toggleAlerts = (
    <>
      {toggleError && (
        <div className="alert alert-error">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{toggleError}</span>
          <button className="alert-dismiss" onClick={() => setToggleError(null)}>&times;</button>
        </div>
      )}
      {toggleWarning && (
        <div className="alert alert-warning">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>{toggleWarning}</span>
          <button className="alert-dismiss" onClick={() => setToggleWarning(null)}>&times;</button>
        </div>
      )}
    </>
  );

  // Post Function Type Badges
  const postFunctionBadge = () => {
    // Check both the saved type ("semantic"/"static") and internal name ("postfunction-semantic")
    if (config.type === "semantic" || config.type?.startsWith("postfunction")) {
      return (
        <span className="post-function-badge post-function-semantic">
          Semantic Post Function
        </span>
      );
    }
    if (config.type === "static") {
      return (
        <span className="post-function-badge post-function-static">
          Static Post Function
        </span>
      );
    }
    return null;
  };

  // Render Post Function specific fields
  const renderPostFunctionFields = () => {
    if (!config.type?.startsWith("postfunction") && !["semantic", "static"].includes(config.type)) {
      return null;
    }

    // Semantic Post Function Fields
    if (config.type === "semantic" || config.type?.startsWith("postfunction")) {
      return (
        <>
          <div className="config-item">
            <span className="label">Condition:</span>
            <span className="prompt-value" style={{ wordBreak: "break-word", fontSize: "11px" }}>
              {config.conditionPrompt?.length > 80
                ? config.conditionPrompt.substring(0, 80) + "..."
                : (config.conditionPrompt || "(none)")}
            </span>
          </div>
          <div className="config-item">
            <span className="label">Action:</span>
            <span className="prompt-value" style={{ wordBreak: "break-word", fontSize: "11px" }}>
              {config.actionPrompt?.length > 80
                ? config.actionPrompt.substring(0, 80) + "..."
                : (config.actionPrompt || "(none)")}
            </span>
          </div>
          <div className="config-item">
            <span className="label">Action Field:</span>
            <code className="value">{config.actionFieldId || config.fieldId}</code>
          </div>
        </>
      );
    }

    // Static Post Function Fields
    if (config.type === "static") {
      return (
        <>
          <div className="config-item">
            <span className="label">Code:</span>
            <span className="prompt-value" style={{ wordBreak: "break-word", fontSize: "10px", fontFamily: "SFMono-Regular, Consolas, monospace" }}>
              {config.code?.length > 80
                ? config.code.substring(0, 80) + "..."
                : (config.code || "(none)")}
            </span>
          </div>
        </>
      );
    }

    return null;
  };

  // Render standard Validator/Condition fields
  const renderStandardFields = () => {
    if (config.type?.startsWith("postfunction")) {
      return null;
    }

    return (
      <>
        <div className="config-item">
          <span className="label">Prompt:</span>
          <span className="prompt-value">
            {config.prompt.length > 100
              ? config.prompt.substring(0, 100) + "..."
              : config.prompt}
          </span>
        </div>
        {config.enableTools === true && (
          <div className="config-item">
            <span className="label">Tools:</span>
            <span className="prompt-value">JQL Search (always enabled)</span>
          </div>
        )}
        {config.enableTools === false && (
          <div className="config-item">
            <span className="label">Tools:</span>
            <span className="prompt-value">Disabled</span>
          </div>
        )}
      </>
    );
  };

  // Render log entry with post function support
  const renderLogEntry = (log) => {
    return (
      <div key={log.id} className="log-entry">
        <div className="log-header">
          <span className={`log-status ${log.isValid ? "valid" : "invalid"}`}>
            {log.isValid ? "PASS" : "FAIL"}
          </span>
          <span className="log-issue">{log.issueKey}</span>
          <span className="log-time">{formatTime(log.timestamp)}</span>
        </div>
        <div className="log-details">
          Field: <code>{log.fieldId || "(post-function)"}</code>
          {log.postFunctionType && (
            <span
              style={{
                marginLeft: "8px",
                padding: "1px 5px",
                fontSize: "9px",
                background:
                  log.postFunctionType === "Semantic Post Function"
                    ? "rgba(0,102,68,0.1)"
                    : "rgba(255,153,31,0.1)",
                color:
                  log.postFunctionType === "Semantic Post Function"
                    ? "#006644"
                    : "#FF991F",
                borderRadius: "3px",
              }}
            >
              {log.postFunctionType}
            </span>
          )}
        </div>
        <div className="log-reason">{log.reason}</div>
        {log.toolMeta?.toolsUsed && (
          <div className="log-tools">
            <span className="log-tools-badge">JQL</span>
            {log.toolMeta.toolRounds} round{log.toolMeta.toolRounds !== 1 ? "s" : ""},{" "}
            {log.toolMeta.totalResults} result{log.toolMeta.totalResults !== 1 ? "s" : ""}
            {log.toolMeta.queries?.length > 0 && (
              <div className="log-queries">
                {log.toolMeta.queries.map((q, i) => <div key={i}>{q}</div>)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render config view
  if (!config || (!config.fieldId && !config.prompt && !config.type)) {
    return (
      <div className="container">
        {licenseBanner}
        {statusBanner}
        {toggleAlerts}
        <div className="empty">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>No configuration set</span>
        </div>

        {/* Still show logs section even without config */}
        <div className="logs-section">
          <div className="logs-header">
            <span className="logs-title">Validation Logs</span>
            <div className="logs-actions">
              <button
                className="btn-small"
                onClick={() => {
                  setShowLogs(!showLogs);
                  if (!showLogs) fetchLogs();
                }}
              >
                {showLogs ? "Hide Logs" : "Show Logs"}
              </button>
              {showLogs && logs.length > 0 && (
                <button className="btn-small" onClick={clearLogs} disabled={clearingLogs}>
                  {clearingLogs ? "Clearing..." : "Clear"}
                </button>
              )}
              {showLogs && (
                <button className="btn-small" onClick={fetchLogs} disabled={logsLoading}>
                  {logsLoading ? "Refreshing..." : "Refresh"}
                </button>
              )}
            </div>
          </div>

          {showLogs && (
            <div className="logs-list">
              {logsLoading ? (
                <div className="no-logs">Loading logs...</div>
              ) : logs.length === 0 ? (
                <div className="no-logs">No validation logs yet</div>
              ) : (
                logs.map(renderLogEntry)
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {licenseBanner}
      {statusBanner}
      {successMessage && (
        <div className="alert alert-success">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <span>{successMessage}</span>
        </div>
      )}

      {toggleAlerts}

      {/* Post Function Type Indicator */}
      {postFunctionBadge()}

      <div className="config-item">
        <span className="label">Field:</span>
        <code className="value">{config.fieldId}</code>
      </div>

      {/* Render either Post Function fields or Standard fields */}
      {renderPostFunctionFields()}
      {renderStandardFields()}

      {/* Logs section */}
      <div className="logs-section">
        <div className="logs-header">
          <span className="logs-title">Validation Logs</span>
          <div className="logs-actions">
            <button
              className="btn-small"
              onClick={() => {
                setShowLogs(!showLogs);
                if (!showLogs) fetchLogs();
              }}
            >
              {showLogs ? "Hide Logs" : "Show Logs"}
            </button>
            {showLogs && logs.length > 0 && (
              <button className="btn-small" onClick={clearLogs}>
                Clear
              </button>
            )}
            {showLogs && (
              <button className="btn-small" onClick={fetchLogs}>
                Refresh
              </button>
            )}
          </div>
        </div>

        {showLogs && (
          <div className="logs-list">
            {logsLoading ? (
              <div className="no-logs">Loading logs...</div>
            ) : logs.length === 0 ? (
              <div className="no-logs">No validation logs yet</div>
            ) : (
              logs.map(renderLogEntry)
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;