/**
 * Chave pública do Supabase para os clientes de SERVIDOR (route handlers,
 * server components e proxy). Antes o `server.ts` preferia a chave "publishable"
 * e o proxy preferia a "anon" — com as duas definidas e diferentes, cada lado
 * usava uma chave distinta. Um lugar só decide a ordem.
 *
 * (O client de navegador em `client.ts` precisa referenciar as variáveis
 * NEXT_PUBLIC_* literalmente para o bundler substituí-las; ele segue a mesma
 * ordem.)
 */
export function getSupabaseKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
