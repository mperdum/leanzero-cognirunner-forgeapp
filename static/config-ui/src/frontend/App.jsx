/*
 * CogniRunner - AI-powered workflow validation for Jira
 * Copyright (C) 2025 LeanZero
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React, { useState, useEffect, useRef } from "react";
import { invoke } from "@forge/bridge";

// Import components
import ThemeInjector from "../components/ThemeInjector";
import FieldSelector from "../components/FieldSelector";
import StandardValidator from "../components/StandardValidator";
import SemanticConfig from "../components/SemanticConfig";
import FunctionBuilder from "../components/FunctionBuilder";

/**
 * Main App Component - Entry point for the configuration UI
 */
function App() {
  const [fieldId, setFieldId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [enableTools, setEnableTools] = useState(null);
  const [postFunctionType, setPostFunctionType] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fields, setFields] = useState([]);
  const [fieldsLoading, setFieldsLoading] = useState(true);
  const [fieldsError, setFieldsError] = useState(null);
  const [isCreateTransition, setIsCreateTransition] = useState(false);

  // Semantic post function state
  const [conditionPrompt, setConditionPrompt] = useState("");
  const [actionPrompt, setActionPrompt] = useState("");
  const [actionFieldId, setActionFieldId] = useState("");

  // Static post function state
  const [functions, setFunctions] = useState([
    {
      id: "func_001",
      name: "Initial Function",
      conditionPrompt: "",
      operationType: "work_item_query",
      operationPrompt: "",
      endpoint: "",
      method: "GET",
      variableName: "",
      code: "",
      includeBackoff: false,
    }
  ]);

  const postFunctionTypeOptions = [
    { id: null, label: "Standard Validator / Condition", description: "Validate or conditionally control transitions" },
    { id: "semantic", label: "Semantic Post Function", description: "AI-driven field modification with condition checks" },
    { id: "static", label: "Static Post Function (Builder)", description: "AI-powered function builder for complex operations" },
  ];

  const postFunctionTypeRef = useRef(null);

  // Keep refs in sync with state
  useEffect(() => {
    window.currentConfig = {
      fieldId,
      prompt,
      enableTools,
      conditionPrompt,
      actionPrompt,
      functions,
      postFunctionType,
      context: window.currentContext || null,
    };
  }, [fieldId, prompt, enableTools, conditionPrompt, actionPrompt, functions, postFunctionType]);

  // Load existing config
  useEffect(() => {
    const init = async () => {
      try {
        const { view } = await import("@forge/bridge");
        if (view && view.theme && view.theme.enable) {
          await view.theme.enable();
        }

        let context;
        try {
          context = await view.getContext();
          window.currentContext = context;
        } catch (e) {
          console.log("Could not load context:", e);
        }

        // Load existing configuration
        if (context?.extension) {
          const ext = context.extension;
          let config =
            ext.validatorConfig ||
            ext.conditionConfig ||
            ext.configuration ||
            ext.config;

          if (typeof config === "string") {
            try {
              config = JSON.parse(config);
            } catch { /* Ignore */ }
          }

          if (config) {
            setFieldId(config.fieldId || "");
            setPrompt(config.prompt || "");
            setEnableTools(config.enableTools ?? null);

            if (config.type === "semantic") {
              setPostFunctionType("semantic");
              setConditionPrompt(config.conditionPrompt || "");
              setActionPrompt(config.actionPrompt || "");
              if (config.actionFieldId) {
                setActionFieldId(config.actionFieldId);
              }
            } else if (config.type === "static") {
              setPostFunctionType("static");
              const existingFunctions = config.functions || [{
                id: "func_001",
                name: "Initial Function",
                conditionPrompt: "",
                operationType: "work_item_query",
                operationPrompt: "",
                endpoint: "",
                method: "GET",
                variableName: "",
                code: config.code || "",
                includeBackoff: false,
              }];
              setFunctions(existingFunctions);
            }
          }

          // Fetch fields
          const workflowId = ext.workflowId;
          const transitionId = ext.transitionContext?.id;

          try {
            const screenResult = await invoke("getScreenFields", { workflowId, transitionId });

            if (screenResult.success) {
              setFields(screenResult.fields);
              setIsCreateTransition(screenResult.isCreateTransition || false);

              // Add missing field to list if it exists in config but not in fields
              if (config?.fieldId && !screenResult.fields.find((f) => f.id === config.fieldId)) {
                setFields(prev => [...prev, {
                  id: config.fieldId,
                  name: `${config.fieldId} (not on current screen)`,
                  type: "Unknown",
                  custom: false
                }]);
              }
            } else {
              setFieldsError(screenResult.error || "Failed to load screen fields");
            }
          } catch (e) {
            console.error("[CogniRunner] Field fetch error:", e);
            setFieldsError("Failed to load fields: " + e.message);
          } finally {
            setFieldsLoading(false);
          }

          // Register onConfigure callback
          const jiraBridge = await import("@forge/jira-bridge");
          const workflowRules = jiraBridge.workflowRules;

          if (workflowRules) {
            try {
              await workflowRules.onConfigure(async () => {
                if (!fieldId.trim() || !prompt.trim()) {
                  return undefined;
                }

                const configData = {
                  fieldId: fieldId.trim(),
                  prompt: prompt.trim(),
                };
                if (enableTools !== null) {
                  configData.enableTools = enableTools;
                }

                if (postFunctionType === "semantic") {
                  configData.type = "semantic";
                  configData.conditionPrompt = conditionPrompt || "";
                  configData.actionPrompt = actionPrompt || "";
                  configData.actionFieldId = actionFieldId || fieldId;
                } else if (postFunctionType === "static") {
                  configData.type = "static";
                  configData.functions = functions;
                }

                console.log("Saving configuration:", configData);

                try {
                  const extContext = window.currentContext?.extension || {};
                  let moduleType = "validator";
                  if (extContext.type === "jira:workflowCondition") {
                    moduleType = "condition";
                  } else if (extContext.type === "jira:workflowPostFunction") {
                    moduleType = postFunctionType ? `postfunction-${postFunctionType}` : "postfunction-semantic";
                  }

                  const workflowContext = {};
                  if (extContext.workflowId) workflowContext.workflowId = extContext.workflowId;
                  if (extContext.workflowName) workflowContext.workflowName = extContext.workflowName;
                  if (extContext.scopedProjectId) workflowContext.projectId = extContext.scopedProjectId;
                  if (window.currentContext?.siteUrl) workflowContext.siteUrl = window.currentContext.siteUrl;

                  const ruleId = (workflowContext.workflowName && transitionId)
                    ? `${workflowContext.workflowName}::${transitionId}`
                    : extContext.entryPoint || extContext.key || Date.now().toString();

                  const resolverFunction = moduleType.includes("postfunction")
                    ? "registerPostFunction"
                    : "registerConfig";

                  await invoke(resolverFunction, {
                    id: ruleId,
                    type: moduleType,
                    fieldId: configData.fieldId,
                    prompt: configData.prompt,
                    conditionPrompt: configData.conditionPrompt || "",
                    actionPrompt: configData.actionPrompt || "",
                    functions: functions,
                    workflow: workflowContext,
                  });
                } catch (e) {
                  console.log("Could not register config:", e);
                }

                return JSON.stringify(configData);
              });
              console.log("onConfigure callback registered successfully");
            } catch (e) {
              console.error("Failed to register onConfigure:", e);
              setError("Failed to initialize configuration: " + e.message);
            }
          }
        }
      } catch (e) {
        console.error("[CogniRunner] Initialization error:", e);
      }

      setLoading(false);
    };
    init();
  }, [fieldId, prompt, enableTools, conditionPrompt, actionPrompt, functions, postFunctionType]);

  if (loading) {
    return (
      <div className="container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p className="loading-text">Loading configuration...</p>
        </div>
      </div>
    );
  }

  // Render based on post function type
  if (postFunctionType === "static") {
    return (
      <div className="container">
        <ThemeInjector />
        <FunctionBuilder functions={functions} setFunctions={setFunctions} />

        {/* Validation Message */}
        {(!fieldId.trim() || !prompt.trim()) && (
          <div className="alert alert-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>Please fill in Field ID and Validation Prompt before clicking Add/Update.</span>
          </div>
        )}
      </div>
    );
  }

  if (postFunctionType === null || postFunctionType === undefined) {
    return (
      <div className="container">
        <ThemeInjector />
        {/* Step 1: Post Function Type Selection */}
        <div className="card">
          <div className="form-group">
            <label className="label">Function Type</label>
            <div ref={postFunctionTypeRef} onKeyDown={(e) => {
              if (!e.postFunctionTypeOpen && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
                e.preventDefault();
                // Toggle would be handled by a dropdown component
              }
            }}>
              <select
                value={postFunctionType ?? ""}
                onChange={(e) => setPostFunctionType(e.target.value ? e.target.value : null)}
                className="input"
              >
                {postFunctionTypeOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>
            <p className="hint">
              Choose how this rule behaves.
            </p>
          </div>
        </div>

        <StandardValidator
          fieldId={fieldId}
          setFieldId={setFieldId}
          prompt={prompt}
          setPrompt={setPrompt}
          enableTools={enableTools}
          setEnableTools={setEnableTools}
          fields={fields}
          loadingFields={fieldsLoading}
          errorFields={fieldsError}
        />

        {/* Validation Message */}
        {(!fieldId.trim() || !prompt.trim()) && (
          <div className="alert alert-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>Please fill in both Field ID and Validation Prompt.</span>
          </div>
        )}
      </div>
    );
  }

  if (postFunctionType === "semantic") {
    return (
      <div className="container">
        <ThemeInjector />
        {/* Step 1: Post Function Type Selection */}
        <div className="card">
          <div className="form-group">
            <label className="label">Function Type</label>
            <select
              value={postFunctionType}
              onChange={(e) => setPostFunctionType(e.target.value)}
              className="input"
            >
              {postFunctionTypeOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <SemanticConfig
          conditionPrompt={conditionPrompt}
          setConditionPrompt={setConditionPrompt}
          actionPrompt={actionPrompt}
          setActionPrompt={setActionPrompt}
          actionFieldId={actionFieldId}
          setActionFieldId={setActionFieldId}
          fields={fields}
          loadingFields={fieldsLoading}
          errorFields={fieldsError}
        />

        {/* Validation Message */}
        {(!conditionPrompt.trim() || !actionFieldId.trim()) && (
          <div className="alert alert-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>Please fill in Condition Prompt and Field to Modify.</span>
          </div>
        )}
      </div>
    );
  }

  return null;
}

export default App;
