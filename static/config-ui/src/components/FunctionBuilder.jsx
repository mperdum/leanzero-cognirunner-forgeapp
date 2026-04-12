/*
 * CogniRunner - AI-powered workflow validation for Jira
 * Copyright (C) 2025 LeanZero
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React from "react";
import FunctionBlock from "./FunctionBlock";
import Tooltip from "./Tooltip";

const MAX_FUNCTIONS = 50;

let funcCounter = 1;

function createEmptyFunction() {
  const num = funcCounter++;
  return {
    id: `func_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    name: "",
    conditionPrompt: "",
    operationType: "work_item_query",
    operationPrompt: "",
    endpoint: "",
    method: "GET",
    variableName: `result${num}`,
    code: "",
    includeBackoff: false,
  };
}

export default function FunctionBuilder({ functions, setFunctions }) {
  const addFunction = () => {
    if (functions.length >= MAX_FUNCTIONS) return;
    setFunctions([...functions, createEmptyFunction()]);
  };

  const removeFunction = (id) => {
    if (functions.length <= 1) return;
    setFunctions(functions.filter((f) => f.id !== id));
  };

  const updateFunction = (id, updates) => {
    setFunctions(functions.map((f) => f.id === id ? { ...f, ...updates } : f));
  };

  return (
    <div className="function-builder">
      {/* How it works banner */}
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
          <li><strong>Describe</strong> what each step should do in plain language</li>
          <li><strong>Generate</strong> — AI writes the JavaScript code for you</li>
          <li><strong>Review &amp; save</strong> — the code runs on every transition with no AI cost</li>
        </ol>
      </div>

      {functions.map((fn, i) => (
        <FunctionBlock
          key={fn.id}
          index={i}
          functionData={fn}
          priorSteps={functions.slice(0, i)}
          onUpdate={(updates) => updateFunction(fn.id, updates)}
          onRemove={removeFunction}
          isOnly={functions.length === 1}
        />
      ))}

      <button
        className="btn-add-function"
        onClick={addFunction}
        disabled={functions.length >= MAX_FUNCTIONS}
      >
        + Add Another Step
        {functions.length >= MAX_FUNCTIONS && " (max reached)"}
      </button>

      {functions.length > 1 && (
        <p className="hint" style={{ marginTop: "8px", textAlign: "center" }}>
          Steps run in order. Use{" "}
          <Tooltip text="Each step can store its return value in a named variable. Later steps can reference it using ${variableName} in their code.">
            <code style={{ cursor: "help" }}>{"${variableName}"}</code>
          </Tooltip>
          {" "}to pass results between steps.
        </p>
      )}
    </div>
  );
}
