-- Venture OS — Memory Table Setup
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run
-- ============================================================

-- 1. Enable pgvector extension
create extension if not exists vector;

-- 2. Memories table
create table if not exists memories (
  id            uuid primary key default gen_random_uuid(),
  workspace     text not null,                          -- venture-os | lool-ai | freelance-system | espacio-bosques
  project       text,                                   -- optional sub-project name
  type          text not null default 'session'         -- session | decision | learning | outcome
                  check (type in ('session', 'decision', 'learning', 'outcome')),
  content       text not null,
  metadata      jsonb not null default '{}',
  embedding     vector(512),                            -- voyage-3-lite (null until VOYAGE_API_KEY is set)
  created_at    timestamptz not null default now(),
  -- Generated full-text search column (no manual updates needed)
  content_tsv   tsvector generated always as (to_tsvector('english', content)) stored
);

-- 3. Indexes
create index if not exists memories_tsv_idx       on memories using gin(content_tsv);
create index if not exists memories_workspace_idx on memories(workspace);
create index if not exists memories_project_idx   on memories(project);
create index if not exists memories_type_idx      on memories(type);
create index if not exists memories_created_idx   on memories(created_at desc);
-- Vector index — only activates once rows with embeddings exist
create index if not exists memories_vector_idx    on memories using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 4. Semantic search function (used when VOYAGE_API_KEY is set)
create or replace function search_memories(
  query_embedding  vector(512),
  filter_workspace text    default null,
  filter_project   text    default null,
  filter_type      text    default null,
  match_count      int     default 8
)
returns table (
  id          uuid,
  workspace   text,
  project     text,
  type        text,
  content     text,
  metadata    jsonb,
  created_at  timestamptz,
  similarity  float
)
language sql stable
as $$
  select
    id, workspace, project, type, content, metadata, created_at,
    1 - (embedding <=> query_embedding) as similarity
  from memories
  where
    embedding is not null
    and (filter_workspace is null or workspace = filter_workspace)
    and (filter_project   is null or project   = filter_project)
    and (filter_type      is null or type      = filter_type)
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- 5. Enable Row Level Security (service_role key bypasses this anyway, but good practice)
alter table memories enable row level security;

-- Done. The memory server is ready.
-- Text search works immediately.
-- Semantic search activates once VOYAGE_API_KEY is added to dotfiles.
