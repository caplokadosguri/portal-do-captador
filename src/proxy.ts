import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_REDEFINIR, precisaCriarSenha } from './lib/senha';

// Renova a sessão do Supabase a cada pedido e manda quem não está logado para /login.
export async function proxy(request: NextRequest) {
  let resposta = NextResponse.next({ request });
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        lista.forEach(({ name, value }) => request.cookies.set(name, value));
        resposta = NextResponse.next({ request });
        lista.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await sb.auth.getUser();

  const caminho = request.nextUrl.pathname;
  const publica = caminho.startsWith('/login') || caminho.startsWith('/auth');
  const ir = (destino: string) => {
    const url = request.nextUrl.clone();
    url.pathname = destino;
    url.search = '';
    const r = NextResponse.redirect(url);
    resposta.cookies.getAll().forEach((c) => r.cookies.set(c)); // não perde a sessão renovada
    return r;
  };
  if (!user && !publica) return ir('/login');
  // Primeiro acesso (ou "Esqueci minha senha"): só segue depois de criar a senha.
  if (user && !caminho.startsWith('/senha') && !caminho.startsWith('/auth')) {
    if (precisaCriarSenha(user.user_metadata, request.cookies.get(COOKIE_REDEFINIR)?.value === '1')) return ir('/senha');
    if (caminho.startsWith('/login')) return ir('/');
  }
  return resposta;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)'],
};
