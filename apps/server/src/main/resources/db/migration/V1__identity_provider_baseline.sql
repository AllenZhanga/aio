create table tenants (
  id varchar(64) primary key,
  name varchar(160) not null,
  code varchar(80) not null unique,
  plan varchar(40) not null,
  status varchar(40) not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);

create table workspaces (
  id varchar(64) primary key,
  tenant_id varchar(64) not null references tenants(id),
  name varchar(160) not null,
  status varchar(40) not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);

create index idx_workspaces_tenant_status on workspaces(tenant_id, status);

create table users (
  id varchar(64) primary key,
  tenant_id varchar(64) not null references tenants(id),
  email varchar(190) not null,
  display_name varchar(160) not null,
  role varchar(40) not null,
  status varchar(40) not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null,
  unique (tenant_id, email)
);

create index idx_users_tenant_status on users(tenant_id, status);

create table api_keys (
  id varchar(64) primary key,
  tenant_id varchar(64) not null references tenants(id),
  workspace_id varchar(64) references workspaces(id),
  app_id varchar(64),
  name varchar(160) not null,
  key_prefix varchar(24) not null,
  key_hash varchar(128) not null unique,
  status varchar(40) not null,
  expires_at timestamp with time zone,
  last_used_at timestamp with time zone,
  created_at timestamp with time zone not null,
  created_by varchar(64),
  revoked_at timestamp with time zone
);

create index idx_api_keys_tenant_scope on api_keys(tenant_id, workspace_id, app_id, status);

create table model_provider_accounts (
  id varchar(64) primary key,
  tenant_id varchar(64) not null references tenants(id),
  workspace_id varchar(64) references workspaces(id),
  name varchar(160) not null,
  provider_type varchar(60) not null,
  base_url varchar(500) not null,
  api_key_ciphertext text,
  default_chat_model varchar(160),
  default_embedding_model varchar(160),
  config_json text,
  status varchar(40) not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null
);

create index idx_model_provider_accounts_tenant_scope on model_provider_accounts(tenant_id, workspace_id, status);
