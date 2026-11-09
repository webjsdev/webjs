Build "Pollster", a quick-poll app with no accounts:

1. / lists the 20 most recent polls, newest first, and links to /new.
2. /new creates a poll: a question and 2 to 6 options (one per line in a textarea is fine). It works with JavaScript disabled, and shows validation errors (empty question, fewer than 2 options) on the same page with the typed values kept. On success it goes to the poll's page /p/[slug] and shows the creator a private manage link once.
3. /p/[slug] shows the question and one Vote button per option. Each button works with JavaScript disabled. A visitor may vote once per poll (remember it with a cookie); a second vote shows a message on the page instead of counting.
4. /p/[slug] shows the results as bars in an interactive component that renders the current results on the server (no empty first paint) and refreshes them every 5 seconds without a page reload.
5. /p/[slug]/manage?key=... (the private link) lets the creator close the poll. A closed poll shows "Closed" and rejects votes.
6. The poll's question is the page title, and its option count is in the meta description.
7. An unknown slug renders a custom not-found page, and /p/[slug] has a loading state.
8. A JSON endpoint GET /api/polls/[slug] returns the question, options and counts; 404 for an unknown slug.
9. Use the project's UI component kit for buttons, inputs and cards rather than hand-building them.
10. All data lives in the database the scaffold wires up.
11. At least one server-side test covering the voting rules (double vote, closed poll).
