'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import BotaoPlanilha from '@/components/BotaoPlanilha';
import { Carregando, SemAcesso } from '@/components/Cabecalho';
import FichaProjeto from '@/components/FichaProjeto';
import Tela from '@/components/Tela';
import { Card, Destaque, Ferramentas, Fileira } from '@/components/Vitrine';
import { formatarReais } from '@/lib/contato';
import { carregarEditais, Edital, ESFERAS, Inscricao, montarFileirasProjetos, Projeto, rotuloDe, STATUS_PROJETO } from '@/lib/editais';
import { exportarProjetos } from '@/lib/exportacoes';
import { podeVer, useMembro } from '@/lib/membro';

export default function Projetos() {
  const { carregando, membro, email } = useMembro();
  const [dados, setDados] = useState<{ editais: Edital[]; projetos: Projeto[]; inscricoes: Inscricao[] } | null>(null);
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState<string | 'novo' | null>(null);

  const recarregar = useCallback(() => {
    carregarEditais().then(setDados).catch((e: Error) => setErro(e.message));
  }, []);
  useEffect(() => {
    if (podeVer(membro, 'editais')) recarregar();
  }, [membro, recarregar]);

  const fileiras = useMemo(() => (dados ? montarFileirasProjetos(dados.projetos) : []), [dados]);

  if (carregando) return <Carregando />;
  if (!membro || !podeVer(membro, 'editais')) return <SemAcesso email={email} />;

  const cor = (p: Projeto) => ESFERAS.find((e) => e.valor === p.esfera)?.cor ?? '#6B7F88';
  const qtdEditais = (id: string) => dados?.inscricoes.filter((i) => i.projeto_id === id).length ?? 0;
  const destaque = dados?.projetos.find((p) => p.status === 'pronto') ?? dados?.projetos.find((p) => p.status === 'em_elaboracao') ?? null;
  const projetoAberto = aberto && aberto !== 'novo' ? dados?.projetos.find((p) => p.id === aberto) ?? null : null;

  const card = (p: Projeto) => {
    const n = qtdEditais(p.id);
    return (
      <Card
        key={p.id}
        titulo={p.titulo}
        linha={[p.quem_pediu, p.orcamento !== null ? formatarReais(p.orcamento) : null].filter(Boolean).join(' · ')}
        grande={p.esfera ? rotuloDe(ESFERAS, p.esfera).replace('CASDvest e Casdinho', 'Ambos') : 'Sem esfera'}
        selo={`${rotuloDe(STATUS_PROJETO, p.status)}${n ? ` · ${n} edital${n > 1 ? 'is' : ''}` : ''}`}
        cor={cor(p)}
        aoAbrir={() => setAberto(p.id)}
      />
    );
  };

  return (
    <Tela membro={membro}>
      {destaque ? (
        <Destaque
          rotulo="Projeto em destaque"
          titulo={destaque.titulo}
          cor={cor(destaque)}
          meta={[
            destaque.esfera ? rotuloDe(ESFERAS, destaque.esfera) : null,
            rotuloDe(STATUS_PROJETO, destaque.status),
            destaque.publico_atendido ? `${destaque.publico_atendido} pessoas atendidas` : null,
            destaque.orcamento !== null ? formatarReais(destaque.orcamento) : null,
          ]}
          descricao={destaque.escopo ?? undefined}
          acoes={<button type="button" className="botao" onClick={() => setAberto(destaque.id)}>ⓘ Ver projeto</button>}
        />
      ) : (
        <Destaque
          rotulo="Projetos"
          titulo={dados ? 'Banco de projetos' : 'Carregando projetos…'}
          descricao={dados ? 'Os projetos do CASDvest e do Casdinho que podem concorrer a editais. Cadastre o primeiro.' : undefined}
          acoes={dados ? <button type="button" className="botao" onClick={() => setAberto('novo')}>+ Novo projeto</button> : undefined}
        />
      )}
      <div className="miolo">
        <Ferramentas>
          <button type="button" className="botao destaque-cor" onClick={() => setAberto('novo')}>+ Novo projeto</button>
          <BotaoPlanilha
            opcoes={[{ rotulo: 'Gerar planilha', preparar: () => exportarProjetos(dados?.projetos ?? [], dados?.editais ?? [], dados?.inscricoes ?? []) }]}
          />
          {dados && (
            <p className="resumo">
              {ESFERAS.map((e) => (
                <span key={e.valor}><strong>{dados.projetos.filter((p) => p.esfera === e.valor).length}</strong> {e.valor === 'Ambos' ? 'nos dois' : e.rotulo}</span>
              ))}
            </p>
          )}
        </Ferramentas>
        {erro && <p className="aviso erro">Erro ao carregar: {erro}</p>}
        {fileiras.filter((f) => f.itens.length > 0).map((f) => (
          <Fileira key={f.chave} titulo={f.titulo} cor={f.cor} quantidade={f.itens.length}>
            {f.itens.map(card)}
          </Fileira>
        ))}
      </div>
      {aberto && dados && (
        <FichaProjeto
          key={aberto}
          projeto={projetoAberto}
          editais={dados.editais}
          inscricoes={dados.inscricoes}
          podeEditar
          podeApagar={membro.papel === 'admin'}
          aoFechar={() => setAberto(null)}
          aoSalvar={recarregar}
        />
      )}
    </Tela>
  );
}
