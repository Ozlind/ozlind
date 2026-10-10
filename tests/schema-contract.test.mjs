import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migrationPath = new URL(
  "../supabase/migrations/20261010_stage4_document_schema_reconciliation.sql",
  import.meta.url,
);
const migration = fs.readFileSync(migrationPath, "utf8").toLowerCase();

test("document reconciliation adds the runtime metadata columns idempotently", () => {
  for (const column of [
    "add column if not exists mime text",
    "add column if not exists size_bytes bigint",
    "add column if not exists char_count integer",
    "add column if not exists chunk_count integer",
  ]) {
    assert.ok(migration.includes(column), `missing idempotent schema change: ${column}`);
  }
});

test("document reconciliation backfills before enforcing required metadata", () => {
  assert.match(migration, /update public\.documents set mime = 'text\/plain' where mime is null/);
  assert.match(migration, /update public\.documents set char_count = 0 where char_count is null/);
  assert.match(migration, /alter column mime set not null/);
  assert.match(migration, /alter column char_count set not null/);
  assert.match(migration, /alter column chunk_count set not null/);
});

test("document chunk embeddings remain mandatory and indexed", () => {
  assert.match(migration, /alter table public\.document_chunks\s+alter column embedding set not null/);
  assert.match(migration, /create index if not exists document_chunks_document_id_idx/);
});

test("migration does not drop tables, columns, or user data", () => {
  assert.doesNotMatch(migration, /\bdrop\s+(table|column|schema)\b/);
  assert.doesNotMatch(migration, /\btruncate\s+table\b/);
  assert.doesNotMatch(migration, /\bdelete\s+from\b/);
});
