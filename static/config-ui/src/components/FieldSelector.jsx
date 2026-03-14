/*
 * CogniRunner - AI-powered workflow validation for Jira
 * Copyright (C) 2025 LeanZero
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React from "react";
import { Dropdown } from "./Dropdown";

/**
 * FieldSelector Component - Select a field from the available fields list
 */
export const FieldSelector = ({
  label,
  value,
  onChange,
  fields,
  loading,
  error,
  required = false,
}) => {
  if (loading) {
    return (
      <div className="fields-loading">
        <div className="spinner-small"></div>
        <span>Loading available fields...</span>
      </div>
    );
  }

  if (error) {
    return (
      <>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter field ID manually..."
          className={`input input-error`}
        />
        <p className="hint" style={{ color: "var(--error-color)" }}>
          Could not load fields: {error}. Enter field ID manually.
        </p>
      </>
    );
  }

  const options = fields.map((f) => ({
    id: f.id,
    label: f.name,
    description: `${f.type} - ${f.id}`,
    type: f.type.replace(/^System \(|\)$/g, "").replace(/^Custom \(|\)$/g, ""),
  }));

  return (
    <div className="form-group">
      <label className="label">
        {label} {required && <span className="required">*</span>}
      </label>
      <Dropdown
        options={options}
        value={value}
        onChange={(opt) => onChange(opt.id)}
        placeholder="Select a field..."
        searchPlaceholder="Search fields..."
        emptyMessage="No fields match your search"
        renderOption={(opt) => opt.label}
      />
      {error && <p className="hint" style={{ color: "var(--error-color)" }}>{error}</p>}
    </div>
  );
};

export default FieldSelector;
