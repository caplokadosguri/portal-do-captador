-- Tira as funções de permissão da API pública (não ficam chamáveis por /rest/v1/rpc).
-- As regras de acesso continuam usando as mesmas funções.
create schema if not exists privado;
alter function public.meu_email() set schema privado;
alter function public.meu_papel() set schema privado;
alter function public.sou_admin() set schema privado;
alter function public.posso(papel_t) set schema privado;
alter function public.sou_membro() set schema privado;
alter function privado.meu_email() set search_path = privado, public;
alter function privado.meu_papel() set search_path = privado, public;
alter function privado.sou_admin() set search_path = privado, public;
alter function privado.posso(papel_t) set search_path = privado, public;
alter function privado.sou_membro() set search_path = privado, public;
grant usage on schema privado to anon, authenticated;
grant execute on all functions in schema privado to anon, authenticated;
