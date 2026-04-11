/*
 * CogniRunner - AI-powered workflow validation for Jira
 * Copyright (C) 2025 LeanZero
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React from "react";

export default function SemanticConfig({
  conditionPrompt,
  setConditionPrompt,
  actionPrompt,
  setActionPrompt,
  actionFieldId,
  setActionFieldId,
  fields,
  loadingFields,
  errorFields,
}) {
  return (
    <div className="semantic-config">
      <div className="form-group">
        <label className="label">
          Condition Prompt <span className="required">*</span>
        </label>
        <textarea
          value={conditionPrompt}
          onChange={(e) => setConditionPrompt(e.target.value)}
          placeholder="When should this run? e.g., 'Run when the description mentions a bug or defect'"
          className={`textarea ${!conditionPrompt.trim() ? "input-error" : ""}`}
          rows={4}
        />
        <p className="hint">
          The AI evaluates this condition against the source field. Returns true (execute action) or false (skip).
        </p>
      </div>

      <div className="form-group">
        <label className="label">Action Prompt</label>
        <textarea
          value={actionPrompt}
          onChange={(e) => setActionPrompt(e.target.value)}
          placeholder="What should the AI do? e.g., 'Summarize the issue into 2-3 bullet points and set as the target field value'"
          className="textarea"
          rows={6}
        />
        <p className="hint">
          Describe how the AI should generate the new value for the target field.
        </p>
      </div>

      <div className="form-group">
        <label className="label">
          Field to Modify <span className="required">*</span>
        </label>
        {loadingFields ? (
          <div className="fields-loading">
            <div className="spinner-small"></div>
            <span>Loading fields...</span>
          </div>
        ) : errorFields ? (
          <>
            <input
              type="text"
              value={actionFieldId}
              onChange={(e) => setActionFieldId(e.target.value)}
              placeholder="e.g., summary, customfield_10001"
              className="input"
            />
            <p className="hint" style={{ color: "var(--error-color)" }}>
              Could not load fields. Enter field ID manually.
            </p>
          </>
        ) : (
          <select
            value={actionFieldId}
            onChange={(e) => setActionFieldId(e.target.value)}
            className="input"
            style={{ cursor: "pointer" }}
          >
            <option value="">Select a field...</option>
            {fields.filter((f) => !f.custom).length > 0 && (
              <optgroup label="System Fields">
                {fields.filter((f) => !f.custom).map((f) => (
                  <option key={f.id} value={f.id}>{f.name} ({f.id})</option>
                ))}
              </optgroup>
            )}
            {fields.filter((f) => f.custom).length > 0 && (
              <optgroup label="Custom Fields">
                {fields.filter((f) => f.custom).map((f) => (
                  <option key={f.id} value={f.id}>{f.name} ({f.id})</option>
                ))}
              </optgroup>
            )}
          </select>
        )}
        <p className="hint">
          The AI will update this field when the condition is met. Works best with text-based fields.
        </p>
      </div>
    </div>
  );
}
