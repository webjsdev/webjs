import { html } from '@webjsdev/core';

export const metadata = {
  title: 'Generators | WebJs',
  description: 'Rails-style generators for WebJs: one command writes a table with its row type, relations and migration, or a complete, tested authentication layer, in the same grammar as rails generate.',
};

export default function Generators() {
  return html`
    <h1>Generators</h1>
    <p>WebJs ships two of the generators Rails has, <code>model</code> and <code>authentication</code>, with the same names and the same field grammar. One command writes a correct, conventional slice of the app, and you (or your agent) edit the result. The app passes <code>webjs check</code> and its typecheck straight after.</p>
    <p>The command is <code>webjs generate</code>, with the short alias Rails has. In an app, run it through <code>npx</code>:</p>
    <code-block>npx webjs generate model post title:string! body:text published:boolean
npx webjs generate model comment body:text! post:references!
npx webjs generate authentication</code-block>

    <h2>What model writes</h2>
    <p>For <code>post</code> with those fields:</p>
    <ul>
      <li>The <code>posts</code> table in <code>db/schema.server.ts</code>, in plain Drizzle for SQLite or Postgres, with <code>id</code>, <code>createdAt</code> and <code>updatedAt</code> added.</li>
      <li>Its row type beside it (<code>export type Post = typeof posts.$inferSelect</code>), so no row type is written by hand.</li>
      <li>For each <code>references</code> field, the relation in <code>defineRelations</code>, so <code>db.query.comments.findMany({ with: { post: true } })</code> works.</li>
      <li>Its migration (<code>webjs db generate --name=create_posts</code>). The next <code>webjs dev</code>, <code>webjs start</code> or <code>webjs test</code> applies it.</li>
    </ul>
    <p>It writes no module folder, since a child table (a poll's options, its votes) belongs to its parent's feature. Use it for every table, so no Drizzle table is written by hand. It then prints what it wrote: the table's export, its row type column by column, the import line and the relations, so the agent that ran it need not open the schema to learn them. Run against a table the schema already defines, it leaves the schema as it is and says so.</p>
    <p>The feature's actions, queries and pages are yours to write, in the layout <code>npx webjs source modules</code> describes.</p>

    <h2>Fields</h2>
    <p>Each field is <code>name[:type][!][:uniq|:index]</code>, Rails' grammar:</p>
    <ul>
      <li><code>type</code> is one of <code>string</code> (the default), <code>text</code>, <code>integer</code>, <code>float</code>, <code>decimal</code>, <code>boolean</code>, <code>datetime</code>, <code>date</code>, <code>json</code> and <code>references</code>.</li>
      <li><code>!</code> makes the column not null and the field required: <code>title:string!</code>.</li>
      <li><code>:uniq</code> adds a unique constraint. <code>:index</code> adds a plain index.</li>
      <li><code>user:references</code> adds a <code>userId</code> foreign key to <code>users</code>, an index, and a <code>user</code> relation in <code>defineRelations</code>, so <code>db.query</code> can load it with <code>with</code>. <code>user:references!</code> makes it required, and the relation is then typed as the row rather than the row or <code>null</code> (<code>optional: false</code>).</li>
      <li>A brace names the referenced table when it is not the field's plural: <code>assignee:references{users}</code> adds an <code>assigneeId</code> foreign key to <code>users</code> and an <code>assignee</code> relation. The table must be in the schema already, as for any reference.</li>
      <li>Names may be written <code>published_at</code> or <code>publishedAt</code>; both become the <code>publishedAt</code> column.</li>
    </ul>

    <h2>Authentication</h2>
    <p>The authentication generator writes what Rails 8's does, the way Auth.js has it in a Next.js app:</p>
    <ul>
      <li>a <code>passwordHash</code> column on <code>users</code> (or the <code>users</code> table itself when the app has none), hashed with scrypt from <code>node:crypto</code>, so there is no dependency and it runs on Bun;</li>
      <li><code>modules/auth/auth.server.ts</code>: <code>createAuth</code> with a credentials provider and a typed session user, and the <code>/api/auth</code> route;</li>
      <li><code>logIn</code>, <code>signUp</code> and <code>logOut</code> actions that await <code>signIn</code> and <code>signOut</code>, with <code>app/login</code> and <code>app/signup</code> pages bound to them;</li>
      <li><code>app/middleware.ts</code>, which sends a signed-out visitor to <code>/login</code> from every page, form post and <code>route.ts</code> in the app, the way Rails 8's <code>require_authentication</code> covers every controller. Its <code>publicPaths</code> list is the exceptions, Rails' <code>allow_unauthenticated_access</code>: <code>/login</code>, <code>/signup</code> and <code>/api/auth</code> to start with. Add a landing page or any other public page there. Static files, the client runtime and metadata routes never pass through it;</li>
      <li>a <code>/logout</code> page with a log-out button. Link to it from your layout, or bind <code>logOut</code> in a form of your own;</li>
      <li><code>signedInPath</code> in <code>auth.server.ts</code>, where signing in lands: <code>/</code>, the app's home page, until you change it;</li>
      <li>a test that checks the gate, signs up, logs out and logs in again.</li>
    </ul>
    <p>An action that a component calls directly goes over RPC and does not pass through segment middleware, so check <code>await currentUser()</code> inside any action that needs a user. If the app already has an <code>app/middleware.ts</code>, the generator writes nothing and says how to merge the two (<code>--force</code> replaces it).</p>
    <p>No secret is written into the code: <code>createAuth</code> reads <code>AUTH_SECRET</code>, and development and tests generate one when it is unset. Password reset by mail is left out, since WebJs ships no mailer. See <a href="/docs/auth">Auth Providers</a> to add GitHub or Google.</p>

    <h2>Options</h2>
    <ul>
      <li><code>-f</code>, <code>--force</code>: overwrite files that already exist and differ. Without it a generator that would overwrite anything writes nothing and names the files.</li>
      <li><code>-p</code>, <code>--pretend</code>: print what would be written and write nothing. A table that a <code>references</code> field names and that is not generated yet is a note rather than an error, so a chain of dry runs (<code>g model room ... -p &amp;&amp; g model booking room:references! -p</code>) completes.</li>
      <li><code>--skip-tests</code>: write no test (authentication).</li>
      <li><code>--skip-migration</code>: edit the schema but do not run <code>webjs db generate</code>.</li>
      <li><code>--plural &lt;word&gt;</code>: the plural when the built-in rules get it wrong (<code>person</code> to <code>people</code> is built in).</li>
    </ul>

    <h2>Which command for which need</h2>
    <p>A bare <code>npx webjs source</code> prints what WebJs provides by need, the generators, and a short guide for each pattern WebJs wants an app built with. A guide is one page that ends in the generator that writes the pattern, when one does, and the exports to look up next:</p>
    <code-block>npx webjs source routing                   # the app/ file conventions (also: not-found, middleware.ts, route.ts)
npx webjs source modules                   # the feature layout, and what the generators write
npx webjs source progressive-enhancement   # forms that work with and without JavaScript
npx webjs source optimistic-ui             # show a write before the server confirms it
npx webjs source type-safety               # one set of types from the database to the page
npx webjs source data-flow                 # queries, actions, RPC and route handlers
npx webjs source authentication            # accounts, and every page behind sign-in
npx webjs source testing                   # server tests against a real database
npx webjs source uploads                   # attach a file to a record, store it and serve it back</code-block>
    <p>The MCP <code>source</code> tool answers the same names, so an agent with the MCP server gets the same guidance as one with a shell.</p>

  `;
}
