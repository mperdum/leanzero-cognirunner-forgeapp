/*
 * JIRA Notifications Prompts - Notification operations for JIRA REST API
 */

/**
 * Notification prompt definitions for JIRA REST API operations
 */
export const notifications = {
  // --- NOTIFICATIONS ---

  get_notification_schemes: {
    id: "get_notification_schemes",
    category: "notifications",
    keywords: [
      "notification schemes", "email notifications", "alert schemes"
    ],
    endpoint: "/rest/api/3/notificationscheme",
    method: "GET",
    description: "Get all notification schemes in Jira.",
    parameters: {
      required: [],
      optional: ["startAt", "maxResults"]
    },
    response_format: {
      maxResults: "Number of schemes returned",
      startAt: "Index of first result",
      isLast: "Boolean indicating if last page",
      values: "Array of notification scheme objects"
    },
    when_to_use: "Use when user asks about email notifications, alerts, or who gets notified.",
    example_queries: [
      "List all notification schemes",
      "Show me available notification schemes"
    ]
  },

  get_events: {
    id: "get_events",
    category: "notifications",
    keywords: [
      "events", "workflow events", "issue events"
    ],
    endpoint: "/rest/api/3/events",
    method: "GET",
    description: "Get all system and custom issue events.",
    parameters: {
      required: [],
      optional: []
    },
    response_format: {
      id: "Event ID",
      name: "Event name (e.g., Issue Created, Issue Updated)",
      description: "Event description"
    },
    when_to_use: "Use when user asks about workflow events or triggers.",
    example_queries: [
      "List all issue events",
      "Show me available workflow event types"
    ]
  }
};