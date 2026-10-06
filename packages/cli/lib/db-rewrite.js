/**
 * Database-dialect rewrites for the deploy files (#1490).
 *
 * The canonical `compose.yaml` and `.github/workflows/ci.yml` templates are the
 * SQLite shape (a `file:` DATABASE_URL, a named volume for the db file). A
 * `--db postgres` app needs a real Postgres in both places, so these pure
 * transforms DERIVE the Postgres variant from the canonical template, the same
 * way `runtime-rewrite.js` derives the Bun variant. There is no parallel
 * Postgres template to drift, and SQLite output stays byte-identical because
 * nothing here runs for it.
 *
 * Order: create.js applies these BEFORE the Bun rewrites. They only touch the
 * DATABASE_URL lines, the volume, and add a database service, none of which
 * the Bun rewrites match (those swap `node -e` healthchecks, `npm` commands and
 * the setup-node block), so the two axes compose in either order. Every anchor
 * is asserted, so a template edit that moves one fails loudly in the scaffold
 * tests instead of shipping a half-rewritten file.
 *
 * The credentials are local-only (a throwaway compose volume, an ephemeral CI
 * service container), never a production value; production points
 * DATABASE_URL at its own managed Postgres.
 *
 * @module db-rewrite
 */

/** Local Postgres user + password for compose and CI (never production). */
export const LOCAL_PG_USER = 'webjs';
export const LOCAL_PG_PASSWORD = 'webjs';
/** The Postgres image both files run. */
export const PG_IMAGE = 'postgres:17-alpine';

/**
 * @param {string} s
 * @param {string} from
 * @param {string} to
 * @param {string} file
 */
function replaceOnce(s, from, to, file) {
  if (!s.includes(from)) {
    throw new Error(`db-rewrite: ${file} template no longer contains the anchor ${JSON.stringify(from.slice(0, 60))}`);
  }
  return s.replace(from, () => to);
}

/**
 * Rewrite compose.yaml for a Postgres app: a sibling `db` service with a
 * `pg_isready` healthcheck and its own named volume, the app's DATABASE_URL
 * pointed at it, and `depends_on` with `service_healthy` so the app's boot-time
 * `webjs db migrate` never races the database's startup.
 *
 * @param {string} s
 * @param {string} dbName fold-stable database name (toDatabaseName(appName))
 * @returns {string}
 */
export function postgresCompose(s, dbName) {
  const url = `postgres://${LOCAL_PG_USER}:${LOCAL_PG_PASSWORD}@db:5432/${dbName}`;
  let out = s;
  out = replaceOnce(out, 'using the same Dockerfile, one service.',
    'using the same Dockerfile, plus a Postgres service.', 'compose.yaml');
  out = replaceOnce(out,
    "# In production your host provides DATABASE_URL + AUTH_SECRET. Locally this\n" +
    "# uses the scaffold's SQLite file on a named volume so data survives\n" +
    '# `compose down`.',
    '# In production your host provides DATABASE_URL + AUTH_SECRET. Locally this\n' +
    '# runs Postgres in the `db` service on a named volume so data survives\n' +
    '# `compose down`.',
    'compose.yaml');
  out = replaceOnce(out,
    '      # SQLite on a volume for local dev. For production, scaffold with\n' +
    '      # --db postgres (or swap db/columns.server.ts + db/connection.server.ts\n' +
    '      # for the pg variant) and point DATABASE_URL at your managed Postgres.\n' +
    '      DATABASE_URL: file:/data/dev.db\n',
    '      # The `db` service below. In production, point DATABASE_URL at your\n' +
    '      # managed Postgres instead.\n' +
    `      DATABASE_URL: ${url}\n`,
    'compose.yaml');
  // The app no longer owns a db file, so it needs no volume; it waits for a
  // healthy database instead, because `webjs start` migrates before serving.
  out = replaceOnce(out,
    '    volumes:\n      - app-data:/data\n',
    '    depends_on:\n      db:\n        condition: service_healthy\n',
    'compose.yaml');
  out = replaceOnce(out,
    '\nvolumes:\n  app-data:\n',
    '\n' +
    '  db:\n' +
    `    image: ${PG_IMAGE}\n` +
    '    environment:\n' +
    `      POSTGRES_USER: ${LOCAL_PG_USER}\n` +
    `      POSTGRES_PASSWORD: ${LOCAL_PG_PASSWORD}\n` +
    `      POSTGRES_DB: ${dbName}\n` +
    '    volumes:\n' +
    '      - db-data:/var/lib/postgresql/data\n' +
    '    healthcheck:\n' +
    `      test: ["CMD-SHELL", "pg_isready -U ${LOCAL_PG_USER} -d ${dbName}"]\n` +
    '      interval: 5s\n' +
    '      timeout: 3s\n' +
    '      retries: 10\n' +
    '\n' +
    'volumes:\n' +
    '  db-data:\n',
    'compose.yaml');
  return out;
}

/**
 * Rewrite the GitHub Actions CI workflow for a Postgres app: a `postgres`
 * service container with a health check (the job waits until it is healthy
 * before the first step) and DATABASE_URL pointed at it on localhost.
 *
 * @param {string} s
 * @param {string} dbName
 * @returns {string}
 */
export function postgresCi(s, dbName) {
  return replaceOnce(s,
    '    env:\n      DATABASE_URL: file:./ci.db\n',
    '    env:\n' +
    `      DATABASE_URL: postgres://${LOCAL_PG_USER}:${LOCAL_PG_PASSWORD}@localhost:5432/${dbName}\n` +
    '    # The app is scaffolded with --db postgres, so CI runs against a real\n' +
    '    # Postgres. The job waits for the health check before the first step.\n' +
    '    services:\n' +
    '      postgres:\n' +
    `        image: ${PG_IMAGE}\n` +
    '        env:\n' +
    `          POSTGRES_USER: ${LOCAL_PG_USER}\n` +
    `          POSTGRES_PASSWORD: ${LOCAL_PG_PASSWORD}\n` +
    `          POSTGRES_DB: ${dbName}\n` +
    '        ports:\n' +
    '          - 5432:5432\n' +
    '        options: >-\n' +
    `          --health-cmd "pg_isready -U ${LOCAL_PG_USER} -d ${dbName}"\n` +
    '          --health-interval 5s\n' +
    '          --health-timeout 5s\n' +
    '          --health-retries 10\n',
    '.github/workflows/ci.yml');
}
