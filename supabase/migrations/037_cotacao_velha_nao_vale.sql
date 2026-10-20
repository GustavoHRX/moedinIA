-- 037 — Cotação de câmbio com mais de 3 dias não vale (19/10/2026)
--
-- Em 19/10 a tabela fx_rates estava parada desde 01/10: o workflow das 7h10 que busca o câmbio não
-- tinha rodado mais. Mesmo assim o bot convertia "gastei 20 dólares" com a cotação de 18 dias antes,
-- sem avisar. Agora cotação velha é tratada como cotação ausente, e as duas funções já sabem o que
-- dizer nesse caso: whatsapp_create_transaction pede o valor em reais e não grava nada;
-- whatsapp_fx_quote responde que ainda não tem a cotação.
--
-- Mesma técnica da 034: lê a definição ATUAL de cada função e troca só a consulta à fx_rates,
-- acrescentando o filtro de idade. Todo o resto fica igual. Idempotente (se o filtro já estiver lá,
-- o padrão não casa e nada muda).
--
-- 3 dias cobre um fim de semana com a API fora do ar; o workflow das 7h10 (com a AwesomeAPI de reserva
-- desde esta data) atualiza todo dia.

do $$
declare
  r record;
  v_def text;
  v_new text;
  c_pat constant text := $re$(from public\.fx_rates where code = v_code)(;)$re$;
begin
  for r in
    select p.oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('whatsapp_create_transaction', 'whatsapp_fx_quote')
       and p.prosrc ~ c_pat
  loop
    v_def := pg_get_functiondef(r.oid);
    v_new := regexp_replace(v_def, c_pat, $rep$\1 and updated_at > now() - interval '3 days'\2$rep$, 'g');
    if v_new is distinct from v_def then
      execute v_new;  -- CREATE OR REPLACE: mantém dono, grants e search_path
      raise notice '037: cotação com idade máxima de 3 dias em %', r.oid::regprocedure;
    end if;
  end loop;
end
$$;
