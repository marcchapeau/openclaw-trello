import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { Type } from "@sinclair/typebox";

const BASE_URL = "https://api.trello.com/1";

function makeFetcher(apiKey: string, token: string) {
  return async function trelloFetch(path: string, method = "GET", body?: Record<string, string>): Promise<unknown> {
    const sep = path.includes("?") ? "&" : "?";
    const url = `${BASE_URL}${path}${sep}key=${apiKey}&token=${token}`;
    const opts: RequestInit = { method };
    if (body) {
      opts.headers = { "Content-Type": "application/json" };
      opts.body = JSON.stringify(body);
    }
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
  register(api) {
    const cfg = api.pluginConfig as Record<string, string> | undefined;
    const apiKey = cfg?.apiKey ?? process.env.TRELLO_API_KEY ?? "";
    const token = cfg?.token ?? process.env.TRELLO_TOKEN ?? "";

    if (!apiKey || !token) {
      console.warn("[openclaw-trello] Missing credentials. Set apiKey/token in plugin config or TRELLO_API_KEY/TRELLO_TOKEN env vars.");
    }

    const fetch = makeFetcher(apiKey, token);

    api.registerTool({
      name: "trello_list_boards",
      label: "Trello: List Boards",
      description: "List all Trello boards accessible with the configured credentials.",
      parameters: Type.Object({}, { additionalProperties: false }),
      execute: async () => jsonResult(await fetch("/members/me/boards?fields=id,name,shortUrl"))
    });

    api.registerTool({
      name: "trello_list_lists",
      label: "Trello: List Columns",
      description: "List all open columns (lists) in a Trello board.",
      parameters: Type.Object({ boardId: Type.String({ description: "Board ID." }) }, { additionalProperties: false }),
      execute: async (_id, p) => {
        const { boardId } = p as { boardId: string };
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
        if (name !== undefined) fields.name = name;
        if (desc !== undefined) fields.desc = desc;
        if (typeof closed === "boolean") fields.closed = String(closed);
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
        return jsonResult(await fetch(`/cards/${cardId}/checkItem/${checkItemId}`, "PUT", { state: complete ? "complete" : "incomplete" }));
      }
    });

    api.registerTool({
      name: "trello_get_member",
      label: "Trello: Get Member",
      description: "Resolve a Trello username or member ID to a member object (id, username, fullName). Useful to get a memberId before assigning.",
      parameters: Type.Object({
        usernameOrId: Type.String({ description: "Trello username or member ID." })
      }, { additionalProperties: false }),
      execute: async (_id, p) => {
        const { usernameOrId } = p as { usernameOrId: string };
        return jsonResult(await fetch(`/members/${usernameOrId}?fields=id,username,fullName`));
      }
    });

    api.registerTool({
      name: "trello_card_add_member",
      label: "Trello: Add Member to Card",
      description: "Assign a member to a Trello card.",
      parameters: Type.Object({
        cardId: Type.String({ description: "Card ID." }),
        memberId: Type.String({ description: "Member ID to assign." })
      }, { additionalProperties: false }),
      execute: async (_id, p) => {
        const { cardId, memberId } = p as { cardId: string; memberId: string };
        return jsonResult(await fetch(`/cards/${cardId}/idMembers`, "POST", { value: memberId }));
      }
    });

    api.registerTool({
      name: "trello_card_remove_member",
      label: "Trello: Remove Member from Card",
      description: "Remove a member assignment from a Trello card.",
      parameters: Type.Object({
        cardId: Type.String({ description: "Card ID." }),
        memberId: Type.String({ description: "Member ID to remove." })
      }, { additionalProperties: false }),
      execute: async (_id, p) => {
        const { cardId, memberId } = p as { cardId: string; memberId: string };
        // DELETE with body requires a custom fetch — inline here
        const sep = `/cards/${cardId}/idMembers/${memberId}`.includes("?") ? "&" : "?";
        const url = `${BASE_URL}/cards/${cardId}/idMembers/${memberId}${sep}key=${apiKey}&token=${token}`;
        const res = await globalThis.fetch(url, { method: "DELETE" });
        if (!res.ok) throw new Error(`Trello API error ${res.status} on DELETE /cards/${cardId}/idMembers/${memberId}`);
        return jsonResult(await res.json());
      }
    });
  }
});
