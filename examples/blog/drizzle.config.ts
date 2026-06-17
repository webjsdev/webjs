import { defineConfig } from 'drizzle-kit';

// drizzle-kit requires this exact filename at the project root. Keep secrets
// out of it: the DB url comes from the environment.
export default defineConfig({
  dialect: 'sqlite',
  schema: './db/schema.server.ts',
  out: './db/migrations',
  dbCredentials: { url: process.env.DATABASE_URL?.replace(/^file:/, '') ?? 'db/dev.db' },
});
