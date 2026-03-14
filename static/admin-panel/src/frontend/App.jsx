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
import { Spinner } from "../../../shared/components/common/Spinner";
import { Button } from "../../../shared/components/common/Button";
import { Card } from "../../../shared/components/common/Card";
import LicenseBanner from "../components/LicenseBanner";
import RuleTable from "../components/RuleTable";
import LogsSection from "../components/LogsSection";

/**
 * Admin Panel - Main application component
 * Displays configured rules and validation logs
 */
function App() {
  const [configs, setConfigs] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [licenseActive, setLicenseActive] = useState(null);

  // Clear logs state
  const [clearingLogs, setClearingLogs] = useState(false);

  // Toggle state
  const [togglingId, setTogglingId] = useState(null);
  const [toggleError, setToggleError] = useState(null);
  const [toggleWarning, setToggleWarning] = useState(null);

  // Removed count for cleanup alerts
  const [removedCount, setRemovedCount] = useState(0);
  const [refreshingConfigs, setRefreshingConfigs] = useState(false);

  // Store router and invoke references
  let invoke;
  let router;

  const fetchConfigs = async (showLoading = false) => {
    if (!invoke) return;
    if (showLoading) setRefreshingConfigs(true);
    try {
      const result = await invoke("getConfigs");
      if (result.success) {
        setConfigs(result.configs || []);
        if (result.removedCount > 0) {
          setRemovedCount(result.removedCount);
        }
      }
    } catch (e) {
      console.error("Failed to fetch configs:", e);
    }
    if (showLoading) setRefreshingConfigs(false);
  };

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

  const toggleRule = async (id, currentlyDisabled) => {
    if (!invoke) return;
    setTogglingId(id);
    setToggleError(null);
    setToggleWarning(null);
    try {
      const action = currentlyDisabled ? "enableRule" : "disableRule";
      const result = await invoke(action, { id });
      if (result.success) {
        setConfigs((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, disabled: result.disabled, updatedAt: new Date().toISOString() } : c
          )
        );
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
    setTogglingId(null);
  };

  const formatTime = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

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
        const bridge = await import("@forge/bridge");
        invoke = bridge.invoke;
        router = bridge.router;

        // Check license from context
        const context = await bridge.view.getContext();
        const ctxLicense = context?.license?.active;
        if (ctxLicense !== undefined) {
          setLicenseActive(ctxLicense);
        }

        try {
          const licenseResult = await invoke("checkLicense");
          if (licenseResult?.isActive !== undefined) {
            setLicenseActive(licenseResult.isActive);
          }
        } catch (e) {
          console.log("Could not check license:", e);
        }

        // Fetch initial data
        await fetchConfigs();
        setLoading(false);
      } catch (e) {
        console.log("Bridge not available:", e);
      }
    };
    init();

    // Cleanup function
    return () => {};
  }, []);

  // Handle clear removed count
  const handleClearRemovedCount = () => setRemovedCount(0);

  if (loading) {
    return <Spinner text="Loading admin panel..." fullPage />;
  }

  const renderAlerts = () => (
    <>
      {toggleError && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-500 bg-red-50 dark:bg-red-900/20 px-4 py-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div className="flex-1">
            <span className="text-sm font-medium text-red-700 dark:text-red-400">{toggleError}</span>
          </div>
          <button onClick={() => setToggleError(null)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            &times;
          </button>
        </div>
      )}

      {toggleWarning && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-orange-500 bg-orange-50 dark:bg-orange-900/20 px-4 py-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div className="flex-1">
            <span className="text-sm font-medium text-orange-700 dark:text-orange-400">{toggleWarning}</span>
          </div>
          <button onClick={() => setToggleWarning(null)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            &times;
          </button>
        </div>
      )}

      {removedCount > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-orange-500 bg-orange-50 dark:bg-orange-900/20 px-4 py-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
          <div className="flex-1">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Cleaned up {removedCount} orphaned rule{removedCount > 1 ? "s" : ""} no longer present in any workflow.
            </span>
          </div>
          <button onClick={handleClearRemovedCount} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            &times;
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className="container mx-auto max-w-6xl p-6">
      {/* Header */}
      <div className="mb-8 flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-sm">
          <svg width="24" height="24" viewBox="0 0 128 128" fill="none">
            <defs>
              <linearGradient id="adminBg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0065FF"/>
                <stop offset="100%" stopColor="#4C9AFF"/>
              </linearGradient>
            </defs>
            <rect x="4" y="4" width="120" height="120" rx="24" ry="24" fill="url(#adminBg)"/>
            <path d="M44 42C44 34 52 28 58 28C62 28 64 30 64 34L64 64" stroke="white" strokeWidth="5" strokeLinecap="round"/>
            <path d="M38 52C32 52 28 58 28 64C28 72 34 78 42 78L64 78" stroke="white" strokeWidth="5" strokeLinecap="round"/>
            <path d="M48 36C48 36 42 42 42 50" stroke="white" strokeWidth="4" strokeLinecap="round"/>
            <path d="M84 42C84 34 76 28 70 28C66 28 64 30 64 34" stroke="white" strokeWidth="5" strokeLinecap="round"/>
            <path d="M90 52C96 52 100 58 100 64C100 72 94 78 86 78L64 78" stroke="white" strokeWidth="5" strokeLinecap="round"/>
            <path d="M80 36C80 36 86 42 86 50" stroke="white" strokeWidth="4" strokeLinecap="round"/>
            <circle cx="44" cy="50" r="3.5" fill="white" opacity="0.9"/>
            <circle cx="84" cy="50" r="3.5" fill="white" opacity="0.9"/>
            <circle cx="64" cy="34" r="3.5" fill="white" opacity="0.9"/>
            <circle cx="42" cy="78" r="3.5" fill="white" opacity="0.9"/>
            <circle cx="86" cy="78" r="3.5" fill="white" opacity="0.9"/>
            <circle cx="64" cy="58" r="10" stroke="white" strokeWidth="4" fill="none"/>
            <circle cx="64" cy="58" r="4" fill="white"/>
            <path d="M56 92L72 92L72 86L88 96L72 106L72 100L56 100Z" fill="white" opacity="0.95"/>
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">CogniRunner Admin</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Overview of all AI validators and conditions configured across your workflows
          </p>
        </div>
      </div>

      {/* License Banner */}
      <LicenseBanner licenseActive={licenseActive} />

      {/* Alerts */}
      {renderAlerts()}

      {/* Configured Rules Section */}
      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Configured Rules</h3>
          <Button 
            variant="outline" 
            size="small"
            onClick={() => fetchConfigs(true)}
            disabled={refreshingConfigs}
          >
            {refreshingConfigs ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
        <Card className="shadow-sm">
          <RuleTable
            configs={configs}
            onToggleRule={toggleRule}
            togglingId={togglingId}
            toggleError={toggleError}
            toggleWarning={toggleWarning}
            removedCount={removedCount}
            onClearRemovedCount={handleClearRemovedCount}
            refreshConfigs={fetchConfigs}
            refreshingConfigs={refreshingConfigs}
            router={router}
          />
        </Card>
      </section>

      {/* Validation Logs Section */}
      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Validation Logs</h3>
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
              <Button
                variant="danger"
                size="small"
                onClick={clearLogs}
                disabled={clearingLogs}
              >
                {clearingLogs ? "Clearing..." : "Clear All"}
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
      </section>
    </div>
  );
}

export default App;