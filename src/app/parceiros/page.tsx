'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Carregando, SemAcesso } from '@/components/Cabecalho';
import FichaParceria from '@/components/FichaParceria';
import FunilParcerias from '@/components/FunilParcerias';
import StatusDrive from '@/components/StatusDrive';
import Tela from '@/components/Tela';
import { Card, Destaque, Ferramentas, Fileira } from '@/components/Vitrine';
import { formatarData } from '@/lib/contato';
import { exportarParcerias } from '@/lib/exportacoes';
import { ABAS_LEITURA_PARCERIAS, novosPorNome, parceriasDeLinhas } from '@/lib/importarPlanilha';
import { podeVer, useMembro } from '@/lib/membro';
import {
  contarFunil, corStatus, emAndamento, montarFileirasParcerias, numeroDeContatos, Parceria, precisaRetomar, rotuloInteresse, rotuloStatus, ultimoContato,
} from '@/lib/parceiros';
import { supabase } from '@/lib/supabase/cliente';
import { hojeIso } from '@/lib/texto';

export default function Parceiros() {
  const { carregando, membro, email } = useMembro();
  const [dados, setDados] = useState<{ lista: Parceria[]; nomes: string[]; hoje: string } | null>(null);
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState<string | 'nova' | null>(null);
  const [busca, setBusca] = useState('');

  const [versao, setVersao] = useState(0);
  const recarregar = useCallback(() => {
    const sb = supabase();
    return Promise.all([sb.from('parcerias').select('*').order('organizacao'), sb.from('membros').select('nome')]).then(([p, m]) => {
      if (p.error) return setErro(p.error.message);
      const lista = (p.data ?? []) as Parceria[];
      const nomes = [...new Set([...(m.data ?? []).map((x: { nome: string }) => x.nome), ...lista.map((x) => x.responsavel ?? '')])].filter(Boolean).sort();
      setDados({ lista, nomes, hoje: hojeIso() });
    });
  }, []);
  const salvou = useCallback(async () => {
    await recarregar();
    setVersao((v) => v + 1);
  }, [recarregar]);

  useEffect(() => {
    if (podeVer(membro, 'parceiros')) recarregar();
  }, [membro, recarregar]);

  const fileiras = useMemo(() => (dados ? montarFileirasParcerias(dados.lista, dados.hoje) : []), [dados]);
  const encontrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!dados || q.length < 2) return [];
    return dados.lista.filter((p) => `${p.organizacao} ${p.pessoa ?? ''} ${p.tipo ?? ''}`.toLowerCase().includes(q));
  }, [busca, dados]);

  if (carregando) return <Carregando />;
  if (!membro || !podeVer(membro, 'parceiros')) return <SemAcesso email={email} />;

  const lista = dados?.lista ?? [];
  const andamento = lista.filter(emAndamento).length;
  const retomar = dados ? lista.filter((p) => precisaRetomar(p, dados.hoje)) : [];
  const funil = contarFunil(lista);
  const aberta = aberto && aberto !== 'nova' ? lista.find((p) => p.id === aberto) ?? null : null;

  const card = (p: Parceria) => {
    const n = numeroDeContatos(p);
    const u = ultimoContato(p);
    return (
      <Card
        key={p.id}
        titulo={p.organizacao}
        linha={[rotuloInteresse(p.interesse)?.split(' (')[0], p.pessoa, u ? `último contato ${formatarData(u)}` : null].filter(Boolean).join(' · ')}
        grande={p.tipo ?? (n ? `${n}º contato` : 'Sem contato')}
        selo={rotuloStatus(p.status)}
        cor={corStatus(p.status)}
        aoAbrir={() => setAberto(p.id)}
      />
    );
  };

  return (
    <Tela membro={membro}>
      <Destaque
        rotulo="Plano de abordagem · Parcerias e doações PJ"
        titulo={!dados ? 'Carregando parcerias…' : retomar.length ? `${retomar.length} ${retomar.length === 1 ? 'empresa espera' : 'empresas esperam'} retorno` : `${andamento} abordagens em andamento`}
        cor={retomar.length ? '#E5533D' : '#B8692A'}
        meta={dados ? [`${funil.topo} no topo`, `${funil.meio} no meio`, `${funil.fundo} no fundo`, `${funil.pos} no pós-funil`] : []}
        descricao={dados ? 'A etapa no funil vem do status da abordagem e da classificação de interesse feita pelo membro. Mais de 7 dias sem retorno aparece em “Retomar contato”.' : undefined}
        acoes={retomar[0] ? <button type="button" className="botao" onClick={() => setAberto(retomar[0].id)}>▶ Retomar {retomar[0].organizacao}</button> : undefined}
      />
      <div className="miolo">
        <Ferramentas>
          <button type="button" className="botao destaque-cor" onClick={() => setAberto('nova')}>+ Nova abordagem</button>
          <StatusDrive
            planilha="abordagem"
            pronto={!!dados}
            versao={versao}
            ehAdmin={membro.papel === 'admin'}
            preparar={() => exportarParcerias(lista)}
            importar={{
              abas: ABAS_LEITURA_PARCERIAS,
              faltando: (lidas) => {
                const novos = novosPorNome(parceriasDeLinhas(lidas['Parcerias e Doações PJ'] ?? []), (p) => p.organizacao, lista.map((p) => p.organizacao));
                return {
                  nomes: novos.map((p) => p.organizacao),
                  gravar: async () => {
                    const { error } = await supabase().from('parcerias').insert(novos);
                    if (error) throw new Error(error.message);
                    await salvou();
                  },
                };
              },
            }}
          />
          <label className="campo">
            <span className="sr">Buscar parceria</span>
            <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por empresa, pessoa ou tipo" />
          </label>
        </Ferramentas>
        {erro && <p className="aviso erro">Erro ao carregar: {erro}</p>}
        {busca.trim().length >= 2 && (
          <Fileira titulo="Resultado da busca" quantidade={encontrados.length} vazio="Nada encontrado.">
            {encontrados.map(card)}
          </Fileira>
        )}
        {dados && lista.length > 0 && <FunilParcerias contagem={funil} />}
        {fileiras.filter((f) => f.itens.length > 0).map((f) => (
          <div key={f.chave} id={`fileira-${f.chave}`} style={{ scrollMarginTop: 90 }}>
            <Fileira titulo={f.titulo} cor={f.cor} quantidade={f.itens.length}>
              {f.itens.map(card)}
            </Fileira>
          </div>
        ))}
      </div>
      {aberto && dados && (
        <FichaParceria
          key={aberto}
          parceria={aberta}
          responsaveis={dados.nomes}
          podeApagar={membro.papel === 'admin'}
          aoFechar={() => setAberto(null)}
          aoSalvar={salvou}
        />
      )}
    </Tela>
  );
}
