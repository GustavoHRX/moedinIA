-- 014_revoke_anon_rpcs.sql
-- AUDITORIA (ago/2026) — item CRÍTICO C-1.
--
-- As migrations 005/007/008 concederam EXECUTE a `anon` (e a `authenticated`)
-- em funções SECURITY DEFINER que recebem um user_id arbitrário. A migration
-- 013 só revogou 3 das funções de WhatsApp; estas 4 continuavam abertas no
-- SQL versionado. Com a chave anônima (pública, embutida no bundle do site)
-- qualquer visitante conseguia:
--   * resolve_user_by_phone      -> descobrir nome + user_id por telefone;
--   * whatsapp_monthly_report    -> ler o extrato mensal de qualquer usuário;
--   * whatsapp_delete_transaction-> apagar lançamentos de qualquer usuário;
--   * resolve_category           -> criar categorias na conta de qualquer usuário.
--
-- O banco de produção já estava corrigido manualmente no painel; esta migration
-- alinha o SQL versionado ao estado seguro para que `supabase db reset`, um
-- ambiente novo ou um restore não reabram a falha.
--
-- Quem PRECISA chamar estas funções é o n8n, sempre com a service_role (que
-- ignora grants). Nenhum papel de usuário final deve ter acesso.

revoke execute on function public.resolve_user_by_phone(text)              from public, anon, authenticated;
revoke execute on function public.resolve_category(uuid, text, text)       from public, anon, authenticated;
revoke execute on function public.whatsapp_monthly_report(uuid, date)      from public, anon, authenticated;
revoke execute on function public.whatsapp_delete_transaction(uuid, text)  from public, anon, authenticated;

-- money_br é só formatação de número (sem acesso a dados) — pode continuar
-- liberada, mas não há motivo para expô-la na API pública.
revoke execute on function public.money_br(numeric)                        from public, anon, authenticated;

-- resolve_category(uuid, text) foi DROPADA pela migration 007 (substituída pela
-- assinatura com 3 argumentos). Num banco novo ela não existe; revogar sem
-- guard quebraria o `db reset`. (Achado da revisão externa de ago/2026.)
do $$
begin
  revoke execute on function public.resolve_category(uuid, text) from public, anon, authenticated;
exception when undefined_function then null;
end $$;

do $$
begin
  -- resolve_user_by_wa e link_whatsapp_by_code já foram revogados na 013;
  -- reforço defensivo aqui para o caso de a 013 não ter rodado.
  begin
    revoke execute on function public.resolve_user_by_wa(text, text)         from public, anon, authenticated;
  exception when undefined_function then null;
  end;
  begin
    revoke execute on function public.link_whatsapp_by_code(text, text, text) from public, anon, authenticated;
  exception when undefined_function then null;
  end;
end $$;
