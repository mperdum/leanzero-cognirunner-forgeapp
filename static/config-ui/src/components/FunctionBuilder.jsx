/*
 * CogniRunner - AI-powered workflow validation for Jira
 * Copyright (C) 2025 LeanZero
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React from "react";
import FunctionBlock from "./FunctionBlock";

const MAX_FUNCTIONS = 50;

function createEmptyFunction() {
  return {
    id: `func_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    name: "",
    conditionPrompt: "",
    operationType: "work_item_query",
    operationPrompt: "",
    endpoint: "",
    method: "GET",
    variableName: "",
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
      <div className="function-builder-header">
        <p className="hint" style={{ marginTop: 0 }}>
          Chain up to {MAX_FUNCTIONS} operations. Each function can reference results from previous
          functions using <code>{"${variableName}"}</code> syntax.
        </p>
      </div>

      {functions.map((fn, i) => (
        <FunctionBlock
          key={fn.id}
          index={i}
          functionData={fn}
          onUpdate={(updates) => updateFunction(fn.id, updates)}
          onRemove={removeFunction}
        />
      ))}

      <button
        className="btn-add-function"
        onClick={addFunction}
        disabled={functions.length >= MAX_FUNCTIONS}
      >
        + Add Another Function
        {functions.length >= MAX_FUNCTIONS && " (max reached)"}
      </button>
    </div>
  );
}
