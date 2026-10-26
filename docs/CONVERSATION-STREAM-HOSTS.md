# Conversation stream host registry

The main Worker stores the trusted conversation stream destinations in D1 table
`conversation_stream_hosts`. The same table is read by the Redmine Worker and
passed to the container as `LIB_STREAM_HOSTS_JSON`; `/lib/api/tunnels.rb` returns
the sanitized records under `conversation_stream.hosts` together with the local
stream capabilities. The main Worker remains the source of truth for edits.

The authenticated API is:

- `GET /api/aichat/conversation-stream/hosts` — list registered hosts.
- `POST /api/aichat/conversation-stream/hosts` — add a host.
- `PUT /api/aichat/conversation-stream/hosts/:id` — edit label, origin,
  priority, or enabled state.
- `DELETE /api/aichat/conversation-stream/hosts/:id` — remove a host.
- `GET /api/aichat/conversation-stream/health` — return the enabled host
  records and the subset whose protected embed responds correctly.

All endpoints require a signed-in account. Mutations require a configured
Cloudflare dashboard administrator. Origins must be HTTPS origins under
`nekomaneki.work` or `nekoflare.workers.dev`; paths, credentials, query strings,
fragments, and nonstandard ports are rejected. Up to 50 destinations may be
registered. The embed and stream paths are fixed by the Worker.
This keeps health checks from becoming arbitrary URL fetches.

Example request body for adding a destination:

```json
{
  "id": "newcontainer",
  "label": "New container",
  "origin": "https://newcontainer.nekomaneki.work",
  "priority": 15,
  "enabled": true
}
```

Automatic selection probes enabled hosts and chooses the first reachable host
in ascending priority order. It stays on that host while it remains reachable;
if it becomes unavailable, the next reachable host takes over. Manual selection
remains pinned to its host while that record exists; an unavailable host is
shown as unavailable rather than silently replaced. If a manually selected
record is deleted, the panel returns to automatic selection. Requests already
sent to a host are never replayed on a different host.

The registry is intentionally separate from Cloudflare tunnel status. A tunnel
being connected does not prove that its conversation observer is configured;
the embed health probe and the per-container `conversation_stream` metadata
report those states independently.
