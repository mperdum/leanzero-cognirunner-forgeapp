/*
 * JIRA Workflows Prompts - Workflow operations for JIRA REST API
 */

/**
 * Workflow prompt definitions for JIRA REST API operations
 */
export const workflows = {
  // --- WORKFLOWS ---

  search_workflows: {
    id: "search_workflows",
    category: "workflows",
    keywords: [
      "all workflows", "list workflows", "show workflows",
      "find workflow", "workflow list"
    ],
    endpoint: "/rest/api/3/workflows/search",
    method: "GET",
    description: "Search for Jira workflows with optional filtering by name.",
    parameters: {
      required: [],
      optional: ["queryString", "scope", "isActive", "startAt", "maxResults"]
    },
    response_format: {
      total: "Total matching workflows",
      values: "Array of workflow objects"
    },
    when_to_use: "Use when user asks to list, search, or find workflows.",
    example_queries: [
      "List all workflows in Jira",
      "Find workflow 'Classic Workflow'",
      "Show available workflows for PROJ"
    ]
  },

  get_workflow_transitions: {
    id: "get_workflow_transitions",
    category: "workflows",
    keywords: [
      "workflow transitions", "transition rules", "workflow steps",
      "status changes in workflow"
    ],
    endpoint: "/rest/api/3/workflow/{workflowId}/transitions",
    method: "GET",
    description: "Get all transitions defined in a specific workflow.",
    parameters: {
      required: ["workflowId"]
    },
    response_format: {
      transitions: "Array of {id, name, type, from, to} objects"
    },
    when_to_use: "Use when user asks about workflow step definitions or transition rules.",
    example_queries: [
      "Show me all transitions in 'Classic Workflow'",
      "List steps in ABC-123 workflow",
      "What are the workflow transitions for XYZ?"
    ]
  }
};