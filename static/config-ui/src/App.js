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
      min-height: 80px;
    }

    .input::placeholder, .textarea::placeholder { color: var(--text-muted); }

    /* Syntax highlighted textarea */
    .syntax-highlighted {
      white-space: pre-wrap;
      word-break: break-all;
      font-family: SFMono-Regular, Consolas, monospace;
      font-size: 13px;
      line-height: 1.6;
      padding: 10px 12px;
      min-height: 80px;
    }

    /* Prism theme overrides for Forge dark mode */
    html[data-color-mode="dark"] .token.plain { color: #B6C2CF; }
    html[data-color-mode="dark"] .token.keyword { color: #FF75B9; }
    html[data-color-mode="dark"] .token.string { color: #9BEC44; }
    html[data-color-mode="dark"] .token.number { color: #FFD166; }
    html[data-color-mode="dark"] .token.function { color: #579DFF; }
    html[data-color-mode="dark"] .token.comment { color: #8C9BAB; }
    html[data-color-mode="dark"] .token.boolean { color: #FF75B9; }

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

    .hint a {
      color: var(--primary-color);
      text-decoration: none;
    }
    .hint a:hover { text-decoration: underline; }

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

    /* Function Builder Styles */
    .function-block {
      padding: 16px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background-color: var(--card-bg);
      margin-bottom: 12px;
    }

    .function-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border-color);
    }

    .function-number {
      font-size: 11px;
      font-weight: 700;
      color: var(--text-muted);
      background-color: var(--code-bg);
      padding: 4px 8px;
      border-radius: 3px;
    }

    .function-name-input {
      flex: 1;
      padding: 6px 10px;
      font-size: 14px;
      border: 2px solid var(--border-color);
      border-radius: 4px;
      background-color: var(--input-bg);
      color: var(--text-color);
    }

    .remove-function-btn {
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: 4px;
      background-color: transparent;
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.15s;
    }
    .remove-function-btn:hover {
      background-color: var(--alert-error-bg);
      color: var(--error-color);
    }

    .operation-type-select {
      padding: 8px 10px;
      font-size: 14px;
      border: 2px solid var(--border-color);
      border-radius: 4px;
      background-color: var(--input-bg);
      color: var(--text-color);
    }

    .variable-name-input {
      padding: 8px 10px;
      font-size: 13px;
      border: 2px solid var(--border-color);
      border-radius: 4px;
      background-color: var(--input-bg);
      color: var(--text-color);
      font-family: SFMono-Regular, Consolas, monospace;
    }

    .code-editor {
      padding: 10px 12px;
      font-size: 13px;
      border: 2px solid var(--border-color);
      border-radius: 4px;
      background-color: var(--input-bg);
      color: var(--text-color);
      font-family: SFMono-Regular, Consolas, monospace;
      line-height: 1.6;
      min-height: 80px;
    }

    .code-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 8px;
      flex-wrap: wrap;
    }

    .small-button {
      padding: 6px 12px;
      font-size: 12px;
      background-color: var(--code-bg);
      color: var(--text-color);
    }
    html[data-color-mode="dark"] .small-button { background-color: #333940; }

    .backoff-checkbox {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--text-secondary);
    }
    .backoff-checkbox input[type="checkbox"] {
      width: 16px;
      height: 16px;
      accent-color: var(--primary-color);
    }

    .add-function-container {
      display: flex;
      justify-content: center;
      margin-top: 8px;
    }
    .add-function-btn {
      padding: 10px 24px;
      font-size: 13px;
      background-color: var(--primary-color);
      color: #FFFFFF;
    }
    html[data-color-mode="dark"] .add-function-btn { color: #1D2125; }

    /* Prism theme classes (matching prism-tomorrow.css) */
    .token.comment,
    .token.prolog,
    .token.doctype,
    .token.cdata {
      color: #969896;
    }
    .token.punctuation {
      color: #dfdfdf;
    }
    .token.namespace {
      opacity: 0.7;
    }
    .token.property,
    .token.tag,
    .token.boolean,
    .token.number,
    .token.constant,
    .token.symbol,
    .token.deleted {
      color: #ff8b39;
    }
    .token.selector,
    .token.attr-name,
    .token.string,
    .token.char,
    .token.builtin,
    .token.inserted {
      color: #9ece6a;
    }
    .token.operator,
    .token.entity,
    .token.url,
    .token.variable {
      color: #7aa2f7;
    }
    .token.atrule,
    .token.attr-value,
    .token.keyword {
      color: #bb9af7;
    }
    .token.function,
    .token.doctag {
      color: #7aa2f7;
    }
    .token.regex,
    .token.important,
    .token.bold {
      font-weight: bold;
    }
    .token.italic {
      font-style: italic;
    }
    .token.entity {
      cursor: help;
    }
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
let currentConditionPrompt = "";
let currentActionPrompt = "";
let currentFunctions = []; // For static post functions: array of function configs
let currentContext = null;

function App() {
  const [fieldId, setFieldId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [enableTools, setEnableTools] = useState(null); // null = auto, true = on, false = off
  const [postFunctionType, setPostFunctionType] = useState(null); // null, "semantic", "static"
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fields, setFields] = useState([]);
  const [fieldsLoading, setFieldsLoading] = useState(true);
  const [fieldsError, setFieldsError] = useState(null);
  const [fieldsSource, setFieldsSource] = useState(null);
  const [isCreateTransition, setIsCreateTransition] = useState(false);
  
  // Field selection dropdown state (main field - for validation)
  const [fieldDropdownOpen, setFieldDropdownOpen] = useState(false);
  const [fieldSearch, setFieldSearch] = useState("");
  const [highlightedFieldIndex, setHighlightedFieldIndex] = useState(-1);
  
  // Action field dropdown state (for semantic post function modification target)
  const [actionFieldDropdownOpen, setActionFieldDropdownOpen] = useState(false);
  const [actionFieldSearch, setActionFieldSearch] = useState("");
  const [highlightedActionFieldIndex, setHighlightedActionFieldIndex] = useState(-1);

  // Post function type specific state
  const [conditionPrompt, setConditionPrompt] = useState("");
  const [actionPrompt, setActionPrompt] = useState("");
  const [code, setCode] = useState("");

  // Static Post Function - Array of functions for the new builder system
  const [functions, setFunctions] = useState([
    {
      id: "func_001",
      name: "Initial Function",
      conditionPrompt: "",
      operationType: "work_item_query", // work_item_query, rest_api_internal, rest_api_external, confluence_api, log_function
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

  // Refs for dropdown state
  const postFunctionTypeRef = useRef(null);
  const fieldDropdownRef = useRef(null);
  const fieldSearchInputRef = useRef(null);
  const fieldListRef = useRef(null);
  const actionFieldDropdownRef = useRef(null);
  const actionFieldSearchInputRef = useRef(null);
  const actionFieldListRef = useRef(null);

  // Keep refs in sync with state
  useEffect(() => { currentFieldId = fieldId; }, [fieldId]);
  useEffect(() => { currentPrompt = prompt; }, [prompt]);
  useEffect(() => { currentEnableTools = enableTools; }, [enableTools]);
  useEffect(() => { currentConditionPrompt = conditionPrompt; }, [conditionPrompt]);
  useEffect(() => { currentActionPrompt = actionPrompt; }, [actionPrompt]);
  useEffect(() => { currentFunctions = functions; }, [functions]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (postFunctionTypeRef.current && !postFunctionTypeRef.current.contains(e.target)) {
        setPostFunctionTypeOpen(false);
      }
      if (fieldDropdownRef.current && !fieldDropdownRef.current.contains(e.target)) {
        setFieldDropdownOpen(false);
      }
      if (actionFieldDropdownRef.current && !actionFieldDropdownRef.current.contains(e.target)) {
        setActionFieldDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search inputs
  useEffect(() => {
    if (fieldDropdownOpen && fieldSearchInputRef.current) {
      fieldSearchInputRef.current.focus();
    }
  }, [fieldDropdownOpen]);

  useEffect(() => {
    if (actionFieldDropdownOpen && actionFieldSearchInputRef.current) {
      actionFieldSearchInputRef.current.focus();
    }
  }, [actionFieldDropdownOpen]);

  // Reset highlights
  useEffect(() => { setHighlightedFieldIndex(0); }, [fieldSearch]);
  useEffect(() => { setHighlightedActionFieldIndex(0); }, [actionFieldSearch]);

  // Post function type dropdown state
  const [postFunctionTypeOpen, setPostFunctionTypeOpen] = useState(false);
  const postFunctionTypeHighlightedIndexRef = useRef(-1);

  // Scroll highlighted items
  useEffect(() => {
    if (!postFunctionTypeOpen || postFunctionTypeHighlightedIndexRef.current < 0) return;
    const item = document.querySelector(`[data-index="${postFunctionTypeHighlightedIndexRef.current}"]`);
    if (item) item.scrollIntoView({ block: "nearest" });
  }, [postFunctionTypeHighlightedIndexRef.current, postFunctionTypeOpen]);

  useEffect(() => {
    if (!fieldDropdownOpen || highlightedFieldIndex < 0) return;
    const item = fieldListRef.current?.querySelector(`[data-index="${highlightedFieldIndex}"]`);
    if (item) item.scrollIntoView({ block: "nearest" });
  }, [highlightedFieldIndex, fieldDropdownOpen]);

  useEffect(() => {
    if (!actionFieldDropdownOpen || highlightedActionFieldIndex < 0) return;
    const item = actionFieldListRef.current?.querySelector(`[data-index="${highlightedActionFieldIndex}"]`);
    if (item) item.scrollIntoView({ block: "nearest" });
  }, [highlightedActionFieldIndex, actionFieldDropdownOpen]);

  // Keyboard navigation
  const handlePostFunctionTypeKeyDown = (e) => {
    if (!postFunctionTypeOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setPostFunctionTypeOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setPostFunctionTypeOpen(false);
      return;
    }
    const options = postFunctionTypeOptions.filter((opt) => true);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      postFunctionTypeHighlightedIndexRef.current = Math.min(postFunctionTypeHighlightedIndexRef.current + 1, options.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      postFunctionTypeHighlightedIndexRef.current = Math.max(postFunctionTypeHighlightedIndexRef.current - 1, 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const options = postFunctionTypeOptions.filter((opt) => true);
      if (postFunctionTypeHighlightedIndexRef.current >= 0 && postFunctionTypeHighlightedIndexRef.current < options.length) {
        setPostFunctionType(options[postFunctionTypeHighlightedIndexRef.current].id);
        setPostFunctionTypeOpen(false);
        postFunctionTypeHighlightedIndexRef.current = -1;
      }
    }
  };

  const handleFieldKeyDown = (e) => {
    if (!fieldDropdownOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setFieldDropdownOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setFieldDropdownOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedFieldIndex((prev) => Math.min(prev + 1, flatFiltered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedFieldIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedFieldIndex >= 0 && highlightedFieldIndex < flatFiltered.length) {
        setFieldId(flatFiltered[highlightedFieldIndex].id);
        setFieldDropdownOpen(false);
        setFieldSearch("");
      }
    }
  };

  const handleActionFieldKeyDown = (e) => {
    if (!actionFieldDropdownOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setActionFieldDropdownOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setActionFieldDropdownOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedActionFieldIndex((prev) => Math.min(prev + 1, flatSemanticFiltered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedActionFieldIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedActionFieldIndex >= 0 && highlightedActionFieldIndex < flatSemanticFiltered.length) {
        setActionFieldId(flatSemanticFiltered[highlightedActionFieldIndex].id);
        setActionFieldDropdownOpen(false);
        setActionFieldSearch("");
      }
    }
  };

  // Filter fields
  const filteredFields = fields.filter((f) => {
    if (!fieldSearch) return true;
    const q = fieldSearch.toLowerCase();
    return f.name.toLowerCase().includes(q) || f.id.toLowerCase().includes(q) || f.type.toLowerCase().includes(q);
  });
  const systemFields = filteredFields.filter((f) => !f.custom);
  const customFields = filteredFields.filter((f) => f.custom);
  const flatFiltered = [...systemFields, ...customFields];

  const semanticFields = fields.filter((f) => {
    if (!actionFieldSearch) return true;
    const q = actionFieldSearch.toLowerCase();
    return f.name.toLowerCase().includes(q) || f.id.toLowerCase().includes(q) || f.type.toLowerCase().includes(q);
  });
  const systemSemanticFields = semanticFields.filter((f) => !f.custom);
  const customSemanticFields = semanticFields.filter((f) => f.custom);
  const flatSemanticFiltered = [...systemSemanticFields, ...customSemanticFields];

  // Function builder handlers
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
    setFunctions(functions.filter(f => f.id !== id));
  };

  const updateFunction = (id, updates) => {
    setFunctions(functions.map(f => 
      f.id === id ? { ...f, ...updates } : f
    ));
  };

  // Load existing config
  useEffect(() => {
    injectStyles();

    const init = async () => {
      await initBridges();

      let existingFieldId = "";
      if (view) {
        try {
          const context = await view.getContext();
          currentContext = context;

          let config =
            context?.extension?.validatorConfig ||
            context?.extension?.conditionConfig ||
            context?.extension?.configuration ||
            context?.extension?.config;

          if (typeof config === "string") {
            try {
              config = JSON.parse(config);
            } catch { /* Ignore */ }
          }

          if (config) {
            existingFieldId = config.fieldId || "";
            setFieldId(existingFieldId);
            setPrompt(config.prompt || "");
            setEnableTools(config.enableTools ?? null);

            if (config.type === "semantic") {
              setPostFunctionType("semantic");
              setConditionPrompt(config.conditionPrompt || "");
              setActionPrompt(config.actionPrompt || "");
              currentConditionPrompt = config.conditionPrompt || "";
              currentActionPrompt = config.actionPrompt || "";
              if (config.actionFieldId) {
                setActionFieldId(config.actionFieldId);
              }
            } else if (config.type === "static") {
              setPostFunctionType("static");
              // Load existing functions
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
        } catch (e) {
          console.log("Could not load existing config:", e);
        }
      }

      // Fetch fields
      try {
        const ext = currentContext?.extension || {};
        const workflowId = ext.workflowId;
        const transitionId = ext.transitionContext?.id;

        const screenResult = await invoke("getScreenFields", { workflowId, transitionId });

        if (screenResult.success) {
          let loadedFields = screenResult.fields;
          setFieldsSource(screenResult.source);
          setIsCreateTransition(screenResult.isCreateTransition || false);

          if (existingFieldId && !loadedFields.find((f) => f.id === existingFieldId)) {
            loadedFields = [...loadedFields, {
              id: existingFieldId,
              name: `${existingFieldId} (not on current screen)`,
              type: "Unknown",
              custom: false
            }];
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

      // Register onConfigure callback
      if (workflowRules) {
        try {
          await workflowRules.onConfigure(async () => {
            if (!currentFieldId.trim() || !currentPrompt.trim()) {
              return undefined;
            }

            const config = {
              fieldId: currentFieldId.trim(),
              prompt: currentPrompt.trim(),
            };
            if (currentEnableTools !== null) {
              config.enableTools = currentEnableTools;
            }
            
            if (postFunctionType === "semantic") {
              config.conditionPrompt = currentConditionPrompt || "";
              config.actionPrompt = currentActionPrompt || "";
              config.actionFieldId = actionFieldId || currentFieldId;
            } else if (postFunctionType === "static") {
              // Pass the functions array
              config.functions = currentFunctions;
            }
            
            console.log("Saving configuration:", config);

            try {
              const ext = currentContext?.extension || {};
              
              let moduleType = "validator";
              if (ext.type === "jira:workflowCondition") {
                moduleType = "condition";
              } else if (ext.type === "jira:workflowPostFunction") {
                moduleType = postFunctionType ? `postfunction-${postFunctionType}` : "postfunction-semantic";
              }

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

              const ruleId = (workflowContext.workflowName && workflowContext.transitionId)
                ? `${workflowContext.workflowName}::${workflowContext.transitionId}`
                : ext.entryPoint || ext.key || Date.now().toString();

              const resolverFunction = moduleType.includes("postfunction") 
                ? "registerPostFunction" 
                : "registerConfig";

              await invoke(resolverFunction, {
                id: ruleId,
                type: moduleType,
                fieldId: config.fieldId,
                prompt: config.prompt,
                conditionPrompt: config.conditionPrompt || "",
                actionPrompt: config.actionPrompt || "",
                functions: currentFunctions,
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

  // Static Post Function - Function Builder UI
  if (postFunctionType === "static") {
    return (
      <div className="container">
        {/* Main Card */}
        <div className="card">
          <h2 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "600" }}>
            Static Post Function - Function Builder
          </h2>
          <p style={{ margin: "0 0 16px 0", color: "var(--text-secondary)", fontSize: "13px" }}>
            Build complex workflow operations using AI-generated code. Each function can perform a different operation.
            Use the condition prompt to determine when each function should run, and let AI generate the code for you.
          </p>

          {functions.map((func, index) => (
            <div key={func.id} className="function-block">
              {/* Function Header */}
              <div className="function-header">
                <span className="function-number">Function {index + 1}</span>
                <input
                  type="text"
                  value={func.name}
                  onChange={(e) => updateFunction(func.id, { name: e.target.value })}
                  placeholder="Function name (optional)"
                  className="function-name-input"
                />
                <button
                  type="button"
                  className="remove-function-btn"
                  onClick={() => removeFunction(func.id)}
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
                  value={func.conditionPrompt}
                  onChange={(e) => updateFunction(func.id, { conditionPrompt: e.target.value })}
                  placeholder="When should this function execute? Leave empty to always run."
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
                  value={func.operationType}
                  onChange={(e) => updateFunction(func.id, { operationType: e.target.value })}
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
              {func.operationType === "work_item_query" && (
                <div className="form-group">
                  <label className="label">JQL Search Prompt</label>
                  <textarea
                    value={func.operationPrompt}
                    onChange={(e) => updateFunction(func.id, { operationPrompt: e.target.value })}
                    placeholder="Describe what issues to search for. Example: Find all open tickets with the same summary as this one."
                    rows={4}
                  />
                  <p className="hint">
                    AI generates a JQL query from this prompt using context from the issue.
                  </p>
                </div>
              )}

              {func.operationType === "rest_api_internal" && (
                <>
                  <div className="form-group">
                    <label className="label">Endpoint Template</label>
                    <input
                      type="text"
                      value={func.endpoint}
                      onChange={(e) => updateFunction(func.id, { endpoint: e.target.value })}
                      placeholder="/rest/api/3/issue/${issueKey}"
                    />
                    <p className="hint">
                      Use ${variable} syntax to reference issue fields or previous function results.
                      <br />Example: <code>/rest/api/3/issue/{`{${"parentIssue"}}`}</code> or <code>{`{${"duplicates.result1"}}`}</code>
                    </p>
                  </div>

                  <div className="form-group">
                    <label className="label">HTTP Method</label>
                    <select
                      value={func.method}
                      onChange={(e) => updateFunction(func.id, { method: e.target.value })}
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
                      Need help with Jira REST API endpoints? Check the 
                      {" "}
                      <a href="https://developer.atlassian.com/cloud/jira/platform/rest/v3/" target="_blank" rel="noopener noreferrer">
                        Atlassian REST API v3 Documentation
                      </a>
                      .
                    </p>
                  </div>
                </>
              )}

              {func.operationType === "rest_api_external" && (
                <div className="form-group">
                  <label className="label">External URL Template</label>
                  <input
                    type="text"
                    value={func.endpoint}
                    onChange={(e) => updateFunction(func.id, { endpoint: e.target.value })}
                    placeholder="https://api.example.com/v1/resource/${issueKey}"
                  />
                  <p className="hint">
                    Use ${variable} syntax to reference issue fields or previous function results.
                  </p>
                </div>
              )}

              {func.operationType === "confluence_api" && (
                <>
                  <div className="form-group">
                    <label className="label">Operation</label>
                    <select
                      value={func.method}
                      onChange={(e) => updateFunction(func.id, { method: e.target.value })}
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
                      value={func.operationPrompt}
                      onChange={(e) => updateFunction(func.id, { operationPrompt: e.target.value })}
                      placeholder="Use space key from issue if empty"
                    />
                  </div>

                  {/* Link to Confluence REST API docs */}
                  <div className="form-group">
                    <p className="hint" style={{ margin: 0 }}>
                      Check the 
                      {" "}
                      <a href="https://developer.atlassian.com/cloud/confluence/rest/v2/" target="_blank" rel="noopener noreferrer">
                        Atlassian Confluence REST API v2 Documentation
                      </a>
                      .
                    </p>
                  </div>
                </>
              )}

              {func.operationType === "log_function" && (
                <div className="form-group">
                  <label className="label">Log Message Template</label>
                  <textarea
                    value={func.operationPrompt}
                    onChange={(e) => updateFunction(func.id, { operationPrompt: e.target.value })}
                    placeholder="Log message with variables: Issue ${issueKey} has status ${status}"
                    rows={3}
                  />
                  <p className="hint">
                    Use ${variable} syntax to include issue fields in the log.
                  </p>
                </div>
              )}

              {/* Variable Name */}
              {func.operationType !== "log_function" && (
                <div className="form-group">
                  <label className="label">Variable Name (for other functions)</label>
                  <input
                    type="text"
                    value={func.variableName}
                    onChange={(e) => updateFunction(func.id, { variableName: e.target.value })}
                    placeholder="result1, duplicates, api_response..."
                    className="variable-name-input"
                  />
                  <p className="hint">
                    Name this function's result so other functions can use it with ${variableName}.
                    Leave empty if not needed by other functions.
                  </p>
                </div>
              )}

              {/* Generated Code Editor (Prism.js Syntax Highlighted) */}
              <div className="form-group">
                <label className="label">Generated Code</label>
                <textarea
                  value={func.code}
                  onChange={(e) => updateFunction(func.id, { code: e.target.value })}
                  readOnly={!func.conditionPrompt && !func.operationPrompt}
                  placeholder="// AI will generate this code based on your prompts"
                  className={`code-editor ${!func.conditionPrompt && !func.operationPrompt ? 'disabled-code' : ''}`}
                  rows={8}
                />
                <div className="code-actions">
                  {!func.conditionPrompt || !func.operationPrompt ? (
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      Fill in Condition Prompt and Operation Type/Prompt to generate code
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="button small-button"
                        onClick={() => regenerateCode(func.id, func.conditionPrompt, func.operationType, func.operationPrompt, func.endpoint || "", func.method)}
                      >
                        Regenerate Code with AI
                      </button>
                      <label className="backoff-checkbox">
                        <input
                          type="checkbox"
                          checked={func.includeBackoff}
                          onChange={(e) => updateFunction(func.id, { includeBackoff: e.target.checked })}
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
          <div className="card" style={{ backgroundColor: "var(--alert-success-bg)", borderColor: "var(--alert-success-border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div>
                <p style={{ margin: 0, fontSize: "12px", fontWeight: "600" }}>Function Builder Features</p>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--text-color)" }}>
                  Add up to 50 functions. Each function can perform a different operation with AI-generated code.
                  Use variable names to share data between functions (e.g., ${duplicates}, ${api_response}).
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Validation Message */}
        {(!currentFieldId.trim() || !currentPrompt.trim()) && (
          <div className="alert alert-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>
              Please fill in Field ID and Validation Prompt before clicking
              Add/Update.
            </span>
          </div>
        )}
      </div>
    );
  }

  // Standard Validator / Condition Configuration
  if (postFunctionType === null || postFunctionType === undefined) {
    return (
      <div className="container">
        {/* Step 1: Post Function Type Selection */}
        <div className="card">
          <div className="form-group">
            <label className="label">Function Type</label>
            <div ref={postFunctionTypeRef} onKeyDown={handlePostFunctionTypeKeyDown}>
              <button
                type="button"
                className={`dropdown-trigger${postFunctionTypeOpen ? " dropdown-open" : ""}`}
                onClick={() => { setPostFunctionTypeOpen((o) => !o); }}
              >
                {postFunctionTypeOptions.find((opt) => opt.id === postFunctionType)?.label || "Select a function type..."}
                <span className="dropdown-chevron">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                </span>
              </button>
            </div>
            <p className="hint">
              Choose how this rule behaves.
            </p>
          </div>
        </div>

        {/* Field Selection */}
        <div className="card">
          <div className="form-group">
            <label className="label">Field to Validate <span className="required">*</span></label>
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
              <div className="dropdown" ref={fieldDropdownRef}>
                <button
                  type="button"
                  className={`dropdown-trigger${fieldDropdownOpen ? " dropdown-open" : ""}${error && !fieldId.trim() ? " dropdown-error" : ""}`}
                  onClick={() => { setFieldDropdownOpen((o) => !o); setFieldSearch(""); }}
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
                {fieldDropdownOpen && (
                  <div className="dropdown-panel">
                    <div className="dropdown-search">
                      <input
                        ref={fieldSearchInputRef}
                        type="text"
                        value={fieldSearch}
                        onChange={(e) => setFieldSearch(e.target.value)}
                        placeholder="Search fields..."
                        onKeyDown={handleFieldKeyDown}
                      />
                    </div>
                    <div className="dropdown-list" ref={fieldListRef}>
                      {flatFiltered.length === 0 ? (
                        <div className="dropdown-empty">No fields match your search</div>
                      ) : (
                        <>
                          {systemFields.length > 0 && (
                            <>
                              <div className="dropdown-group-label">System Fields</div>
                              {systemFields.map((f, idx) => {
                                const flatIdx = flatFiltered.indexOf(f);
                                return (
                                  <div
                                    key={f.id}
                                    data-index={flatIdx}
                                    className={`dropdown-item${f.id === fieldId ? " dropdown-selected" : ""}${flatIdx === highlightedFieldIndex ? " dropdown-highlighted" : ""}`}
                                    onClick={() => { setFieldId(f.id); setFieldDropdownOpen(false); setFieldSearch(""); }}
                                    onMouseEnter={() => setHighlightedFieldIndex(flatIdx)}
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
                              {customFields.map((f, idx) => {
                                const flatIdx = flatFiltered.indexOf(f);
                                return (
                                  <div
                                    key={f.id}
                                    data-index={flatIdx}
                                    className={`dropdown-item${f.id === fieldId ? " dropdown-selected" : ""}${flatIdx === highlightedFieldIndex ? " dropdown-highlighted" : ""}`}
                                    onClick={() => { setFieldId(f.id); setFieldDropdownOpen(false); setFieldSearch(""); }}
                                    onMouseEnter={() => setHighlightedFieldIndex(flatIdx)}
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
          </div>

          {/* Validation Prompt */}
          <div className="form-group">
            <label className="label">Validation Prompt <span className="required">*</span></label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what makes the field value valid. Example: The description must include steps to reproduce, expected behavior, and actual behavior."
              className={`textarea ${error && !prompt.trim() ? "input-error" : ""}`}
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
              className="input"
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

  // Semantic Post Function Configuration
  if (postFunctionType === "semantic") {
    return (
      <div className="container">
        {/* Step 1: Post Function Type Selection */}
        <div className="card">
          <div className="form-group">
            <label className="label">Function Type</label>
            <div ref={postFunctionTypeRef} onKeyDown={handlePostFunctionTypeKeyDown}>
              <button
                type="button"
                className={`dropdown-trigger${postFunctionTypeOpen ? " dropdown-open" : ""}`}
                onClick={() => { setPostFunctionTypeOpen((o) => !o); }}
              >
                {postFunctionTypeOptions.find((opt) => opt.id === postFunctionType)?.label || "Select a function type..."}
                <span className="dropdown-chevron">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Semantic Configuration */}
        <div className="card">
          <div className="form-group">
            <label className="label">Condition Prompt <span className="required">*</span></label>
            <textarea
              value={conditionPrompt}
              onChange={(e) => { setConditionPrompt(e.target.value); }}
              placeholder="Describe when this post function should run. Example: Only execute if the issue priority is High or Critical."
              rows={4}
            />
            <p className="hint">
              The AI will evaluate if this condition is met. Returns true (run) or false (skip).
            </p>
          </div>

          <div className="form-group">
            <label className="label">Action Prompt</label>
            <textarea
              value={actionPrompt}
              onChange={(e) => { setActionPrompt(e.target.value); }}
              placeholder="Describe what field changes to make. Example: Set the resolution to 'Won't Fix' and add a comment explaining why."
              rows={6}
            />
            <p className="hint">
              The AI will modify the specified field(s) based on this prompt.
            </p>
          </div>

          {/* Field Selection */}
          <div className="form-group">
            <label className="label">Field to Modify</label>
            {fieldsLoading ? (
              <div className="fields-loading">
                <div className="spinner-small"></div>
                <span>Loading available fields...</span>
              </div>
            ) : fieldsError ? (
              <>
                <input
                  type="text"
                  value={actionFieldId}
                  onChange={(e) => setActionFieldId(e.target.value)}
                  placeholder="e.g., summary, description, customfield_10001"
                />
                <p className="hint" style={{ color: "var(--error-color)" }}>
                  Could not load fields: {fieldsError}. Enter field ID manually.
                </p>
              </>
            ) : (
              <div className="dropdown" ref={actionFieldDropdownRef}>
                <button
                  type="button"
                  className={`dropdown-trigger${actionFieldDropdownOpen ? " dropdown-open" : ""}`}
                  onClick={() => { setActionFieldDropdownOpen((o) => !o); setActionFieldSearch(""); }}
                >
                  {actionFieldId && fields.find((f) => f.id === actionFieldId) ? (
                    <span>{fields.find((f) => f.id === actionFieldId).name}</span>
                  ) : (
                    <span className="dropdown-placeholder">Select a field...</span>
                  )}
                  <span className="dropdown-chevron">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                  </span>
                </button>
                {actionFieldDropdownOpen && (
                  <div className="dropdown-panel">
                    <div className="dropdown-search">
                      <input
                        ref={actionFieldSearchInputRef}
                        type="text"
                        value={actionFieldSearch}
                        onChange={(e) => setActionFieldSearch(e.target.value)}
                        placeholder="Search fields..."
                        onKeyDown={handleActionFieldKeyDown}
                      />
                    </div>
                    <div className="dropdown-list" ref={actionFieldListRef}>
                      {flatSemanticFiltered.length === 0 ? (
                        <div className="dropdown-empty">No fields match your search</div>
                      ) : (
                        <>
                          {systemSemanticFields.length > 0 && (
                            <div className="dropdown-group-label">System Fields</div>
                          )}
                          {systemSemanticFields.map((f, idx) => {
                            const flatIdx = flatSemanticFiltered.indexOf(f);
                            return (
                              <div
                                key={f.id}
                                data-index={flatIdx}
                                className={`dropdown-item${f.id === actionFieldId ? " dropdown-selected" : ""}${flatIdx === highlightedActionFieldIndex ? " dropdown-highlighted" : ""}`}
                                onClick={() => { setActionFieldId(f.id); setActionFieldDropdownOpen(false); setActionFieldSearch(""); }}
                                onMouseEnter={() => setHighlightedActionFieldIndex(flatIdx)}
                              >
                                <span className="dropdown-item-name">{f.name}</span>
                                <span className="dropdown-item-meta">{f.id}</span>
                                <span className="dropdown-item-type">{f.type.replace(/^System \(|\)$/g, "")}</span>
                              </div>
                            );
                          })}
                          {customSemanticFields.length > 0 && (
                            <div className="dropdown-group-label">Custom Fields</div>
                          )}
                          {customSemanticFields.map((f, idx) => {
                            const flatIdx = flatSemanticFiltered.indexOf(f);
                            return (
                              <div
                                key={f.id}
                                data-index={flatIdx}
                                className={`dropdown-item${f.id === actionFieldId ? " dropdown-selected" : ""}${flatIdx === highlightedActionFieldIndex ? " dropdown-highlighted" : ""}`}
                                onClick={() => { setActionFieldId(f.id); setActionFieldDropdownOpen(false); setActionFieldSearch(""); }}
                                onMouseEnter={() => setHighlightedActionFieldIndex(flatIdx)}
                              >
                                <span className="dropdown-item-name">{f.name}</span>
                                <span className="dropdown-item-meta">{f.id}</span>
                                <span className="dropdown-item-type">{f.type.replace(/^Custom \(|\)$/g, "")}</span>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="card" style={{ backgroundColor: "var(--alert-success-bg)", borderColor: "var(--alert-success-border)" }}>
          <p style={{ margin: 0, fontSize: "12px", fontWeight: "600" }}>For Best Results</p>
          <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--text-color)" }}>
            Semantic post functions work best with text-based fields where AI can intelligently rephrase or refine content.
          </p>
        </div>

        {/* Validation Message */}
        {(!conditionPrompt.trim() || !actionFieldId.trim()) && (
          <div className="alert alert-error">
            <span>Please fill in Condition Prompt and Field to Modify.</span>
          </div>
        )}
      </div>
    );
  }

  return null;
}

// Helper function for code regeneration
const regenerateCode = async (functionId, conditionPrompt, operationType, operationPrompt, endpoint, method) => {
  console.log("Regenerate called:", { functionId, conditionPrompt, operationType, operationPrompt, endpoint, method });
  
  // This would make an API call to the backend to generate code
  // For now, just log and show a simple generated template
  
  const context = {
    issueKey: "${issue.key}",
    projectId: "${project.id}"
  };
  
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

  updateFunction(functionId, { code: generatedCode });
};

export default App;