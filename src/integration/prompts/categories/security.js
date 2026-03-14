/*
 * JIRA Security Prompts - Security operations for JIRA REST API
 */

/**
 * Security prompt definitions for JIRA REST API operations
 */
export const security = {
  // --- SECURITY LEVELS ---

  get_security_levels: {
    id: "get_security_levels",
    category: "security",
    keywords: [
      "security levels", "issue security", "visibility levels"
    ],
    endpoint: "/rest/api/3/project/{projectIdOrKey}/securitylevel",
    method: "GET",
    description: "Get all security levels for a specific project.",
    parameters: {
      required: ["projectIdOrKey"]
    },
    response_format: {
      id: "Security level ID",
      name: "Security level name"
    },
    when_to_use: "Use when user asks about issue security or visibility settings.",
    example_queries: [
      "Show me security levels for PROJ",
      "List available security levels"
    ]
  }
};