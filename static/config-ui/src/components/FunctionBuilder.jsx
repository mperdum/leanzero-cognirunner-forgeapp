/*
 * CogniRunner - AI-powered workflow validation for Jira
 * Copyright (C) 2025 LeanZero
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React from "react";
import { FunctionBlock, generateFunctionCode } from "./FunctionBlock";

/**
 * FunctionBuilder Component - Container for multiple function blocks
 */
export const FunctionBuilder = ({
  functions,
  setFunctions,
}) => {
  const addNewFunction = () => {
    if (functions.length >= 50) {
      alert("Maximum of 50 functions allowed");
      return;
    }
    const newFunc = {
      id: `func_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `Function ${functions.length + 1}`,
      conditionPrompt: "",
      operationType: "work_item_query",
      operationPrompt: "",
      endpoint: "",
      method: "GET",
      variableName: `result${functions.length + 1}`,
      code: "",
      includeBackoff: false,
    };
    setFunctions([...functions, newFunc]);
  };

  const removeFunction = (id) => {
    if (functions.length <= 1) {
      alert("Must keep at least one function");
      return;
    }
    setFunctions(functions.filter((f) => f.id !== id));
  };

  const updateFunction = (id, updates) => {
    setFunctions(functions.map((f) =>
      f.id === id ? { ...f, ...updates } : f
    ));
  };

  return (
    <>
       {/* Function List */}
       <div className="card">
         <h2 className="title" style={{ marginBottom: "8px" }}>
           Static Post Function - Function Builder
         </h2>
         <p className="subtitle" style={{ marginBottom: "16px" }}>
           Build complex workflow operations using AI-generated code. Each function can perform a different operation.
           Use the condition prompt to determine when each function should run, and let AI generate the code for you.
         </p>

         {functions.map((func, index) => (
           <FunctionBlock
             key={func.id}
             index={index}
             functionData={func}
             onUpdate={(updates) => updateFunction(func.id, updates)}
             onRemove={removeFunction}
           />
         ))}

         {/* Add Function Button */}
         <div className="add-function-container">
           <button
             type="button"
             className="button add-function-btn"
             onClick={addNewFunction}
             disabled={functions.length >= 50}
           >
             + Add Another Function {functions.length >= 50 ? "(Max Reached)" : ""}
           </button>
         </div>

         {/* Disclaimer Card */}
         <div className="card card-success">
           <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
               <circle cx="12" cy="12" r="10" />
               <line x1="12" y1="8" x2="12" y2="12" />
               <line x1="12" y1="16" x2="12.01" y2="16" />
             </svg>
             <div>
               <p className="title" style={{ fontSize: "12px", margin: 0 }}>Function Builder Features</p>
               <p className="subtitle" style={{ fontSize: "12px", margin: "4px 0 0 0" }}>
                 Add up to 50 functions. Each function can perform a different operation with AI-generated code.
                 Use variable names to share data between functions (e.g., ${duplicates}, ${api_response}).
               </p>
             </div>
           </div>
         </div>
       </div>

      {/* Validation Message */}
      <div className="alert alert-error" style={{ display: "none" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>Please fill in Field ID and Validation Prompt before clicking Add/Update.</span>
      </div>
    </>
  );
};

export default FunctionBuilder;
