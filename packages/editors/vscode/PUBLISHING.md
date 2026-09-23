# Publishing the `webjs` extension

The extension ships to **two** registries so it is discoverable in every
target editor:

| Registry | Reached by | Tool |
|---|---|---|
| **Visual Studio Marketplace** | VSCode | [`@vscode/vsce`](https://github.com/microsoft/vscode-vsce) |
| **Open VSX** | Cursor, Antigravity, Windsurf, VSCodium | [`ovsx`](https://github.com/eclipse/openvsx/tree/master/cli) |

Both are invoked via `npx`, so there is nothing to add to the repo's
dependencies.

## One-time setup

### Visual Studio Marketplace

1. The publisher id is `WebJs` and the extension id is `WebJs` (both set
   in `package.json`), so the listing is `WebJs.WebJs`. Create the
   publisher once at <https://marketplace.visualstudio.com/manage>,
   signing in with the Microsoft / Azure DevOps account that should own
   it.
2. Create a **Personal Access Token** in Azure DevOps
   (<https://dev.azure.com>) for the same account: All accessible
   organizations, scope **Marketplace > Manage**. Copy the token.
3. Authenticate locally:
   ```sh
   npx --yes @vscode/vsce login WebJs
   # paste the PAT when prompted
   ```

### Open VSX

1. Sign in at <https://open-vsx.org> with GitHub and create the
   `WebJs` namespace (nothing is published there yet):
   ```sh
   npx --yes ovsx create-namespace WebJs -p <OPEN_VSX_TOKEN>
   ```
2. Generate an access token from your Open VSX user settings. Export it
   (or pass `-p`):
   ```sh
   export OVSX_PAT=<OPEN_VSX_TOKEN>
   ```

## The display name carries a trailing U+00A0 — do not "fix" it

`displayName` in `package.json` is `WebJs` followed by a NON-BREAKING SPACE
(U+00A0). It renders as plain "WebJs" everywhere, and it is deliberate.

The Marketplace reserves an extension's display name and id permanently once
a listing has existed, even after it is deleted. An earlier listing under the
id `webjs-vscode` was published and then unpublished, which retired BOTH that
id and the plain display name `WebJs`. A publish using either is refused:

| Attempt | Marketplace response |
|---|---|
| id `webjs-vscode` | `The extension 'webjs-vscode' already exists in the Marketplace` |
| display name `WebJs` | `This extension display name is taken` |

A plain trailing space does not help: the uniqueness check trims ASCII
whitespace before comparing. U+00A0 is not ASCII whitespace, so it survives
the trim and the name reads as distinct. The id has no such escape hatch —
`vsce` validates it locally against `/^[a-z0-9][a-z0-9\-]*$/i`, so only
letters, digits and hyphens are allowed there.

Removing the U+00A0 will make the next publish fail. The real fix is to ask
<VSMarketplace@microsoft.com> to release the retired name, then drop the
character and update the assertion in `test/extension.test.mjs`.

## Releasing a version

1. Bump `version` in `packages/editors/vscode/package.json`. The pre-commit hook
   TRACKS this package (#413), so the bump DOES require a `changelog/vscode/<version>.md`
   and `scripts/backfill-changelog.js` generates one. The entry carries
   `npm: false`, which makes every publish script skip it, so nothing is
   published automatically: the `vsce` / `ovsx` steps below are still manual.
2. Build + package + publish to both registries:
   ```sh
   cd packages/editors/vscode

   # VS Marketplace (builds the vendored plugin + packages from a clean
   # staging dir, then uploads):
   npm run publish:vsce

   # Open VSX (re-uses the packaged webjs.vsix):
   npm run package
   npm run publish:ovsx
   ```
   `publish:vsce` and `package` both run `scripts/package.mjs`, which
   builds the self-contained tsserver plugin and packages from a
   standalone dir so the vsix stays small (see `AGENTS.md`).
3. Verify the listings:
   - <https://marketplace.visualstudio.com/items?itemName=WebJs.WebJs>
   - <https://open-vsx.org/extension/WebJs/WebJs> (not published yet)

## Local install without a registry

The packaged vsix installs directly in any build:

```sh
npm run package
code --install-extension webjs.vsix     # `code` works for VSCode and Code-OSS
```

Cursor / Windsurf / VSCodium accept the same `--install-extension` flag
with their own CLI binary (`cursor`, `windsurf`, `codium`).

## CI note

A future GitHub Actions job can run `npm run publish:vsce` and
`npm run publish:ovsx` on a tag, with `VSCE_PAT` and `OVSX_PAT` stored
as repository secrets. Not wired yet; publish manually until then.
