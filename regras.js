/*
 * Regras do app (sem tela): datas, status da mensalidade, totais do mês,
 * mensagem do WhatsApp, cópia de segurança e planilha.
 * Funciona no navegador (window.Regras) e no Node (require) para os testes.
 */
(function (raiz) {
  'use strict';

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
    'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  var MODELO_COBRANCA = [
    'Olá, {contato}! Tudo bem?',
    'Passando para lembrar da mensalidade da natação de {aluno}, referente a {mes}.',
    'Vencimento: {vencimento}',
    'Valor: {valor}',
    'Chave Pix: {pix}',
    'Se já pagou, por favor desconsidere esta mensagem. Obrigada!',
    '{professora}'
  ].join('\n');

  var MODELO_LEMBRETE = [
    'Olá, {contato}! Tudo bem?',
    'Lembrete: a mensalidade da natação de {aluno} ({mes}) vence em {vencimento}.',
    'Valor: {valor}',
    'Chave Pix: {pix}',
    'Obrigada!',
    '{professora}'
  ].join('\n');

  var CAMPOS_MENSAGEM = {
    contato: 'primeiro nome do responsável (ou do aluno, se não houver responsável)',
    aluno: 'primeiro nome do aluno',
    aluno_completo: 'nome completo do aluno',
    responsavel: 'nome completo do responsável',
    mes: 'mês da mensalidade (ex.: novembro/2026)',
    valor: 'valor (ex.: R$ 150,00)',
    vencimento: 'data de vencimento (ex.: 10/11/2026)',
    dias_atraso: 'dias de atraso',
    pix: 'sua chave Pix',
    professora: 'seu nome',
    condominio: 'nome do condomínio'
  };

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // ---------- datas ----------
  function hojeISO(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function mesDe(iso) { return String(iso).slice(0, 7); }
  function partesMes(mes) {
    var p = String(mes).split('-');
    return { ano: Number(p[0]), mes: Number(p[1]) };
  }
  function mesValido(mes) {
    if (!/^\d{4}-\d{2}$/.test(String(mes))) return false;
    var m = partesMes(mes).mes;
    return m >= 1 && m <= 12;
  }
  function diasNoMes(mes) {
    var p = partesMes(mes);
    return new Date(Date.UTC(p.ano, p.mes, 0)).getUTCDate();
  }
  function somarMeses(mes, n) {
    var p = partesMes(mes);
    var t = p.ano * 12 + (p.mes - 1) + n;
    return Math.floor(t / 12) + '-' + pad((t % 12) + 1);
  }
  function diaValido(dia) {
    return typeof dia === 'number' && Math.floor(dia) === dia && dia >= 1 && dia <= 31;
  }
  /** Vencimento do mês. Dia 29/30/31 em mês curto cai no último dia do mês. */
  function vencimentoNoMes(mes, dia) {
    if (!diaValido(dia)) return null;
    return mes + '-' + pad(Math.min(dia, diasNoMes(mes)));
  }
  function utc(iso) {
    var p = String(iso).split('-').map(Number);
    return Date.UTC(p[0], p[1] - 1, p[2]);
  }
  /** Dias de a até b (b - a). */
  function diffDias(a, b) { return Math.round((utc(b) - utc(a)) / 86400000); }

  function nomeMes(mes) {
    var p = partesMes(mes);
    return MESES[p.mes - 1] + '/' + p.ano;
  }
  function nomeMesTitulo(mes) {
    var p = partesMes(mes);
    var n = MESES[p.mes - 1];
    return n.charAt(0).toUpperCase() + n.slice(1) + ' ' + p.ano;
  }
  function formatarData(iso) {
    if (!iso) return '';
    var p = String(iso).slice(0, 10).split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  function formatarDataCurta(iso) {
    if (!iso) return '';
    var p = String(iso).slice(0, 10).split('-');
    return p[2] + '/' + p[1];
  }

  // ---------- dinheiro ----------
  function formatarMoeda(v) {
    if (v === null || v === undefined || v === '' || isNaN(v)) return '';
    var neg = v < 0;
    var c = Math.round(Math.abs(v) * 100);
    var inteiro = String(Math.floor(c / 100));
    var cent = pad(c % 100);
    inteiro = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '-' : '') + 'R$ ' + inteiro + ',' + cent;
  }
  /** "150", "150,00", "1.250,50", "R$ 150" -> número. Vazio -> null. Inválido -> NaN. */
  function lerValor(texto) {
    if (texto === null || texto === undefined) return null;
    if (typeof texto === 'number') return isFinite(texto) && texto >= 0 ? texto : NaN;
    var s = String(texto).replace(/R\$/i, '').replace(/\s/g, '');
    if (s === '') return null;
    if (s.indexOf(',') >= 0) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
      s = s.replace(/\./g, '');
    }
    if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
    var v = Number(s);
    return Math.round(v * 100) / 100;
  }

  // ---------- estado ----------
  function novoId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function configPadrao() {
    return {
      nome: '',
      chavePix: '',
      diasAviso: 3,
      modeloCobranca: MODELO_COBRANCA,
      modeloLembrete: MODELO_LEMBRETE
    };
  }
  function estadoVazio() {
    return {
      formato: 1,
      config: configPadrao(),
      condominios: [],
      alunos: [],
      pagamentos: [],
      avisos: {},
      ultimoBackup: null
    };
  }
  function textoOuVazio(v) { return v === null || v === undefined ? '' : String(v); }
  function numeroOuNulo(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = typeof v === 'number' ? v : lerValor(v);
    return typeof n === 'number' && isFinite(n) ? n : null;
  }
  function diaOuNulo(v) {
    var n = Number(v);
    return v !== null && v !== '' && diaValido(n) ? n : null;
  }

  /** Completa campos que faltam (dados antigos ou importados). Lança erro se a estrutura não servir. */
  function normalizarEstado(e, hoje) {
    if (!e || typeof e !== 'object') throw new Error('Arquivo sem dados.');
    var mesHoje = mesDe(hoje || hojeISO());
    var r = estadoVazio();
    var cfg = e.config && typeof e.config === 'object' ? e.config : {};
    r.config = {
      nome: textoOuVazio(cfg.nome),
      chavePix: textoOuVazio(cfg.chavePix),
      diasAviso: diaOuNulo(cfg.diasAviso) || (cfg.diasAviso === 0 ? 0 : 3),
      modeloCobranca: cfg.modeloCobranca ? String(cfg.modeloCobranca) : MODELO_COBRANCA,
      modeloLembrete: cfg.modeloLembrete ? String(cfg.modeloLembrete) : MODELO_LEMBRETE
    };
    if (!Array.isArray(e.condominios) || !Array.isArray(e.alunos)) {
      throw new Error('Arquivo não tem a lista de condomínios e alunos.');
    }
    r.condominios = e.condominios.map(function (c) {
      if (!c || !c.id || !c.nome) throw new Error('Condomínio sem nome ou identificação.');
      return { id: String(c.id), nome: String(c.nome), obs: textoOuVazio(c.obs), ativo: c.ativo !== false };
    });
    r.alunos = e.alunos.map(function (a) {
      if (!a || !a.id || !a.nome) throw new Error('Aluno sem nome ou identificação.');
      var inicio = mesValido(a.inicio) ? a.inicio : (a.criadoEm ? mesDe(a.criadoEm) : mesHoje);
      return {
        id: String(a.id),
        condominioId: textoOuVazio(a.condominioId),
        nome: String(a.nome),
        responsavel: textoOuVazio(a.responsavel),
        telefone: textoOuVazio(a.telefone),
        valor: numeroOuNulo(a.valor),
        diaVencimento: diaOuNulo(a.diaVencimento),
        aulas: textoOuVazio(a.aulas),
        obs: textoOuVazio(a.obs),
        inicio: inicio,
        ativo: a.ativo !== false,
        inativoDesde: a.ativo === false && mesValido(a.inativoDesde) ? a.inativoDesde : null,
        criadoEm: a.criadoEm || null
      };
    });
    r.pagamentos = (Array.isArray(e.pagamentos) ? e.pagamentos : []).filter(function (p) {
      return p && p.alunoId && mesValido(p.mes);
    }).map(function (p) {
      return {
        alunoId: String(p.alunoId),
        mes: p.mes,
        data: /^\d{4}-\d{2}-\d{2}$/.test(p.data) ? p.data : p.mes + '-01',
        forma: p.forma === 'dinheiro' ? 'dinheiro' : 'pix',
        valor: numeroOuNulo(p.valor)
      };
    });
    r.avisos = e.avisos && typeof e.avisos === 'object' ? Object.assign({}, e.avisos) : {};
    r.ultimoBackup = e.ultimoBackup || null;
    return r;
  }

  // ---------- mensalidade ----------
  function chave(alunoId, mes) { return alunoId + '|' + mes; }

  function indicePagamentos(estado) {
    var m = new Map();
    estado.pagamentos.forEach(function (p) { m.set(chave(p.alunoId, p.mes), p); });
    return m;
  }

  /** O aluno deve pagar neste mês? (começou antes ou no mês e não estava inativo) */
  function cobravelNoMes(aluno, mes) {
    if (aluno.inicio && mes < aluno.inicio) return false;
    if (aluno.ativo !== false) return true;
    return !!(aluno.inativoDesde && mes < aluno.inativoDesde);
  }

  /**
   * status: 'pago' | 'atrasado' | 'vence' (vence hoje ou nos próximos diasAviso dias) | 'pendente'
   * Sem dia de vencimento: fica pendente até o fim do mês; depois, atrasado.
   */
  function statusMensalidade(o) {
    var venc = vencimentoNoMes(o.mes, o.diaVencimento);
    if (o.pago) return { status: 'pago', vencimento: venc, diasAtraso: null, diasParaVencer: null };
    var ref = venc || (o.mes + '-' + pad(diasNoMes(o.mes)));
    var d = diffDias(o.hoje, ref);
    var aviso = typeof o.diasAviso === 'number' ? o.diasAviso : 3;
    if (d < 0) return { status: 'atrasado', vencimento: venc, diasAtraso: -d, diasParaVencer: null };
    if (venc && d <= aviso) return { status: 'vence', vencimento: venc, diasAtraso: null, diasParaVencer: d };
    return { status: 'pendente', vencimento: venc, diasAtraso: null, diasParaVencer: venc ? d : null };
  }

  var ORDEM = { atrasado: 0, vence: 1, pendente: 2, pago: 3 };

  function comparaNome(a, b) { return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }); }

  function montarItem(estado, aluno, mes, hoje, pagamento, conds) {
    var st = statusMensalidade({
      mes: mes, diaVencimento: aluno.diaVencimento, pago: !!pagamento,
      hoje: hoje, diasAviso: estado.config.diasAviso
    });
    var k = chave(aluno.id, mes);
    return {
      chave: k,
      aluno: aluno,
      condominio: conds.get(aluno.condominioId) || null,
      mes: mes,
      pagamento: pagamento || null,
      status: st.status,
      vencimento: st.vencimento,
      diasAtraso: st.diasAtraso,
      diasParaVencer: st.diasParaVencer,
      valor: pagamento ? pagamento.valor : aluno.valor,
      avisadoEm: estado.avisos[k] || null
    };
  }

  function mapaCondominios(estado) {
    var m = new Map();
    estado.condominios.forEach(function (c) { m.set(c.id, c); });
    return m;
  }

  /** Lista e totais do mês. filtroCond: id do condomínio ou '' para todos. */
  function resumoMes(estado, mes, hoje, filtroCond) {
    var conds = mapaCondominios(estado);
    var pg = indicePagamentos(estado);
    var itens = [];
    estado.alunos.forEach(function (a) {
      if (filtroCond && a.condominioId !== filtroCond) return;
      var p = pg.get(chave(a.id, mes));
      var c = conds.get(a.condominioId);
      if (!p && (!cobravelNoMes(a, mes) || (c && c.ativo === false))) return;
      itens.push(montarItem(estado, a, mes, hoje, p, conds));
    });
    itens.sort(function (x, y) {
      if (ORDEM[x.status] !== ORDEM[y.status]) return ORDEM[x.status] - ORDEM[y.status];
      var vx = x.vencimento || '9999', vy = y.vencimento || '9999';
      if (vx !== vy) return vx < vy ? -1 : 1;
      return comparaNome(x.aluno.nome, y.aluno.nome);
    });
    var t = {
      recebido: 0, qtdPagos: 0, aReceber: 0, qtdAbertos: 0, qtdSemValor: 0,
      qtdAtrasados: 0, valorAtrasado: 0, qtdVence: 0
    };
    itens.forEach(function (i) {
      if (i.status === 'pago') {
        t.qtdPagos++;
        if (i.valor !== null) t.recebido += i.valor;
        return;
      }
      t.qtdAbertos++;
      if (i.valor === null) t.qtdSemValor++; else t.aReceber += i.valor;
      if (i.status === 'atrasado') { t.qtdAtrasados++; if (i.valor !== null) t.valorAtrasado += i.valor; }
      if (i.status === 'vence') t.qtdVence++;
    });
    t.recebido = Math.round(t.recebido * 100) / 100;
    t.aReceber = Math.round(t.aReceber * 100) / 100;
    t.valorAtrasado = Math.round(t.valorAtrasado * 100) / 100;
    return { mes: mes, itens: itens, totais: t };
  }

  /** Meses anteriores ao mês escolhido que ficaram sem pagar (até `limite` meses para trás). */
  function pendenciasAnteriores(estado, mes, hoje, filtroCond, limite) {
    limite = limite || 24;
    var conds = mapaCondominios(estado);
    var pg = indicePagamentos(estado);
    var lista = [];
    var desde = somarMeses(mes, -limite);
    estado.alunos.forEach(function (a) {
      if (filtroCond && a.condominioId !== filtroCond) return;
      var c = conds.get(a.condominioId);
      if (c && c.ativo === false) return;
      var m = a.inicio && a.inicio > desde ? a.inicio : desde;
      for (; m < mes; m = somarMeses(m, 1)) {
        if (!cobravelNoMes(a, m) || pg.has(chave(a.id, m))) continue;
        var item = montarItem(estado, a, m, hoje, null, conds);
        if (item.status === 'atrasado') lista.push(item);
      }
    });
    lista.sort(function (x, y) {
      if (x.mes !== y.mes) return x.mes < y.mes ? -1 : 1;
      return comparaNome(x.aluno.nome, y.aluno.nome);
    });
    var total = 0, semValor = 0;
    lista.forEach(function (i) { if (i.valor === null) semValor++; else total += i.valor; });
    return { itens: lista, total: Math.round(total * 100) / 100, qtdSemValor: semValor };
  }

  function marcarPago(estado, alunoId, mes, dados) {
    var aluno = estado.alunos.find(function (a) { return a.id === alunoId; });
    if (!aluno) throw new Error('Aluno não encontrado.');
    desfazerPagamento(estado, alunoId, mes);
    var p = {
      alunoId: alunoId,
      mes: mes,
      data: dados.data,
      forma: dados.forma === 'dinheiro' ? 'dinheiro' : 'pix',
      valor: dados.valor === undefined ? aluno.valor : dados.valor
    };
    estado.pagamentos.push(p);
    return p;
  }
  function desfazerPagamento(estado, alunoId, mes) {
    var antes = estado.pagamentos.length;
    estado.pagamentos = estado.pagamentos.filter(function (p) { return !(p.alunoId === alunoId && p.mes === mes); });
    return antes !== estado.pagamentos.length;
  }

  // ---------- WhatsApp ----------
  /** Só dígitos com 55 na frente. Aceita (81) 98888-7777, 81988887777, +55 81 9..., 0 81 .... Sem DDD -> null. */
  function normalizarTelefone(t) {
    var d = String(t || '').replace(/\D/g, '').replace(/^0+/, '');
    if ((d.length === 12 || d.length === 13) && d.indexOf('55') === 0) return d;
    if (d.length === 10 || d.length === 11) return '55' + d;
    return null;
  }
  function primeiroNome(s) { return String(s || '').trim().split(/\s+/)[0] || ''; }

  function dadosMensagem(item, config) {
    var a = item.aluno;
    return {
      contato: primeiroNome(a.responsavel) || primeiroNome(a.nome),
      aluno: primeiroNome(a.nome),
      aluno_completo: a.nome,
      responsavel: a.responsavel || '',
      mes: nomeMes(item.mes),
      valor: formatarMoeda(item.valor),
      vencimento: formatarData(item.vencimento),
      dias_atraso: item.diasAtraso ? String(item.diasAtraso) : '',
      pix: config.chavePix || '',
      professora: config.nome || '',
      condominio: item.condominio ? item.condominio.nome : ''
    };
  }
  /** Troca {campo} pelo valor. Linha com campo vazio sai da mensagem (ex.: sem chave Pix, some "Chave Pix:"). */
  function montarMensagem(modelo, dados) {
    var linhas = String(modelo || '').replace(/\r\n?/g, '\n').split('\n');
    var saida = [];
    linhas.forEach(function (linha) {
      var vazio = false;
      var r = linha.replace(/\{(\w+)\}/g, function (m, k) {
        if (!Object.prototype.hasOwnProperty.call(dados, k)) return m;
        var v = dados[k];
        if (v === null || v === undefined || v === '') { vazio = true; return ''; }
        return String(v);
      });
      if (!vazio) saida.push(r);
    });
    return saida.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  function linkWhatsApp(telefone, texto) {
    var n = normalizarTelefone(telefone);
    if (!n) return null;
    return 'https://wa.me/' + n + '?text=' + encodeURIComponent(texto);
  }
  /** Tipo 'cobranca' (atrasado) ou 'lembrete' (antes do vencimento). */
  function tipoMensagem(item) { return item.status === 'atrasado' ? 'cobranca' : 'lembrete'; }
  function mensagemDoItem(item, config) {
    var modelo = tipoMensagem(item) === 'cobranca' ? config.modeloCobranca : config.modeloLembrete;
    return montarMensagem(modelo, dadosMensagem(item, config));
  }

  // ---------- busca ----------
  function semAcento(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }
  function buscarAlunos(alunos, termo) {
    var t = semAcento(termo);
    if (!t) return alunos.slice();
    return alunos.filter(function (a) {
      return semAcento(a.nome).indexOf(t) >= 0 || semAcento(a.responsavel).indexOf(t) >= 0;
    });
  }

  // ---------- cópia de segurança ----------
  var MARCA = 'gestao-natacao';
  function criarBackup(estado, agoraISO) {
    var dados = JSON.parse(JSON.stringify(estado));
    return JSON.stringify({ app: MARCA, formato: 1, geradoEm: agoraISO || new Date().toISOString(), dados: dados }, null, 1);
  }
  function lerBackup(texto, hoje) {
    var obj;
    try { obj = JSON.parse(String(texto).replace(/^﻿/, '')); } catch (e) {
      return { ok: false, erro: 'O arquivo não é uma cópia de segurança válida (não é JSON).' };
    }
    if (!obj || obj.app !== MARCA || !obj.dados) {
      return { ok: false, erro: 'Este arquivo não é uma cópia de segurança deste app.' };
    }
    try {
      var estado = normalizarEstado(obj.dados, hoje);
      return {
        ok: true,
        estado: estado,
        resumo: {
          geradoEm: obj.geradoEm || null,
          condominios: estado.condominios.length,
          alunos: estado.alunos.length,
          pagamentos: estado.pagamentos.length
        }
      };
    } catch (e) {
      return { ok: false, erro: 'Cópia com problema: ' + e.message };
    }
  }
  function nomeArquivo(prefixo, agora, ext) {
    agora = agora || new Date();
    return prefixo + '-' + hojeISO(agora) + '-' + pad(agora.getHours()) + pad(agora.getMinutes()) + '.' + ext;
  }
  /** Avisa quando nunca fez cópia (e já tem dados) ou quando a última tem mais de 7 dias. */
  function situacaoBackup(estado, hoje) {
    var temDados = estado.alunos.length > 0 || estado.condominios.length > 0;
    if (!estado.ultimoBackup) return { precisa: temDados, dias: null };
    var d = diffDias(String(estado.ultimoBackup).slice(0, 10), hoje);
    return { precisa: temDados && d > 7, dias: d };
  }

  // ---------- planilha (CSV) ----------
  function campoCSV(v) {
    if (v === null || v === undefined) return '';
    var s = String(v);
    if (/[";\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function numeroCSV(v) { return v === null || v === undefined ? '' : v.toFixed(2).replace('.', ','); }
  /** Separador ";" e marca BOM: abre certo no Excel e no Numbers em português. */
  function gerarCSV(linhas) {
    return '﻿' + linhas.map(function (l) { return l.map(campoCSV).join(';'); }).join('\r\n') + '\r\n';
  }
  var NOME_STATUS = { pago: 'Pago', atrasado: 'Atrasado', vence: 'Vence em breve', pendente: 'A vencer' };
  function csvDoMes(estado, mes, hoje, filtroCond) {
    var r = resumoMes(estado, mes, hoje, filtroCond);
    var ant = pendenciasAnteriores(estado, mes, hoje, filtroCond);
    var linhas = [['Mês', 'Condomínio', 'Aluno', 'Responsável', 'Telefone', 'Valor', 'Vencimento', 'Situação', 'Dias de atraso', 'Pago em', 'Forma']];
    r.itens.concat(ant.itens).forEach(function (i) {
      linhas.push([
        nomeMes(i.mes), i.condominio ? i.condominio.nome : '', i.aluno.nome, i.aluno.responsavel,
        i.aluno.telefone, numeroCSV(i.valor), formatarData(i.vencimento), NOME_STATUS[i.status],
        i.diasAtraso || '', i.pagamento ? formatarData(i.pagamento.data) : '',
        i.pagamento ? (i.pagamento.forma === 'dinheiro' ? 'Dinheiro' : 'Pix') : ''
      ]);
    });
    return gerarCSV(linhas);
  }
  function csvPagamentos(estado) {
    var alunos = new Map(estado.alunos.map(function (a) { return [a.id, a]; }));
    var conds = mapaCondominios(estado);
    var linhas = [['Mês', 'Condomínio', 'Aluno', 'Responsável', 'Valor', 'Pago em', 'Forma']];
    estado.pagamentos.slice().sort(function (x, y) {
      return x.mes === y.mes ? (x.data < y.data ? -1 : 1) : (x.mes < y.mes ? -1 : 1);
    }).forEach(function (p) {
      var a = alunos.get(p.alunoId) || { nome: '(aluno apagado)', responsavel: '', condominioId: '' };
      var c = conds.get(a.condominioId);
      linhas.push([nomeMes(p.mes), c ? c.nome : '', a.nome, a.responsavel, numeroCSV(p.valor),
        formatarData(p.data), p.forma === 'dinheiro' ? 'Dinheiro' : 'Pix']);
    });
    return gerarCSV(linhas);
  }

  var Regras = {
    MESES: MESES, MODELO_COBRANCA: MODELO_COBRANCA, MODELO_LEMBRETE: MODELO_LEMBRETE,
    CAMPOS_MENSAGEM: CAMPOS_MENSAGEM, NOME_STATUS: NOME_STATUS,
    hojeISO: hojeISO, mesDe: mesDe, mesValido: mesValido, diasNoMes: diasNoMes, somarMeses: somarMeses,
    vencimentoNoMes: vencimentoNoMes, diffDias: diffDias, nomeMes: nomeMes, nomeMesTitulo: nomeMesTitulo,
    formatarData: formatarData, formatarDataCurta: formatarDataCurta, formatarMoeda: formatarMoeda,
    lerValor: lerValor, novoId: novoId, configPadrao: configPadrao, estadoVazio: estadoVazio,
    normalizarEstado: normalizarEstado, chave: chave, cobravelNoMes: cobravelNoMes,
    statusMensalidade: statusMensalidade, resumoMes: resumoMes, pendenciasAnteriores: pendenciasAnteriores,
    marcarPago: marcarPago, desfazerPagamento: desfazerPagamento,
    normalizarTelefone: normalizarTelefone, primeiroNome: primeiroNome, dadosMensagem: dadosMensagem,
    montarMensagem: montarMensagem, linkWhatsApp: linkWhatsApp, tipoMensagem: tipoMensagem,
    mensagemDoItem: mensagemDoItem, semAcento: semAcento, buscarAlunos: buscarAlunos,
    criarBackup: criarBackup, lerBackup: lerBackup, nomeArquivo: nomeArquivo, situacaoBackup: situacaoBackup,
    campoCSV: campoCSV, gerarCSV: gerarCSV, csvDoMes: csvDoMes, csvPagamentos: csvPagamentos
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Regras;
  else raiz.Regras = Regras;
})(typeof self !== 'undefined' ? self : this);
