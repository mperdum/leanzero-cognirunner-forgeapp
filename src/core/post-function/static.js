/*
 * Static Post Function Module - Handles static JavaScript post function execution
 */

import api, { route } from '@forge/api';

/**
 * Execute Static Post Function
 */
export const executeStaticPostFunction = async ({ issueContext, code, dryRun, changelog, transition, workflow, dependencies }) => {
  const { api: injectedApi, route: injectedRoute } = dependencies || { api, route };
  
  console.log(`executeStaticPostFunction: issue=${issueContext.key}`);
  
  // Log transition information (Forge best practice)
  if (transition?.executionId) {
    console.log(`Transition execution ID: ${transition.executionId}`);
  }
  if (changelog && changelog.length > 0) {
    console.log(`Changelog entries: ${changelog.length} field(s) changed`);
    changelog.forEach(entry => {
      console.log(`  - ${entry.field}: "${entry.from}" -> "${entry.to}"`);
    });
  }

  if (dryRun) {
    return await executeStaticCodeSandbox({ issueContext, code, dryRun: true, simulationMode: true, changelog, transition, workflow, dependencies });
  }

  return await executeStaticCodeSandbox({ issueContext, code, dryRun: false, simulationMode: false, changelog, transition, workflow, dependencies });
};

/**
 * Sandboxed JavaScript execution environment
 */
export const executeStaticCodeSandbox = async ({ issueContext, code, dryRun, simulationMode = false, dependencies }) => {
  const { api: injectedApi, route: injectedRoute } = dependencies || { api, route };
  const startTime = Date.now();
  const logs = [];
  const changes = [];

  const apiSurface = {
    getIssue: async (key) => {
      try {
        const r = await injectedApi.asApp().requestJira(injectedRoute`/rest/api/3/issue/${key}?expand=renderedFields`);
        if (!r.ok) throw new Error(`Failed: ${r.status}`);
        const data = await r.json();
        return { key: data.key, fields: data.fields };
      } catch (e) { logs.push(`ERROR: ${e.message}`); throw e; }
    },
    updateIssue: async (key, fields) => {
      if (simulationMode || dryRun) {
        logs.push(`DRY-RUN: ${key} -> ${JSON.stringify(fields)}`);
        changes.push({ key, fields });
        return { success: true };
      }
      try {
        const r = await injectedApi.asApp().requestJira(injectedRoute`/rest/api/3/issue/${key}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields })
        });
        if (!r.ok) throw new Error(`Failed: ${r.status}`);
        logs.push(`Updated: ${key}`);
        changes.push({ key, fields });
        return { success: true };
      } catch (e) { logs.push(`ERROR: ${e.message}`); throw e; }
    },
    searchJql: async (jql) => {
      try {
        const r = await injectedApi.asApp().requestJira(injectedRoute`/rest/api/3/search/jql`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jql, fields: ["summary", "status"], maxResults: 20 })
        });
        if (!r.ok) throw new Error(`Failed: ${r.status}`);
        const data = await r.json();
        return { total: data.total, issues: (data.issues || []).map(i => ({ key: i.key, summary: i.fields?.summary })) };
      } catch (e) { logs.push(`ERROR: ${e.message}`); throw e; }
    },
    transitionIssue: async (key, tid) => {
      if (simulationMode || dryRun) {
        logs.push(`DRY-RUN: Transition ${key} to ${tid}`);
        changes.push({ key, transitionId: tid });
        return { success: true };
      }
      try {
        const r = await injectedApi.asApp().requestJira(injectedRoute`/rest/api/3/issue/${key}/transitions`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transition: { id: tid } })
        });
        if (!r.ok) throw new Error(`Failed: ${r.status}`);
        logs.push(`Transitioned: ${key} to ${tid}`);
        changes.push({ key, transitionId: tid });
        return { success: true };
      } catch (e) { logs.push(`ERROR: ${e.message}`); throw e; }
    },
    log: (...args) => logs.push(args.join(" ")),
    context: issueContext,
  };

  try {
    const fn = new Function('ctx', 'api', `return (async () => { try { ${code} } catch (e) { api.log("ERROR:", e.message); throw e; } })();`);
    await fn(null, apiSurface);
  } catch (e) {
    return { success: false, error: `Syntax or runtime error: ${e.message}`, logs };
  }

  return { success: true, dryRun: dryRun || simulationMode, changes, logs, executionTimeMs: Date.now() - startTime };
};
