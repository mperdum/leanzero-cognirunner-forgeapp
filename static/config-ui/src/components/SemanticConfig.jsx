/*
 * CogniRunner - AI-powered workflow validation for Jira
 * Copyright (C) 2025 LeanZero
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React from "react";
import Tooltip from "./Tooltip";
import CustomSelect from "./CustomSelect";

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
      <div className="pf-how-it-works">
        <div className="pf-how-header">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <strong>How it works</strong>
        </div>
        <ol className="pf-how-steps">
          <li><strong>Condition</strong> — AI checks if this rule should fire</li>
          <li><strong>Action</strong> — If yes, AI generates a new value for the target field</li>
          <li>The target field is updated automatically after each transition</li>
        </ol>
      </div>

      <div className="form-group">
        <label className="label">
          Condition <span className="required">*</span>
          <Tooltip text="The AI reads the issue's source field and evaluates this condition. If the condition is met, the action runs. If not, the post-function is skipped." />
        </label>
        <textarea
          value={conditionPrompt}
          onChange={(e) => setConditionPrompt(e.target.value)}
          placeholder={'Example: "Run when the description mentions a bug or defect"'}
          className={`textarea ${!conditionPrompt.trim() ? "input-error" : ""}`}
          rows={4}
        />
      </div>

      <div className="form-group">
        <label className="label">
          Action
          <Tooltip text="When the condition passes, the AI generates a new value for the target field based on this instruction. Leave empty to use a generic summarization." />
        </label>
        <textarea
          value={actionPrompt}
          onChange={(e) => setActionPrompt(e.target.value)}
          placeholder={'Example: "Summarize the issue into 2-3 bullet points"'}
          className="textarea"
          rows={5}
        />
      </div>

      <div className="form-group">
        <label className="label">
          Target Field <span className="required">*</span>
          <Tooltip text="The field that will be updated with the AI-generated value. Works best with text fields (Summary, Description, custom text fields)." />
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
          <CustomSelect
            value={actionFieldId}
            onChange={setActionFieldId}
            placeholder="Select a field..."
            searchable
            searchPlaceholder="Search fields..."
            error={!actionFieldId}
            options={fields.map((f) => ({
              value: f.id,
              label: f.name,
              meta: f.id,
              type: f.type?.replace(/^(System|Custom) \(|\)$/g, ""),
              custom: f.custom,
            }))}
            groups={[
              { label: "System Fields", filter: (o) => !o.custom },
              { label: "Custom Fields", filter: (o) => !!o.custom },
            ]}
          />
        )}
      </div>
    </div>
  );
}
