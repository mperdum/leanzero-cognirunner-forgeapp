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
      <div className="loading-text" style={{ textAlign: 'center', padding: '2rem 0' }}>
        Loading logs...
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="loading-text" style={{ textAlign: 'center', padding: '2rem 0' }}>
        No validation logs yet
      </div>
    );
  }

  const renderLogEntry = (log) => {
    return (
      <div key={log.id} className="config-item" style={{ borderBottom: '1px solid var(--border-color)', padding: '8px 0' }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="status-badge" style={{ 
            backgroundColor: log.isValid ? 'var(--success-color)' : 'var(--error-color)',
            color: 'white',
            fontSize: '9px'
          }}>
            {log.isValid ? "PASS" : "FAIL"}
          </span>
          <span className="workflow-name" style={{ fontSize: '12px', color: 'var(--primary-color)' }}>
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
          {log.postFunctionType && (
            <span className="status-badge" style={{ 
              marginLeft: '8px',
              backgroundColor: log.postFunctionType === "Semantic Post Function" ? 'var(--success-color)' : 'var(--primary-color)',
              color: 'white',
              fontSize: '9px'
            }}>
              {log.postFunctionType}
            </span>
          )}
        </div>
        <div className="value" style={{ marginTop: '4px', padding: '8px', fontSize: '12px', backgroundColor: 'var(--code-bg)', color: 'var(--text-color)' }}>
          {log.reason}
        </div>
        {log.toolMeta?.toolsUsed && (
          <div className="value" style={{ marginTop: '4px', padding: '8px', fontSize: '10px', backgroundColor: 'var(--code-bg)', color: 'var(--text-secondary)' }}>
            <span className="status-badge" style={{ backgroundColor: 'var(--primary-color)', color: 'white', fontSize: '9px' }}>JQL</span>
            {log.toolMeta.toolRounds} round{log.toolMeta.toolRounds !== 1 ? "s" : ""},{" "}
            {log.toolMeta.totalResults} result{log.toolMeta.totalResults !== 1 ? "s" : ""}
            {log.toolMeta.queries?.length > 0 && (
              <div style={{ marginTop: '4px', padding: '4px', backgroundColor: 'var(--input-bg)', borderRadius: '3px' }}>
                {log.toolMeta.queries.map((q, i) => (
                  <div key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '9px' }}>
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
    <div className="container" style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
      {logs.map(renderLogEntry)}
    </div>
  );
};

export default LogsSection;