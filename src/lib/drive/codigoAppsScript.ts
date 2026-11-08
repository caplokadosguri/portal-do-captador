// Código da ponte com o Drive (Google Apps Script). A diretoria cola este
// código num projeto do Apps Script da conta da Captação e publica como
// "App da Web". Ele roda com a conta da Captação (que é dona das planilhas) e
// só aceita pedidos de quem está logado no portal com o perfil certo: confere
// o login direto no Supabase. Não guarda segredo nenhum.
//
// As planilhas usadas vêm da tabela "configuracoes" do portal (só o
// administrador altera). Mexe só nas colunas do portal; fórmulas, cores,
// listas e outras abas ficam como estão.

/** Muda quando o código abaixo muda: o portal avisa se a ponte publicada estiver velha. */
export const VERSAO_PONTE = 4;

const CODIGO = String.raw`/**
 * Portal do Captador · CASD — ponte com o Drive.
 * Cole este código num projeto do Apps Script da conta da Captação e publique
 * em Implantar > Nova implantação > App da Web
 * (Executar como: Eu · Quem pode acessar: Qualquer pessoa).
 * Para atualizar: cole o código novo, salve e vá em Implantar > Gerenciar
 * implantações > editar (lápis) > Versão: Nova versão > Implantar.
 */
var VERSAO = 4;
var SUPABASE_URL = '__SUPABASE_URL__';
var SUPABASE_CHAVE = '__SUPABASE_CHAVE__';

// Quem pode mexer em cada aba. Planilha que não está aqui: o administrador e
// o perfil de mesmo nome (ex.: planilha "eventos" -> perfil Eventos).
var PERMISSOES = {
  'editais': { '*': ['admin', 'editais'] },
  'projetos': { '*': ['admin', 'editais'] },
  'abordagem': {
    'inadimplentes': ['admin', 'doadores'],
    'parceriasedoacoespj': ['admin', 'parceiros'],
    '*': ['admin', 'doadores', 'parceiros']
  }
};

function doGet() {
  return resposta({ ok: true, servico: 'Portal do Captador - ponte com o Drive' });
}

/** Rode esta função uma vez no editor (Executar) para autorizar Planilhas, Drive e Documentos. */
function autorizarPonte() {
  // Pede de uma vez tudo o que ainda não foi autorizado (o Google pede por função, não por projeto).
  ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);
  SpreadsheetApp.flush();
  DriveApp.getRootFolder().getName();
  Logger.log('Ponte autorizada (' + typeof DocumentApp + ').');
}

function doPost(e) {
  try {
    var pedido = JSON.parse(e.postData.contents);
    var quem = conferirLogin(pedido.token);
    var abas = pedido.abas || [];
    autorizar(quem.papel, pedido.planilha, abas);
    var config = lerConfiguracoes(pedido.token);
    if (pedido.acao === 'documento') return resposta(gerarDocumento(config, pedido.documento || {}));
    var id = idDaPlanilha(config['drive_planilha_' + pedido.planilha]);
    if (!id) throw new Error('A planilha "' + pedido.planilha + '" ainda não foi ligada no portal (Início > Planilhas no Drive).');
    var ss = SpreadsheetApp.openById(id);
    var props = PropertiesService.getScriptProperties();

    if (pedido.acao === 'ler') {
      return resposta({
        ok: true, url: ss.getUrl(), nome: ss.getName(), ultima: props.getProperty('ultima_' + pedido.planilha),
        abas: abas.map(function (a) { return lerAba(ss, a); })
      });
    }
    if (pedido.acao === 'escrever') {
      var trava = LockService.getScriptLock();
      trava.waitLock(30000);
      try {
        var escritas = abas.map(function (a) { return escreverAba(ss, a); });
        SpreadsheetApp.flush();
        var agora = new Date().toISOString();
        props.setProperty('ultima_' + pedido.planilha, agora);
        return resposta({ ok: true, url: ss.getUrl(), nome: ss.getName(), ultima: agora, abas: escritas, por: quem.email });
      } finally {
        trava.releaseLock();
      }
    }
    throw new Error('Ação desconhecida: ' + pedido.acao);
  } catch (err) {
    var msg = String(err && err.message ? err.message : err);
    if (/permiss|authoriz|autoriza/i.test(msg) && /DriveApp|DocumentApp|SpreadsheetApp/.test(msg)) {
      msg = 'A ponte ainda não tem autorização para isso. No Apps Script, escolha a função autorizarPonte, clique em Executar e marque Selecionar tudo. (' + msg + ')';
    }
    return resposta({ ok: false, erro: msg });
  }
}

function resposta(obj) {
  obj.versao = VERSAO;
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// --- Login e permissões ------------------------------------------------------

function supabase(caminho, token) {
  var r = UrlFetchApp.fetch(SUPABASE_URL + caminho, {
    headers: { apikey: SUPABASE_CHAVE, Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  });
  if (r.getResponseCode() !== 200) throw new Error('Login do portal expirado ou inválido. Recarregue a página.');
  return JSON.parse(r.getContentText());
}

function conferirLogin(token) {
  if (!token) throw new Error('Sem login do portal.');
  var usuario = supabase('/auth/v1/user', token);
  var email = String(usuario.email || '').toLowerCase();
  var membros = supabase('/rest/v1/membros?select=papel,ativo&email=eq.' + encodeURIComponent(email), token);
  if (!membros.length || !membros[0].ativo) throw new Error('Este login não tem acesso liberado no portal.');
  return { email: email, papel: membros[0].papel };
}

function autorizar(papel, planilha, abas) {
  if (!/^[a-z]+$/.test(String(planilha))) throw new Error('Planilha desconhecida: ' + planilha);
  var regras = PERMISSOES[planilha] || { '*': ['admin', planilha] };
  var chaves = abas.length ? abas.map(function (a) { return chave(a.aba); }) : ['*'];
  chaves.forEach(function (k) {
    var ok = regras[k] || regras['*'];
    if (ok.indexOf(papel) < 0) throw new Error('O seu perfil não pode mexer nesta planilha.');
  });
}

function lerConfiguracoes(token) {
  var linhas = supabase('/rest/v1/configuracoes?select=chave,valor', token);
  var c = {};
  linhas.forEach(function (l) { c[l.chave] = l.valor; });
  return c;
}

function idDaPlanilha(link) {
  if (!link) return null;
  var m = /\/(?:d|folders)\/([a-zA-Z0-9_-]{20,})/.exec(link) || /[?&]id=([a-zA-Z0-9_-]{20,})/.exec(link);
  return m ? m[1] : (/^[a-zA-Z0-9_-]{20,}$/.test(link) ? link : null);
}

// --- Documentos (ex.: resumo de escopo de projeto) -------------------------------

/** Copia o modelo do Google Docs, troca os {{campos}} e devolve o link do documento novo. */
function gerarDocumento(config, d) {
  var nomeModelo = String(d.modelo || '');
  if (!/^[a-z_]+$/.test(nomeModelo)) throw new Error('Modelo de documento desconhecido.');
  var idModelo = idDaPlanilha(config['drive_doc_' + nomeModelo]);
  if (!idModelo) throw new Error('O modelo do documento ainda não foi ligado no portal (Início > Planilhas no Drive).');
  var modelo = DriveApp.getFileById(idModelo);
  if (modelo.getMimeType() !== MimeType.GOOGLE_DOCS) {
    throw new Error('O modelo "' + modelo.getName() + '" ainda é um arquivo Word. Abra no Drive, use Arquivo > Salvar como Documentos Google e cole o link da versão Google.');
  }
  if (d.testar) return { ok: true, url: modelo.getUrl(), nome: modelo.getName() };
  var idPasta = idDaPlanilha(config['drive_pasta_' + nomeModelo]);
  var pais = modelo.getParents();
  var pasta = idPasta ? DriveApp.getFolderById(idPasta) : (pais.hasNext() ? pais.next() : DriveApp.getRootFolder());
  var copia = modelo.makeCopy(String(d.nome || 'Documento').slice(0, 200), pasta);
  var doc = DocumentApp.openById(copia.getId());
  [doc.getBody(), doc.getHeader(), doc.getFooter()].forEach(function (parte) {
    if (parte) preencherCampos(parte, d.campos || {});
  });
  doc.saveAndClose();
  return { ok: true, url: copia.getUrl(), nome: copia.getName() };
}

function preencherCampos(parte, campos) {
  Object.keys(campos).forEach(function (k) {
    var valor = String(campos[k] == null || campos[k] === '' ? '—' : campos[k]).replace(/\{\{/g, '{ {');
    var padrao = '\\{\\{\\s*' + k.replace(/[^a-z0-9_]/gi, '') + '\\s*\\}\\}';
    var achado;
    while ((achado = parte.findText(padrao))) {
      var texto = achado.getElement().asText();
      var ini = achado.getStartOffset();
      texto.deleteText(ini, achado.getEndOffsetInclusive());
      texto.insertText(ini, valor);
    }
  });
}

// --- Cabeçalho -----------------------------------------------------------------

function chave(t) {
  return String(t == null ? '' : t).replace(/\([^)]*\)/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Para cada célula do cabeçalho, o índice da nossa coluna (ou -1). */
function casar(cabecalho, colunas) {
  var nomes = colunas.map(function (c) { return [c.titulo].concat(c.outros || []).map(chave); });
  var usadas = {};
  return cabecalho.map(function (cel) {
    var k = chave(cel);
    if (!k) return -1;
    var i = -1, j;
    for (j = 0; j < nomes.length; j++) if (!usadas[j] && nomes[j].indexOf(k) >= 0) { i = j; break; }
    if (i < 0 && k.length >= 4) {
      for (j = 0; j < nomes.length; j++) {
        if (usadas[j]) continue;
        if (nomes[j].some(function (n) { return n.length >= 4 && (k.indexOf(n) === 0 || n.indexOf(k) === 0); })) { i = j; break; }
      }
    }
    if (i >= 0) usadas[i] = true;
    return i;
  });
}

/** Acha a linha do cabeçalho nas 20 primeiras linhas. */
function acharCabecalho(aba, colunas) {
  var ultimaCol = Math.max(aba.getLastColumn(), 1);
  var n = Math.min(20, Math.max(aba.getLastRow(), 1));
  var textos = aba.getRange(1, 1, n, ultimaCol).getDisplayValues();
  for (var r = 0; r < n; r++) {
    var m = casar(textos[r], colunas);
    var achadas = m.filter(function (i) { return i >= 0; }).length;
    if (achadas >= Math.min(2, colunas.length)) return { linha: r + 1, mapa: m, textos: textos[r] };
  }
  return null;
}

// --- Leitura (para trazer itens da planilha para o portal) ---------------------

function lerAba(ss, a) {
  var aba = ss.getSheetByName(a.aba);
  if (!aba) return { aba: a.aba, existe: false, linhas: [] };
  var cab = acharCabecalho(aba, a.colunas);
  if (!cab) return { aba: a.aba, existe: true, cabecalho: false, linhas: [] };
  var ultima = aba.getLastRow();
  if (ultima <= cab.linha) return { aba: a.aba, existe: true, cabecalho: true, linhas: [], gid: aba.getSheetId() };
  var largura = cab.mapa.length;
  var valores = aba.getRange(cab.linha + 1, 1, ultima - cab.linha, largura).getValues();
  var formulas = aba.getRange(cab.linha + 1, 1, ultima - cab.linha, largura).getFormulas();
  var fuso = ss.getSpreadsheetTimeZone();
  var linhas = [];
  valores.forEach(function (lin, r) {
    var reg = {}, algo = false;
    cab.mapa.forEach(function (i, c) {
      if (i < 0 || formulas[r][c]) return;
      var v = lin[c];
      if (v === '' || v === null) return;
      if (v instanceof Date) v = Utilities.formatDate(v, fuso, 'yyyy-MM-dd');
      reg[a.colunas[i].titulo] = v;
      algo = true;
    });
    if (algo) linhas.push(reg);
  });
  return { aba: a.aba, existe: true, cabecalho: true, linhas: linhas, gid: aba.getSheetId() };
}

// --- Escrita -------------------------------------------------------------------

function paraCelula(v, tipo) {
  if (v === null || v === undefined) return '';
  if (tipo === 'data' && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    var p = v.slice(0, 10).split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  return v;
}

function letra(n) {
  var s = '';
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function escreverAba(ss, a) {
  var aba = ss.getSheetByName(a.aba);
  if (!aba) aba = ss.insertSheet(a.aba);
  var cab = acharCabecalho(aba, a.colunas);

  // Aba nova ou sem cabeçalho: cria o cabeçalho na primeira linha livre.
  if (!cab) {
    var linhaCab = aba.getLastRow() + 1;
    aba.getRange(linhaCab, 1, 1, a.colunas.length)
      .setValues([a.colunas.map(function (c) { return c.titulo; })])
      .setFontWeight('bold').setBackground('#12303d').setFontColor('#ffffff');
    aba.setFrozenRows(linhaCab);
    cab = acharCabecalho(aba, a.colunas);
  }

  // Colunas que faltam na planilha: entram depois da coluna indicada (ou no fim).
  a.colunas.forEach(function (c, i) {
    if (cab.mapa.indexOf(i) >= 0) return;
    var depois = c.depoisDe ? a.colunas.map(function (x) { return x.titulo; }).indexOf(c.depoisDe) : -1;
    var colDepois = depois >= 0 ? cab.mapa.indexOf(depois) + 1 : 0;
    if (colDepois > 0) aba.insertColumnAfter(colDepois);
    var col = colDepois > 0 ? colDepois + 1 : Math.max(aba.getLastColumn(), cab.mapa.length) + 1;
    if (col > aba.getMaxColumns()) aba.insertColumnsAfter(aba.getMaxColumns(), col - aba.getMaxColumns());
    var celCab = aba.getRange(cab.linha, col);
    if (colDepois <= 0 && col > 1) aba.getRange(cab.linha, col - 1).copyTo(celCab, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    celCab.setValue(c.titulo);
    if (c.tipo === 'data') aba.getRange(cab.linha + 1, col, Math.max(aba.getMaxRows() - cab.linha, 1), 1).setNumberFormat('dd/mm/yyyy');
    if (c.tipo === 'moeda') aba.getRange(cab.linha + 1, col, Math.max(aba.getMaxRows() - cab.linha, 1), 1).setNumberFormat('"R$" #,##0.00');
    cab = acharCabecalho(aba, a.colunas);
  });

  var h = cab.linha;
  var largura = Math.max(aba.getLastColumn(), cab.mapa.length);
  var ultimaAntes = aba.getLastRow();
  var linhas = a.linhas || [];
  var n = linhas.length;

  // Fórmulas do modelo (ex.: "Dias restantes"): colunas que não são nossas e
  // têm fórmula na primeira linha de dados.
  var primeira = h + 1 <= aba.getMaxRows() ? aba.getRange(h + 1, 1, 1, largura).getFormulas()[0] : [];

  var inicio = h + 1;
  var extras = {}, extrasCols = [];
  // Colunas que identificam a linha (padrão: a primeira). Ex.: Evento + Descrição nos gastos.
  var titulosA = a.colunas.map(function (x) { return x.titulo; });
  var idxChave = (a.chave && a.chave.length ? a.chave : [titulosA[0]]).map(function (t) { return titulosA.indexOf(t); })
    .filter(function (i) { return i >= 0; });
  if (a.modo === 'diario') {
    // Uma linha por dia: se a última já é de hoje, reescreve; senão, acrescenta.
    var colData = cab.mapa.indexOf(0) + 1;
    var ultimaCheia = h;
    if (ultimaAntes > h) {
      var col1 = aba.getRange(h + 1, colData, ultimaAntes - h, 1).getValues();
      for (var r = col1.length - 1; r >= 0; r--) if (col1[r][0] !== '' && col1[r][0] !== null) { ultimaCheia = h + 1 + r; break; }
    }
    inicio = ultimaCheia + 1;
    if (ultimaCheia > h && n) {
      var v = aba.getRange(ultimaCheia, colData).getValue();
      var hoje = String(linhas[0][0]).slice(0, 10);
      if (v instanceof Date && Utilities.formatDate(v, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd') === hoje) inicio = ultimaCheia;
    }
  } else if (ultimaAntes > h) {
    // Substituir. Colunas que só existem na planilha (anotações da equipe)
    // acompanham o item pela primeira coluna do portal (ex.: nome do edital).
    cab.mapa.forEach(function (i, c) {
      if (i < 0 && !primeira[c] && String(cab.textos[c] || '').trim()) extrasCols.push(c);
    });
    if (extrasCols.length && idxChave.every(function (i) { return cab.mapa.indexOf(i) >= 0; })) {
      aba.getRange(h + 1, 1, ultimaAntes - h, largura).getValues().forEach(function (lin) {
        var k = idxChave.map(function (i) { return chave(lin[cab.mapa.indexOf(i)]); }).join('|');
        if (!k) return;
        var reg = {}, algo = false;
        extrasCols.forEach(function (c) { if (lin[c] !== '' && lin[c] !== null) { reg[c] = lin[c]; algo = true; } });
        if (algo) extras[k] = reg;
      });
    }
    // Desfaz mesclas e apaga o conteúdo (não a formatação) das colunas sem fórmula.
    aba.getRange(h + 1, 1, ultimaAntes - h, largura).breakApart();
    cab.mapa.forEach(function (i, c) {
      if ((i >= 0 || extrasCols.indexOf(c) >= 0) && !primeira[c]) aba.getRange(h + 1, c + 1, ultimaAntes - h, 1).clearContent();
    });
  }

  if (!n) return { aba: a.aba, linhas: 0, gid: aba.getSheetId() };
  var fim = inicio + n - 1;
  if (fim > aba.getMaxRows()) aba.insertRowsAfter(aba.getMaxRows(), fim - aba.getMaxRows());

  // Linhas novas além das que o modelo já tinha: copiam formato e listas da primeira linha de dados.
  if (fim > ultimaAntes && ultimaAntes > h) {
    var de = Math.max(ultimaAntes + 1, inicio);
    var molde = aba.getRange(h + 1, 1, 1, largura);
    molde.copyTo(aba.getRange(de, 1, fim - de + 1, largura), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    molde.copyTo(aba.getRange(de, 1, fim - de + 1, largura), SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
  }

  cab.mapa.forEach(function (i, c) {
    if (i < 0) return;
    var col = a.colunas[i];
    var faixa = aba.getRange(inicio, c + 1, n, 1);
    if (primeira[c]) return; // a planilha já tem fórmula própria nesta coluna
    if (col.formula) {
      faixa.setFormulas(linhas.map(function (_, k) {
        var linha = inicio + k;
        return ['=' + col.formula.replace(/\{\{([^}]+)\}\}/g, function (_t, titulo) {
          var j = a.colunas.map(function (x) { return x.titulo; }).indexOf(titulo);
          var pos = j >= 0 ? cab.mapa.indexOf(j) : -1;
          return pos >= 0 ? letra(pos + 1) + linha : '""';
        })];
      }));
      return;
    }
    faixa.setValues(linhas.map(function (l) { return [paraCelula(l[i], col.tipo)]; }));
  });

  // Devolve as anotações das colunas que só existem na planilha.
  if (extrasCols.length) {
    linhas.forEach(function (l, k) {
      var reg = extras[idxChave.map(function (i) { return chave(l[i]); }).join('|')];
      if (reg) Object.keys(reg).forEach(function (c) { aba.getRange(inicio + k, Number(c) + 1).setValue(reg[c]); });
    });
  }

  // Estende as fórmulas do modelo até a última linha escrita.
  primeira.forEach(function (f, c) {
    if (!f || fim <= h + 1) return;
    aba.getRange(h + 1, c + 1).copyTo(aba.getRange(h + 2, c + 1, fim - h - 1, 1), SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);
  });

  (a.ajustes || []).forEach(function (aj) {
    var cel = aba.getRange(aj.celula);
    var atual = String(cel.getDisplayValue());
    var pos = atual.toLowerCase().indexOf(String(aj.depoisDe).toLowerCase());
    if (pos >= 0) cel.setValue(atual.slice(0, pos + aj.depoisDe.length) + ' ' + aj.texto);
  });

  return { aba: a.aba, linhas: n, gid: aba.getSheetId() };
}
`;

export function codigoAppsScript(supabaseUrl: string, chave: string): string {
  return CODIGO.replace('__SUPABASE_URL__', supabaseUrl).replace('__SUPABASE_CHAVE__', chave);
}
