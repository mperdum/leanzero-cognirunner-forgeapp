/*
 * JIRA Fields Module - Handles field-related operations
 */

// Fields that are not available during issue creation.
const FIELDS_UNAVAILABLE_ON_CREATE = new Set([
  "creator", "created", "updated", "resolutiondate",
  "resolution", "status", "statuscategorychangedate",
  "votes", "watches", "worklog", "comment",
  "attachment", "issuelinks", "subtasks",
  "timetracking", "aggregatetimeoriginalestimate",
  "aggregatetimeestimate", "aggregatetimespent",
  "timespent", "timeoriginalestimate", "timeestimate",
  "lastViewed", "workratio", "parent", "progress",
  "aggregateprogress", "thumbnail",
]);

/**
 * Format a raw Jira field object into a display-friendly format
 */
export const formatField = (field) => {
  let fieldType = "Unknown";

  if (field.custom) {
    // Custom field - extract type from schema.custom
    if (field.schema?.custom) {
      const customType = field.schema.custom.split(":").pop();
      const typeMap = {
        textfield: "Text (single line)",
        textarea: "Text (multi-line)",
        select: "Select List (single)",
        multiselect: "Select List (multiple)",
        radiobuttons: "Radio Buttons",
        multicheckboxes: "Checkboxes",
        userpicker: "User Picker (single)",
        multiuserpicker: "User Picker (multiple)",
        grouppicker: "Group Picker (single)",
        multigrouppicker: "Group Picker (multiple)",
        datepicker: "Date Picker",
        datetime: "Date Time Picker",
        float: "Number",
        labels: "Labels",
        url: "URL",
        project: "Project Picker",
        version: "Version Picker (single)",
        multiversion: "Version Picker (multiple)",
        cascadingselect: "Cascading Select",
        readonlyfield: "Read-Only Text",
        jobcheckbox: "Job Checkbox",
        importid: "Import ID",
        tempo_account: "Tempo Account",
        "cmdb-object-cftype": "Assets Object",
        "rlabs-customfield-default-value": "Assets / Insight Object (Legacy)",
        "scripted-field": "ScriptRunner Field",
        checklist: "Checklist",
        "manual-test-steps-custom-field": "Xray Test Steps",
        "nfeed-standard-customfield-type": "Elements Connect (Live Text)",
        "com.valiantys.jira.plugin.sqlfeed.customfield.type": "Elements Connect (Live Text Legacy)",
        "com.valiantys.jira.plugins.sqlfeed.user.customfield.type": "Elements Connect (Live User)",
        "nfeed-unplugged-customfield-type": "Elements Connect (Snapshot Text)",
      };
      fieldType = typeMap[customType] || `Custom (${customType})`;
    } else {
      fieldType = "Custom";
    }
  } else {
    // System field - use schema.system or schema.type
    if (field.schema?.system) {
      const systemMap = {
        summary: "System (Text)",
        description: "System (Rich Text)",
        environment: "System (Rich Text)",
        issuetype: "System (Issue Type)",
        project: "System (Project)",
        priority: "System (Priority)",
        status: "System (Status)",
        resolution: "System (Resolution)",
        assignee: "System (User)",
        reporter: "System (User)",
        creator: "System (User)",
        created: "System (Date)",
        updated: "System (Date)",
        duedate: "System (Date)",
        resolutiondate: "System (Date)",
        labels: "System (Labels)",
        components: "System (Components)",
        fixVersions: "System (Versions)",
        versions: "System (Versions)",
        attachment: "System (Attachments)",
        comment: "System (Comments)",
        issuelinks: "System (Issue Links)",
        subtasks: "System (Subtasks)",
        timetracking: "System (Time Tracking)",
        worklog: "System (Work Log)",
        votes: "System (Votes)",
        watches: "System (Watches)",
        parent: "System (Parent)",
        security: "System (Security Level)",
      };
      fieldType = systemMap[field.schema.system] || `System (${field.schema.system})`;
    } else if (field.schema?.type) {
      fieldType = `System (${field.schema.type})`;
    } else {
      fieldType = "System";
    }
  }

  return {
    id: field.id,
    name: field.name,
    type: fieldType,
    custom: field.custom,
    schema: field.schema,
  };
};

/**
 * Sort fields: system fields first (alphabetically), then custom fields (alphabetically)
 */
export const sortFields = (fields) => {
  return fields.sort((a, b) => {
    if (a.custom !== b.custom) {
      return a.custom ? 1 : -1;
    }
    return a.name.localeCompare(b.name);
  });
};

/**
 * Get the fallback fields from JIRA
 */
export const getFallbackFields = async (isCreateTransition) => {
  try {
    const response = await api.asApp().requestJira(route`/rest/api/3/field`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to fetch fields:", response.status, errorText);
      return {
        success: false,
        error: `Failed to fetch fields: ${response.status}`,
        fields: [],
      };
    }

    const allFields = await response.json();
    let fields = allFields.map(formatField);

    if (isCreateTransition) {
      fields = fields.filter((f) => !FIELDS_UNAVAILABLE_ON_CREATE.has(f.id));
    }

    return { success: true, fields: sortFields(fields), source: "fallback", isCreateTransition };
  } catch (error) {
    console.error("Failed to get fields:", error);
    return { success: false, error: error.message, fields: [] };
  }
};