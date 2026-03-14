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
        <span className="inline-block rounded bg-green-100 px-2 py-1 text-[9px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
          Semantic Post Function
        </span>
      );
    }
    if (config.type === "static") {
      return (
        <span className="inline-block rounded bg-orange-100 px-2 py-1 text-[9px] font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
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
          <div className="mb-3">
            <span className="mr-2 font-semibold text-gray-600 dark:text-gray-400">Condition:</span>
            <span className="rounded bg-gray-100 px-2 py-1 text-xs font-mono text-blue-600 dark:bg-gray-700 dark:text-blue-400">
              {config.conditionPrompt?.length > 80
                ? config.conditionPrompt.substring(0, 80) + "..."
                : (config.conditionPrompt || "(none)")}
            </span>
          </div>
          <div className="mb-3">
            <span className="mr-2 font-semibold text-gray-600 dark:text-gray-400">Action:</span>
            <span className="rounded bg-gray-100 px-2 py-1 text-xs font-mono text-blue-600 dark:bg-gray-700 dark:text-blue-400">
              {config.actionPrompt?.length > 80
                ? config.actionPrompt.substring(0, 80) + "..."
                : (config.actionPrompt || "(none)")}
            </span>
          </div>
          <div className="mb-3">
            <span className="mr-2 font-semibold text-gray-600 dark:text-gray-400">Action Field:</span>
            <code className="rounded bg-gray-100 px-2 py-1 text-xs font-mono text-blue-600 dark:bg-gray-700 dark:text-blue-400">
              {config.actionFieldId || config.fieldId}
            </code>
          </div>
        </>
      );
    }

    if (config.type === "static") {
      return (
        <div className="mb-3">
          <span className="mr-2 font-semibold text-gray-600 dark:text-gray-400">Code:</span>
          <span className="rounded bg-gray-100 px-2 py-1 text-xs font-mono text-blue-600 dark:bg-gray-700 dark:text-blue-400">
            {config.code?.length > 80
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
        <div className="mb-3">
          <span className="mr-2 font-semibold text-gray-600 dark:text-gray-400">Prompt:</span>
          <span className="rounded bg-gray-100 px-2 py-1 text-xs font-mono text-blue-600 dark:bg-gray-700 dark:text-blue-400">
            {config.prompt.length > 80
              ? config.prompt.substring(0, 80) + "..."
              : config.prompt}
          </span>
        </div>
        {config.enableTools !== undefined && (
          <div className="mb-3">
            <span className="mr-2 font-semibold text-gray-600 dark:text-gray-400">Tools:</span>
            <span className={`rounded px-2 py-1 text-xs font-mono ${
              config.enableTools
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              {config.enableTools ? "Enabled (JQL Search)" : "Disabled"}
            </span>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="mb-6">
      {/* Post Function Type Indicator */}
      {postFunctionBadge()}

      <div className="mb-3 flex items-center">
        <span className="mr-2 font-semibold text-gray-600 dark:text-gray-400">Field:</span>
        <code className="rounded bg-gray-100 px-2 py-1 text-xs font-mono text-blue-600 dark:bg-gray-700 dark:text-blue-400">
          {config.fieldId}
        </code>
      </div>

      {/* Render either Post Function fields or Standard fields */}
      {renderPostFunctionFields()}
      {renderStandardFields()}
    </div>
  );
};

export default ConfigViewer;