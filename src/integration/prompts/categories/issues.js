/*
 * JIRA Issues Prompts - Issue operations for JIRA REST API
 */

/**
 * Issue prompt definitions for JIRA REST API operations
 */
export const issues = {
  // --- ISSUES ---

  get_all_issues_with_subtasks: {
    id: "get_all_issues_with_subtasks",
    category: "issues",
    keywords: [
      "all issues", "list all issues", "show me issues", "fetch issues", 
      "get issue list", "browse issues", "display all tickets"
    ],
    endpoint: "/rest/api/3/search/jql",
    method: "POST",
    description: "Search for Jira issues using JQL (Jira Query Language). Returns paginated results with up to 10 issues per request.",
    parameters: {
      required: ["jql"],
      optional: ["fields", "maxResults", "startAt", "expand"]
    },
    response_format: {
      total: "Total number of issues matching the query",
      maxResults: "Number of issues returned in this page",
      startAt: "Index of first issue returned",
      isLast: "Boolean indicating if this is the last page",
      issues: "Array of issue objects containing key, fields (summary, status, etc.)"
    },
    when_to_use: "Use when user asks to list, find, search, or browse issues with various criteria.",
    example_queries: [
      "Get all open bugs in project PROJ",
      "List all issues assigned to me sorted by creation date",
      "Show me all tickets created this week"
    ],
    fields_suggestions: ["summary", "status", "assignee", "reporter", "created", "updated"],
    example_jql: "project = PROJ AND status = Open ORDER BY created DESC"
  },

  create_issue: {
    id: "create_issue",
    category: "issues",
    keywords: [
      "create issue", "file bug", "raise ticket", "add new issue", 
      "open ticket", "submit issue", "new task"
    ],
    endpoint: "/rest/api/3/issue",
    method: "POST",
    description: "Creates a new Jira issue or subtask. For subtasks, set issueType as subtask and provide parent reference.",
    parameters: {
      required: ["fields"],
      optional: ["update", "reporter", "assignee", "project"]
    },
    response_format: {
      id: "Issue ID",
      key: "Issue key (e.g., PROJ-123)",
      self: "API URL to access this issue",
      transition: "Transition information if auto-transitioned"
    },
    when_to_use: "Use when user asks to create, file, open, or submit a new issue/ticket.",
    example_queries: [
      "Create a bug for login failure in PROJ project",
      "File an issue with summary 'API timeout error'",
      "Add a task to implement feature X"
    ],
    required_fields: ["summary", "issuetype", "project"],
    optional_fields: ["description", "assignee", "reporter", "priority", "labels"]
  },

  get_issue_by_key: {
    id: "get_issue_by_key",
    category: "issues",
    keywords: [
      "issue by key", "get PROJ-123", "fetch issue PROJ", 
      "show issue details", "issue information"
    ],
    endpoint: "/rest/api/3/issue/{id}",
    method: "GET",
    description: "Get detailed information for a specific Jira issue by its key (e.g., PROJ-123).",
    parameters: {
      required: ["id"],
      optional: ["fields", "expand", "properties"]
    },
    response_format: {
      id: "Issue ID",
      key: "Issue key",
      fields: "All requested field values",
      renderedFields: "Pre-rendered HTML versions of fields"
    },
    when_to_use: "Use when user provides an issue key (PROJ-123) or asks for specific issue details.",
    example_queries: [
      "Show me details for PROJ-456",
      "Get information about issue ABC-789",
      "What is the status of issue XYZ-100?"
    ]
  },

  update_issue: {
    id: "update_issue",
    category: "issues",
    keywords: [
      "update issue", "edit ticket", "modify bug", "change issue",
      "fix fields", "update description", "change priority"
    ],
    endpoint: "/rest/api/3/issue/{id}",
    method: "PUT",
    description: "Update an existing Jira issue. Use when user wants to modify any field value.",
    parameters: {
      required: ["fields"],
      optional: ["update"]
    },
    response_format: {
      id: "Updated issue ID",
      key: "Updated issue key"
    },
    when_to_use: "Use when user asks to update, edit, change, or modify an existing issue.",
    example_queries: [
      "Update description for PROJ-123",
      "Change the priority of issue ABC-456 to High",
      "Modify fields on XYZ-789"
    ]
  },

  get_subtasks: {
    id: "get_subtasks",
    category: "issues",
    keywords: [
      "subtasks", "child issues", "children", "linked tasks",
      "task breakdown", "work items"
    ],
    endpoint: "/rest/api/3/issue/{id}/subtasks",
    method: "GET",
    description: "Get all subtasks for a specific parent issue.",
    parameters: {
      required: ["id"]
    },
    response_format: {
      issues: "Array of subtask objects with key, summary, status"
    },
    when_to_use: "Use when user asks about subtasks, children, or breakdown of tasks under an issue.",
    example_queries: [
      "Show me all subtasks for PROJ-123",
      "List child issues of ABC-456",
      "What are the work items under XYZ-789?"
    ]
  },

  get_issue_transitions: {
    id: "get_issue_transitions",
    category: "issues",
    keywords: [
      "transitions", "available actions", "status changes", 
      "workflow steps", "can transition"
    ],
    endpoint: "/rest/api/3/issue/{id}/transitions",
    method: "GET",
    description: "Get available workflow transitions for an issue (what status changes are possible).",
    parameters: {
      required: ["id"]
    },
    response_format: {
      transitions: "Array of {id, name, to: {name}} objects"
    },
    when_to_use: "Use when user asks about workflow transitions, available actions, or status change options.",
    example_queries: [
      "What transitions are available for PROJ-123?",
      "Show me possible status changes for ABC-456",
      "List available actions on XYZ-789"
    ]
  },

  transition_issue: {
    id: "transition_issue",
    category: "issues",
    keywords: [
      "transition", "move issue", "change status", 
      "workflow action", "update status", "resolve ticket"
    ],
    endpoint: "/rest/api/3/issue/{id}/transitions",
    method: "POST",
    description: "Execute a workflow transition to change issue status.",
    parameters: {
      required: ["transition", "id"],
      optional: ["fields"]
    },
    response_format: {
      success: true
    },
    when_to_use: "Use when user asks to move, transition, or change the status of an issue.",
    example_queries: [
      "Transition PROJ-123 to In Progress",
      "Move ABC-456 to Done status",
      "Resolve XYZ-789"
    ]
  },

  get_issue_fields: {
    id: "get_issue_fields",
    category: "issues",
    keywords: [
      "issue fields", "field metadata", "available fields",
      "field list", "field configuration"
    ],
    endpoint: "/rest/api/3/issue/{id}/editmeta",
    method: "GET",
    description: "Get edit meta (field information) for creating/updating an issue.",
    parameters: {
      required: ["id"]
    },
    response_format: {
      fields: "Object with field definitions including schema, required flag"
    },
    when_to_use: "Use when user needs to understand what fields can be set on an issue.",
    example_queries: [
      "What fields are available for PROJ-123?",
      "Show me edit metadata for ABC-456",
      "List editable fields for XYZ-789"
    ]
  }
};