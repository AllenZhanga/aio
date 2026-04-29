create table ai_tools (
  id varchar(64) primary key,
  tenant_id varchar(64) not null references tenants(id),
  workspace_id varchar(64) not null references workspaces(id),
  name varchar(160) not null,
  type varchar(40) not null,
  description text,
  input_schema text,
  config_json text,
  status varchar(40) not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);

create index idx_ai_tools_tenant_workspace_status on ai_tools(tenant_id, workspace_id, status);

create table mcp_servers (
  id varchar(64) primary key,
  tenant_id varchar(64) not null references tenants(id),
  workspace_id varchar(64) not null references workspaces(id),
  name varchar(160) not null,
  transport varchar(40) not null,
  endpoint varchar(500),
  command_config text,
  auth_config text,
  status varchar(40) not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);

create index idx_mcp_servers_tenant_workspace_status on mcp_servers(tenant_id, workspace_id, status);

create table ai_skills (
  id varchar(64) primary key,
  tenant_id varchar(64) not null references tenants(id),
  workspace_id varchar(64) not null references workspaces(id),
  name varchar(160) not null,
  description text,
  definition_json text not null,
  status varchar(40) not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);

create index idx_ai_skills_tenant_workspace_status on ai_skills(tenant_id, workspace_id, status);

create table kb_datasets (
  id varchar(64) primary key,
  tenant_id varchar(64) not null references tenants(id),
  workspace_id varchar(64) not null references workspaces(id),
  name varchar(160) not null,
  description text,
  embedding_provider_id varchar(64),
  embedding_model varchar(160),
  chunk_strategy varchar(40) not null,
  status varchar(40) not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);

create index idx_kb_datasets_tenant_workspace_status on kb_datasets(tenant_id, workspace_id, status);

create table kb_documents (
  id varchar(64) primary key,
  tenant_id varchar(64) not null references tenants(id),
  workspace_id varchar(64) not null references workspaces(id),
  dataset_id varchar(64) not null references kb_datasets(id),
  name varchar(220) not null,
  source_type varchar(40) not null,
  object_key varchar(700),
  content_text text,
  parse_status varchar(40) not null,
  index_status varchar(40) not null,
  error_message text,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);

create index idx_kb_documents_dataset_status on kb_documents(tenant_id, dataset_id, created_at desc);

create table kb_chunks (
  id varchar(64) primary key,
  tenant_id varchar(64) not null references tenants(id),
  workspace_id varchar(64) not null references workspaces(id),
  dataset_id varchar(64) not null references kb_datasets(id),
  document_id varchar(64) not null references kb_documents(id),
  chunk_no int not null,
  content text not null,
  token_count int,
  metadata_json text,
  vector_id varchar(128),
  created_at timestamp with time zone not null
);

create index idx_kb_chunks_dataset_document on kb_chunks(tenant_id, dataset_id, document_id);

create table ai_wait_tasks (
  id varchar(64) primary key,
  tenant_id varchar(64) not null references tenants(id),
  workspace_id varchar(64) not null references workspaces(id),
  app_id varchar(64) not null references ai_apps(id),
  app_version_id varchar(64) references ai_app_versions(id),
  run_id varchar(64) not null references ai_runs(id),
  trace_id varchar(64) references ai_traces(id),
  node_id varchar(120) not null,
  node_type varchar(40) not null,
  title varchar(220),
  description text,
  assignee_type varchar(60),
  assignee_id varchar(160),
  form_schema_json text,
  ui_schema_json text,
  action_schema_json text,
  default_values_json text,
  context_json text,
  submit_result_json text,
  status varchar(40) not null,
  submit_token_hash varchar(128),
  idempotency_key varchar(160),
  expires_at timestamp with time zone,
  submitted_at timestamp with time zone,
  submitted_by varchar(220),
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);

create index idx_ai_wait_tasks_tenant_run_status on ai_wait_tasks(tenant_id, run_id, status);
create index idx_ai_wait_tasks_tenant_status_expiry on ai_wait_tasks(tenant_id, status, expires_at);