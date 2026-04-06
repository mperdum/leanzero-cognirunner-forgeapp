/*
 * CogniRunner - AI-powered workflow validation for Jira
 * Copyright (C) 2025 LeanZero
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React from "react";
import { FieldSelector } from "./FieldSelector";

/**
 * StandardValidator Component - Main validator/condition configuration
 */
export const StandardValidator = ({
  fieldId,
  setFieldId,
  prompt,
  setPrompt,
  enableTools,
  setEnableTools,
  fields,
  loadingFields,
  errorFields,
}) => {
  return (
    <>
       {/* Field Selection */}
       <div className="card">
         <FieldSelector
           label="Field to Validate"
           value={fieldId}
           onChange={setFieldId}
           fields={fields}
           loading={loadingFields}
           error={errorFields}
           required={true}
         />
       </div>
 
       {/* Validation Prompt */}
       <div className="card">
         <div className="form-group">
           <label className="label">Validation Prompt <span className="required">*</span></label>
           <textarea
             value={prompt}
             onChange={(e) => setPrompt(e.target.value)}
             placeholder="Describe what makes the field value valid. Example: The description must include steps to reproduce, expected behavior, and actual behavior."
             className={`textarea ${!prompt.trim() ? "input-error" : ""}`}
             rows={5}
           />
           <p className="hint">
             Describe the validation criteria in natural language. The AI will evaluate if the field content meets these requirements.
           </p>
         </div>
 
         {/* Jira Search Toggle */}
         <div className="form-group">
           <label className="label">Jira Search (JQL)</label>
           <select
             value={enableTools === null ? "auto" : enableTools ? "on" : "off"}
             onChange={(e) => {
               const v = e.target.value;
               setEnableTools(v === "auto" ? null : v === "on");
             }}
             className="operation-type-select"
           >
             <option value="auto">Auto-detect from prompt</option>
             <option value="on">Always enabled</option>
             <option value="off">Always disabled</option>
           </select>
           <p className="hint">
             When enabled, the AI can search Jira for similar or related issues during validation.
             Auto-detect activates this when your prompt mentions duplicates, similarity, or existing issues.
           </p>
         </div>
       </div>
    </>
  );
};

export default StandardValidator;
