import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { Type } from "@sinclair/typebox";
// @ts-ignore — internal SDK path
import { resolveSecretRefString } from "openclaw/plugin-sdk/src/secrets/resolve.js";

const BASE_URL = "https://api.trello.com/1";

/** Accept either a plain string or a SecretRef object */
type SecretInput = string | { source: string; provider: string; id: string };

async function resolveSecret(value: SecretInput, config: unknown): Promise<string> {
  if (typeof value === "string") return value;
  // It's a SecretRef object — resolve via OpenClaw SDK
  return resolveSecretRefString(value, { config });
}

function makeFetcher(apiKey: string, token: string) {
  return async function trelloFetch(path: string, method = "GET", body?: Record<string, string>): Promise<unknown> {
    const sep = path.includes("?") ? "&" : "?";
    const url = `${BASE_URL}${path}${sep}key=${apiKey}&token=${token}`;
    const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(`Trello API error ${res.status} on ${method} ${path}`);
    return res.json();
  };
}

function jsonResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export default definePluginEntry({
  id: "openclaw-trello",
  name: "Trello",
  description: "Native Trello tools for OpenClaw — list boards, create/move cards, add comments, manage checklists.",
  configSchema: {
    safeParse: (v) => {
      const val = v as Record<string, unknown>;
      if (!val?.apiKey && !val?.apiKey) {
        return { success: false, error: { message: "plugins.entries.openclaw-trello.config.apiKey is required" } };
      }
      if (!val?.token) {
        return { success: false, error: { message: "plugins.entries.openclaw-trello.config.token is required" } };
      }
      return { success: true, data: val };
    }
  },
  register(api) {
    const cfg = api.pluginConfig as Record<string, SecretInput> | undefined;
    const rawApiKey = cfg?.apiKey ?? process.env.TRELLO_API_KEY ?? "";
    const rawToken = cfg?.token ?? process.env.TRELLO_TOKEN ?? "";

    // Lazily resolve credentials (supports both plain strings and SecretRefs)
    let fetcherPromise: Promise<ReturnType<typeof makeFetcher>> | null = null;
    function getFetcher() {
      if (!fetcherPromise) {
        fetcherPromise = Promise.all([
          resolveSecret(rawApiKey, api.config),
          resolveSecret(rawToken, api.config),
        ]).then(([apiKey, token]) => {
          if (!apiKey || !token) throw new Error("Trello plugin: could not resolve credentials");
          return makeFetcher(apiKey, token);
        });
      }
      return fetcherPromise;
    }

    api.registerTool({
      name: "trello_list_boards",
      label: "Trello: List Boards",
      description: "List all Trello boards accessible with the configured credentials.",
      parameters: Type.Object({}, { additionalProperties: false }),
      execute: async () => {
        const fetch = await getFetcher();
        return jsonResult(await fetch("/members/me/boards?fields=id,name,shortUrl"));
      }
    });

    api.registerTool({
      name: "trello_list_lists",
      label: "Trello: List Columns",
      description: "List all open columns (lists) in a Trello board.",
      parameters: Type.Object({ boardId: Type.String({ description: "Board ID." }) }, { additionalProperties: false }),
      execute: async (_id, p) => {
        const { boardId } = p as { boardId: string };
        const fetch = await getFetcher();
        return jsonResult(await fetch(`/boards/${boardId}/lists?filter=open&fields=id,name,pos`));
      }
    });

    api.registerTool({
      name: "trello_list_cards",
      label: "Trello: List Cards",
      description: "List all open cards in a Trello column (list).",
      parameters: Type.Object({ listId: Type.String({ description: "Column (list) ID." }) }, { additionalProperties: false }),
      execute: async (_id, p) => {
        const { listId } = p as { listId: string };
        const fetch = await getFetcher();
        return jsonResult(await fetch(`/lists/${listId}/cards?fields=id,name,desc,dateLastActivity,shortUrl`));
      }
    });

    api.registerTool({
      name: "trello_create_card",
      label: "Trello: Create Card",
      description: "Create a new card in a Trello column.",
      parameters: Type.Object({
        listId: Type.String({ description: "Column ID." }),
        name: Type.String({ description: "Card title." }),
        desc: Type.Optional(Type.String({ description: "Card description." }))
      }, { additionalProperties: false }),
      execute: async (_id, p) => {
        const { listId, name, desc } = p as { listId: string; name: string; desc?: string };
        const fetch = await getFetcher();
        return jsonResult(await fetch("/cards", "POST", { idList: listId, name, ...(desc ? { desc } : {}) }));
      }
    });

    api.registerTool({
      name: "trello_move_card",
      label: "Trello: Move Card",
      description: "Move a Trello card to a different column.",
      parameters: Type.Object({
        cardId: Type.String({ description: "Card ID." }),
        listId: Type.String({ description: "Destination column ID." })
      }, { additionalProperties: false }),
      execute: async (_id, p) => {
        const { cardId, listId } = p as { cardId: string; listId: string };
        const fetch = await getFetcher();
        return jsonResult(await fetch(`/cards/${cardId}`, "PUT", { idList: listId }));
      }
    });

    api.registerTool({
      name: "trello_add_comment",
      label: "Trello: Add Comment",
      description: "Add a comment to a Trello card.",
      parameters: Type.Object({
        cardId: Type.String({ description: "Card ID." }),
        text: Type.String({ description: "Comment text." })
      }, { additionalProperties: false }),
      execute: async (_id, p) => {
        const { cardId, text } = p as { cardId: string; text: string };
        const fetch = await getFetcher();
        return jsonResult(await fetch(`/cards/${cardId}/actions/comments`, "POST", { text }));
      }
    });

    api.registerTool({
      name: "trello_update_card",
      label: "Trello: Update Card",
      description: "Update a Trello card (rename, archive, change description).",
      parameters: Type.Object({
        cardId: Type.String({ description: "Card ID." }),
        name: Type.Optional(Type.String({ description: "New name." })),
        desc: Type.Optional(Type.String({ description: "New description." })),
        closed: Type.Optional(Type.Boolean({ description: "true to archive." }))
      }, { additionalProperties: false }),
      execute: async (_id, p) => {
        const { cardId, name, desc, closed } = p as { cardId: string; name?: string; desc?: string; closed?: boolean };
        const fields: Record<string, string> = {};
        if (name) fields.name = name;
        if (desc !== undefined) fields.desc = desc;
        if (typeof closed === "boolean") fields.closed = String(closed);
        const fetch = await getFetcher();
        return jsonResult(await fetch(`/cards/${cardId}`, "PUT", fields));
      }
    });

    api.registerTool({
      name: "trello_checklist_create",
      label: "Trello: Create Checklist",
      description: "Create a checklist on a Trello card.",
      parameters: Type.Object({
        cardId: Type.String({ description: "Card ID." }),
        name: Type.String({ description: "Checklist name." })
      }, { additionalProperties: false }),
      execute: async (_id, p) => {
        const { cardId, name } = p as { cardId: string; name: string };
        const fetch = await getFetcher();
        return jsonResult(await fetch(`/cards/${cardId}/checklists`, "POST", { name }));
      }
    });

    api.registerTool({
      name: "trello_checklist_item_add",
      label: "Trello: Add Checklist Item",
      description: "Add an item to a Trello checklist.",
      parameters: Type.Object({
        checklistId: Type.String({ description: "Checklist ID." }),
        name: Type.String({ description: "Item text." })
      }, { additionalProperties: false }),
      execute: async (_id, p) => {
        const { checklistId, name } = p as { checklistId: string; name: string };
        const fetch = await getFetcher();
        return jsonResult(await fetch(`/checklists/${checklistId}/checkItems`, "POST", { name }));
      }
    });

    api.registerTool({
      name: "trello_checklist_item_complete",
      label: "Trello: Complete Checklist Item",
      description: "Mark a checklist item as complete (or incomplete) on a Trello card.",
      parameters: Type.Object({
        cardId: Type.String({ description: "Card ID." }),
        checkItemId: Type.String({ description: "Checklist item ID." }),
        complete: Type.Optional(Type.Boolean({ description: "false to uncheck. Default: true." }))
      }, { additionalProperties: false }),
      execute: async (_id, p) => {
        const { cardId, checkItemId, complete = true } = p as { cardId: string; checkItemId: string; complete?: boolean };
        const fetch = await getFetcher();
        return jsonResult(await fetch(`/cards/${cardId}/checkItem/${checkItemId}`, "PUT", { state: complete ? "complete" : "incomplete" }));
      }
    });
  }
});
