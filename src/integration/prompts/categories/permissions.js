/*
 * JIRA Permissions Prompts - Permission operations for JIRA REST API
 */

/**
 * Permission prompt definitions for JIRA REST API operations
 */
export const permissions = {
  // --- PERMISSIONS ---

  get_permissions: {
    id: "get_permissions",
    category: "permissions",
    keywords: [
      "permissions", "permission scheme", "user permissions"
    ],
    endpoint: "/rest/api/3/permissions",
    method: "GET",
    description: "Get all available permissions and their descriptions.",
    parameters: {
      required: [],
      optional: []
    },
    response_format: {
      permissions: "Array of {key, name, description} objects"
    },
    when_to_use: "Use when user asks about permissions or access control.",
    example_queries: [
      "List all available permissions",
      "Show me permission scheme details"
    ]
  },

  get_permission_schemes: {
    id: "get_permission_schemes",
    category: "permissions",
    keywords: [
      "permission schemes", "access control", "project permissions"
    ],
    endpoint: "/rest/api/3/permissionscheme",
    method: "GET",
    description: "Get all permission schemes in Jira.",
    parameters: {
      required: [],
      optional: ["startAt", "maxResults"]
    },
    response_format: {
      maxResults: "Number of schemes returned",
      startAt: "Index of first result",
      isLast: "Boolean indicating if last page",
      values: "Array of permission scheme objects"
    },
    when_to_use: "Use when user asks about permission schemes or access control.",
    example_queries: [
      "List all permission schemes",
      "Show me available permission schemes"
    ]
  },

  get_my_permissions: {
    id: "get_my_permissions",
    category: "permissions",
    keywords: [
      "my permissions", "my access", "what can I do"
    ],
    endpoint: "/rest/api/3/mypermissions",
    method: "GET",
    description: "Get the current user's permissions across projects.",
    parameters: {
      required: [],
      optional: ["projectKey", "projectId", "issueKey"]
    },
    response_format: {
      permissions: "Object with permission keys and granted status"
    },
    when_to_use: "Use when user asks what permissions they have or can perform.",
    example_queries: [
      "What permissions do I have?",
      "Show me my access rights",
      "Can I create issues in PROJ?"
    ]
  }
};