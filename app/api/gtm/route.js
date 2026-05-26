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
    if (action === "createTag")      return Response.json(await GTM.createTag(token, path, payload));
    if (action === "createTrigger")  return Response.json(await GTM.createTrigger(token, path, payload));
    if (action === "createVariable") return Response.json(await GTM.createVariable(token, path, payload));
    if (action === "createGtagConfig") return Response.json(await GTM.createGtagConfig(token, path, payload));

    if (action === "createTriggerThenTag") {
      // 1. Create the inline trigger first
      const trig = await GTM.createTrigger(token, path, payload.trigger);
      // 2. Inject the new trigger ID into the tag and create it
      const tagPayload = { ...payload.tag, firingTriggerId: [...(payload.tag.firingTriggerId || []), trig.triggerId] };
      const tag = await GTM.createTag(token, path, tagPayload);
      return Response.json({ trigger: trig, tag });
    }

    if (action === "createFromDataLayer") {
      const results = [];
      for (const event of payload.events) {
        const built = GTM.buildPayloadsFromEvent(event);

        // 1. Create trigger first so we get its ID
        let triggerId = null;
        for (const trig of built.triggers) {
          const r = await GTM.createTrigger(token, path, trig);
          triggerId = r.triggerId;
          results.push({ type: "trigger", name: trig.name, id: r.triggerId });
        }

        // 2. Create variables
        for (const v of built.variables) {
          const r = await GTM.createVariable(token, path, v);
          results.push({ type: "variable", name: v.name, id: r.variableId });
        }

        // 3. Create tag — inject the trigger ID we just got
        for (const tag of built.tags) {
          const tagWithTrigger = {
            ...tag,
            firingTriggerId: triggerId ? [triggerId] : [],
          };
          const r = await GTM.createTag(token, path, tagWithTrigger);
          results.push({ type: "tag", name: tag.name, id: r.tagId, url: r.tagManagerUrl });
        }
      }
      return Response.json({ created: results });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}