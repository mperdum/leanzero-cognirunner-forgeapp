/*
 * CogniRunner - AI-powered workflow validation for Jira
 * Copyright (C) 2025 LeanZero
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React, { useState } from "react";

/**
 * FunctionBlock Component - Individual function block in the static builder
 */
export const FunctionBlock = ({
  index,
  functionData,
  onUpdate,
  onRemove,
}) => {
  const { id, name, conditionPrompt, operationType, operationPrompt, endpoint, method, variableName, code, includeBackoff } = functionData;
  const [isGenerating, setIsGenerating] = useState(false);

  const handleRegenerateCode = async () => {
    if (!conditionPrompt || !operationPrompt) return;

    setIsGenerating(true);
    try {
      // Simulate AI generation with a small delay for better UX
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      const generatedCode = generateFunctionCode(
        conditionPrompt,
        operationType,
        operationPrompt,
        endpoint,
        method
      );
      
      onUpdate({ code: generatedCode });
    } catch (error) {
      console.error("Failed to regenerate code:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="function-block">
       {/* Function Header */}
       <div className="function-header">
         <span className="function-number">Function {index + 1}</span>
         <input
           type="text"
           value={name}
           onChange={(e) => onUpdate({ name: e.target.value })}
           placeholder="Function name (optional)"
           className="function-name-input"
         />
         <button
           type="button"
           className="remove-function-btn"
           onClick={() => onRemove(id)}
           title="Remove function"
         >
           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
             <line x1="18" y1="6" x2="6" y2="18"></line>
             <line x1="6" y1="6" x2="18" y2="18"></line>
           </svg>
         </button>
       </div>

      {/* Condition Prompt */}
      <div className="form-group">
        <label className="label">Condition Prompt</label>
        <textarea
          value={conditionPrompt}
          onChange={(e) => onUpdate({ conditionPrompt: e.target.value })}
          placeholder="When should this function execute? Leave empty to always run."
          className="textarea"
          rows={3}
        />
        <p className="hint">
          AI evaluates if this condition is met. Returns true (run) or false (skip).
        </p>
      </div>

      {/* Operation Type */}
      <div className="form-group">
        <label className="label">Operation Type</label>
        <select
          value={operationType}
          onChange={(e) => onUpdate({ operationType: e.target.value })}
          className="operation-type-select"
        >
          <option value="work_item_query">Work Item Query (JQL Search)</option>
          <option value="rest_api_internal">REST API - Internal (Atlassian Jira)</option>
          <option value="rest_api_external">REST API - External</option>
          <option value="confluence_api">Confluence API</option>
          <option value="log_function">Log Function (Debugging)</option>
        </select>
        <p className="hint">
          Choose what type of operation this function performs.
        </p>
      </div>

      {/* Operation-Specific Fields */}
      {operationType === "work_item_query" && (
        <div className="form-group">
          <label className="label">JQL Search Prompt</label>
          <textarea
            value={operationPrompt}
            onChange={(e) => onUpdate({ operationPrompt: e.target.value })}
            placeholder="Describe what issues to search for. Example: Find all open tickets with the same summary as this one."
            className="textarea"
            rows={4}
          />
          <p className="hint">
            AI generates a JQL query from this prompt using context from the issue.
          </p>
        </div>
      )}

      {operationType === "rest_api_internal" && (
        <>
          <div className="form-group">
            <label className="label">Endpoint Template</label>
            <input
              type="text"
              value={endpoint}
              onChange={(e) => onUpdate({ endpoint: e.target.value })}
              placeholder="/rest/api/3/issue/${issueKey}"
              className="input"
            />
            <p className="hint">
              Use {"${variable}"} syntax to reference issue fields or previous function results.
              <br />Example: /rest/api/3/issue/{`{${"parentIssue"}}`} or {`{${"duplicates.result1"}}`}
            </p>
          </div>

          <div className="form-group">
            <label className="label">HTTP Method</label>
            <select
              value={method}
              onChange={(e) => onUpdate({ method: e.target.value })}
              className="operation-type-select"
            >
              <option value="GET">GET - Read data</option>
              <option value="POST">POST - Create resource</option>
              <option value="PUT">PUT - Update resource</option>
              <option value="DELETE">DELETE - Remove resource</option>
              <option value="PATCH">PATCH - Partial update</option>
            </select>
          </div>

          {/* Link to Atlassian REST API docs */}
          <div className="form-group">
            <p className="hint" style={{ margin: 0 }}>
              Need help with Jira REST API endpoints? Check the{" "}
              <a href="https://developer.atlassian.com/cloud/jira/platform/rest/v3/" target="_blank" rel="noopener noreferrer">
                Atlassian REST API v3 Documentation
              </a>
              .
            </p>
          </div>
        </>
      )}

      {operationType === "rest_api_external" && (
        <div className="form-group">
          <label className="label">External URL Template</label>
          <input
            type="text"
            value={endpoint}
            onChange={(e) => onUpdate({ endpoint: e.target.value })}
            placeholder="https://api.example.com/v1/resource/${issueKey}"
            className="input"
          />
          <p className="hint">
            Use {"${variable}"} syntax to reference issue fields or previous function results.
          </p>
        </div>
      )}

      {operationType === "confluence_api" && (
        <>
          <div className="form-group">
            <label className="label">Operation</label>
            <select
              value={method}
              onChange={(e) => onUpdate({ method: e.target.value })}
              className="operation-type-select"
            >
              <option value="GET_PAGE">Get Page Content</option>
              <option value="UPDATE_PAGE">Update Page</option>
              <option value="CREATE_PAGE">Create Page</option>
              <option value="DELETE_PAGE">Delete Page</option>
              <option value="ADD_COMMENT">Add Comment</option>
            </select>
          </div>

          <div className="form-group">
            <label className="label">Space Key (optional)</label>
            <input
              type="text"
              value={operationPrompt}
              onChange={(e) => onUpdate({ operationPrompt: e.target.value })}
              placeholder="Use space key from issue if empty"
              className="input"
            />
          </div>

          {/* Link to Confluence REST API docs */}
          <div className="form-group">
            <p className="hint" style={{ margin: 0 }}>
              Check the{" "}
              <a href="https://developer.atlassian.com/cloud/confluence/rest/v2/" target="_blank" rel="noopener noreferrer">
                Atlassian Confluence REST API v2 Documentation
              </a>
              .
            </p>
          </div>
        </>
      )}

      {operationType === "log_function" && (
        <div className="form-group">
          <label className="label">Log Message Template</label>
          <textarea
            value={operationPrompt}
            onChange={(e) => onUpdate({ operationPrompt: e.target.value })}
            placeholder="Log message with variables: Issue ${issueKey} has status ${status}"
            className="textarea"
            rows={3}
          />
          <p className="hint">
            Use {"${variable}"} syntax to include issue fields in the log.
          </p>
        </div>
      )}

       {/* Variable Name */}
       {operationType !== "log_function" && (
         <div className="form-group">
           <label className="label">Variable Name (for other functions)</label>
           <input
             type="text"
             value={variableName}
             onChange={(e) => onUpdate({ variableName: e.target.value })}
             placeholder="result1, duplicates, api_response..."
             className="variable-name-input"
           />
           <p className="hint">
             Name this function's result so other functions can use it with ${variableName}.
             Leave empty if not needed by other functions.
           </p>
         </div>
       )}

       {/* Generated Code Editor */}
       <div className="form-group">
         <label className="label">Generated Code</label>
         <textarea
           value={code}
           readOnly={!conditionPrompt && !operationPrompt}
           placeholder="// AI will generate this code based on your prompts"
           className={`code-editor ${!conditionPrompt && !operationPrompt ? "disabled-code" : ""}`}
           rows={8}
         />
         <div className="code-actions">
           {(!conditionPrompt || !operationPrompt) ? (
             <span className="hint" style={{ margin: 0 }}>
               Fill in Condition Prompt and Operation Type/Prompt to generate code
             </span>
           ) : (
             <>
               <button
                 type="button"
                 className="small-button"
                 onClick={handleRegenerateCode}
                 disabled={isGenerating}
               >
                 {isGenerating ? (
                   <>
                     <span className="spinner-small" style={{ marginRight: "6px", display: "inline-block" }}></span>
                     Generating code...
                   </>
                 ) : (
                   <>Regenerate Code with AI</>
                 )}
               </button>
               <label className="backoff-checkbox">
                 <input
                   type="checkbox"
                   checked={includeBackoff}
                   onChange={(e) => onUpdate({ includeBackoff: e.target.checked })}
                 />
                 Include exponential backoff for API calls (3 retries)
               </label>
             </>
           )}
         </div>
         <p className="hint">
           The AI generates this code based on your prompts. You can edit it manually before committing.
         </p>
       </div>
    </div>
  );
};

/**
 * Helper function to generate function code based on prompts
 */
export const generateFunctionCode = (conditionPrompt, operationType, operationPrompt, endpoint, method) => {
  let generatedCode = "// Generated code based on your prompts\n";
  generatedCode += `\n// Condition: ${conditionPrompt}\n`;
  generatedCode += `// Operation: ${operationType} - ${operationPrompt}\n\n`;

  if (endpoint) {
    generatedCode += `// Endpoint template: ${endpoint}\n`;
  }

  if (method) {
    generatedCode += `// HTTP Method: ${method}\n`;
  }

  generatedCode += "\nexport default async function(context) {\n";
  generatedCode += "  // Your code here\n";
  generatedCode += "}\n";

  return generatedCode;
};

export default FunctionBlock;
