# @webjskit/ui-website

The HTTP host for the `@webjskit/ui` component registry, plus a docs site with one
page per component.

A webjs app — dogfoods the framework.

## Routes

| Path | Serves |
|---|---|
| `GET /r/index.json` | Flat list of every registry item |
| `GET /r/registry.json` | Full manifest |
| `GET /r/<name>.json` | One registry item (with inlined `content`) |
| `GET /r/themes/<name>.json` | One base-colour theme |
| `GET /docs/components/<name>` | Docs page for a single component (preview + props + install) |
| `GET /` | Index of all components |

## Dev

```sh
npm run dev      # http://localhost:5001
```

The dev server reads `packages/ui-registry/r/*.json` directly. Make sure to run
`npm run build` inside `packages/ui-registry` first (or use the root `ui:build`
script).
