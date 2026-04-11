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

  const spinnerStyle = {
    ...sizeStyles,
    borderStyle: "solid",
    borderColor: "var(--border-color, #cbd5e1)",
    borderTopColor: "var(--primary-color, #2563eb)",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  };

  if (fullPage) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-secondary, rgba(255,255,255,0.8))", backdropFilter: "blur(4px)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={spinnerStyle} />
          {text && (
            <p style={{ marginTop: "16px", color: "var(--text-secondary, #64748b)" }}>{text}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px" }}>
      <div style={spinnerStyle} />
      {text && <p style={{ marginTop: "16px", color: "var(--text-secondary, #64748b)" }}>{text}</p>}
    </div>
  );
};

export default Spinner;