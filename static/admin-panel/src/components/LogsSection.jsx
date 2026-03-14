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
 * Displays validation logs in a scrollable list
 */
export const LogsSection = ({ 
  showLogs, 
  logs, 
  loading, 
  onClearLogs,
  clearingLogs,
  onRefreshLogs,
  formatTime
}) => {
  if (!showLogs) return null;

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-600 dark:text-gray-400">
        Loading logs...
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="p-12 text-center text-gray-600 dark:text-gray-400">
        No validation logs yet
      </div>
    );
  }

  return (
    <div className="max-h-[500px] overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
      {logs.map((log) => (
        <div key={log.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30">
          <div className="flex items-center gap-3 mb-2">
            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
              log.isValid 
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              {log.isValid ? "PASS" : "FAIL"}
            </span>
            <span className="font-medium text-blue-600 dark:text-blue-400">
              {log.issueKey}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {formatTime(log.timestamp)}
            </span>
          </div>
          <div className="ml-1 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mb-2">
            Field: 
            <code className="rounded bg-gray-100 dark:bg-gray-700 px-2 py-0.5 font-mono text-xs text-blue-600 dark:text-blue-400">
              {log.fieldId}
            </code>
          </div>
          <div className="ml-1 rounded bg-gray-100 dark:bg-gray-900/50 p-2 text-sm text-gray-700 dark:text-gray-300 font-mono break-all">
            {log.reason}
          </div>
        </div>
      ))}
    </div>
  );
};

export default LogsSection;