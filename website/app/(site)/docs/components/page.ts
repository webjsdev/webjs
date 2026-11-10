import { html } from '@webjsdev/core';

export const metadata = { title: 'Components | WebJs' };

export default function Components() {
  return html`
    <h1>Components</h1>
    <p>WebJs components are <strong>standard HTML custom elements</strong> built on a thin base class called <code>WebComponent</code>. If you are coming from React, think of <code>WebComponent</code> as a class component whose render method returns a tagged template instead of JSX. The browser owns the component lifecycle. There is no virtual DOM, no reconciler, and no framework-specific component model to learn.</p>

    <h2>What belongs in a component</h2>
    <p>A component owns four things together: its markup, its state, its listeners, and its styling. When one of them lives in another file, the feature stops being readable, testable, or deletable as a unit. These are conventions, not <code>webjs check</code> rules.</p>
    <ul>
      <li><strong>Markup and the code that drives it live in the same component.</strong> A class selector is not an interface. <code>document.querySelector('.nav-toggle')</code> keeps type-checking after someone renames the class in the other file, and starts returning <code>null</code> at runtime.</li>
      <li><strong>Reach your own rendered node with a ref.</strong> <code>render()</code> already owns the node, so let the handle flow out of the template with <code>ref()</code> and <code>createRef()</code>. A ref cannot match another component's node, and it goes undefined once the node is no longer rendered.</li>
      <li><strong>State lives on the component, never on the document shell.</strong> The client router's swap range never covers <code>&lt;body&gt;</code>, so an open flag parked there survives the navigation that removed the markup it described. A reactive property or an instance signal dies with the element, while a module-scope signal deliberately outlives it and is for state genuinely shared between components. Two things are the exception: a document-wide setting such as the theme, which describes the document rather than one component, and a transient document-level effect such as a scroll lock, which the element that opened it releases in <code>disconnectedCallback</code>.</li>
      <li><strong>ARIA state is a hole in <code>render()</code>.</strong> An <code>aria-expanded</code> bound to the same state that drives behaviour cannot drift. A second function calling <code>setAttribute</code> can. Booleans in attribute holes are stringified (<code>"true"</code> / <code>"false"</code>) by the server and client alike, so <code>aria-expanded=\${this.open}</code> stays correct through hydration.</li>
      <li><strong>Behaviour needs an importable surface.</strong> A browser test can import a component and drive the real element. An inline script in a layout has no module identity, so its test can only transcribe it and assert against the copy.</li>
      <li><strong>Listening on the document is fine. Querying it usually is not.</strong> An outside-click handler has to listen globally, then reads its own subtree with <code>this.contains(event.target)</code>. Add the listener in <code>connectedCallback</code> and remove it in <code>disconnectedCallback</code>.</li>
      <li><strong>Talk to an ancestor with a bubbling event, and to a stranger with a module-scope signal.</strong> A made-up event name on <code>document</code> is a global variable with extra steps.</li>
    </ul>

    <h2 id="server-only">Server-only components</h2>
    <p>A component runs in the browser, as in Lit: it always ships. Markup that only the server should render is written one of two ways, the same split Next.js draws between client and server components (see <a href="/docs/elision">What Ships to the Browser</a>).</p>
    <ul>
      <li><strong>Needs the browser</strong> (state, events, lifecycle): a <code>WebComponent</code> in an ordinary file. It always ships and hydrates.</li>
      <li><strong>Server only, as a custom element</strong>: a <code>WebComponent</code> in a <code>*.server.ts</code> file that does not start with <code>'use server'</code> (that directive turns a file's function exports into actions, and a class is a function, so <code>webjs check</code> refuses the pair). It renders on the server and is never defined in the browser, so it costs no JavaScript and may import server code directly.</li>
      <li><strong>Server only, as a function</strong>: a function returning <code>html</code>, called from a page or layout. It may be <code>async</code> and query the database, like a Next.js server component, and it never ships.</li>
    </ul>
    <code-block>// components/user-card.server.ts: renders on the server, ships nothing
import { WebComponent, html } from '@webjsdev/core';
import { getUser } from '#modules/users/queries.server.ts';

export class UserCard extends WebComponent({ id: String }) {
  async render() {
    const user = await getUser(this.id);
    return html\`&lt;div class="card"&gt;&lt;b&gt;\${user.name}&lt;/b&gt;&lt;/div&gt;\`;
  }
}
UserCard.register('user-card');</code-block>
    <p>The Next.js rules carry over. A page may render either kind. A client component may not import a server-only one (it would load a stub) or render its tag in its own template (the tag is never defined in the browser, so it comes back empty after a client re-render). Pass it in as a child instead, from the page, and it lands in the client component's <code>&lt;slot&gt;</code>, as Next.js passes a server component to a client one as <code>children</code>:</p>
    <code-block>// app/users/[id]/page.ts
return html\`&lt;x-tabs&gt;&lt;user-card id=\${id}&gt;&lt;/user-card&gt;&lt;/x-tabs&gt;\`;</code-block>
    <p><code>webjs check</code> refuses the shapes that would silently do nothing: an event binding, a reactive primitive or a client-only lifecycle hook in a <code>.server</code> component (<code>no-interactivity-in-server-component</code>), and a server-only tag rendered from a client component's template (<code>no-server-component-in-client-template</code>).</p>

    <h2>How big should a component be?</h2>
    <p>The rules above say what must not be split apart. They do not say how much to pull in, and read alone they push one way only, since there is always more surrounding markup a component could render. The stopping rule: <strong>a component owns the markup its own behaviour reads or writes.</strong> Static markup that no handler touches, no state change re-renders, and no template hole depends on belongs to the page.</p>
    <p>This is a byte-cost rule rather than a taste one. A page never hydrates, so markup it renders is free in the browser. Markup a component renders is not: the module is fetched, <code>@webjsdev/core</code> comes with it, and on upgrade the component re-renders that subtree. Moving static markup across the boundary turns free HTML into shipped JavaScript that rebuilds what the server already sent.</p>
    <code-block>&lt;!-- app/products/[id]/page.ts: the page keeps the static markup --&gt;
&lt;article&gt;
  &lt;h1&gt;\${product.name}&lt;/h1&gt;
  &lt;spec-table .rows=\${product.specs}&gt;&lt;/spec-table&gt;

  &lt;add-to-cart product-id=\${product.id}&gt;&lt;/add-to-cart&gt;

  &lt;review-list .reviews=\${product.reviews}&gt;&lt;/review-list&gt;
&lt;/article&gt;</code-block>
    <p>Only <code>&lt;add-to-cart&gt;</code> needs the browser. Write <code>&lt;spec-table&gt;</code> and <code>&lt;review-list&gt;</code> as <a href="#server-only">server-only components</a> (in <code>*.server.ts</code> files) and the browser fetches neither, while the page still renders them. Wrapping the whole article in a <code>&lt;product-page&gt;</code> component would ship all three, because a client component cannot render a server-only one, so both would have to become client components. The cost of an oversized island is therefore not linear in what you moved.</p>
    <p>To check a component you are about to write, walk its template and ask of each element whether a handler touches it, a state change alters it, or it sits in a template hole. If all three are no, that element is a passenger. A template that is mostly passengers wants splitting. The exception is markup that is static today but is what a near-term behaviour will read, since the alternative is a component that reaches outward for it later. When ownership and bytes genuinely collide, ownership wins.</p>

    <h2>The WebComponent Base Class</h2>
    <p>Every interactive component extends <code>WebComponent</code>, declares its <strong>reactive properties</strong> (through the base-class factory <code>extends WebComponent({ ... })</code> or Lit's <code>static properties</code> plus <code>declare</code>, both covered below), optionally sets <code>static shadow = true</code> with <code>static styles</code> for scoped CSS, implements <code>render()</code>, and registers itself by passing a hyphenated tag name to <code>ClassName.register('tag-name')</code>. The tag name is an argument to <code>.register()</code>, not a static field.</p>

    <code-block>import { WebComponent, html, css, signal } from '@webjsdev/core';

class MyCounter extends WebComponent {
  static shadow = true;   // static styles apply inside a shadow root

  // Instance signal carries component-local state. SignalWatcher
  // (built into WebComponent) auto-tracks .get() reads and re-renders.
  readonly #count = signal(0);

  static styles = css\`
    :host { display: inline-flex; gap: 8px; align-items: center; }
    button { font: inherit; padding: 4px 12px; cursor: pointer; }
    output { font-variant-numeric: tabular-nums; min-width: 3ch; text-align: center; }
  \`;

  render() {
    return html\`
      &lt;button @click=\${() =&gt; this.#count.set(this.#count.get() - 1)}&gt;-&lt;/button&gt;
      &lt;output&gt;\${this.#count.get()}&lt;/output&gt;
      &lt;button @click=\${() =&gt; this.#count.set(this.#count.get() + 1)}&gt;+&lt;/button&gt;
    \`;
  }
}

MyCounter.register('my-counter');</code-block>

    <p>That is a complete, working component. Import it from a page or layout and use it like any HTML element:</p>

    <code-block>import '#components/my-counter.ts';

export default function Home() {
  return html\`&lt;my-counter&gt;&lt;/my-counter&gt;\`;
}</code-block>

    <h2>Tag Names</h2>
    <p>The HTML spec requires that custom element names contain a <strong>hyphen</strong>. This is how the browser distinguishes <code>&lt;my-counter&gt;</code> from built-in elements like <code>&lt;div&gt;</code>. Register the component with <code>Class.register('tag')</code> at the bottom of the file:</p>

    <code-block>class UserCard extends WebComponent {
  // ...
}
UserCard.register('user-card');</code-block>

    <p>If you forget the hyphen, the browser throws at registration time with a clear error message.</p>

    <h2>Properties</h2>
    <p>Reactive properties that ride HTML attributes are declared either by passing the property shape into the base-class factory <code>WebComponent({ ... })</code>, where the types flow to TypeScript automatically (no <code>declare</code> lines), or with Lit's own <code>static properties = { count: { type: Number } }</code> plus <code>declare count: number</code>. The runtime installs a reactive accessor for each key either way, and a subclass's props merge with its parent's, as in Lit.</p>

    <h3>The factory shape</h3>
    <p>Map each property name to its type constructor. Default values are set in the constructor after <code>super()</code> (never a class-field initializer, which runs after <code>super()</code> and clobbers the reactive accessor):</p>

    <code-block>import { WebComponent, html } from '@webjsdev/core';

class UserCard extends WebComponent({
  name:     String,
  age:      Number,
  active:   Boolean,
  config:   Object,
  tags:     Array,
}) {
  constructor() {
    super();
    this.name = 'Anonymous';
    this.age = 0;
    this.active = false;
    this.config = {};
    this.tags = [];
  }

  render() {
    return html\`
      &lt;p&gt;\${this.name} (age \${this.age})&lt;/p&gt;
      &lt;p&gt;Active: \${this.active ? 'yes' : 'no'}&lt;/p&gt;
      &lt;p&gt;Tags: \${this.tags.join(', ')}&lt;/p&gt;
    \`;
  }
}
UserCard.register('user-card');</code-block>

    <h3>Property options and narrowed types with prop()</h3>
    <p>When a property needs options (reflection, a renamed attribute, a declarative default) or a narrowed TypeScript type, wrap the type in the <code>prop()</code> helper. A bare constructor (<code>name: String</code>) is shorthand for <code>name: prop(String)</code>.</p>

    <code-block>import { WebComponent, html, prop } from '@webjsdev/core';

interface Student { name: string; gpa: number; }

class UserCard extends WebComponent({
  count:   prop(Number, { reflect: true }),       // reflect to the attribute
  label:   prop(String, { attribute: 'aria-label' }), // renamed attribute
  open:    prop<boolean>({ state: true }),         // internal state, no attribute (lit's @state())
  items:   prop&lt;string[]&gt;(Array, { attribute: false }), // property-only, set with .items=\${…}
  student: prop&lt;Student&gt;(Object),                  // narrowed object type
  tags:    prop&lt;string[]&gt;(Array),                  // array-typed: pass Array, not Object
  size:    prop&lt;'sm' | 'lg'&gt;(String),              // narrowed enum type
}) {
  constructor() {
    super();
    this.size = 'sm';                              // default in the constructor
  }
  render() {
    return html\`&lt;p&gt;\${this.student.name} (\${this.size})&lt;/p&gt;\`;
  }
}
UserCard.register('user-card');</code-block>

    <p>Set a default by assigning in the <code>constructor()</code> after <code>super()</code> (never a class-field initializer, which clobbers the reactive accessor). An applied attribute overrides it.</p>

    <p>Declare an <strong>array-typed</strong> property with the <code>Array</code> constructor, not <code>Object</code> (<code>tags: prop&lt;string[]&gt;(Array)</code>). The default converter treats both the same (each JSON-encodes the value), so <code>Object</code> does not break anything, but <code>Array</code> states the property's shape correctly. The <code>array-prop-uses-array-type</code> rule in <code>webjs check</code> flags an array-typed generic declared with <code>Object</code>.</p>

    <h3>Every Lit property option</h3>
    <p>The declaration options behave as in Lit. <code>attribute</code> takes a string (the attribute name, used as written), <code>true</code> (the default name), or <code>false</code> (no attribute). <code>converter</code> takes a <code>{ fromAttribute, toAttribute }</code> object, or a bare function, which is the <code>fromAttribute</code> half while reflection keeps the default serialisation. <code>hasChanged(value, oldValue)</code> decides whether a write schedules an update, and <code>requestUpdate(name, oldValue, options)</code> runs it too, so a manual call with an unchanged value schedules nothing (call <code>requestUpdate()</code> with no arguments to force one). <code>useDefault: true</code> makes the first value the default: it is not reflected, and removing the attribute restores it instead of <code>null</code>.</p>
    <p>A class that defines its own <code>get</code> / <code>set</code> for a declared property keeps it: the accessor is wrapped, so reads and writes go through your code (a private field included) and each write still records the change, reflects, and re-renders. With <code>noAccessor: true</code> nothing is wrapped and your setter calls <code>this.requestUpdate(name, oldValue)</code> itself.</p>
    <code-block>class Rating extends WebComponent {
  static properties = { level: { type: Number, reflect: true } };
  #level = 0;
  get level() { return this.#level; }
  set level(v) { this.#level = Math.max(0, Math.min(5, v)); }   // clamped, still reactive
}</code-block>

    <h3>Lit's static class API</h3>
    <p>The class-level members a Lit author reaches for work with Lit's meaning, over the same merged declarations the accessors and attribute readers use (the factory, <code>static properties</code>, and the parent chain):</p>
    <ul>
      <li><code>static elementProperties</code> is a <code>Map</code> of every declared property, own and inherited, to its normalised declaration.</li>
      <li><code>static getPropertyOptions(name)</code> returns one declaration, or the default <code>{ type: String }</code>.</li>
      <li><code>static createProperty(name, options)</code> declares a property from code. Call it at class definition time; once an instance exists the accessors are installed, so a later call throws naming the fix.</li>
      <li><code>static getPropertyDescriptor(name, key, options)</code> returns the accessor installed for each property. Override it and wrap <code>super.getPropertyDescriptor(...)</code>, or return <code>undefined</code> to install none.</li>
      <li><code>static addInitializer(fn)</code> runs <code>fn(element)</code> in the constructor of every instance of the class and its subclasses (Lit's hook for controllers that attach themselves).</li>
      <li><code>static finalize()</code> is idempotent, and <code>register()</code> and <code>observedAttributes</code> call it for you.</li>
    </ul>
    <code-block>class Tracked extends WebComponent({ count: Number }) {}
Tracked.addInitializer((el) =&gt; el.addController(new LoggerController(el)));
Tracked.createProperty('label', { type: String });
Tracked.getPropertyOptions('count').type;   // Number</code-block>

    <h3>Attribute-to-Property Coercion</h3>
    <p>When an attribute changes on the DOM element, WebJs coerces the string value to the declared type:</p>

    <ul>
      <li><strong>String</strong>: passed through as-is.</li>
      <li><strong>Number</strong>: converted via <code>Number(value)</code>. Null attributes become <code>null</code>.</li>
      <li><strong>Boolean</strong>: the property is <code>true</code> whenever the attribute is present, whatever its value, as in HTML and Lit, so <code>open="false"</code> is <code>true</code> (and warns once naming the property). Removing the attribute sets <code>false</code>. To turn one off from a template, bind <code>?open=\${false}</code>, which leaves the attribute out.</li>
      <li><strong>Object / Array</strong>: parsed via <code>JSON.parse()</code>. If parsing fails the property reads back as <code>null</code>, since a string is never a valid value for a property declared <code>Object</code> or <code>Array</code>. An attribute that was never there is a different case: it is not read at all, so the property keeps whatever the constructor gave it.</li>
      <li><strong>Every type</strong>: the value arrives with its HTML character references already decoded, on the server and in the browser alike, before the coercion above runs. So <code>cfg="&amp;#123;&amp;quot;a&amp;quot;:1&amp;#125;"</code> parses as the object it spells, and <code>label="Tom &amp;amp; Jerry"</code> is <code>Tom &amp; Jerry</code>. Named, decimal, and hexadecimal references are all covered, and so are the legacy semicolon-less forms, which decode only where a browser decodes them: <code>&amp;nbsp</code> at the end of a value is a non-breaking space, while <code>&amp;nbspx</code> and <code>&amp;nbsp=x</code> stay literal because the next character is alphanumeric or an <code>=</code>. Writing the semicolon avoids the question.</li>
    </ul>

    <p>As in Lit, <code>defaultConverter</code> and <code>notEqual</code> are exported (from <code>@webjsdev/core</code>), so a converter can fall back to the default for the cases it does not handle, and a <code>hasChanged</code> can build on the default check.</p>
    <p>A property supplying its own <code>converter.fromAttribute</code> bypasses that list entirely. The converter runs first, ahead of any type-based coercion, and whatever it returns IS the property value, so a <code>prop(Object)</code> with a converter never reaches the <code>JSON.parse()</code> step above. It runs on <strong>both</strong> attribute readers, the browser one and the server one, so it executes during SSR as well as on the client upgrade. Two consequences worth planning for. Keep a converter free of browser globals (<code>document</code>, <code>window</code>, <code>navigator</code>): SSR has no DOM, so touching one throws server-side and the component renders its error state instead of its content. And a converter that throws is not caught on either side, because an author who writes one owns the conversion; at SSR the throw is isolated to that component (an error box in dev, an empty element at a 200 in production, with the cause in the server log) while its siblings still render. Both readers hand the converter <strong>decoded</strong> attribute text, so a converter that parses its input (<code>JSON.parse</code> for a Map or a Set, <code>new Date(...)</code>) receives the same string server-side and client-side even when the attribute carries <code>&amp;quot;</code> or <code>&amp;amp;</code>.</p>

    <p>A property's default attribute is Lit's: the property name lowercased, so <code>userName</code> observes and reflects <code>username</code>. HTML attribute names are case-insensitive and the browser lowercases them while parsing, so <code>userName="…"</code> in markup arrives as <code>username</code> and reaches the property. The kebab spelling <code>user-name</code> is also read, as an alias, in the browser and on the server, but a reflected property always writes the lowercase name, so style a reflected state with <code>[username]</code> (or give the property an explicit <code>attribute: 'user-name'</code> when you want the kebab name everywhere). A property with a custom <code>attribute</code> answers to that name only.</p>

    <p>A property that renames its attribute answers to the new name and to nothing else. Given <code>open: prop(Boolean, { attribute: 'is-open' })</code>, write <code>&lt;my-el is-open&gt;</code>; <code>&lt;my-el open&gt;</code> reaches no property on either side.</p>

    <p>A <code>state: true</code> or <code>attribute: false</code> property has no attribute at all and is never read from one, on either side. The way to give one a server-rendered value is a <code>.prop=\${value}</code> binding from the parent template. With no <code>default</code> it is typed <code>T | undefined</code>, as Lit's <code>@state() open?: boolean</code> is, since nothing fills it until the component does; give it a <code>default</code> to type it as <code>T</code>.</p>


    <h3>Reflecting a function is refused</h3>
    <p>A <code>reflect: true</code> property holding a <strong>function</strong> (or an array that carries one) removes its attribute instead of writing one, and warns naming the property, the tag, and the attribute. A function has no HTML attribute representation, and the serializations it would otherwise get are both useless and dangerous. <code>String(fn)</code> is the function's source, so a reflected <code>'use server'</code> action would ship its whole body, closure secrets included, to every visitor, and <code>JSON.stringify(fn)</code> is <code>undefined</code>, which lands in an <code>Object</code>-typed or <code>Array</code>-typed attribute as that literal four-character string. Both sides behave the same, since SSR and the client-side setter run one reflection path, and it applies to every property name rather than only one called <code>action</code>.</p>
    <p>An <code>Object</code>-typed or <code>Array</code>-typed property CARRYING a function is the other exception, and it keeps its data: <code>JSON.stringify</code> drops the function to <code>null</code> and omits the key, so <code>[1, 2, fn]</code> reflects as <code>[1,2,null]</code> with no source and nothing else lost. A value <code>JSON.stringify</code> cannot serialize AT ALL is the opposite case and drops like a function does: a cycle, a <code>BigInt</code>, or a <code>toJSON()</code> that throws leaves nothing to put in the attribute, so the attribute is removed and a warning names the property, the tag, and the attribute. The distinction is between a value that serializes with a gap in it, which keeps its data, and one that does not serialize at all. A custom <code>converter.toAttribute</code> runs first and is left alone: an author who writes one has taken responsibility for serializing whatever they are handed. To keep a function on a component, use a plain property or a signal and do not mark it <code>reflect</code>. To bind a server action to a form, use <code>&lt;form action=\${importedAction}&gt;</code> (see <a href="/docs/server-actions">Server Actions</a>), which resolves the action's identity rather than stringifying it.</p>

    <blockquote>If you are coming from React: properties in WebJs serve a similar role to props, and by default they are backed by real DOM attributes. You can inspect them in DevTools, set them from plain HTML, and they survive page serialization during SSR.</blockquote>

    <h2>State</h2>
    <p>Signals are one of the state options, next to <code>state: true</code> and <code>attribute: false</code> properties. Import <code>signal</code> from <code>@webjsdev/core</code> and read with <code>signal.get()</code> inside <code>render()</code>. The component's built-in SignalWatcher tracks the read and re-renders whenever the signal changes. Instance signals (<code>readonly #items = signal(...)</code> class fields) carry component-local state; module-scope signals share state across components.</p>

    <code-block>import { WebComponent, html, signal } from '@webjsdev/core';

class TodoList extends WebComponent {
  readonly #items  = signal&lt;{ id: number; text: string; done: boolean }[]&gt;([]);
  readonly #filter = signal&lt;'all' | 'active'&gt;('all');

  addItem(text) {
    this.#items.set([...this.#items.get(), { id: Date.now(), text, done: false }]);
  }

  toggleItem(id) {
    this.#items.set(this.#items.get().map(it =&gt;
      it.id === id ? { ...it, done: !it.done } : it
    ));
  }

  render() {
    const visible = this.#filter.get() === 'all'
      ? this.#items.get()
      : this.#items.get().filter(it =&gt; !it.done);

    return html\`
      &lt;ul&gt;
        \${visible.map(it =&gt; html\`
          &lt;li @click=\${() =&gt; this.toggleItem(it.id)}
              style=\${it.done ? 'text-decoration: line-through' : ''}&gt;
            \${it.text}
          &lt;/li&gt;
        \`)}
      &lt;/ul&gt;
    \`;
  }
}
TodoList.register('todo-list');</code-block>

    <p>Everything lit offers for state works: a <code>state: true</code> property (internal, no attribute, reassign it to re-render), an <code>attribute: false</code> property (public, no attribute, set with <code>.prop=\${…}</code>), and signals. A signal is written with <code>.set()</code>, never assigned: <code>this.count = 5</code> on a signal field replaces the signal, so nothing re-renders and the next <code>.get()</code> throws. The <code>no-signal-field-assignment</code> rule in <code>webjs check</code> flags it.</p>

    <h3>How signal updates render</h3>
    <ul>
      <li><strong>Dynamic tracking</strong>: every update re-records its dependency set. A signal read anywhere in the synchronous update cycle (<code>willUpdate()</code>, <code>render()</code>, <code>updated()</code>) subscribes the component to that signal, so a host attribute derived from internal state in <code>updated()</code> follows it too; signals that fall out of the current control flow stop driving re-renders. The DOM commit is not tracked, which is what keeps a <code>watch()</code> part fine-grained.</li>
      <li><strong>Async render</strong>: in an <code>async render()</code>, only the reads made before the first <code>await</code> are tracked. Read the signals into locals at the top, then await. An event handler still reads the live signal (<code>this.#n.set(this.#n.get() + 1)</code>), not the local, which is a value from that render.</li>
      <li><strong>Batched re-render</strong>: calling <code>signal.set</code> (or assigning a reactive property, or calling <code>requestUpdate</code>) multiple times in the same synchronous block only triggers <strong>one</strong> re-render. Updates are batched via <code>queueMicrotask</code>, so the DOM update happens after the current call stack finishes but before the next frame paints.</li>
    </ul>

    <code-block>// These two writes result in a single re-render, not two:
this.count.set(1);
this.label = 'hello';
// render() is called once with the new count and label.</code-block>

    <h3>Fine-grained binding with <code>watch()</code></h3>
    <p>Reading <code>signal.get()</code> inside <code>render()</code> subscribes the WHOLE component to that signal: any change re-runs <code>render()</code>. When a single template hole depends on a single signal value and the rest of the template doesn't, the <code>watch(signal)</code> directive from <code>@webjsdev/core/directives</code> is a cheaper alternative: the directive sets up its own per-hole subscription, and <em>only</em> the bound text node (or attribute value) updates when the signal fires. The host's <code>render()</code> does not re-run, which also means <code>shouldUpdate</code> / <code>willUpdate</code> / <code>updated</code> are bypassed for that change.</p>

    <code-block>import { html, signal } from '@webjsdev/core';
import { watch } from '@webjsdev/core/directives';

const count = signal(0);

class Counter extends WebComponent {
  render() {
    // The host subscribes to nothing; only this hole updates.
    return html\`
      &lt;button @click=\${() =&gt; count.set(count.get() + 1)}&gt;
        \${watch(count)}
      &lt;/button&gt;
    \`;
  }
}
Counter.register('my-counter');</code-block>

    <p>SSR inlines the current value once; subscription is a client-only concern. Pick <code>watch()</code> when the binding is a scalar (text node, attribute value) tied to one signal and the surrounding template is expensive or static. Pick <code>signal.get()</code> when the render branches on the value, derives several things from it, or reads multiple signals together.</p>

    <h3>A bare signal in a hole</h3>
    <p>As in Lit's signals package, a signal placed in a hole WITHOUT <code>.get()</code> binds that hole the way <code>watch()</code> does: <code>\${count}</code> in text, <code>title=\${label}</code>, <code>?hidden=\${closed}</code>, and a signal inside an interpolated attribute (<code>class="card \${tone}"</code>) all render the current value on the server and update in place on the client, with no re-render of the host. A <code>.prop=\${sig}</code> hole is the exception: it hands the signal object itself to the property, so a child component can read it.</p>
    <code-block>html\`&lt;p title=\${label} class="badge \${tone}"&gt;\${count}&lt;/p&gt;\`;</code-block>
    <p>Lit's <code>SignalWatcher</code> mixin and <code>watch</code> are both importable from <code>@webjsdev/core/signals</code> (Lit's <code>@lit-labs/signals</code>). <code>SignalWatcher</code> returns the class it is given unchanged, because every <code>WebComponent</code> already watches the signals its update reads, so <code>class X extends SignalWatcher(WebComponent)</code> works and means the same thing as <code>class X extends WebComponent</code>.</p>

    <h2>Styles</h2>
    <p>Use the <code>css</code> tagged template to declare scoped styles on a component with <code>static shadow = true</code>; they are adopted into its shadow root. A light-DOM component (the default) has no shadow root to adopt them into, so <code>static styles</code> there is refused, as described below.</p>

    <code-block>import { WebComponent, html, css } from '@webjsdev/core';

class StyledCard extends WebComponent {
  static shadow = true;
  static styles = css\`
    :host {
      display: block;
      padding: var(--sp-4);
      border: 1px solid var(--border);
      border-radius: var(--rad-lg);
      background: var(--bg-elev);
    }
    :host(:hover) {
      border-color: var(--border-strong);
      box-shadow: var(--shadow);
    }
    h3 { margin: 0 0 8px; }
    p  { margin: 0; color: var(--fg-muted); }
  \`;

  render() {
    return html\`
      &lt;h3&gt;&lt;slot name="title"&gt;Untitled&lt;/slot&gt;&lt;/h3&gt;
      &lt;p&gt;&lt;slot&gt;&lt;/slot&gt;&lt;/p&gt;
    \`;
  }
}
StyledCard.register('styled-card');</code-block>

    <h3>How Styles Are Applied</h3>
    <ul>
      <li><strong>adoptedStyleSheets</strong>: when the browser supports it (all modern browsers), styles are applied via <code>adoptedStyleSheets</code> on the shadow root. This is the most efficient path: the browser parses the CSS once and shares the <code>CSSStyleSheet</code> object across all instances of the same component.</li>
      <li><strong>Fallback</strong>: on older browsers, a <code>&lt;style&gt;</code> element is injected into the shadow root instead.</li>
    </ul>

    <h3>Design Tokens via CSS Custom Properties</h3>
    <p>CSS custom properties (variables) <strong>inherit across shadow DOM boundaries</strong>. This is the primary mechanism for theming in WebJs. Define tokens on <code>:root</code> or a parent element, and every component in the tree can read them:</p>

    <code-block>/* In your root layout or global stylesheet */
:root {
  --accent: oklch(0.58 0.15 55);
  --bg-elev: white;
  --border: oklch(0.88 0.01 75);
  --rad-lg: 12px;
  --sp-4: 16px;
}

/* Inside a component's static styles, these "just work" */
static styles = css\`
  :host {
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: var(--rad-lg);
    padding: var(--sp-4);
  }
  .accent { color: var(--accent); }
\`;</code-block>

    <blockquote>This is fundamentally different from React CSS-in-JS solutions that require runtime injection or build tooling. WebJs uses the platform: shadow DOM gives you scoping, CSS custom properties give you theming, and there is nothing to configure.</blockquote>

    <h2>Light DOM (default)</h2>
    <p>Light DOM is the default because global CSS and Tailwind utility classes apply directly: no <code>:host</code>, no <code>::part</code>, no CSS-variable plumbing. The browser renders a plain custom element with normal children. This is the mode the blog example uses everywhere except when shadow DOM buys something specific.</p>
    <p><strong>Light-DOM hosts default to <code>display: block</code>.</strong> A custom element is <code>display: inline</code> by default (so a container component would collapse), and a light-DOM component has no <code>:host</code> to fix it with. So the framework marks every light host <code>data-wj-host</code> and injects one low-priority-layer rule (<code>@layer webjs-host &#123; :where([data-wj-host]) &#123; display: block &#125; &#125;</code>), overridable by any author style including Tailwind utilities (<code>class="flex"</code> wins). Shadow-DOM hosts are NOT marked: set their display via <code>:host</code> in <code>static styles</code>, the way Lit does (fully respected). See the <a href="/docs/styling">styling</a> page.</p>

    <code-block>// static shadow = false is the default, no need to declare it.
class AppCard extends WebComponent({ heading: String }) {
  constructor() {
    super();
    this.heading = '';
  }

  render() {
    return html\`
      &lt;div class="rounded-lg border border-border bg-bg-elev p-6"&gt;
        &lt;h3 class="font-serif text-lg mb-2"&gt;\${this.heading}&lt;/h3&gt;
        &lt;p class="text-fg-muted"&gt;Tailwind utility classes apply directly.&lt;/p&gt;
      &lt;/div&gt;
    \`;
  }
}
AppCard.register('app-card');</code-block>

    <h3>Class-prefix rule for custom CSS</h3>
    <p>Tailwind utilities are unique by construction, so most light-DOM components need zero custom CSS. If you <em>do</em> author a <code>&lt;style&gt;</code> block or import a stylesheet, <strong>every class selector MUST be prefixed with the component's tag name</strong>. Otherwise two components with a <code>.card</code> or <code>.header</code> class will style each other.</p>

    <code-block>// Pattern A: BEM-ish class names prefixed with tag
class MyCard extends WebComponent {
  render() {
    return html\`
      &lt;style&gt;
        .my-card__body  { padding: 16px; }
        .my-card__title { font-weight: 600; }
      &lt;/style&gt;
      &lt;div class="my-card__body"&gt;&lt;h3 class="my-card__title"&gt;\${t}&lt;/h3&gt;&lt;/div&gt;
    \`;
  }
}

// Pattern B: descendant selector rooted at the tag
class MyCard extends WebComponent {
  render() {
    return html\`
      &lt;style&gt;
        my-card .body  { padding: 16px; }
        my-card .title { font-weight: 600; }
      &lt;/style&gt;
      &lt;div class="body"&gt;&lt;h3 class="title"&gt;\${t}&lt;/h3&gt;&lt;/div&gt;
    \`;
  }
}</code-block>

    <h2>Shadow DOM (opt-in)</h2>
    <p>Set <code>static shadow = true</code> when you want one of these:</p>
    <ul>
      <li>Scoped styles via <code>static styles = css\`...\`</code> (adopted via <code>adoptedStyleSheets</code>) without prefix discipline.</li>
      <li><code>::slotted()</code> CSS selectors from inside the shadow tree, since the native browser projection is what makes them work.</li>
      <li>Third-party embed isolation: your component looks right in any host page, regardless of their CSS.</li>
    </ul>
    <p><strong>Slots themselves are NOT a reason to opt into shadow DOM.</strong> <code>&lt;slot&gt;</code>, <code>&lt;slot name="x"&gt;</code>, fallback content, <code>assignedNodes()</code>, <code>assignedElements()</code>, <code>assignedSlot</code>, <code>slotchange</code>, named-slot routing, and first-wins resolution all work identically in light DOM (the framework's default). See the <strong>Slots</strong> section below for the full surface.</p>

    <code-block>class Card extends WebComponent {
  static shadow = true;                 // opt in
  static styles = css\`
    :host { display: block; padding: 16px; border: 1px solid var(--border); border-radius: 8px; }
    h3 { margin: 0 0 8px; }
    p  { color: var(--fg-muted); margin: 0; }
  \`;
  render() {
    return html\`
      &lt;h3&gt;&lt;slot name="title"&gt;&lt;/slot&gt;&lt;/h3&gt;
      &lt;p&gt;&lt;slot&gt;&lt;/slot&gt;&lt;/p&gt;
    \`;
  }
}
Card.register('my-card');</code-block>

    <p><code>static styles</code> on a light-DOM component never applies, since there is no shadow root to adopt it into, so WebJs reports it rather than ignoring it. <code>webjs check</code> flags it, and the dev server and the browser each log an error once per class naming <code>static shadow = true</code> as the fix. Lit attaches a shadow root by default and WebJs does not, so this is the habit to watch; <code>static shadowRootOptions</code> without <code>static shadow = true</code> is flagged the same way (<code>shadow-options-need-shadow</code>). A hole in a <code>css</code> template takes another <code>css</code> result or a number; a plain string throws and must be wrapped in <code>unsafeCSS()</code> (see <a href="/docs/styling">Styling</a>).</p>

    <h3>shadowRootOptions, createRenderRoot() and renderRoot</h3>
    <p>These are Lit's members with Lit's meaning. <code>static shadowRootOptions</code> holds the <code>attachShadow()</code> options (<code>delegatesFocus</code>, <code>clonable</code>, <code>serializable</code>, a <code>closed</code> mode); the server writes them onto the Declarative Shadow DOM template too (<code>shadowrootdelegatesfocus</code> and friends), so the first paint and the hydrated element agree. A <code>closed</code> root is reused through <code>ElementInternals</code> rather than replaced, so its server-rendered content survives the upgrade, and a later <code>this.attachInternals()</code> in your own code returns that same internals object. <code>this.renderRoot</code> is the node <code>render()</code> commits into: the shadow root here, the element itself in light DOM. It is <code>undefined</code> until the element connects and at SSR.</p>
    <code-block>class FancyInput extends WebComponent {
  static shadow = true;
  static shadowRootOptions = { mode: 'open', delegatesFocus: true };
  render() { return html\`&lt;input&gt;\`; }
  firstUpdated() { this.renderRoot.querySelector('input')?.select(); }
}</code-block>
    <p><code>createRenderRoot()</code> creates that root once per element. Its default returns the element for light DOM, and for <code>static shadow = true</code> attaches the shadow root (or reuses the server-rendered one) and adopts <code>static styles</code>. Lit's <code>createRenderRoot() { return this; }</code> works and is already the default. An override may post-process <code>super.createRenderRoot()</code>, but it cannot switch modes on its own: the server renders from <code>static shadow</code> and never calls it, so a shadow root returned without <code>static shadow = true</code> (or a light root with it) throws on connect, naming the fix. Calling <code>attachShadow()</code> yourself during SSR throws the same way, since the server has no DOM.</p>

    <h3>Mode summary</h3>
    <p>Both modes are <strong>fully SSR'd</strong>. Shadow DOM renders via Declarative Shadow DOM (<code>&lt;template shadowrootmode="open"&gt;</code>). Light DOM renders content directly as HTML with a <code>&lt;!--webjs-hydrate--&gt;</code> marker. Both hydrate on the client without flash.</p>

    <table>
      <thead>
        <tr><th>Component type</th><th>Mode</th><th>Why</th></tr>
      </thead>
      <tbody>
        <tr><td>Global / Tailwind utility classes, simple composition</td><td><strong>Light DOM</strong> (default)</td><td>Utilities apply directly. No host plumbing.</td></tr>
        <tr><td><code>static styles = css\`\`</code> scoped styles</td><td>Shadow DOM</td><td><code>adoptedStyleSheets</code> needs a shadow root.</td></tr>
        <tr><td><code>&lt;slot&gt;</code> content projection</td><td><strong>Either</strong></td><td>Full shadow-DOM spec parity in light DOM. Same <code>&lt;slot&gt;</code> / <code>&lt;slot name="x"&gt;</code> / fallback / <code>assignedNodes</code> / <code>slotchange</code> in both modes.</td></tr>
        <tr><td>Third-party embed needing isolation</td><td>Shadow DOM</td><td>CSS can't leak in or out.</td></tr>
      </tbody>
    </table>

    <h2>SSR and the first paint</h2>

    <p>Every web component on a page runs through the SSR pipeline. For each rendered tag, the server:</p>

    <ol>
      <li>Calls <code>new Cls()</code>: the constructor runs.</li>
      <li>Applies the element's attributes to the instance (via the factory's property converters).</li>
      <li>Calls <code>instance.render()</code> and awaits the resulting template.</li>
      <li>Inlines the rendered HTML as the element's children (light DOM) or wraps it in <code>&lt;template shadowrootmode="open"&gt;</code> (shadow DOM).</li>
    </ol>

    <p>The server runs the pre-render value-deriving hooks before <code>render()</code>: <code>willUpdate</code> and controllers' <code>hostUpdate</code>, then it reflects <code>reflect: true</code> properties. <strong>It does NOT call <code>connectedCallback</code>, <code>firstUpdated</code>, <code>updated</code>, or any browser-only hook.</strong> Those run only after the script loads in the browser. This is intentional. The server runs many components for many concurrent requests, and the browser-only hooks frequently touch <code>window</code>, <code>document</code>, <code>localStorage</code>, observers, and timers that don't exist server-side. (A <code>Task</code> is the exception among controllers: its <code>hostUpdate</code> does not auto-run at SSR, so it ships the <code>INITIAL</code> state and fetches only on hydration.)</p>

    <h3>Rule: SSR-meaningful state goes in the constructor</h3>

    <p>Whatever state should appear in the first paint MUST be set in the constructor (after <code>super()</code>) or be derivable from the factory's properties + the tag's attributes. The SSR pipeline reads exactly these values.</p>

    <code-block>// ❌ first paint is empty (initial state set in browser-only hook)
class Cart extends WebComponent({ items: prop&lt;Item[]&gt;(Array) }) {
  connectedCallback() {                       // ← server never runs this
    super.connectedCallback();
    this.items = readFromLocalStorage();
    this.requestUpdate();
  }

  render() { return html\`&lt;ul&gt;\${this.items.map(/* … */)}&lt;/ul&gt;\`; }
}</code-block>

    <code-block>// ✅ SSR-safe: instance signal carries the default,
//    browser hook refines after hydration
class Cart extends WebComponent {
  readonly #items = signal&lt;Item[]&gt;([]);                  // ← SSR uses this

  connectedCallback() {
    super.connectedCallback();
    const stored = readFromLocalStorage();
    if (stored) this.#items.set(stored);         // browser-only refinement
  }

  render() { return html\`&lt;ul&gt;\${this.#items.get().map(/* … */)}&lt;/ul&gt;\`; }
}</code-block>

    <h3>Where each kind of data belongs</h3>

    <table>
      <thead>
        <tr><th>Data source</th><th>Where to read it</th></tr>
      </thead>
      <tbody>
        <tr><td>Database, session, cookies, request headers</td><td>Page function (server). Pass to the component as an attribute or property.</td></tr>
        <tr><td>Server data a leaf component needs in the first paint</td><td>An <code>async render()</code> in the component (<code>const u = await getUser(this.uid)</code>). Co-located, no prop-drilling. See below.</td></tr>
        <tr><td>Initial state / defaults known at coding time</td><td>Instance signal in a class-field initializer, or the component's <code>constructor()</code> after <code>super()</code>.</td></tr>
        <tr><td>Browser-only: <code>localStorage</code>, viewport, <code>matchMedia</code>, <code>navigator.*</code></td><td>Component's <code>connectedCallback()</code>, then write the signal to refine.</td></tr>
        <tr><td>Flash-sensitive (theme, RTL direction)</td><td>Synchronous inline <code>&lt;script&gt;</code> in the root layout's <code>&lt;head&gt;</code> that writes attributes to <code>document.documentElement</code> before custom elements upgrade.</td></tr>
      </tbody>
    </table>

    <p>This is the design rule that makes <a href="/docs/progressive-enhancement">progressive enhancement</a> work in webjs: the component's HTML lands in the response, with the right content, before any script runs.</p>

    <h3>Compound components: reading the parent with closest() at SSR</h3>
    <p>A compound component (a tabs trigger, a toggle-group item) derives its active or pressed state by walking up to the parent and reading the parent's value. WebJs supports <code>this.closest(...)</code> at SSR for <strong>tag-name selectors only</strong>, so the active or pressed state is marked in the <strong>first server paint</strong>, not only after hydration.</p>

    <code-block>class UiTabsTrigger extends WebComponent({ value: String }) {
  get _tabs() { return this.closest('ui-tabs'); }

  render() {
    const active = this._tabs?.value === this.value;
    this.dataset.state = active ? 'active' : 'inactive';
    return html\`&lt;button data-state=\${active ? 'active' : 'inactive'}&gt;&lt;slot&gt;&lt;/slot&gt;&lt;/button&gt;\`;
  }
}
UiTabsTrigger.register('ui-tabs-trigger');</code-block>

    <p>The SSR walker threads the chain of enclosing custom-element instances into each instance, and the server element shim's <code>closest()</code> resolves a parent over that chain (so <code>this.closest('ui-tabs').value</code> reads the live parent property the walker already applied). Host IDL properties a <code>render()</code> mutates on <code>this</code> (<code>this.dataset.*</code>, <code>this.className</code>, <code>this.hidden</code>, the <code>aria*</code> mixin) reflect to the matching attribute on the SSR'd host tag, so the active tab is marked before any JavaScript runs. The first client render produces the identical state (the browser's real <code>closest()</code> against the real DOM), so there is no hydration flash. Two limits apply.</p>
    <ul>
      <li>Only <strong>tag-name selectors</strong> resolve at SSR (<code>closest('ui-tabs')</code>). A class, attribute, or descendant selector returns <code>null</code> server-side and resolves on the client. That covers the compound-component pattern, anything finer is client-only.</li>
      <li>The compound <strong>parent</strong> must be light DOM (the default, and what every UI-kit compound component uses). A shadow-DOM parent projects its children through a native <code>&lt;slot&gt;</code>, and those slotted children are not threaded the SSR ancestor chain, so their <code>closest(parent)</code> resolves to <code>null</code> in the first server paint (it still resolves on the client after hydration). Keep compound parents light DOM for a correct first paint.</li>
    </ul>
    <p>Genuine layout or live-DOM reads (<code>querySelector</code>, <code>classList</code>, <code>attachShadow</code>, geometry) still throw at SSR, so keep them in <code>connectedCallback</code> or <code>firstUpdated</code>. See <a href="/docs/ssr">Server-Side Rendering</a> for the server element shim that backs this.</p>

    <h2>Fetching data in a component (async render)</h2>
    <p>A leaf component can fetch its own server data into the first paint, so you do not have to fetch it in the page and prop-drill it down. Make <code>render()</code> async and call a <code>'use server'</code> action directly:</p>
    <code-block>class UserProfile extends WebComponent({ uid: String }) {
  async render() {
    const u = await getUser(this.uid);   // real fn at SSR, RPC stub on the client
    return html\`&lt;h3&gt;\${u.name}&lt;/h3&gt;\`;
  }
}
UserProfile.register('user-profile');</code-block>
    <p>SSR awaits the render, so the data is in the first paint with no fallback (JS-off reads it). On a client re-fetch (a prop change) the default is stale-while-revalidate: the prior content stays until the new render resolves. Define <code>renderFallback()</code> only to show a loading state DURING a re-fetch (never on the first paint). A thrown <code>await</code> is isolated to that component, with <code>renderError()</code> as the optional custom UI.</p>
    <h3>Which tool to reach for</h3>
    <ul>
      <li><strong>Server data knowable at request time</strong>: <code>async render()</code> in the component. The default, simplest case.</li>
      <li><strong>Re-fetch where stale content would mislead</strong>: add <code>renderFallback()</code>.</li>
      <li><strong>Genuinely client-only data</strong> (depends on a click, viewport, localStorage, or live updates, not needed in the first paint): use <code>Task</code> / signals plus an RPC action. A <code>Task</code> never runs at SSR (the server renders its initial state), so it loses first-paint data.</li>
      <li><strong>Slow server data</strong> where blocking the first byte hurts: stream it by wrapping the component in <code>&lt;webjs-suspense .fallback=\${html\`…\`}&gt;</code> (fallback on the first byte, content streams in). See <a href="/docs/data-fetching">Data fetching</a>.</li>
    </ul>
    <h3>Anti-patterns</h3>
    <ul>
      <li>Do NOT prop-drill server data through layers when the leaf component can fetch it itself.</li>
      <li>Do NOT put <code>await getData()</code> in a page / layout function if it can live in a component (page fetches run sequentially, a route-level waterfall).</li>
      <li>Do NOT fetch in <code>connectedCallback</code> / <code>Task</code> for data that is knowable server-side (that yields a fallback-then-RPC, not first-paint data).</li>
      <li>Do NOT expect <code>renderFallback()</code> to affect the first paint, and do NOT add <code>renderError()</code> on every component (isolation is automatic).</li>
    </ul>

    <h2>Slots: Content Projection</h2>
    <p>Slots are how a parent passes content into a component. If you are coming from React, think of the default slot as <code>children</code>. <strong>WebJs supports the full shadow-DOM <code>&lt;slot&gt;</code> surface in light DOM as well as shadow DOM</strong>, so every example below works identically whether the component sets <code>static shadow = true</code> or leaves it at the default (light DOM). The light-DOM runtime mirrors <code>HTMLSlotElement.assignedNodes()</code>, <code>assignedElements()</code>, <code>assignedSlot</code>, and the <code>slotchange</code> event, plus named slots, fallback content, and first-wins resolution. To our knowledge no other web-components framework offers this complete parity in light DOM. Lit's slot APIs only work inside shadow roots, and Stencil's light-DOM slot polyfill has known gaps around fallback content and mixed shadow / non-shadow trees.</p>

    <h3>The native slot API, in light DOM</h3>
    <p>There is no WebJs-specific slot API. Light-DOM slots ARE the native DOM slot API, so post-mount writes are live exactly as in shadow DOM: <code>appendChild</code>, <code>insertBefore</code>, <code>removeChild</code>, <code>el.remove()</code>, <code>innerHTML</code>, flipping a child's <code>slot=""</code> attribute, and <code>HTMLSlotElement.assign()</code> all re-project immediately. The reads (<code>assignedNodes()</code>, <code>assignedElements()</code>, <code>assignedSlot</code>) and the <code>slotchange</code> event behave identically to shadow DOM, including native async-coalesced <code>slotchange</code> timing. One caveat rides <code>assign()</code>, which in light DOM is an <em>extension</em> (an element-bound overlay that works alongside name matching) while native shadow <code>assign()</code> only works under <code>slotAssignment: 'manual'</code>, a mode WebJs's shadow side does not set. So <code>assign()</code> is the one write that does not survive flipping to <code>static shadow = true</code>; prefer <code>slot=""</code> attributes in a component meant to move between modes.</p>

    <code-block>const card = document.querySelector('my-card');

// Every one of these is live, and identical to shadow DOM:
card.appendChild(node);
card.querySelector('[slot=old]').slot = 'new'; // re-projects
card.innerHTML = '&lt;p&gt;replaced&lt;/p&gt;';

// Reads mirror shadow DOM:
card.querySelector('slot').assignedNodes();
node.assignedSlot;
card.querySelector('slot').addEventListener('slotchange', ...);</code-block>

    <p><strong>Migrating from a shadow-DOM component</strong>: flip <code>static shadow</code> and nothing else changes, with the documented gaps on this page as the exceptions (most notably the <code>assign()</code> caveat above and first-render read timing). You write the same template and the same imperative code.</p>

    <p><strong>The four light-DOM gaps</strong>, all a consequence of light DOM having no shadow boundary, not missing features:</p>
    <ul>
      <li><strong>Structural host reads.</strong> <code>host.children</code> / <code>host.childNodes</code> / <code>host.querySelector(':scope > ...')</code> and the <code>innerHTML</code> <em>getter</em> read the rendered template, not the authored children (in shadow DOM the authored children stay in the host's light tree). Read slotted content with <code>assignedNodes()</code> instead.</li>
      <li><strong><code>assignedChild.parentNode</code></strong> is the <code>&lt;slot&gt;</code> element, not the host.</li>
      <li><strong><code>::slotted()</code> CSS</strong> is shadow-only (it needs the boundary to select across). In light DOM, style slotted content with normal selectors or Tailwind on the children directly, which is strictly more powerful.</li>
      <li><strong>Initial-projection timing.</strong> The first light-DOM projection lands one microtask after the first render, so <code>firstUpdated()</code> sees the <code>&lt;slot&gt;</code> element with an <em>empty</em> <code>assignedNodes()</code> (shadow DOM projects natively before it). Read assigned content from a <code>slotchange</code> listener, or after a microtask. Every later read and every mutation-driven update is identical in both modes.</li>
    </ul>

    <p><strong>Conditional-on-slot</strong> at render time (branching a template on whether a slot has content) is not a thing in either mode, because a shadow template can't branch on light-child presence at render time either. Use CSS <code>:has()</code> / <code>slot:empty</code>, or a <code>slotchange</code> listener.</p>

    <p>A generic DOM library that reaches into a component should operate on the assigned nodes, never on the host element itself.</p>

    <p><strong>Live writes need the component's JS on the page.</strong> Every component in an ordinary file ships, so its slots stay live after mount. A slotted wrapper written as a <a href="#server-only">server-only component</a> renders its slot on the server and never defines itself in the browser, so post-mount native writes into it are plain DOM writes with no slot runtime behind them. Keep a wrapper you write into after load in an ordinary file.</p>

    <p><strong>Forwarded slots project their content everywhere.</strong> A template can forward a slot into a nested component (<code>html\`&lt;inner-shell&gt;&lt;slot&gt;&lt;/slot&gt;&lt;/inner-shell&gt;\`</code>), and the outer component's content projects through it on a client-only mount, in the server-rendered first paint, and across hydration (it does not flash back to the fallback on the client). The renderer stamps each slot with the host whose template produced it, so a forwarded slot routes to the outer component that rendered it rather than the child it nests in.</p>

    <p><strong>A layout's named slots stay in sync across soft navigation.</strong> When a <em>layout</em> renders its <code>\${children}</code> inside a slotted shell and a page emits top-level <code>slot=""</code>-attributed children, the named-slot slices update on a soft-nav boundary swap just as the default slice does: the swap resyncs every slot of the enclosing shell from the incoming page.</p>

    <h3>Default Slot</h3>
    <p>The <code>&lt;slot&gt;&lt;/slot&gt;</code> element in a component's <code>render()</code> is where the parent's child content appears:</p>

    <code-block>// Component definition
class AppShell extends WebComponent {
  // ...
  render() {
    return html\`
      &lt;header&gt;My App&lt;/header&gt;
      &lt;main&gt;&lt;slot&gt;&lt;/slot&gt;&lt;/main&gt;
      &lt;footer&gt;Copyright 2026&lt;/footer&gt;
    \`;
  }
}

// Usage: the &lt;p&gt; is projected into &lt;main&gt;
html\`
  &lt;app-shell&gt;
    &lt;p&gt;This paragraph appears inside the main slot.&lt;/p&gt;
  &lt;/app-shell&gt;
\`;</code-block>

    <p>This is how WebJs layouts work: the <code>doc-shell</code> and <code>blog-shell</code> components in the examples use a default <code>&lt;slot&gt;</code> to receive page content from the router.</p>

    <h3>Named Slots</h3>
    <p>Use <code>&lt;slot name="..."&gt;</code> to route different pieces of content to different parts of a component:</p>

    <code-block>class PageLayout extends WebComponent {
  static shadow = true;
  static styles = css\`
    .sidebar { float: left; width: 200px; }
    .content { margin-left: 220px; }
    footer   { clear: both; border-top: 1px solid #ccc; padding-top: 16px; }
  \`;

  render() {
    return html\`
      &lt;div class="sidebar"&gt;
        &lt;slot name="sidebar"&gt;&lt;em&gt;No sidebar provided&lt;/em&gt;&lt;/slot&gt;
      &lt;/div&gt;
      &lt;div class="content"&gt;
        &lt;slot&gt;&lt;/slot&gt;
      &lt;/div&gt;
      &lt;footer&gt;
        &lt;slot name="footer"&gt;Default footer content&lt;/slot&gt;
      &lt;/footer&gt;
    \`;
  }
}
PageLayout.register('page-layout');

// Usage: assign content to named slots with the slot="" attribute
html\`
  &lt;page-layout&gt;
    &lt;nav slot="sidebar"&gt;
      &lt;a href="/"&gt;Home&lt;/a&gt;
      &lt;a href="/about"&gt;About&lt;/a&gt;
    &lt;/nav&gt;

    &lt;h1&gt;Main Content&lt;/h1&gt;
    &lt;p&gt;This goes into the default (unnamed) slot.&lt;/p&gt;

    &lt;small slot="footer"&gt;Custom footer here.&lt;/small&gt;
  &lt;/page-layout&gt;
\`;</code-block>

    <p>Content without a <code>slot</code> attribute goes to the default (unnamed) slot. Content with <code>slot="name"</code> is routed to the matching <code>&lt;slot name="name"&gt;</code>. Text inside the <code>&lt;slot&gt;</code> tag itself is fallback content shown when no matching content is provided.</p>

    <h2>Lifecycle</h2>
    <p>WebJs components use the standard custom element lifecycle callbacks. If you override them, <strong>always call super</strong>.</p>

    <h3>connectedCallback()</h3>
    <p>Called when the element is inserted into the document. WebJs sets up the render root here (attaching the shadow root and adopting styles when <code>static shadow = true</code>) and queues the first render, which runs a microtask later, as in Lit. DOM work that needs the rendered output belongs in <code>firstUpdated()</code>. Use <code>connectedCallback</code> for setup work like fetching data, opening WebSocket connections, or reading from <code>localStorage</code>:</p>

    <code-block>connectedCallback() {
  super.connectedCallback();  // REQUIRED: sets up the render root, queues the first render
  this._ws = connectWS('/api/chat', {
    onMessage: (msg) =&gt; this.messages.set([...this.messages.get(), msg]),
  });
}</code-block>

    <blockquote>Forgetting <code>super.connectedCallback()</code> is the #1 mistake. Without it, the component will never render.</blockquote>

    <h3>disconnectedCallback()</h3>
    <p>Called when the element is removed from the document. Clean up event listeners, timers, WebSocket connections, and other resources:</p>

    <code-block>disconnectedCallback() {
  super.disconnectedCallback();
  this._ws?.close();
  this._ws = null;
  clearInterval(this._timer);
}</code-block>

    <p>Always call <code>super.disconnectedCallback()</code>. The base class disposes the component's signal subscriptions, tears down its slot observers, and calls each controller's <code>hostDisconnected()</code>; skipping it leaks all three.</p>

    <h3>attributeChangedCallback(name, oldValue, newValue)</h3>
    <p>Called when one of the <code>observedAttributes</code> changes. WebJs handles this for you. It coerces the attribute value based on the type declared in the factory shape, sets the corresponding instance property, and schedules a re-render. You rarely need to override this, but you can if you need side effects when a specific attribute changes:</p>

    <code-block>attributeChangedCallback(name, oldVal, newVal) {
  super.attributeChangedCallback(name, oldVal, newVal);
  if (name === 'src' &amp;&amp; newVal !== oldVal) {
    this._loadImage(newVal);
  }
}</code-block>

    <h3>Render Is Automatic</h3>
    <p>You never call <code>render()</code> directly. It is called automatically:</p>
    <ul>
      <li>Once after <code>connectedCallback()</code>, a microtask later (first render).</li>
      <li>After every signal write the render reads (tracked by the built-in SignalWatcher).</li>
      <li>After every reactive-property assignment.</li>
      <li>After every <code>requestUpdate()</code> call.</li>
      <li>After every observed attribute change.</li>
    </ul>

    <h2>Events in Templates</h2>
    <p>Attach event listeners using the <code>@event</code> syntax in templates. This works like React's <code>onClick</code>, <code>onSubmit</code>, etc., but maps directly to DOM event names:</p>

    <code-block>render() {
  return html\`
    &lt;button @click=\${() =&gt; this.increment()}&gt;Click me&lt;/button&gt;
    &lt;form @submit=\${(e) =&gt; this.handleSubmit(e)}&gt;
      &lt;input @input=\${(e) =&gt; this.onInput(e)} /&gt;
      &lt;button type="submit"&gt;Send&lt;/button&gt;
    &lt;/form&gt;
  \`;
}</code-block>

    <h3>How Event Binding Works</h3>
    <ul>
      <li><strong>Server rendering</strong>: <code>@event</code> bindings are stripped during SSR. The HTML sent to the browser contains no inline handlers. This is safe, clean, and Content-Security-Policy friendly.</li>
      <li><strong>Client rendering</strong>: on the client, each <code>@event</code> binding creates a <strong>stable dispatcher</strong> function that is registered once with <code>addEventListener</code>. When you re-render with a new handler reference, the dispatcher is updated in place, so no listener is removed and re-added. This eliminates event listener churn that plagues naive re-render strategies.</li>
      <li><strong>Function listeners receive the component as <code>this</code></strong>: plain function listeners receive the rendering custom element instance as <code>this</code>, while arrow functions and bound functions preserve their own receiver. Listener objects implementing <code>handleEvent(event)</code> are supported and can specify event options like <code>capture</code>, <code>once</code>, and <code>passive</code>.</li>
    </ul>

    <code-block>// Even though this creates a new arrow function on every render,
// the actual addEventListener is only called once. The dispatcher
// swaps the inner handler reference behind the scenes.
render() {
  return html\`
    &lt;button @click=\${() =&gt; this.count.set(this.count.get() + 1)}&gt;
      \${this.count.get()}
    &lt;/button&gt;
  \`;
}</code-block>

    <h2>Properties vs Attributes in Templates</h2>
    <p>Templates support three binding prefixes for setting values on elements:</p>

    <p><strong>One carve-out applies to all three below: a function under <code>action=</code> or <code>formaction=</code> is never stringified.</strong> Stringifying a function writes its source into the HTML, and during SSR an imported <code>'use server'</code> action is the real function, so that source is the action's whole body. An unquoted <code>action=\${fn}</code> on a <code>&lt;form&gt;</code> BINDS the action instead (see <a href="/docs/server-actions">Server Actions</a>); every other shape under those two names is refused (quoted, mixed, array-wrapped, <code>action=\${fn}</code> off a <code>&lt;form&gt;</code>, and <code>.action=\${fn}</code> on a native form, which reflects into the live DOM). A function stays legal on an unquoted <code>@action=\${fn}</code> listener and on a custom element's own <code>.action</code> property, because neither stringifies it. So where the rules below say a value is stringified, that a native property binding drops at SSR, or that a boolean hole emits the attribute when truthy, read them as holding for every attribute except these two. See <a href="/docs/troubleshooting">Troubleshooting</a>.</p>

    <h3>Regular Attributes: <code>attr=\${value}</code></h3>
    <p>Sets an HTML attribute following Lit JavaScript semantics. Strings and numbers are stringified. Booleans are stringified (<code>"true"</code> / <code>"false"</code>), so <code>aria-expanded=\${this.open}</code> renders <code>"true"</code> or <code>"false"</code>. <code>null</code> and <code>undefined</code> produce an empty string (<code>attr=""</code>). To omit an attribute entirely, pass the <code>nothing</code> sentinel from <code>@webjsdev/core</code> (e.g. <code>title=\${value ?? nothing}</code>) or use a boolean attribute binding (<code>?attr=\${condition}</code>).</p>

    <code-block>html\`&lt;input type="text" value=\${this.name} class=\${this.active ? 'on' : 'off'} /&gt;\`</code-block>

    <h3>Property Bindings: <code>.prop=\${value}</code></h3>
    <p>Sets a JavaScript property directly on the DOM element, bypassing attribute serialization. Use this when you need to pass objects, arrays, or other non-string values to a child component:</p>

    <code-block>html\`&lt;my-chart .data=\${this.chartData} .options=\${{ animate: true }}&gt;&lt;/my-chart&gt;\`</code-block>

    <p><strong>On custom elements, property bindings round-trip through SSR.</strong> The renderer serializes the value via webjs's wire format (which handles Array, Object, Date, Map, Set, BigInt, and reference cycles) and emits it as a <code>data-webjs-prop-*</code> attribute. The SSR walker reads the attribute before calling <code>render()</code> so the component's first paint includes the bound value. On the client, <code>connectedCallback</code> applies and strips the attribute. End-to-end DX: <code>html\`&lt;post-list .posts=\${posts}&gt;&lt;/post-list&gt;\`</code> in a page function just works, with rich types preserved.</p>

    <p><strong>On native elements (<code>&lt;input&gt;</code>, <code>&lt;button&gt;</code>, etc.), property bindings still drop at SSR.</strong> Native elements have no SSR walker that would consume the side-channel attribute, and the framework's HTML primitives already cover this case via the attribute form (<code>value=\${v}</code>, <code>checked=\${b}</code>). When the template runs in the browser (component <code>render()</code>, dynamic re-renders), the property is set normally. The property form is most useful for two-way controlled inputs via <code>.value=\${live(v)}</code> paired with an <code>@input</code> handler.</p>

    <p><strong>Unserializable values</strong> (functions, class instances with private state, DOM nodes) drop at SSR with a single-line dev warning. The browser sees the property as <code>undefined</code>. Use <code>@event=\${fn}</code> for callbacks or set imperatively in <code>firstUpdated</code> for client-only references.</p>

    <h3>Boolean Attributes: <code>?attr=\${flag}</code></h3>
    <p>Adds the attribute if the value is truthy, removes it if falsy. This is the correct way to handle boolean HTML attributes like <code>disabled</code>, <code>checked</code>, <code>hidden</code>, and <code>readonly</code>:</p>

    <code-block>html\`
  &lt;button ?disabled=\${!this.connected.get()}&gt;Send&lt;/button&gt;
  &lt;input ?checked=\${this.agreed.get()} type="checkbox" /&gt;
  &lt;div ?hidden=\${this.items.get().length === 0}&gt;No items&lt;/div&gt;
\`</code-block>

    <p>During SSR, <code>?disabled=\${true}</code> emits <code>disabled=""</code> and <code>?disabled=\${false}</code> emits nothing, matching how the browser interprets boolean attributes.</p>

    <h3>SVG Fragments: <code>svg\`...\`</code></h3>
    <p>A template is parsed as HTML in the browser, so markup that belongs inside an <code>&lt;svg&gt;</code> but is built in its own template (a <code>&lt;rect&gt;</code> per data point, a helper returning a <code>&lt;path&gt;</code>) comes out as HTML elements and never paints. Write those fragments with the <code>svg</code> tag from <code>@webjsdev/core</code>, the same tag Lit has, and keep the outer <code>&lt;svg&gt;</code> element in <code>html</code>. Every binding above works inside it. The server renders the two tags identically, so the <code>html</code> mistake shows only after a re-render in the browser.</p>

    <code-block>import { html, svg } from '@webjsdev/core';

const bar = (v, i) =&gt; svg\`&lt;rect x=\${i * 12} width="10" height=\${v}&gt;&lt;/rect&gt;\`;
html\`&lt;svg viewBox="0 0 120 100"&gt;\${values.map(bar)}&lt;/svg&gt;\`</code-block>

    <h3>Sentinels and Directives: <code>nothing</code>, <code>noChange</code>, <code>classMap</code>, <code>styleMap</code></h3>
    <p>WebJs exports standard Lit sentinels and directives from <code>@webjsdev/core</code> and <code>@webjsdev/core/directives</code>:</p>
    <ul>
      <li><strong><code>nothing</code></strong>: removes an attribute or clears children in template holes (<code>title=\${val ?? nothing}</code>, <code>\${cond ? html\`...\` : nothing}</code>).</li>
      <li><strong><code>noChange</code></strong>: tells the renderer to leave the previous DOM value untouched.</li>
      <li><strong><code>classMap</code> and <code>styleMap</code></strong>: conditionally toggle classes or inline styles from an object without string concatenation.</li>
      <li><strong><code>ifDefined</code></strong>: passes a value or converts <code>undefined</code> / <code>null</code> to <code>nothing</code> to omit an attribute.</li>
    </ul>

    <h2>Class.register('tag')</h2>
    <p>Register the component with <code>Class.register('tag')</code> at the bottom of the file:</p>

    <code-block>MyCounter.register('my-counter');</code-block>

    <p>WebJs wraps the native API (and installs a compatible shim on the server) so the same line works in both environments:</p>
    <ul>
      <li><strong>Browser</strong>: tells the browser to upgrade all <code>&lt;my-counter&gt;</code> elements with the <code>MyCounter</code> class, and mirrors the mapping into webjs's internal registry.</li>
      <li><strong>Server</strong>: stores the class in the internal registry so the server render can instantiate it wherever its tag appears.</li>
    </ul>

    <p>Module URLs for <code>&lt;link rel="modulepreload"&gt;</code> hints are discovered separately, by a server-side scanner that walks the app tree on the first request (memoized, and re-run after each rebuild) and derives the file path for each discovered tag. No per-component <code>import.meta.url</code> argument needed.</p>

    <blockquote>Always call <code>Class.register</code> at the module's top level, outside the class body. The component registers as soon as the module is imported, both on server and client.</blockquote>

    <p>The tag argument accepts any short-string quote style. <code>register('my-counter')</code>, <code>register("my-counter")</code>, and <code>register(&#96;my-counter&#96;)</code> are all equivalent. The framework's <code>tag-name-has-hyphen</code> lint rule reads the tag through any of them.</p>

    <h2>Server Rendering</h2>
    <p>Every component is server-rendered. A light-DOM component (the default) renders its template inline after a <code>&lt;!--webjs-hydrate--&gt;</code> marker; a component with <code>static shadow = true</code>, like <code>MyCounter</code> above, renders as <strong>Declarative Shadow DOM</strong>. When the server renders a page containing <code>&lt;my-counter&gt;&lt;/my-counter&gt;</code>, the output looks like:</p>

    <code-block>&lt;my-counter&gt;
  &lt;template shadowrootmode="open"&gt;
    &lt;style&gt;
      :host { display: inline-flex; gap: 8px; }
      button { font: inherit; padding: 4px 12px; }
    &lt;/style&gt;
    &lt;button&gt;-&lt;/button&gt;
    &lt;output&gt;0&lt;/output&gt;
    &lt;button&gt;+&lt;/button&gt;
  &lt;/template&gt;
&lt;/my-counter&gt;</code-block>

    <h3>How SSR Works</h3>
    <ul>
      <li>The server imports the component module, which calls <code>Class.register('tag')</code> and stores the class in the registry.</li>
      <li>The renderer walks the page's templates once; when it reaches the tag of a registered component, it renders that component in place.</li>
      <li>For each one it creates a temporary instance, applies the tag's attributes, runs the pre-render hooks and <code>render()</code>, then writes the result inline (light DOM) or inside a <code>&lt;template shadowrootmode="open"&gt;</code> block with the component's styles (shadow DOM).</li>
      <li>The browser parses this as a native declarative shadow root, so the content is visible <strong>before any JavaScript loads</strong>.</li>
      <li>When the component's JS module eventually loads and the custom element upgrades, the existing shadow root is reused. The client renderer performs a fine-grained diff against the already-painted DOM.</li>
    </ul>

    <h3>Async Rendering on the Server</h3>
    <p>On the server, <code>render()</code> can be async. This lets you fetch data inside a component:</p>

    <code-block>class UserProfile extends WebComponent({ userId: String }) {
  constructor() {
    super();
    this.userId = '';
  }

  async render() {
    // This await is resolved during SSR, so the full HTML is sent to the client
    const user = await fetch(\`/api/users/\${this.userId}\`).then(r =&gt; r.json());
    return html\`
      &lt;h2&gt;\${user.name}&lt;/h2&gt;
      &lt;p&gt;\${user.email}&lt;/p&gt;
    \`;
  }
}
UserProfile.register('user-profile');</code-block>

    <p>On the client an <code>async render()</code> is awaited too. When a property change re-runs it, the current content stays on screen until the new render resolves (stale-while-revalidate), and an optional <code>renderFallback()</code> shows while it does. See <a href="/docs/data-fetching">Data fetching</a>.</p>

    <h2>Fine-Grained Client Renderer</h2>
    <p>The client renderer does <strong>not</strong> rebuild the entire DOM on every state change. Instead, it tracks each dynamic "hole" in the template and only touches the parts that actually changed.</p>

    <h3>What Gets Preserved</h3>
    <ul>
      <li><strong>Focus</strong>: if an <code>&lt;input&gt;</code> is focused when a signal write triggers a re-render, it stays focused.</li>
      <li><strong>Cursor position</strong>: the text cursor inside an input or textarea does not jump.</li>
      <li><strong>Selection</strong>: text selections survive re-renders.</li>
      <li><strong>Scroll position</strong>: scroll state of overflow containers is not disturbed.</li>
    </ul>

    <p>This happens because the renderer only updates the specific text node, attribute, or property that changed. Elements that are not affected by the state change are never touched.</p>

    <h3>Template Caching</h3>
    <p>Templates are compiled once per unique <code>strings</code> array (the static parts of the tagged template). Because JavaScript engines intern tagged template string arrays, the same <code>html\`...\`</code> expression in a <code>render()</code> method produces the same <code>strings</code> identity on every call. This means:</p>
    <ul>
      <li>The template is parsed into a <code>&lt;template&gt;</code> element and a list of part descriptors <strong>once</strong>.</li>
      <li>On subsequent renders, the existing DOM is reused and only the changed values are applied.</li>
      <li>If the template shape changes (e.g., a conditional returns a different <code>html\`...\`</code>), the old DOM is torn down and rebuilt.</li>
    </ul>

    <h3>Keyed Lists with repeat()</h3>
    <p>A plain array of templates updates position by position: the DOM for item N is reused for whatever is now at index N, so on a reorder or an insert, focus and component state stay with the position rather than the item. For lists whose items have stable identities, use <code>repeat()</code> so the DOM follows the data:</p>

    <code-block>import { WebComponent, html, css, repeat } from '@webjsdev/core';

class TaskList extends WebComponent {
  readonly #tasks = signal([
    { id: 1, text: 'Buy groceries', done: false },
    { id: 2, text: 'Write docs', done: true },
    { id: 3, text: 'Ship feature', done: false },
  ]);

  toggle(id) {
    this.#tasks.set(this.#tasks.get().map(t =&gt;
      t.id === id ? { ...t, done: !t.done } : t
    ));
  }

  render() {
    return html\`
      &lt;ul&gt;
        \${repeat(
          this.#tasks.get(),
          (task) =&gt; task.id,           // key function: must be stable + unique
          (task) =&gt; html\`
            &lt;li @click=\${() =&gt; this.toggle(task.id)}
                style=\${task.done ? 'text-decoration: line-through' : ''}&gt;
              \${task.text}
            &lt;/li&gt;
          \`
        )}
      &lt;/ul&gt;
    \`;
  }
}
TaskList.register('task-list');</code-block>

    <h3>How repeat() Works</h3>
    <ul>
      <li>Each item is identified by the key returned from the key function (first argument after items).</li>
      <li>On re-render, items with matching keys <strong>update in place</strong>: the DOM nodes are reused, not recreated.</li>
      <li>New keys cause fresh nodes to be inserted. Missing keys cause nodes to be removed.</li>
      <li>When the order changes, existing DOM nodes are <strong>moved</strong> (via <code>insertBefore</code>), not destroyed and rebuilt. This preserves element identity, focus, scroll, and any internal state.</li>
    </ul>

    <blockquote>Use a stable ID from your data as the key, like <code>task.id</code> or <code>user.email</code>. Never use the array index as a key. It defeats the purpose of keyed reconciliation, just like in React.</blockquote>

    <p>On the server, <code>repeat()</code> is simply iterated in order. Keys are only used on the client for efficient DOM updates.</p>

    <h2>Putting It All Together</h2>
    <p>Here is a complete example showing properties, state, events, lifecycle, slots, and scoped styles in a single component:</p>

    <code-block>import { WebComponent, html, css, repeat, connectWS, signal } from '@webjsdev/core';

class ChatBox extends WebComponent {
  static shadow = true;
  static styles = css\`
    :host { display: block; border: 1px solid var(--border); border-radius: var(--rad-lg); }
    .log  { height: 200px; overflow-y: auto; padding: var(--sp-4); }
    .log p { margin: 0 0 var(--sp-2); }
    form  { display: flex; gap: var(--sp-2); padding: var(--sp-3); border-top: 1px solid var(--border); }
    input { flex: 1; padding: var(--sp-2); border: 1px solid var(--border); border-radius: var(--rad); }
    button { padding: var(--sp-2) var(--sp-4); background: var(--accent); color: var(--accent-fg);
             border: 0; border-radius: var(--rad); cursor: pointer; }
  \`;

  _conn = null;
  readonly #lines = signal([]);
  readonly #connected = signal(false);

  connectedCallback() {
    super.connectedCallback();   // always call super!
    this._conn = connectWS('/api/chat', {
      onOpen:    () =&gt; this.#connected.set(true),
      onClose:   () =&gt; this.#connected.set(false),
      onMessage: (msg) =&gt; {
        this.#lines.set([...this.#lines.get(), msg].slice(-50));
      },
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._conn?.close();
    this._conn = null;
  }

  send(e) {
    e.preventDefault();
    const input = this.renderRoot.querySelector('input');
    if (!input.value.trim() || !this._conn) return;
    this._conn.send({ text: input.value });
    input.value = '';
  }

  render() {
    const lines = this.#lines.get();
    const connected = this.#connected.get();
    return html\`
      &lt;div class="log"&gt;
        \${lines.length === 0
          ? html\`&lt;p&gt;&lt;em&gt;No messages yet.&lt;/em&gt;&lt;/p&gt;\`
          : repeat(lines, (l) =&gt; l.id, (l) =&gt; html\`&lt;p&gt;\${l.text}&lt;/p&gt;\`)}
      &lt;/div&gt;
      &lt;form @submit=\${(e) =&gt; this.send(e)}&gt;
        &lt;input placeholder=\${connected ? 'Say hi...' : 'Reconnecting...'}
               ?disabled=\${!connected} autocomplete="off" /&gt;
        &lt;button ?disabled=\${!connected}&gt;Send&lt;/button&gt;
      &lt;/form&gt;
    \`;
  }
}
ChatBox.register('chat-box');</code-block>

    <h2>Quick Reference</h2>
    <ul>
      <li><strong>Extend</strong> the <code>WebComponent({ ... })</code> factory with your property shape (and optionally <code>static styles</code> for shadow-DOM components).</li>
      <li><strong>Implement</strong> <code>render()</code> returning <code>html\`...\`</code>.</li>
      <li><strong>Register</strong> with <code>ClassName.register('tag-name')</code> at the bottom of the file. Tag must contain a hyphen.</li>
      <li><strong>State</strong>: instance signals (<code>readonly #foo = signal(...)</code>) or reactive properties (the <code>WebComponent({ ... })</code> factory, with <code>prop()</code> for options). Both feed the same batched re-render scheduler.</li>
      <li><strong>Events</strong>: <code>@click</code>, <code>@submit</code>, <code>@input</code> in templates. Stable dispatchers, no listener churn.</li>
      <li><strong>Bindings</strong>: <code>attr=\${v}</code> for attributes, <code>.prop=\${v}</code> for properties, <code>?bool=\${v}</code> for booleans.</li>
      <li><strong>Slots</strong>: <code>&lt;slot&gt;</code> for default content, <code>&lt;slot name="x"&gt;</code> for named slots, fallback content, <code>assignedNodes()</code>, <code>slotchange</code>. Works identically in light DOM and shadow DOM.</li>
      <li><strong>Light DOM</strong> by default. Set <code>static shadow = true</code> to opt in to shadow DOM for scoped styles (<code>static styles = css\`...\`</code>) or third-party embed isolation.</li>
      <li><strong>Lifecycle</strong>: <code>connectedCallback()</code> and <code>disconnectedCallback()</code> (call super in both), <code>attributeChangedCallback()</code>, then Lit's update cycle (<code>willUpdate</code>, <code>firstUpdated</code>, <code>updated</code>).</li>
      <li><strong>Lists</strong>: <code>repeat(items, keyFn, templateFn)</code> for keyed updates (Lit's two-argument <code>repeat(items, templateFn)</code> works too, keyed by index).</li>
      <li><strong>SSR</strong>: light-DOM components render inline, shadow-DOM components as Declarative Shadow DOM. Async <code>render()</code> is awaited on the server and the client.</li>
    </ul>

    <h2>Next Steps</h2>
    <ul>
      <li><a href="/docs/styling">Styling</a>: design tokens, scoped CSS, and theming in depth</li>
      <li><a href="/docs/ssr">Server-Side Rendering</a>: Declarative Shadow DOM, streaming, and hydration</li>
      <li><a href="/docs/server-actions">Server Actions</a>: call server functions from components</li>
      <li><a href="/docs/suspense">Streaming &amp; Suspense</a>: deferred data with fallback UI</li>
    </ul>
  `;
}
