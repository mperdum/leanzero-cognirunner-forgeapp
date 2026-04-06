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

import React from "react";

/**
 * Displays configured rules in a table format
 */
export const RuleTable = ({ 
  configs, 
  onToggleRule, 
  togglingId,
  toggleError,
  toggleWarning,
  removedCount,
  onClearRemovedCount,
  refreshConfigs,
  refreshingConfigs,
  onEditWorkflow,
  router
}) => {
  const formatTime = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  if (!configs || configs.length === 0) {
    return (
      <div className="p-12 text-center text-gray-600 dark:text-gray-400 text-sm">
        No validators or conditions configured yet. Add one from a workflow transition.
      </div>
    );
  }

  return (
    <div className="container" style={{ border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
      <table className="min-w-full" style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead style={{ backgroundColor: 'var(--hover-bg)' }}>
          <tr>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
              Type
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
              Workflow / Transition
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
              Field
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
              Prompt
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray00">
              Updated
            </th>
            <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
              Actions
            </th>
          </tr>
        </thead>
        <tbody style={{ backgroundColor: 'var(--card-bg)' }}>
          {configs.map((config) => {
            const wf = config.workflow || {};
            const hasWorkflow = wf.workflowName || wf.workflowId;
            const editUrl = wf.workflowId && wf.siteUrl
              ? `${wf.siteUrl}/jira/settings/issues/workflows/${wf.workflowId}`
              : null;
            const isDisabled = config.disabled === true;

            return (
              <tr key={config.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="status-badge" style={{ 
                    backgroundColor: config.type === 'validator' ? 'var(--primary-color)' : 'var(--success-color)',
                    color: 'white',
                    fontSize: '10px'
                  }}>
                    {config.type}
                  </span>
                  {isDisabled && (
                    <span className="status-badge" style={{ 
                      marginLeft: '8px',
                      backgroundColor: 'var(--error-color)',
                      color: 'white',
                      fontSize: '10px'
                    }}>
                      Disabled
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 max-w-md sm:max-w-lg">
                  {hasWorkflow ? (
                    <div>
                      <div className="font-medium" style={{ color: 'var(--text-color)' }}>{wf.workflowName || wf.workflowId}</div>
                      {(wf.transitionFromName || wf.transitionToName) && (
                        <div className="transition-info">
                          {wf.transitionFromName || "Any"} → {wf.transitionToName || "Any"}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="no-workflow-info">
                      Re-save rule to capture workflow info
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <code className="value" style={{ fontSize: '12px', color: 'var(--primary-color)' }}>
                    {config.fieldId}
                  </code>
                </td>
                <td className="px-4 py-3 max-w-xs">
                  <span className="text-sm" style={{ color: 'var(--text-color)' }}>
                    {config.prompt && config.prompt.length > 80
                      ? config.prompt.substring(0, 80) + "..."
                      : config.prompt}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm" style={{ color: 'var(--text-muted)' }}>
                  {formatTime(config.updatedAt)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                  <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                    {editUrl && onEditWorkflow && (
                      <button
                        onClick={() => router && router.open(editUrl)}
                        title="Open workflow editor"
                        className="btn-edit"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        Edit
                      </button>
                    )}
                    <button
                      onClick={() => onToggleRule && onToggleRule(config.id, isDisabled)}
                      disabled={togglingId === config.id}
                      className={isDisabled ? "btn-enable" : "btn-danger"}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      {togglingId === config.id
                        ? (isDisabled ? "Enabling..." : "Disabling...")
                        : (isDisabled ? "Enable" : "Disable")}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default RuleTable;