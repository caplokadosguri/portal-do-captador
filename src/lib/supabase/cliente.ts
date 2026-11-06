'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let cliente: SupabaseClient | null = null;

/** Cliente do Supabase no navegador. As regras de acesso (RLS) ficam no banco. */
export function supabase(): SupabaseClient {
  if (!cliente) {
    cliente = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return cliente;
}

/** Busca todas as linhas de uma consulta, de 1000 em 1000 (limite padrão do Supabase). */
export async function buscarTudo<T>(
  montar: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const tudo: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await montar(de, de + 999);
    if (error) throw new Error(error.message);
    tudo.push(...(data ?? []));
    if (!data || data.length < 1000) return tudo;
  }
}
