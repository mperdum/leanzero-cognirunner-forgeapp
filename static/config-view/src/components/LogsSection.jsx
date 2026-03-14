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
import { Button } from "../../../shared/components/common/Button";

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
      <div className="py-8 text-center text-gray-600 dark:text-gray-400">
        Loading logs...
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="py-8 text-center text-gray-600 dark:text-gray-400">
        No validation logs yet
      </div>
    );
  }

  const renderLogEntry = (log) => {
    return (
      <div key={log.id} className="border-b border-gray-100 p-3 last:border-0 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
        <div className="mb-2 flex items-center gap-2">
          <span className={`rounded px-2 py-0.5 text-[9px] font-semibold ${
            log.isValid 
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          }`}>
            {log.isValid ? "PASS" : "FAIL"}
          </span>
          <span className="font-medium text-blue-600 dark:text-blue-400">
            {log.issueKey}
          </span>
          <span className="text-[9px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {formatTime(log.timestamp)}
          </span>
        </div>
        <div className="ml-1 mb-2 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          Field: 
          <code className={`rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[9px] ${
            log.fieldId ? 'text-blue-600 dark:text-blue-400' : ''
          }`}>
            {log.fieldId || "(post-function)"}
          </code>
          {log.postFunctionType && (
            <span
              className={`rounded px-1.5 py-0.5 text-[9px] ${
                log.postFunctionType === "Semantic Post Function"
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
              }`}
            >
              {log.postFunctionType}
            </span>
          )}
        </div>
        <div className="ml-1 rounded bg-gray-50 p-2 text-xs font-mono text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          {log.reason}
        </div>
        {log.toolMeta?.toolsUsed && (
          <div className="ml-1 mt-1.5 rounded bg-gray-50 p-2 text-[9px] text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            <span className="rounded bg-blue-100 px-1 py-0.5 font-semibold text-[9px] text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">JQL</span>
            {log.toolMeta.toolRounds} round{log.toolMeta.toolRounds !== 1 ? "s" : ""},{" "}
            {log.toolMeta.totalResults} result{log.toolMeta.totalResults !== 1 ? "s" : ""}
            {log.toolMeta.queries?.length > 0 && (
              <div className="mt-1.5 overflow-x-auto rounded bg-gray-100 p-1 font-mono text-[8px] dark:bg-gray-700">
                {log.toolMeta.queries.map((q, i) => (
                  <div key={i} className="whitespace-pre-wrap break-all">
                    {q}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-h-[300px] overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      {logs.map(renderLogEntry)}
    </div>
  );
};

export default LogsSection;