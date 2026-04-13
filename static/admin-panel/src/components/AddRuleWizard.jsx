/*
 * CogniRunner - AI-powered workflow validation for Jira
 * Copyright (C) 2025 LeanZero
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React, { useState, useEffect } from "react";
import CustomSelect from "./CustomSelect";

const RULE_TYPE_OPTIONS = [
  { value: "validator", label: "Validator", desc: "Block transition if validation fails" },
  { value: "condition", label: "Condition", desc: "Hide transition if condition not met" },
  { value: "postfunction-semantic", label: "Semantic Post Function", desc: "AI modifies a field after transition" },
  { value: "postfunction-static", label: "Static Post Function", desc: "Run custom code after transition" },
];

export default function AddRuleWizard({ invoke, onClose, onCreated }) {
  // Wizard steps: project -> workflow -> transition -> type -> config
  const [step, setStep] = useState(1);

  // Step 1: Project
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);

  // Step 2: Workflow
  const [workflows, setWorkflows] = useState([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);

  // Step 3: Transition
  const [transitions, setTransitions] = useState([]);
  const [loadingTransitions, setLoadingTransitions] = useState(false);
  const [selectedTransition, setSelectedTransition] = useState(null);

  // Step 4: Rule type
  const [ruleType, setRuleType] = useState(null);

  // Step 5: Config
  const [fields, setFields] = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [fieldId, setFieldId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [conditionPrompt, setConditionPrompt] = useState("");
  const [actionPrompt, setActionPrompt] = useState("");
  const [actionFieldId, setActionFieldId] = useState("");
  const [enableTools, setEnableTools] = useState(null); // null = auto, true = on, false = off
  // Static PF state
  const [functions, setFunctions] = useState([{ id: Date.now().toString(), name: "", prompt: "", code: "", variableName: "result1", operationType: "work_item_query", includeBackoff: false }]);
  const [generatingCode, setGeneratingCode] = useState(null); // step id being generated
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [testIssue, setTestIssue] = useState("");
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [created, setCreated] = useState(false);
  const [submitted, setSubmitted] = useState(false); // for field validation

  // Load projects on mount
  useEffect(() => {
    (async () => {
      try {
        const result = await invoke("listProjects");
        if (result.success) setProjects(result.projects || []);
        else setError(result.error);
      } catch (e) { setError("Failed to load projects"); }
      setLoadingProjects(false);
    })();
  }, []);

  // Load workflows when project selected
  const handleProjectSelect = async (project) => {
    setSelectedProject(project);
    setSelectedWorkflow(null);
    setSelectedTransition(null);
    setWorkflows([]);
    setTransitions([]);
    setLoadingWorkflows(true);
    setError(null);
    try {
      const result = await invoke("getProjectWorkflows", { projectKey: project.key, projectId: project.id });
      if (result.success) setWorkflows(result.workflows || []);
      else setError(result.error);
    } catch (e) { setError("Failed to load workflows"); }
    setLoadingWorkflows(false);
    setStep(2);
  };

  // Load transitions when workflow selected
  const handleWorkflowSelect = async (workflow) => {
    setSelectedWorkflow(workflow);
    setSelectedTransition(null);
    setTransitions([]);
    setLoadingTransitions(true);
    setError(null);
    try {
      const result = await invoke("getWorkflowTransitions", { workflowName: workflow.name });
      if (result.success) setTransitions(result.transitions || []);
      else setError(result.error);
    } catch (e) { setError("Failed to load transitions"); }
    setLoadingTransitions(false);
    setStep(3);
  };

  // Select transition
  const handleTransitionSelect = (transition) => {
    setSelectedTransition(transition);
    setStep(4);
  };

  // Select rule type and load fields
  const handleTypeSelect = async (type) => {
    setRuleType(type);
    setStep(5);
    // Only fetch fields if not already loaded
    if (fields.length === 0) {
      setLoadingFields(true);
      try {
        const result = await invoke("getFields");
        if (result.success) {
          setFields(result.fields || []);
        } else {
          console.error("getFields failed:", result.error);
        }
      } catch (e) {
        console.error("getFields error:", e);
      }
      setLoadingFields(false);
    }
  };

  // Save the rule
  const handleSave = async () => {
    setSubmitted(true);
    // Validate required fields
    if (ruleType === "validator" && (!fieldId || !prompt.trim())) return;
    if (ruleType === "condition" && (!fieldId || !prompt.trim())) return;
    if (ruleType === "postfunction-semantic" && !conditionPrompt.trim()) return;
    if (ruleType === "postfunction-static" && !functions.some((f) => f.code)) return;

    setSaving(true);
    setError(null);

    const isPostFunction = ruleType.startsWith("postfunction");
    const ruleId = `${selectedWorkflow.name}::${selectedTransition.id}`;
    const workflowData = {
      workflowName: selectedWorkflow.name,
      workflowId: selectedWorkflow.id,
      transitionId: selectedTransition.id,
      transitionName: selectedTransition.name,
      transitionFromName: selectedTransition.fromName,
      transitionToName: selectedTransition.toName,
      projectKey: selectedProject.key,
    };

    try {
      // Step A: Register config in CogniRunner KVS
      let result;
      const configPayload = isPostFunction
        ? ruleType === "postfunction-static"
          ? { fieldId: "static-code", prompt: functions[0]?.prompt || "" }
          : { fieldId: fieldId || "description", prompt: prompt || conditionPrompt, conditionPrompt, actionPrompt, actionFieldId }
        : { fieldId: fieldId || "description", prompt, enableTools };

      if (isPostFunction) {
        result = await invoke("registerPostFunction", {
          id: ruleId,
          type: ruleType,
          ...configPayload,
          functions: ruleType === "postfunction-static" ? functions : [],
          workflow: workflowData,
        });
      } else {
        result = await invoke("registerConfig", {
          id: ruleId,
          type: ruleType,
          ...configPayload,
          workflow: workflowData,
        });
      }

      if (!result.success) {
        setError(result.error || "Failed to save rule config");
        setSaving(false);
        return;
      }

      // Step B: Inject the rule into the actual Jira workflow
      const injectResult = await invoke("injectWorkflowRule", {
        workflowName: selectedWorkflow.name,
        transitionId: selectedTransition.id,
        ruleType,
        config: JSON.stringify(configPayload),
      });

      if (injectResult.success) {
        if (onCreated) onCreated();
        setCreated(true);
      } else {
        // Config was saved but injection failed — show warning, don't close
        setError(`Rule config saved, but could not inject into workflow: ${injectResult.error}. You can add it manually from the Jira workflow editor.`);
      }
    } catch (e) {
      setError("Failed to save: " + e.message);
    }
    setSaving(false);
  };

  const fieldOptions = fields.map((f) => ({ value: f.id, label: `${f.name} (${f.id})` }));

  const goToStep = (targetStep) => {
    if (targetStep >= step) return; // can only go back
    if (targetStep <= 0) return;
    setStep(targetStep);
    if (targetStep <= 1) { setSelectedProject(null); setSelectedWorkflow(null); setSelectedTransition(null); setRuleType(null); }
    if (targetStep <= 2) { setSelectedWorkflow(null); setSelectedTransition(null); setRuleType(null); }
    if (targetStep <= 3) { setSelectedTransition(null); setRuleType(null); }
    if (targetStep <= 4) { setRuleType(null); }
  };

  const stepLabel = (num, label) => (
    <span
      className={step > num ? "wiz-step-done" : step === num ? "wiz-step-active" : "wiz-step-future"}
      onClick={() => goToStep(num)}
    >
      {num}. {label}
    </span>
  );

  if (created) {
    return (
      <div className="card wizard">
        <div className="wiz-success">
          <div className="wiz-success-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--success-color)" strokeWidth="2">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <div className="wiz-success-title">Rule Created</div>
          <div className="wiz-success-text">
            {RULE_TYPE_OPTIONS.find((o) => o.value === ruleType)?.label} has been added to{" "}
            <strong>{selectedTransition?.name}</strong> on {selectedWorkflow?.name}.
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="btn-small" onClick={onClose}>Done</button>
            <button className="btn-small btn-edit" onClick={() => {
              setCreated(false); setStep(1); setSubmitted(false);
              setSelectedProject(null); setSelectedWorkflow(null); setSelectedTransition(null); setRuleType(null);
              setFieldId(""); setPrompt(""); setConditionPrompt(""); setActionPrompt(""); setActionFieldId("");
              setTestResult(null); setTestIssue("");
              setFunctions([{ id: Date.now().toString(), name: "", prompt: "", code: "", variableName: "result1", operationType: "work_item_query", includeBackoff: false }]);
            }}>Add Another Rule</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card wizard">
      {/* Header */}
      <div className="wizard-header">
        <div className="wizard-header-left">
          <div className="wizard-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <div>
            <h3 className="wizard-title">Add New Rule</h3>
            <p className="wizard-subtitle">
              {step <= 3 ? "Select where to add the rule" : step === 4 ? "Choose rule type" : "Configure the rule"}
            </p>
          </div>
        </div>
        <button className="btn-small" onClick={onClose}>Cancel</button>
      </div>

      <div className="wizard-body">
        {/* Breadcrumb */}
        <div className="wizard-breadcrumb">
          {stepLabel(1, "Project")}
          <span className="wiz-sep">/</span>
          {stepLabel(2, "Workflow")}
          <span className="wiz-sep">/</span>
          {stepLabel(3, "Transition")}
          <span className="wiz-sep">/</span>
          {stepLabel(4, "Type")}
          <span className="wiz-sep">/</span>
          {stepLabel(5, "Configure")}
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: "12px" }}>
            <span>{error}</span>
            <button className="alert-dismiss" onClick={() => setError(null)}>&times;</button>
          </div>
        )}

        {/* Step 1: Project */}
        {step >= 1 && (
          <div style={{ marginBottom: step > 1 ? "8px" : "0" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
              Project
            </label>
            {step === 1 ? (
              loadingProjects ? (
                <div className="sk sk-block" style={{ height: 36 }} />
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "6px" }}>
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleProjectSelect(p)}
                      style={{
                        display: "flex", alignItems: "center", gap: "10px",
                        padding: "10px 14px", border: "1px solid var(--border-color)",
                        borderRadius: "8px", background: "var(--input-bg)", color: "var(--text-color)",
                        cursor: "pointer", transition: "all 0.15s ease", fontSize: "13px", textAlign: "left",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary-color)"; e.currentTarget.style.background = "var(--hover-bg)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-color)"; e.currentTarget.style.background = "var(--input-bg)"; }}
                    >
                      {p.avatarUrl ? (
                        <img src={p.avatarUrl} alt="" style={{ width: 24, height: 24, borderRadius: 6 }} />
                      ) : (
                        <span style={{
                          width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                          background: "rgba(37,99,235,0.12)", color: "var(--primary-color)", fontSize: "10px", fontWeight: 700,
                        }}>{p.key.substring(0, 2)}</span>
                      )}
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 600, lineHeight: 1.2 }}>{p.name}</span>
                        <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{p.key}</span>
                      </div>
                    </button>
                  ))}
                  {projects.length === 0 && <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>No projects found</span>}
                </div>
              )
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <code className="field-id">{selectedProject?.key}</code>
                <span style={{ fontSize: "12px" }}>{selectedProject?.name}</span>
                <button className="btn-small" onClick={() => { setStep(1); setSelectedProject(null); setSelectedWorkflow(null); setSelectedTransition(null); setRuleType(null); }} style={{ fontSize: "10px", padding: "2px 6px" }}>Change</button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Workflow */}
        {step >= 2 && (
          <div style={{ marginBottom: step > 2 ? "8px" : "0" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
              Workflow
            </label>
            {step === 2 ? (
              loadingWorkflows ? (
                <div className="sk sk-block" style={{ height: 36 }} />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {workflows.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => handleWorkflowSelect(w)}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        width: "100%", padding: "10px 14px", border: "1px solid var(--border-color)",
                        borderRadius: "8px", background: "var(--input-bg)", color: "var(--text-color)",
                        cursor: "pointer", transition: "all 0.15s ease", fontSize: "13px",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary-color)"; e.currentTarget.style.background = "var(--hover-bg)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-color)"; e.currentTarget.style.background = "var(--input-bg)"; }}
                    >
                      <span style={{ fontWeight: 600 }}>{w.name}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{w.transitionCount} transitions</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ opacity: 0.5 }}>
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </div>
                    </button>
                  ))}
                  {workflows.length === 0 && <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>No workflows found for this project</span>}
                </div>
              )
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "12px" }}>{selectedWorkflow?.name}</span>
                <button className="btn-small" onClick={() => { setStep(2); setSelectedWorkflow(null); setSelectedTransition(null); setRuleType(null); }} style={{ fontSize: "10px", padding: "2px 6px" }}>Change</button>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Transition */}
        {step >= 3 && (
          <div style={{ marginBottom: step > 3 ? "8px" : "0" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
              Transition
            </label>
            {step === 3 ? (
              loadingTransitions ? (
                <div className="sk sk-block" style={{ height: 36 }} />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {transitions.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleTransitionSelect(t)}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        width: "100%", padding: "10px 14px", border: "1px solid var(--border-color)",
                        borderRadius: "8px", background: "var(--input-bg)", color: "var(--text-color)",
                        cursor: "pointer", transition: "all 0.15s ease", fontSize: "13px",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary-color)"; e.currentTarget.style.background = "var(--hover-bg)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-color)"; e.currentTarget.style.background = "var(--input-bg)"; }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span style={{ fontWeight: 600 }}>{t.name}</span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--text-muted)" }}>
                          <span style={{
                            padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 500,
                            background: t.type === "initial" ? "rgba(22,163,106,0.1)" : "rgba(100,116,139,0.1)",
                            color: t.type === "initial" ? "var(--success-color)" : "var(--text-secondary)",
                          }}>
                            {t.fromName || "Any"}
                          </span>
                          <span style={{ color: "var(--text-muted)" }}>&rarr;</span>
                          <span style={{
                            padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 500,
                            background: "rgba(37,99,235,0.1)", color: "var(--primary-color)",
                          }}>
                            {t.toName || "?"}
                          </span>
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        {(t.hasCogniValidator || t.hasCogniCondition || t.hasCogniPostFunction) && (
                          <span style={{
                            fontSize: "9px", padding: "2px 6px", borderRadius: "4px", fontWeight: 600,
                            background: "rgba(37,99,235,0.12)", color: "var(--primary-color)", letterSpacing: "0.3px",
                          }}>
                            COGNIRUNNER
                          </span>
                        )}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ opacity: 0.5 }}>
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </div>
                    </button>
                  ))}
                  {transitions.length === 0 && <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>No transitions found</span>}
                </div>
              )
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "12px" }}>{selectedTransition?.name}</span>
                <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>({selectedTransition?.fromName} &rarr; {selectedTransition?.toName})</span>
                <button className="btn-small" onClick={() => { setStep(3); setSelectedTransition(null); setRuleType(null); }} style={{ fontSize: "10px", padding: "2px 6px" }}>Change</button>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Rule type */}
        {step >= 4 && (
          <div style={{ marginBottom: step > 4 ? "8px" : "0" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
              Rule Type
            </label>
            {step === 4 ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {RULE_TYPE_OPTIONS.map((opt) => {
                  const badgeClass = opt.value.startsWith("postfunction") ? "type-postfunction"
                    : opt.value === "condition" ? "type-condition" : "type-validator";
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleTypeSelect(opt.value)}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "6px",
                        padding: "14px 16px", border: "1px solid var(--border-color)",
                        borderRadius: "8px", background: "var(--input-bg)", color: "var(--text-color)",
                        cursor: "pointer", transition: "all 0.15s ease", textAlign: "left",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary-color)"; e.currentTarget.style.background = "var(--hover-bg)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-color)"; e.currentTarget.style.background = "var(--input-bg)"; }}
                    >
                      <span className={`type-badge ${badgeClass}`} style={{ fontSize: "9px" }}>{opt.label}</span>
                      <span style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.3 }}>{opt.desc}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className={`type-badge type-${ruleType?.startsWith("postfunction") ? "postfunction" : ruleType}`}>
                  {RULE_TYPE_OPTIONS.find((o) => o.value === ruleType)?.label}
                </span>
                <button className="btn-small" onClick={() => { setStep(4); setRuleType(null); }} style={{ fontSize: "10px", padding: "2px 6px" }}>Change</button>
              </div>
            )}
          </div>
        )}

        {/* Step 5: Config */}
        {step === 5 && (
          <div style={{ marginTop: "12px", borderTop: "1px solid var(--border-color)", paddingTop: "12px" }}>
            {/* Validator / Condition config */}
            {(ruleType === "validator" || ruleType === "condition") && (
              <>
                {/* Info banner */}
                <div style={{
                  display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", marginBottom: "14px",
                  borderRadius: "8px", border: "1px solid var(--border-color)", background: "var(--input-bg)",
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ruleType === "condition" ? "var(--success-color)" : "var(--primary-color)"} strokeWidth="2">
                    {ruleType === "condition"
                      ? <><circle cx="12" cy="12" r="10" /><path d="M8 12l2 2 4-4" /></>
                      : <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    }
                  </svg>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                    {ruleType === "condition"
                      ? "Hides or shows the transition button based on AI evaluation. Does not block — just controls visibility."
                      : "Blocks the transition if the AI determines the field content does not meet your criteria."
                    }
                  </div>
                </div>

                {/* Field selector */}
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                    Field to Validate <span style={{ color: "var(--error-color)" }}>*</span>
                  </label>
                  {loadingFields ? (
                    <div className="sk sk-block" style={{ height: 36 }} />
                  ) : (
                    <CustomSelect
                      value={fieldId}
                      onChange={setFieldId}
                      placeholder="Select a field..."
                      searchable
                      searchPlaceholder="Search fields..."
                      options={fieldOptions}
                    />
                  )}
                  <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "var(--text-muted)" }}>
                    Select the field whose value will be validated by AI on each transition.
                  </p>
                </div>

                {/* Prompt */}
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                    Validation Prompt <span style={{ color: "var(--error-color)" }}>*</span>
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={ruleType === "condition"
                      ? "When should this transition be visible? E.g. 'Show only when the description contains acceptance criteria'"
                      : "Describe what makes the field value valid. E.g. 'The description must include steps to reproduce, expected behavior, and actual behavior'"
                    }
                    rows={5}
                    className={`wiz-textarea${submitted && !prompt.trim() ? " wiz-error" : ""}`}
                  />
                  <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "var(--text-muted)" }}>
                    Describe the validation criteria in natural language. The AI will evaluate if the field content meets these requirements.
                  </p>
                </div>

                {/* JQL / Agentic toggle */}
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                    Jira Search (JQL)
                  </label>
                  <div style={{ maxWidth: "280px" }}>
                    <CustomSelect
                      value={enableTools === null ? "auto" : enableTools ? "on" : "off"}
                      onChange={(v) => setEnableTools(v === "auto" ? null : v === "on")}
                      options={[
                        { value: "auto", label: "Auto-detect from prompt" },
                        { value: "on", label: "Always enabled" },
                        { value: "off", label: "Always disabled" },
                      ]}
                    />
                  </div>
                  <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "var(--text-muted)" }}>
                    When enabled, the AI can search Jira for similar or related issues during validation (e.g. duplicate detection). Auto-detect activates this when your prompt mentions duplicates, similarity, or existing issues.
                  </p>
                </div>

                {/* Test Run */}
                <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "12px", marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                    Test Validation
                  </label>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      type="text"
                      value={testIssue}
                      onChange={(e) => setTestIssue(e.target.value.toUpperCase())}
                      placeholder="Issue key (e.g. WFH-36)"
                      className="wiz-input wiz-input-mono"
                      style={{ flex: 1 }}
                    />
                    <button
                      className="btn-small btn-edit"
                      disabled={testRunning || !testIssue.trim() || !fieldId || !prompt.trim()}
                      onClick={async () => {
                        setTestRunning(true);
                        setTestResult(null);
                        try {
                          const result = await invoke("testValidation", {
                            issueKey: testIssue.trim(),
                            fieldId,
                            prompt,
                            enableTools,
                          });
                          setTestResult(result);
                        } catch (e) {
                          setTestResult({ success: false, error: e.message });
                        }
                        setTestRunning(false);
                      }}
                    >
                      {testRunning ? "Running..." : "Run Test"}
                    </button>
                  </div>
                  <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "var(--text-muted)" }}>
                    Dry run — no transition is blocked. Tests the validation against a real issue.
                  </p>

                  {testResult && (
                    <div style={{
                      marginTop: "8px", padding: "10px 12px", borderRadius: "8px",
                      border: `1px solid ${testResult.success ? (testResult.isValid ? "var(--success-color)" : "var(--error-color)") : "var(--error-color)"}`,
                      background: testResult.success ? (testResult.isValid ? "rgba(22,163,106,0.06)" : "rgba(220,38,38,0.06)") : "rgba(220,38,38,0.06)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span className={`type-badge ${testResult.success && testResult.isValid ? "type-condition" : "type-validator"}`} style={{ fontSize: "9px" }}>
                          {testResult.success ? (testResult.isValid ? "PASS" : "FAIL") : "ERROR"}
                        </span>
                        {testResult.issueKey && <span style={{ fontSize: "12px", fontWeight: 600 }}>{testResult.issueKey}</span>}
                        {testResult.executionTimeMs && <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{testResult.executionTimeMs}ms</span>}
                        <button style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "16px" }} onClick={() => setTestResult(null)}>&times;</button>
                      </div>
                      {testResult.error && !testResult.success && (
                        <div style={{ fontSize: "12px", color: "var(--error-color)", marginBottom: "4px" }}>{testResult.error}</div>
                      )}
                      {testResult.reason && (
                        <div style={{ fontSize: "12px", color: "var(--text-color)" }}>
                          <span style={{ fontWeight: 600, fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>AI Reasoning</span>
                          <div style={{ marginTop: "2px" }}>{testResult.reason}</div>
                        </div>
                      )}
                      {testResult.fieldValue && (
                        <div style={{ marginTop: "6px" }}>
                          <span style={{ fontWeight: 600, fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>Field Value</span>
                          <pre style={{ margin: "2px 0 0 0", fontSize: "11px", padding: "6px 8px", background: "var(--code-bg)", borderRadius: "4px", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: "100px", overflow: "auto" }}>{testResult.fieldValue}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Semantic PF config */}
            {ruleType === "postfunction-semantic" && (
              <>
                {/* How it works */}
                <div style={{
                  padding: "10px 14px", marginBottom: "14px", borderRadius: "8px",
                  border: "1px solid var(--border-color)", background: "var(--input-bg)",
                }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>How it works</div>
                  <ol style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    <li><strong style={{ color: "var(--primary-color)" }}>Condition</strong> — AI checks if this rule should fire</li>
                    <li><strong style={{ color: "var(--success-color)" }}>Action</strong> — If yes, AI generates a new value for the target field</li>
                    <li>The target field is updated automatically after each transition</li>
                  </ol>
                </div>

                {/* Condition Prompt */}
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                    Condition <span style={{ color: "var(--error-color)" }}>*</span>
                  </label>
                  <textarea
                    value={conditionPrompt}
                    onChange={(e) => setConditionPrompt(e.target.value)}
                    placeholder='E.g. "Run every time" or "Run when the description mentions a bug or defect"'
                    rows={4}
                    className={`wiz-textarea${submitted && !conditionPrompt.trim() ? " wiz-error" : ""}`}
                  />
                  <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "var(--text-muted)" }}>
                    The AI reads the source field and evaluates this condition. If met, the action runs. If not, the post-function is skipped.
                  </p>
                </div>

                {/* Action Prompt */}
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                    Action
                  </label>
                  <textarea
                    value={actionPrompt}
                    onChange={(e) => setActionPrompt(e.target.value)}
                    placeholder='E.g. "Summarize the issue into 2-3 bullet points" or "Append a review checklist"'
                    rows={5}
                    className="wiz-textarea"
                  />
                  <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "var(--text-muted)" }}>
                    When the condition passes, the AI generates a new value for the target field based on this instruction. Leave empty for generic summarization.
                  </p>
                </div>

                {/* Target Field */}
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                    Target Field <span style={{ color: "var(--error-color)" }}>*</span>
                  </label>
                  {loadingFields ? <div className="sk sk-block" style={{ height: 36 }} /> : (
                    <CustomSelect value={actionFieldId} onChange={setActionFieldId} placeholder="Select target field..." searchable searchPlaceholder="Search fields..." error={submitted && !actionFieldId} options={fieldOptions} />
                  )}
                  <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "var(--text-muted)" }}>
                    The AI will update this field when the condition is met. Works best with text-based fields.
                  </p>
                </div>

                {/* Test Run */}
                <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "12px", marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                    Test Run
                  </label>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      type="text"
                      value={testIssue}
                      onChange={(e) => setTestIssue(e.target.value.toUpperCase())}
                      placeholder="Issue key (e.g. WFH-36)"
                      className="wiz-input wiz-input-mono"
                      style={{ flex: 1 }}
                    />
                    <button
                      className="btn-small btn-edit"
                      disabled={testRunning || !testIssue.trim() || !conditionPrompt.trim()}
                      onClick={async () => {
                        setTestRunning(true);
                        setTestResult(null);
                        try {
                          const result = await invoke("testSemanticPostFunction", {
                            issueKey: testIssue.trim(),
                            fieldId: fieldId || "description",
                            conditionPrompt,
                            actionPrompt,
                            actionFieldId,
                          });
                          setTestResult(result);
                        } catch (e) {
                          setTestResult({ success: false, error: e.message });
                        }
                        setTestRunning(false);
                      }}
                    >
                      {testRunning ? "Running..." : "Run Test"}
                    </button>
                  </div>
                  <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "var(--text-muted)" }}>
                    Dry run — the field is NOT updated. Tests the AI decision against a real issue.
                  </p>

                  {testResult && (
                    <div style={{
                      marginTop: "8px", padding: "10px 12px", borderRadius: "8px",
                      border: `1px solid ${testResult.success ? (testResult.decision === "UPDATE" ? "var(--success-color)" : "var(--primary-color)") : "var(--error-color)"}`,
                      background: testResult.success ? (testResult.decision === "UPDATE" ? "rgba(22,163,106,0.06)" : "rgba(37,99,235,0.06)") : "rgba(220,38,38,0.06)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span className={`type-badge ${testResult.success ? (testResult.decision === "UPDATE" ? "type-condition" : "type-validator") : "type-validator"}`} style={{ fontSize: "9px" }}>
                          {testResult.success ? testResult.decision : "ERROR"}
                        </span>
                        {testResult.issueKey && <span style={{ fontSize: "12px", fontWeight: 600 }}>{testResult.issueKey}</span>}
                        {testResult.executionTimeMs && <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{testResult.executionTimeMs}ms</span>}
                        {testResult.tokensUsed && <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{testResult.tokensUsed} tokens</span>}
                        <button style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "16px" }} onClick={() => setTestResult(null)}>&times;</button>
                      </div>

                      {testResult.error && !testResult.success && (
                        <div style={{ fontSize: "12px", color: "var(--error-color)", marginBottom: "4px" }}>{testResult.error}</div>
                      )}

                      {testResult.reason && (
                        <div style={{ fontSize: "12px", color: "var(--text-color)", marginBottom: "6px" }}>
                          <span style={{ fontWeight: 600, fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>AI Reasoning</span>
                          <div style={{ marginTop: "2px" }}>{testResult.reason}</div>
                        </div>
                      )}

                      {testResult.sourceValue && (
                        <div style={{ marginBottom: "6px" }}>
                          <span style={{ fontWeight: 600, fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>Source Field ({testResult.sourceField})</span>
                          <pre style={{ margin: "2px 0 0 0", fontSize: "11px", padding: "6px 8px", background: "var(--code-bg)", borderRadius: "4px", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: "80px", overflow: "auto" }}>{testResult.sourceValue}</pre>
                        </div>
                      )}

                      {testResult.decision === "UPDATE" && testResult.proposedValue !== undefined && (
                        <div style={{ marginBottom: "6px" }}>
                          <span style={{ fontWeight: 600, fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>Proposed Value for {testResult.targetField}</span>
                          <pre style={{ margin: "2px 0 0 0", fontSize: "11px", padding: "6px 8px", background: "var(--code-bg)", borderRadius: "4px", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: "100px", overflow: "auto" }}>{typeof testResult.proposedValue === "string" ? testResult.proposedValue : JSON.stringify(testResult.proposedValue, null, 2)}</pre>
                          <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "var(--text-muted)", fontStyle: "italic" }}>Dry run — field was NOT updated</p>
                        </div>
                      )}

                      {testResult.logs && testResult.logs.length > 0 && (
                        <details style={{ marginTop: "4px" }}>
                          <summary style={{ fontSize: "10px", color: "var(--text-muted)", cursor: "pointer" }}>Execution log ({testResult.logs.length} entries)</summary>
                          <div style={{ marginTop: "4px", maxHeight: "120px", overflow: "auto" }}>
                            {testResult.logs.map((log, i) => (
                              <div key={i} style={{ fontSize: "10px", fontFamily: "SFMono-Regular, Consolas, monospace", color: "var(--text-secondary)", padding: "1px 0" }}>{log}</div>
                            ))}
                          </div>
                        </details>
                      )}

                      {testResult.recommendation && (
                        <div style={{ marginTop: "6px", padding: "6px 8px", borderRadius: "4px", borderLeft: "3px solid var(--primary-color)", background: "rgba(37,99,235,0.06)", fontSize: "11px", whiteSpace: "pre-line" }}>
                          {testResult.recommendation}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Static PF — function builder */}
            {ruleType === "postfunction-static" && (
              <>
                {/* How it works */}
                <div style={{
                  padding: "10px 14px", marginBottom: "14px", borderRadius: "8px",
                  border: "1px solid var(--border-color)", background: "var(--input-bg)",
                }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>How it works</div>
                  <ol style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    <li>Describe what each step should do in plain English</li>
                    <li>AI generates the JavaScript code for each step</li>
                    <li>Code runs on every transition — <strong>no AI cost at runtime</strong></li>
                  </ol>
                </div>

                {/* Function steps */}
                {functions.map((fn, idx) => {
                  const priorSteps = functions.slice(0, idx).filter((f) => f.variableName).map((f, i) => ({
                    step: i + 1, variable: f.variableName, name: f.name || `Step ${i + 1}`, description: f.prompt || "",
                  }));
                  return (
                    <div key={fn.id} className="wiz-step-card">
                      {/* Step header */}
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderBottom: "1px solid var(--border-color)" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--primary-color)", background: "rgba(37,99,235,0.1)", padding: "2px 8px", borderRadius: "4px" }}>#{idx + 1}</span>
                        <input
                          type="text"
                          value={fn.name}
                          onChange={(e) => { const u = [...functions]; u[idx] = { ...fn, name: e.target.value }; setFunctions(u); }}
                          placeholder={`Step ${idx + 1} name (optional)`}
                          style={{ flex: 1, padding: "4px 8px", border: "1px solid transparent", borderRadius: "4px", background: "transparent", color: "var(--text-color)", fontSize: "13px", fontWeight: 600 }}
                          onFocus={(e) => { e.target.style.borderColor = "var(--border-color)"; e.target.style.background = "var(--input-bg)"; }}
                          onBlur={(e) => { e.target.style.borderColor = "transparent"; e.target.style.background = "transparent"; }}
                        />
                        {functions.length > 1 && (
                          <button
                            style={{ background: "none", border: "none", color: "var(--error-color)", cursor: "pointer", fontSize: "16px", padding: "2px 6px" }}
                            onClick={() => setFunctions(functions.filter((_, i) => i !== idx))}
                            title="Remove step"
                          >&times;</button>
                        )}
                      </div>

                      <div style={{ padding: "12px 14px" }}>
                        {/* Prior variables */}
                        {priorSteps.length > 0 && (
                          <div style={{ marginBottom: "10px", padding: "6px 10px", borderRadius: "6px", background: "rgba(37,99,235,0.04)", border: "1px solid rgba(37,99,235,0.1)" }}>
                            <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Available from prior steps</span>
                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
                              {priorSteps.map((ps) => (
                                <code key={ps.variable} style={{ fontSize: "11px", padding: "2px 6px", borderRadius: "3px", background: "var(--code-bg)", color: "var(--primary-color)" }}>
                                  {"${" + ps.variable + "}"}
                                </code>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Description */}
                        <div style={{ marginBottom: "10px" }}>
                          <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "4px" }}>
                            What should this step do?
                          </label>
                          <textarea
                            value={fn.prompt}
                            onChange={(e) => { const u = [...functions]; u[idx] = { ...fn, prompt: e.target.value }; setFunctions(u); }}
                            placeholder="E.g. 'Find all issues in this project with the same summary and add a comment linking to them'"
                            rows={3}
                            style={{ width: "100%", fontSize: "12px", padding: "8px 10px", border: "1px solid var(--border-color)", borderRadius: "6px", background: "var(--input-bg)", color: "var(--text-color)", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
                          />
                        </div>

                        {/* Operation type */}
                        <div style={{ marginBottom: "10px" }}>
                          <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "4px" }}>
                            Operation Type
                          </label>
                          <div style={{ maxWidth: "240px" }}>
                            <CustomSelect
                              value={fn.operationType}
                              onChange={(v) => { const u = [...functions]; u[idx] = { ...fn, operationType: v }; setFunctions(u); }}
                              options={[
                                { value: "work_item_query", label: "JQL Search", meta: "Search Jira issues" },
                                { value: "rest_api_internal", label: "Jira REST API", meta: "Call any Jira endpoint" },
                                { value: "rest_api_external", label: "External API", meta: "Call external HTTP" },
                                { value: "confluence_api", label: "Confluence API", meta: "Read/write pages" },
                                { value: "log_function", label: "Debug Log", meta: "Log for troubleshooting" },
                              ]}
                            />
                          </div>
                        </div>

                        {/* Operation-specific fields */}
                        {fn.operationType === "rest_api_internal" && (
                          <div style={{ marginBottom: "10px" }}>
                            <label className="wiz-label" style={{ fontSize: "11px" }}>HTTP Method</label>
                            <div style={{ maxWidth: "160px" }}>
                              <CustomSelect
                                value={fn.method || "GET"}
                                onChange={(v) => { const u = [...functions]; u[idx] = { ...fn, method: v }; setFunctions(u); }}
                                options={[
                                  { value: "GET", label: "GET" },
                                  { value: "POST", label: "POST" },
                                  { value: "PUT", label: "PUT" },
                                  { value: "DELETE", label: "DELETE" },
                                  { value: "PATCH", label: "PATCH" },
                                ]}
                              />
                            </div>
                            <div style={{ marginTop: "6px" }}>
                              <label className="wiz-label" style={{ fontSize: "11px" }}>Endpoint Path</label>
                              <input
                                type="text"
                                className="wiz-input"
                                value={fn.endpoint || ""}
                                onChange={(e) => { const u = [...functions]; u[idx] = { ...fn, endpoint: e.target.value }; setFunctions(u); }}
                                placeholder="/rest/api/3/issue/{issueIdOrKey}"
                                style={{ width: "100%" }}
                              />
                            </div>
                          </div>
                        )}
                        {fn.operationType === "rest_api_external" && (
                          <div style={{ marginBottom: "10px" }}>
                            <label className="wiz-label" style={{ fontSize: "11px" }}>External URL</label>
                            <input
                              type="text"
                              className="wiz-input"
                              value={fn.endpoint || ""}
                              onChange={(e) => { const u = [...functions]; u[idx] = { ...fn, endpoint: e.target.value }; setFunctions(u); }}
                              placeholder="https://api.example.com/webhook"
                              style={{ width: "100%" }}
                            />
                            <p className="wiz-hint">The domain must be whitelisted in manifest.yml</p>
                          </div>
                        )}
                        {fn.operationType === "confluence_api" && (
                          <div style={{ marginBottom: "10px" }}>
                            <label className="wiz-label" style={{ fontSize: "11px" }}>Confluence Operation</label>
                            <div style={{ maxWidth: "200px" }}>
                              <CustomSelect
                                value={fn.confluenceOp || "GET_PAGE"}
                                onChange={(v) => { const u = [...functions]; u[idx] = { ...fn, confluenceOp: v }; setFunctions(u); }}
                                options={[
                                  { value: "GET_PAGE", label: "Get Page" },
                                  { value: "UPDATE_PAGE", label: "Update Page" },
                                  { value: "CREATE_PAGE", label: "Create Page" },
                                  { value: "DELETE_PAGE", label: "Delete Page" },
                                  { value: "ADD_COMMENT", label: "Add Comment" },
                                ]}
                              />
                            </div>
                            <div style={{ marginTop: "6px" }}>
                              <label className="wiz-label" style={{ fontSize: "11px" }}>Space Key</label>
                              <input
                                type="text"
                                className="wiz-input"
                                value={fn.spaceKey || ""}
                                onChange={(e) => { const u = [...functions]; u[idx] = { ...fn, spaceKey: e.target.value }; setFunctions(u); }}
                                placeholder="e.g. ENG"
                                style={{ width: "120px" }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Variable name (hidden for log_function) */}
                        {fn.operationType !== "log_function" && (
                          <div style={{ marginBottom: "10px" }}>
                            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "4px" }}>
                              Result Variable
                            </label>
                            <input
                              type="text"
                              value={fn.variableName}
                              onChange={(e) => { const u = [...functions]; u[idx] = { ...fn, variableName: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") }; setFunctions(u); }}
                              placeholder={`result${idx + 1}`}
                              style={{ width: "160px", padding: "6px 10px", border: "1px solid var(--border-color)", borderRadius: "6px", background: "var(--input-bg)", color: "var(--text-color)", fontSize: "12px", fontFamily: "SFMono-Regular, Consolas, monospace" }}
                            />
                            <span style={{ fontSize: "10px", color: "var(--text-muted)", marginLeft: "8px" }}>
                              Next steps can use {"${" + (fn.variableName || `result${idx + 1}`) + "}"}
                            </span>
                          </div>
                        )}

                        {/* Backoff toggle */}
                        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-secondary)", cursor: "pointer", marginBottom: "10px" }}>
                          <input
                            type="checkbox"
                            checked={fn.includeBackoff}
                            onChange={(e) => { const u = [...functions]; u[idx] = { ...fn, includeBackoff: e.target.checked }; setFunctions(u); }}
                          />
                          Exponential backoff with jitter (up to 3 retries)
                        </label>

                        {/* Generate code button */}
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <button
                            className="btn-small btn-edit"
                            disabled={!fn.prompt.trim() || generatingCode === fn.id}
                            onClick={async () => {
                              setGeneratingCode(fn.id);
                              try {
                                const result = await invoke("generatePostFunctionCode", {
                                  prompt: fn.prompt,
                                  operationType: fn.operationType,
                                  endpoint: fn.endpoint || "",
                                  method: fn.method || "GET",
                                  includeBackoff: fn.includeBackoff,
                                  priorSteps,
                                });
                                if (result.success && result.code) {
                                  const u = [...functions]; u[idx] = { ...fn, code: result.code }; setFunctions(u);
                                } else {
                                  setError(result.error || "Code generation failed");
                                }
                              } catch (e) {
                                setError("Code generation failed: " + e.message);
                              }
                              setGeneratingCode(null);
                            }}
                          >
                            {generatingCode === fn.id ? "Generating..." : fn.code ? "Regenerate Code" : "Generate Code"}
                          </button>
                          {!fn.prompt.trim() && (
                            <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>Describe what this step does first</span>
                          )}
                        </div>

                        {/* Generated code display */}
                        {fn.code && (
                          <div style={{ marginTop: "10px" }}>
                            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "4px" }}>
                              Generated Code
                            </label>
                            <textarea
                              value={fn.code}
                              onChange={(e) => { const u = [...functions]; u[idx] = { ...fn, code: e.target.value }; setFunctions(u); }}
                              rows={12}
                              style={{
                                width: "100%", padding: "10px 12px", border: "1px solid var(--border-color)", borderRadius: "6px",
                                background: "var(--code-bg)", color: "var(--text-color)", fontSize: "12px", lineHeight: 1.5,
                                fontFamily: "SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace", resize: "vertical", tabSize: 2,
                              }}
                              spellCheck={false}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Add step button */}
                <button
                  className="btn-small"
                  disabled={functions.length >= 50}
                  onClick={() => {
                    const nextNum = functions.length + 1;
                    setFunctions([...functions, {
                      id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                      name: "", prompt: "", code: "", variableName: `result${nextNum}`,
                      operationType: "work_item_query", includeBackoff: false,
                    }]);
                  }}
                  style={{ width: "100%", padding: "8px", marginBottom: "14px" }}
                >
                  + Add Another Step {functions.length >= 50 && "(max 50)"}
                </button>

                {/* Test Run */}
                <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "12px", marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                    Test Run
                  </label>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      type="text"
                      value={testIssue}
                      onChange={(e) => setTestIssue(e.target.value.toUpperCase())}
                      placeholder="Issue key (optional for static PF)"
                      className="wiz-input wiz-input-mono"
                      style={{ flex: 1 }}
                    />
                    <button
                      className="btn-small btn-edit"
                      disabled={testRunning || !functions.some((f) => f.code)}
                      onClick={async () => {
                        setTestRunning(true);
                        setTestResult(null);
                        try {
                          // Combine all function code blocks
                          const allCode = functions.filter((f) => f.code).map((f) => f.code).join("\n\n// --- Next Step ---\n\n");
                          const result = await invoke("testPostFunction", {
                            code: allCode,
                            issueKey: testIssue.trim() || undefined,
                          });
                          setTestResult(result);
                        } catch (e) {
                          setTestResult({ success: false, logs: [`Error: ${e.message}`] });
                        }
                        setTestRunning(false);
                      }}
                    >
                      {testRunning ? "Running..." : "Run Test"}
                    </button>
                  </div>
                  <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "var(--text-muted)" }}>
                    Dry run — reads are real, writes are simulated. Generate code first.
                  </p>

                  {testResult && (
                    <div style={{
                      marginTop: "8px", padding: "10px 12px", borderRadius: "8px",
                      border: `1px solid ${testResult.success ? "var(--success-color)" : "var(--error-color)"}`,
                      background: testResult.success ? "rgba(22,163,106,0.06)" : "rgba(220,38,38,0.06)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span className={`type-badge ${testResult.success ? "type-condition" : "type-validator"}`} style={{ fontSize: "9px" }}>
                          {testResult.success ? "PASS" : "ERROR"}
                        </span>
                        {testResult.executionTimeMs && <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{testResult.executionTimeMs}ms</span>}
                        <button style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "16px" }} onClick={() => setTestResult(null)}>&times;</button>
                      </div>
                      {testResult.logs && testResult.logs.length > 0 && (
                        <div style={{ maxHeight: "200px", overflow: "auto" }}>
                          {testResult.logs.map((log, i) => (
                            <div key={i} style={{ fontSize: "11px", fontFamily: "SFMono-Regular, Consolas, monospace", color: "var(--text-secondary)", padding: "1px 0" }}>{log}</div>
                          ))}
                        </div>
                      )}
                      {testResult.changes && testResult.changes.length > 0 && (
                        <div style={{ marginTop: "6px" }}>
                          <span style={{ fontWeight: 600, fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>Simulated Changes (not applied)</span>
                          {testResult.changes.map((c, i) => (
                            <div key={i} style={{ fontSize: "11px", fontFamily: "SFMono-Regular, Consolas, monospace", color: "var(--text-secondary)", padding: "1px 0" }}>
                              {c.action}({c.key}{c.fields ? `, ${JSON.stringify(c.fields)}` : ""})
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

          </div>
        )}
      </div>

      {/* Footer */}
      {step === 5 && (
        <div className="wiz-footer">
          <span className="wiz-footer-hint">The rule will be registered and injected into the workflow transition automatically.</span>
          <div className="wiz-footer-actions">
            <button className="btn-small" onClick={onClose}>Cancel</button>
            <button
              className="btn-small btn-edit"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Creating..." : "Create Rule"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
