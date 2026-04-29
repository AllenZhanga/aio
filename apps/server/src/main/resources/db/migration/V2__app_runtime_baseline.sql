create table ai_apps (
  id varchar(64) primary key,
  tenant_id varchar(64) not null references tenants(id),
  workspace_id varchar(64) not null references workspaces(id),
  name varchar(160) not null,
  type varchar(40) not null,
  description text,
  visibility varchar(40) not null,
  status varchar(40) not null,
  published_version_id varchar(64),
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);

create index idx_ai_apps_tenant_workspace_status on ai_apps(tenant_id, workspace_id, status);

create table ai_app_versions (
  id varchar(64) primary key,
  tenant_id varchar(64) not null references tenants(id),
  workspace_id varchar(64) not null references workspaces(id),
  app_id varchar(64) not null references ai_apps(id),
  version_no int not null,
  type varchar(40) not null,
  definition_json text not null,
  publish_status varchar(40) not null,
  published_at timestamp with time zone,
  published_by varchar(64),
  created_at timestamp with time zone not null,
  unique (app_id, version_no)
);

create index idx_ai_app_versions_app_status on ai_app_versions(app_id, publish_status);

create table ai_runs (
  id varchar(64) primary key,
  tenant_id varchar(64) not null references tenants(id),
  workspace_id varchar(64) not null references workspaces(id),
  app_id varchar(64) not null references ai_apps(id),
  app_version_id varchar(64) references ai_app_versions(id),
  run_type varchar(40) not null,
  input_json text,
  output_json text,
  status varchar(40) not null,
  current_wait_task_id varchar(64),
  resume_count int not null default 0,
  total_tokens int,
  cost_amount decimal(18, 6),
  latency_ms bigint,
  error_message text,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);

create index idx_ai_runs_tenant_app_created on ai_runs(tenant_id, app_id, created_at desc);

create table ai_traces (
  id varchar(64) primary key,
  tenant_id varchar(64) not null references tenants(id),
  workspace_id varchar(64) not null references workspaces(id),
  run_id varchar(64) not null references ai_runs(id),
  parent_trace_id varchar(64),
  type varchar(40) not null,
  name varchar(160) not null,
  input_json text,
  output_json text,
  status varchar(40) not null,
  latency_ms bigint,
  token_json text,
  error_message text,
  created_at timestamp with time zone not null
);

create index idx_ai_traces_tenant_run on ai_traces(tenant_id, run_id, created_at);
