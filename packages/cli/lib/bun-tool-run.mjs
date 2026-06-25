// Run a CLI tool's bin under Bun zero-install (#704). Invoked by the cli as:
//
//   bun --preload <server bun-pin-preload.js> bun-tool-run.mjs <binSpec> <argv0> [args...]
//
// The cli pre-pins <binSpec> to the app-declared version (e.g.
// `drizzle-kit@1.0.0-rc.3/bin.cjs`), so Bun auto-install fetches the right tool
// (an inline-versioned specifier resolves where a bare one ENOENTs, the #709
// finding). The --preload (the server's spawn pin) rewrites the tool's
// TRANSITIVE bare imports (the user `db/schema.server.ts`'s `import 'drizzle-orm'`
// and drizzle-kit's own internal ORM import) to the app's pinned versions.
//
// This shim only re-points `process.argv` so the tool's own CLI parser sees its
// subcommand + flags (argv[1] = the tool name, argv[2..] = its args), then
// imports the bin, which runs on import.
const [binSpec, argv0, ...rest] = process.argv.slice(2);
if (!binSpec) {
  console.error('bun-tool-run: missing bin specifier');
  process.exit(1);
}
process.argv = [process.argv[0], argv0, ...rest];
await import(binSpec);
