import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";
import * as GTM from "../../../lib/gtm";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const action      = searchParams.get("action");
  const accountId   = searchParams.get("accountId");
  const containerId = searchParams.get("containerId");
  const workspaceId = searchParams.get("workspaceId");
  const token       = session.accessToken;

  try {
    if (action === "accounts")   return Response.json(await GTM.listAccounts(token));
    if (action === "containers") return Response.json(await GTM.listContainers(token, accountId));
    if (action === "workspaces") return Response.json(await GTM.listWorkspaces(token, accountId, containerId));
    if (action === "audit")      return Response.json(await GTM.runAudit(token, accountId, containerId, workspaceId));
    if (action === "tags") {
      const path = GTM.wsPath(accountId, containerId, workspaceId);
      return Response.json(await GTM.listTags(token, path));
    }
    if (action === "triggers") {
      const path = GTM.wsPath(accountId, containerId, workspaceId);
      return Response.json(await GTM.listTriggers(token, path));
    }
    if (action === "gtagConfigs") {
      const path = GTM.wsPath(accountId, containerId, workspaceId);
      return Response.json(await GTM.listGtagConfigs(token, path));
    }
    if (action === "checkDuplicates") {
      const path = GTM.wsPath(accountId, containerId, workspaceId);
      const [tagsRes, triggersRes, variablesRes] = await Promise.all([
        GTM.listTags(token, path),
        GTM.listTriggers(token, path),
        GTM.listVariables(token, path),
      ]);
      const existing = {};
      (tagsRes.tag || []).forEach((t) => { existing[t.name] = { type: "tag", id: t.tagId, path: t.path }; });
      (triggersRes.trigger || []).forEach((t) => { existing[t.name] = { type: "trigger", id: t.triggerId, path: t.path }; });
      (variablesRes.variable || []).forEach((v) => { existing[v.name] = { type: "variable", id: v.variableId, path: v.path }; });
      return Response.json({ existing });
    }
    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const token = session.accessToken;
  const body  = await req.json();
  const { action, accountId, containerId, workspaceId, payload } = body;
  const path = GTM.wsPath(accountId, containerId, workspaceId);

  try {
    if (action === "createTag")        return Response.json(await GTM.createTag(token, path, payload));
    if (action === "createTrigger")    return Response.json(await GTM.createTrigger(token, path, payload));
    if (action === "createVariable")   return Response.json(await GTM.createVariable(token, path, payload));
    if (action === "createGtagConfig") return Response.json(await GTM.createGtagConfig(token, path, payload));

    if (action === "createTriggerThenTag") {
      const trig = await GTM.createTrigger(token, path, payload.trigger);
      const tagPayload = { ...payload.tag, firingTriggerId: [...(payload.tag.firingTriggerId || []), trig.triggerId] };
      const tag = await GTM.createTag(token, path, tagPayload);
      return Response.json({ trigger: trig, tag });
    }

    if (action === "createFromDataLayer") {
      const overrideMap = payload.overrideMap || {};
      const results = [];

      for (const event of payload.events) {
        const built = GTM.buildPayloadsFromEvent(event);

        // 1. Trigger — create or update
        let triggerId = null;
        for (const trig of built.triggers) {
          const existing = overrideMap[trig.name];
          let r;
          if (existing?.type === "trigger") {
            r = await GTM.updateTrigger(token, existing.path, { ...trig, triggerId: existing.id });
            results.push({ type: "trigger", name: trig.name, id: r.triggerId, action: "updated" });
          } else {
            r = await GTM.createTrigger(token, path, trig);
            results.push({ type: "trigger", name: trig.name, id: r.triggerId, action: "created" });
          }
          triggerId = r.triggerId;
        }

        // 2. Variables — create or update
        for (const v of built.variables) {
          const existing = overrideMap[v.name];
          if (existing?.type === "variable") {
            const r = await GTM.updateVariable(token, existing.path, { ...v, variableId: existing.id });
            results.push({ type: "variable", name: v.name, id: r.variableId, action: "updated" });
          } else {
            const r = await GTM.createVariable(token, path, v);
            results.push({ type: "variable", name: v.name, id: r.variableId, action: "created" });
          }
        }

        // 3. Tag — create or update
        for (const tag of built.tags) {
          const tagWithTrigger = { ...tag, firingTriggerId: triggerId ? [triggerId] : [] };
          const existing = overrideMap[tag.name];
          if (existing?.type === "tag") {
            const r = await GTM.updateTag(token, existing.path, { ...tagWithTrigger, tagId: existing.id });
            results.push({ type: "tag", name: tag.name, id: r.tagId, url: r.tagManagerUrl, action: "updated" });
          } else {
            const r = await GTM.createTag(token, path, tagWithTrigger);
            results.push({ type: "tag", name: tag.name, id: r.tagId, url: r.tagManagerUrl, action: "created" });
          }
        }
      }
      return Response.json({ created: results });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}