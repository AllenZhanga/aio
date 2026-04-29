alter table users add column if not exists password_hash varchar(128);

create table user_workspace_memberships (
  id varchar(64) primary key,
  tenant_id varchar(64) not null references tenants(id),
  user_id varchar(64) not null references users(id),
  workspace_id varchar(64) not null references workspaces(id),
  role varchar(40) not null,
  status varchar(40) not null,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null,
  unique (tenant_id, user_id, workspace_id)
);

create index idx_user_workspace_memberships_user on user_workspace_memberships(user_id, status);
create index idx_user_workspace_memberships_scope on user_workspace_memberships(tenant_id, workspace_id, status);
