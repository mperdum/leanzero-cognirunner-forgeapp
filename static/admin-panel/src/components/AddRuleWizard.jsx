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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

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
    setLoadingFields(true);
    try {
      const result = await invoke("getFields");
      if (result.success) setFields(result.fields || []);
    } catch (e) { /* fields optional */ }
    setLoadingFields(false);
  };

  // Save the rule
  const handleSave = async () => {
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
        ? { fieldId: fieldId || "description", prompt: prompt || conditionPrompt, conditionPrompt, actionPrompt, actionFieldId }
        : { fieldId: fieldId || "description", prompt };

      if (isPostFunction) {
        result = await invoke("registerPostFunction", {
          id: ruleId,
          type: ruleType,
          ...configPayload,
          functions: [],
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
        onClose();
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
      style={{
        opacity: step >= num ? 1 : 0.4,
        fontWeight: step === num ? 700 : 400,
        cursor: step > num ? "pointer" : "default",
        textDecoration: step > num ? "underline" : "none",
        textDecorationColor: step > num ? "var(--primary-color)" : "transparent",
      }}
      onClick={() => goToStep(num)}
    >
      {num}. {label}
    </span>
  );

  return (
    <div className="card" style={{ marginBottom: "16px" }}>
      <div style={{ padding: "16px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ margin: 0, fontSize: "14px" }}>Add New Rule</h3>
          <button className="btn-small" onClick={onClose}>Cancel</button>
        </div>

        {/* Step indicators */}
        <div style={{ display: "flex", gap: "16px", marginBottom: "16px", fontSize: "12px", color: "var(--text-secondary)" }}>
          {stepLabel(1, "Project")}
          <span style={{ opacity: 0.3 }}>/</span>
          {stepLabel(2, "Workflow")}
          <span style={{ opacity: 0.3 }}>/</span>
          {stepLabel(3, "Transition")}
          <span style={{ opacity: 0.3 }}>/</span>
          {stepLabel(4, "Type")}
          <span style={{ opacity: 0.3 }}>/</span>
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
                      {p.avatarUrl && <img src={p.avatarUrl} alt="" style={{ width: 20, height: 20, borderRadius: 4 }} />}
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
                <div style={{ marginBottom: "12px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                    Field to Validate
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
                </div>
                <div style={{ marginBottom: "12px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                    Validation Prompt
                  </label>
                  <textarea
                    className="input"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={ruleType === "condition"
                      ? "When should this transition be visible? E.g. 'Show only when the description contains acceptance criteria'"
                      : "What should be validated? E.g. 'Description must contain steps to reproduce, expected and actual behavior'"
                    }
                    rows={4}
                    style={{ width: "100%", fontSize: "13px", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: "4px", background: "var(--input-bg)", color: "var(--text-color)", resize: "vertical" }}
                  />
                </div>
              </>
            )}

            {/* Semantic PF config */}
            {ruleType === "postfunction-semantic" && (
              <>
                <div style={{ marginBottom: "12px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                    Source Field
                  </label>
                  {loadingFields ? <div className="sk sk-block" style={{ height: 36 }} /> : (
                    <CustomSelect value={fieldId} onChange={setFieldId} placeholder="Select source field..." searchable options={fieldOptions} />
                  )}
                </div>
                <div style={{ marginBottom: "12px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                    Condition Prompt
                  </label>
                  <textarea
                    className="input"
                    value={conditionPrompt}
                    onChange={(e) => setConditionPrompt(e.target.value)}
                    placeholder="When should this run? E.g. 'Run every time' or 'Only when description mentions a bug'"
                    rows={3}
                    style={{ width: "100%", fontSize: "13px", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: "4px", background: "var(--input-bg)", color: "var(--text-color)", resize: "vertical" }}
                  />
                </div>
                <div style={{ marginBottom: "12px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                    Action Prompt
                  </label>
                  <textarea
                    className="input"
                    value={actionPrompt}
                    onChange={(e) => setActionPrompt(e.target.value)}
                    placeholder="What should the AI do? E.g. 'Summarize the description into the target field'"
                    rows={3}
                    style={{ width: "100%", fontSize: "13px", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: "4px", background: "var(--input-bg)", color: "var(--text-color)", resize: "vertical" }}
                  />
                </div>
                <div style={{ marginBottom: "12px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                    Target Field
                  </label>
                  {loadingFields ? <div className="sk sk-block" style={{ height: 36 }} /> : (
                    <CustomSelect value={actionFieldId} onChange={setActionFieldId} placeholder="Select target field..." searchable options={fieldOptions} />
                  )}
                </div>
              </>
            )}

            {/* Static PF — simplified, just a name for now */}
            {ruleType === "postfunction-static" && (
              <div style={{ padding: "12px", background: "var(--code-bg)", borderRadius: "4px", fontSize: "12px", color: "var(--text-secondary)" }}>
                Static post-functions are best configured in the workflow editor where the full code editor is available.
                This will create a placeholder rule. Edit it from the workflow to add function steps.
              </div>
            )}

            {/* Save */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
              <button className="btn-small" onClick={onClose}>Cancel</button>
              <button
                className="btn-small btn-edit"
                onClick={handleSave}
                disabled={saving || (ruleType === "validator" && !prompt) || (ruleType === "condition" && !prompt) || (ruleType === "postfunction-semantic" && !conditionPrompt)}
              >
                {saving ? "Saving..." : "Create Rule"}
              </button>
            </div>

            <p style={{ margin: "8px 0 0 0", fontSize: "11px", color: "var(--text-muted)" }}>
              The rule will be registered and injected into the workflow transition automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
