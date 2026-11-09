/**
 * The tasks the agent eval hands to an agent, each with the HTTP probes that
 * grade it. Every prompt is written the way a person would ask for the feature,
 * naming no WebJs API: the point is to see what an agent writes from Lit and
 * Next.js habits plus the brief in the app's AGENTS.md, and nothing else.
 *
 * A probe is `{ path, method?, form?, cookie?, status, contains?, header? }`.
 * `form` submits the first form on the page at `path` (its fields plus the
 * values given), which is how a server-action task is graded without knowing
 * the action's id. `status` may be a number or an array of acceptable numbers.
 * `images` also fetches every same-origin `<img src>` on the page and requires
 * each to answer 200.
 */

/** @typedef {{ path: string, method?: string, form?: Record<string, string>, cookie?: string, status: number | number[], contains?: string | string[], header?: [string, RegExp], images?: boolean }} Probe */
/** @typedef {{ id: string, prompt: string, probes: Probe[] }} EvalTask */

/** @type {EvalTask[]} */
export const TASKS = [
  {
    id: 'counter-component',
    prompt:
      'Add a reusable counter web component, <click-counter>, with a numeric `count` property that can be set from an HTML attribute and a button that increments it. Show it on a new page at /counter starting at 3.',
    probes: [{ path: '/counter', status: 200, contains: ['<click-counter', '3'] }],
  },
  {
    id: 'guestbook-action',
    prompt:
      'Add a guestbook page at /guestbook with a form that takes a name. Submitting it must run on the server: an empty name shows the error "Name is required" on the same page, and a valid name redirects to /guestbook?thanks=1 which shows "Thanks for signing". It must work with JavaScript disabled.',
    probes: [
      { path: '/guestbook', status: 200, contains: '<form' },
      { path: '/guestbook', form: { name: '' }, status: [400, 422], contains: 'Name is required' },
      { path: '/guestbook', form: { name: 'Ada' }, status: 303, header: ['location', /\/guestbook\?thanks=1/] },
      { path: '/guestbook?thanks=1', status: 200, contains: 'Thanks for signing' },
    ],
  },
  {
    id: 'json-route',
    prompt: 'Add a JSON API endpoint at /api/health that responds to GET with {"ok": true}.',
    probes: [{ path: '/api/health', status: 200, contains: '"ok":true' }],
  },
  {
    id: 'dynamic-route',
    prompt:
      'Add a page at /posts/[slug] that shows "Post: <slug>" for the slugs "hello" and "world", and a 404 not-found page for any other slug.',
    probes: [
      { path: '/posts/hello', status: 200, contains: 'Post: hello' },
      { path: '/posts/missing', status: 404 },
    ],
  },
  {
    id: 'auth-middleware',
    prompt:
      'Protect every page under /admin: a request without a "session" cookie is redirected to /login, and one with it sees an /admin page that says "Admin area". Add a simple /login page too.',
    probes: [
      { path: '/admin', status: [302, 303, 307, 308], header: ['location', /\/login/] },
      { path: '/admin', cookie: 'session=1', status: 200, contains: 'Admin area' },
      { path: '/login', status: 200 },
    ],
  },
  {
    id: 'metadata-title',
    prompt: 'Add an /about page whose browser tab title is "About us" and whose meta description is "Who we are".',
    probes: [{ path: '/about', status: 200, contains: ['<title>About us</title>', 'Who we are'] }],
  },
  {
    id: 'public-asset',
    prompt: 'Add an SVG logo file to the project and show it on the home page with an <img> tag.',
    probes: [{ path: '/', status: 200, contains: '<img', images: true }],
  },
  {
    id: 'catch-all',
    prompt: 'Add a docs page at /docs/[...path] that shows the requested path segments joined with " / ", for example "a / b" for /docs/a/b.',
    probes: [{ path: '/docs/a/b', status: 200, contains: 'a / b' }],
  },
];
