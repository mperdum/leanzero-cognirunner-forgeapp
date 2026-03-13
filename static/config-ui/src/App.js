/*
 * CogniRunner - AI-powered workflow validation for Jira
 * Copyright (C) 2025 LeanZero
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import React, { useState, useEffect, useRef } from "react";
import { invoke } from "@forge/bridge";

// Inject styles directly - more reliable in Forge iframe
const injectStyles = () => {
  if (document.getElementById("app-styles")) return;

  const style = document.createElement("style");
  style.id = "app-styles";
  style.textContent = `
    :root {
      --bg-color: transparent;
      --text-color: #172B4D;
      --text-secondary: #5E6C84;
      --text-muted: #7A869A;
      --primary-color: #0052CC;
      --error-color: #DE350B;
      --success-color: #006644;
      --border-color: #DFE1E6;
      --card-bg: #FFFFFF;
      --input-bg: #FAFBFC;
      --code-bg: #F4F5F7;
      --icon-bg: #DEEBFF;
      --alert-error-bg: #FFEBE6;
      --alert-error-border: #FFBDAD;
      --alert-success-bg: #E3FCEF;
      --alert-success-border: #ABF5D1;
      --button-disabled-bg: #B3D4FF;
    }

    html[data-color-mode="dark"] {
      --bg-color: transparent;
      --text-color: #B6C2CF;
      --text-secondary: #9FADBC;
      --text-muted: #8C9BAB;
      --primary-color: #579DFF;
      --error-color: #F87168;
      --success-color: #4BCE97;
      --border-color: #454F59;
      --card-bg: #22272B;
      --input-bg: #1D2125;
      --code-bg: #1D2125;
      --icon-bg: #1C2B41;
      --alert-error-bg: #42221F;
      --alert-error-border: #5D1F1A;
      --alert-success-bg: #1C3329;
      --alert-success-border: #216E4E;
      --button-disabled-bg: #1C2B41;
    }

    *, *::before, *::after { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: var(--bg-color);
      color: var(--text-color);
      font-size: 14px;
      line-height: 1.5;
    }

    .container { padding: 20px; max-width: 100%; }

    .header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 20px;
    }

    .icon-wrapper {
      padding: 10px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      background-color: var(--icon-bg);
      color: var(--primary-color);
    }

    .title {
      margin: 0 0 4px 0;
      font-size: 16px;
      font-weight: 600;
      line-height: 1.25;
      color: var(--text-color);
    }

    .subtitle {
      margin: 0;
      font-size: 13px;
      line-height: 1.4;
      color: var(--text-secondary);
    }

    .card {
      padding: 20px;
      border-radius: 8px;
      border: 1px solid var(--border-color);
      background-color: var(--card-bg);
      margin-bottom: 16px;
    }

    .form-group { margin-bottom: 20px; }
    .form-group:last-child { margin-bottom: 0; }

    .label {
      display: block;
      margin-bottom: 6px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-secondary);
    }

    .required { color: var(--error-color); }

    .input, .textarea {
      width: 100%;
      padding: 10px 12px;
      font-size: 14px;
      border: 2px solid var(--border-color);
      border-radius: 4px;
      background-color: var(--input-bg);
      color: var(--text-color);
      outline: none;
      transition: border-color 0.15s ease-in-out;
    }

    .input:focus, .textarea:focus { border-color: var(--primary-color); }
    .input-error { border-color: var(--error-color) !important; }

    .textarea {
      resize: vertical;
      font-family: inherit;
      line-height: 1.5;
      min-height: 120px;
    }

    .input::placeholder, .textarea::placeholder { color: var(--text-muted); }

    .dropdown { position: relative; }

    .dropdown-trigger {
      width: 100%;
      padding: 10px 36px 10px 12px;
      font-size: 14px;
      border: 2px solid var(--border-color);
      border-radius: 4px;
      background-color: var(--input-bg);
      color: var(--text-color);
      outline: none;
      transition: border-color 0.15s ease-in-out;
      cursor: pointer;
      text-align: left;
      position: relative;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-family: inherit;
      line-height: 1.5;
    }

    .dropdown-trigger:focus,
    .dropdown-trigger.dropdown-open { border-color: var(--primary-color); }
    .dropdown-trigger.dropdown-error { border-color: var(--error-color) !important; }

    .dropdown-trigger .dropdown-placeholder { color: var(--text-muted); }

    .dropdown-chevron {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
      color: var(--text-muted);
      transition: transform 0.15s ease;
    }

    .dropdown-open .dropdown-chevron { transform: translateY(-50%) rotate(180deg); }

    .dropdown-panel {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      z-index: 1000;
      background-color: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.12);
      max-height: 320px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    html[data-color-mode="dark"] .dropdown-panel {
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    }

    .dropdown-search {
      padding: 8px;
      border-bottom: 1px solid var(--border-color);
      flex-shrink: 0;
    }

    .dropdown-search input {
      width: 100%;
      padding: 8px 10px;
      font-size: 13px;
      border: 2px solid var(--border-color);
      border-radius: 3px;
      background-color: var(--input-bg);
      color: var(--text-color);
      outline: none;
      font-family: inherit;
    }

    .dropdown-search input:focus { border-color: var(--primary-color); }
    .dropdown-search input::placeholder { color: var(--text-muted); }

    .dropdown-list {
      overflow-y: auto;
      flex: 1;
    }

    .dropdown-group-label {
      padding: 6px 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      background-color: var(--code-bg);
      position: sticky;
      top: 0;
    }

    .dropdown-item {
      padding: 8px 12px;
      cursor: pointer;
      display: flex;
      align-items: baseline;
      gap: 8px;
      transition: background-color 0.1s;
    }

    .dropdown-item:hover,
    .dropdown-item.dropdown-highlighted { background-color: var(--code-bg); }

    .dropdown-item.dropdown-selected {
      background-color: var(--icon-bg);
    }

    .dropdown-item-name {
      font-size: 14px;
      color: var(--text-color);
      flex-shrink: 0;
    }

    .dropdown-item-meta {
      font-size: 11px;
      color: var(--text-muted);
      font-family: SFMono-Regular, Consolas, monospace;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .dropdown-item-type {
      margin-left: auto;
      flex-shrink: 0;
      font-size: 11px;
      padding: 1px 6px;
      border-radius: 3px;
      background-color: var(--code-bg);
      color: var(--text-muted);
    }

    .dropdown-item.dropdown-selected .dropdown-item-type {
      background-color: var(--card-bg);
    }

    .dropdown-empty {
      padding: 16px 12px;
      text-align: center;
      color: var(--text-muted);
      font-size: 13px;
    }

    .fields-loading {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background-color: var(--input-bg);
      border: 2px solid var(--border-color);
      border-radius: 4px;
      color: var(--text-muted);
      font-size: 13px;
    }

    .fields-loading .spinner-small {
      width: 14px;
      height: 14px;
      border: 2px solid var(--border-color);
      border-top-color: var(--primary-color);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .hint {
      margin: 8px 0 0 0;
      font-size: 12px;
      line-height: 1.4;
      color: var(--text-muted);
    }

    .hint code {
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11px;
      font-family: SFMono-Regular, Consolas, monospace;
      background-color: var(--code-bg);
      color: var(--text-color);
    }

    .alert {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-radius: 4px;
      font-size: 13px;
      margin-bottom: 16px;
      border: 1px solid;
    }

    .alert-error {
      background-color: var(--alert-error-bg);
      border-color: var(--alert-error-border);
      color: var(--error-color);
    }

    .alert-success {
      background-color: var(--alert-success-bg);
      border-color: var(--alert-success-border);
      color: var(--success-color);
    }

    .actions { display: flex; justify-content: flex-start; }

    .button {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 500;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.15s ease-in-out;
      background-color: var(--primary-color);
      color: #FFFFFF;
    }

    html[data-color-mode="dark"] .button { color: #1D2125; }
    .button:hover { opacity: 0.9; }

    .button-disabled {
      cursor: not-allowed;
      opacity: 0.7;
      background-color: var(--button-disabled-bg);
    }

    html[data-color-mode="dark"] .button-disabled { color: var(--text-muted); }

    .loading-spinner {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px;
    }

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--border-color);
      border-top-color: var(--primary-color);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .loading-text {
      margin-top: 12px;
      font-size: 13px;
      color: var(--text-secondary);
    }

    @keyframes spin { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);
};

// Import Forge bridge for workflow configuration
let workflowRules;
let view;

// Dynamic import for Forge bridges
const initBridges = async () => {
  try {
    const jiraBridge = await import("@forge/jira-bridge");
    workflowRules = jiraBridge.workflowRules;
  } catch (e) {
    console.log("jira-bridge not available:", e);
  }
  try {
    const bridge = await import("@forge/bridge");
    view = bridge.view;

    // Enable theming - this is the key to dark mode support!
    if (view && view.theme && view.theme.enable) {
      await view.theme.enable();
    }
  } catch (e) {
    console.log("bridge not available:", e);
  }
};

// We need refs to access current form state from the onConfigure callback
let currentFieldId = "";
let currentPrompt = "";
let currentEnableTools = null; // null = auto-detect, true = always on, false = always off
let currentContext = null;

function App() {
  const [fieldId, setFieldId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [enableTools, setEnableTools] = useState(null); // null = auto, true = on, false = off
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fields, setFields] = useState([]);
  const [fieldsLoading, setFieldsLoading] = useState(true);
  const [fieldsError, setFieldsError] = useState(null);
  const [fieldsSource, setFieldsSource] = useState(null);
  const [isCreateTransition, setIsCreateTransition] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  // Keep refs in sync with state
  useEffect(() => {
    currentFieldId = fieldId;
  }, [fieldId]);

  useEffect(() => {
    currentPrompt = prompt;
  }, [prompt]);

  useEffect(() => {
    currentEnableTools = enableTools;
  }, [enableTools]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (dropdownOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [dropdownOpen]);

  // Reset highlight when search changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [dropdownSearch]);

  // Compute filtered + grouped fields for dropdown
  const filteredFields = fields.filter((f) => {
    if (!dropdownSearch) return true;
    const q = dropdownSearch.toLowerCase();
    return f.name.toLowerCase().includes(q)
      || f.id.toLowerCase().includes(q)
      || f.type.toLowerCase().includes(q);
  });
  const systemFields = filteredFields.filter((f) => !f.custom);
  const customFields = filteredFields.filter((f) => f.custom);
  // Flat list for keyboard navigation (group labels excluded)
  const flatFiltered = [...systemFields, ...customFields];

  const handleDropdownKeyDown = (e) => {
    if (!dropdownOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setDropdownOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setDropdownOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, flatFiltered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < flatFiltered.length) {
        setFieldId(flatFiltered[highlightedIndex].id);
        setDropdownOpen(false);
        setDropdownSearch("");
      }
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (!dropdownOpen || highlightedIndex < 0) return;
    const item = listRef.current?.querySelector(`[data-index="${highlightedIndex}"]`);
    if (item) item.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, dropdownOpen]);

  useEffect(() => {
    // Inject styles immediately
    injectStyles();

    const init = async () => {
      await initBridges();

      // Get context first — we need projectId and transitionContext for field filtering
      let existingFieldId = "";
      if (view) {
        try {
          const context = await view.getContext();
          currentContext = context;

          // Try multiple possible locations for the config
          let config =
            context?.extension?.validatorConfig ||
            context?.extension?.conditionConfig ||
            context?.extension?.configuration ||
            context?.extension?.config;

          // Config is stored as JSON string, parse it
          if (typeof config === "string") {
            try {
              config = JSON.parse(config);
            } catch {
              // Ignore parse errors
            }
          }

          if (config) {
            existingFieldId = config.fieldId || "";
            setFieldId(existingFieldId);
            setPrompt(config.prompt || "");
            setEnableTools(config.enableTools ?? null);
            currentFieldId = existingFieldId;
            currentPrompt = config.prompt || "";
            currentEnableTools = config.enableTools ?? null;
          }
        } catch (e) {
          console.log("Could not load existing config:", e);
        }
      }

      // Fetch fields — use screen-based filtering via workflowId → project resolution
      try {
        const ext = currentContext?.extension || {};
        const workflowId = ext.workflowId;
        const transitionId = ext.transitionContext?.id;

        console.log("[CogniRunner] Fetching fields: workflowId=" + workflowId + ", transitionId=" + transitionId);

        const screenResult = await invoke("getScreenFields", {
          workflowId,
          transitionId,
        });
        console.log("[CogniRunner] getScreenFields result: source=" + screenResult.source + ", fields=" + (screenResult.fields?.length || 0) + ", isCreate=" + screenResult.isCreateTransition);

        if (screenResult.success) {
          let loadedFields = screenResult.fields;
          setFieldsSource(screenResult.source);
          setIsCreateTransition(screenResult.isCreateTransition || false);

          // If editing an existing rule, ensure the configured field is in the list
          if (existingFieldId && !loadedFields.find((f) => f.id === existingFieldId)) {
            loadedFields = [
              ...loadedFields,
              { id: existingFieldId, name: `${existingFieldId} (not on current screen)`, type: "Unknown", custom: false },
            ];
          }

          setFields(loadedFields);
        } else {
          setFieldsError(screenResult.error || "Failed to load screen fields");
        }
      } catch (e) {
        console.error("[CogniRunner] Field fetch error:", e);
        setFieldsError("Failed to load fields: " + e.message);
      } finally {
        setFieldsLoading(false);
      }

      // Register the onConfigure callback - this is called when user clicks Add/Update button
      // The callback should return the current form state as JSON string
      if (workflowRules) {
        try {
          await workflowRules.onConfigure(async () => {
            // Validate before saving
            if (!currentFieldId.trim() || !currentPrompt.trim()) {
              // Return undefined to prevent form submission
              return undefined;
            }

            const config = {
              fieldId: currentFieldId.trim(),
              prompt: currentPrompt.trim(),
            };
            // Only include enableTools if explicitly set (keep config clean for auto-detect default)
            if (currentEnableTools !== null) {
              config.enableTools = currentEnableTools;
            }
            console.log("Saving configuration:", config);

            // Register this config in the admin registry with workflow context
            try {
              const ext = currentContext?.extension || {};
              const moduleType = ext.type === "jira:workflowCondition" ? "condition" : "validator";

              // Capture workflow context (available in new workflow editor)
              const workflowContext = {};
              if (ext.workflowId) workflowContext.workflowId = ext.workflowId;
              if (ext.workflowName) workflowContext.workflowName = ext.workflowName;
              if (ext.scopedProjectId) workflowContext.projectId = ext.scopedProjectId;
              if (ext.transitionContext) {
                workflowContext.transitionId = ext.transitionContext.id;
                workflowContext.transitionFromName = ext.transitionContext.from?.name;
                workflowContext.transitionToName = ext.transitionContext.to?.name;
              }
              if (currentContext?.siteUrl) workflowContext.siteUrl = currentContext.siteUrl;

              // Build a stable ID from workflow context so create/edit use the same ID.
              // ext.entryPoint changes between "create" and "edit" modes, causing duplicates.
              const ruleId = (workflowContext.workflowName && workflowContext.transitionId)
                ? `${workflowContext.workflowName}::${workflowContext.transitionId}`
                : ext.entryPoint || ext.key || Date.now().toString();

              await invoke("registerConfig", {
                id: ruleId,
                type: moduleType,
                fieldId: config.fieldId,
                prompt: config.prompt,
                workflow: workflowContext,
              });
            } catch (e) {
              console.log("Could not register config:", e);
            }

            return JSON.stringify(config);
          });
          console.log("onConfigure callback registered successfully");
        } catch (e) {
          console.error("Failed to register onConfigure:", e);
          setError("Failed to initialize configuration: " + e.message);
        }
      }

      setLoading(false);
    };
    init();
  }, []);

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

  return (
    <div className="container">
      <div className="header">
        <div className="icon-wrapper">
          <svg width="20" height="20" viewBox="0 0 128 128" fill="none">
            <defs><linearGradient id="uiBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#0065FF"/><stop offset="100%" stopColor="#4C9AFF"/></linearGradient></defs>
            <rect x="4" y="4" width="120" height="120" rx="24" ry="24" fill="url(#uiBg)"/>
            <path d="M44 42C44 34 52 28 58 28C62 28 64 30 64 34L64 64" stroke="white" strokeWidth="5" strokeLinecap="round"/>
            <path d="M38 52C32 52 28 58 28 64C28 72 34 78 42 78L64 78" stroke="white" strokeWidth="5" strokeLinecap="round"/>
            <path d="M48 36C48 36 42 42 42 50" stroke="white" strokeWidth="4" strokeLinecap="round"/>
            <path d="M84 42C84 34 76 28 70 28C66 28 64 30 64 34" stroke="white" strokeWidth="5" strokeLinecap="round"/>
            <path d="M90 52C96 52 100 58 100 64C100 72 94 78 86 78L64 78" stroke="white" strokeWidth="5" strokeLinecap="round"/>
            <path d="M80 36C80 36 86 42 86 50" stroke="white" strokeWidth="4" strokeLinecap="round"/>
            <circle cx="44" cy="50" r="3.5" fill="white" opacity="0.9"/><circle cx="84" cy="50" r="3.5" fill="white" opacity="0.9"/><circle cx="64" cy="34" r="3.5" fill="white" opacity="0.9"/><circle cx="42" cy="78" r="3.5" fill="white" opacity="0.9"/><circle cx="86" cy="78" r="3.5" fill="white" opacity="0.9"/>
            <circle cx="64" cy="58" r="10" stroke="white" strokeWidth="4" fill="none"/><circle cx="64" cy="58" r="4" fill="white"/>
            <path d="M56 92L72 92L72 86L88 96L72 106L72 100L56 100Z" fill="white" opacity="0.95"/>
          </svg>
        </div>
        <div>
          <h3 className="title">AI Validator Configuration</h3>
          <p className="subtitle">
            Configure AI-powered field validation for this workflow transition
          </p>
        </div>
      </div>

      <div className="card">
        <div className="form-group">
          <label className="label">
            Field to Validate <span className="required">*</span>
          </label>
          {fieldsLoading ? (
            <div className="fields-loading">
              <div className="spinner-small"></div>
              <span>Loading available fields...</span>
            </div>
          ) : fieldsError ? (
            <>
              <input
                type="text"
                value={fieldId}
                onChange={(e) => setFieldId(e.target.value)}
                placeholder="e.g., summary, description, customfield_10001"
                className={`input ${error && !fieldId.trim() ? "input-error" : ""}`}
              />
              <p className="hint" style={{ color: "var(--error-color)" }}>
                Could not load fields: {fieldsError}. Enter field ID manually.
              </p>
            </>
          ) : (
            <div className="dropdown" ref={dropdownRef} onKeyDown={handleDropdownKeyDown}>
              <button
                type="button"
                className={`dropdown-trigger${dropdownOpen ? " dropdown-open" : ""}${error && !fieldId.trim() ? " dropdown-error" : ""}`}
                onClick={() => { setDropdownOpen((o) => !o); setDropdownSearch(""); }}
              >
                {fieldId && fields.find((f) => f.id === fieldId) ? (
                  <span>{fields.find((f) => f.id === fieldId).name}</span>
                ) : (
                  <span className="dropdown-placeholder">Select a field...</span>
                )}
                <span className="dropdown-chevron">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                </span>
              </button>
              {dropdownOpen && (
                <div className="dropdown-panel">
                  <div className="dropdown-search">
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={dropdownSearch}
                      onChange={(e) => setDropdownSearch(e.target.value)}
                      placeholder="Search fields..."
                    />
                  </div>
                  <div className="dropdown-list" ref={listRef}>
                    {flatFiltered.length === 0 ? (
                      <div className="dropdown-empty">No fields match your search</div>
                    ) : (
                      <>
                        {systemFields.length > 0 && (
                          <>
                            <div className="dropdown-group-label">System Fields</div>
                            {systemFields.map((f) => {
                              const idx = flatFiltered.indexOf(f);
                              return (
                                <div
                                  key={f.id}
                                  data-index={idx}
                                  className={`dropdown-item${f.id === fieldId ? " dropdown-selected" : ""}${idx === highlightedIndex ? " dropdown-highlighted" : ""}`}
                                  onClick={() => { setFieldId(f.id); setDropdownOpen(false); setDropdownSearch(""); }}
                                  onMouseEnter={() => setHighlightedIndex(idx)}
                                >
                                  <span className="dropdown-item-name">{f.name}</span>
                                  <span className="dropdown-item-meta">{f.id}</span>
                                  <span className="dropdown-item-type">{f.type.replace(/^System \(|\)$/g, "")}</span>
                                </div>
                              );
                            })}
                          </>
                        )}
                        {customFields.length > 0 && (
                          <>
                            <div className="dropdown-group-label">Custom Fields</div>
                            {customFields.map((f) => {
                              const idx = flatFiltered.indexOf(f);
                              return (
                                <div
                                  key={f.id}
                                  data-index={idx}
                                  className={`dropdown-item${f.id === fieldId ? " dropdown-selected" : ""}${idx === highlightedIndex ? " dropdown-highlighted" : ""}`}
                                  onClick={() => { setFieldId(f.id); setDropdownOpen(false); setDropdownSearch(""); }}
                                  onMouseEnter={() => setHighlightedIndex(idx)}
                                >
                                  <span className="dropdown-item-name">{f.name}</span>
                                  <span className="dropdown-item-meta">{f.id}</span>
                                  <span className="dropdown-item-type">{f.type.replace(/^Custom \(|\)$/g, "")}</span>
                                </div>
                              );
                            })}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          {fieldsSource === "screen" && (
            <p className="hint" style={{ color: "var(--success-color)" }}>
              Showing fields from the {isCreateTransition ? "create" : "edit/view"} screen for this project.
            </p>
          )}
          {fieldsSource === "fallback" && (
            <p className="hint">
              Showing available fields{isCreateTransition ? " (filtered for issue creation)" : ""}.
            </p>
          )}
          {fieldsSource === "all" && (
            <p className="hint">
              Showing all available fields.
            </p>
          )}
          {!fieldsSource && (
            <p className="hint">
              Select the field whose value will be validated by AI during workflow
              transitions.
            </p>
          )}
        </div>

        <div className="form-group">
          <label className="label">
            Validation Prompt <span className="required">*</span>
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what makes the field value valid. Example: The description must include steps to reproduce, expected behavior, and actual behavior."
            className={`textarea ${error && !prompt.trim() ? "input-error" : ""}`}
            rows={5}
          />
          <p className="hint">
            Describe the validation criteria in natural language. The AI will
            evaluate if the field content meets these requirements.
          </p>
        </div>

        <div className="form-group">
          <label className="label">Jira Search (JQL)</label>
          <select
            value={enableTools === null ? "auto" : enableTools ? "on" : "off"}
            onChange={(e) => {
              const v = e.target.value;
              setEnableTools(v === "auto" ? null : v === "on");
            }}
            className="input"
            style={{ cursor: "pointer" }}
          >
            <option value="auto">Auto-detect from prompt</option>
            <option value="on">Always enabled</option>
            <option value="off">Always disabled</option>
          </select>
          <p className="hint">
            When enabled, the AI can search Jira for similar or related issues during
            validation (e.g. duplicate detection). Auto-detect activates this when your
            prompt mentions duplicates, similarity, or existing issues. Adds latency.
          </p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {(!fieldId.trim() || !prompt.trim()) && (
        <div className="alert alert-error">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>
            Please fill in both Field ID and Validation Prompt before clicking
            Add/Update.
          </span>
        </div>
      )}
    </div>
  );
}

export default App;
