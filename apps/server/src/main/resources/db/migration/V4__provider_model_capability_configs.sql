alter table model_provider_accounts add column llm_base_url varchar(500);
alter table model_provider_accounts add column llm_api_key_ciphertext text;
alter table model_provider_accounts add column llm_model varchar(160);
alter table model_provider_accounts add column llm_config_json text;
alter table model_provider_accounts add column embedding_base_url varchar(500);
alter table model_provider_accounts add column embedding_api_key_ciphertext text;
alter table model_provider_accounts add column embedding_model varchar(160);
alter table model_provider_accounts add column embedding_config_json text;
alter table model_provider_accounts add column rerank_base_url varchar(500);
alter table model_provider_accounts add column rerank_api_key_ciphertext text;
alter table model_provider_accounts add column rerank_model varchar(160);
alter table model_provider_accounts add column rerank_config_json text;

update model_provider_accounts
set llm_base_url = base_url,
    llm_api_key_ciphertext = api_key_ciphertext,
    llm_model = default_chat_model,
    llm_config_json = config_json,
    embedding_base_url = base_url,
    embedding_api_key_ciphertext = api_key_ciphertext,
    embedding_model = default_embedding_model,
    embedding_config_json = config_json
where llm_base_url is null
  and embedding_base_url is null;