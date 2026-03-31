# openclaw-trello

Native Trello tools for [OpenClaw](https://openclaw.ai). Adds 10 first-class agent tools to interact with Trello — no curl, no shell scripts.

## Install

```bash
openclaw plugins install openclaw-trello
openclaw gateway restart
```

## Configuration

Add your Trello credentials to `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "openclaw-trello": {
        "enabled": true,
        "config": {
          "apiKey": "your-trello-api-key",
          "token": "your-trello-token"
        }
      }
    }
  }
}
```

Get your credentials at [https://trello.com/app-key](https://trello.com/app-key).

## Tools

| Tool | Description |
|------|-------------|
| `trello_list_boards` | List all accessible boards |
| `trello_list_lists` | List all open columns in a board |
| `trello_list_cards` | List all open cards in a column |
| `trello_create_card` | Create a new card |
| `trello_move_card` | Move a card to another column |
| `trello_add_comment` | Add a comment to a card |
| `trello_update_card` | Update a card (rename, archive, change description) |
| `trello_checklist_create` | Create a checklist on a card |
| `trello_checklist_item_add` | Add an item to a checklist |
| `trello_checklist_item_complete` | Mark a checklist item as complete |

## License

MIT
