Build "Inbox", a customer-support inbox in the spirit of Crisp or Intercom:

1. Email + password sign up, log in and log out, with a real session cookie. Passwords hashed. Signing up creates a workspace and makes the user its owner; an owner can invite another user by email into the workspace as an agent (no email sending: the invite shows a join link once).
2. Each workspace has an embeddable widget: GET /widget/[workspaceId] serves a small page a website can put in an iframe, where a visitor types their email and a message to start a conversation. It works with JavaScript disabled.
3. /inbox lists the workspace's conversations, most recently active first, 20 per page, with a search box (matches the visitor email or any message text) and a filter for open / closed, all through the query string.
4. /inbox/[id] shows one conversation's messages oldest first. An agent replies with a form that works with JavaScript disabled; with JavaScript the reply appears at once, before the server confirms, and is rolled back with an error message if the server refuses it.
5. New visitor messages appear in an open /inbox/[id] page live, over a WebSocket, without a reload.
6. An agent can attach one file (an image or a PDF, at most 5 MB) to a reply; it is stored and shown as a link. Anything larger or of another type is refused with a message.
7. An agent can close and reopen a conversation. A user of another workspace gets 404 for a conversation that is not theirs, on every page and endpoint.
8. API tokens: an owner creates and revokes tokens on /settings/tokens (shown once on creation). GET /api/conversations?status=open returns that workspace's conversations as JSON for a request with Authorization: Bearer <token>, and 401 otherwise.
9. Use the project's UI component kit for buttons, inputs, textareas and cards rather than hand-building them.
10. All data lives in the database the scaffold wires up.
11. Server-side tests covering the workspace isolation (another workspace gets 404) and the API token check.
