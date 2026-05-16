-- Supabase hardening for AI QA / Evaluation Lab.
-- Apply after Prisma migrations create the application tables.

create extension if not exists vector;
create extension if not exists pg_trgm;

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    join public.users u on u.id = wm.user_id
    where wm.workspace_id = target_workspace
      and u.auth_user_id = auth.uid()::text
  );
$$;

create or replace function public.workspace_role(target_workspace uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select wm.role::text
  from public.workspace_members wm
  join public.users u on u.id = wm.user_id
  where wm.workspace_id = target_workspace
    and u.auth_user_id = auth.uid()::text
  limit 1;
$$;

create or replace function public.can_edit_workspace(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.workspace_role(target_workspace) in ('owner', 'admin', 'editor');
$$;

create or replace function public.can_review_workspace(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.workspace_role(target_workspace) in ('owner', 'admin', 'editor', 'reviewer');
$$;

alter table public.users enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.prompt_versions enable row level security;
alter table public.datasets enable row level security;
alter table public.dataset_cases enable row level security;
alter table public.runs enable row level security;
alter table public.run_items enable row level security;
alter table public.run_status_events enable row level security;
alter table public.traces enable row level security;
alter table public.trace_spans enable row level security;
alter table public.model_calls enable row level security;
alter table public.grader_definitions enable row level security;
alter table public.grader_results enable row level security;
alter table public.human_reviews enable row level security;
alter table public.comparison_reports enable row level security;
alter table public.release_approvals enable row level security;
alter table public.prompt_feedback enable row level security;
alter table public.audit_logs enable row level security;
alter table public.usage_events enable row level security;
alter table public.provider_credentials enable row level security;
alter table public.background_jobs enable row level security;
alter table if exists public.system_events enable row level security;

drop policy if exists "users can read own profile" on public.users;
create policy "users can read own profile"
on public.users for select
using (auth_user_id = auth.uid()::text);

drop policy if exists "users can update own profile" on public.users;
create policy "users can update own profile"
on public.users for update
using (auth_user_id = auth.uid()::text)
with check (auth_user_id = auth.uid()::text);

drop policy if exists "members can read their workspaces" on public.workspaces;
create policy "members can read their workspaces"
on public.workspaces for select
using (public.is_workspace_member(id));

drop policy if exists "owners and admins can update workspace" on public.workspaces;
create policy "owners and admins can update workspace"
on public.workspaces for update
using (public.workspace_role(id) in ('owner', 'admin'))
with check (public.workspace_role(id) in ('owner', 'admin'));

drop policy if exists "members can read memberships" on public.workspace_members;
create policy "members can read memberships"
on public.workspace_members for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "owners and admins can manage memberships" on public.workspace_members;
create policy "owners and admins can manage memberships"
on public.workspace_members for all
using (public.workspace_role(workspace_id) in ('owner', 'admin'))
with check (public.workspace_role(workspace_id) in ('owner', 'admin'));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'projects',
    'prompt_versions',
    'datasets',
    'dataset_cases',
    'runs',
    'run_items',
    'run_status_events',
    'traces',
    'trace_spans',
    'model_calls',
    'grader_definitions',
    'grader_results',
    'comparison_reports',
    'release_approvals',
    'prompt_feedback',
    'audit_logs',
    'usage_events',
    'background_jobs',
    'system_events'
  ]
  loop
    execute format('drop policy if exists "members can read %1$s" on public.%1$I', table_name);
    execute format('create policy "members can read %1$s" on public.%1$I for select using (public.is_workspace_member(workspace_id))', table_name);
  end loop;
end $$;

drop policy if exists "editors can manage projects" on public.projects;
create policy "editors can manage projects"
on public.projects for all
using (public.can_edit_workspace(workspace_id))
with check (public.can_edit_workspace(workspace_id));

drop policy if exists "editors can create prompt versions" on public.prompt_versions;
create policy "editors can create prompt versions"
on public.prompt_versions for insert
with check (public.can_edit_workspace(workspace_id));

drop policy if exists "editors can update prompt status" on public.prompt_versions;
create policy "editors can update prompt status"
on public.prompt_versions for update
using (public.can_edit_workspace(workspace_id))
with check (public.can_edit_workspace(workspace_id));

drop policy if exists "editors can manage datasets" on public.datasets;
create policy "editors can manage datasets"
on public.datasets for all
using (public.can_edit_workspace(workspace_id))
with check (public.can_edit_workspace(workspace_id));

drop policy if exists "editors can manage dataset cases" on public.dataset_cases;
create policy "editors can manage dataset cases"
on public.dataset_cases for all
using (public.can_edit_workspace(workspace_id))
with check (public.can_edit_workspace(workspace_id));

drop policy if exists "editors can manage runs" on public.runs;
create policy "editors can manage runs"
on public.runs for all
using (public.can_edit_workspace(workspace_id))
with check (public.can_edit_workspace(workspace_id));

drop policy if exists "service jobs can manage run items" on public.run_items;
create policy "service jobs can manage run items"
on public.run_items for all
using (public.can_edit_workspace(workspace_id))
with check (public.can_edit_workspace(workspace_id));

drop policy if exists "reviewers can submit reviews" on public.human_reviews;
create policy "reviewers can submit reviews"
on public.human_reviews for insert
with check (public.can_review_workspace(workspace_id));

drop policy if exists "reviewers can update own reviews" on public.human_reviews;
create policy "reviewers can update own reviews"
on public.human_reviews for update
using (public.can_review_workspace(workspace_id))
with check (public.can_review_workspace(workspace_id));

drop policy if exists "owners and admins can manage provider credentials" on public.provider_credentials;
create policy "owners and admins can manage provider credentials"
on public.provider_credentials for all
using (public.workspace_role(workspace_id) in ('owner', 'admin'))
with check (public.workspace_role(workspace_id) in ('owner', 'admin'));

insert into storage.buckets (id, name, public)
values
  ('workspace-imports', 'workspace-imports', false),
  ('workspace-exports', 'workspace-exports', false),
  ('workspace-attachments', 'workspace-attachments', false)
on conflict (id) do nothing;

drop policy if exists "members can read workspace storage objects" on storage.objects;
create policy "members can read workspace storage objects"
on storage.objects for select
using (
  bucket_id in ('workspace-imports', 'workspace-exports', 'workspace-attachments')
  and public.is_workspace_member((storage.foldername(name))[1]::uuid)
);

drop policy if exists "editors can write workspace storage objects" on storage.objects;
create policy "editors can write workspace storage objects"
on storage.objects for insert
with check (
  bucket_id in ('workspace-imports', 'workspace-exports', 'workspace-attachments')
  and public.can_edit_workspace((storage.foldername(name))[1]::uuid)
);

drop policy if exists "editors can update workspace storage objects" on storage.objects;
create policy "editors can update workspace storage objects"
on storage.objects for update
using (
  bucket_id in ('workspace-imports', 'workspace-exports', 'workspace-attachments')
  and public.can_edit_workspace((storage.foldername(name))[1]::uuid)
)
with check (
  bucket_id in ('workspace-imports', 'workspace-exports', 'workspace-attachments')
  and public.can_edit_workspace((storage.foldername(name))[1]::uuid)
);
