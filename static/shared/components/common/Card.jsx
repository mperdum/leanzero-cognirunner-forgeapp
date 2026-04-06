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
 * Shared Card component for consistent UI containers
 */
export const Card = ({
  children,
  className = "",
  title,
  headerActions,
  style = {},
}) => {
  return (
    <div
      className={`border rounded-lg overflow-hidden ${className}`}
      style={{ 
        borderColor: 'var(--border-color)', 
        backgroundColor: 'var(--card-bg)',
        ...style 
      }}
    >
      {title && (
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <h3 className="font-semibold" style={{ color: 'var(--text-color)' }}>{title}</h3>
        </div>
      )}
      {headerActions && title && (
        <div className="px-4 py-2 flex justify-end" style={{ borderBottom: '1px solid var(--border-color)' }}>
          {headerActions}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
};

export default Card;