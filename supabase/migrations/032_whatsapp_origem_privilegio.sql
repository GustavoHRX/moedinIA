-- 032_whatsapp_origem_privilegio.sql — agente WhatsApp v2.13 (22/09/2026)
-- Defesa determinística contra injeção de prompt vinda de arquivo/áudio (OWASP LLM01).
--
-- Ideia: quando a mensagem do turno veio de PDF, foto ou áudio, o conteúdo foi escrito por um
-- TERCEIRO (uma fatura falsa, por exemplo). Nesse turno o agente PERDE o direito de apagar.
-- O prompt já manda ignorar instruções escondidas, mas isso é probabilístico; isto aqui não é.
--
-- Como: sobrecarga. Cada função destrutiva ganha uma versão com `p_origem`, que recusa e só então
-- delega para a original. O n8n preenche `p_origem` por EXPRESSÃO (nunca pelo modelo), do mesmo
-- jeito que já faz com `p_user_id`. As versões antigas continuam existindo para uso interno.
--
-- Importar extrato NÃO entra aqui de propósito: importar é a razão de mandar o PDF, e ainda assim
-- só acontece depois de a pessoa escrever "importa tudo" — o que já é um turno de texto.
-- Idempotente. Grant só service_role.

create or replace function public.whatsapp_origem_bloqueada(p_origem text)
returns boolean
language sql
immutable
set search_path = public
as $$ select coalesce(p_origem, 'texto') <> 'texto'; $$;

create or replace function public.whatsapp_origem_recusa(p_origem text, p_acao text)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object(
    'ok', false,
    'bloqueado_por_origem', p_origem,
    'mensagem', '🛡️ Esse pedido de ' || p_acao || ' veio de dentro de ' ||
                case p_origem when 'audio' then 'um áudio' when 'imagem' then 'uma foto' else 'um arquivo' end ||
                ', e eu nunca apago nada por aí — arquivo pode trazer instrução escondida. ' ||
                'Se foi você mesmo, me escreva o pedido: "excluir o último".');
$$;

create or replace function public.whatsapp_delete_transaction(
  p_user_id uuid,
  p_alvo text,
  p_origem text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.whatsapp_origem_bloqueada(p_origem) then
    return public.whatsapp_origem_recusa(p_origem, 'exclusão');
  end if;
  return public.whatsapp_delete_transaction(p_user_id, p_alvo);
end;
$$;

create or replace function public.whatsapp_delete_recurrence(
  p_user_id uuid,
  p_kind text,
  p_alvo text,
  p_origem text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.whatsapp_origem_bloqueada(p_origem) then
    return public.whatsapp_origem_recusa(p_origem, 'exclusão');
  end if;
  return public.whatsapp_delete_recurrence(p_user_id, p_kind, p_alvo);
end;
$$;

create or replace function public.whatsapp_undo_import(
  p_user_id uuid,
  p_origem text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.whatsapp_origem_bloqueada(p_origem) then
    return public.whatsapp_origem_recusa(p_origem, 'desfazer importação');
  end if;
  return public.whatsapp_undo_import(p_user_id);
end;
$$;

revoke all on function public.whatsapp_origem_bloqueada(text) from public, anon, authenticated;
revoke all on function public.whatsapp_origem_recusa(text, text) from public, anon, authenticated;
revoke all on function public.whatsapp_delete_transaction(uuid, text, text) from public, anon, authenticated;
revoke all on function public.whatsapp_delete_recurrence(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.whatsapp_undo_import(uuid, text) from public, anon, authenticated;

grant execute on function public.whatsapp_origem_bloqueada(text) to service_role;
grant execute on function public.whatsapp_origem_recusa(text, text) to service_role;
grant execute on function public.whatsapp_delete_transaction(uuid, text, text) to service_role;
grant execute on function public.whatsapp_delete_recurrence(uuid, text, text, text) to service_role;
grant execute on function public.whatsapp_undo_import(uuid, text) to service_role;
