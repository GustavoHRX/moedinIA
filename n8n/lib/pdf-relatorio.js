// FONTE do gerador de PDF que roda dentro do Code node "Montar PDF" do workflow
// n8n/workflow/moedin-agente-v2.json.
//
// Este arquivo existe para o código ser legível, revisável e testável fora do
// JSON do workflow (lá ele vira uma string de uma linha só). Editar aqui NÃO
// altera o workflow: é preciso regerar o JSON e publicar no n8n.
//
// Para testar sozinho:
//   node -e "const {construirPdfRelatorio}=require('./n8n/lib/pdf-relatorio.js'); \
//            require('fs').writeFileSync('/tmp/r.pdf', construirPdfRelatorio(DADOS))"
// onde DADOS é o retorno da RPC whatsapp_report_pdf_data.
//
function construirPdfRelatorio(d) {
  const LARG = 595.28, ALT = 841.89, MARGEM = 48;
  const VERDE = [0.063, 0.725, 0.506];      // #10B981, verde da marca
  const ESCURO = [0.106, 0.149, 0.196];
  const CINZA = [0.42, 0.45, 0.50];
  const CINZA_CLARO = [0.93, 0.94, 0.95];
  const VERMELHO = [0.86, 0.25, 0.25];

  const paginas = [];
  let ops = [];
  let y = 0;

  const esc = (s) => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  // O WinAnsiEncoding é Latin-1 MAIS um punhado de caracteres nas posições
  // 0x80-0x9F (travessão, aspas curvas, bullet, reticências, euro). Sem este
  // mapa, um simples travessão viraria lixo. O que sobrar fora da tabela
  // (emoji, por exemplo) é removido, porque a Helvetica não tem esses glifos.
  const WIN_ANSI = { '\u20AC': '\x80', '\u201A': '\x82', '\u0192': '\x83', '\u201E': '\x84',
    '\u2026': '\x85', '\u2020': '\x86', '\u2021': '\x87', '\u02C6': '\x88', '\u2030': '\x89',
    '\u0160': '\x8A', '\u2039': '\x8B', '\u0152': '\x8C', '\u017D': '\x8E', '\u2018': '\x91',
    '\u2019': '\x92', '\u201C': '\x93', '\u201D': '\x94', '\u2022': '\x95', '\u2013': '\x96',
    '\u2014': '\x97', '\u02DC': '\x98', '\u2122': '\x99', '\u0161': '\x9A', '\u203A': '\x9B',
    '\u0153': '\x9C', '\u017E': '\x9E', '\u0178': '\x9F' };
  const paraLatin1 = (s) => String(s == null ? '' : s).normalize('NFC')
    .replace(/[\u0152\u0153\u0160\u0161\u0178\u017D\u017E\u0192\u02C6\u02DC\u2013\u2014\u2018\u2019\u201A\u201C\u201D\u201E\u2020\u2021\u2022\u2026\u2030\u2039\u203A\u20AC\u2122]/g, (ch) => WIN_ANSI[ch])
    .replace(/[^\x20-\xFF]/g, '').trim();

  // Larguras da Helvetica (unidades/1000) — só o suficiente para medir e cortar texto.
  const L_MED = 0.5, L_ESTREITO = 0.28;
  function largura(txt, tam, negrito) {
    let w = 0;
    for (const ch of String(txt)) {
      if (' iltjfIr.,:;!|\'`'.includes(ch)) w += L_ESTREITO;
      else if ('mwMW@'.includes(ch)) w += 0.83;
      else if (ch >= '0' && ch <= '9') w += 0.556;
      else w += L_MED + 0.056;
    }
    return w * tam * (negrito ? 1.06 : 1);
  }
  function cortar(txt, tam, negrito, max) {
    let s = paraLatin1(txt);
    if (largura(s, tam, negrito) <= max) return s;
    while (s.length > 1 && largura(s + '...', tam, negrito) > max) s = s.slice(0, -1);
    return s + '...';
  }

  function cor(c, preenche) {
    ops.push(c[0].toFixed(3) + ' ' + c[1].toFixed(3) + ' ' + c[2].toFixed(3) + ' ' + (preenche ? 'rg' : 'RG'));
  }
  function texto(txt, x, yy, tam, negrito, c) {
    cor(c || ESCURO, true);
    ops.push('BT /' + (negrito ? 'F2' : 'F1') + ' ' + tam + ' Tf ' + x.toFixed(2) + ' ' + yy.toFixed(2) + ' Td (' + esc(paraLatin1(txt)) + ') Tj ET');
  }
  function textoDireita(txt, xDir, yy, tam, negrito, c) {
    const t = paraLatin1(txt);
    texto(t, xDir - largura(t, tam, negrito), yy, tam, negrito, c);
  }
  function retangulo(x, yy, w, h, c) {
    cor(c, true);
    ops.push(x.toFixed(2) + ' ' + yy.toFixed(2) + ' ' + w.toFixed(2) + ' ' + h.toFixed(2) + ' re f');
  }
  function linha(x1, y1, x2, y2, c, esp) {
    cor(c || CINZA_CLARO, false);
    ops.push((esp || 0.6).toFixed(2) + ' w ' + x1.toFixed(2) + ' ' + y1.toFixed(2) + ' m ' + x2.toFixed(2) + ' ' + y2.toFixed(2) + ' l S');
  }

  function fecharPagina() { if (ops.length) { paginas.push(ops.join('\n')); ops = []; } }
  function novaPagina(comCabecalho) {
    fecharPagina();
    if (comCabecalho) {
      retangulo(0, ALT - 86, LARG, 86, VERDE);
      texto('Moedin.IA', MARGEM, ALT - 46, 22, true, [1, 1, 1]);
      texto('Relatório de ' + d.titulo_mes, MARGEM, ALT - 68, 12, false, [1, 1, 1]);
      textoDireita(d.nome || '', LARG - MARGEM, ALT - 46, 11, true, [1, 1, 1]);
      textoDireita(d.periodo || '', LARG - MARGEM, ALT - 64, 9, false, [1, 1, 1]);
      y = ALT - 116;
    } else {
      retangulo(0, ALT - 34, LARG, 34, VERDE);
      texto('Moedin.IA  ·  ' + d.titulo_mes, MARGEM, ALT - 22, 10, true, [1, 1, 1]);
      y = ALT - 62;
    }
  }
  function garantirEspaco(precisa) { if (y - precisa < 64) novaPagina(false); }

  const dinheiro = (v) => {
    const n = Number(v || 0);
    const s = Math.abs(n).toFixed(2).split('.');
    return (n < 0 ? '-' : '') + 'R$ ' + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + s[1];
  };

  // ---- página 1 -----------------------------------------------------------
  novaPagina(true);

  // Cartões de resumo
  const largCartao = (LARG - MARGEM * 2 - 16) / 3;
  const cartoes = [
    ['Receitas', dinheiro(d.receitas), VERDE],
    ['Despesas', dinheiro(d.despesas), VERMELHO],
    ['Saldo', dinheiro(d.saldo), Number(d.saldo) >= 0 ? VERDE : VERMELHO],
  ];
  cartoes.forEach((c, i) => {
    const x = MARGEM + i * (largCartao + 8);
    retangulo(x, y - 54, largCartao, 54, CINZA_CLARO);
    retangulo(x, y - 54, 3, 54, c[2]);
    texto(c[0], x + 12, y - 20, 9, false, CINZA);
    texto(c[1], x + 12, y - 42, 14, true, c[2]);
  });
  y -= 78;

  if (d.limite != null) {
    const pct = Number(d.limite) > 0 ? Math.min(150, Math.round(Number(d.despesas) / Number(d.limite) * 100)) : 0;
    texto('Limite do mês', MARGEM, y, 10, true);
    textoDireita(dinheiro(d.despesas) + ' de ' + dinheiro(d.limite) + '  (' + pct + '%)', LARG - MARGEM, y, 10, false, pct >= 100 ? VERMELHO : CINZA);
    y -= 12;
    retangulo(MARGEM, y - 8, LARG - MARGEM * 2, 8, CINZA_CLARO);
    retangulo(MARGEM, y - 8, (LARG - MARGEM * 2) * Math.min(1, pct / 100), 8, pct >= 100 ? VERMELHO : VERDE);
    y -= 30;
  }

  // Gastos por categoria
  const cats = Array.isArray(d.categorias) ? d.categorias : [];
  if (cats.length) {
    garantirEspaco(40);
    texto('Gastos por categoria', MARGEM, y, 13, true);
    y -= 20;
    const maior = Math.max.apply(null, cats.map((c) => Number(c.total) || 0).concat([1]));
    for (const c of cats) {
      garantirEspaco(30);
      const v = Number(c.total) || 0;
      texto(cortar(c.categoria, 10, false, 220), MARGEM, y, 10, false);
      textoDireita(dinheiro(v) + '   ' + (c.pct || 0) + '%', LARG - MARGEM, y, 10, true);
      y -= 10;
      const larguraBarra = (LARG - MARGEM * 2) * (v / maior);
      retangulo(MARGEM, y - 5, LARG - MARGEM * 2, 5, CINZA_CLARO);
      retangulo(MARGEM, y - 5, larguraBarra, 5, c.limite != null && v >= Number(c.limite) ? VERMELHO : VERDE);
      if (c.limite != null) {
        const xLim = MARGEM + (LARG - MARGEM * 2) * Math.min(1, Number(c.limite) / maior);
        linha(xLim, y - 7, xLim, y + 2, ESCURO, 1);
        texto('limite ' + dinheiro(c.limite), MARGEM, y - 16, 7, false, CINZA);
        y -= 10;
      }
      y -= 21;
    }
    y -= 6;
  }

  // Metas
  const metas = Array.isArray(d.metas) ? d.metas : [];
  if (metas.length) {
    garantirEspaco(44);
    texto('Metas', MARGEM, y, 13, true);
    y -= 20;
    for (const m of metas) {
      garantirEspaco(26);
      texto(cortar(m.titulo, 10, false, 240), MARGEM, y, 10, false);
      textoDireita(dinheiro(m.atual) + ' de ' + dinheiro(m.alvo) + '   ' + (m.pct || 0) + '%', LARG - MARGEM, y, 9, false, CINZA);
      y -= 10;
      retangulo(MARGEM, y - 5, LARG - MARGEM * 2, 5, CINZA_CLARO);
      retangulo(MARGEM, y - 5, (LARG - MARGEM * 2) * Math.min(1, (Number(m.pct) || 0) / 100), 5, VERDE);
      y -= 22;
    }
    y -= 6;
  }

  // Lançamentos
  const itens = Array.isArray(d.lancamentos) ? d.lancamentos : [];
  if (itens.length) {
    garantirEspaco(50);
    texto('Lançamentos do período (' + itens.length + ')', MARGEM, y, 13, true);
    y -= 18;
    const colData = MARGEM, colDesc = MARGEM + 42, colCat = 348, colValor = LARG - MARGEM;
    const cabecalho = () => {
      texto('Data', colData, y, 8, true, CINZA);
      texto('Descrição', colDesc, y, 8, true, CINZA);
      texto('Categoria', colCat, y, 8, true, CINZA);
      textoDireita('Valor', colValor, y, 8, true, CINZA);
      y -= 5;
      linha(MARGEM, y, LARG - MARGEM, y);
      y -= 12;
    };
    cabecalho();
    let listra = false;
    for (const it of itens) {
      if (y - 14 < 64) { novaPagina(false); texto('Lançamentos (continuação)', MARGEM, y, 11, true); y -= 20; cabecalho(); listra = false; }
      if (listra) retangulo(MARGEM - 4, y - 4, LARG - MARGEM * 2 + 8, 14, [0.975, 0.98, 0.985]);
      listra = !listra;
      const receita = it.tipo === 'income';
      texto(it.data, colData, y, 8.5, false, CINZA);
      texto(cortar(it.descricao, 8.5, false, colCat - colDesc - 10), colDesc, y, 8.5, false);
      texto(cortar(it.categoria, 8, false, 92), colCat, y, 8, false, CINZA);
      textoDireita((receita ? '+ ' : '- ') + dinheiro(it.valor), colValor, y, 8.5, true, receita ? VERDE : ESCURO);
      y -= 14;
    }
  } else {
    texto('Nenhum lançamento no período.', MARGEM, y, 10, false, CINZA);
    y -= 16;
  }

  fecharPagina();

  // ---- montagem do arquivo ------------------------------------------------
  const objetos = [];
  const nPaginas = paginas.length;
  const idPrimeiraPagina = 5;
  const kids = [];
  for (let i = 0; i < nPaginas; i++) kids.push((idPrimeiraPagina + i * 2) + ' 0 R');

  objetos[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objetos[2] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + nPaginas + ' >>';
  objetos[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objetos[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  paginas.forEach((conteudo, i) => {
    const idPag = idPrimeiraPagina + i * 2;
    objetos[idPag] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + LARG.toFixed(2) + ' ' + ALT.toFixed(2) +
      '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + (idPag + 1) + ' 0 R >>';
    objetos[idPag + 1] = { fluxo: conteudo };
  });

  let pdf = Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1');
  const deslocamentos = [];
  for (let i = 1; i < objetos.length; i++) {
    const o = objetos[i];
    if (o === undefined) continue;
    deslocamentos[i] = pdf.length;
    let corpo;
    if (typeof o === 'object' && o.fluxo != null) {
      const fluxo = Buffer.from(o.fluxo, 'latin1');
      corpo = Buffer.concat([
        Buffer.from(i + ' 0 obj\n<< /Length ' + fluxo.length + ' >>\nstream\n', 'latin1'),
        fluxo,
        Buffer.from('\nendstream\nendobj\n', 'latin1'),
      ]);
    } else {
      corpo = Buffer.from(i + ' 0 obj\n' + o + '\nendobj\n', 'latin1');
    }
    pdf = Buffer.concat([pdf, corpo]);
  }

  const inicioXref = pdf.length;
  const total = objetos.length;
  let xref = 'xref\n0 ' + total + '\n0000000000 65535 f \n';
  for (let i = 1; i < total; i++) {
    xref += (deslocamentos[i] === undefined ? 0 : deslocamentos[i]).toString().padStart(10, '0') + ' 00000 n \n';
  }
  xref += 'trailer\n<< /Size ' + total + ' /Root 1 0 R >>\nstartxref\n' + inicioXref + '\n%%EOF\n';
  pdf = Buffer.concat([pdf, Buffer.from(xref, 'latin1')]);
  return pdf;
}

module.exports = { construirPdfRelatorio };
