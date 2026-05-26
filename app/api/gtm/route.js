import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/authOptions";
import * as GTM from "../../../lib/gtm";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const accountId = searchParams.get("accountId");
  const containerId = searchParams.get("containerId");
  const workspaceId = searchParams.get("workspaceId");
  const token = session.accessToken;

  try {
    if (action === "accounts") {
      const data = await GTM.listAccounts(token);
      return Response.json(data);
    }
    if (action === "containers") {
      const data = await GTM.listContainers(token, accountId);
      return Response.json(data);
    }
    if (action === "workspaces") {
      const data = await GTM.listWorkspaces(token, accountId, containerId);
      return Response.json(data);
    }
    if (action === "audit") {
      const data = await GTM.runAudit(token, accountId, containerId, workspaceId);
      return Response.json(data);
    }
    if (action === "tags") {
      const path = GTM.wsPath(accountId, containerId, workspaceId);
      const data = await GTM.listTags(token, path);
      return Response.json(data);
    }
    if (action === "triggers") {
      const path = GTM.wsPath(accountId, containerId, workspaceId);
      const data = await GTM.listTriggers(token, path);
      return Response.json(data);
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
  const body = await req.json();
  const { action, accountId, containerId, workspaceId, payload } = body;
  const path = GTM.wsPath(accountId, containerId, workspaceId);

  try {
    if (action === "createTag") {
      const data = await GTM.createTag(token, path, payload);
      return Response.json(data);
    }
    if (action === "createTrigger") {
      const data = await GTM.createTrigger(token, path, payload);
      return Response.json(data);
    }
    if (action === "createVariable") {
      const data = await GTM.createVariable(token, path, payload);
      return Response.json(data);
    }
    if (action === "createFromDataLayer") {
      // payload.events = array of parsed datalayer events
      const results = [];
      for (const event of payload.events) {
        const built = GTM.buildPayloadsFromEvent(event);
        for (const trig of built.triggers) {
          const r = await GTM.createTrigger(token, path, trig);
          results.push({ type: "trigger", name: trig.name, id: r.triggerId });
        }
        for (const v of built.variables) {
          const r = await GTM.createVariable(token, path, v);
          results.push({ type: "variable", name: v.name, id: r.variableId });
        }
      }
      return Response.json({ created: results });
    }
    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
