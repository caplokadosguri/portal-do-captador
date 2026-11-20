'use client';

import { useCallback, useEffect, useState } from 'react';
import { Carregando, SemAcesso } from '@/components/Cabecalho';
import Tela from '@/components/Tela';
import type { Modelo, ParteMensagem } from '@/lib/carteira';
import { completarVariacoes, rotuloVersao, TODAS_VERSOES, Tratamento, TRATAMENTOS, Versao, versaoPreenchida } from '@/lib/mensagens';
import { useMembro } from '@/lib/membro';
import { supabase } from '@/lib/supabase/cliente';

const VARIAVEIS: [string, string][] = [
  ['{saudacao}', 'Bom dia / Boa tarde / Boa noite, pela hora do envio'],
  ['{nome}', 'primeiro nome do doador'],
  ['{membro}', 'primeiro nome de quem envia'],
  ['{tempo}', 'tempo de doação do marco (ex.: 1 ano e meio)'],
  ['{seu_tempo}', 'o mesmo com seu/seus (ex.: seu 1 ano e meio, seus 2 anos)'],
  ['{apelido}', 'apelido do ITA marcado na ficha (na falta, o primeiro nome)'],
  ['{valor}', 'valor da doação'],
  ['{brinde}', 'brinde do marco'],
];

type Edicao = Record<string, Record<Tratamento, ParteMensagem[]>>;

const juntar = (partes: ParteMensagem[]) => partes.map((p) => p.texto.trim()).filter(Boolean).join('\n\n');

// Editor das mensagens prontas. As do plano (checkpoints) têm versões 1, 2 e 3, cada uma
// no masculino e no feminino; as demais (cobrança, aniversário...) têm uma versão só.
export default function Mensagens() {
  const { carregando, membro, email } = useMembro();
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [chave, setChave] = useState('');
  const [versao, setVersao] = useState<Versao>(1);
  const [tratamento, setTratamento] = useState<Tratamento>('m');
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [simples, setSimples] = useState<ParteMensagem[]>([]);
  const [mudou, setMudou] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  const abrir = useCallback((m: Modelo | undefined) => {
    if (!m) return;
    const base = m.partes?.length ? m.partes : [{ rotulo: 'Mensagem', texto: m.texto }];
    setChave(m.chave);
    setEdicao(m.variacoes ? completarVariacoes(m.variacoes, base) : null);
    setSimples(base.map((p) => ({ ...p })));
    setMudou(false);
  }, []);

  const carregar = useCallback((manter?: string) => {
    supabase().from('modelos_mensagem').select('*').order('ordem').order('chave').then(({ data, error }) => {
      if (error) return setAviso({ tipo: 'erro', texto: error.message });
      const lista = (data as Modelo[]) ?? [];
      setModelos(lista);
      abrir(lista.find((m) => m.chave === manter) ?? lista[0]);
    });
  }, [abrir]);
  useEffect(() => {
    if (membro?.papel === 'admin') carregar();
  }, [membro, carregar]);

  if (carregando) return <Carregando />;
  if (membro?.papel !== 'admin') return <SemAcesso email={email} />;

  const modelo = modelos.find((m) => m.chave === chave);
  const partes = edicao ? edicao[String(versao)][tratamento] : simples;
  const mudarPartes = (f: (ps: ParteMensagem[]) => ParteMensagem[]) => {
    setMudou(true);
    if (!edicao) return setSimples(f);
    setEdicao({ ...edicao, [String(versao)]: { ...edicao[String(versao)], [tratamento]: f(edicao[String(versao)][tratamento]) } });
  };
  const outro: Tratamento = tratamento === 'm' ? 'f' : 'm';

  function trocarModelo(nova: string) {
    if (mudou && !window.confirm('Há mudanças não salvas nesta mensagem. Descartar?')) return;
    abrir(modelos.find((m) => m.chave === nova));
    setVersao(1);
  }

  async function salvar() {
    if (!modelo) return;
    // A versão 1 masculina também fica como texto base (usado se faltar alguma variação).
    const base = edicao ? edicao['1'].m.filter((p) => p.texto.trim() || p.rotulo.trim()) : simples;
    const { error } = await supabase().from('modelos_mensagem').update({
      partes: base, texto: juntar(base), ...(edicao ? { variacoes: edicao } : {}),
    }).eq('chave', modelo.chave);
    if (error) return setAviso({ tipo: 'erro', texto: `Não salvou: ${error.message}` });
    setAviso({ tipo: 'ok', texto: `“${modelo.titulo}” salva. Já vale nas fichas abertas a partir de agora.` });
    carregar(modelo.chave);
  }

  return (
    <Tela membro={membro}>
      <main className="pagina pilha pagina-escura" style={{ gap: 18 }}>
        <h1 style={{ fontSize: 28 }}>Mensagens prontas</h1>
        <p className="suave" style={{ margin: 0 }}>
          As mensagens dos checkpoints têm 3 versões, para o mesmo doador não receber o mesmo texto duas vezes: a ficha
          sugere a versão 1 na primeira mensagem do plano, a 2 na segunda e a 3 na terceira (versão em branco cai para a anterior).
          Cada versão tem o texto masculino e o feminino. A versão Iteano vale para doadores marcados como “Do ITA” na ficha.
        </p>
        {aviso && <p className={`aviso ${aviso.tipo}`}>{aviso.texto}</p>}

        <label className="campo" style={{ maxWidth: 420 }}>
          Mensagem
          <select value={chave} onChange={(e) => trocarModelo(e.target.value)}>
            {modelos.map((m) => <option key={m.chave} value={m.chave}>{m.titulo}{m.variacoes ? ' · checkpoint' : ''}</option>)}
          </select>
        </label>

        {edicao && (
          <div className="pilha" style={{ gap: 10 }}>
            <div className="abas-ficha" role="tablist" style={{ padding: 0 }}>
              {TODAS_VERSOES.map((n) => (
                <button key={n} type="button" role="tab" aria-selected={versao === n} onClick={() => setVersao(n)}>
                  {rotuloVersao(n)}{versaoPreenchida(edicao, n) ? '' : ' (em branco)'}
                </button>
              ))}
            </div>
            <div className="linha" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Tratamento">
              {TRATAMENTOS.map(([t, nome]) => (
                <button key={t} type="button" className={`botao pequeno ${tratamento === t ? '' : 'secundario'}`} aria-pressed={tratamento === t} onClick={() => setTratamento(t)}>
                  {nome}
                </button>
              ))}
              <button type="button" className="botao-link" onClick={() => mudarPartes(() => edicao[String(versao)][outro].map((p) => ({ ...p })))}>
                Copiar do {outro === 'm' ? 'masculino' : 'feminino'}
              </button>
            </div>
          </div>
        )}

        <ol className="pilha" style={{ gap: 12, paddingLeft: 20, margin: 0 }}>
          {partes.map((p, i) => (
            <li key={i} className="pilha" style={{ gap: 6 }}>
              <div className="linha" style={{ gap: 8 }}>
                <input
                  aria-label={`Nome da parte ${i + 1}`}
                  value={p.rotulo}
                  placeholder="Nome da parte (ex.: Agradecimento)"
                  onChange={(e) => mudarPartes((ps) => ps.map((x, j) => (j === i ? { ...x, rotulo: e.target.value } : x)))}
                  style={{ flex: 1 }}
                />
                <button type="button" className="botao secundario pequeno" disabled={i === 0} onClick={() => mudarPartes((ps) => { const n = [...ps]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })} aria-label="Subir parte">↑</button>
                <button type="button" className="botao secundario pequeno" onClick={() => mudarPartes((ps) => ps.filter((_, j) => j !== i))} aria-label="Remover parte">Remover</button>
              </div>
              <textarea
                aria-label={`Texto da parte ${i + 1}`}
                value={p.texto}
                rows={Math.min(8, Math.max(3, Math.ceil(p.texto.length / 80)))}
                placeholder={edicao && versao > 1 ? 'Em branco: escreva a versão desta parte' : ''}
                onChange={(e) => mudarPartes((ps) => ps.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)))}
              />
            </li>
          ))}
        </ol>
        <div className="linha" style={{ gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="botao secundario" onClick={() => mudarPartes((ps) => [...ps, { rotulo: '', texto: '' }])}>+ Parte</button>
          <button type="button" className="botao" onClick={salvar} disabled={!mudou}>Salvar mensagem</button>
        </div>

        <section className="pilha" style={{ gap: 4 }}>
          <strong className="pequeno">Campos que o portal preenche sozinho</strong>
          {VARIAVEIS.map(([v, d]) => <span key={v} className="pequeno suave"><code>{v}</code>: {d}</span>)}
        </section>
      </main>
    </Tela>
  );
}
