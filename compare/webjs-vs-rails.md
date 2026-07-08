---
title: "WebJs vs Rails: No Build, One Language, Web Components"
date: 2026-07-09T10:00:00+05:30
slug: webjs-vs-rails
description: "An honest comparison of WebJs and Ruby on Rails. Both refuse a build step and lean on importmaps and sensible defaults, but WebJs is one TypeScript language across the stack with web components and typed server actions, where Rails is Ruby with Hotwire."
competitor: "Rails"
tagline: "The Rails no-build, sensible-defaults philosophy, in one TypeScript language."
tags: comparison, rails, hotwire, importmap, no-build
author: Vivek
---

WebJs owes Rails a direct debt. The no-build model, source files served as importmapped ES modules with production speed from HTTP/2 instead of a bundler, is the Rails 7 approach with `importmap-rails`, and WebJs says so openly. The "you should not make thirty decisions before your first feature" feeling, sensible defaults so you can start writing features immediately, is Rails philosophy too. Where the two part ways is how far the conventions reach: Rails is convention over configuration across the whole architecture, while WebJs is prescriptive only about file routing (the Next.js-style `app/` tree) and otherwise leaves the architecture to you, shipping its recommended conventions in the scaffold rather than enforcing them. So this is less a rivalry than an account of what changes when you take the no-build, sensible-defaults ideas to a single-language JavaScript and TypeScript stack built on web components.


# What the two share

- **No build step.** Rails 7 pins JavaScript dependencies with importmaps and serves them without Webpack or esbuild. WebJs serves your `.ts` files directly with types stripped in place. Same bet: skip the bundler, lean on the platform and HTTP/2.
- **Sensible defaults out of the box.** Both let you write features instead of wiring integrations from scratch. The reach differs: Rails is convention over configuration across the framework, while WebJs prescribes the file-routing conventions (the `app/` tree) and ships recommended conventions for everything else in the scaffold without forcing them, so you can shape the rest of the architecture as your app needs.
- **Server-rendered HTML first.** Both send real HTML and treat JavaScript as an enhancement, not the baseline that has to boot before anything renders.
- **Batteries included.** Auth, sessions, caching, jobs in Rails; auth, sessions, caching, rate limiting, a data layer, and a client router in WebJs. Neither expects you to assemble the basics yourself.

If you like how Rails feels, a lot of that feeling is deliberately present in WebJs.


# Difference one: one language across the whole stack

Rails is Ruby on the server and JavaScript in the browser. That split is fine, and Hotwire is designed to keep you mostly in Ruby, but the two halves are still two languages with two ecosystems.

WebJs is TypeScript (or JavaScript) everywhere. The same language writes your pages, your components, and your server actions, and types flow across the network boundary: import a `.server.ts` function into a component and the client sees its real signature, with the wire serializer round-tripping `Date`, `Map`, `Set`, `BigInt`, `Blob`, `File`, and more without hand-written adapters. One language, one type system, from the database row to the rendered element.


# Difference two: web components vs Hotwire

Rails does interactivity with Hotwire: Turbo swaps HTML fragments over the wire, and Stimulus attaches modest JavaScript behavior to server-rendered markup. It is a mature, HTML-over-the-wire approach that keeps most logic on the server.

WebJs does interactivity with native web components. An interactive island hydrates per element with a lit-shaped authoring API, reactive properties, and signals; a display-only component ships zero JavaScript because the framework strips its module from the download. WebJs also has a Turbo-style client router (it preserves layout DOM across navigations, with prefetch and no white flash), so the HTML-over-the-wire navigation feel is there too, but the unit of interactivity is a standards-based custom element rather than a Stimulus controller.


# Difference three: data layer

Rails ships Active Record, one of the most refined ORMs in any ecosystem, with a huge surface of associations, validations, and migrations built over years. It is a genuine strength and a reason people choose Rails.

WebJs defaults to Drizzle with SQLite (or Postgres by swapping one file), a typed query builder rather than an Active Record style model layer. It is lighter and fully typed end to end, but it is not trying to match Active Record's depth, and it is a default rather than a lock-in; WebJs is bring-your-own on the data layer.


# Where Rails is the better pick

- Your team knows Ruby, or you want to hire into the deep Rails talent pool.
- You want Active Record and the maturity of the Rails ecosystem: gems, generators, and a community with a decade-plus of accumulated answers.
- You are happy with Hotwire's server-driven interactivity model and do not need a component runtime.


# Where WebJs is the better pick

- You want one language across the entire stack, with types that span the client and server boundary instead of a Ruby and JavaScript split.
- You want native web components as the interactivity unit, with automatic zero-JavaScript elision for display-only elements.
- You want the no-build, sensible-defaults Rails feeling but in the JavaScript and TypeScript ecosystem your frontend already lives in, without committing to conventions across the whole architecture.
- You are building with AI agents and want a framework small enough to read end to end, with conventions the tooling enforces.

WebJs took the parts of Rails it admired most, the no-build importmap model and the sensible defaults that let you start fast, and rebuilt them for a single-language TypeScript stack on web components, while staying flexible about the rest of the architecture. If you love how Rails thinks but want to stay in one language on web standards, that is the trade WebJs is offering.
