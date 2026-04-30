create table ai_app_drafts (
  id varchar(64) primary key,
  tenant_id varchar(64) not null references tenants(id),
  workspace_id varchar(64) not null references workspaces(id),
  app_id varchar(64) not null references ai_apps(id),
  base_version_id varchar(64) references ai_app_versions(id),
  definition_json text not null,
  validation_json text,
  revision int not null default 1,
  dirty boolean not null default true,
  autosaved_by varchar(64),
  autosaved_at timestamp with time zone,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null,
  unique (app_id)
);

create index idx_ai_app_drafts_tenant_app on ai_app_drafts(tenant_id, app_id);
