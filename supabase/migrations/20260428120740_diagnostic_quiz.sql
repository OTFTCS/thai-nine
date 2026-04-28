create table if not exists diagnostic_invites (
  token text primary key,
  learner_name text,
  learner_email text,
  note text,
  status text not null default 'pending' check (status in ('pending', 'completed', 'expired')),
  consent_given_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null
);

create table if not exists diagnostic_submissions (
  id bigserial primary key,
  token text not null references diagnostic_invites(token) on delete cascade,
  submitted_at timestamptz not null default now(),
  track text,
  score numeric(5,2),
  completion_percent numeric(5,2),
  total_correct integer,
  total_wrong integer,
  total_idk integer,
  band text,
  confidence text,
  topic_results jsonb,
  missed_question_ids jsonb,
  lesson_brief jsonb,
  attempt jsonb,
  generated_at timestamptz not null default now(),
  unique (token)
);

create index if not exists idx_diagnostic_submissions_token on diagnostic_submissions(token);
create index if not exists idx_diagnostic_invites_status on diagnostic_invites(status);
