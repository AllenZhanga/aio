alter table kb_chunks add column vector_status varchar(40);
alter table kb_chunks add column embedding_provider_id varchar(64);
alter table kb_chunks add column embedding_model varchar(160);
alter table kb_chunks add column embedding_dimension int;
alter table kb_chunks add column embedding_vector text;
