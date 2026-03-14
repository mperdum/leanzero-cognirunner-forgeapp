/*
 * JIRA Issue Types Prompts - Issue type operations for JIRA REST API
 */

/**
 * Issue type prompt definitions for JIRA REST API operations
 */
export const issueTypes = {
  // --- ISSUE TYPES ---

  get_issue_types: {
    id: "get_issue_types",
    category: "issue-types",
    keywords: [
      "all issue types", "list issue types", "show type list",
      "bug, task, story types"
    ],
    endpoint: "/rest/api/3/issuetype",
    method: "GET",
    description: "Get all issue types in Jira.",
    parameters: {
      required: [],
      optional: []
    },
    response_format: {
      id: "Issue type ID",
      name: "Issue type name (Bug, Story, Task)",
      description: "Issue type description",
      iconUrl: "URL to issue type icon"
    },
    when_to_use: "Use when user asks about issue types or creating specific types.",
    example_queries: [
      "List all issue types",
      "Show me available issue type options"
    ]
  },

  get_issue_type_hierarchy: {
    id: "get_issue_type_hierarchy",
    category: "issue-types",
    keywords: [
      "issue hierarchy", "parent child types", "subtask types"
    ],
    endpoint: "/rest/api/3/issuetypes",
    method: "GET",
    description: "Get all issue types including subtasks and their hierarchy.",
    parameters: {
      required: [],
      optional: []
    },
    response_format: {
      id: "Issue type ID",
      name: "Issue type name",
      subTask: "Boolean indicating if subtask type"
    },
    when_to_use: "Use when user asks about issue hierarchies or subtasks.",
    example_queries: [
      "Show me all issue types including subtasks",
      "List parent and child issue types"
    ]
  }
};