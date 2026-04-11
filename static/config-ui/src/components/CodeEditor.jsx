/*
 * CogniRunner - AI-powered workflow validation for Jira
 * Copyright (C) 2025 LeanZero
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React, { useMemo, useState, useEffect } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { createTheme } from "@uiw/codemirror-themes";
import { tags as t } from "@lezer/highlight";
import { autocompletion } from "@codemirror/autocomplete";

// === API Autocompletion ===
// Custom completions for the sandbox api.* methods

const API_COMPLETIONS = [
  { label: "api.getIssue", type: "function", detail: "(issueKey) → issue object",
    info: "Fetches a Jira issue by key. Returns full issue with fields (summary, status, priority, etc.)" },
  { label: "api.updateIssue", type: "function", detail: "(issueKey, fields) → { success }",
    info: "Updates fields on an issue. Use field IDs as keys. ADF required for description." },
  { label: "api.searchJql", type: "function", detail: "(jql) → { issues, total }",
    info: "Searches Jira issues using JQL. Returns up to 20 results with key and fields." },
  { label: "api.transitionIssue", type: "function", detail: "(issueKey, transitionId) → { success }",
    info: "Moves an issue to a different status using the transition ID." },
  { label: "api.log", type: "function", detail: "(...args) → void",
    info: "Logs a debug message. Objects are JSON-serialized. Visible in test results." },
  { label: "api.context", type: "variable", detail: "{ issueKey }",
    info: "The current issue being transitioned. api.context.issueKey = 'PROJ-123'" },
  { label: "api.context.issueKey", type: "property", detail: "string",
    info: "The key of the issue being transitioned (e.g., 'PROJ-123')." },
];

const FIELD_COMPLETIONS = [
  { label: "issue.fields.summary", type: "property", detail: "string" },
  { label: "issue.fields.description", type: "property", detail: "ADF object" },
  { label: "issue.fields.status", type: "property", detail: "{ name, id }" },
  { label: "issue.fields.status.name", type: "property", detail: "string" },
  { label: "issue.fields.priority", type: "property", detail: "{ name, id }" },
  { label: "issue.fields.priority.name", type: "property", detail: "string" },
  { label: "issue.fields.assignee", type: "property", detail: "{ displayName, accountId } | null" },
  { label: "issue.fields.reporter", type: "property", detail: "{ displayName, accountId }" },
  { label: "issue.fields.labels", type: "property", detail: "string[]" },
  { label: "issue.fields.components", type: "property", detail: "{ name, id }[]" },
  { label: "issue.fields.issuetype", type: "property", detail: "{ name, id }" },
  { label: "issue.fields.issuetype.name", type: "property", detail: "string" },
  { label: "issue.fields.duedate", type: "property", detail: "string | null (YYYY-MM-DD)" },
  { label: "issue.fields.created", type: "property", detail: "string (ISO 8601)" },
  { label: "issue.fields.updated", type: "property", detail: "string (ISO 8601)" },
  { label: "issue.fields.resolution", type: "property", detail: "{ name } | null" },
  { label: "issue.fields.parent", type: "property", detail: "{ key } | undefined" },
  { label: "issue.fields.subtasks", type: "property", detail: "{ key, fields }[]" },
  { label: "issue.fields.issuelinks", type: "property", detail: "{ type, outwardIssue, inwardIssue }[]" },
  { label: "issue.fields.fixVersions", type: "property", detail: "{ name, id }[]" },
  { label: "issue.fields.comment", type: "property", detail: "{ comments: [...] }" },
];

const ADF_COMPLETIONS = [
  { label: '{ type: "doc", version: 1, content: [] }', type: "text", detail: "ADF document",
    info: "Root ADF document structure" },
  { label: '{ type: "paragraph", content: [{ type: "text", text: "" }] }', type: "text", detail: "ADF paragraph",
    info: "ADF paragraph with text content" },
  { label: '{ type: "bulletList", content: [] }', type: "text", detail: "ADF bullet list" },
  { label: '{ type: "heading", attrs: { level: 2 }, content: [] }', type: "text", detail: "ADF heading" },
];

function apiCompletions(context) {
  const word = context.matchBefore(/[\w.]*$/);
  if (!word || (word.from === word.to && !context.explicit)) return null;

  const text = word.text.toLowerCase();
  const completions = [];

  // API methods
  for (const c of API_COMPLETIONS) {
    if (c.label.toLowerCase().startsWith(text) || text.startsWith("api")) {
      completions.push(c);
    }
  }

  // Issue fields (when typing issue.fields or similar)
  if (text.includes("issue") || text.includes("fields") || text.includes(".fields")) {
    for (const c of FIELD_COMPLETIONS) {
      if (c.label.toLowerCase().includes(text) || text.length < 3) {
        completions.push(c);
      }
    }
  }

  // ADF structures (when typing doc, paragraph, type, etc.)
  if (text.includes("doc") || text.includes("adf") || text.includes("paragraph") || text.includes("type")) {
    completions.push(...ADF_COMPLETIONS);
  }

  if (completions.length === 0) return null;

  return {
    from: word.from,
    options: completions,
    validFor: /^[\w.]*$/,
  };
}

// === Themes ===

const leanzeroDark = createTheme({
  theme: "dark",
  settings: {
    background: "#0A0A0F",
    foreground: "#F5F5F7",
    caret: "#3b82f6",
    selection: "#3b82f626",
    selectionMatch: "#3b82f615",
    lineHighlight: "#1e1e2e",
    gutterBackground: "#0A0A0F",
    gutterForeground: "#71717a",
    gutterActiveForeground: "#A0A0B0",
    gutterBorder: "1px solid #374151",
    fontFamily: "SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace",
  },
  styles: [
    { tag: t.comment, color: "#71717a", fontStyle: "italic" },
    { tag: t.variableName, color: "#F5F5F7" },
    { tag: [t.string, t.special(t.brace)], color: "#98c379" },
    { tag: t.number, color: "#d19a66" },
    { tag: t.bool, color: "#d19a66" },
    { tag: t.null, color: "#d19a66" },
    { tag: t.keyword, color: "#c678dd" },
    { tag: t.operator, color: "#A0A0B0" },
    { tag: t.className, color: "#e5c07b" },
    { tag: t.definition(t.typeName), color: "#e5c07b" },
    { tag: t.typeName, color: "#e5c07b" },
    { tag: t.propertyName, color: "#61afef" },
    { tag: t.function(t.variableName), color: "#61afef" },
    { tag: t.definition(t.variableName), color: "#e06c75" },
  ],
});

const leanzeroLight = createTheme({
  theme: "light",
  settings: {
    background: "#f8fafc",
    foreground: "#0f172a",
    caret: "#2563eb",
    selection: "#2563eb20",
    selectionMatch: "#2563eb10",
    lineHighlight: "#f1f5f9",
    gutterBackground: "#f8fafc",
    gutterForeground: "#94a3b8",
    gutterActiveForeground: "#64748b",
    gutterBorder: "1px solid #cbd5e1",
    fontFamily: "SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace",
  },
  styles: [
    { tag: t.comment, color: "#94a3b8", fontStyle: "italic" },
    { tag: t.variableName, color: "#0f172a" },
    { tag: [t.string, t.special(t.brace)], color: "#0a3069" },
    { tag: t.number, color: "#0550ae" },
    { tag: t.bool, color: "#0550ae" },
    { tag: t.null, color: "#0550ae" },
    { tag: t.keyword, color: "#8250df" },
    { tag: t.operator, color: "#64748b" },
    { tag: t.className, color: "#953800" },
    { tag: t.definition(t.typeName), color: "#953800" },
    { tag: t.typeName, color: "#953800" },
    { tag: t.propertyName, color: "#0550ae" },
    { tag: t.function(t.variableName), color: "#6639ba" },
    { tag: t.definition(t.variableName), color: "#953800" },
  ],
});

// === Component ===

export default function CodeEditor({ value, onChange }) {
  const extensions = useMemo(() => [
    javascript(),
    autocompletion({
      override: [apiCompletions],
      defaultKeymap: true,
      activateOnTyping: true,
    }),
  ], []);

  // Detect Jira theme mode
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const check = () => {
      setIsDark(document.documentElement.getAttribute("data-color-mode") === "dark");
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-color-mode"] });
    return () => observer.disconnect();
  }, []);

  return (
    <CodeMirror
      value={value || ""}
      onChange={onChange}
      theme={isDark ? leanzeroDark : leanzeroLight}
      extensions={extensions}
      height="auto"
      minHeight="200px"
      maxHeight="600px"
      basicSetup={{
        lineNumbers: true,
        highlightActiveLineGutter: true,
        highlightActiveLine: true,
        foldGutter: true,
        bracketMatching: true,
        closeBrackets: true,
        indentOnInput: true,
        tabSize: 2,
        autocompletion: false, // We provide our own
        searchKeymap: true,
        highlightSelectionMatches: true,
        highlightSpecialChars: true,
        history: true,
        drawSelection: true,
        dropCursor: true,
        allowMultipleSelections: true,
        rectangularSelection: true,
        completionKeymap: true,
        foldKeymap: true,
        historyKeymap: true,
        defaultKeymap: true,
      }}
    />
  );
}
