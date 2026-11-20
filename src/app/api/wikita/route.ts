import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { PRIMEIRA_TURMA, ULTIMA_TURMA, WIKITA } from '@/lib/wikita';

// Busca o wikitexto de uma página "Turma de AAAA" da Wikita para o admin (o navegador não pode
// buscar direto por causa do CORS). Não guarda nada: só repassa o texto.
export async function GET(request: NextRequest) {
  const ano = Number(request.nextUrl.searchParams.get('ano'));
  if (!Number.isInteger(ano) || ano < PRIMEIRA_TURMA || ano > ULTIMA_TURMA) {
    return NextResponse.json({ erro: 'Ano de turma inválido.' }, { status: 400 });
  }

  const sb = await supabaseServidor();
  const { data: { user } } = await sb.auth.getUser();
  const { data: membro } = user?.email
    ? await sb.from('membros').select('papel, ativo').eq('email', user.email).maybeSingle()
    : { data: null };
  if (membro?.papel !== 'admin' || !membro.ativo) return NextResponse.json({ erro: 'Só o administrador.' }, { status: 403 });

  // WIKITA_URL só para testes locais (wiki simulada).
  const url = `${process.env.WIKITA_URL ?? WIKITA}/index.php?title=Turma_de_${ano}&action=raw`;
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'PortalDoCaptador-CASD/1.0 (conferencia de doadores; captacao)' },
      next: { revalidate: 86400 },
    });
    if (r.status === 404) return NextResponse.json({ ano, texto: '' });
    if (!r.ok) return NextResponse.json({ erro: `A Wikita respondeu ${r.status}.` }, { status: 502 });
    return NextResponse.json({ ano, texto: await r.text() });
  } catch (e) {
    return NextResponse.json({ erro: `Não deu para falar com a Wikita: ${(e as Error).message}` }, { status: 502 });
  }
}
