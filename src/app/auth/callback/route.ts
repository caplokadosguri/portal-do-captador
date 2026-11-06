import { NextResponse } from 'next/server';
import { supabaseServidor } from '@/lib/supabase/servidor';

// Volta do link mágico (ou do login com Google): troca o código pela sessão.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const codigo = url.searchParams.get('code');
  if (codigo) {
    const sb = await supabaseServidor();
    const { error } = await sb.auth.exchangeCodeForSession(codigo);
    if (!error) return NextResponse.redirect(new URL('/', url.origin));
  }
  return NextResponse.redirect(new URL('/login?erro=link', url.origin));
}
