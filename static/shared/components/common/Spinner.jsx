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
 * Shared Spinner component for loading states
 */
export const Spinner = ({
  size = "medium",
  text,
  fullPage = false,
}) => {
  const sizes = {
    small: { width: "20px", height: "20px", borderWidth: "2px" },
    medium: { width: "32px", height: "32px", borderWidth: "3px" },
    large: { width: "48px", height: "48px", borderWidth: "4px" },
  };

  const sizeStyles = sizes[size];

  if (fullPage) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-black/80 backdrop-blur-sm">
        <div className="flex flex-col items-center">
          <div
            className="animate-spin rounded-full border-t-blue-600"
            style={{ ...sizeStyles, borderWidth: sizeStyles.borderWidth }}
          />
          {text && (
            <p className="mt-4 text-gray-700 dark:text-gray-300">{text}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div
        className="animate-spin rounded-full border-t-blue-600"
        style={{ ...sizeStyles, borderWidth: sizeStyles.borderWidth }}
      />
      {text && <p className="mt-4 text-gray-700 dark:text-gray-300">{text}</p>}
    </div>
  );
};

export default Spinner;