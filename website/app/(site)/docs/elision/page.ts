import { html } from '@webjsdev/core';

export const metadata = {
  title: 'What Ships to the Browser | WebJs',
  description:
    'In WebJs pages, layouts and boundaries run only on the server and never ship. Every component ships, as in Lit. Server-only markup is a component in a .server.ts file or a function returning html, and ships nothing.',
};

export default function Elision() {
  return html`
    <h1>What Ships to the Browser</h1>

    <p>
      Three rules decide what the browser downloads, and none of them is a guess. Each is a fact about where you put the code, so you can read it off the file tree.
    </p>

    <ul>
      <li><strong>Pages, layouts, loading templates and boundaries never ship.</strong> They run only on the server.</li>
      <li><strong>Every component in an ordinary file always ships</strong> and hydrates, exactly as a Lit component does.</li>
      <li><strong>Server-only markup ships nothing.</strong> Write it as a component in a <code>*.server.ts</code> file, or as a function returning <code>html</code>.</li>
    </ul>

    <p>
      So a route costs the browser exactly the components it renders. A route that renders no interactive component ships <strong>zero</strong> application JavaScript and is pure server-rendered HTML, which still navigates and submits forms through native browser behaviour.
    </p>

    <h2 id="route-modules">Pages, layouts and boundaries never ship</h2>

    <p>
      A page, layout, loading template or boundary (error, not-found, forbidden, unauthorized) runs only on the server, the way a Next.js server component does. Its module is never sent to the browser: the client boot imports the components it renders instead. That is why a page can import a <code>.server.ts</code> utility, a database client or a <code>node:</code> module without any of it reaching the browser, and why requesting a page's source URL returns 404.
    </p>

    <p>
      The consequence is the one Next.js has for server components: anything that needs a browser belongs in a component. A component class defined inside a page, an <code>@click</code> binding on a page's template, a <code>'use client'</code> directive on a page, a component importing a page file, and a Node builtin reached from a component are each refused by <code>webjs check</code> with the fix. For app-wide browser code that belongs to no component (analytics, a polyfill, the client router on a page with no component), use <code>instrumentation-client.ts</code>, which loads on every page.
    </p>

    <h2 id="components">Every component ships</h2>

    <p>
      A <code>WebComponent</code> in an ordinary file is browser code, as in Lit: its module ships and the element hydrates, whether or not it has state, events or lifecycle hooks. There is nothing to annotate and nothing to forget. A <code>'use client'</code> directive at the top of a component file is accepted and changes nothing, so the Next.js habit is harmless here.
    </p>

    <p>
      A component reaches the server through a <code>'use server'</code> action: importing one from a component gives the browser an RPC stub whose exports call the server, and an action called during server rendering is seeded into the page, so an <code>async render()</code> does not fetch the same data again on hydration.
    </p>

    <h2 id="server-only">Server-only markup</h2>

    <p>
      Markup that only the server should render is written one of two ways, the same split Next.js draws between client and server components. Neither ships.
    </p>

    <ul>
      <li><strong>A component in a <code>*.server.ts</code> file.</strong> It renders on the server and is never defined in the browser, so it may import server code and have an <code>async render()</code> that reads the database. The file must not start with <code>'use server'</code>: that directive turns a file's function exports into actions, and a class is a function (<code>webjs check</code> refuses it as <code>no-component-in-use-server-file</code>).</li>
      <li><strong>A function returning <code>html</code></strong>, called from a page or layout. It may be <code>async</code>, like a Next.js server component.</li>
    </ul>

    <p>
      The Next.js rules between the two kinds carry over. A page may render either. A client component may not import a server-only one or render its tag in its own template, because the tag is never defined in the browser and comes back empty after a client re-render. Pass it in as a child from the page instead, and it lands in the client component's <code>&lt;slot&gt;</code>. <code>webjs check</code> refuses interactivity inside a <code>.server</code> component (<code>no-interactivity-in-server-component</code>) and a server-only tag in a client template (<code>no-server-component-in-client-template</code>). See <a href="/docs/components#server-only">Server-only components</a> for an example.
    </p>

    <h2 id="orphans">A component the scanner cannot see</h2>

    <p>
      The boot finds the components a route renders by their registration, which must name a literal tag:
    </p>

    <code-block>// Broken: the scanner requires a literal tag.
const TAG = buildTag();
Badge.register(TAG);          // invisible

// Correct:
Badge.register('my-badge');</code-block>

    <p>
      A class with a computed tag, or with no registration call at all, is an <strong>orphan</strong>. The boot never loads it in place of the page that imports it, so the element never upgrades. <code>webjs dev</code> warns about it and <code>webjs doctor</code> reports it (<code>ORPHAN_COMPONENTS</code>). Registering the class from a sibling module is fine, since the check is app-wide.
    </p>

    <h2 id="inspect">Seeing what a route loads</h2>

    <p>
      Open the network tab: a route loads the components it renders and <code>instrumentation-client.ts</code>, and never a <code>page.ts</code> or <code>layout.ts</code>. Two tools point out code that will not run where it looks like it should:
    </p>

    <ul>
      <li><code>webjs status</code>, the command to run after each edit, prints a warning for code in a page, layout or boundary that looks meant for the browser (a <code>window</code> access, a client-router or <code>signal</code> import, a side-effect import that sets something up), since it runs only on the server.</li>
      <li><code>webjs doctor</code> reports the same as <code>ROUTE_BROWSER_CODE</code>, and orphan components as <code>ORPHAN_COMPONENTS</code>.</li>
    </ul>

    <p>
      For a tool, <code>analyzeRouteModules(appDir)</code> from <code>@webjsdev/server</code> returns every route module with its kind, the components the boot loads in its place, and those hints.
    </p>
  `;
}
