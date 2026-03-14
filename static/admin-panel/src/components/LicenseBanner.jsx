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
 * Displays license status banner
 */
export const LicenseBanner = ({ licenseActive }) => {
  if (licenseActive === false) {
    return (
      <div className="mb-5 flex items-center gap-3 rounded-lg border border-green-500 bg-green-100 dark:bg-green-900/20 px-4 py-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span className="text-sm font-medium text-green-700 dark:text-green-400">
          License inactive — AI validation is disabled. Transitions will pass through without checks.
        </span>
      </div>
    );
  }

  if (licenseActive === true) {
    return (
      <div className="mb-5 flex items-center gap-3 rounded-lg border border-green-600 bg-green-100 dark:bg-green-900/20 px-4 py-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        <span className="text-sm font-medium text-green-700 dark:text-green-400">License active</span>
      </div>
    );
  }

  return null;
};

export default LicenseBanner;