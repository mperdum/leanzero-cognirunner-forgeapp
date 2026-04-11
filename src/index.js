/*
 * CogniRunner - AI-powered workflow validation for Jira
 * Copyright (C) 2025 LeanZero
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import api, { route, fetch } from "@forge/api";
import { storage } from "@forge/api";
import Resolver from "@forge/resolver";

const resolver = new Resolver();

// Maximum number of logs to keep
const MAX_LOGS = 50;
const LOGS_STORAGE_KEY = "validation_logs";
const CONFIG_REGISTRY_KEY = "config_registry";
// UUID from manifest.yml app.id — used to identify our rules in workflow transition data.
// Forge context doesn't expose the app UUID at runtime; only environmentId and installContext
// are available, neither of which matches the app UUID in rule parameters.key.
const APP_ID = "36415848-6868-4697-9554-3c3ad87b8da9";

// === Agentic validation constants ===
const MAX_TOOL_ROUNDS = 3;
const MAX_JQL_RESULTS = 10;
const AGENTIC_TIMEOUT_MS = 22000; // 22s budget within Forge's 25s validator limit

// Prompt patterns that signal the need for JQL search tools.
// When a validation prompt matches any of these, agentic mode activates automatically.
// Designed to avoid false positives: words like "unique", "original", "similar" alone
// are too ambiguous (e.g., "writing must be original"), so they only trigger when
// paired with Jira-specific nouns (issues, tickets, bugs, etc.).
const TOOL_TRIGGER_PATTERN = /\b(duplicat(?:e[ds]?|ion)|already\s+(?:exists?|reported|created|filed|logged)|previously\s+(?:reported|created|filed|logged)|existing\s+(?:issues?|tickets?|bugs?|stor(?:y|ies)|tasks?)|redundan(?:t|cy)\s+(?:issues?|tickets?|bugs?|entries?)|identical\s+(?:issues?|tickets?|bugs?)|(?:similar|resembl(?:es?|ing))\s+(?:issues?|tickets?|bugs?|stor(?:y|ies)|tasks?|entries?)|no\s+duplicat|(?:search|query|check)\s+jira|find\s+(?:related|matching|existing)\s+(?:issues?|tickets?|bugs?|stor(?:y|ies)|tasks?)|cross[- ]?reference|compare\s+(?:against|with)\s+(?:existing|other|jira))\b/i;

/**
 * Check if a validation prompt's wording implies the need for JQL search tools.
 * Returns true when the prompt contains keywords related to duplicate detection,
 * similarity checks, or explicit Jira search intent.
 */
const promptRequiresTools = (prompt) => {
  if (!prompt || typeof prompt !== "string") return false;
  return TOOL_TRIGGER_PATTERN.test(prompt);
};

/**
 * Store a validation log entry
 */
const storeLog = async (logEntry) => {
  try {
    let logs = (await storage.get(LOGS_STORAGE_KEY)) || [];

    // Add new log at the beginning
    logs.unshift({
      ...logEntry,
      timestamp: new Date().toISOString(),
      id: Date.now().toString(),
    });

    // Keep only the most recent logs
    if (logs.length > MAX_LOGS) {
      logs = logs.slice(0, MAX_LOGS);
    }

    await storage.set(LOGS_STORAGE_KEY, logs);
  } catch (error) {
    console.error("Failed to store log:", error);
  }
};

/**
 * Resolver: Check license status
 * Returns whether the app has an active license.
 * Used by the frontend to display license state and by the validator
 * to decide whether to run AI validation.
 */
resolver.define("checkLicense", ({ context }) => {
  // If no license property at all (development/unlisted), return null (unknown)
  // Only return false when a license explicitly exists but is inactive
  if (!context?.license) {
    return { isActive: null };
  }
  return { isActive: context.license.isActive === true };
});

/**
 * Resolver: Get validation logs
 */
resolver.define("getLogs", async () => {
  try {
    const logs = (await storage.get(LOGS_STORAGE_KEY)) || [];
    return { success: true, logs };
  } catch (error) {
    console.error("Failed to get logs:", error);
    return { success: false, error: error.message, logs: [] };
  }
});

/**
 * Resolver: Clear validation logs
 */
resolver.define("clearLogs", async () => {
  try {
    await storage.set(LOGS_STORAGE_KEY, []);
    return { success: true };
  } catch (error) {
    console.error("Failed to clear logs:", error);
    return { success: false, error: error.message };
  }
});

/**
 * Resolver: Register a validator/condition config in the registry
 * Called from config-ui when a rule is saved
 */
resolver.define("registerConfig", async ({ payload }) => {
  try {
    const { id, type, fieldId, prompt, workflow } = payload;
    if (!id || !fieldId) {
      return { success: false, error: "Missing required fields" };
    }

    let configs = (await storage.get(CONFIG_REGISTRY_KEY)) || [];
    const now = new Date().toISOString();

    // Build workflow context object (only store non-empty values)
    const wf = workflow || {};
    const workflowData = {};
    if (wf.workflowId) workflowData.workflowId = wf.workflowId;
    if (wf.workflowName) workflowData.workflowName = wf.workflowName;
    if (wf.projectId) workflowData.projectId = wf.projectId;
    if (wf.transitionId) workflowData.transitionId = wf.transitionId;
    if (wf.transitionFromName) workflowData.transitionFromName = wf.transitionFromName;
    if (wf.transitionToName) workflowData.transitionToName = wf.transitionToName;
    if (wf.siteUrl) workflowData.siteUrl = wf.siteUrl;

    // Match by id first; fall back to workflow context (same workflow + transition = same rule)
    let existingIndex = configs.findIndex((c) => c.id === id);
    if (existingIndex < 0 && workflowData.workflowName && workflowData.transitionId) {
      existingIndex = configs.findIndex((c) =>
        c.workflow?.workflowName === workflowData.workflowName
        && String(c.workflow?.transitionId) === String(workflowData.transitionId)
      );
    }

    if (existingIndex >= 0) {
      configs[existingIndex] = {
        ...configs[existingIndex],
        id, // Update to the new stable id format
        type: type || configs[existingIndex].type,
        fieldId,
        prompt: (prompt || "").substring(0, 200),
        workflow: Object.keys(workflowData).length > 0
          ? workflowData
          : configs[existingIndex].workflow,
        updatedAt: now,
      };
    } else {
      configs.push({
        id,
        type: type || "validator",
        fieldId,
        prompt: (prompt || "").substring(0, 200),
        workflow: Object.keys(workflowData).length > 0 ? workflowData : undefined,
        createdAt: now,
        updatedAt: now,
      });
    }

    await storage.set(CONFIG_REGISTRY_KEY, configs);
    return { success: true };
  } catch (error) {
    console.error("Failed to register config:", error);
    return { success: false, error: error.message };
  }
});

/**
 * Resolver: Remove a config from the registry (KVS only)
 */
resolver.define("removeConfig", async ({ payload }) => {
  try {
    const { id } = payload;
    let configs = (await storage.get(CONFIG_REGISTRY_KEY)) || [];
    configs = configs.filter((c) => c.id !== id);
    await storage.set(CONFIG_REGISTRY_KEY, configs);
    return { success: true };
  } catch (error) {
    console.error("Failed to remove config:", error);
    return { success: false, error: error.message };
  }
});

/**
 * Resolver: Disable a workflow rule via KVS flag.
 * The validate function checks this flag and skips AI validation when disabled.
 */
resolver.define("disableRule", async ({ payload }) => {
  try {
    const { id } = payload;
    let configs = (await storage.get(CONFIG_REGISTRY_KEY)) || [];
    const config = configs.find((c) => c.id === id);
    if (!config) {
      return { success: false, error: "Config not found in registry" };
    }
    configs = configs.map((c) => c.id === id ? { ...c, disabled: true, updatedAt: new Date().toISOString() } : c);
    await storage.set(CONFIG_REGISTRY_KEY, configs);
    return { success: true, disabled: true };
  } catch (error) {
    console.error("Failed to disable rule:", error);
    return { success: false, error: error.message };
  }
});

/**
 * Resolver: Re-enable a previously disabled workflow rule via KVS flag.
 */
resolver.define("enableRule", async ({ payload }) => {
  try {
    const { id } = payload;
    let configs = (await storage.get(CONFIG_REGISTRY_KEY)) || [];
    const config = configs.find((c) => c.id === id);
    if (!config) {
      return { success: false, error: "Config not found in registry" };
    }
    configs = configs.map((c) => c.id === id ? { ...c, disabled: false, updatedAt: new Date().toISOString() } : c);
    await storage.set(CONFIG_REGISTRY_KEY, configs);
    return { success: true, disabled: false };
  } catch (error) {
    console.error("Failed to enable rule:", error);
    return { success: false, error: error.message };
  }
});

/**
 * Helper: Search workflows via /rest/api/3/workflows/search and return
 * a Set of transition IDs for the given workflow.
 * Requires read:workflow:jira scope (already in manifest).
 * Returns { transitionRules: Map<string, { validators, conditions }>|null, error: string|null }
 */
async function fetchWorkflowTransitions(workflowName) {
  console.log(`fetchWorkflowTransitions: workflowName="${workflowName}"`);

  const url = route`/rest/api/3/workflows/search?queryString=${workflowName}&expand=values.transitions`;

  const response = await api.asApp().requestJira(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("fetchWorkflowTransitions failed:", response.status, errorBody);
    return { transitionRules: null, error: `Jira API returned ${response.status}` };
  }

  const data = await response.json();

  const transitionRules = new Map();
  const workflows = data.values || [];
  for (const wf of workflows) {
    // Only match workflows whose name exactly matches (queryString is a partial match)
    if (wf.name !== workflowName) continue;
    const transitions = wf.transitions || [];
    for (const t of transitions) {
      if (t.id !== undefined) {
        const validators = t.validators || [];
        // Conditions can be a nested object { conditions: [...] } or an array
        const rawConditions = t.conditions || [];
        const conditions = Array.isArray(rawConditions)
          ? rawConditions
          : (rawConditions.conditions || []);
        transitionRules.set(String(t.id), {
          validators,
          conditions,
        });
      }
    }
  }

  console.log(`fetchWorkflowTransitions: "${workflowName}" → ${transitionRules.size} transitions`);
  return { transitionRules, error: null };
}

/**
 * Helper: Get all project IDs that use a given workflow.
 * GET /rest/api/3/workflow/{workflowId}/projectUsages
 * Paginates through all results using nextPageToken.
 * Returns array of project ID strings, or null on failure.
 */
async function fetchProjectsForWorkflow(workflowId) {
  console.log(`fetchProjectsForWorkflow: workflowId="${workflowId}"`);
  const projectIds = [];
  let nextPageToken = null;

  do {
    const url = nextPageToken
      ? route`/rest/api/3/workflow/${workflowId}/projectUsages?maxResults=200&nextPageToken=${nextPageToken}`
      : route`/rest/api/3/workflow/${workflowId}/projectUsages?maxResults=200`;

    const response = await api.asApp().requestJira(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("fetchProjectsForWorkflow failed:", response.status, errorBody);
      return null;
    }

    const data = await response.json();
    const values = data.projects?.values || [];
    for (const project of values) {
      if (project.id) projectIds.push(String(project.id));
    }

    nextPageToken = data.projects?.nextPageToken || null;
  } while (nextPageToken);

  console.log(`fetchProjectsForWorkflow: "${workflowId}" → ${projectIds.length} project(s):`, projectIds);
  return projectIds;
}

/**
 * Resolver: Get all registered configs.
 * Auto-cleans orphaned entries whose rules no longer exist in Jira.
 * Uses /rest/api/3/workflows/search to check if workflow+transition still exists.
 */
resolver.define("getConfigs", async () => {
  try {
    const configs = (await storage.get(CONFIG_REGISTRY_KEY)) || [];
    if (configs.length === 0) {
      return { success: true, configs: [], removedCount: 0 };
    }

    const workflowCache = new Map();
    const surviving = [];
    const removed = [];
    let hadApiError = false;

    for (const config of configs) {
      const wf = config.workflow || {};
      console.log(`getConfigs orphan check: id="${config.id}", workflowName="${wf.workflowName}", transitionId="${wf.transitionId}"`);

      if (!wf.workflowName || !wf.transitionId) {
        surviving.push(config);
        continue;
      }

      let result = workflowCache.get(wf.workflowName);
      if (!result) {
        result = await fetchWorkflowTransitions(wf.workflowName);
        workflowCache.set(wf.workflowName, result);
      }

      if (result.error || !result.transitionRules) {
        hadApiError = true;
        surviving.push(config);
        continue;
      }

      const transitionData = result.transitionRules.get(String(wf.transitionId));
      if (!transitionData) {
        // Transition itself is gone — definitely orphaned
        removed.push(config);
      } else {
        // Transition exists — check if OUR app's rule is still on it
        const ruleList = config.type === "condition"
          ? transitionData.conditions
          : transitionData.validators;
        const hasOurRule = ruleList.some((r) =>
          r.parameters?.key && r.parameters.key.includes(APP_ID)
        );
        console.log(`  config "${config.id}" on transition ${wf.transitionId}: type=${config.type}, hasOurRule=${hasOurRule}`);
        if (hasOurRule) {
          surviving.push(config);
        } else {
          removed.push(config);
        }
      }
    }

    if (removed.length > 0) {
      console.log(`Orphan cleanup: removed ${removed.length} stale config(s):`,
        removed.map((c) => c.id));
      await storage.set(CONFIG_REGISTRY_KEY, surviving);
    }

    if (hadApiError) {
      console.log("Some workflow API calls failed — partial orphan cleanup only");
    }

    return { success: true, configs: surviving, removedCount: removed.length };
  } catch (error) {
    console.error("Failed to get configs:", error);
    return { success: false, error: error.message, configs: [] };
  }
});

/**
 * Resolver: Get the disabled status of a rule from KVS.
 * Lookup strategy (in order):
 * 1. By rule ID in KVS registry
 * 2. By fieldId + prompt match in KVS registry (for config-view which may not have the rule ID)
 * Returns { found, disabled, registryId } — registryId is needed for toggle actions.
 */
resolver.define("getRuleStatus", async ({ payload }) => {
  try {
    const { id, fieldId, prompt } = payload;
    const configs = (await storage.get(CONFIG_REGISTRY_KEY)) || [];

    // Strategy 1: match by rule ID
    if (id) {
      const config = configs.find((c) => c.id === id);
      if (config) {
        return { found: true, disabled: config.disabled === true, registryId: config.id };
      }
    }

    // Strategy 2: match by fieldId + prompt content
    if (fieldId && prompt) {
      const config = configs.find((c) => c.fieldId === fieldId && c.prompt === prompt);
      if (config) {
        return { found: true, disabled: config.disabled === true, registryId: config.id };
      }
    }

    return { found: false, disabled: false, registryId: null };
  } catch (error) {
    console.error("Failed to get rule status:", error);
    return { found: false, disabled: false, registryId: null };
  }
});

/**
 * Format a raw Jira field object into a display-friendly format
 * with human-readable type labels.
 */
const formatField = (field) => {
  let fieldType = "Unknown";

  if (field.custom) {
    // Custom field - extract type from schema.custom
    if (field.schema?.custom) {
      // Format: "com.atlassian.jira.plugin.system.customfieldtypes:textfield"
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
        // Additional known custom field types
        readonlyfield: "Read-Only Text",
        jobcheckbox: "Job Checkbox",
        importid: "Import ID",
        // Tempo Timesheets
        tempo_account: "Tempo Account",
        // Jira Assets / Insight — schema key changed after Atlassian acquisition
        // New key (Atlassian Assets): com.atlassian.jira.plugins.cmdb:cmdb-object-cftype
        "cmdb-object-cftype": "Assets Object",
        // Legacy key (Riada/Mindville Insight): com.riadalabs.jira.plugins.insight:rlabs-customfield-default-value
        "rlabs-customfield-default-value": "Assets / Insight Object (Legacy)",
        // ScriptRunner — short key from schema after ":"
        "scripted-field": "ScriptRunner Field",
        // Checklist for Jira (Okapya)
        checklist: "Checklist",
        // Xray Test Management — Manual Test Steps (Server/DC only; Cloud stores data outside Jira fields)
        "manual-test-steps-custom-field": "Xray Test Steps",
        // Elements Connect (nFeed) — plugin key com.valiantys.jira.plugins.SQLFeed
        // The short keys retained the original nFeed naming after the Elements Connect rebrand
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
        parent: "System (Parent Issue)",
        security: "System (Security Level)",
      };
      fieldType =
        systemMap[field.schema.system] || `System (${field.schema.system})`;
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
const sortFields = (fields) => {
  return fields.sort((a, b) => {
    if (a.custom !== b.custom) {
      return a.custom ? 1 : -1;
    }
    return a.name.localeCompare(b.name);
  });
};

/**
 * Fields that are not available during issue creation.
 * These are auto-set by Jira or only exist after an issue is created.
 */
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
 * Fetch all Jira fields and return them formatted.
 * If isCreateTransition is true, filters out fields unavailable during creation.
 */
const getFallbackFields = async (isCreateTransition) => {
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
};

/**
 * Helper: Get the issue type screen scheme ID for a project.
 * GET /rest/api/3/issuetypescreenscheme/project?projectId=X
 */
async function getIssueTypeScreenSchemeForProject(projectId) {
  const response = await api.asApp().requestJira(
    route`/rest/api/3/issuetypescreenscheme/project?projectId=${projectId}`,
    { headers: { Accept: "application/json" } },
  );

  if (!response.ok) {
    console.error("getIssueTypeScreenSchemeForProject failed:", response.status);
    return null;
  }

  const data = await response.json();
  const values = data.values || [];
  // Find the entry whose projectIds includes our project
  const entry = values.find((v) =>
    (v.projectIds || []).map(String).includes(String(projectId))
  );
  return entry?.issueTypeScreenScheme || null;
}

/**
 * Helper: Get issue type → screen scheme mappings for an issue type screen scheme.
 * GET /rest/api/3/issuetypescreenscheme/mapping?issueTypeScreenSchemeId=X
 */
async function getScreenSchemeMappings(issueTypeScreenSchemeId) {
  const response = await api.asApp().requestJira(
    route`/rest/api/3/issuetypescreenscheme/mapping?issueTypeScreenSchemeId=${issueTypeScreenSchemeId}`,
    { headers: { Accept: "application/json" } },
  );

  if (!response.ok) {
    console.error("getScreenSchemeMappings failed:", response.status);
    return null;
  }

  const data = await response.json();
  return data.values || [];
}

/**
 * Helper: Get a screen scheme by ID, which maps operations (create/edit/view/default) to screen IDs.
 * GET /rest/api/3/screenscheme?id=X
 */
async function getScreenSchemeById(screenSchemeId) {
  const response = await api.asApp().requestJira(
    route`/rest/api/3/screenscheme?id=${screenSchemeId}`,
    { headers: { Accept: "application/json" } },
  );

  if (!response.ok) {
    console.error("getScreenSchemeById failed:", response.status);
    return null;
  }

  const data = await response.json();
  const values = data.values || [];
  return values.find((s) => String(s.id) === String(screenSchemeId)) || null;
}

/**
 * Helper: Get all field IDs from a screen by reading all its tabs and their fields.
 * Steps: GET tabs → for each tab, GET fields.
 * Returns array of { id, name } or null on failure.
 */
async function getFieldsFromScreen(screenId) {
  // Step 1: Get all tabs for the screen
  const tabsResponse = await api.asApp().requestJira(
    route`/rest/api/3/screens/${screenId}/tabs`,
    { headers: { Accept: "application/json" } },
  );

  if (!tabsResponse.ok) {
    console.error("getFieldsFromScreen tabs failed:", tabsResponse.status);
    return null;
  }

  const tabs = await tabsResponse.json();
  const allFields = [];

  // Step 2: Get fields for each tab
  for (const tab of tabs) {
    const fieldsResponse = await api.asApp().requestJira(
      route`/rest/api/3/screens/${screenId}/tabs/${tab.id}/fields`,
      { headers: { Accept: "application/json" } },
    );

    if (!fieldsResponse.ok) {
      console.error(`getFieldsFromScreen tab ${tab.id} fields failed:`, fieldsResponse.status);
      continue;
    }

    const tabFields = await fieldsResponse.json();
    allFields.push(...tabFields);
  }

  return allFields;
}

/**
 * Resolver: Get available Jira fields filtered by screen context.
 * Uses the screen scheme API chain to return only fields on the relevant screen.
 * Falls back to all fields (with heuristic filtering for create transitions).
 */
resolver.define("getScreenFields", async ({ payload }) => {
  const { projectId: directProjectId, workflowId, transitionId } = payload;
  // Create transitions always have transitionId "1" in Jira
  const isCreateTransition = String(transitionId) === "1";

  // Resolve projectId: use direct value if provided, otherwise look up via workflowId
  let projectId = directProjectId;
  if (!projectId && workflowId) {
    console.log(`getScreenFields: no projectId, resolving from workflowId="${workflowId}"`);
    const projectIds = await fetchProjectsForWorkflow(workflowId);
    if (projectIds && projectIds.length > 0) {
      projectId = projectIds[0];
      console.log(`getScreenFields: resolved projectId=${projectId} from workflow (${projectIds.length} project(s) total)`);
    }
  }

  console.log(`getScreenFields: projectId=${projectId}, transitionId=${transitionId}, isCreateTransition=${isCreateTransition}`);

  if (!projectId) {
    console.log("getScreenFields: no projectId available, falling back to all fields");
    return await getFallbackFields(isCreateTransition);
  }

  try {
    // Step 1: Get issue type screen scheme for this project
    const itsScheme = await getIssueTypeScreenSchemeForProject(projectId);
    if (!itsScheme) throw new Error("No issue type screen scheme found for project");
    console.log(`Screen resolution: issueTypeScreenScheme id=${itsScheme.id}`);

    // Step 2: Get mappings (issueType → screenScheme)
    // Use the "default" mapping since we don't know the issue type at config time
    const mappings = await getScreenSchemeMappings(itsScheme.id);
    if (!mappings || mappings.length === 0) throw new Error("No screen scheme mappings found");

    const defaultMapping = mappings.find((m) => m.issueTypeId === "default");
    if (!defaultMapping) throw new Error("No default screen scheme mapping found");
    console.log(`Screen resolution: default screenSchemeId=${defaultMapping.screenSchemeId}`);

    // Step 3: Get screen scheme (maps operations → screen IDs)
    const screenScheme = await getScreenSchemeById(defaultMapping.screenSchemeId);
    if (!screenScheme) throw new Error("Screen scheme not found");

    const screens = screenScheme.screens || {};
    console.log(`Screen resolution: screens=`, JSON.stringify(screens));

    // Step 4: Pick the right screen(s) based on transition type
    let screenIds = [];
    if (isCreateTransition) {
      const createScreenId = screens.create || screens.default;
      if (createScreenId) screenIds.push(createScreenId);
    } else {
      // For non-create transitions, collect fields from both edit and view screens
      const editScreenId = screens.edit || screens.default;
      const viewScreenId = screens.view || screens.default;
      if (editScreenId) screenIds.push(editScreenId);
      if (viewScreenId && viewScreenId !== editScreenId) screenIds.push(viewScreenId);
    }

    if (screenIds.length === 0) throw new Error("No screen IDs found for transition type");

    // Step 5: Get fields from all target screens (union)
    const screenFieldMap = new Map();
    for (const screenId of screenIds) {
      const screenFields = await getFieldsFromScreen(screenId);
      if (screenFields) {
        for (const sf of screenFields) {
          screenFieldMap.set(sf.id, sf);
        }
      }
    }

    if (screenFieldMap.size === 0) throw new Error("No fields found on target screens");
    console.log(`Screen resolution: found ${screenFieldMap.size} unique fields from ${screenIds.length} screen(s)`);

    // Step 6: Get full field metadata and filter to screen fields only
    const allFieldsResponse = await api.asApp().requestJira(
      route`/rest/api/3/field`,
      { headers: { Accept: "application/json" } },
    );

    if (!allFieldsResponse.ok) throw new Error(`Failed to fetch field metadata: ${allFieldsResponse.status}`);

    const allFields = await allFieldsResponse.json();
    let fields = allFields
      .filter((f) => screenFieldMap.has(f.id))
      .map(formatField);

    // On CREATE transitions, filter out fields that aren't available during creation
    if (isCreateTransition) {
      fields = fields.filter((f) => !FIELDS_UNAVAILABLE_ON_CREATE.has(f.id));
    }

    return {
      success: true,
      fields: sortFields(fields),
      source: "screen",
      isCreateTransition,
    };
  } catch (error) {
    console.log(`Screen-based field resolution failed, falling back (isCreateTransition=${isCreateTransition}):`, error.message);
    return await getFallbackFields(isCreateTransition);
  }
});

/**
 * Resolver: Get available Jira fields
 * Returns system and custom fields with their type information
 */
resolver.define("getFields", async () => {
  try {
    const response = await api.asApp().requestJira(route`/rest/api/3/field`, {
      headers: {
        Accept: "application/json",
      },
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
    const fields = allFields.map(formatField);

    return { success: true, fields: sortFields(fields) };
  } catch (error) {
    console.error("Failed to get fields:", error);
    return { success: false, error: error.message, fields: [] };
  }
});

// === BYOK (Bring Your Own Key) Resolvers ===

/**
 * Save a user-provided OpenAI API key (BYOK).
 * Validates the key format before storing.
 */
resolver.define("saveOpenAIKey", async ({ payload }) => {
  try {
    const { key } = payload;
    if (!key || typeof key !== "string" || !key.startsWith("sk-")) {
      return { success: false, error: "Invalid API key format. Must start with sk-" };
    }
    await storage.set("COGNIRUNNER_OPENAI_API_KEY", key);
    return { success: true };
  } catch (error) {
    console.error("Failed to save OpenAI key:", error);
    return { success: false, error: error.message };
  }
});

/**
 * Get BYOK status. Never returns the actual key to the frontend.
 */
resolver.define("getOpenAIKey", async () => {
  try {
    const byokKey = await storage.get("COGNIRUNNER_OPENAI_API_KEY");
    return {
      success: true,
      hasKey: !!byokKey || !!process.env.OPENAI_API_KEY,
      isByok: !!byokKey,
    };
  } catch (error) {
    console.error("Failed to check OpenAI key:", error);
    return { success: false, hasKey: !!process.env.OPENAI_API_KEY, isByok: false };
  }
});

/**
 * Remove the BYOK key, reverting to factory key.
 * Also clears the saved model selection since factory key has no model choice.
 */
resolver.define("removeOpenAIKey", async () => {
  try {
    await storage.delete("COGNIRUNNER_OPENAI_API_KEY");
    await storage.delete("COGNIRUNNER_OPENAI_MODEL");
    return { success: true };
  } catch (error) {
    console.error("Failed to remove OpenAI key:", error);
    return { success: false, error: error.message };
  }
});

/**
 * Get available OpenAI models.
 * - If BYOK: fetches from OpenAI /v1/models API using user's key.
 * - If factory: returns empty array (no model choice — factory model is fixed).
 */
resolver.define("getOpenAIModels", async () => {
  try {
    const byokKey = await storage.get("COGNIRUNNER_OPENAI_API_KEY");
    if (!byokKey) {
      // Factory key — no model selection available
      const factoryModel = process.env.OPENAI_MODEL || "gpt-5-mini";
      return { success: true, models: [], isByok: false, currentModel: factoryModel };
    }

    // BYOK — fetch available models from OpenAI
    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: { Authorization: `Bearer ${byokKey}` },
    });

    if (!response.ok) {
      return { success: false, error: "Failed to fetch models. Check your API key.", models: [], isByok: true };
    }

    const data = await response.json();
    const chatModels = (data.data || [])
      .filter((m) => /^(gpt-|o1-|o3-|o4-)/.test(m.id))
      .map((m) => m.id)
      .sort();

    return { success: true, models: chatModels.slice(0, 30), isByok: true };
  } catch (error) {
    console.error("Failed to get OpenAI models:", error);
    return { success: false, error: error.message, models: [], isByok: false };
  }
});

/**
 * Save the user's model selection. Only works when BYOK is active.
 */
resolver.define("saveOpenAIModel", async ({ payload }) => {
  try {
    const { model } = payload;
    if (!model || typeof model !== "string") {
      return { success: false, error: "Invalid model selection" };
    }
    const byokKey = await storage.get("COGNIRUNNER_OPENAI_API_KEY");
    if (!byokKey) {
      return { success: false, error: "Model selection requires a BYOK API key" };
    }
    await storage.set("COGNIRUNNER_OPENAI_MODEL", model);
    return { success: true };
  } catch (error) {
    console.error("Failed to save OpenAI model:", error);
    return { success: false, error: error.message };
  }
});

/**
 * Get the currently saved model from KVS (or null if factory).
 */
resolver.define("getOpenAIModelFromKVS", async () => {
  try {
    const byokKey = await storage.get("COGNIRUNNER_OPENAI_API_KEY");
    if (!byokKey) {
      const factoryModel = process.env.OPENAI_MODEL || "gpt-5-mini";
      return { success: true, model: factoryModel, isByok: false };
    }
    const savedModel = await storage.get("COGNIRUNNER_OPENAI_MODEL");
    return { success: true, model: savedModel || null, isByok: true };
  } catch (error) {
    console.error("Failed to get model from KVS:", error);
    return { success: false, model: null, isByok: false };
  }
});

// === Post-Function Configuration Resolvers ===

/**
 * Register (create/update) a post-function configuration.
 */
resolver.define("registerPostFunction", async ({ payload }) => {
  try {
    const { id, type, fieldId, prompt, conditionPrompt, actionPrompt, actionFieldId, functions, workflow } = payload;
    if (!id) return { success: false, error: "Missing post-function ID" };
    if (!type) return { success: false, error: "Missing post-function type" };

    let configs = (await storage.get(CONFIG_REGISTRY_KEY)) || [];

    const existing = configs.findIndex((c) => c.id === id);
    const entry = {
      id,
      type,
      fieldId: fieldId || "",
      prompt: prompt || "",
      conditionPrompt: (conditionPrompt || "").substring(0, 500),
      actionPrompt: (actionPrompt || "").substring(0, 500),
      actionFieldId: actionFieldId || "",
      functions: functions || [],
      workflow: workflow || {},
      disabled: existing >= 0 ? configs[existing].disabled : false,
      createdAt: existing >= 0 ? configs[existing].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (existing >= 0) {
      configs[existing] = entry;
    } else {
      configs.push(entry);
    }

    await storage.set(CONFIG_REGISTRY_KEY, configs);
    return { success: true };
  } catch (error) {
    console.error("Failed to register post-function:", error);
    return { success: false, error: error.message };
  }
});

/**
 * Remove a post-function configuration by ID.
 */
resolver.define("removePostFunction", async ({ payload }) => {
  try {
    const { id } = payload;
    let configs = (await storage.get(CONFIG_REGISTRY_KEY)) || [];
    configs = configs.filter((c) => c.id !== id);
    await storage.set(CONFIG_REGISTRY_KEY, configs);
    return { success: true };
  } catch (error) {
    console.error("Failed to remove post-function:", error);
    return { success: false, error: error.message };
  }
});

/**
 * Disable a post-function (skip execution without removing config).
 */
resolver.define("disablePostFunction", async ({ payload }) => {
  try {
    const { id } = payload;
    let configs = (await storage.get(CONFIG_REGISTRY_KEY)) || [];
    const idx = configs.findIndex((c) => c.id === id);
    if (idx < 0) return { success: false, error: "Post-function not found" };
    configs[idx].disabled = true;
    configs[idx].updatedAt = new Date().toISOString();
    await storage.set(CONFIG_REGISTRY_KEY, configs);
    return { success: true, disabled: true };
  } catch (error) {
    console.error("Failed to disable post-function:", error);
    return { success: false, error: error.message };
  }
});

/**
 * Re-enable a disabled post-function.
 */
resolver.define("enablePostFunction", async ({ payload }) => {
  try {
    const { id } = payload;
    let configs = (await storage.get(CONFIG_REGISTRY_KEY)) || [];
    const idx = configs.findIndex((c) => c.id === id);
    if (idx < 0) return { success: false, error: "Post-function not found" };
    configs[idx].disabled = false;
    configs[idx].updatedAt = new Date().toISOString();
    await storage.set(CONFIG_REGISTRY_KEY, configs);
    return { success: true, disabled: false };
  } catch (error) {
    console.error("Failed to enable post-function:", error);
    return { success: false, error: error.message };
  }
});

/**
 * Check if a post-function exists and its disabled status.
 */
resolver.define("getPostFunctionStatus", async ({ payload }) => {
  try {
    const { id } = payload;
    const configs = (await storage.get(CONFIG_REGISTRY_KEY)) || [];
    const config = configs.find((c) => c.id === id);
    if (!config) return { success: true, exists: false };
    return { success: true, exists: true, disabled: config.disabled === true };
  } catch (error) {
    console.error("Failed to get post-function status:", error);
    return { success: false, error: error.message };
  }
});

/**
 * Generate JavaScript code for a static post-function using OpenAI.
 * The AI knows the full sandbox API surface and generates working code
 * from a natural language description.
 */
resolver.define("generatePostFunctionCode", async ({ payload }) => {
  const { prompt, operationType, endpoint, method, includeBackoff, contextDocs } = payload;
  if (!prompt || typeof prompt !== "string") {
    return { success: false, error: "Please describe what this step should do" };
  }

  try {
    const apiKey = await getOpenAIKey();
    if (!apiKey) {
      return { success: false, error: "No OpenAI API key configured. Set one in the Admin panel." };
    }
    // Always use the best available model for code generation — code quality
    // matters more than token cost here. Fall back to configured model only
    // if the top model is unavailable.
    const CODE_GEN_MODEL = "gpt-4.1";
    const configuredModel = await getOpenAIModel();
    const model = CODE_GEN_MODEL || configuredModel;

    const systemPrompt = `You are a code generator for Jira workflow post-functions. You write JavaScript code that runs inside a sandboxed environment after a Jira workflow transition.

## Available API

The code receives an \`api\` object with these methods:

### api.getIssue(issueKey)
Fetches a Jira issue by key. Returns the full issue object:
\`\`\`json
{
  "key": "PROJ-123",
  "fields": {
    "summary": "Issue title",
    "description": { /* ADF document */ },
    "status": { "name": "To Do", "id": "10000" },
    "issuetype": { "name": "Bug" },
    "priority": { "name": "High" },
    "assignee": { "displayName": "John", "accountId": "..." },
    "reporter": { "displayName": "Jane", "accountId": "..." },
    "labels": ["backend", "urgent"],
    "components": [{ "name": "API" }],
    "created": "2025-01-15T10:30:00.000+0000",
    "updated": "2025-01-16T14:20:00.000+0000",
    "customfield_XXXXX": "custom value"
  }
}
\`\`\`

### api.updateIssue(issueKey, fieldsObject)
Updates fields on a Jira issue. The fieldsObject keys are field IDs:
\`\`\`javascript
await api.updateIssue("PROJ-123", {
  summary: "New summary",
  description: {
    type: "doc", version: 1,
    content: [{ type: "paragraph", content: [{ type: "text", text: "New description" }] }]
  },
  labels: ["bug", "reviewed"],
  priority: { name: "High" },
  assignee: { accountId: "user-account-id" }
});
\`\`\`

### api.searchJql(jqlQuery)
Searches Jira issues using JQL. Returns up to 20 results:
\`\`\`javascript
const results = await api.searchJql('project = PROJ AND status = "To Do" AND summary ~ "login"');
// results.issues = [{ key, fields: { summary, status, ... } }, ...]
// results.total = total number of matches
\`\`\`

### api.transitionIssue(issueKey, transitionId)
Moves an issue to a different status. You need the transition ID (not the status name).

### api.log(message)
Logs a debug message. Visible in execution logs and test results.

### api.context
Object with: \`{ issueKey: "PROJ-123" }\` — the current issue being transitioned.

## Rules
- Write ONLY the function body (no function wrapper, no exports).
- Use \`async/await\` for all API calls.
- Always handle errors with try/catch.
- Use \`api.log()\` for debugging and status messages.
- Use \`return\` to pass results to the next step in the chain.
- The code runs in a Forge runtime (Node.js 22). No browser APIs.
- Keep code concise and production-ready.
- For ADF (Atlassian Document Format) description fields, create proper ADF structures.
${includeBackoff ? `- Include an exponential backoff retry wrapper with jitter for API calls (3 retries, delays 1s/2s/4s + random jitter up to 30% of delay).` : ""}
${operationType === "rest_api_internal" ? `- The user wants to use the Jira REST API. Method: ${method || "GET"}. Endpoint hint: ${endpoint || "not specified"}.` : ""}
${operationType === "rest_api_external" ? `- The user wants to call an external API. URL hint: ${endpoint || "not specified"}. Note: external domains must be whitelisted in manifest.yml.` : ""}
${operationType === "confluence_api" ? `- The user wants to interact with Confluence. Operation: ${method || "GET_PAGE"}.` : ""}
${operationType === "work_item_query" ? `- The user wants to search Jira issues using JQL.` : ""}
${operationType === "log_function" ? `- The user wants to log debug information.` : ""}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_completion_tokens: 2000,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate JavaScript code for this post-function step:\n\n${prompt}${contextDocs ? `\n\n## Additional Context / Reference Documentation\n\n${contextDocs.substring(0, 10000)}` : ""}` },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI code generation error:", response.status, errText);
      return { success: false, error: `AI error (${response.status}). Check your API key.` };
    }

    const data = await response.json();
    let code = data.choices?.[0]?.message?.content || "";

    // Strip markdown code fences if present
    code = code.replace(/^```(?:javascript|js)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

    return { success: true, code };
  } catch (error) {
    console.error("Code generation error:", error);
    return { success: false, error: error.message };
  }
});

/**
 * Test a static post-function code in dry-run mode.
 * Executes the code with a mock issue context — no actual changes are made.
 */
/**
 * Test a static post-function code against real or mock Jira data.
 *
 * Modes:
 *   - issueKey provided: fetches REAL issue data, but write operations are
 *     intercepted and logged (dry-run). getIssue and searchJql return real data.
 *   - jql provided (no issueKey): runs the JQL, uses the first result as the test issue.
 *   - neither provided: uses mock data.
 *
 * Write operations (updateIssue, transitionIssue) are ALWAYS dry-run —
 * they log what would happen but never mutate Jira data.
 */
resolver.define("testPostFunction", async ({ payload }) => {
  const { code, issueKey, jql } = payload;
  if (!code || typeof code !== "string") {
    return { success: false, logs: ["No code provided"] };
  }

  const testLogs = [];
  const testChanges = [];
  const startTime = Date.now();

  // Resolve the test issue key
  let resolvedKey = issueKey || null;
  let mode = "mock";

  if (resolvedKey) {
    mode = "live";
    testLogs.push(`Testing against real issue: ${resolvedKey}`);
  } else if (jql) {
    mode = "live";
    testLogs.push(`Running JQL to find test issue: ${jql}`);
    try {
      const searchRes = await api.asApp().requestJira(
        route`/rest/api/3/search`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jql, maxResults: 1 }) },
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.issues && searchData.issues.length > 0) {
          resolvedKey = searchData.issues[0].key;
          testLogs.push(`Found: ${resolvedKey} (${searchData.total} total matches)`);
        } else {
          testLogs.push("JQL returned no results. Falling back to mock data.");
          mode = "mock";
        }
      } else {
        testLogs.push(`JQL search failed (${searchRes.status}). Falling back to mock data.`);
        mode = "mock";
      }
    } catch (e) {
      testLogs.push(`JQL search error: ${e.message}. Falling back to mock data.`);
      mode = "mock";
    }
  }

  if (mode === "mock") {
    resolvedKey = "MOCK-1";
    testLogs.push("Using mock issue data (no issue specified).");
  }

  // Build API surface — reads are live when an issue exists, writes are always dry-run
  const testApi = {
    getIssue: async (key) => {
      const lookupKey = key || resolvedKey;
      if (mode === "live") {
        testLogs.push(`getIssue("${lookupKey}") — fetching real data`);
        try {
          const res = await api.asApp().requestJira(
            route`/rest/api/3/issue/${lookupKey}?expand=renderedFields`,
          );
          if (!res.ok) {
            testLogs.push(`getIssue failed (${res.status}) — using error placeholder`);
            return { key: lookupKey, fields: {}, error: `HTTP ${res.status}` };
          }
          const data = await res.json();
          testLogs.push(`getIssue("${lookupKey}") — OK (${data.fields?.summary || "no summary"})`);
          return data;
        } catch (e) {
          testLogs.push(`getIssue error: ${e.message}`);
          return { key: lookupKey, fields: {}, error: e.message };
        }
      }
      testLogs.push(`getIssue("${lookupKey}") — mock data`);
      return {
        key: lookupKey,
        fields: {
          summary: "[Mock] Sample issue for testing",
          status: { name: "To Do", id: "10000" },
          issuetype: { name: "Task" },
          priority: { name: "Medium" },
          description: "This is mock data. Specify an issue key or JQL for real data.",
          assignee: null,
          reporter: { displayName: "Test User" },
          labels: [],
          created: new Date().toISOString(),
        },
      };
    },

    updateIssue: async (key, fields) => {
      testLogs.push(`updateIssue("${key}", ${JSON.stringify(fields)}) — DRY RUN, no changes made`);
      testChanges.push({ action: "updateIssue", key, fields });
      return { success: true };
    },

    searchJql: async (searchJql) => {
      if (mode === "live") {
        testLogs.push(`searchJql("${searchJql}") — running real search`);
        try {
          const res = await api.asApp().requestJira(
            route`/rest/api/3/search`,
            { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jql: searchJql, maxResults: 10 }) },
          );
          if (!res.ok) {
            testLogs.push(`searchJql failed (${res.status})`);
            return { issues: [], total: 0 };
          }
          const data = await res.json();
          testLogs.push(`searchJql — found ${data.total} issues (returning first ${data.issues?.length || 0})`);
          return data;
        } catch (e) {
          testLogs.push(`searchJql error: ${e.message}`);
          return { issues: [], total: 0 };
        }
      }
      testLogs.push(`searchJql("${searchJql}") — mock, returning empty`);
      return { issues: [], total: 0 };
    },

    transitionIssue: async (key, transitionId) => {
      testLogs.push(`transitionIssue("${key}", "${transitionId}") — DRY RUN, no transition made`);
      testChanges.push({ action: "transitionIssue", key, transitionId });
      return { success: true };
    },

    log: (...args) => {
      const msg = args.map((a) => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ");
      testLogs.push(msg);
    },

    context: { issueKey: resolvedKey },
  };

  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const sandboxFn = new AsyncFunction("api", code);
    const result = await sandboxFn(testApi);
    if (result !== undefined) {
      testLogs.push("Return value: " + (typeof result === "object" ? JSON.stringify(result) : String(result)));
    }
    return {
      success: true,
      mode,
      issueKey: resolvedKey,
      logs: testLogs,
      changes: testChanges,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    testLogs.push("ERROR: " + error.message);
    return {
      success: false,
      mode,
      issueKey: resolvedKey,
      logs: testLogs,
      changes: testChanges,
      executionTimeMs: Date.now() - startTime,
    };
  }
});

export const handler = resolver.getDefinitions();

/**
 * Get the OpenAI API key — checks BYOK (user-provided) key first, falls back to factory key.
 */
const getOpenAIKey = async () => {
  try {
    const byokKey = await storage.get("COGNIRUNNER_OPENAI_API_KEY");
    if (byokKey) return byokKey;
  } catch (error) {
    console.error("Error reading BYOK API key from storage:", error);
  }
  return process.env.OPENAI_API_KEY;
};

/**
 * Check if a BYOK key is configured (does not return the key itself).
 */
const isByokActive = async () => {
  try {
    const byokKey = await storage.get("COGNIRUNNER_OPENAI_API_KEY");
    return !!byokKey;
  } catch (error) {
    return false;
  }
};

/**
 * Get the OpenAI model — if BYOK, checks user-saved model; if factory, returns env var model.
 */
const getOpenAIModel = async () => {
  try {
    const byok = await isByokActive();
    if (byok) {
      const savedModel = await storage.get("COGNIRUNNER_OPENAI_MODEL");
      if (savedModel) return savedModel;
    }
  } catch (error) {
    console.error("Error reading OpenAI model from storage:", error);
  }
  return process.env.OPENAI_MODEL || "gpt-5-mini";
};

/**
 * Extract plain text from Atlassian Document Format (ADF)
 * Used for description and other rich text fields
 */
const extractTextFromADF = (adfContent) => {
  if (!adfContent) return "";
  if (typeof adfContent === "string") return adfContent;

  const parts = [];

  // Block-level node types that should be separated by newlines
  const blockTypes = new Set([
    "paragraph", "heading", "blockquote", "codeBlock",
    "rule", "mediaSingle", "mediaGroup", "bulletList",
    "orderedList", "listItem", "table", "tableRow",
    "tableHeader", "tableCell", "panel", "decisionList",
    "decisionItem", "taskList", "taskItem", "expand",
  ]);

  const extractFromNode = (node) => {
    if (!node) return;

    // Text nodes
    if (node.type === "text" && node.text) {
      parts.push(node.text);
    }

    // Inline nodes with attrs-based content
    if (node.type === "mention" && node.attrs?.text) {
      parts.push(node.attrs.text);
    } else if (node.type === "emoji" && node.attrs?.shortName) {
      parts.push(node.attrs.shortName);
    } else if (node.type === "inlineCard" && node.attrs?.url) {
      parts.push(node.attrs.url);
    } else if (node.type === "date" && node.attrs?.timestamp) {
      // Convert Unix timestamp to readable date
      const ts = Number(node.attrs.timestamp);
      parts.push(isNaN(ts) ? node.attrs.timestamp : new Date(ts).toISOString().split("T")[0]);
    } else if (node.type === "status" && node.attrs?.text) {
      parts.push(node.attrs.text);
    } else if (node.type === "hardBreak") {
      parts.push("\n");
    }

    // Recurse into child content
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach((child, index) => {
        extractFromNode(child);
        // Add newline after block-level children (except the last one)
        if (blockTypes.has(child.type) && index < node.content.length - 1) {
          parts.push("\n");
        }
      });
    }
  };

  extractFromNode(adfContent);
  return parts.join("").trim();
};

/**
 * Extract a human-readable text value from any Jira field type
 * Based on Jira REST API field structures:
 * https://developer.atlassian.com/server/jira/platform/jira-rest-api-examples/
 */
const extractFieldDisplayValue = (value) => {
  // Null or undefined
  if (value === null || value === undefined) {
    return "";
  }

  // Simple string or number
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  // Boolean
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  // Array of values (MultiSelect, MultiUserPicker, Labels, Components, Versions, etc.)
  if (Array.isArray(value)) {
    // Checklist for Jira (Okapya) — flat array format from Jira REST API
    // Format: [{ name: "...", checked: true/false, mandatory: false, rank: 1, ... }]
    if (value.length > 0 && value[0].name !== undefined && value[0].checked !== undefined) {
      return value
        .map((item) => `[${item.checked ? "x" : " "}] ${item.name}`)
        .join("\n");
    }
    return value
      .map((item) => extractFieldDisplayValue(item))
      .filter((v) => v)
      .join(", ");
  }

  // Object types - extract based on common Jira field structures
  if (typeof value === "object") {
    // ADF content (description, text areas)
    if (value.type === "doc" && value.content) {
      return extractTextFromADF(value);
    }

    // Attachment objects — { id, filename, size, mimeType, author, created, ... }
    if (value.filename && value.mimeType !== undefined) {
      const parts = [value.filename];
      if (value.size !== undefined) parts.push(`(${Math.round(value.size / 1024)}KB)`);
      if (value.mimeType) parts.push(`[${value.mimeType}]`);
      return parts.join(" ");
    }

    // User fields (assignee, reporter, UserPicker, MultiUserPicker)
    // Format: { accountId: "...", displayName: "...", emailAddress: "..." }
    if (value.displayName) {
      return value.displayName;
    }
    if (value.name && value.accountId) {
      return value.name; // Fallback to name if displayName not present
    }

    // Cascading Select — must come before generic value.value check
    // Format: { value: "parent", child: { value: "child" } }
    if (value.value && value.child) {
      const parent = value.value;
      const child = value.child?.value || "";
      return child ? `${parent} > ${child}` : parent;
    }

    // Project fields (ProjectPicker) — must come before generic value.name
    // Format: { id: "...", key: "PROJ", name: "Project Name" }
    if (value.key && value.name) {
      return `${value.name} (${value.key})`;
    }

    // Sprint field (from Jira Software) — must come before generic value.name
    // Format: { id: 1, name: "Sprint 1", state: "active" }
    if (value.name && value.state) {
      return value.name;
    }

    // Version fields (FixVersion, AffectsVersion, VersionPicker) — must come before generic value.name
    // Format: { id: "...", name: "5.0", released: true }
    if (
      value.name &&
      (value.released !== undefined || value.archived !== undefined)
    ) {
      return value.name;
    }

    // Linked Issues
    // Format: { id: "...", key: "PROJ-123", fields: { summary: "..." } }
    if (value.key && value.fields?.summary) {
      return `${value.key}: ${value.fields.summary}`;
    }

    // Time tracking
    // Format: { originalEstimate: "1d 2h", remainingEstimate: "3h 25m" }
    if (value.originalEstimate || value.remainingEstimate) {
      const parts = [];
      if (value.originalEstimate)
        parts.push(`Original: ${value.originalEstimate}`);
      if (value.remainingEstimate)
        parts.push(`Remaining: ${value.remainingEstimate}`);
      if (value.timeSpent) parts.push(`Spent: ${value.timeSpent}`);
      return parts.join(", ");
    }

    // === Third-party app custom fields ===

    // Checklist for Jira (Okapya) — wrapped object format (alternative to flat array handled above)
    // Format: { items: [{ name: "...", checked: true/false, mandatory: false, rank: 1 }] }
    if (Array.isArray(value.items) && value.items.length > 0 && value.items[0].name !== undefined) {
      return value.items
        .map((item) => `[${item.checked ? "x" : " "}] ${item.name}`)
        .join("\n");
    }

    // Jira Assets / Insight object (single object in array handled by recursion above)
    // Format: { objectId: "...", key: "ASSET-123", label: "MacBook Pro", workspaceId: "..." }
    if (value.objectId && value.label) {
      return value.key ? `${value.label} (${value.key})` : value.label;
    }

    // Select fields (Priority, Status, Resolution, IssueType, SelectList, RadioButtons)
    // Also catches Component { id, name } and Group { name } — which is correct since
    // these only need the name value anyway.
    // Format: { id: "...", name: "...", value: "..." }
    if (value.name) {
      return value.name;
    }
    if (value.value) {
      // Custom select fields use "value" instead of "name"
      return value.value;
    }

    // Third-party/vendor custom field fallbacks (Insight/Assets, Portfolio, etc.)
    if (value.label) return value.label;
    if (value.title) return value.title;
    if (value.text) return value.text;
    if (value.summary) return value.summary;
    if (value.description) return value.description;
    if (value.content && typeof value.content === "string") return value.content;

    // If we can't determine the type, extract key properties for readability
    try {
      const keys = Object.keys(value);
      if (keys.length <= 5) {
        const readable = keys
          .filter((k) => typeof value[k] === "string" || typeof value[k] === "number")
          .map((k) => `${k}: ${value[k]}`)
          .join(", ");
        if (readable) return readable;
      }
      return JSON.stringify(value);
    } catch {
      return "[Complex value]";
    }
  }

  return String(value);
};

// Max single attachment size to download for AI validation (10MB)
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
// Max total attachment size across all files (20MB) — protects Forge memory limits
const MAX_TOTAL_ATTACHMENT_SIZE = 20 * 1024 * 1024;

// MIME types that OpenAI can process natively via the file content type
const FILE_MIME_TYPES = new Set([
  // PDFs
  "application/pdf",
  // Word documents
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/rtf",
  "application/vnd.oasis.opendocument.text",
  // Spreadsheets
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "text/tab-separated-values",
  // Presentations
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
]);

// MIME types that OpenAI can process via the vision/image_url content type
const IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

/**
 * Download a Jira attachment's binary content and return as base64.
 * Uses the attachment content endpoint via Forge's authenticated API.
 * Returns { base64, mimeType, filename } or null on failure.
 */
const downloadAttachment = async (attachment) => {
  try {
    if (!attachment.id) {
      console.log("Attachment missing id, skipping");
      return null;
    }

    // Skip attachments that are too large
    if (attachment.size && attachment.size > MAX_ATTACHMENT_SIZE) {
      console.log(`Attachment "${attachment.filename}" too large (${Math.round(attachment.size / 1024 / 1024)}MB), skipping`);
      return null;
    }

    const mimeType = (attachment.mimeType || "").toLowerCase();

    // Only download file types that OpenAI can process
    if (!FILE_MIME_TYPES.has(mimeType) && !IMAGE_MIME_TYPES.has(mimeType)) {
      console.log(`Attachment "${attachment.filename}" has unsupported type "${mimeType}", skipping content download`);
      return null;
    }

    console.log(`Downloading attachment "${attachment.filename}" (${attachment.id}, ${mimeType})`);

    const response = await api.asApp().requestJira(
      route`/rest/api/3/attachment/content/${attachment.id}`,
    );

    if (!response.ok) {
      console.error(`Failed to download attachment ${attachment.id}:`, response.status);
      return null;
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    return {
      base64,
      mimeType,
      filename: attachment.filename || `attachment_${attachment.id}`,
    };
  } catch (error) {
    console.error(`Error downloading attachment "${attachment.filename}":`, error);
    return null;
  }
};

/**
 * Build OpenAI message content parts from downloaded attachments.
 * Images use the image_url content type; documents use the file content type.
 * Returns array of content parts ready for the messages array.
 */
const buildAttachmentContentParts = (downloadedAttachments) => {
  const parts = [];

  for (const att of downloadedAttachments) {
    if (!att) continue;

    if (IMAGE_MIME_TYPES.has(att.mimeType)) {
      // Vision API: image_url with base64 data URI
      parts.push({
        type: "image_url",
        image_url: {
          url: `data:${att.mimeType};base64,${att.base64}`,
          detail: "auto",
        },
      });
    } else if (FILE_MIME_TYPES.has(att.mimeType)) {
      // File content type for PDFs, DOCX, XLSX, etc.
      parts.push({
        type: "file",
        file: {
          filename: att.filename,
          file_data: `data:${att.mimeType};base64,${att.base64}`,
        },
      });
    }
  }

  return parts;
};

// === Agentic tool infrastructure ===

/**
 * Execute a JQL search against Jira and return results as a JSON string.
 * Used as a tool executor in the agentic validation loop.
 *
 * @param {object} args - Tool arguments from the model
 * @param {string} args.jql - JQL query string
 * @param {string} [validatedFieldId] - The Jira field being validated; included in results so the model can compare field values
 */
const executeJqlSearch = async ({ jql }, validatedFieldId) => {
  try {
    // Always request summary + status; also request the validated field if it's not already summary
    const fields = ["summary", "status"];
    if (validatedFieldId && validatedFieldId !== "summary" && validatedFieldId !== "status") {
      fields.push(validatedFieldId);
    }

    const response = await api.asApp().requestJira(
      route`/rest/api/3/search/jql`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          jql,
          fields,
          maxResults: MAX_JQL_RESULTS,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("JQL search failed:", response.status, errorText.substring(0, 200));
      return JSON.stringify({
        error: `JQL search failed (${response.status}): ${errorText.substring(0, 200)}`,
        issues: [],
      });
    }

    const data = await response.json();
    const issues = (data.issues || []).map((issue) => {
      const result = {
        key: issue.key,
        summary: issue.fields?.summary || "(no summary)",
        status: issue.fields?.status?.name || "Unknown",
      };
      // Include the validated field's value (truncated) if it differs from summary
      if (validatedFieldId && validatedFieldId !== "summary" && issue.fields?.[validatedFieldId] != null) {
        const raw = extractFieldDisplayValue(issue.fields[validatedFieldId]);
        if (raw) {
          result[validatedFieldId] = raw.substring(0, 500);
        }
      }
      return result;
    });

    return JSON.stringify({ total: issues.length, issues });
  } catch (error) {
    console.error("JQL search error:", error);
    return JSON.stringify({ error: `JQL search error: ${error.message}`, issues: [] });
  }
};

/**
 * Tool registry — maps tool names to their OpenAI function definition and executor.
 * To add a new tool, add an entry here with { definition, execute }.
 */
const TOOL_REGISTRY = {
  search_jira_issues: {
    definition: {
      type: "function",
      function: {
        name: "search_jira_issues",
        description: "Search for Jira issues using JQL (Jira Query Language). Use this to find similar issues, check for duplicates, or look up related work. Returns up to 10 issues with their key, summary, status, and the validated field's content (truncated to 500 chars).",
        parameters: {
          type: "object",
          properties: {
            jql: {
              type: "string",
              description: "A JQL query string. Must include a search restriction (project, text, summary, etc.). Examples: 'project = PROJ AND text ~ \"login error\"', 'summary ~ \"payment\" AND status != Done'",
            },
          },
          required: ["jql"],
        },
      },
    },
    execute: executeJqlSearch,
  },
};

/**
 * Call OpenAI API to validate text against a prompt
 * Returns { isValid: boolean, reason: string }
 *
 * @param {string} fieldValue - The text value to validate (can be null for attachment-only validation)
 * @param {string} validationPrompt - The validation criteria
 * @param {Array} [attachmentParts] - Optional OpenAI content parts for attachments (images/files)
 */
const callOpenAI = async (fieldValue, validationPrompt, attachmentParts) => {
  const apiKey = await getOpenAIKey();
  if (!apiKey) {
    console.error("OpenAI API key not configured");
    return {
      isValid: false,
      reason:
        "AI validation not configured. Please set OPENAI_API_KEY environment variable.",
    };
  }

  const model = await getOpenAIModel();

  const hasAttachments = attachmentParts && attachmentParts.length > 0;

  const systemPrompt = hasAttachments
    ? `You are a validation assistant. Your job is to validate content (text, documents, images, and attachments) against specific criteria.
You must respond with ONLY a JSON object in this exact format:
{"isValid": true, "reason": "Brief explanation"}
or
{"isValid": false, "reason": "Brief explanation of why validation failed"}

When validating attachments, analyze the actual content of each file or image provided.
Do not include any other text, markdown, or explanation outside the JSON object.`
    : `You are a validation assistant. Your job is to validate text content against specific criteria.
You must respond with ONLY a JSON object in this exact format:
{"isValid": true, "reason": "Brief explanation"}
or
{"isValid": false, "reason": "Brief explanation of why validation failed"}

Do not include any other text, markdown, or explanation outside the JSON object.`;

  // Build user message content — multimodal when attachments are present
  let userContent;
  if (hasAttachments) {
    const textPart = {
      type: "text",
      text: `Validate the following content against the given criteria.

VALIDATION CRITERIA:
${validationPrompt}

${fieldValue ? `ADDITIONAL TEXT CONTEXT:\n${fieldValue}\n\n` : ""}The attached files/images are the primary content to validate. Analyze their contents thoroughly.

Respond with JSON only.`,
    };
    userContent = [textPart, ...attachmentParts];
  } else {
    userContent = `Validate the following text against the given criteria.

VALIDATION CRITERIA:
${validationPrompt}

TEXT TO VALIDATE:
${fieldValue || "(empty)"}

Respond with JSON only.`;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        max_completion_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      return {
        isValid: false,
        reason: `AI service error: ${response.status}`,
      };
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();

    if (!content) {
      return {
        isValid: false,
        reason: "Empty response from AI service",
      };
    }

    // Parse the JSON response
    const result = JSON.parse(content);
    return {
      isValid: result.isValid === true,
      reason: result.reason || "No reason provided",
    };
  } catch (error) {
    console.error("Error calling OpenAI:", error);
    return {
      isValid: false,
      reason: `AI validation error: ${error.message}`,
    };
  }
};

/**
 * Call OpenAI with tool-calling support for agentic validation.
 * Implements a multi-turn loop: the model can request tool calls (e.g., JQL search),
 * we execute them and feed results back, until the model produces a final JSON answer.
 *
 * @param {string} fieldValue - The text value to validate
 * @param {string} validationPrompt - The validation criteria
 * @param {Array} [attachmentParts] - Optional OpenAI content parts for attachments
 * @param {string} issueContext - Context string about the current issue (key or "new issue")
 * @param {string|null} projectKey - Jira project key (e.g., "PROJ") for scoping JQL searches
 * @param {string} validatedFieldId - The Jira field ID being validated (e.g., "description", "summary")
 * @param {number} deadline - Unix timestamp (ms) after which we must bail out
 * @returns {{ isValid: boolean, reason: string, toolMeta?: object }}
 */
const callOpenAIWithTools = async (fieldValue, validationPrompt, attachmentParts, issueContext, projectKey, validatedFieldId, deadline) => {
  const apiKey = await getOpenAIKey();
  if (!apiKey) {
    console.error("OpenAI API key not configured");
    return {
      isValid: false,
      reason: "AI validation not configured. Please set OPENAI_API_KEY environment variable.",
    };
  }

  const model = await getOpenAIModel();
  const hasAttachments = attachmentParts && attachmentParts.length > 0;

  // Build tool definitions from registry
  const tools = Object.values(TOOL_REGISTRY).map((t) => t.definition);

  const projectScope = projectKey ? `project = ${projectKey}` : null;

  const systemPrompt = `You are a Jira workflow validation gate. You evaluate field content against criteria and return a pass/fail JSON verdict. Be concise, factual, and non-confrontational — users seeing a rejection are already frustrated.

CONTEXT:
${issueContext ? `- ${issueContext}` : "- No issue context available"}
${projectKey ? `- Project: ${projectKey}` : "- Project: unknown"}
- Validated field: ${validatedFieldId || "unknown"}

DECISION FRAMEWORK — when to use tools:
- The criteria involves comparing against OTHER Jira issues (duplicates, similarity, prior work) → SEARCH first, then judge.
- The criteria is about the quality, format, or completeness of THIS content alone → validate directly, do NOT search.

SEARCH STRATEGY (when searching):
- Always scope JQL to the project: ${projectScope ? `use "${projectScope} AND ..."` : "include a project clause if you can infer the project key from the issue context"}.
- The field being validated is "${validatedFieldId}". When the criteria is about comparing that field's content, prefer \`${validatedFieldId} ~ "phrase"\` over \`text ~ "phrase"\` so results are scoped to the same field. Use \`text ~\` only when you need broader cross-field coverage.
- Try multiple approaches: first search by key phrases from the content, then by broader topic terms.
- Extract 2-3 distinct concepts and build targeted queries. Combine with OR for broader coverage.
- If a query returns an error, simplify it and retry — don't waste rounds on syntax fixes.
- Search results include the validated field's content (truncated) so you can compare field values directly.

JUDGMENT CALIBRATION:
- Two issues are duplicates only if they describe the same problem, not merely the same feature area.
- Partial overlap in topic is not sufficient grounds for rejection.
- Different symptoms, environments, or user actions make issues distinct even if the root cause might be related.
- When in doubt, pass — false rejections are worse than missed duplicates.

RESPONSE FORMAT:
- When done, respond with ONLY a JSON object: {"isValid": true, "reason": "..."}  or  {"isValid": false, "reason": "..."}
- Keep reasons to 1-2 sentences.
- On rejection due to potential duplicates, list the specific issue keys and briefly explain why each matches.
- On pass, a simple confirmation is sufficient.
- Do not include any text outside the JSON object.`;

  // Build initial user message
  let userContent;
  if (hasAttachments) {
    const textPart = {
      type: "text",
      text: `Validate the following content against the given criteria.\n\nVALIDATION CRITERIA:\n${validationPrompt}\n\n${fieldValue ? `ADDITIONAL TEXT CONTEXT:\n${fieldValue}\n\n` : ""}The attached files/images are the primary content to validate.\n\nRespond with JSON only when you have your final answer.`,
    };
    userContent = [textPart, ...attachmentParts];
  } else {
    userContent = `Validate the following text against the given criteria.\n\nVALIDATION CRITERIA:\n${validationPrompt}\n\nTEXT TO VALIDATE:\n${fieldValue || "(empty)"}\n\nRespond with JSON only when you have your final answer.`;
  }

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];

  // Observability: track tool usage across the loop
  const toolMeta = {
    toolsUsed: false,
    toolRounds: 0,
    queries: [],    // JQL queries executed
    totalResults: 0, // total Jira issues returned across all queries
  };

  // Agentic loop: up to MAX_TOOL_ROUNDS tool-call iterations + 1 final answer iteration
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    // Timeout check
    if (Date.now() >= deadline) {
      console.log(`Agentic validation timed out at round ${round}`);
      return {
        isValid: true,
        reason: "Validation timed out while gathering context. Transition allowed.",
        toolMeta,
      };
    }

    try {
      const requestBody = {
        model,
        messages,
        max_completion_tokens: 1000,
      };

      // Offer tools only if we haven't exhausted tool-call rounds
      if (round < MAX_TOOL_ROUNDS) {
        requestBody.tools = tools;
        requestBody.tool_choice = "auto";
      }

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenAI API error (agentic):", response.status, errorText);
        return { isValid: false, reason: `AI service error: ${response.status}`, toolMeta };
      }

      const data = await response.json();
      const choice = data.choices[0];
      const message = choice.message;

      // Append assistant message to conversation history
      messages.push(message);

      // Check if the model wants to call tools
      if (message.tool_calls && message.tool_calls.length > 0) {
        toolMeta.toolsUsed = true;
        toolMeta.toolRounds++;
        console.log(`Agentic round ${round}: model requested ${message.tool_calls.length} tool call(s)`);

        for (const toolCall of message.tool_calls) {
          const toolName = toolCall.function.name;
          const tool = TOOL_REGISTRY[toolName];

          let toolResult;
          if (!tool) {
            toolResult = JSON.stringify({ error: `Unknown tool: ${toolName}` });
          } else if (Date.now() >= deadline) {
            toolResult = JSON.stringify({ error: "Timeout: cannot execute tool" });
          } else {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              console.log(`Executing tool "${toolName}":`, JSON.stringify(args));
              toolResult = await tool.execute(args, validatedFieldId);

              // Track JQL queries for observability
              if (toolName === "search_jira_issues" && args.jql) {
                const parsed = JSON.parse(toolResult);
                toolMeta.queries.push(args.jql);
                toolMeta.totalResults += parsed.total || 0;
              }
            } catch (e) {
              console.error(`Tool "${toolName}" execution error:`, e);
              toolResult = JSON.stringify({ error: `Tool execution error: ${e.message}` });
            }
          }

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: toolResult,
          });
        }

        continue; // Next iteration: model processes tool results
      }

      // Model gave a final text response (no tool calls)
      const content = message.content?.trim();
      if (!content) {
        return { isValid: false, reason: "Empty response from AI service", toolMeta };
      }

      const result = JSON.parse(content);
      return {
        isValid: result.isValid === true,
        reason: result.reason || "No reason provided",
        toolMeta,
      };
    } catch (error) {
      console.error(`Error in agentic loop round ${round}:`, error);
      return { isValid: false, reason: `AI validation error: ${error.message}`, toolMeta };
    }
  }

  // Exhausted all rounds without a final answer — fail open
  console.log("Agentic validation exhausted max tool-call rounds");
  return {
    isValid: true,
    reason: "Validation reached maximum tool-call rounds without a final answer. Transition allowed.",
    toolMeta,
  };
};

/**
 * Get field value from issue - handles both modified fields and current issue data
 * On issue CREATE, issueKey will be null and we must use modifiedFields
 *
 * Supports all Jira field types:
 * - Text fields: summary, customfield_XXXXX (text)
 * - Rich text: description, environment, customfield_XXXXX (textarea)
 * - Select fields: priority, status, resolution, issuetype, customfield_XXXXX (select/radio)
 * - Multi-select: labels, components, fixVersions, customfield_XXXXX (multiselect/checkboxes)
 * - User fields: assignee, reporter, customfield_XXXXX (user picker)
 * - Date fields: duedate, customfield_XXXXX (date/datetime)
 * - Number fields: customfield_XXXXX (number)
 * - And more...
 */
const getFieldValue = async (issueKey, fieldId, modifiedFields) => {
  let rawValue = null;

  // Check if the field was modified on the transition screen (or is being created)
  if (modifiedFields && fieldId in modifiedFields) {
    rawValue = modifiedFields[fieldId];
  } else if (!issueKey) {
    // If no issue key (issue creation), we can only use modifiedFields
    console.log(
      `No issue key available and field "${fieldId}" not in modifiedFields`,
    );
    return null;
  } else {
    // Otherwise, fetch the current issue data with renderedFields as fallback
    try {
      const response = await api
        .asApp()
        .requestJira(route`/rest/api/3/issue/${issueKey}?fields=${fieldId}&expand=renderedFields`);

      if (!response.ok) {
        console.error("Failed to fetch issue:", response.status);
        return null;
      }

      const issue = await response.json();
      rawValue = issue.fields?.[fieldId];

      // If the raw value is complex (ADF/object), try renderedFields as a pre-rendered HTML fallback
      if (rawValue && typeof rawValue === "object" && issue.renderedFields?.[fieldId]) {
        const rendered = issue.renderedFields[fieldId];
        if (typeof rendered === "string" && rendered.length > 0) {
          // Strip HTML tags to get plain text — use as fallback only if ADF extraction yields nothing
          const adfResult = extractFieldDisplayValue(rawValue);
          if (!adfResult || adfResult === "[Complex value]") {
            return rendered.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
          }
          return adfResult;
        }
      }
    } catch (error) {
      console.error("Error fetching issue:", error);
      return null;
    }
  }

  // Extract human-readable display value from the raw field value
  return extractFieldDisplayValue(rawValue);
};

/**
 * Workflow Validator / Condition function
 * Called on every transition where this validator/condition is added
 *
 * For validators: returns { result: boolean, errorMessage: string }
 * For conditions: same signature, controls transition visibility
 *
 * Configuration is provided via the Custom UI configuration page
 * and passed in args.configuration
 */
export const validate = async (args) => {
  console.log("AI Validator called with args:", JSON.stringify(args, null, 2));

  const { issue, configuration, modifiedFields } = args;

  // License check: fail open if unlicensed (let transitions pass, skip AI validation)
  const license = args?.context?.license;
  if (license && license.isActive === false) {
    console.log("License inactive — skipping AI validation (fail open)");
    return { result: true };
  }

  // KVS disabled check: if this rule is marked disabled in the config registry, skip validation
  try {
    const configs = (await storage.get(CONFIG_REGISTRY_KEY)) || [];
    const matchingConfig = configs.find((c) =>
      c.fieldId === (configuration?.fieldId || process.env.VALIDATE_FIELD_ID || "description")
      && c.disabled === true
    );
    if (matchingConfig) {
      console.log(`Rule "${matchingConfig.id}" is disabled in KVS — skipping AI validation`);
      return { result: true };
    }
  } catch (e) {
    console.log("Could not check disabled status, proceeding with validation:", e);
  }

  // modifiedFields comes directly from args, not from transition

  // Get configuration from the Custom UI (saved via workflowRules.onConfigure)
  // Falls back to environment variables if not configured
  const fieldId =
    configuration?.fieldId || process.env.VALIDATE_FIELD_ID || "description";
  const validationPrompt =
    configuration?.prompt ||
    process.env.VALIDATION_PROMPT ||
    "The text must be clear, professional, and contain sufficient detail. Reject if it is empty, too vague, or contains inappropriate content.";

  // Determine whether to use agentic tool-calling mode.
  // Three-way logic: explicit override from config, or auto-detect from prompt keywords.
  const enableTools = configuration?.enableTools;
  const useTools = enableTools === true
    || (enableTools !== false && promptRequiresTools(validationPrompt));

  // Extract project key for JQL scoping.
  // From issue key (e.g., "PROJ-123" → "PROJ"), or from modifiedFields.project on CREATE.
  let projectKey = null;
  if (issue.key) {
    const dashIndex = issue.key.indexOf("-");
    if (dashIndex > 0) projectKey = issue.key.substring(0, dashIndex);
  } else if (modifiedFields?.project?.key) {
    projectKey = modifiedFields.project.key;
  }

  // Pre-compute agentic context if tools will be used
  const deadline = useTools ? Date.now() + AGENTIC_TIMEOUT_MS : 0;
  const issueContext = useTools
    ? (issue.key ? `Issue: ${issue.key}` : "New issue (being created)")
    : "";

  console.log(
    `Validating field "${fieldId}" with prompt: ${validationPrompt.substring(0, 50)}... (tools: ${useTools ? "enabled" : "disabled"})`,
  );

  // Attachment field is not available in modifiedFields (Jira platform limitation).
  // On CREATE (no issue key), skip validation since attachments can't be read yet.
  if (fieldId === "attachment" && !issue.key) {
    console.log("Attachment validation skipped on CREATE — field not available until issue exists");
    return { result: true };
  }

  // For attachment fields on existing issues, download and send content to OpenAI
  let validationResult;
  let logFieldValue = "";
  if (fieldId === "attachment" && issue.key) {
    // Fetch attachment metadata from the issue
    let attachments = [];
    try {
      const issueResponse = await api.asApp().requestJira(
        route`/rest/api/3/issue/${issue.key}?fields=attachment`,
      );
      if (issueResponse.ok) {
        const issueData = await issueResponse.json();
        attachments = issueData.fields?.attachment || [];
      } else {
        console.error("Failed to fetch attachments:", issueResponse.status);
      }
    } catch (error) {
      console.error("Error fetching attachments:", error);
    }

    console.log(`Found ${attachments.length} attachment(s) on ${issue.key}`);

    if (attachments.length === 0) {
      // No attachments — send empty to OpenAI for prompt-based validation
      logFieldValue = "(no attachments)";
      validationResult = useTools
        ? await callOpenAIWithTools("(no attachments)", validationPrompt, undefined, issueContext, projectKey, fieldId, deadline)
        : await callOpenAI("(no attachments)", validationPrompt);
    } else {
      // Build attachment summary for logging
      const summary = attachments.map((a) =>
        `${a.filename} (${Math.round((a.size || 0) / 1024)}KB, ${a.mimeType})`
      ).join("; ");
      logFieldValue = summary;
      console.log(`Attachments: ${summary}`);

      // Filter to processable attachments within total size budget
      let totalBudget = MAX_TOTAL_ATTACHMENT_SIZE;
      const toDownload = [];
      for (const att of attachments) {
        const size = att.size || 0;
        if (size > MAX_ATTACHMENT_SIZE) continue;
        const mime = (att.mimeType || "").toLowerCase();
        if (!FILE_MIME_TYPES.has(mime) && !IMAGE_MIME_TYPES.has(mime)) continue;
        if (size > totalBudget) {
          console.log(`Attachment "${att.filename}" (${Math.round(size / 1024)}KB) exceeds remaining budget, skipping`);
          continue;
        }
        totalBudget -= size;
        toDownload.push(att);
      }

      // Download attachment contents in parallel
      const downloads = await Promise.all(toDownload.map(downloadAttachment));
      const successfulDownloads = downloads.filter(Boolean);
      console.log(`Downloaded ${successfulDownloads.length}/${attachments.length} attachment(s)`);

      // Build OpenAI content parts from downloaded files
      const attachmentParts = buildAttachmentContentParts(successfulDownloads);

      // Build text summary for attachments that couldn't be downloaded (unsupported types, too large, budget)
      const downloadedSet = new Set(toDownload.filter((_a, i) => downloads[i]).map((a) => a.id));
      const skippedAttachments = attachments.filter((a) => !downloadedSet.has(a.id));
      let textContext = "";
      if (skippedAttachments.length > 0) {
        textContext = "Attachments that could not be analyzed (unsupported format or too large):\n"
          + skippedAttachments.map((a) => `- ${a.filename} (${a.mimeType}, ${Math.round((a.size || 0) / 1024)}KB)`).join("\n");
      }
      if (attachmentParts.length === 0 && skippedAttachments.length > 0) {
        // All attachments were unsupported — validate based on metadata only
        textContext = `Issue has ${attachments.length} attachment(s) but none could be analyzed:\n`
          + attachments.map((a) => `- ${a.filename} (${a.mimeType}, ${Math.round((a.size || 0) / 1024)}KB)`).join("\n");
      }

      const attParts = attachmentParts.length > 0 ? attachmentParts : undefined;
      validationResult = useTools
        ? await callOpenAIWithTools(textContext, validationPrompt, attParts, issueContext, projectKey, fieldId, deadline)
        : await callOpenAI(textContext, validationPrompt, attParts);
    }
  } else {
    // Standard field validation — get text value and validate
    const fieldValue = await getFieldValue(issue.key, fieldId, modifiedFields);
    logFieldValue = fieldValue || "";

    console.log(
      `Field value (first 100 chars):`,
      String(fieldValue || "").substring(0, 100),
    );

    validationResult = useTools
      ? await callOpenAIWithTools(fieldValue, validationPrompt, undefined, issueContext, projectKey, fieldId, deadline)
      : await callOpenAI(fieldValue, validationPrompt);
  }

  console.log("Validation result:", validationResult);

  // Store the validation log (include tool metadata when agentic mode was used)
  const logEntry = {
    issueKey: issue.key || "(new issue)",
    fieldId,
    fieldValue: String(logFieldValue || "").substring(0, 200),
    prompt: validationPrompt.substring(0, 100),
    isValid: validationResult.isValid,
    reason: validationResult.reason,
  };
  if (validationResult.toolMeta) {
    logEntry.toolMeta = {
      toolsUsed: validationResult.toolMeta.toolsUsed,
      toolRounds: validationResult.toolMeta.toolRounds,
      queries: validationResult.toolMeta.queries.map((q) => q.substring(0, 150)),
      totalResults: validationResult.toolMeta.totalResults,
    };
  }
  await storeLog(logEntry);

  if (validationResult.isValid) {
    return {
      result: true,
    };
  } else {
    return {
      result: false,
      errorMessage: `AI Validation failed: ${validationResult.reason}`,
    };
  }
};

// === Post-Function Execution ===

/**
 * Execute a semantic post-function: AI evaluates condition, then updates target field.
 * Returns { success, decision, value?, reason } — never throws.
 */
const executeSemanticPostFunction = async (issueKey, config) => {
  const { conditionPrompt, actionPrompt, actionFieldId, fieldId } = config;

  // Fetch the current value of the source field
  const fieldValue = await getFieldValue(issueKey, fieldId || "description", null);

  // Build unified prompt: condition evaluation + action instruction
  const systemPrompt = `You are a workflow automation assistant. You will be given a field value and two instructions:
1. CONDITION: Evaluate whether this condition is met based on the field value.
2. ACTION: If the condition is met, generate the new value for the target field.

You MUST respond with ONLY a valid JSON object (no markdown, no explanation):
{
  "decision": "UPDATE" or "SKIP",
  "value": "the new field value (only if UPDATE)",
  "reason": "brief explanation of your decision"
}`;

  const userContent = `Field value:\n${fieldValue || "(empty)"}\n\nCONDITION: ${conditionPrompt}\n\nACTION: ${actionPrompt || "Generate an appropriate value for the target field."}`;

  try {
    const apiKey = await getOpenAIKey();
    if (!apiKey) {
      return { success: false, decision: "SKIP", reason: "No OpenAI API key configured" };
    }
    const model = await getOpenAIModel();

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_completion_tokens: 1000,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI API error in semantic PF:", response.status, errText);
      return { success: false, decision: "SKIP", reason: `OpenAI error: ${response.status}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return { success: false, decision: "SKIP", reason: "Empty response from AI" };
    }

    const result = JSON.parse(content);
    if (result.decision === "UPDATE" && actionFieldId && result.value !== undefined) {
      // Update the target field via Jira REST API
      const updateBody = { fields: { [actionFieldId]: result.value } };
      const updateResponse = await api.asApp().requestJira(
        route`/rest/api/3/issue/${issueKey}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateBody),
        },
      );
      if (!updateResponse.ok) {
        const errText = await updateResponse.text();
        console.error("Failed to update field:", updateResponse.status, errText);
        return { success: false, decision: "UPDATE", reason: `Field update failed: ${updateResponse.status}` };
      }
      console.log(`Semantic PF: Updated field ${actionFieldId} on ${issueKey}`);
      return { success: true, decision: "UPDATE", value: result.value, reason: result.reason };
    }

    return { success: true, decision: "SKIP", reason: result.reason || "Condition not met" };
  } catch (error) {
    console.error("Semantic post-function error:", error);
    return { success: false, decision: "SKIP", reason: error.message };
  }
};

/**
 * Execute a static post-function: runs sandboxed JavaScript code with an API surface.
 * Each function block runs sequentially; results are shared via variable chaining.
 */
const executeStaticPostFunction = async (issueKey, config) => {
  const functions = config.functions || [];
  if (functions.length === 0) {
    return { success: true, changes: [], logs: ["No function blocks to execute"] };
  }

  const executionLogs = [];
  const changes = [];
  const variables = {};
  const startTime = Date.now();

  // Build API surface for sandbox
  const createApi = () => ({
    getIssue: async (key) => {
      const res = await api.asApp().requestJira(route`/rest/api/3/issue/${key}`);
      if (!res.ok) throw new Error(`getIssue failed: ${res.status}`);
      return res.json();
    },
    updateIssue: async (key, fields) => {
      const res = await api.asApp().requestJira(
        route`/rest/api/3/issue/${key}`,
        { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields }) },
      );
      if (!res.ok) throw new Error(`updateIssue failed: ${res.status}`);
      changes.push({ action: "updateIssue", key, fields });
      return { success: true };
    },
    searchJql: async (jql) => {
      const res = await api.asApp().requestJira(
        route`/rest/api/3/search`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jql, maxResults: 20 }) },
      );
      if (!res.ok) throw new Error(`searchJql failed: ${res.status}`);
      return res.json();
    },
    transitionIssue: async (key, transitionId) => {
      const res = await api.asApp().requestJira(
        route`/rest/api/3/issue/${key}/transitions`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transition: { id: transitionId } }) },
      );
      if (!res.ok) throw new Error(`transitionIssue failed: ${res.status}`);
      changes.push({ action: "transitionIssue", key, transitionId });
      return { success: true };
    },
    log: (...args) => {
      const msg = args.map((a) => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ");
      executionLogs.push(msg);
    },
    context: { issueKey },
  });

  for (let i = 0; i < functions.length; i++) {
    const fn = functions[i];
    const fnName = fn.name || `Function ${i + 1}`;

    // Check deadline (leave 5s buffer)
    if (Date.now() - startTime > 25000) {
      executionLogs.push(`Timeout: skipping ${fnName} and remaining functions`);
      break;
    }

    if (!fn.code || fn.code.trim().length === 0) {
      executionLogs.push(`${fnName}: No code to execute, skipping`);
      continue;
    }

    try {
      const sandboxApi = createApi();

      // Inject variable references into code
      let code = fn.code;
      for (const [varName, varValue] of Object.entries(variables)) {
        const placeholder = "${" + varName + "}";
        if (code.includes(placeholder)) {
          code = code.split(placeholder).join(JSON.stringify(varValue));
        }
      }

      // Execute in sandbox via Function constructor
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const sandboxFn = new AsyncFunction("api", code);
      const result = await sandboxFn(sandboxApi);

      // Store result for variable chaining
      if (fn.variableName) {
        variables[fn.variableName] = result;
      }

      executionLogs.push(`${fnName}: completed successfully`);
    } catch (error) {
      executionLogs.push(`${fnName}: ERROR - ${error.message}`);
      console.error(`Static PF ${fnName} error:`, error);
    }
  }

  return {
    success: true,
    changes,
    logs: executionLogs,
    executionTimeMs: Date.now() - startTime,
  };
};

/**
 * Post-function handler — called by Forge after a workflow transition completes.
 * Always returns { result: true } to never block transitions.
 */
export const executePostFunction = async (args) => {
  console.log("Post-function called with args:", JSON.stringify(args, null, 2));

  const { issue, configuration } = args;

  // License check: skip silently if unlicensed
  const license = args?.context?.license;
  if (license && license.isActive === false) {
    console.log("License inactive — skipping post-function");
    return { result: true };
  }

  if (!issue?.key) {
    console.log("No issue key — cannot execute post-function");
    return { result: true };
  }

  // Parse configuration (comes as JSON string from Custom UI onConfigure)
  let config = configuration;
  if (typeof configuration === "string") {
    try {
      config = JSON.parse(configuration);
    } catch (e) {
      console.error("Failed to parse post-function configuration:", e);
      return { result: true };
    }
  }

  if (!config) {
    console.log("No configuration — skipping post-function");
    return { result: true };
  }

  // Check if disabled in KVS
  try {
    const configs = (await storage.get(CONFIG_REGISTRY_KEY)) || [];
    const ruleId = config.ruleId || config.id;
    if (ruleId) {
      const match = configs.find((c) => c.id === ruleId);
      if (match?.disabled) {
        console.log(`Post-function "${ruleId}" is disabled — skipping`);
        return { result: true };
      }
    }
  } catch (e) {
    console.log("Could not check disabled status:", e);
  }

  try {
    const type = config.type || "";
    if (type.includes("semantic")) {
      const result = await executeSemanticPostFunction(issue.key, config);
      console.log("Semantic PF result:", result);
    } else if (type.includes("static")) {
      const result = await executeStaticPostFunction(issue.key, config);
      console.log("Static PF result:", JSON.stringify(result));
    } else {
      console.log("Unknown post-function type:", type);
    }
  } catch (error) {
    // Fail open — never block the transition
    console.error("Post-function execution error:", error);
  }

  return { result: true };
};
