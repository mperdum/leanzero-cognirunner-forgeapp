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
 * Displays the configuration details in a key-value format
 */
export const ConfigViewer = ({ config }) => {
  // Post Function Type Badge
  const postFunctionBadge = () => {
    if (config.type === "semantic" || config.type?.startsWith("postfunction")) {
      return (
        <span className="status-badge" style={{ backgroundColor: 'var(--icon-bg)', color: 'var(--primary-color)' }}>
          Semantic Post Function
        </span>
      );
    }
    if (config.type === "static") {
      return (
        <span className="status-badge" style={{ backgroundColor: 'var(--hover-bg)', color: 'var(--text-secondary)' }}>
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

    if (config.type === "semantic" || config.type?.startsWith("postfunction")) {
      return (
        <>
          <div className="config-item">
            <span className="label">Condition:</span>
            <span className="value">{config.conditionPrompt?.length > 80
                ? config.conditionPrompt.substring(0, 80) + "..."
                : (config.conditionPrompt || "(none)")}
              </span>
          </div>
          <div className="config-item">
            <span className="label">Action:</span>
            <span className="value">{config.actionPrompt?.length > 80
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

    if (config.type === "static") {
      return (
        <div className="config-item">
          <span className="label">Code:</span>
          <span className="value">{config.code?.length > 80
              ? config.code.substring(0, 80) + "..."
              : (config.code || "(none)")}
            </span>
        </div>
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
          <span className="prompt-value">{config.prompt.length > 80
              ? config.prompt.substring(0, 80) + "..."
              : config.prompt}
            </span>
        </div>
        {config.enableTools !== undefined && (
          <div className="config-item">
            <span className="label">Tools:</span>
            <span className="value" style={{ color: config.enableTools ? 'var(--primary-color)' : 'var(--error-color)' }}>
              {config.enableTools ? "Enabled (JQL Search)" : "Disabled"}
            </span>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="container">
      {/* Post Function Type Indicator */}
      {postFunctionBadge()}

      <div className="config-item">
        <span className="label">Field:</span>
        <code className="value">{config.fieldId}</code>
      </div>

      {/* Render either Post Function fields or Standard fields */}
      {renderPostFunctionFields()}
      {renderStandardFields()}
    </div>
  );
};

export default ConfigViewer;