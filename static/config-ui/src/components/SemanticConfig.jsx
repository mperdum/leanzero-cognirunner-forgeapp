/*
 * CogniRunner - AI-powered workflow validation for Jira
 * Copyright (C) 2025 LeanZero
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React from "react";
import { FieldSelector } from "./FieldSelector";

/**
 * SemanticConfig Component - Semantic post function configuration
 */
export const SemanticConfig = ({
  conditionPrompt,
  setConditionPrompt,
  actionPrompt,
  setActionPrompt,
  actionFieldId,
  setActionFieldId,
  fields,
  loadingFields,
  errorFields,
}) => {
  return (
    <>
      {/* Semantic Configuration */}
      <div className="card">
        <div className="form-group">
          <label className="label">Condition Prompt <span className="required">*</span></label>
          <textarea
            value={conditionPrompt}
            onChange={(e) => setConditionPrompt(e.target.value)}
            placeholder="Describe when this post function should run. Example: Only execute if the issue priority is High or Critical."
            rows={4}
          />
          <p className="hint">
            The AI will evaluate if this condition is met. Returns true (run) or false (skip).
          </p>
        </div>

        <div className="form-group">
          <label className="label">Action Prompt</label>
          <textarea
            value={actionPrompt}
            onChange={(e) => setActionPrompt(e.target.value)}
            placeholder="Describe what field changes to make. Example: Set the resolution to 'Won't Fix' and add a comment explaining why."
            rows={6}
          />
          <p className="hint">
            The AI will modify the specified field(s) based on this prompt.
          </p>
        </div>

        {/* Field Selection */}
        <FieldSelector
          label="Field to Modify"
          value={actionFieldId}
          onChange={(val) => setActionFieldId(val)}
          fields={fields}
          loading={loadingFields}
          error={errorFields}
        />
      </div>

      {/* Disclaimer */}
      <div className="card" style={{ backgroundColor: "var(--alert-success-bg)", borderColor: "var(--alert-success-border)" }}>
        <p style={{ margin: 0, fontSize: "12px", fontWeight: "600" }}>For Best Results</p>
        <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--text-color)" }}>
          Semantic post functions work best with text-based fields where AI can intelligently rephrase or refine content.
        </p>
      </div>
    </>
  );
};

export default SemanticConfig;
