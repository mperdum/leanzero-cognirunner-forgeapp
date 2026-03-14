/*
 * JIRA Statuses & Resolutions Prompts - Status/resolution operations for JIRA REST API
 */

/**
 * Status and resolution prompt definitions for JIRA REST API operations
 */
export const statusesResolutions = {
  // --- STATUS AND RESOLUTION ---

  get_statuses: {
    id: "get_statuses",
    category: "statuses",
    keywords: [
      "all statuses", "list statuses", "show status list",
      "workflow statuses"
    ],
    endpoint: "/rest/api/3/status",
    method: "GET",
    description: "Get all issue statuses in Jira.",
    parameters: {
      required: [],
      optional: []
    },
    response_format: {
      id: "Status ID (e.g., 1, 2)",
      name: "Status name (Open, In Progress, Done)",
      statusCategory: "TODO, IN_PROGRESS, DONE"
    },
    when_to_use: "Use when user asks to list or view all statuses.",
    example_queries: [
      "List all issue statuses",
      "Show me available status values"
    ]
  },

  get_resolutions: {
    id: "get_resolutions",
    category: "resolutions",
    keywords: [
      "all resolutions", "list resolutions", "show resolution list"
    ],
    endpoint: "/rest/api/3/resolution",
    method: "GET",
    description: "Get all issue resolutions in Jira.",
    parameters: {
      required: [],
      optional: []
    },
    response_format: {
      id: "Resolution ID",
      name: "Resolution name (Fixed, Won't Fix, Duplicate)",
      description: "Resolution description"
    },
    when_to_use: "Use when user asks about resolutions or resolution values.",
    example_queries: [
      "List all resolutions",
      "Show me available resolution options"
    ]
  }
};