Build "Trackr", a small issue tracker for one team:

1. Email + password sign up, log in and log out, with a real session cookie. Passwords hashed. Every page except /login and /signup requires a signed-in user.
2. /projects lists the projects; a signed-in user creates one with a name and a short key (2 to 5 capital letters, unique). Validation errors show on the same page with the typed values kept, and the form works with JavaScript disabled.
3. /projects/[key] lists that project's issues, newest first, 25 per page with Previous / Next links, and filters by status (open, in progress, done) and by assignee through the query string, so a filtered view can be bookmarked. Choosing several statuses at once works (?status=open&status=done).
4. /projects/[key]/new creates an issue (title, description, assignee chosen from the users, priority low / medium / high). It works with JavaScript disabled.
5. /projects/[key]/issues/[number] shows one issue (numbered per project: ABC-1, ABC-2, ...) with its comments, a form to add a comment, and a form to change its status. Both forms work with JavaScript disabled and the page keeps the reader's place after either.
6. On the issue page, an interactive component lets the assignee be changed from a dropdown without a page reload, and shows the change at once, rolling back with an error message if the server refuses it.
7. Each issue page's title is "KEY-N: issue title".
8. A JSON endpoint GET /api/projects/[key]/issues?status=open returns the matching issues; 404 for an unknown project, 401 without a session.
9. Use the project's UI component kit for buttons, inputs, selects and cards rather than hand-building them.
10. All data lives in the database the scaffold wires up.
11. Server-side tests covering the issue numbering, the status filter, and that a signed-out request to the JSON endpoint is refused.
