-- Creator feedback loop: structured annotations on eval-run scripts.
-- Two tables:
--   creator_eval_scripts  one row per (script_type, eval_run_id, script_id);
--                         pinned to the prompt git SHA at generation time so
--                         feedback can be traced back to the prompt that
--                         produced it.
--   creator_annotations   N rows per eval script (one 'overall' + many 'block').
--                         The 'rolled_up_at' column is the watermark consumed
--                         by scripts/aggregate_prompt_feedback.py.

create table creator_eval_scripts (
  id              uuid primary key default gen_random_uuid(),
  script_type     text not null check (script_type in ('youtube','course')),
  eval_run_id     text not null,
  script_id       text not null,
  prompt_path     text not null,
  prompt_sha      text not null,           -- '' if generated outside git
  generated_at    timestamptz not null,
  created_at      timestamptz not null default now(),
  unique (script_type, eval_run_id, script_id)
);

create table creator_annotations (
  id              uuid primary key default gen_random_uuid(),
  eval_script_id  uuid not null references creator_eval_scripts(id) on delete cascade,
  scope           text not null check (scope in ('overall','block')),
  block_id        text,                    -- null only when scope = 'overall'
  block_label     text,
  rating          text not null check (rating in ('good','ok','rework')),
  comment         text not null default '',
  rolled_up_at    timestamptz,             -- null = pending inclusion in notes file
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Postgres treats NULL != NULL in unique constraints, so a single composite
-- UNIQUE that includes block_id would silently allow duplicate 'overall' rows.
-- Two partial indexes side-step that.
create unique index creator_annotations_block_idx
  on creator_annotations (eval_script_id, scope, block_id)
  where block_id is not null;

create unique index creator_annotations_overall_idx
  on creator_annotations (eval_script_id)
  where scope = 'overall';

create index creator_annotations_unrolled_idx
  on creator_annotations (created_at)
  where rolled_up_at is null;

create index creator_eval_scripts_lookup_idx
  on creator_eval_scripts (script_type, eval_run_id);

alter table creator_eval_scripts enable row level security;
alter table creator_annotations enable row level security;

-- Restrictive deny-all so any anon-key access fails loudly. The API route uses
-- the service-role key, which bypasses RLS. If a future page accidentally
-- queries with the anon client, it gets zero rows back and the bug is loud
-- (vs. quietly returning data we did not mean to expose).
create policy admin_only_eval_scripts on creator_eval_scripts as restrictive
  for all to public using (false);

create policy admin_only_annotations on creator_annotations as restrictive
  for all to public using (false);
