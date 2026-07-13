import { html, repeat, Suspense } from '@webjsdev/core';
import '#components/counter.ts';
import '#components/muted-text.ts';
import '#components/build-stamp.ts';
import '#components/vendor-badge.ts';
import '#modules/chat/components/chat-box.ts';

import { listPosts } from '#modules/posts/queries/list-posts.server.ts';
import { currentUser } from '#modules/auth/queries/current-user.server.ts';
import { rubric, stat, banner, accentLink, sectionH2 } from '#lib/utils/ui.ts';

export const metadata = {
  title: 'WebJs Blog',
  description: 'A tiny full-feature demo of the webjs framework',
  openGraph: { title: 'WebJs Blog', type: 'website' },
};

async function slowStat() {
  await new Promise((r) => setTimeout(r, 400));
  return html`<muted-text>posts loaded · ${new Date().toLocaleTimeString()}</muted-text>`;
}

export default async function HomePage() {
  const [me, posts] = await Promise.all([currentUser(), listPosts()]);
  return html`
    <span id="perm-probe" data-webjs-permanent hidden></span>
    <section class="mb-18">
      ${rubric('the webjs demo')}
      <h1 class="font-serif text-display leading-[1.02] tracking-[-0.035em] font-bold m-0 mb-4 text-balance">
        Full-stack in <span class="text-primary italic">zero</span> build steps.
      </h1>
      <p class="text-lede leading-[1.5] text-muted-foreground max-w-[56ch] m-0">
        Every line of this page runs on webjs: server-rendered web components, file-based routes,
        server actions, streaming Suspense, live WebSockets. Zero bundler. Authored in plain JavaScript
        with JSDoc.
      </p>
    </section>

    ${me
      ? banner(html`Welcome back, <strong class="text-foreground font-bold">${me.name || me.email}</strong>. ${accentLink('/dashboard', 'Your dashboard →')}`)
      : banner(html`${accentLink('/login', 'Sign in')} or ${accentLink('/login?tab=signup&then=/dashboard/posts/new', 'create an account')} to write posts and comment.`)}

    <div class="flex items-baseline justify-between mt-8 mb-2">
      <span class="block font-mono text-[11px] leading-none font-semibold tracking-[0.2em] uppercase text-primary">Latest posts</span>
      ${stat(`${posts.length.toString().padStart(2, '0')} total`)}
    </div>

    ${posts.length === 0
      ? html`<div class="py-18 text-center text-muted-foreground border-y border-border">
          <p class="m-0 mb-4">No posts yet.</p>
          <p class="m-0">${accentLink('/dashboard/posts/new', 'Write the first one →')}</p>
        </div>`
      : html`<ul class="list-none p-0 m-0">
          ${repeat(posts, (p) => p.id, (p, i) => html`
            <li class="border-t border-border last:border-b">
              <a href="/blog/${p.slug}" class="grid grid-cols-[44px_1fr_auto] gap-4 items-baseline py-6 text-inherit no-underline transition-[padding] duration-[220ms] hover:pl-2 group">
                <span class="font-mono text-[11px] leading-none font-medium tracking-[0.1em] text-muted-foreground/70 pt-1.5">${(i + 1).toString().padStart(2, '0')}</span>
                <div class="grid gap-1 min-w-0">
                  <h3 class="font-serif text-[1.45rem] leading-[1.2] tracking-[-0.02em] font-semibold m-0 text-foreground transition-colors duration-fast group-hover:text-primary">${p.title}</h3>
                  <p class="text-sm leading-[1.55] text-muted-foreground m-0 line-clamp-1">${p.body}</p>
                  <muted-text>${p.authorName || 'someone'} · ${new Date(p.createdAt).toLocaleDateString()}</muted-text>
                </div>
                <span class="font-mono text-muted-foreground/70 transition-[color,transform] duration-[220ms] group-hover:text-primary group-hover:translate-x-1">→</span>
              </a>
            </li>`)}
        </ul>`}

    <p class="mt-6">${Suspense({
        fallback: html`<muted-text>computing timestamp…</muted-text>`,
        children: slowStat(),
      })}</p>

    <section class="mt-18 pt-6 border-t border-border">
      ${rubric('client-side state')}
      ${sectionH2('Interactive counter')}
      <p class="text-muted-foreground m-0 mb-4 text-sm">Pure client-side state in a web component. SSR'd with the initial value, hydrated on connect, clicks don't lose focus.</p>
      <my-counter count="3"></my-counter>
    </section>

    <section class="mt-18 pt-6 border-t border-border">
      ${rubric('real-time · websocket')}
      ${sectionH2('Live chat')}
      <p class="text-muted-foreground m-0 mb-4 text-sm">Open this page in two windows. Messages broadcast across every connected client.</p>
      <chat-box></chat-box>
    </section>

    <footer class="mt-18 pt-6 border-t border-border flex flex-col gap-1">
      <build-stamp></build-stamp>
      <vendor-badge></vendor-badge>
    </footer>
  `;
}
