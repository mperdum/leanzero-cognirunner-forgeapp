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

  const renderLogEntry = (log) => {
    return (
      <div key={log.id} className="config-item" style={{ borderBottom: '1px solid var(--border-color)', padding: '8px 0' }}>
        <div className="flex items-center gap-3 mb-2">
          <span className="status-badge" style={{ 
            backgroundColor: log.isValid ? 'var(--success-color)' : 'var(--error-color)',
            color: 'white',
            fontSize: '9px'
          }}>
            {log.isValid ? "PASS" : "FAIL"}
          </span>
          <span className="font-medium" style={{ color: 'var(--primary-color)' }}>
            {log.issueKey}
          </span>
          <span className="transition-info" style={{ marginLeft: 'auto' }}>
            {formatTime(log.timestamp)}
          </span>
        </div>
        <div className="config-item" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          Field: 
          <code className="value" style={{ marginLeft: '4px', fontSize: '10px' }}>
            {log.fieldId || "(post-function)"}
          </code>
        </div>
        <div className="value" style={{ marginTop: '4px', padding: '8px', fontSize: '12px', backgroundColor: 'var(--code-bg)', color: 'var(--text-color)' }}>
          {log.reason}
        </div>
      </div>
    );
  };

  return (
    <div className="container" style={{ maxHeight: '500px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
      {logs.map(renderLogEntry)}
    </div>
  );
};

export default LogsSection;