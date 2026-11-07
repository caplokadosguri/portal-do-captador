'use client';

import { useRef, useState } from 'react';
import { chaveNome } from '@/lib/importarPlanilha';

/**
 * "Importar do Drive": lê a planilha atual (baixada do Drive como .xlsx),
 * mostra quantos itens são novos e grava só esses depois da confirmação.
 */
export default function BotaoImportar<T>({
  ler,
  nomeDe,
  existentes,
  gravar,
  aoTerminar,
}: {
  ler: (arquivo: ArrayBuffer) => Promise<T[] | null>;
  nomeDe: (item: T) => string;
  existentes: string[];
  gravar: (novos: T[]) => Promise<void>;
  aoTerminar: () => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [pendente, setPendente] = useState<{ novos: T[]; repetidos: number } | null>(null);
  const [msg, setMsg] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function escolher(f: File) {
    setMsg(null);
    try {
      const itens = await ler(await f.arrayBuffer());
      if (!itens) return setMsg({ texto: 'Este arquivo não parece ser o modelo do CASD (não achei a aba e o cabeçalho).', erro: true });
      const ja = new Set(existentes.map(chaveNome));
      const vistos = new Set<string>();
      const novos = itens.filter((i) => {
        const k = chaveNome(nomeDe(i));
        if (ja.has(k) || vistos.has(k)) return false;
        vistos.add(k);
        return true;
      });
      if (!novos.length) return setMsg({ texto: `Nada novo: os ${itens.length} itens do arquivo já estão no portal.` });
      setPendente({ novos, repetidos: itens.length - novos.length });
    } catch (e) {
      setMsg({ texto: `Não deu para ler: ${(e as Error).message}`, erro: true });
    }
  }

  async function confirmar() {
    if (!pendente) return;
    setOcupado(true);
    try {
      await gravar(pendente.novos);
      setMsg({ texto: `${pendente.novos.length} importado(s).` });
      setPendente(null);
      aoTerminar();
    } catch (e) {
      setMsg({ texto: `Não gravou: ${(e as Error).message}`, erro: true });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <span className="botao-planilha">
      <button type="button" className="botao secundario" onClick={() => entrada.current?.click()} disabled={ocupado}>
        ⇩ Importar do Drive
      </button>
      <input
        ref={entrada}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) escolher(f);
        }}
      />
      {pendente && (
        <span className="aviso pequeno" role="status">
          {pendente.novos.length} novo(s) para trazer ao portal{pendente.repetidos ? ` (${pendente.repetidos} já estavam)` : ''}:{' '}
          {pendente.novos.slice(0, 4).map(nomeDe).join('; ')}{pendente.novos.length > 4 ? '…' : ''}
          <span className="linha" style={{ gap: 8, marginTop: 8 }}>
            <button type="button" className="botao pequeno" onClick={confirmar} disabled={ocupado}>{ocupado ? 'Importando…' : 'Importar'}</button>
            <button type="button" className="botao secundario pequeno" onClick={() => setPendente(null)}>Cancelar</button>
          </span>
        </span>
      )}
      {msg && <span className={`pequeno ${msg.erro ? 'texto-erro' : 'suave'}`} role="status">{msg.texto}</span>}
    </span>
  );
}
