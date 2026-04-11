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
import { Button } from "../../../shared/components/common/Button";
import { Spinner } from "../../../shared/components/common/Spinner";
import { Card } from "../../../shared/components/common/Card";
import LicenseBanner from "../../../shared/components/common/LicenseBanner";
import StatusBanner from "../components/StatusBanner";
import ConfigViewer from "../components/ConfigViewer";
import LogsSection from "../components/LogsSection";

/**
 * Config View - Displays configuration details and validation logs
 */
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

  // Toggle alert state
  const [toggleError, setToggleError] = useState(null);
  const [toggleWarning, setToggleWarning] = useState(null);

  let invoke;

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
    } catch (e) {
      console.error("Failed to clear logs:", e);
    }
    setClearingLogs(false);
  };

  const handleToggleRule = async () => {
    if (!invoke || !ruleId) return;
    setToggling(true);
    setToggleError(null);
    setToggleWarning(null);
    try {
      const action = ruleDisabled ? "enableRule" : "disableRule";
      const result = await invoke(action, { id: ruleId });
      if (result.success) {
        setRuleDisabled(result.disabled);
        if (result.warning) {
          setToggleWarning(result.warning);
        }
      } else {
        setToggleError(result.error || "Failed to update rule. Please try again.");
      }
    } catch (e) {
      console.error("Failed to toggle rule:", e);
      setToggleError("Failed to communicate with the server. Please try again.");
    }
    setToggling(false);
  };

  const formatTime = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return timestamp;
    }
  };

  // Check rule disabled status
  useEffect(() => {
    const checkStatus = async () => {
      if (!invoke) return;
      if (!ruleId && !config?.fieldId) return;
      try {
        const result = await invoke("getRuleStatus", {
          id: ruleId,
          fieldId: config?.fieldId,
          prompt: config?.prompt,
          workflow: workflowContext,
        });
        if (result.found) {
          setRuleDisabled(result.disabled);
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

  useEffect(() => {
    // Enable dark mode
    const initTheme = async () => {
      try {
        const { view } = await import("@forge/bridge");
        if (view && view.theme && view.theme.enable) {
          await view.theme.enable();
        }
      } catch (e) {
        console.log("Could not enable theme:", e);
      }
    };
    initTheme();

    // Initialize bridge and fetch data
    const init = async () => {
      try {
        invoke = await import("@forge/bridge").then(bridge => bridge.invoke);

        const context = await import("@forge/bridge").then(bridge => bridge.view.getContext());
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

        // Derive rule ID and workflow context
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

      // Check license via resolver (more reliable for paid apps)
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

  // Render alerts
  const renderAlerts = () => (
    <>
      {toggleError && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500 bg-red-50 px-3 py-2 dark:bg-red-900/20">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="text-sm font-medium text-red-700 dark:text-red-400">{toggleError}</span>
          <button onClick={() => setToggleError(null)} className="ml-auto text-gray-500 hover:text-gray-700">
            &times;
          </button>
        </div>
      )}
      {toggleWarning && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-orange-500 bg-orange-50 px-3 py-2 dark:bg-orange-900/20">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="text-sm font-medium text-orange-700 dark:text-orange-400">{toggleWarning}</span>
          <button onClick={() => setToggleWarning(null)} className="ml-auto text-gray-500 hover:text-gray-700">
            &times;
          </button>
        </div>
      )}
    </>
  );

  if (loading) {
    return <Spinner text="Loading..." fullPage />;
  }

  // Check if config is empty
  const isEmptyConfig = !config || (!config.fieldId && !config.prompt && !config.type);

  // Render status banner and license banner content for use in JSX
  const statusBanner = ruleDisabled !== null && (
    <StatusBanner 
      isDisabled={ruleDisabled} 
      onToggle={handleToggleRule} 
      toggling={toggling}
      toggleError={toggleError}
      toggleWarning={toggleWarning}
      setToggleError={setToggleError}
      setToggleWarning={setToggleWarning}
    />
  );

  const licenseBanner = (
    <LicenseBanner licenseActive={licenseActive} />
  );

  if (isEmptyConfig) {
    return (
      <div className="p-4">
        {statusBanner}
        {licenseBanner}
        {renderAlerts()}
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>No configuration set</span>
        </div>

        {/* Logs section even without config */}
        <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Validation Logs</h4>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="small"
                onClick={() => {
                  setShowLogs(!showLogs);
                  if (!showLogs) fetchLogs();
                }}
              >
                {showLogs ? "Hide Logs" : "Show Logs"}
              </Button>
              {showLogs && logs.length > 0 && (
                <Button variant="secondary" size="small" onClick={clearLogs} disabled={clearingLogs}>
                  {clearingLogs ? "Clearing..." : "Clear"}
                </Button>
              )}
              {showLogs && (
                <Button
                  variant="outline"
                  size="small"
                  onClick={fetchLogs}
                  disabled={logsLoading}
                >
                  {logsLoading ? "Refreshing..." : "Refresh"}
                </Button>
              )}
            </div>
          </div>

          {showLogs && (
            <Card className="shadow-sm">
              <LogsSection
                showLogs={showLogs}
                logs={logs}
                loading={logsLoading}
                onClearLogs={clearLogs}
                clearingLogs={clearingLogs}
                onRefreshLogs={fetchLogs}
                formatTime={formatTime}
              />
            </Card>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {licenseBanner}
      {statusBanner}
      {renderAlerts()}

      {/* Config Viewer */}
      <ConfigViewer config={config} />

      {/* Logs section */}
      <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-700">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Validation Logs</h4>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="small"
              onClick={() => {
                setShowLogs(!showLogs);
                if (!showLogs) fetchLogs();
              }}
            >
              {showLogs ? "Hide Logs" : "Show Logs"}
            </Button>
            {showLogs && logs.length > 0 && (
              <Button variant="secondary" size="small" onClick={clearLogs}>
                Clear
              </Button>
            )}
            {showLogs && (
              <Button variant="outline" size="small" onClick={fetchLogs}>
                Refresh
              </Button>
            )}
          </div>
        </div>

        {showLogs && (
          <Card className="shadow-sm">
            <LogsSection
              showLogs={showLogs}
              logs={logs}
              loading={logsLoading}
              onClearLogs={clearLogs}
              clearingLogs={clearingLogs}
              onRefreshLogs={fetchLogs}
              formatTime={formatTime}
            />
          </Card>
        )}
      </div>
    </div>
  );
}

export default App;