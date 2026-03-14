/*
 * JIRA Projects Prompts - Project operations for JIRA REST API
 */

/**
 * Project prompt definitions for JIRA REST API operations
 */
export const projects = {
  // --- PROJECTS ---

  get_all_projects: {
    id: "get_all_projects",
    category: "projects",
    keywords: [
      "all projects", "list projects", "show me projects",
      "fetch project list", "browse projects"
    ],
    endpoint: "/rest/api/3/project/search",
    method: "POST",
    description: "Search for Jira projects with pagination support.",
    parameters: {
      required: [],
      optional: ["startAt", "maxResults", "sortBy", "direction"]
    },
    response_format: {
      maxResults: "Number of projects returned",
      startAt: "Index of first project",
      isLast: "Boolean indicating if this is the last page",
      values: "Array of project objects"
    },
    when_to_use: "Use when user asks to list, find, or browse all projects.",
    example_queries: [
      "List all projects in Jira",
      "Show me available projects",
      "Get project directory"
    ]
  },

  get_project_by_key: {
    id: "get_project_by_key",
    category: "projects",
    keywords: [
      "project by key", "get PROJ details", "fetch project ABC"
    ],
    endpoint: "/rest/api/3/project/{projectIdOrKey}",
    method: "GET",
    description: "Get detailed information for a specific project.",
    parameters: {
      required: ["projectIdOrKey"]
    },
    response_format: {
      id: "Project ID",
      key: "Project key",
      name: "Project name",
      projectTypeKey: "Type (software, business, service)",
      avatarUrls: "Object with avatar URLs"
    },
    when_to_use: "Use when user asks for specific project details by key or name.",
    example_queries: [
      "Show me details for PROJ",
      "Get information about ABC project",
      "What is the configuration of XYZ?"
    ]
  }
};