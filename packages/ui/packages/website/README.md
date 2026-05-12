# @webjskit/ui-website

The HTTP host for the `@webjskit/ui` component registry, plus a docs site with one
page per component.

A webjs app — dogfoods the framework.

## Routes

| Path | Serves |
|---|---|
| `GET /registry` | Full manifest with every item's content inlined |
| `GET /registry/index.json` | Flat metadata-only list of every registry item |
| `GET /registry/<name>.json` | One registry item (with inlined `content`) |
| `GET /docs/components/<name>` | Docs page for a single component (preview + props + install) |
| `GET /` | Index of all components |

Registry JSON is composed on demand from `packages/ui/packages/registry/`
sources by `app/_lib/registry.server.ts`. There is no build step and no
generated output to commit.

## Dev

```sh
npm run dev      # http://localhost:5001
```

A `predev` hook runs `scripts/copy-registry.js`, which mirrors the
registry's component sources into `components/ui/` and `lib/utils.ts`
so the docs preview pages can import them directly.
