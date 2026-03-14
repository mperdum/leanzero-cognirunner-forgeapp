/*
 * JIRA Users Prompts - User operations for JIRA REST API
 */

/**
 * User prompt definitions for JIRA REST API operations
 */
export const users = {
  // --- USERS ---

  search_users: {
    id: "search_users",
    category: "users",
    keywords: [
      "search users", "find user", "lookup user", 
      "get user by name", "user picker"
    ],
    endpoint: "/rest/api/3/user/search",
    method: "GET",
    description: "Search for active Jira users by display name, email, or account ID.",
    parameters: {
      required: [],
      optional: ["query", "accountId", "startAt", "maxResults"]
    },
    response_format: {
      accountId: "User's account ID",
      accountType: "atlassian or app",
      active: "Boolean",
      displayName: "Full name",
      emailAddress: "Email (may be hidden based on privacy)",
      avatarUrls: "Object with avatar URLs"
    },
    when_to_use: "Use when user asks to search, find, lookup, or pick users by name.",
    example_queries: [
      "Find user 'John Smith'",
      "Search for john@example.com",
      "Lookup user by account ID abc123"
    ],
    example_query_values: ["query=john", "accountId=abc-123-def"]
  },

  get_user_by_account_id: {
    id: "get_user_by_account_id",
    category: "users",
    keywords: [
      "user by account", "get user details", "fetch user info"
    ],
    endpoint: "/rest/api/3/user",
    method: "GET",
    description: "Get detailed information for a specific user by account ID.",
    parameters: {
      required: ["accountId"]
    },
    response_format: {
      accountId: "User's account ID",
      accountType: "atlassian or app",
      active: "Boolean",
      displayName: "Full name",
      email: "Email address (if visible)",
      timezone: "User's timezone"
    },
    when_to_use: "Use when user provides an account ID and asks for details.",
    example_queries: [
      "Show me details for account abc-123-def",
      "Get information about user with ID xyz789"
    ]
  }
};