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

import React, { useState, useEffect } from "react";
import { invoke } from "@forge/bridge";

// Inject styles directly - more reliable in Forge iframe
const injectStyles = () => {
  if (document.getElementById("prompts-manager-styles")) return;

  const style = document.createElement("style");
  style.id = "prompts-manager-styles";
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
    }

    *, *::before, *::after { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-color);
      color: var(--text-color);
      font-size: 14px;
      line-height: 1.5;
    }

    .container { padding: 20px; max-width: 1400px; margin: 0 auto; }

    .header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border-color);
    }

    .title-section h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: var(--text-color);
    }

    .title-section p {
      margin: 4px 0 0 0;
      font-size: 13px;
      color: var(--text-secondary);
    }

    .stats-bar {
      display: flex;
      gap: 24px;
      padding: 16px 0;
      border-bottom: 1px solid var(--border-color);
    }

    .stat-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .stat-value {
      font-size: 24px;
      font-weight: 600;
      color: var(--primary-color);
    }

    .stat-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
    }

    .filter-bar {
      display: flex;
      gap: 16px;
      margin-bottom: 20px;
      align-items: center;
    }

    .search-input, .category-select {
      padding: 8px 12px;
      font-size: 13px;
      border: 2px solid var(--border-color);
      border-radius: 4px;
      background-color: var(--input-bg);
      color: var(--text-color);
    }

    .search-input:focus, .category-select:focus {
      outline: none;
      border-color: var(--primary-color);
    }

    .prompt-card {
      padding: 16px;
      border-radius: 8px;
      border: 1px solid var(--border-color);
      background-color: var(--card-bg);
      margin-bottom: 12px;
      transition: box-shadow 0.2s ease;
    }

    .prompt-card:hover {
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    }

    .prompt-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 12px;
    }

    .prompt-info h3 {
      margin: 0 0 4px 0;
      font-size: 15px;
      font-weight: 600;
      color: var(--text-color);
    }

    .prompt-meta {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .badge {
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .badge-primary { background-color: var(--icon-bg); color: var(--primary-color); }
    .badge-secondary { background-color: var(--code-bg); color: var(--text-muted); }
    .badge-danger { background-color: #FFF1F0; color: var(--error-color); border: 1px solid var(--alert-error-border); }

    .prompt-category {
      font-size: 12px;
      color: var(--text-secondary);
    }

    .prompt-card-body {
      display: grid;
      gap: 16px;
    }

    .prompt-section {
      padding: 12px;
      border-radius: 6px;
      background-color: var(--code-bg);
    }

    .prompt-section-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .prompt-section-content {
      font-family: SFMono-Regular, Consolas, monospace;
      font-size: 12px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .keyword-list {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .keyword-chip {
      padding: 3px 8px;
      border-radius: 3px;
      background-color: var(--input-bg);
      font-size: 11px;
      color: var(--text-secondary);
    }

    .parameters-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
    }

    .parameter-item {
      padding: 8px;
      border-radius: 4px;
      background-color: var(--input-bg);
      font-size: 11px;
    }

    .parameter-name { font-weight: 600; color: var(--text-secondary); }
    .parameter-required { color: var(--error-color); font-size: 9px; margin-left: 4px; }

    .actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }

    .button {
      padding: 6px 12px;
      font-size: 12px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.15s ease-in-out;
      border: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .btn-primary {
      background-color: var(--primary-color);
      color: white;
    }
    .btn-primary:hover { opacity: 0.9; }

    .btn-secondary {
      background-color: var(--input-bg);
      color: var(--text-color);
      border: 1px solid var(--border-color);
    }
    .btn-secondary:hover { background-color: var(--code-bg); }

    .btn-danger {
      background-color: var(--alert-error-bg);
      color: var(--error-color);
    }
    .btn-danger:hover { opacity: 0.8; }

    .loading-spinner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 40px;
      justify-content: center;
    }

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--border-color);
      border-top-color: var(--primary-color);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .empty-state {
      padding: 60px 20px;
      text-align: center;
      color: var(--text-muted);
    }

    .empty-state svg {
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
      opacity: 0.3;
    }

    .modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal {
      background-color: var(--card-bg);
      border-radius: 8px;
      width: 90%;
      max-width: 700px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.3);
    }

    .modal-header {
      padding: 20px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-title { font-size: 18px; font-weight: 600; margin: 0; }
    .close-btn {
      background: none; border: none; cursor: pointer;
      color: var(--text-muted); font-size: 24px;
      line-height: 1; padding: 0; width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
    }

    .modal-body { padding: 20px; }
    .form-group { margin-bottom: 16px; }
    .label { display: block; font-size: 11px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px; }
    .input, .textarea {
      width: 100%; padding: 8px 12px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background-color: var(--input-bg);
      color: var(--text-color);
      font-family: inherit; font-size: 13px;
    }
    .textarea { min-height: 80px; resize: vertical; }

    .response-section {
      margin-top: 20px;
      padding: 16px;
      border-radius: 6px;
      background-color: var(--code-bg);
    }
    .response-title { font-weight: 600; margin-bottom: 8px; font-size: 13px; }
    .response-content {
      font-family: SFMono-Regular, Consolas, monospace;
      font-size: 12px; line-height: 1.5;
      white-space: pre-wrap; word-break: break-all;
      max-height: 400px; overflow-y: auto;
    }

    .example-queries {
      margin-top: 16px;
      padding: 12px;
      border-radius: 4px;
      background-color: var(--input-bg);
    }
    .example-title { font-size: 11px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; font-weight: 600; }
    .example-list { list-style-position: inside; padding-left: 0; }
    .example-list li { margin-bottom: 4px; font-size: 12px; color: var(--text-secondary); }

    /* Dark mode adjustments */
    html[data-color-mode="dark"] .response-content {
      color: #B6C2CF;
    }
  `;
  document.head.appendChild(style);
};

// Helper function to parse parameters
const formatParameters = (params) => {
  if (!params || typeof params !== 'object') return null;

  const required = params.required || [];
  const optional = params.optional || [];

  return (
    <div className="parameters-grid">
      {required.length > 0 && (
        <>
          <div style={{ gridColumn: '1 / -1', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Required:</div>
          {required.map((param, idx) => (
            <div key={`req-${idx}`} className="parameter-item">
              <span className="parameter-name">{param}</span>
              <span className="parameter-required">*</span>
            </div>
          ))}
        </>
      )}
      {optional.length > 0 && (
        <>
          <div style={{ gridColumn: '1 / -1', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px' }}>Optional:</div>
          {optional.map((param, idx) => (
            <div key={`opt-${idx}`} className="parameter-item">
              <span className="parameter-name">{param}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
};

// Helper function to display example queries
const ExampleQueries = ({ queries }) => {
  if (!queries || !Array.isArray(queries) || queries.length === 0) return null;
  
  return (
    <div className="example-queries">
      <div className="example-title">Example User Queries</div>
      <ul className="example-list">
        {queries.map((query, idx) => (
          <li key={idx}>{query}</li>
        ))}
      </ul>
    </div>
  );
};

// Modal component for viewing/editing prompt details
const PromptDetailsModal = ({ prompt, isOpen, onClose }) => {
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);

  if (!isOpen || !prompt) return null;

  // Execute sample test with a common query for the category
  const handleTestQuery = async (testQuery) => {
    setExecuting(true);
    setExecutionResult(null);

    try {
      // Simulate executing this prompt
      const result = {
        success: true,
        message: `This would execute ${prompt.endpoint} (${prompt.method})`,
        sampleParameters: {},
        details: prompt.description
      };

      if (prompt.category === 'issues' && !prompt.parameters?.required.includes('jql')) {
        // For issues without JQL, provide sample field parameters
        result.sampleParameters = { id: "PROJ-123" };
      }

      setExecutionResult(result);
    } catch (error) {
      setExecutionResult({ success: false, error: error.message });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{prompt.id}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Prompt Header */}
          <div className="header" style={{ padding: '16px 0', marginBottom: '20px' }}>
            <span className={`badge ${prompt.category === 'issues' ? 'badge-primary' : 'badge-secondary'}`}>
              {prompt.category}
            </span>
            <code>{prompt.method} {prompt.endpoint}</code>
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="label">Description</label>
            <div style={{ padding: '12px', background: 'var(--input-bg)', borderRadius: '4px' }}>
              {prompt.description}
            </div>
          </div>

          {/* Parameters */}
          {prompt.parameters && (
            <div className="form-group">
              <label className="label">Parameters</label>
              {formatParameters(prompt.parameters)}
            </div>
          )}

          {/* When to Use */}
          {prompt.when_to_use && (
            <div className="form-group">
              <label className="label">When to Use</label>
              <div style={{ padding: '12px', background: 'var(--input-bg)', borderRadius: '4px' }}>
                {prompt.when_to_use}
              </div>
            </div>
          )}

          {/* Example Queries */}
          <ExampleQueries queries={prompt.example_queries} />

          {/* Fields Suggestions (if applicable) */}
          {prompt.fields_suggestions && (
            <div className="form-group">
              <label className="label">Suggested Fields</label>
              <div style={{ padding: '8px', background: 'var(--input-bg)', borderRadius: '4px' }}>
                {prompt.fields_suggestions.join(', ')}
              </div>
            </div>
          )}

          {/* Response Format */}
          {prompt.response_format && (
            <div className="form-group">
              <label className="label">Response Format</label>
              <pre style={{ padding: '12px', background: 'var(--code-bg)', borderRadius: '4px' }}>
                {JSON.stringify(prompt.response_format, null, 2)}
              </pre>
            </div>
          )}

          {/* Test Query */}
          <div className="form-group">
            <label className="label">Test this Prompt</label>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Enter a sample user query to see how the system would handle it.
            </p>
            
            {prompt.category === 'issues' && (
              <button 
                className="btn-secondary"
                onClick={() => handleTestQuery("Find all open bugs in project PROJ")}
                disabled={executing}
              >
                {executing ? 'Testing...' : 'Test with: Find open bugs in PROJ'}
              </button>
            )}

            <input
              type="text"
              className="input"
              placeholder="Enter a user query..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                  handleTestQuery(e.target.value.trim());
                  e.target.value = '';
                }
              }}
            />

            {executionResult && (
              <div className="response-section">
                <div className="response-title">{executionResult.success ? 'Test Result' : 'Error'}</div>
                <div className="response-content" style={{ maxHeight: '300px' }}>
                  {JSON.stringify(executionResult, null, 2)}
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)' }}>
          <button className="btn-primary" onClick={onClose} style={{ float: 'right' }}>Close</button>
        </div>
      </div>
    </div>
  );
};

// Main component
function JiraPromptsManager() {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Categories with icons
  const categories = [
    { id: 'all', label: 'All Prompts' },
    { id: 'issues', label: 'Issues' },
    { id: 'projects', label: 'Projects' },
    { id: 'users', label: 'Users' },
    { id: 'groups', label: 'Groups' },
    { id: 'workflows', label: 'Workflows' },
    { id: 'custom-fields', label: 'Custom Fields' },
    { id: 'screens', label: 'Screens' },
    { id: 'field-configs', label: 'Field Configs' },
    { id: 'statuses', label: 'Statuses & Resolutions' },
  ];

  // Load prompts from the backend
  useEffect(() => {
    injectStyles();

    const loadPrompts = async () => {
      try {
        setLoading(true);
        
        // Fetch prompts from our module - this would be implemented as a resolver
        // For now, we'll use the JIRA_PROMPTS object directly in the frontend
        // In production, you'd want to fetch this via invoke('getJiraPrompts')
        
        const { JIRA_PROMPTS } = await import('./prompts-data.js');
        setPrompts(JIRA_PROMPTS ? Object.values(JIRA_PROMPTS) : []);

      } catch (err) {
        console.error("Failed to load prompts:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadPrompts();
  }, []);

  // Filter prompts based on search and category
  const filteredPrompts = prompts.filter((prompt) => {
    const matchesCategory = selectedCategory === 'all' || prompt.category === selectedCategory;
    
    if (!matchesCategory) return false;

    if (!searchQuery) return true;

    const queryLower = searchQuery.toLowerCase();
    return (
      prompt.id?.toLowerCase().includes(queryLower) ||
      prompt.description?.toLowerCase().includes(queryLower) ||
      prompt.keywords?.some(k => k.toLowerCase().includes(queryLower)) ||
      prompt.endpoint?.toLowerCase().includes(queryLower)
    );
  });

  // Group prompts by category for display
  const groupedPrompts = filteredPrompts.reduce((groups, prompt) => {
    const cat = prompt.category || 'other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(prompt);
    return groups;
  }, {});

  // Calculate statistics
  const stats = {
    total: prompts.length,
    byCategory: categories.filter(c => c.id !== 'all').reduce((acc, cat) => ({
      ...acc,
      [cat.id]: prompts.filter(p => p.category === cat.id).length
    }), {}),
    withExamples: prompts.filter(p => (p.example_queries || []).length > 0).length,
    issuesEndpoints: prompts.filter(p => p.endpoint?.includes('/issue')).length
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <span>Loading prompt registry...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="empty-state" style={{ padding: '40px', background: 'var(--alert-error-bg)', borderRadius: '8px' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--error-color)' }}>
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <p style={{ color: 'var(--error-color)' }}>Failed to load prompts: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Header */}
      <div className="header">
        <div className="icon-wrapper" style={{ padding: '12px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
          </svg>
        </div>
        <div className="title-section">
          <h1>JIRA Prompt Registry</h1>
          <p>Manage and test AI-driven API endpoint configurations for workflow automation.</p>
        </div>
      </div>

      {/* Statistics Bar */}
      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">Total Prompts</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{Object.keys(stats.byCategory).length}</span>
          <span className="stat-label">Categories</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{stats.withExamples}</span>
          <span className="stat-label">With Examples</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{stats.issuesEndpoints}</span>
          <span className="stat-label">Issue Endpoints</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <input
          type="text"
          className="search-input"
          placeholder="Search prompts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <select
          className="category-select"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.label}</option>
          ))}
        </select>

        <button 
          className="btn-primary"
          style={{ marginLeft: 'auto' }}
          onClick={() => window.open('https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/', '_blank')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
          JIRA REST API Docs
        </button>
      </div>

      {/* Prompts List */}
      {filteredPrompts.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <h3>No prompts found</h3>
          <p>Try adjusting your search or filter criteria.</p>
        </div>
      ) : (
        Object.entries(groupedPrompts).map(([category, categoryPrompts]) => (
          <div key={category}>
            <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginTop: '24px' }}>
              {categories.find(c => c.id === category)?.label || category} ({categoryPrompts.length})
            </h3>
            <div style={{ marginTop: '12px' }}>
              {categoryPrompts.map((prompt) => (
                <div key={prompt.id} className="prompt-card">
                  <div className="prompt-header">
                    <div className="prompt-info" onClick={() => { setSelectedPrompt(prompt); setShowModal(true); }} style={{ cursor: 'pointer' }}>
                      <h3>{prompt.id}</h3>
                      <span className={`badge badge-secondary`} style={{ fontSize: '10px', padding: '2px 6px', display: 'block', marginTop: '4px' }}>
                        {prompt.method} {prompt.endpoint}
                      </span>
                    </div>
                    <div className="actions">
                      <button
                        className="btn-primary"
                        onClick={() => { setSelectedPrompt(prompt); setShowModal(true); }}
                        style={{ padding: '8px 16px', fontSize: '12px' }}
                      >
                        View & Test
                      </button>
                    </div>
                  </div>

                  <div className="prompt-card-body">
                    {/* Description */}
                    <div className="prompt-section">
                      <div className="prompt-section-title">Description</div>
                      <div className="prompt-section-content">{prompt.description}</div>
                    </div>

                    {/* Keywords */}
                    {prompt.keywords && prompt.keywords.length > 0 && (
                      <div className="prompt-section">
                        <div className="prompt-section-title">Keywords (for matching)</div>
                        <div className="keyword-list">
                          {prompt.keywords.slice(0, 10).map((kw, idx) => (
                            <span key={idx} className="keyword-chip">{kw}</span>
                          ))}
                          {prompt.keywords.length > 10 && (
                            <span className="keyword-chip">+{prompt.keywords.length - 10} more</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Parameters */}
                    {prompt.parameters && (
                      <div className="prompt-section">
                        <div className="prompt-section-title">Parameters</div>
                        {formatParameters(prompt.parameters)}
                      </div>
                    )}

                    {/* When to Use (shortened) */}
                    {prompt.when_to_use && (
                      <div className="prompt-section">
                        <div className="prompt-section-title">When to Use</div>
                        <div className="prompt-section-content" style={{ maxHeight: '48px', overflow: 'hidden' }}>
                          {prompt.when_to_use}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Prompt Details Modal */}
      <PromptDetailsModal
        prompt={selectedPrompt}
        isOpen={showModal}
        onClose={() => { setShowModal(false); setSelectedPrompt(null); }}
      />
    </div>
  );
}

export default JiraPromptsManager;