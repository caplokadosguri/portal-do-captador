'use client';

import { useState } from 'react';
import Cabecalho, { Carregando, SemAcesso } from '@/components/Cabecalho';
import { useMembro } from '@/lib/membro';
import { decodificar, lerRelatorio, ResultadoLeitura, separarDoacoes, TipoRelatorio } from '@/lib/relatorios';
import { supabase } from '@/lib/supabase/cliente';

const RELATORIOS: { tipo: TipoRelatorio; titulo: string; ajuda: string }[] = [
  { tipo: 'doacoes', titulo: 'Relatório de doações', ajuda: 'Doadores, valor, frequência e data de início. Importe primeiro.' },
  { tipo: 'cobrancas', titulo: 'Relatório de cobranças', ajuda: 'Pagamentos mês a mês e motivo de cada falha.' },
  { tipo: 'doadores', titulo: 'Relatório de doadores', ajuda: 'Aceite de contato por canal (e-mail, WhatsApp, cartas…).' },
];

async function enviarEmLotes(tabela: string, linhas: Record<string, unknown>[]) {
  for (let i = 0; i < linhas.length; i += 500) {
    const { error } = await supabase().from(tabela).upsert(linhas.slice(i, i + 500), { onConflict: 'id' });
    if (error) throw new Error(`${tabela}: ${error.message}`);
  }
}

function Bloco({ tipo, titulo, ajuda }: (typeof RELATORIOS)[number]) {
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [leitura, setLeitura] = useState<ResultadoLeitura | null>(null);
  const [estado, setEstado] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setEstado(null);
    if (!f) return;
    setArquivo(f.name);
    // O arquivo é lido aqui no navegador; só as colunas permitidas seguem para o banco.
    setLeitura(lerRelatorio(tipo, decodificar(await f.arrayBuffer())));
  }

  async function importar() {
    if (!leitura) return;
    setEnviando(true);
    try {
      const now = new Date().toISOString();
      if (tipo === 'doacoes') {
        const { doadores, doacoes } = separarDoacoes(leitura.linhas);
        await enviarEmLotes('doadores', doadores.map((d) => ({ ...d, importado_em: now })));
        await enviarEmLotes('doacoes', doacoes.map((d) => ({ ...d, importado_em: now })));
      } else {
        await enviarEmLotes(tipo, leitura.linhas.map((l) => ({ ...l, importado_em: now })));
      }
      await supabase().from('importacoes').insert({
        tipo, arquivo, linhas_lidas: leitura.linhasLidas, linhas_ok: leitura.linhas.length, erros: leitura.erros.slice(0, 200),
      });
      setEstado({ tipo: 'ok', texto: `${leitura.linhas.length} linhas importadas.` });
      setLeitura(null);
    } catch (e) {
      setEstado({ tipo: 'erro', texto: (e as Error).message });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="cartao pilha">
      <h2 style={{ fontSize: 20 }}>{titulo}</h2>
      <p className="suave pequeno" style={{ margin: 0 }}>{ajuda}</p>
      <label className="campo">
        Arquivo CSV exportado da Trackmob
        <input type="file" accept=".csv,text/csv" onChange={escolher} />
      </label>
      {leitura && leitura.colunasFaltando.length > 0 && (
        <p className="aviso erro">Faltam colunas: {leitura.colunasFaltando.join(', ')}. Confira se é o relatório certo.</p>
      )}
      {leitura && leitura.colunasFaltando.length === 0 && (
        <div className="pilha" style={{ gap: 8 }}>
          <p className="aviso">
            {leitura.linhas.length} de {leitura.linhasLidas} linhas prontas. {leitura.colunasDescartadas} colunas serão
            descartadas (documento, endereço, banco, UTMs…).
            {leitura.erros.length > 0 && ` ${leitura.erros.length} linhas sem ID ficam de fora (primeira: linha ${leitura.erros[0].linha}).`}
          </p>
          <button type="button" className="botao" style={{ alignSelf: 'flex-start' }} onClick={importar} disabled={enviando || !leitura.linhas.length}>
            {enviando ? 'Importando…' : 'Importar'}
          </button>
        </div>
      )}
      {estado && <p className={`aviso ${estado.tipo}`} role="status">{estado.texto}</p>}
    </section>
  );
}

export default function Importar() {
  const { carregando, membro, email } = useMembro();
  if (carregando) return <Carregando />;
  if (membro?.papel !== 'admin') return <SemAcesso email={email} />;
  return (
    <>
      <Cabecalho membro={membro} />
      <main className="pagina pilha" style={{ gap: 20 }}>
        <h1 style={{ fontSize: 28 }}>Importar relatórios da Trackmob</h1>
        <p className="suave" style={{ margin: 0 }}>
          Exporte os relatórios em CSV e importe aqui, de preferência toda semana. Importar de novo atualiza os doadores existentes
          pelo ID da Trackmob, sem duplicar. Anotações e histórico de contatos do portal nunca são apagados.
        </p>
        {RELATORIOS.map((r) => <Bloco key={r.tipo} {...r} />)}
      </main>
    </>
  );
}
