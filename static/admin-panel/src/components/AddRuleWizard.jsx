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
      const result = await invoke("getProjectWorkflows", { projectKey: project.key });
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
      let result;
      if (isPostFunction) {
        result = await invoke("registerPostFunction", {
          id: ruleId,
          type: ruleType,
          fieldId: fieldId || "description",
          prompt: prompt || conditionPrompt,
          conditionPrompt,
          actionPrompt,
          actionFieldId,
          functions: [],
          workflow: workflowData,
        });
      } else {
        result = await invoke("registerConfig", {
          id: ruleId,
          type: ruleType,
          fieldId: fieldId || "description",
          prompt,
          workflow: workflowData,
        });
      }

      if (result.success) {
        if (onCreated) onCreated();
        onClose();
      } else {
        setError(result.error || "Failed to save rule");
      }
    } catch (e) {
      setError("Failed to save: " + e.message);
    }
    setSaving(false);
  };

  const fieldOptions = fields.map((f) => ({ value: f.id, label: `${f.name} (${f.id})` }));

  const stepLabel = (num, label) => (
    <span style={{ opacity: step >= num ? 1 : 0.4, fontWeight: step === num ? 700 : 400 }}>
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
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      className="btn-small"
                      style={{ display: "flex", alignItems: "center", gap: "6px" }}
                      onClick={() => handleProjectSelect(p)}
                    >
                      {p.avatarUrl && <img src={p.avatarUrl} alt="" style={{ width: 16, height: 16, borderRadius: 3 }} />}
                      <span>{p.name}</span>
                      <code style={{ fontSize: "10px", opacity: 0.6 }}>{p.key}</code>
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
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {workflows.map((w) => (
                    <button
                      key={w.id}
                      className="btn-small"
                      style={{ textAlign: "left", justifyContent: "flex-start" }}
                      onClick={() => handleWorkflowSelect(w)}
                    >
                      {w.name}
                      <span style={{ fontSize: "10px", opacity: 0.5, marginLeft: 8 }}>{w.transitionCount} transitions</span>
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
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {transitions.map((t) => (
                    <button
                      key={t.id}
                      className="btn-small"
                      style={{ textAlign: "left", justifyContent: "flex-start", gap: "8px" }}
                      onClick={() => handleTransitionSelect(t)}
                    >
                      <span>{t.name}</span>
                      <span style={{ fontSize: "10px", opacity: 0.5 }}>
                        {t.fromName || "Any"} &rarr; {t.toName || "?"}
                      </span>
                      {(t.hasCogniValidator || t.hasCogniCondition || t.hasCogniPostFunction) && (
                        <span style={{ fontSize: "9px", padding: "1px 4px", borderRadius: 3, background: "rgba(37,99,235,0.1)", color: "var(--primary-color)" }}>
                          CogniRunner
                        </span>
                      )}
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
                {RULE_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className="btn-small"
                    style={{ textAlign: "left", padding: "10px 12px", flexDirection: "column", alignItems: "flex-start", gap: "2px" }}
                    onClick={() => handleTypeSelect(opt.value)}
                  >
                    <span style={{ fontWeight: 600 }}>{opt.label}</span>
                    <span style={{ fontSize: "10px", opacity: 0.6, fontWeight: 400 }}>{opt.desc}</span>
                  </button>
                ))}
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
              The rule will be registered in CogniRunner. To activate it on the workflow transition, an admin must add the CogniRunner module in the Jira workflow editor.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
