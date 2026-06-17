/**
 * Postgres column helpers, the pg variant of the unified Drizzle column API
 * (#563). Mirrors what `webjs create --db postgres` materializes as
 * db/columns.server.ts (packages/cli/lib/create.js `columnsPg`). The SAME
 * schema body (schema.pg.ts) is written against this and compiles + infers an
 * identical row shape as the SQLite variant, which is the cross-database
 * promise this test exercises against a real Postgres engine.
 */
import { pgTableCreator, serial, uuid as pgUuid, integer, text, real, boolean, timestamp as pgTimestamp, index as _index } from 'drizzle-orm/pg-core';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { getTableName, type Table } from 'drizzle-orm';

export { text, integer, real };

export const table = pgTableCreator((name) => name, 'snake_case');

export const pk = () => serial().primaryKey();
export const uuidPk = () => pgUuid().primaryKey().defaultRandom();
export const uuid = () => pgUuid();
export const bool = () => boolean();
export const timestamp = () => pgTimestamp({ withTimezone: true });
export const createdAt = () => timestamp().notNull().defaultNow();
export const updatedAt = () => timestamp().notNull().defaultNow().$onUpdate(() => new Date());

export const index = (...cols: PgColumn[]) =>
  _index(getTableName((cols[0] as unknown as { table: Table }).table) + '_' + cols.map((c) => c.name).join('_') + '_idx').on(...(cols as [PgColumn, ...PgColumn[]]));
