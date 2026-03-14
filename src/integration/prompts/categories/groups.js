/*
 * JIRA Groups Prompts - Group operations for JIRA REST API
 */

/**
 * Group prompt definitions for JIRA REST API operations
 */
export const groups = {
  // --- GROUPS ---

  get_groups_for_user: {
    id: "get_groups_for_user",
    category: "groups",
    keywords: [
      "user groups", "group membership", "what groups is user in"
    ],
    endpoint: "/rest/api/3/user/groups",
    method: "GET",
    description: "Get all groups a specific user belongs to.",
    parameters: {
      required: ["accountId"]
    },
    response_format: {
      groups: "Array of {name, groupId} objects"
    },
    when_to_use: "Use when user asks about which groups a member belongs to.",
    example_queries: [
      "What groups is John Smith in?",
      "Show me group membership for abc-123",
      "List all groups user xyz789 belongs to"
    ]
  },

  search_groups: {
    id: "search_groups",
    category: "groups",
    keywords: [
      "search groups", "find group", "lookup group",
      "group picker", "list groups"
    ],
    endpoint: "/rest/api/3/groups/picker",
    method: "GET",
    description: "Search for Jira groups by name. Returns matching groups with member counts.",
    parameters: {
      required: ["query"],
      optional: ["maxResults", "exclude"]
    },
    response_format: {
      groups: "Array of {name, groupId, total, isSelected} objects"
    },
    when_to_use: "Use when user asks to search, find, or pick groups by name.",
    example_queries: [
      "Search for group 'jira-admin'",
      "Find groups matching 'developer'",
      "List all groups"
    ]
  },

  add_user_to_group: {
    id: "add_user_to_group",
    category: "groups",
    keywords: [
      "add user to group", "invite to group", "grant membership",
      "make member of group", "assign to group"
    ],
    endpoint: "/rest/api/3/group/user",
    method: "POST",
    description: "Add a user to a Jira group. Requires group name and user accountId.",
    parameters: {
      required: ["groupname"],
      optional: ["accountId"]
    },
    response_format: {
      accountId: "Added user's account ID",
      groupName: "Group name",
      self: "API URL for this group membership"
    },
    when_to_use: "Use when user asks to add, invite, grant, or make someone a member of a group.",
    example_queries: [
      "Add John Smith to jira-developers group",
      "Invite abc-123 to the testers group",
      "Make xyz789 a member of project-admins"
    ]
  },

  remove_user_from_group: {
    id: "remove_user_from_group",
    category: "groups",
    keywords: [
      "remove user from group", "kick from group", "revoke membership",
      "delete from group", "unassign from group"
    ],
    endpoint: "/rest/api/3/group/user",
    method: "DELETE",
    description: "Remove a user from a Jira group. Requires group name and user accountId.",
    parameters: {
      required: ["groupname"],
      optional: ["accountId"]
    },
    response_format: {
      success: true
    },
    when_to_use: "Use when user asks to remove, kick, revoke, or delete someone from a group.",
    example_queries: [
      "Remove John Smith from jira-developers",
      "Kick abc-123 from the testers group",
      "Delete xyz789 from project-admins"
    ]
  },

  get_users_from_group: {
    id: "get_users_from_group",
    category: "groups",
    keywords: [
      "group members", "users in group", "who is in group"
    ],
    endpoint: "/rest/api/3/group/member",
    method: "GET",
    description: "Get paginated list of all users in a specific Jira group.",
    parameters: {
      required: ["groupId"],  // Can use groupName as query param
      optional: ["includeInactiveUsers", "startAt", "maxResults"]
    },
    response_format: {
      isLast: "Boolean indicating if last page",
      maxResults: "Number of users in this page",
      startAt: "Index of first user",
      total: "Total members in group",
      values: "Array of user objects"
    },
    when_to_use: "Use when user asks to list, view, or see who's in a group.",
    example_queries: [
      "List all members of jira-developers",
      "Show users in the testers group",
      "Who belongs to project-admins?"
    ]
  }
};