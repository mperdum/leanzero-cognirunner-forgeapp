/*
 * JIRA Workflows Module - Handles workflow-related API operations
 */

import api, { route } from '@forge/api';

/**
 * Helper: Fetch all project IDs that use a given workflow.
 * Returns array of project ID strings, or null on failure.
 */
export const fetchProjectsForWorkflow = async (workflowId) => {
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
};

/**
 * Helper: Search workflows via /rest/api/3/workflows/search and return
 * a Set of transition IDs for the given workflow.
 * Returns { transitionRules: Map<string, { validators, conditions }>|null, error: string|null }
 */
export const fetchWorkflowTransitions = async (workflowName) => {
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
    // Only match workflows whose name exactly matches
    if (wf.name !== workflowName) continue;
    const transitions = wf.transitions || [];
    for (const t of transitions) {
      if (t.id !== undefined) {
        const validators = t.validators || [];
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
};