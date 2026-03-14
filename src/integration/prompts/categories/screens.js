/*
 * JIRA Screens Prompts - Issue screen operations for JIRA REST API
 */

/**
 * Screen prompt definitions for JIRA REST API operations
 */
export const screens = {
  // --- SCREENS ---

  get_screens: {
    id: "get_screens",
    category: "screens",
    keywords: [
      "all screens", "list screens", "show screen list"
    ],
    endpoint: "/rest/api/3/screens",
    method: "GET",
    description: "Get all issue screen schemes in Jira.",
    parameters: {
      required: [],
      optional: ["startAt", "maxResults"]
    },
    response_format: {
      maxResults: "Number of screens returned",
      startAt: "Index of first result",
      isLast: "Boolean indicating if last page",
      values: "Array of screen objects with tabs"
    },
    when_to_use: "Use when user asks to list, search, or find screens.",
    example_queries: [
      "List all issue screens",
      "Show me available screens",
      "What screens are configured?"
    ]
  },

  get_screen_tabs: {
    id: "get_screen_tabs",
    category: "screens",
    keywords: [
      "screen tabs", "tabs in screen", "screen organization"
    ],
    endpoint: "/rest/api/3/screens/{id}/tabs",
    method: "GET",
    description: "Get all tabs for a specific issue screen.",
    parameters: {
      required: ["id"]
    },
    response_format: {
      id: "Tab ID",
      name: "Tab name"
    },
    when_to_use: "Use when user asks about screen tab structure or organization.",
    example_queries: [
      "Show me tabs for screen 12345",
      "List all tabs in 'Default Screen'"
    ]
  },

  get_screen_tab_fields: {
    id: "get_screen_tab_fields",
    category: "screens",
    keywords: [
      "screen fields", "fields in tab", "visible on screen"
    ],
    endpoint: "/rest/api/3/screens/{id}/tabs/{tabId}/fields",
    method: "GET",
    description: "Get all fields displayed on a specific screen tab.",
    parameters: {
      required: ["id", "tabId"]
    },
    response_format: {
      id: "Field ID (e.g., summary, description)",
      name: "Human-readable field name"
    },
    when_to_use: "Use when user asks which fields are on a specific screen tab.",
    example_queries: [
      "Show me fields on screen 12345 tab 67890",
      "List all fields in 'Details' tab"
    ]
  }
};