/*
 * JIRA Screens Module - Handles screen-related API operations
 */

import api, { route } from '@forge/api';

/**
 * Helper: Get the issue type screen scheme ID for a project.
 */
export const getIssueTypeScreenSchemeForProject = async (projectId) => {
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
  const entry = values.find((v) =>
    (v.projectIds || []).map(String).includes(String(projectId))
  );
  return entry?.issueTypeScreenScheme || null;
};

/**
 * Helper: Get issue type → screen scheme mappings.
 */
export const getScreenSchemeMappings = async (issueTypeScreenSchemeId) => {
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
};

/**
 * Helper: Get a screen scheme by ID.
 */
export const getScreenSchemeById = async (screenSchemeId) => {
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
};

/**
 * Helper: Get all field IDs from a screen by reading all its tabs and their fields.
 * Returns array of { id, name } or null on failure.
 */
export const getFieldsFromScreen = async (screenId) => {
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
};
