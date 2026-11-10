import { html } from '@webjsdev/core';

export const metadata = {
  title: 'Generators | WebJs',
  description: 'Rails-style generators for WebJs: one command writes a working, tested feature (table, migration, actions, pages, test) or a complete authentication layer, in the same grammar as rails generate.',
};

export default function Generators() {
  return html`
    <h1>Generators</h1>
    <p>WebJs ships the generators Rails has, with the same names and the same field grammar. One command writes a working, tested, conventional slice of the app, and you (or your agent) edit the result. Every generated file is correct by construction: forms are bound to server actions and work with JavaScript off, components stay in light DOM, TypeScript is erasable, and the app passes <code>webjs check</code> and its typecheck straight after.</p>
    <p>The command is <code>webjs generate</code>, with the short alias Rails has. In an app, run it through <code>npx</code>:</p>
    <code-block>npx webjs generate scaffold post title:string! body:text published:boolean</code-block>

    <h2>What scaffold writes</h2>
    <p>For <code>post</code> with those fields:</p>
    <ul>
      <li>The <code>posts</code> table in <code>db/schema.server.ts</code>, in plain Drizzle for SQLite or Postgres, with <code>id</code>, <code>createdAt</code> and <code>updatedAt</code> added, and its migration (<code>webjs db generate --name=create_posts</code>). The next <code>webjs dev</code>, <code>webjs start</code> or <code>webjs test</code> applies it.</li>
      <li><code>modules/posts/</code>: <code>list-posts</code> and <code>get-post</code> queries, <code>read-post-input.server.ts</code> (the validation create and update share, reading a form submission or a JSON body), and <code>create-post</code>, <code>update-post</code> and <code>delete-post</code> actions, one per file.</li>
      <li><code>app/posts/</code>: the index, new, show and edit pages. The forms bind the actions, a failed submit re-renders with the typed values and a message per field, and a success redirects with a 303. The fields live in one helper both forms share, as a Rails <code>_form</code> partial does. Controls use the UI kit's helpers when the app has them.</li>
      <li><code>test/posts/posts.test.ts</code>, which submits each form the way a browser with JavaScript off does, against the test database <code>webjs test</code> prepares.</li>
    </ul>
    <p>In an app with no root layout (the <code>api</code> template) scaffold writes JSON route handlers instead of pages, as Rails does in an API-only app.</p>

    <h2>Fields</h2>
    <p>Each field is <code>name[:type][!][:uniq|:index]</code>, Rails' grammar:</p>
    <ul>
      <li><code>type</code> is one of <code>string</code> (the default), <code>text</code>, <code>integer</code>, <code>float</code>, <code>decimal</code>, <code>boolean</code>, <code>datetime</code>, <code>date</code>, <code>json</code> and <code>references</code>.</li>
      <li><code>!</code> makes the column not null and the field required: <code>title:string!</code>.</li>
      <li><code>:uniq</code> adds a unique constraint, which create and update check with a field message. <code>:index</code> adds a plain index.</li>
      <li><code>user:references</code> adds a <code>userId</code> foreign key to <code>users</code>, an index, and a <code>user</code> relation in <code>defineRelations</code>, so <code>db.query</code> can load it with <code>with</code>.</li>
      <li>Names may be written <code>published_at</code> or <code>publishedAt</code>; both become the <code>publishedAt</code> column.</li>
    </ul>

    <h2>The other generators</h2>
    <code-block>npx webjs generate resource product name:string! price:float sku:string:uniq
npx webjs generate model tag name:string!:uniq
npx webjs generate migration AddPublishedAtToPosts published_at:datetime
npx webjs generate migration RemoveViewsFromPosts views
npx webjs generate controller pages home about
npx webjs generate authentication</code-block>
    <ul>
      <li><strong>resource</strong> is scaffold with JSON route handlers under <code>app/api/</code> in place of pages: <code>GET</code> and <code>POST</code> on the collection, <code>GET</code>, <code>PATCH</code> and <code>DELETE</code> on one record.</li>
      <li><strong>model</strong> writes the table, its type and its migration.</li>
      <li><strong>migration</strong> reads the change from its name, as in Rails. <code>AddXToTable</code> adds the listed columns to that table, <code>RemoveXFromTable</code> drops them, and <code>CreateTable</code> is the model generator. Drizzle derives the SQL from the schema, so the generator edits the table in <code>db/schema.server.ts</code> and names the migration after the change. Forms and validation are left alone, and a note says where to add the column.</li>
      <li><strong>controller</strong> takes a name and its actions and writes one page per action (<code>index</code> is the segment root) with a test that each renders.</li>
      <li><strong>authentication</strong> is described below.</li>
    </ul>

    <h2>Authentication</h2>
    <p>The authentication generator writes what Rails 8's does, the way Auth.js has it in a Next.js app:</p>
    <ul>
      <li>a <code>passwordHash</code> column on <code>users</code> (or the <code>users</code> table itself when the app has none), hashed with scrypt from <code>node:crypto</code>, so there is no dependency and it runs on Bun;</li>
      <li><code>modules/auth/auth.server.ts</code>: <code>createAuth</code> with a credentials provider and a typed session user, and the <code>/api/auth</code> route;</li>
      <li><code>logIn</code>, <code>signUp</code> and <code>logOut</code> actions that await <code>signIn</code> and <code>signOut</code>, with <code>app/login</code> and <code>app/signup</code> pages bound to them;</li>
      <li>a <code>/dashboard</code> segment whose <code>middleware.ts</code> sends a signed-out visitor to <code>/login</code>, Rails' <code>require_authentication</code>. Copy that file into any folder to protect it;</li>
      <li>a test that signs up, logs out and in, and checks the protected page.</li>
    </ul>
    <p>No secret is written into the code: <code>createAuth</code> reads <code>AUTH_SECRET</code>, and development and tests generate one when it is unset. Password reset by mail is left out, since WebJs ships no mailer. See <a href="/docs/auth">Auth Providers</a> to add GitHub or Google.</p>

    <h2>Options</h2>
    <ul>
      <li><code>-f</code>, <code>--force</code>: overwrite files that already exist and differ. Without it a generator that would overwrite anything writes nothing and names the files.</li>
      <li><code>-p</code>, <code>--pretend</code>: print what would be written and write nothing.</li>
      <li><code>--skip-tests</code>: write no test.</li>
      <li><code>--skip-migration</code>: edit the schema but do not run <code>webjs db generate</code>.</li>
      <li><code>--plural &lt;word&gt;</code>: the plural when the built-in rules get it wrong (<code>person</code> to <code>people</code> is built in).</li>
    </ul>

    <h2>Undoing a generator</h2>
    <p>The <code>destroy</code> command, with the same short alias Rails has, removes what the same generate command wrote: the files, and for scaffold, resource and model the table, its type and its relations, followed by the migration that drops it. As in Rails, the files go whether or not they were edited since, so commit first.</p>
    <code-block>npx webjs destroy scaffold post</code-block>
  `;
}
