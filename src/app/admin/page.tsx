'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Carregando, SemAcesso } from '@/components/Cabecalho';
import Tela from '@/components/Tela';
import { Card, Destaque, Fileira } from '@/components/Vitrine';
import { PERFIS, useMembro } from '@/lib/membro';
import { supabase } from '@/lib/supabase/cliente';
import { hojeIso } from '@/lib/texto';

interface Importacao { id: string; tipo: string; arquivo: string | null; linhas_lidas: number; linhas_ok: number; feito_por: string; feito_em: string }

export default function Admin() {
  const { carregando, membro, email } = useMembro();
  const router = useRouter();
  const [importacoes, setImportacoes] = useState<Importacao[]>([]);
  const [numeros, setNumeros] = useState<{ doadores: number; editais: number; projetos: number; membros: number } | null>(null);

  useEffect(() => {
    if (membro?.papel !== 'admin') return;
    const sb = supabase();
    sb.from('importacoes').select('*').order('feito_em', { ascending: false }).limit(8)
      .then(({ data }) => setImportacoes((data as Importacao[]) ?? []));
    const contar = { count: 'exact' as const, head: true };
    Promise.all([
      sb.from('doadores').select('*', contar),
      sb.from('editais').select('*', contar).in('situacao', ['novo', 'em_escrita']).or(`prazo.is.null,prazo.gte.${hojeIso()}`),
      sb.from('projetos').select('*', contar),
      sb.from('membros').select('*', contar).eq('ativo', true),
    ]).then(([d, e, p, m]) => setNumeros({ doadores: d.count ?? 0, editais: e.count ?? 0, projetos: p.count ?? 0, membros: m.count ?? 0 }));
  }, [membro]);

  if (carregando) return <Carregando />;
  if (membro?.papel !== 'admin') return <SemAcesso email={email} />;

  const areas = [
    { rota: '/doadores', titulo: 'Doadores', linha: 'Plano de doadores, atrasos e pontuais', grande: numeros ? `${numeros.doadores}` : undefined, selo: 'Doadores', papel: 'doadores' },
    { rota: '/editais', titulo: 'Editais', linha: 'Lançar e acompanhar editais', grande: numeros ? `${numeros.editais} abertos` : undefined, selo: 'Editais', papel: 'editais' },
    { rota: '/projetos', titulo: 'Projetos', linha: 'CASDvest e Casdinho', grande: numeros ? `${numeros.projetos}` : undefined, selo: 'Editais', papel: 'editais' },
    { rota: '/parceiros', titulo: 'Parceiros', linha: 'Plano de abordagem PJ', selo: 'Parceiros', papel: 'parceiros' },
    { rota: '/eventos', titulo: 'Eventos', linha: 'Calendário de eventos (EC, EI, EA)', selo: 'Eventos', papel: 'eventos' },
  ];
  const cor = (papel: string) => PERFIS.find((p) => p.papel === papel)?.cor ?? '#3192B3';

  return (
    <Tela membro={membro}>
      <Destaque
        rotulo="Diretoria de Captação"
        titulo={`Olá, ${membro.nome.split(' ')[0]}`}
        cor="#3192B3"
        meta={numeros ? [`${numeros.membros} membros ativos`, `${numeros.doadores} doadores`, `${numeros.editais} editais abertos`, `${numeros.projetos} projetos`] : []}
        descricao="Você vê todas as áreas. As planilhas do CASD no Drive se atualizam sozinhas quando alguém salva algo no portal."
      />
      <div className="miolo">
        <Fileira titulo="Áreas da Captação" cor="#F9B341">
          {areas.map((a) => (
            <Card key={a.rota} titulo={a.titulo} linha={a.linha} grande={a.grande} selo={a.selo} cor={cor(a.papel)} aoAbrir={() => router.push(a.rota)} />
          ))}
        </Fileira>
        <Fileira titulo="Ferramentas da diretoria" cor="#3192B3">
          <Card titulo="Importar relatórios" linha="Doadores, doações e cobranças (CSV)" grande="Trackmob" cor="#2A9D8F" aoAbrir={() => router.push('/admin/importar')} />
          <Card titulo="Planilhas no Drive" linha="Ligar as planilhas do CASD ao portal" grande="Drive" cor="#3FA66B" aoAbrir={() => router.push('/admin/drive')} />
          <Card titulo="Membros e perfis" linha="Quem acessa o quê" grande={numeros ? `${numeros.membros} ativos` : undefined} cor="#8E6CD1" aoAbrir={() => router.push('/admin/membros')} />
        </Fileira>

        <section className="fileira-n">
          <h2><span className="barra" style={{ background: '#6B7F88' }} aria-hidden="true" />Últimas importações</h2>
          {importacoes.length === 0 ? (
            <p className="vazio">Nenhuma importação ainda.</p>
          ) : (
            <div className="rolagem cartao">
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
      </div>
    </Tela>
  );
}
