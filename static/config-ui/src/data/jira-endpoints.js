/*
 * CogniRunner - AI-powered workflow validation for Jira
 * Copyright (C) 2025 LeanZero
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Jira REST API v3 endpoints available from Forge post-functions.
 * Grouped by category, with method, path, description, and example body.
 */

const JIRA_ENDPOINTS = [
  // === Issues ===
  { category: "Issues", method: "GET", path: "/rest/api/3/issue/{issueIdOrKey}", description: "Get issue details", body: null },
  { category: "Issues", method: "PUT", path: "/rest/api/3/issue/{issueIdOrKey}", description: "Update issue fields",
    body: '{\n  "fields": {\n    "summary": "Updated summary",\n    "priority": { "name": "High" }\n  }\n}' },
  { category: "Issues", method: "POST", path: "/rest/api/3/issue", description: "Create a new issue",
    body: '{\n  "fields": {\n    "project": { "key": "PROJ" },\n    "summary": "New issue",\n    "issuetype": { "name": "Task" }\n  }\n}' },
  { category: "Issues", method: "DELETE", path: "/rest/api/3/issue/{issueIdOrKey}", description: "Delete an issue", body: null },

  // === Search ===
  { category: "Search", method: "POST", path: "/rest/api/3/search", description: "Search issues by JQL",
    body: '{\n  "jql": "project = PROJ AND status = \\"To Do\\"",\n  "maxResults": 20,\n  "fields": ["summary", "status", "assignee"]\n}' },

  // === Transitions ===
  { category: "Transitions", method: "GET", path: "/rest/api/3/issue/{issueIdOrKey}/transitions", description: "List available transitions", body: null },
  { category: "Transitions", method: "POST", path: "/rest/api/3/issue/{issueIdOrKey}/transitions", description: "Execute a workflow transition",
    body: '{\n  "transition": { "id": "21" },\n  "fields": {},\n  "update": {}\n}' },

  // === Comments ===
  { category: "Comments", method: "GET", path: "/rest/api/3/issue/{issueIdOrKey}/comment", description: "Get all comments", body: null },
  { category: "Comments", method: "POST", path: "/rest/api/3/issue/{issueIdOrKey}/comment", description: "Add a comment",
    body: '{\n  "body": {\n    "type": "doc",\n    "version": 1,\n    "content": [{\n      "type": "paragraph",\n      "content": [{ "type": "text", "text": "Your comment" }]\n    }]\n  }\n}' },
  { category: "Comments", method: "PUT", path: "/rest/api/3/issue/{issueIdOrKey}/comment/{commentId}", description: "Update a comment",
    body: '{\n  "body": {\n    "type": "doc",\n    "version": 1,\n    "content": [{\n      "type": "paragraph",\n      "content": [{ "type": "text", "text": "Updated comment" }]\n    }]\n  }\n}' },
  { category: "Comments", method: "DELETE", path: "/rest/api/3/issue/{issueIdOrKey}/comment/{commentId}", description: "Delete a comment", body: null },

  // === Issue Links ===
  { category: "Links", method: "POST", path: "/rest/api/3/issueLink", description: "Create a link between issues",
    body: '{\n  "type": { "name": "Blocks" },\n  "outwardIssue": { "key": "PROJ-1" },\n  "inwardIssue": { "key": "PROJ-2" }\n}' },
  { category: "Links", method: "DELETE", path: "/rest/api/3/issueLink/{issueLinkId}", description: "Delete an issue link", body: null },
  { category: "Links", method: "POST", path: "/rest/api/3/issue/{issueIdOrKey}/remotelink", description: "Add external link",
    body: '{\n  "object": {\n    "url": "https://example.com",\n    "title": "External reference"\n  }\n}' },

  // === Worklogs ===
  { category: "Worklogs", method: "POST", path: "/rest/api/3/issue/{issueIdOrKey}/worklog", description: "Log work on issue",
    body: '{\n  "timeSpent": "2h",\n  "comment": {\n    "type": "doc",\n    "version": 1,\n    "content": [{\n      "type": "paragraph",\n      "content": [{ "type": "text", "text": "Worked on this" }]\n    }]\n  }\n}' },
  { category: "Worklogs", method: "GET", path: "/rest/api/3/issue/{issueIdOrKey}/worklog", description: "Get worklogs", body: null },

  // === Watchers ===
  { category: "Watchers", method: "GET", path: "/rest/api/3/issue/{issueIdOrKey}/watchers", description: "Get watchers", body: null },
  { category: "Watchers", method: "POST", path: "/rest/api/3/issue/{issueIdOrKey}/watchers", description: "Add a watcher",
    body: '"accountId-of-user"' },

  // === Issue Properties ===
  { category: "Properties", method: "GET", path: "/rest/api/3/issue/{issueIdOrKey}/properties", description: "List issue properties", body: null },
  { category: "Properties", method: "PUT", path: "/rest/api/3/issue/{issueIdOrKey}/properties/{propertyKey}", description: "Set issue property",
    body: '{\n  "key": "value"\n}' },
  { category: "Properties", method: "DELETE", path: "/rest/api/3/issue/{issueIdOrKey}/properties/{propertyKey}", description: "Delete issue property", body: null },

  // === Users ===
  { category: "Users", method: "GET", path: "/rest/api/3/myself", description: "Get current user", body: null },
  { category: "Users", method: "GET", path: "/rest/api/3/user/search?query={query}", description: "Search users", body: null },

  // === Projects ===
  { category: "Projects", method: "GET", path: "/rest/api/3/project", description: "List all projects", body: null },
  { category: "Projects", method: "GET", path: "/rest/api/3/project/{projectIdOrKey}", description: "Get project details", body: null },

  // === Fields ===
  { category: "Fields", method: "GET", path: "/rest/api/3/field", description: "List all fields", body: null },
  { category: "Fields", method: "GET", path: "/rest/api/3/field/{fieldId}/option", description: "Get field options (select fields)", body: null },

  // === Attachments ===
  { category: "Attachments", method: "GET", path: "/rest/api/3/issue/{issueIdOrKey}?fields=attachment", description: "Get issue attachments", body: null },
  { category: "Attachments", method: "DELETE", path: "/rest/api/3/attachment/{attachmentId}", description: "Delete attachment", body: null },
];

export const ENDPOINT_CATEGORIES = [...new Set(JIRA_ENDPOINTS.map((e) => e.category))];

export default JIRA_ENDPOINTS;
