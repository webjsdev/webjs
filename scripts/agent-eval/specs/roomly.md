Build "Roomly", a meeting-room booking app:

1. Email + password sign up, log in and log out, with a real session cookie. Passwords hashed.
2. /rooms lists the meeting rooms (seed at least three, each with a name and a capacity).
3. /rooms/[id] shows that room's bookings for the next 7 days. Every date and time in the app is shown in one human format, like "Tue 10 Nov, 14:00", from one shared formatting helper used by every page.
4. A signed-in user books the room from /rooms/[id] with a form (day, start hour, duration of 1 to 3 hours) that also works with JavaScript disabled. A booking that overlaps an existing one shows a validation error on the same page, with the typed values kept.
5. /bookings lists the signed-in user's own bookings, each with a Cancel button that works with JavaScript disabled.
6. On /rooms/[id], an interactive component shows "Free now" or "Busy until HH:MM" and refreshes every 30 seconds without a page reload.
7. Booking a room and /bookings redirect a signed-out visitor to /login. A user cannot cancel another user's booking (403 or 404).
8. A JSON endpoint GET /api/rooms/[id]/availability?date=YYYY-MM-DD returns the free hours of that day; 404 for an unknown room.
9. Use the project's UI component kit for buttons, inputs and cards rather than hand-building them.
10. All data lives in the database the scaffold wires up.
11. At least one server-side test covering the booking rules (overlap, and cancelling someone else's booking).
