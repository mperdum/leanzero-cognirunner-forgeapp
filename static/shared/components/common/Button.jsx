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
 * Shared Button component with multiple style variants
 */
export const Button = ({
  children,
  onClick,
  variant = "primary",
  size = "medium",
  disabled = false,
  className = "",
  title = "",
}) => {
  const baseStyle = "border border-solid rounded-md cursor-pointer font-medium transition-colors";
  
  const variants = {
    primary: "border-[var(--primary-color)] text-white",
    secondary: "border-transparent text-[var(--text-color)]",
    danger: "border-[var(--error-color)] text-[var(--error-color)]",
    outline: "border-[var(--border-color)] text-[var(--text-color)]",
    success: "border-[var(--success-color)] text-[var(--success-color)]",
    link: "border-transparent text-[var(--primary-color)] underline p-0",
  };

  const sizes = {
    small: "px-3 py-1.5 text-xs",
    medium: "px-4 py-2 text-sm",
    large: "px-6 py-3 text-base",
  };

  return (
    <button
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
};

export default Button;