/*
 * CogniRunner - AI-powered workflow validation for Jira
 * Copyright (C) 2025 LeanZero
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React, { useState, useEffect, useCallback } from "react";
import CustomSelect from "./CustomSelect";

const CATEGORIES = [
  "API Documentation", "Field Mappings", "JSON Schemas",
  "Business Rules", "Code Snippets", "General",
];

export default function DocsTab({ invoke, isAdmin, accountId }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(isAdmin ? "all" : "mine");
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState("General");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [expandedDoc, setExpandedDoc] = useState(null);
  const [expandedContent, setExpandedContent] = useState("");

  const loadDocs = useCallback(async () => {
    try {
      const result = await invoke("getContextDocs", { filter });
      if (result.success) setDocs(result.docs || []);
    } catch (e) {
      console.error("Failed to load docs:", e);
    }
    setLoading(false);
  }, [invoke, filter]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleSave = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const result = await invoke("saveContextDoc", {
        title: newTitle.trim(),
        content: newContent.trim(),
        category: newCategory,
      });
      if (result.success) {
        setNewTitle(""); setNewContent(""); setNewCategory("General"); setShowAdd(false);
        await loadDocs();
      } else {
        setError(result.error);
      }
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    try {
      await invoke("deleteContextDoc", { id });
      await loadDocs();
    } catch (e) {
      console.error("Failed to delete:", e);
    }
  };

  const handleExpand = async (id) => {
    if (expandedDoc === id) { setExpandedDoc(null); return; }
    setExpandedDoc(id);
    try {
      const result = await invoke("getContextDocContent", { id });
      if (result.success) setExpandedContent(result.doc.content);
    } catch (e) {
      setExpandedContent("Failed to load");
    }
  };

  const formatSize = (len) => len < 1024 ? `${len} B` : `${(len / 1024).toFixed(1)} KB`;

  /** Detect content type and auto-format/indent. */
  const autoFormat = (text) => {
    if (!text || !text.trim()) return text;
    const trimmed = text.trim();

    // JSON
    try {
      const parsed = JSON.parse(trimmed);
      return JSON.stringify(parsed, null, 2);
    } catch { /* not JSON */ }

    // XML / HTML
    if (/^<[\s\S]*>$/m.test(trimmed)) {
      try {
        let indent = 0;
        return trimmed
          .replace(/>\s*</g, ">\n<")
          .split("\n")
          .map((line) => {
            const ln = line.trim();
            if (!ln) return "";
            if (ln.startsWith("</")) indent = Math.max(0, indent - 1);
            const out = "  ".repeat(indent) + ln;
            if (ln.startsWith("<") && !ln.startsWith("</") && !ln.endsWith("/>") && !ln.includes("</")) indent++;
            return out;
          })
          .join("\n");
      } catch { /* fall through */ }
    }

    // YAML — basic reindent (normalize to 2 spaces)
    if (/^[\w-]+\s*:/m.test(trimmed) && !trimmed.startsWith("{") && !trimmed.startsWith("[")) {
      return trimmed.replace(/\t/g, "  ");
    }

    // JavaScript / code — normalize indentation to 2 spaces
    if (/(?:function\s|const\s|let\s|var\s|=>|import\s|export\s)/m.test(trimmed)) {
      return trimmed
        .split("\n")
        .map((line) => {
          const stripped = line.replace(/^\t+/, (tabs) => "  ".repeat(tabs.length));
          return stripped;
        })
        .join("\n");
    }

    return text;
  };

  return (
    <div className="docs-tab">
      <div className="section-header">
        <span className="section-title">Documentation Library</span>
        <div className="section-actions">
          {isAdmin && (
            <div style={{ width: "160px" }}>
              <CustomSelect
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "All Documents" },
                  { value: "mine", label: "My Documents" },
                ]}
              />
            </div>
          )}
          <button className="btn-small" onClick={() => setShowAdd(!showAdd)}>
            {showAdd ? "Cancel" : "+ Add Document"}
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="card" style={{ marginBottom: "12px", padding: "16px" }}>
          {error && <div style={{ color: "var(--error-color)", fontSize: "12px", marginBottom: "8px" }}>{error}</div>}
          <input
            type="text"
            className="doc-input"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Document title"
            style={{ marginBottom: "8px", width: "100%", padding: "8px", border: "1px solid var(--border-color)", borderRadius: "4px", background: "var(--input-bg)", color: "var(--text-color)", fontSize: "13px" }}
          />
          <div style={{ marginBottom: "8px", width: "220px" }}>
            <CustomSelect
              value={newCategory}
              onChange={setNewCategory}
              options={CATEGORIES.map((c) => ({ value: c, label: c }))}
              placeholder="Category..."
            />
          </div>
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Paste documentation, JSON schemas, API specs..."
            rows={8}
            style={{ width: "100%", padding: "8px", border: "1px solid var(--border-color)", borderRadius: "4px", background: "var(--input-bg)", color: "var(--text-color)", fontSize: "12px", fontFamily: "SFMono-Regular, Consolas, monospace", resize: "vertical" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{newContent.length > 0 ? formatSize(newContent.length) : ""}</span>
              {newContent.trim() && (
                <button
                  className="btn-small"
                  onClick={() => setNewContent(autoFormat(newContent))}
                  style={{ fontSize: "10px", padding: "3px 8px" }}
                  title="Auto-format and indent content (JSON, XML, YAML, JavaScript)"
                >
                  Format
                </button>
              )}
            </div>
            <button className="btn-small" onClick={handleSave} disabled={saving || !newTitle.trim() || !newContent.trim()} style={{ background: "var(--primary-color)", color: "white", border: "none" }}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div style={{ padding: "14px" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ display: "flex", gap: "16px", alignItems: "center", padding: "10px 0", borderBottom: i < 3 ? "1px solid var(--border-color)" : "none" }}>
                <div className="sk sk-text" style={{ width: 120, height: 13 }} />
                <div className="sk sk-text" style={{ width: 70, height: 16, borderRadius: 4 }} />
                <div className="sk sk-text" style={{ width: 50, height: 11 }} />
                <div className="sk sk-text" style={{ width: 80, height: 11 }} />
                <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
                  <div className="sk sk-block" style={{ width: 44, height: 28, borderRadius: 10 }} />
                  <div className="sk sk-block" style={{ width: 52, height: 28, borderRadius: 10 }} />
                </div>
              </div>
            ))}
          </div>
        ) : docs.length === 0 ? (
          <div className="empty-state">
            {filter === "mine" ? "You haven't added any documents yet." : "No documents in the library yet."}
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Size</th>
                <th>Created</th>
                {isAdmin && <th>Owner</th>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => {
                const canDelete = isAdmin || doc.createdBy === accountId;
                return (
                  <React.Fragment key={doc.id}>
                    <tr>
                      <td style={{ fontWeight: "500" }}>{doc.title}</td>
                      <td><span className="type-badge type-validator">{doc.category}</span></td>
                      <td><span className="timestamp">{formatSize(doc.contentLength)}</span></td>
                      <td><span className="timestamp">{new Date(doc.createdAt).toLocaleDateString()}</span></td>
                      {isAdmin && <td><span className="timestamp">{doc.createdBy === accountId ? "You" : (doc.createdBy || "—")}</span></td>}
                      <td>
                        <div className="row-actions">
                          <button className="btn-small" onClick={() => handleExpand(doc.id)}>
                            {expandedDoc === doc.id ? "Hide" : "View"}
                          </button>
                          {canDelete && (
                            <button className="btn-small btn-danger" onClick={() => handleDelete(doc.id)}>Delete</button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedDoc === doc.id && (
                      <tr>
                        <td colSpan={isAdmin ? 6 : 5} style={{ padding: "0 14px 14px" }}>
                          <pre style={{ margin: 0, padding: "10px", background: "var(--code-bg)", borderRadius: "6px", fontSize: "11px", fontFamily: "SFMono-Regular, Consolas, monospace", maxHeight: "300px", overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                            {autoFormat(expandedContent)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
