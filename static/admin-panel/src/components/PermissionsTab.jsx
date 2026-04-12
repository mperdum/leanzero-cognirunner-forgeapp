/*
 * CogniRunner - AI-powered workflow validation for Jira
 * Copyright (C) 2025 LeanZero
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React, { useState, useEffect, useRef } from "react";

export default function PermissionsTab({ invoke }) {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(null);
  const [removing, setRemoving] = useState(null);
  const searchTimer = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await invoke("getAppAdmins");
        if (result.success) setAdmins(result.admins || []);
      } catch (e) { console.error("Failed to load admins:", e); }
      setLoading(false);
    };
    load();
  }, [invoke]);

  const doSearch = async (query) => {
    if (!query || query.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const result = await invoke("searchUsers", { query });
      if (result.success) setSearchResults(result.users || []);
    } catch (e) { console.error("User search failed:", e); }
    setSearching(false);
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => doSearch(val), 400);
  };

  const handleAdd = async (user) => {
    setAdding(user.accountId);
    try {
      const result = await invoke("addAppAdmin", { accountId: user.accountId, displayName: user.displayName });
      if (result.success) {
        setAdmins([...admins, { accountId: user.accountId, displayName: user.displayName, avatarUrl: user.avatarUrl }]);
        setSearchQuery("");
        setSearchResults([]);
      }
    } catch (e) { console.error("Failed to add admin:", e); }
    setAdding(null);
  };

  const handleRemove = async (accountId) => {
    setRemoving(accountId);
    try {
      const result = await invoke("removeAppAdmin", { accountId });
      if (result.success) {
        setAdmins(admins.filter((a) => (typeof a === "string" ? a : a.accountId) !== accountId));
      }
    } catch (e) { console.error("Failed to remove admin:", e); }
    setRemoving(null);
  };

  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.split(" ").filter(Boolean);
    return parts.length > 1
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.substring(0, 2).toUpperCase();
  };

  const isAlreadyAdmin = (accountId) =>
    admins.some((a) => (typeof a === "string" ? a : a.accountId) === accountId);

  return (
    <div className="perm-tab">
      <div className="perm-header">
        <div className="perm-header-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
        </div>
        <div>
          <h3 className="perm-title">App Administrators</h3>
          <p className="perm-subtitle">
            Manage who can configure AI settings, view all rules, and add other admins.
            Jira site administrators always have access.
          </p>
        </div>
      </div>

      {/* Search to add */}
      <div className="perm-search-wrap">
        <div className="perm-search-input-wrap">
          <svg className="perm-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="perm-search-input"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search by name to add an administrator..."
          />
          {searching && <span className="perm-search-loading">Searching...</span>}
          {searchQuery && !searching && (
            <button className="perm-search-clear" onClick={() => { setSearchQuery(""); setSearchResults([]); }}>&times;</button>
          )}
        </div>

        {/* Search results — click to add */}
        {searchResults.length > 0 && (
          <div className="perm-search-results">
            {searchResults.map((user) => {
              const already = isAlreadyAdmin(user.accountId);
              const isAdding = adding === user.accountId;
              return (
                <div
                  key={user.accountId}
                  className={`perm-search-item ${already ? "perm-search-disabled" : ""} ${isAdding ? "perm-search-adding" : ""}`}
                  onClick={() => { if (!already && !isAdding) handleAdd(user); }}
                >
                  {user.avatarUrl ? (
                    <img className="perm-avatar" src={user.avatarUrl} alt="" />
                  ) : (
                    <span className="perm-avatar-placeholder">{getInitials(user.displayName)}</span>
                  )}
                  <span className="perm-search-name">{user.displayName}</span>
                  {already && <span className="perm-search-badge">Already admin</span>}
                  {isAdding && <span className="perm-search-badge">Adding...</span>}
                  {!already && !isAdding && (
                    <svg className="perm-search-add-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="16" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Current admins list */}
      <div className="perm-list">
        {loading ? (
          <div className="perm-empty">Loading administrators...</div>
        ) : admins.length === 0 ? (
          <div className="perm-empty">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
            <span>No app admins yet. Search above to add one.</span>
          </div>
        ) : (
          admins.map((admin) => {
            const id = typeof admin === "string" ? admin : admin.accountId;
            const name = typeof admin === "string" ? admin : admin.displayName;
            const avatar = typeof admin === "object" ? admin.avatarUrl : null;
            const isRemoving = removing === id;
            return (
              <div key={id} className="perm-admin-card">
                <div className="perm-admin-info">
                  {avatar ? (
                    <img className="perm-avatar" src={avatar} alt="" />
                  ) : (
                    <span className="perm-avatar-placeholder">{getInitials(name)}</span>
                  )}
                  <div>
                    <div className="perm-admin-name">{name}</div>
                    <div className="perm-admin-role">App Administrator</div>
                  </div>
                </div>
                <button
                  className="perm-remove-btn"
                  onClick={() => handleRemove(id)}
                  disabled={isRemoving}
                >
                  {isRemoving ? "Removing..." : "Remove"}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
