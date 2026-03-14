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
    <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-900/50">
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
            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
              Updated
            </th>
            <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
          {configs.map((config) => {
            const wf = config.workflow || {};
            const hasWorkflow = wf.workflowName || wf.workflowId;
            const editUrl = wf.workflowId && wf.siteUrl
              ? `${wf.siteUrl}/jira/settings/issues/workflows/${wf.workflowId}`
              : null;
            const isDisabled = config.disabled === true;

            return (
              <tr key={config.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    config.type === 'validator' 
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  }`}>
                    {config.type}
                  </span>
                  {isDisabled && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                      Disabled
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 max-w-md sm:max-w-lg">
                  {hasWorkflow ? (
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{wf.workflowName || wf.workflowId}</div>
                      {(wf.transitionFromName || wf.transitionToName) && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {wf.transitionFromName || "Any"} → {wf.transitionToName || "Any"}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                      Re-save rule to capture workflow info
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <code className="block rounded bg-gray-100 dark:bg-gray-700 px-2 py-1 text-xs font-mono text-blue-600 dark:text-blue-400">
                    {config.fieldId}
                  </code>
                </td>
                <td className="px-4 py-3 max-w-xs">
                  <span className="text-sm text-gray-700 dark:text-gray-300 break-all">
                    {config.prompt && config.prompt.length > 80
                      ? config.prompt.substring(0, 80) + "..."
                      : config.prompt}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {formatTime(config.updatedAt)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-2">
                    {editUrl && onEditWorkflow && (
                      <button
                        onClick={() => router && router.open(editUrl)}
                        title="Open workflow editor"
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Edit
                      </button>
                    )}
                    <button
                      onClick={() => onToggleRule && onToggleRule(config.id, isDisabled)}
                      disabled={togglingId === config.id}
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        isDisabled
                          ? 'text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20'
                          : 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
                      } disabled:opacity-60 disabled:cursor-not-allowed`}
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