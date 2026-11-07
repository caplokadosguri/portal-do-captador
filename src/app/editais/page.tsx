'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import BotaoImportar from '@/components/BotaoImportar';
import BotaoPlanilha from '@/components/BotaoPlanilha';
import { Carregando, SemAcesso } from '@/components/Cabecalho';
import FichaEdital from '@/components/FichaEdital';
import Tela from '@/components/Tela';
import { Card, Destaque, Ferramentas, Fileira } from '@/components/Vitrine';
import { formatarData, formatarReais } from '@/lib/contato';
import {
  ABRANGENCIAS, carregarEditais, corSituacao, diasRestantesDoEdital, Edital, editalDestaque, emAberto, Inscricao,
  montarFileirasEditais, NIVEIS, Projeto, rotuloDe, SITUACOES, textoDiasRestantes,
} from '@/lib/editais';
import { exportarEditais } from '@/lib/exportacoes';
import { faltandoNoPortal, lerEditaisDoArquivo } from '@/lib/importarPlanilha';
import { supabase } from '@/lib/supabase/cliente';
import { podeVer, useMembro } from '@/lib/membro';
import { hojeIso } from '@/lib/texto';

export default function Editais() {
  const { carregando, membro, email } = useMembro();
  const [dados, setDados] = useState<{ editais: Edital[]; projetos: Projeto[]; inscricoes: Inscricao[]; hoje: string } | null>(null);
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState<string | 'novo' | null>(null);
  const [busca, setBusca] = useState('');

  const recarregar = useCallback(() => {
    carregarEditais().then((d) => setDados({ ...d, hoje: hojeIso() })).catch((e: Error) => setErro(e.message));
  }, []);

  useEffect(() => {
    if (podeVer(membro, 'editais')) recarregar();
  }, [membro, recarregar]);

  // "Hoje" é lido no navegador, junto com os dados (não na hora de montar a página no servidor).
  const hoje = dados?.hoje ?? '';
  const fileiras = useMemo(() => (dados ? montarFileirasEditais(dados.editais, dados.hoje) : []), [dados]);
  const destaque = useMemo(() => (dados ? editalDestaque(dados.editais, dados.hoje) : null), [dados]);
  const encontrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!dados || q.length < 2) return [];
    return dados.editais.filter((e) => `${e.nome} ${e.organizador ?? ''} ${e.fonte_recurso ?? ''}`.toLowerCase().includes(q));
  }, [busca, dados]);

  if (carregando) return <Carregando />;
  if (!membro || !podeVer(membro, 'editais')) return <SemAcesso email={email} />;

  const podeEditar = podeVer(membro, 'editais');
  const ehAdmin = membro.papel === 'admin';
  const editalAberto = aberto && aberto !== 'novo' ? dados?.editais.find((e) => e.id === aberto) ?? null : null;

  const card = (e: Edital) => {
    const dias = diasRestantesDoEdital(e, hoje);
    const vivo = emAberto(e);
    return (
      <Card
        key={e.id}
        titulo={e.nome}
        linha={[e.organizador, e.valor !== null ? formatarReais(e.valor) : null].filter(Boolean).join(' · ')}
        grande={vivo && dias !== null && dias >= 0 ? textoDiasRestantes(dias) : rotuloDe(SITUACOES, e.situacao).replace(/ \(.*\)$/, '')}
        selo={vivo ? rotuloDe(SITUACOES, e.situacao) : e.prazo ? `Prazo ${formatarData(e.prazo)}` : undefined}
        corSelo={vivo && dias !== null && dias >= 0 && dias <= 7 ? '#B3412F' : undefined}
        cor={corSituacao(e.situacao)}
        aoAbrir={() => setAberto(e.id)}
      />
    );
  };

  const vivos = dados?.editais.filter((e) => emAberto(e) && (!e.prazo || e.prazo >= hoje)).length ?? 0;
  const diasDestaque = destaque ? diasRestantesDoEdital(destaque, hoje) : null;

  return (
    <Tela membro={membro}>
      {destaque ? (
        <Destaque
          rotulo="Edital em destaque"
          titulo={destaque.nome}
          cor={corSituacao(destaque.situacao)}
          meta={[
            destaque.organizador,
            textoDiasRestantes(diasDestaque) + (diasDestaque !== null && diasDestaque > 0 ? ' para o prazo' : ''),
            destaque.valor !== null ? formatarReais(destaque.valor) : null,
            destaque.prioridade ? `Prioridade ${rotuloDe(NIVEIS, destaque.prioridade).toLowerCase()}` : null,
            destaque.abrangencia ? rotuloDe(ABRANGENCIAS, destaque.abrangencia) : null,
          ]}
          descricao={destaque.observacao || destaque.fonte_recurso || `Situação: ${rotuloDe(SITUACOES, destaque.situacao)}.`}
          acoes={
            <>
              {destaque.link && (
                <a className="botao" href={destaque.link} target="_blank" rel="noopener noreferrer">▶ Abrir edital</a>
              )}
              <button type="button" className="botao secundario" onClick={() => setAberto(destaque.id)}>ⓘ Detalhes</button>
            </>
          }
        />
      ) : (
        <Destaque
          rotulo="Editais"
          titulo={dados ? 'Nenhum edital aberto' : 'Carregando editais…'}
          descricao={dados ? 'Lance os editais filtrados da planilha da consultoria e eles aparecem aqui, organizados por prazo e prioridade.' : undefined}
          acoes={podeEditar && dados ? <button type="button" className="botao" onClick={() => setAberto('novo')}>+ Lançar edital</button> : undefined}
        />
      )}

      <div className="miolo">
        <Ferramentas>
          {podeEditar && <button type="button" className="botao destaque-cor" onClick={() => setAberto('novo')}>+ Lançar edital</button>}
          <BotaoPlanilha
            opcoes={[
              {
                rotulo: 'Gerar planilha',
                temModelo: true,
                preparar: () => exportarEditais(dados?.editais ?? [], dados?.projetos ?? [], dados?.inscricoes ?? [], hojeIso()),
                verificar: async (arquivo) => {
                  const lidos = await lerEditaisDoArquivo(arquivo);
                  if (!lidos) return 'Este arquivo não parece ser a planilha de monitoramento de editais.';
                  const faltam = faltandoNoPortal(lidos.map((e) => e.nome), (dados?.editais ?? []).map((e) => e.nome));
                  return faltam.length
                    ? `O arquivo tem ${faltam.length} edital(is) que não estão no portal (ex.: ${faltam.slice(0, 2).join('; ')}). Use “Importar do Drive” antes, para não perdê-los.`
                    : null;
                },
              },
            ]}
          />
          {podeEditar && dados && (
            <BotaoImportar
              ler={lerEditaisDoArquivo}
              nomeDe={(e) => e.nome}
              existentes={dados.editais.map((e) => e.nome)}
              gravar={async (novos) => {
                for (let i = 0; i < novos.length; i += 200) {
                  const { error } = await supabase().from('editais').insert(novos.slice(i, i + 200));
                  if (error) throw new Error(error.message);
                }
              }}
              aoTerminar={recarregar}
            />
          )}
          <label className="campo">
            <span className="sr">Buscar edital</span>
            <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, organizador ou fonte" />
          </label>
          {dados && (
            <p className="resumo">
              <span><strong>{vivos}</strong> abertos</span>
              <span><strong>{dados.editais.filter((e) => e.situacao === 'inscrito').length}</strong> inscritos</span>
              <span><strong>{dados.editais.filter((e) => e.situacao === 'aprovado' || e.situacao === 'concluido').length}</strong> aprovados</span>
              <span><strong>{dados.editais.filter((e) => e.aderencia === 'a_revisar' && e.situacao !== 'descartado').length}</strong> a revisar</span>
            </p>
          )}
        </Ferramentas>

        {erro && <p className="aviso erro">Erro ao carregar: {erro}</p>}

        {busca.trim().length >= 2 && (
          <Fileira titulo="Resultado da busca" quantidade={encontrados.length} vazio="Nenhum edital encontrado.">
            {encontrados.map(card)}
          </Fileira>
        )}

        {fileiras.filter((f) => f.itens.length > 0).map((f) => (
          <Fileira key={f.chave} titulo={f.titulo} cor={f.cor} quantidade={f.itens.length}>
            {f.itens.map(card)}
          </Fileira>
        ))}
      </div>

      {aberto && dados && (
        <FichaEdital
          key={aberto}
          edital={editalAberto}
          projetos={dados.projetos}
          inscricoes={dados.inscricoes}
          podeEditar={podeEditar}
          podeApagar={ehAdmin}
          aoFechar={() => setAberto(null)}
          aoSalvar={recarregar}
        />
      )}
    </Tela>
  );
}
