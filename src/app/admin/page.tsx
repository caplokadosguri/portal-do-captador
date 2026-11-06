'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Cabecalho, { Carregando, SemAcesso } from '@/components/Cabecalho';
import { useMembro } from '@/lib/membro';
import { supabase } from '@/lib/supabase/cliente';

interface Importacao { id: string; tipo: string; arquivo: string | null; linhas_lidas: number; linhas_ok: number; feito_por: string; feito_em: string }

export default function Admin() {
  const { carregando, membro, email } = useMembro();
  const [importacoes, setImportacoes] = useState<Importacao[]>([]);

  useEffect(() => {
    if (membro?.papel !== 'admin') return;
    supabase().from('importacoes').select('*').order('feito_em', { ascending: false }).limit(5)
      .then(({ data }) => setImportacoes((data as Importacao[]) ?? []));
  }, [membro]);

  if (carregando) return <Carregando />;
  if (membro?.papel !== 'admin') return <SemAcesso email={email} />;

  return (
    <>
      <Cabecalho membro={membro} />
      <main className="pagina pilha" style={{ gap: 24 }}>
        <h1 style={{ fontSize: 28 }}>Administrador</h1>
        <div className="linha">
          <Link className="botao" href="/admin/importar">Importar relatórios da Trackmob</Link>
          <Link className="botao secundario" href="/admin/membros">Membros e perfis</Link>
          <Link className="botao secundario" href="/doadores">Doadores</Link>
          <Link className="botao secundario" href="/editais">Editais</Link>
        </div>
        <section className="cartao pilha">
          <h2 style={{ fontSize: 20 }}>Últimas importações</h2>
          {importacoes.length === 0 ? (
            <p className="vazio">Nenhuma importação ainda.</p>
          ) : (
            <div className="rolagem">
              <table className="tabela">
                <thead><tr><th>Quando</th><th>Relatório</th><th>Linhas</th><th>Por</th></tr></thead>
                <tbody>
                  {importacoes.map((i) => (
                    <tr key={i.id}>
                      <td>{new Date(i.feito_em).toLocaleString('pt-BR')}</td>
                      <td>{i.tipo}{i.arquivo ? ` (${i.arquivo})` : ''}</td>
                      <td>{i.linhas_ok} de {i.linhas_lidas}</td>
                      <td>{i.feito_por}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
