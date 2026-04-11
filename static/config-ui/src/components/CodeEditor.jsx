/*
 * CogniRunner - AI-powered workflow validation for Jira
 * Copyright (C) 2025 LeanZero
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React, { useRef, useCallback } from "react";

/**
 * Lightweight code editor with line numbers and basic syntax highlighting.
 * Uses a textarea overlay on top of a highlighted pre block.
 */

const KEYWORDS = /\b(const|let|var|function|async|await|return|if|else|for|while|try|catch|throw|new|typeof|instanceof|null|undefined|true|false)\b/g;
const STRINGS = /(["'`])(?:(?!\1|\\).|\\.)*?\1/g;
const COMMENTS = /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm;
const NUMBERS = /\b(\d+\.?\d*)\b/g;
const METHODS = /\b(api\.\w+)/g;

function highlightCode(code) {
  if (!code) return "";
  // Escape HTML first
  let html = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Apply highlighting in order (comments last since they override)
  html = html.replace(STRINGS, '<span class="ce-string">$&</span>');
  html = html.replace(NUMBERS, '<span class="ce-number">$1</span>');
  html = html.replace(KEYWORDS, '<span class="ce-keyword">$&</span>');
  html = html.replace(METHODS, '<span class="ce-method">$1</span>');
  html = html.replace(COMMENTS, '<span class="ce-comment">$&</span>');

  return html;
}

export default function CodeEditor({ value, onChange, rows = 12 }) {
  const textareaRef = useRef(null);
  const preRef = useRef(null);

  const lines = (value || "").split("\n");
  const lineCount = Math.max(lines.length, rows);

  const handleScroll = useCallback(() => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  const handleKeyDown = (e) => {
    // Tab inserts 2 spaces instead of switching focus
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = textareaRef.current;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newValue = value.substring(0, start) + "  " + value.substring(end);
      onChange(newValue);
      // Restore cursor position after React re-render
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  };

  return (
    <div className="ce-wrap" style={{ "--ce-rows": lineCount }}>
      {/* Line numbers */}
      <div className="ce-gutter" aria-hidden="true">
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} className="ce-line-num">{i + 1}</div>
        ))}
      </div>
      {/* Highlighted display layer */}
      <pre
        className="ce-highlight"
        ref={preRef}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: highlightCode(value) + "\n" }}
      />
      {/* Editable textarea layer */}
      <textarea
        ref={textareaRef}
        className="ce-textarea"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
      />
    </div>
  );
}
