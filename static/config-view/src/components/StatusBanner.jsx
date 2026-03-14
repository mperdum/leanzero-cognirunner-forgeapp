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
 * Displays active/disabled status banner for rules
 */
export const StatusBanner = ({ 
  isDisabled, 
  onToggle, 
  toggling,
  toggleError,
  toggleWarning,
  setToggleError,
  setToggleWarning
}) => {
  const handleToggleClick = async () => {
    if (onToggle) await onToggle();
  };

  if (isDisabled === true) {
    return (
      <div className="mb-4 flex items-center justify-between rounded-lg border border-red-500 bg-red-50 px-3 py-2 dark:bg-red-900/20">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
          <span className="text-sm font-medium text-red-700 dark:text-red-400">
            This rule is <strong>disabled</strong>. It will not run on transitions.
          </span>
        </div>
        <Button variant="success" size="small" onClick={handleToggleClick} disabled={toggling}>
          {toggling ? "Enabling..." : "Enable"}
        </Button>
      </div>
    );
  }

  if (isDisabled === false) {
    return (
      <div className="mb-4 flex items-center justify-between rounded-lg border border-green-500 bg-green-50 px-3 py-2 dark:bg-green-900/20">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <span className="text-sm font-medium text-green-700 dark:text-green-400">
            This rule is <strong>active</strong>.
          </span>
        </div>
        <Button variant="danger" size="small" onClick={handleToggleClick} disabled={toggling}>
          {toggling ? "Disabling..." : "Disable"}
        </Button>
      </div>
    );
  }

  return null;
};

export default StatusBanner;