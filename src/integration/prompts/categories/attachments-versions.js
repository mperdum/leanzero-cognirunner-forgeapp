/*
 * JIRA Attachments & Versions Prompts - Attachment/version operations for JIRA REST API
 */

/**
 * Attachment and version prompt definitions for JIRA REST API operations
 */
export const attachmentsVersions = {
  // --- ATTACHMENTS ---

  get_attachments: {
    id: "get_attachments",
    category: "attachments",
    keywords: [
      "attachments", "files", "attached documents"
    ],
    endpoint: "/rest/api/3/issue/{id}/attachments",
    method: "GET",
    description: "Get all attachments for a specific issue.",
    parameters: {
      required: ["id"]
    },
    response_format: {
      attachmentCount: "Total number of attachments",
      items: "Array of attachment objects with filename, size, mimetype"
    },
    when_to_use: "Use when user asks about issue attachments or files.",
    example_queries: [
      "Show me all attachments for PROJ-123",
      "List attached files on ABC-456"
    ]
  },

  add_attachment: {
    id: "add_attachment",
    category: "attachments",
    keywords: [
      "add attachment", "upload file", "attach document"
    ],
    endpoint: "/rest/api/3/issue/{id}/attachments",
    method: "POST",
    description: "Add an attachment to a Jira issue. Content-Type must be multipart/form-data.",
    parameters: {
      required: ["id"],
      optional: []
    },
    response_format: {
      id: "Attachment ID",
      filename: "Attached file name"
    },
    when_to_use: "Use when user asks to add, upload, or attach a file to an issue.",
    example_queries: [
      "Attach screenshot.png to PROJ-123",
      "Upload document to ABC-456"
    ]
  },

  delete_attachment: {
    id: "delete_attachment",
    category: "attachments",
    keywords: [
      "delete attachment", "remove file", "detach document"
    ],
    endpoint: "/rest/api/3/attachment/{id}",
    method: "DELETE",
    description: "Delete a specific attachment by ID.",
    parameters: {
      required: ["id"]
    },
    response_format: {
      success: true
    },
    when_to_use: "Use when user asks to delete, remove, or detach an attachment.",
    example_queries: [
      "Delete attachment 12345 from issue",
      "Remove file attached to PROJ-123"
    ]
  },

  // --- VERSIONS (RELEASES) ---

  get_versions: {
    id: "get_versions",
    category: "versions",
    keywords: [
      "versions", "releases", "sprints", "milestones"
    ],
    endpoint: "/rest/api/3/project/{projectIdOrKey}/version",
    method: "GET",
    description: "Get all versions (releases) for a project.",
    parameters: {
      required: ["projectIdOrKey"],
      optional: ["startAt", "maxResults", "orderBy"]
    },
    response_format: {
      maxResults: "Number of versions returned",
      startAt: "Index of first version",
      isLast: "Boolean indicating if last page",
      values: "Array of version objects"
    },
    when_to_use: "Use when user asks about versions, releases, or milestones.",
    example_queries: [
      "List all versions for PROJ",
      "Show me project releases"
    ]
  },

  create_version: {
    id: "create_version",
    category: "versions",
    keywords: [
      "create version", "add release", "new milestone"
    ],
    endpoint: "/rest/api/3/version",
    method: "POST",
    description: "Create a new project version (release).",
    parameters: {
      required: ["project", "name"],
      optional: ["description", "startDate", "releaseDate"]
    },
    response_format: {
      id: "Version ID",
      name: "Version name"
    },
    when_to_use: "Use when user asks to create or add a new version/release.",
    example_queries: [
      "Create version 2.0 for PROJ",
      "Add new release milestone"
    ]
  }
};