/* Tela do app. As regras ficam em regras.js. Dados só neste aparelho (IndexedDB). */
(function () {
  'use strict';
  var R = window.Regras;
  var VERSAO_APP = '1';

  var estado = R.estadoVazio();
  var bloqueado = false; // se não conseguir ler os dados salvos, não grava nada por cima
  var ui = {
    aba: 'mes',
    mes: R.mesDe(R.hojeISO()),
    cond: '',
    busca: '',
    condAlunos: '',
    inativos: false,
    persistente: null
  };

  // ---------- banco de dados do aparelho ----------
  var DB_NOME = 'gestao-natacao';
  var LOJA = 'dados';
  var dbPromessa = null;
  function abrirDB() {
    if (!dbPromessa) {
      dbPromessa = new Promise(function (ok, falha) {
        var r = indexedDB.open(DB_NOME, 1);
        r.onupgradeneeded = function () { r.result.createObjectStore(LOJA); };
        r.onsuccess = function () { ok(r.result); };
        r.onerror = function () { falha(r.error); };
      });
    }
    return dbPromessa;
  }
  function dbLer(k) {
    return abrirDB().then(function (db) {
      return new Promise(function (ok, falha) {
        var r = db.transaction(LOJA, 'readonly').objectStore(LOJA).get(k);
        r.onsuccess = function () { ok(r.result); };
        r.onerror = function () { falha(r.error); };
      });
    });
  }
  function dbGravar(k, v) {
    return abrirDB().then(function (db) {
      return new Promise(function (ok, falha) {
        var t = db.transaction(LOJA, 'readwrite');
        t.objectStore(LOJA).put(v, k);
        t.oncomplete = function () { ok(); };
        t.onerror = function () { falha(t.error); };
        t.onabort = function () { falha(t.error || new Error('gravação cancelada')); };
      });
    });
  }
  var fila = Promise.resolve();
  function salvar() {
    if (bloqueado) { toast('Dados não salvos: restaure uma cópia de segurança primeiro.'); return fila; }
    var copia = JSON.parse(JSON.stringify(estado));
    fila = fila.then(function () { return dbGravar('estado', copia); }).catch(function (e) {
      toast('Não consegui salvar no aparelho: ' + (e && e.message ? e.message : e));
    });
    pedirPersistencia();
    return fila;
  }

  function pedirPersistencia() {
    if (ui.persistente || !navigator.storage || !navigator.storage.persist) return;
    if (!estado.alunos.length && !estado.condominios.length) return;
    navigator.storage.persisted().then(function (p) {
      if (p) return true;
      return navigator.storage.persist();
    }).then(function (p) { ui.persistente = !!p; }).catch(function () {});
  }

  // ---------- utilidades ----------
  function hoje() { return R.hojeISO(); }
  function mesHoje() { return R.mesDe(hoje()); }
  function $(s) { return document.querySelector(s); }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function plural(n, um, varios) { return n + ' ' + (n === 1 ? um : varios); }
  function aluno(id) { return estado.alunos.find(function (a) { return a.id === id; }); }
  function condominio(id) { return estado.condominios.find(function (c) { return c.id === id; }); }
  function condsAtivos() {
    return estado.condominios.filter(function (c) { return c.ativo; })
      .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
  }
  function ehIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function instalado() {
    return navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  }
  function lerLocal(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function gravarLocal(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sem problema */ } }

  var timerToast = null;
  function toast(msg, rotulo, fn) {
    var t = $('#toast');
    t.innerHTML = '<span>' + esc(msg) + '</span>' + (rotulo ? '<button type="button">' + esc(rotulo) + '</button>' : '');
    t.hidden = false;
    if (rotulo) t.querySelector('button').onclick = function () { t.hidden = true; fn(); };
    clearTimeout(timerToast);
    timerToast = setTimeout(function () { t.hidden = true; }, rotulo ? 6000 : 4000);
  }

  // ---------- folha (janela de baixo) ----------
  function abrirFolha(titulo, corpo) {
    var f = $('#folha');
    f.querySelector('.folha-caixa').innerHTML =
      '<div class="folha-cab"><h2>' + esc(titulo) + '</h2>' +
      '<button type="button" class="fechar" data-acao="fechar" aria-label="Fechar">✕</button></div>' + corpo;
    f.hidden = false;
    f.querySelector('.folha-caixa').scrollTop = 0;
    document.body.style.overflow = 'hidden';
  }
  function fecharFolha() {
    $('#folha').hidden = true;
    document.body.style.overflow = '';
  }

  // ---------- desenho das telas ----------
  var TITULOS = { mes: 'Este mês', alunos: 'Alunos', condominios: 'Condomínios', ajustes: 'Ajustes' };

  function render() {
    $('#titulo').textContent = TITULOS[ui.aba];
    document.querySelectorAll('#abas button').forEach(function (b) {
      b.classList.toggle('ativa', b.dataset.aba === ui.aba);
    });
    var c = $('#conteudo');
    if (ui.aba === 'mes') c.innerHTML = telaMes();
    else if (ui.aba === 'alunos') { c.innerHTML = telaAlunos(); desenharListaAlunos(); }
    else if (ui.aba === 'condominios') c.innerHTML = telaCondominios();
    else c.innerHTML = telaAjustes();
  }

  function alertasTopo() {
    var h = '';
    if (bloqueado) {
      h += '<div class="alerta"><strong>Não consegui abrir os dados salvos.</strong> Nada será gravado até você ' +
        'restaurar uma cópia de segurança em Ajustes.</div>';
    }
    if (ehIOS() && !instalado()) {
      h += '<div class="alerta"><strong>Instale o app:</strong> toque em Compartilhar (quadrado com seta) → ' +
        '“Adicionar à Tela de Início”. Use sempre pelo ícone: os dados desta aba do Safari ficam separados dos dados do ícone.</div>';
    }
    var b = R.situacaoBackup(estado, hoje());
    if (b.precisa) {
      h += '<div class="alerta"><strong>' + (b.dias === null ? 'Você ainda não fez cópia de segurança.' :
        'Última cópia de segurança há ' + b.dias + ' dias.') + '</strong> Se o app for apagado do telefone, os dados se perdem.' +
        '<div class="botoes"><button type="button" class="btn pri" data-acao="backup">Fazer cópia agora</button></div></div>';
    }
    return h;
  }

  function seletorCond(campo, valor, rotuloTodos) {
    var conds = condsAtivos();
    if (conds.length < 2) return '';
    return '<select data-campo="' + campo + '" aria-label="Condomínio"><option value="">' + esc(rotuloTodos) + '</option>' +
      conds.map(function (c) {
        return '<option value="' + esc(c.id) + '"' + (c.id === valor ? ' selected' : '') + '>' + esc(c.nome) + '</option>';
      }).join('') + '</select>';
  }

  function telaMes() {
    var h = alertasTopo();
    if (!estado.condominios.length) {
      return h + '<div class="cartao"><strong>Bem-vinda!</strong><p class="dica">Comece cadastrando os condomínios ' +
        '(aba Condomínios) e depois os alunos de cada um (aba Alunos).</p>' +
        '<div class="botoes" style="margin-top:10px"><button type="button" class="btn pri" data-acao="novo-cond">Cadastrar condomínio</button></div></div>' +
        '<div class="cartao"><p class="dica">Já tem uma cópia de segurança? Vá em Ajustes → Restaurar de uma cópia.</p></div>';
    }
    if (ui.cond && !condominio(ui.cond)) ui.cond = '';
    var dataHoje = hoje();
    var r = R.resumoMes(estado, ui.mes, dataHoje, ui.cond);
    var ant = ui.mes === mesHoje() ? R.pendenciasAnteriores(estado, ui.mes, dataHoje, ui.cond) : { itens: [], total: 0, qtdSemValor: 0 };
    var t = r.totais;

    h += '<div class="mes-nav">' +
      '<button type="button" data-acao="mes-ant" aria-label="Mês anterior">‹</button>' +
      '<div class="nome">' + esc(R.nomeMesTitulo(ui.mes)) + '</div>' +
      (ui.mes !== mesHoje() ? '<button type="button" class="hoje" data-acao="mes-hoje">Hoje</button>' : '') +
      '<button type="button" data-acao="mes-prox" aria-label="Próximo mês">›</button></div>';
    var sel = seletorCond('filtro-cond', ui.cond, 'Todos os condomínios');
    if (sel) h += '<div class="filtros">' + sel + '</div>';

    h += '<div class="totais">' +
      '<div class="total ok"><div class="rot">Recebido</div><div class="val">' + esc(R.formatarMoeda(t.recebido)) + '</div>' +
      '<div class="qtd">' + plural(t.qtdPagos, 'pagamento', 'pagamentos') + '</div></div>' +
      '<div class="total falta"><div class="rot">A receber</div><div class="val">' + esc(R.formatarMoeda(t.aReceber)) + '</div>' +
      '<div class="qtd">' + plural(t.qtdAbertos, 'aluno', 'alunos') + (t.qtdSemValor ? ' · ' + t.qtdSemValor + ' sem valor' : '') + '</div></div>';
    if (t.qtdAtrasados || ant.itens.length) {
      var partes = [];
      if (t.qtdAtrasados) partes.push(plural(t.qtdAtrasados, 'atrasado', 'atrasados') + ' neste mês (' + R.formatarMoeda(t.valorAtrasado) + ')');
      if (ant.itens.length) partes.push(plural(ant.itens.length, 'mensalidade', 'mensalidades') + ' de meses anteriores (' + R.formatarMoeda(ant.total) + ')');
      h += '<div class="total atraso largo"><div class="rot">Em atraso</div><div class="val">' +
        esc(R.formatarMoeda(t.valorAtrasado + ant.total)) + '</div><div class="qtd">' + esc(partes.join(' · ')) + '</div></div>';
    }
    h += '</div>';

    if (!r.itens.length && !ant.itens.length) {
      h += '<p class="vazio">Nenhum aluno para cobrar neste mês' + (ui.cond ? ' neste condomínio' : '') + '.</p>';
      return h;
    }
    var grupos = [
      ['atrasado', 'Atrasados'],
      ['anteriores', 'De meses anteriores'],
      ['vence', 'Vencem nos próximos dias'],
      ['pendente', 'A vencer'],
      ['pago', 'Pagos']
    ];
    grupos.forEach(function (g) {
      var lista = g[0] === 'anteriores' ? ant.itens : r.itens.filter(function (i) { return i.status === g[0]; });
      if (!lista.length) return;
      h += '<h2 class="secao">' + g[1] + ' <small>(' + lista.length + ')</small></h2>';
      h += lista.map(function (i) { return itemHTML(i, g[0] === 'anteriores'); }).join('');
    });
    return h;
  }

  function textoStatus(i) {
    if (i.status === 'pago') {
      return 'Pago em ' + R.formatarDataCurta(i.pagamento.data) + ' · ' + (i.pagamento.forma === 'dinheiro' ? 'Dinheiro' : 'Pix');
    }
    if (i.status === 'atrasado') {
      return 'Atrasado há ' + plural(i.diasAtraso, 'dia', 'dias') + (i.vencimento ? ' · venceu ' + R.formatarDataCurta(i.vencimento) : '');
    }
    if (i.status === 'vence') {
      if (i.diasParaVencer === 0) return 'Vence hoje';
      if (i.diasParaVencer === 1) return 'Vence amanhã (' + R.formatarDataCurta(i.vencimento) + ')';
      return 'Vence em ' + i.diasParaVencer + ' dias (' + R.formatarDataCurta(i.vencimento) + ')';
    }
    return i.vencimento ? 'Vence ' + R.formatarDataCurta(i.vencimento) : 'Sem dia de vencimento';
  }

  function itemHTML(i, mostrarMes) {
    var a = i.aluno;
    var sub = [];
    if (mostrarMes) sub.push('Mês: ' + R.nomeMes(i.mes));
    if (!ui.cond && i.condominio) sub.push(i.condominio.nome);
    if (a.responsavel) sub.push('Resp.: ' + a.responsavel);
    if (a.aulas) sub.push(a.aulas);
    var dados = ' data-aluno="' + esc(a.id) + '" data-mes="' + esc(i.mes) + '"';
    var h = '<div class="cartao item ' + i.status + '">' +
      '<div class="cab"><div class="nome" data-acao="abrir-aluno" data-id="' + esc(a.id) + '">' + esc(a.nome) + '</div>' +
      '<div class="valor">' + (i.valor === null ? '<span class="dica">sem valor</span>' : esc(R.formatarMoeda(i.valor))) + '</div></div>' +
      (sub.length ? '<div class="sub">' + esc(sub.join(' · ')) + '</div>' : '') +
      '<span class="etq ' + i.status + '">' + esc(textoStatus(i)) + '</span>';
    if (i.status !== 'pago' && i.avisadoEm) {
      h += '<div class="avisado">Mensagem aberta no WhatsApp em ' + esc(R.formatarDataCurta(i.avisadoEm)) + '</div>';
    }
    h += '<div class="botoes">';
    if (i.status === 'pago') {
      h += '<button type="button" class="btn" data-acao="editar-pag"' + dados + '>Alterar</button>' +
        '<button type="button" class="btn perigo" data-acao="desfazer"' + dados + '>Desfazer</button>';
    } else {
      h += '<button type="button" class="btn ok" data-acao="pagar" data-forma="pix"' + dados + '>✓ Pago no Pix</button>' +
        '<button type="button" class="btn ok" data-acao="pagar" data-forma="dinheiro"' + dados + '>✓ Dinheiro</button>';
      var cobranca = R.tipoMensagem(i) === 'cobranca';
      var link = R.linkWhatsApp(a.telefone, R.mensagemDoItem(i, estado.config));
      var rot = cobranca ? 'Cobrar no WhatsApp' : 'Lembrete no WhatsApp';
      if (link) {
        h += '<a class="btn zap" style="flex-basis:100%" href="' + esc(link) + '" target="_blank" rel="noopener" data-acao="zap" data-chave="' + esc(i.chave) + '">' + rot + '</a>';
      } else {
        h += '<span class="btn desligado" style="flex-basis:100%">' + rot + ' (sem telefone com DDD)</span>';
      }
    }
    return h + '</div></div>';
  }

  // ----- alunos -----
  function telaAlunos() {
    var conds = condsAtivos();
    if (!estado.condominios.length) {
      return '<div class="cartao"><p class="dica">Cadastre primeiro um condomínio.</p>' +
        '<div class="botoes" style="margin-top:10px"><button type="button" class="btn pri" data-acao="novo-cond">Cadastrar condomínio</button></div></div>';
    }
    var ativos = estado.alunos.filter(function (a) { return a.ativo; }).length;
    var h = '<div class="mais"><button type="button" class="btn pri cheio" data-acao="novo-aluno"' + (conds.length ? '' : ' disabled') + '>+ Novo aluno</button></div>' +
      '<div class="filtros"><input type="search" data-campo="busca" placeholder="Buscar pelo nome do aluno ou responsável" value="' + esc(ui.busca) + '" autocomplete="off" autocorrect="off">' +
      seletorCond('filtro-cond-alunos', ui.condAlunos, 'Todos os condomínios') +
      '<label class="marcar"><input type="checkbox" data-campo="inativos"' + (ui.inativos ? ' checked' : '') + '> Mostrar alunos inativos</label></div>' +
      '<p class="dica" style="margin:0 4px 6px">' + plural(ativos, 'aluno ativo', 'alunos ativos') + ' em ' + plural(conds.length, 'condomínio', 'condomínios') + '.</p>' +
      '<div id="lista-alunos"></div>';
    return h;
  }
  function desenharListaAlunos() {
    var caixa = $('#lista-alunos');
    if (!caixa) return;
    if (ui.condAlunos && !condominio(ui.condAlunos)) ui.condAlunos = '';
    var lista = R.buscarAlunos(estado.alunos, ui.busca).filter(function (a) {
      return (ui.inativos || a.ativo) && (!ui.condAlunos || a.condominioId === ui.condAlunos);
    });
    if (!lista.length) {
      caixa.innerHTML = '<p class="vazio">' + (ui.busca ? 'Nenhum aluno encontrado com “' + esc(ui.busca) + '”.' :
        'Nenhum aluno cadastrado ainda. Toque em “+ Novo aluno”.') + '</p>';
      return;
    }
    var porCond = new Map();
    lista.forEach(function (a) {
      if (!porCond.has(a.condominioId)) porCond.set(a.condominioId, []);
      porCond.get(a.condominioId).push(a);
    });
    var ordem = Array.from(porCond.keys()).sort(function (x, y) {
      var cx = condominio(x), cy = condominio(y);
      return (cx ? cx.nome : '~').localeCompare(cy ? cy.nome : '~', 'pt-BR');
    });
    var h = '';
    ordem.forEach(function (cid) {
      var c = condominio(cid);
      var as = porCond.get(cid).sort(function (x, y) { return x.nome.localeCompare(y.nome, 'pt-BR'); });
      h += '<h2 class="secao">' + esc(c ? c.nome : 'Sem condomínio') + (c && !c.ativo ? ' (desativado)' : '') +
        ' <small>(' + as.length + ')</small></h2><div class="lista">';
      as.forEach(function (a) {
        var t2 = [];
        if (a.responsavel) t2.push('Resp.: ' + a.responsavel);
        t2.push(a.valor === null ? 'sem valor' : R.formatarMoeda(a.valor));
        if (a.diaVencimento) t2.push('vence dia ' + a.diaVencimento);
        if (a.aulas) t2.push(a.aulas);
        h += '<button type="button" class="lin' + (a.ativo ? '' : ' inativo') + '" data-acao="abrir-aluno" data-id="' + esc(a.id) + '">' +
          '<span class="txt"><span class="t1">' + esc(a.nome) + (a.ativo ? '' : ' (inativo)') + '</span>' +
          '<span class="t2" style="display:block">' + esc(t2.join(' · ')) + '</span></span><span class="seta">›</span></button>';
      });
      h += '</div>';
    });
    caixa.innerHTML = h;
  }

  function formAluno(id) {
    var a = id ? aluno(id) : null;
    var conds = condsAtivos();
    if (a && !conds.some(function (c) { return c.id === a.condominioId; })) {
      var antigo = condominio(a.condominioId);
      if (antigo) conds = conds.concat([antigo]);
    }
    var padraoCond = a ? a.condominioId : (ui.condAlunos || ui.cond || (conds[0] && conds[0].id));
    var v = a || { nome: '', responsavel: '', telefone: '', valor: null, diaVencimento: null, aulas: '', obs: '', inicio: mesHoje(), ativo: true, inativoDesde: null };
    var h = '<form data-form="aluno" data-id="' + esc(id || '') + '" novalidate>' +
      '<label class="campo"><span>Nome do aluno *</span><input type="text" name="nome" value="' + esc(v.nome) + '" autocomplete="off"></label>' +
      '<label class="campo"><span>Condomínio *</span><select name="condominioId">' + conds.map(function (c) {
        return '<option value="' + esc(c.id) + '"' + (c.id === padraoCond ? ' selected' : '') + '>' + esc(c.nome) + (c.ativo ? '' : ' (desativado)') + '</option>';
      }).join('') + '</select></label>' +
      '<label class="campo"><span>Responsável (se for criança)</span><input type="text" name="responsavel" value="' + esc(v.responsavel) + '" autocomplete="off"></label>' +
      '<label class="campo"><span>WhatsApp (com DDD)</span><input type="tel" name="telefone" inputmode="tel" placeholder="81 98888-7777" value="' + esc(v.telefone) + '"></label>' +
      '<div class="linha2">' +
      '<label class="campo"><span>Mensalidade (R$)</span><input type="text" name="valor" inputmode="decimal" placeholder="150,00" value="' + esc(v.valor === null ? '' : String(v.valor.toFixed(2)).replace('.', ',')) + '"></label>' +
      '<label class="campo"><span>Dia do vencimento</span><input type="number" name="dia" inputmode="numeric" min="1" max="31" placeholder="10" value="' + esc(v.diaVencimento || '') + '"></label>' +
      '</div>' +
      '<p class="dica" style="margin:-6px 0 12px">Vencimento no dia 29, 30 ou 31: nos meses mais curtos vale o último dia do mês.</p>' +
      '<label class="campo"><span>Dias e horário da aula</span><input type="text" name="aulas" placeholder="Seg e Qua, 16h" value="' + esc(v.aulas) + '"></label>' +
      '<label class="campo"><span>Começou a pagar em (mês)</span><input type="month" name="inicio" value="' + esc(v.inicio) + '"></label>' +
      '<label class="campo"><span>Observação</span><textarea name="obs" style="min-height:80px">' + esc(v.obs) + '</textarea></label>' +
      '<label class="marcar"><input type="checkbox" name="ativo"' + (v.ativo ? ' checked' : '') + ' data-campo="toggle-ativo"> Aluno ativo</label>' +
      '<label class="campo" id="campo-inativo"' + (v.ativo ? ' hidden' : '') + '><span>Parar de cobrar a partir de (mês)</span>' +
      '<input type="month" name="inativoDesde" value="' + esc(v.inativoDesde || mesHoje()) + '"></label>' +
      '<div class="erro" id="erro-form" hidden></div>' +
      '<div class="botoes"><button type="submit" class="btn pri">Salvar</button>' +
      '<button type="button" class="btn" data-acao="fechar">Cancelar</button></div>';
    if (a) {
      h += historicoAluno(a);
      var temPag = estado.pagamentos.some(function (p) { return p.alunoId === a.id; });
      if (!temPag) {
        h += '<div class="botoes" style="margin-top:14px"><button type="button" class="btn perigo" data-acao="apagar-aluno" data-id="' + esc(a.id) + '">Apagar (só se cadastrou por engano)</button></div>';
      } else {
        h += '<p class="dica">Para tirar da lista, desmarque “Aluno ativo”. O histórico de pagamentos fica guardado.</p>';
      }
    }
    h += '</form>';
    abrirFolha(a ? 'Editar aluno' : 'Novo aluno', h);
  }

  function historicoAluno(a) {
    var dataHoje = hoje();
    var fim = mesHoje();
    var ini = R.somarMeses(fim, -11);
    if (a.inicio > ini) ini = a.inicio;
    var pg = new Map();
    estado.pagamentos.forEach(function (p) { if (p.alunoId === a.id) pg.set(p.mes, p); });
    var linhas = [];
    for (var m = fim; m >= ini; m = R.somarMeses(m, -1)) {
      var p = pg.get(m);
      if (!p && !R.cobravelNoMes(a, m)) continue;
      var st = R.statusMensalidade({ mes: m, diaVencimento: a.diaVencimento, pago: !!p, hoje: dataHoje, diasAviso: estado.config.diasAviso });
      var txt = p ? 'Pago ' + R.formatarDataCurta(p.data) + ' · ' + (p.forma === 'dinheiro' ? 'Dinheiro' : 'Pix') + (p.valor !== null ? ' · ' + R.formatarMoeda(p.valor) : '')
        : (st.status === 'atrasado' ? 'Atrasado' : 'Em aberto');
      linhas.push('<li><span>' + esc(R.nomeMes(m)) + '</span><span class="etq ' + st.status + '" style="margin:0">' + esc(txt) + '</span></li>');
    }
    if (!linhas.length) return '';
    return '<h2 class="secao">Últimos meses</h2><div class="cartao"><ul class="hist">' + linhas.join('') + '</ul></div>';
  }

  function salvarAluno(form) {
    var f = form.elements;
    var erro = '';
    var nome = f.nome.value.trim();
    var valor = R.lerValor(f.valor.value);
    var diaTxt = f.dia.value.trim();
    var dia = diaTxt === '' ? null : Number(diaTxt);
    var tel = f.telefone.value.trim();
    var inicio = R.mesValido(f.inicio.value) ? f.inicio.value : mesHoje();
    if (!nome) erro = 'Escreva o nome do aluno.';
    else if (!f.condominioId.value) erro = 'Escolha o condomínio.';
    else if (typeof valor === 'number' && isNaN(valor)) erro = 'Valor da mensalidade inválido. Exemplo: 150,00';
    else if (dia !== null && !(Math.floor(dia) === dia && dia >= 1 && dia <= 31)) erro = 'O dia do vencimento vai de 1 a 31.';
    else if (tel && !R.normalizarTelefone(tel)) erro = 'Telefone precisa do DDD. Exemplo: 81 98888-7777';
    var caixaErro = form.querySelector('#erro-form');
    if (erro) { caixaErro.textContent = erro; caixaErro.hidden = false; caixaErro.scrollIntoView({ block: 'center' }); return; }
    var ativo = f.ativo.checked;
    var dados = {
      condominioId: f.condominioId.value,
      nome: nome,
      responsavel: f.responsavel.value.trim(),
      telefone: tel,
      valor: valor,
      diaVencimento: dia,
      aulas: f.aulas.value.trim(),
      obs: f.obs.value.trim(),
      inicio: inicio,
      ativo: ativo,
      inativoDesde: ativo ? null : (R.mesValido(f.inativoDesde.value) ? f.inativoDesde.value : mesHoje())
    };
    var id = form.dataset.id;
    if (id) Object.assign(aluno(id), dados);
    else estado.alunos.push(Object.assign({ id: R.novoId(), criadoEm: new Date().toISOString() }, dados));
    salvar();
    fecharFolha();
    render();
    toast(id ? 'Aluno atualizado.' : 'Aluno cadastrado.');
  }

  // ----- condomínios -----
  function telaCondominios() {
    var h = '<div class="mais"><button type="button" class="btn pri cheio" data-acao="novo-cond">+ Novo condomínio</button></div>';
    if (!estado.condominios.length) return h + '<p class="vazio">Nenhum condomínio cadastrado.</p>';
    var lista = estado.condominios.slice().sort(function (a, b) {
      if (a.ativo !== b.ativo) return a.ativo ? -1 : 1;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });
    h += '<div class="lista">' + lista.map(function (c) {
      var n = estado.alunos.filter(function (a) { return a.condominioId === c.id && a.ativo; }).length;
      return '<button type="button" class="lin' + (c.ativo ? '' : ' inativo') + '" data-acao="abrir-cond" data-id="' + esc(c.id) + '">' +
        '<span class="txt"><span class="t1">' + esc(c.nome) + (c.ativo ? '' : ' (desativado)') + '</span>' +
        '<span class="t2" style="display:block">' + plural(n, 'aluno ativo', 'alunos ativos') + (c.obs ? ' · ' + esc(c.obs) : '') + '</span></span>' +
        '<span class="seta">›</span></button>';
    }).join('') + '</div>';
    return h;
  }
  function formCond(id) {
    var c = id ? condominio(id) : null;
    var v = c || { nome: '', obs: '', ativo: true };
    var h = '<form data-form="cond" data-id="' + esc(id || '') + '" novalidate>' +
      '<label class="campo"><span>Nome do condomínio *</span><input type="text" name="nome" value="' + esc(v.nome) + '" autocomplete="off"></label>' +
      '<label class="campo"><span>Endereço / observação</span><input type="text" name="obs" value="' + esc(v.obs) + '"></label>' +
      '<div class="erro" id="erro-form" hidden></div>' +
      '<div class="botoes"><button type="submit" class="btn pri">Salvar</button><button type="button" class="btn" data-acao="fechar">Cancelar</button></div>';
    if (c) {
      var nAlunos = estado.alunos.filter(function (a) { return a.condominioId === c.id; }).length;
      h += '<div class="botoes" style="margin-top:14px">' + (c.ativo
        ? '<button type="button" class="btn perigo" data-acao="desativar-cond" data-id="' + esc(c.id) + '">Desativar condomínio</button>'
        : '<button type="button" class="btn" data-acao="reativar-cond" data-id="' + esc(c.id) + '">Reativar condomínio</button>');
      if (!nAlunos) h += '<button type="button" class="btn perigo" data-acao="apagar-cond" data-id="' + esc(c.id) + '">Apagar</button>';
      h += '</div>';
    }
    abrirFolha(c ? 'Editar condomínio' : 'Novo condomínio', h + '</form>');
  }
  function salvarCond(form) {
    var nome = form.elements.nome.value.trim();
    var caixaErro = form.querySelector('#erro-form');
    if (!nome) { caixaErro.textContent = 'Escreva o nome do condomínio.'; caixaErro.hidden = false; return; }
    var id = form.dataset.id;
    var dados = { nome: nome, obs: form.elements.obs.value.trim() };
    if (id) Object.assign(condominio(id), dados);
    else estado.condominios.push(Object.assign({ id: R.novoId(), ativo: true }, dados));
    salvar();
    fecharFolha();
    render();
    toast(id ? 'Condomínio atualizado.' : 'Condomínio cadastrado.');
  }

  // ----- ajustes -----
  function telaAjustes() {
    var cfg = estado.config;
    var b = estado.ultimoBackup;
    var h = '<h2 class="secao">Cópia de segurança</h2><div class="cartao">' +
      '<p style="margin-top:0">Os dados ficam <strong>só neste telefone</strong>. Faça a cópia toda semana e guarde no app Arquivos (iCloud) ' +
      'ou mande no seu próprio WhatsApp. Se o app for apagado sem cópia, os dados se perdem.</p>' +
      '<p class="dica">Última cópia: <strong>' + (b ? esc(R.formatarData(b) + ' às ' + new Date(b).toTimeString().slice(0, 5)) : 'nunca') + '</strong></p>' +
      '<div class="botoes" style="margin-top:10px"><button type="button" class="btn pri cheio" data-acao="backup">Salvar cópia de segurança</button>' +
      '<button type="button" class="btn cheio" data-acao="restaurar">Restaurar de uma cópia</button></div></div>' +
      '<h2 class="secao">Planilha</h2><div class="cartao"><div class="botoes">' +
      '<button type="button" class="btn cheio" data-acao="csv-mes">Planilha do mês (' + esc(R.nomeMes(ui.mes)) + ')</button>' +
      '<button type="button" class="btn cheio" data-acao="csv-todos">Planilha de todos os pagamentos</button></div>' +
      '<p class="dica">Abre no Numbers, Excel ou Planilhas Google.</p></div>';

    h += '<h2 class="secao">Seus dados</h2><form class="cartao" data-form="config" novalidate>' +
      '<label class="campo"><span>Seu nome (vai no fim da mensagem)</span><input type="text" name="nome" value="' + esc(cfg.nome) + '"></label>' +
      '<label class="campo"><span>Chave Pix</span><input type="text" name="chavePix" value="' + esc(cfg.chavePix) + '" autocomplete="off" autocapitalize="off"></label>' +
      '<label class="campo"><span>Avisar quantos dias antes do vencimento</span><input type="number" name="diasAviso" inputmode="numeric" min="0" max="31" value="' + esc(cfg.diasAviso) + '"></label>' +
      '<button type="submit" class="btn pri cheio">Salvar</button></form>';

    var campos = Object.keys(R.CAMPOS_MENSAGEM).map(function (k) {
      return '<li><code class="campo">{' + k + '}</code> ' + esc(R.CAMPOS_MENSAGEM[k]) + '</li>';
    }).join('');
    h += '<h2 class="secao">Textos das mensagens</h2><form class="cartao" data-form="mensagens" novalidate>' +
      '<label class="campo"><span>Cobrança (mensalidade atrasada)</span><textarea name="modeloCobranca">' + esc(cfg.modeloCobranca) + '</textarea></label>' +
      '<label class="campo"><span>Lembrete (antes do vencimento)</span><textarea name="modeloLembrete">' + esc(cfg.modeloLembrete) + '</textarea></label>' +
      '<p class="dica">O app troca estes campos pelos dados do aluno. Se um campo estiver vazio (ex.: aluno sem valor), a linha inteira sai da mensagem.</p>' +
      '<ul class="campos-lista">' + campos + '</ul>' +
      '<div class="botoes"><button type="submit" class="btn pri">Salvar textos</button>' +
      '<button type="button" class="btn" data-acao="textos-padrao">Voltar ao texto original</button></div></form>';

    var pers = ui.persistente === true ? 'O telefone confirmou que vai guardar os dados.' :
      (ui.persistente === false ? 'O telefone ainda não confirmou a guarda permanente. Faça cópias de segurança com frequência.' : 'Verificando…');
    h += '<h2 class="secao">Sobre</h2><div class="cartao"><p style="margin:0">' + esc(pers) + '</p>' +
      '<p class="dica">' + plural(estado.condominios.length, 'condomínio', 'condomínios') + ' · ' + plural(estado.alunos.length, 'aluno', 'alunos') + ' · ' +
      plural(estado.pagamentos.length, 'pagamento registrado', 'pagamentos registrados') + '</p>' +
      '<p class="dica">Versão ' + VERSAO_APP + '. Funciona sem internet. Nada é enviado para nenhum servidor: as mensagens só saem quando você aperta enviar no WhatsApp.</p></div>';
    return h;
  }

  // ---------- pagamentos ----------
  function pagar(alunoId, mes, forma) {
    var a = aluno(alunoId);
    R.marcarPago(estado, alunoId, mes, { data: hoje(), forma: forma });
    salvar();
    render();
    toast(R.primeiroNome(a.nome) + ': pago (' + (forma === 'dinheiro' ? 'dinheiro' : 'Pix') + ')' +
      (mes !== ui.mes ? ' – ' + R.nomeMes(mes) : ''), 'Desfazer', function () {
      R.desfazerPagamento(estado, alunoId, mes);
      salvar();
      render();
    });
  }
  function formPagamento(alunoId, mes) {
    var p = estado.pagamentos.find(function (x) { return x.alunoId === alunoId && x.mes === mes; });
    var a = aluno(alunoId);
    if (!p || !a) return;
    var h = '<form data-form="pagamento" data-aluno="' + esc(alunoId) + '" data-mes="' + esc(mes) + '" novalidate>' +
      '<p class="dica" style="margin-top:0">' + esc(a.nome) + ' · ' + esc(R.nomeMes(mes)) + '</p>' +
      '<label class="campo"><span>Data do pagamento</span><input type="date" name="data" value="' + esc(p.data) + '"></label>' +
      '<label class="campo"><span>Forma</span><select name="forma"><option value="pix"' + (p.forma === 'pix' ? ' selected' : '') + '>Pix</option>' +
      '<option value="dinheiro"' + (p.forma === 'dinheiro' ? ' selected' : '') + '>Dinheiro</option></select></label>' +
      '<label class="campo"><span>Valor pago (R$)</span><input type="text" name="valor" inputmode="decimal" value="' + esc(p.valor === null ? '' : p.valor.toFixed(2).replace('.', ',')) + '"></label>' +
      '<div class="erro" id="erro-form" hidden></div>' +
      '<div class="botoes"><button type="submit" class="btn pri">Salvar</button>' +
      '<button type="button" class="btn perigo" data-acao="desfazer" data-aluno="' + esc(alunoId) + '" data-mes="' + esc(mes) + '">Desfazer pagamento</button></div></form>';
    abrirFolha('Pagamento', h);
  }
  function salvarPagamento(form) {
    var f = form.elements;
    var valor = R.lerValor(f.valor.value);
    var caixaErro = form.querySelector('#erro-form');
    if (typeof valor === 'number' && isNaN(valor)) { caixaErro.textContent = 'Valor inválido. Exemplo: 150,00'; caixaErro.hidden = false; return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.data.value)) { caixaErro.textContent = 'Escolha a data.'; caixaErro.hidden = false; return; }
    R.marcarPago(estado, form.dataset.aluno, form.dataset.mes, { data: f.data.value, forma: f.forma.value, valor: valor });
    salvar();
    fecharFolha();
    render();
    toast('Pagamento atualizado.');
  }

  // ---------- arquivos (cópia e planilha) ----------
  function baixar(blob, nome) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }
  /** Abre o menu Compartilhar do iPhone (Salvar em Arquivos, WhatsApp...). Sem ele, baixa o arquivo. */
  function compartilhar(nome, conteudo, tipo) {
    var blob = new Blob([conteudo], { type: tipo });
    var arquivo = null;
    try { arquivo = new File([blob], nome, { type: tipo }); } catch (e) { arquivo = null; }
    if (arquivo && navigator.canShare && navigator.share && navigator.canShare({ files: [arquivo] })) {
      return navigator.share({ files: [arquivo], title: nome }).then(function () { return 'ok'; }, function (e) {
        if (e && e.name === 'AbortError') return 'cancelado';
        baixar(blob, nome);
        return 'ok';
      });
    }
    baixar(blob, nome);
    return Promise.resolve('ok');
  }
  function fazerBackup() {
    var agora = new Date();
    compartilhar(R.nomeArquivo('natacao-copia', agora, 'json'), R.criarBackup(estado, agora.toISOString()), 'application/json')
      .then(function (r) {
        if (r !== 'ok') { toast('Cópia cancelada.'); return; }
        estado.ultimoBackup = agora.toISOString();
        salvar();
        render();
        toast('Cópia de segurança feita.');
      });
  }
  function arquivoEscolhido(ev) {
    var arq = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!arq) return;
    var leitor = new FileReader();
    leitor.onload = function () {
      var r = R.lerBackup(leitor.result, hoje());
      if (!r.ok) { abrirFolha('Não deu certo', '<p>' + esc(r.erro) + '</p><button type="button" class="btn cheio" data-acao="fechar">Fechar</button>'); return; }
      pendenteImportar = r;
      var s = r.resumo;
      abrirFolha('Restaurar cópia',
        '<div class="cartao"><p style="margin-top:0">Cópia de <strong>' + (s.geradoEm ? esc(R.formatarData(s.geradoEm) + ' às ' + new Date(s.geradoEm).toTimeString().slice(0, 5)) : 'data desconhecida') + '</strong></p>' +
        '<p class="dica">' + plural(s.condominios, 'condomínio', 'condomínios') + ' · ' + plural(s.alunos, 'aluno', 'alunos') + ' · ' + plural(s.pagamentos, 'pagamento', 'pagamentos') + '</p></div>' +
        '<div class="alerta"><strong>Atenção:</strong> os dados que estão agora neste telefone serão trocados pelos dados desta cópia.</div>' +
        '<div class="botoes"><button type="button" class="btn pri" data-acao="confirmar-importar">Restaurar</button>' +
        '<button type="button" class="btn" data-acao="fechar">Cancelar</button></div>');
    };
    leitor.onerror = function () { toast('Não consegui ler o arquivo.'); };
    leitor.readAsText(arq);
  }
  var pendenteImportar = null;
  function confirmarImportar() {
    if (!pendenteImportar) return;
    var novo = pendenteImportar.estado;
    var geradoEm = pendenteImportar.resumo.geradoEm;
    pendenteImportar = null;
    var anterior = JSON.parse(JSON.stringify(estado));
    // guarda o que havia antes, por segurança, sem mostrar na tela
    dbGravar('antesDeRestaurar', { em: new Date().toISOString(), dados: anterior }).catch(function () {}).then(function () {
      estado = novo;
      if (geradoEm) estado.ultimoBackup = geradoEm;
      bloqueado = false;
      ui.cond = ''; ui.condAlunos = '';
      salvar();
      fecharFolha();
      ui.aba = 'mes';
      render();
      toast('Cópia restaurada.');
    });
  }

  // ---------- ações (toques) ----------
  var acoes = {
    fechar: fecharFolha,
    'mes-ant': function () { ui.mes = R.somarMeses(ui.mes, -1); render(); },
    'mes-prox': function () { ui.mes = R.somarMeses(ui.mes, 1); render(); },
    'mes-hoje': function () { ui.mes = mesHoje(); render(); },
    pagar: function (d) { pagar(d.aluno, d.mes, d.forma); },
    desfazer: function (d) {
      var a = aluno(d.aluno);
      if (!confirm('Desfazer o pagamento de ' + (a ? a.nome : '') + ' (' + R.nomeMes(d.mes) + ')?')) return;
      R.desfazerPagamento(estado, d.aluno, d.mes);
      salvar(); fecharFolha(); render();
      toast('Pagamento desfeito.');
    },
    'editar-pag': function (d) { formPagamento(d.aluno, d.mes); },
    zap: function (d) {
      estado.avisos[d.chave] = hoje();
      salvar();
      setTimeout(render, 800);
    },
    'abrir-aluno': function (d) { formAluno(d.id); },
    'novo-aluno': function () { formAluno(null); },
    'apagar-aluno': function (d) {
      var a = aluno(d.id);
      if (!a || !confirm('Apagar ' + a.nome + '? Use isto só se cadastrou por engano.')) return;
      estado.alunos = estado.alunos.filter(function (x) { return x.id !== d.id; });
      salvar(); fecharFolha(); render();
      toast('Aluno apagado.');
    },
    'abrir-cond': function (d) { formCond(d.id); },
    'novo-cond': function () { ui.aba = 'condominios'; render(); formCond(null); },
    'desativar-cond': function (d) {
      var c = condominio(d.id);
      var ativos = estado.alunos.filter(function (a) { return a.condominioId === d.id && a.ativo; });
      var msg = 'Desativar o condomínio ' + c.nome + '?' + (ativos.length ? '\n\n' + plural(ativos.length, 'aluno ativo', 'alunos ativos') +
        ' também ' + (ativos.length === 1 ? 'será desativado' : 'serão desativados') + ' a partir deste mês. O histórico fica guardado.' : '');
      if (!confirm(msg)) return;
      c.ativo = false;
      ativos.forEach(function (a) { a.ativo = false; a.inativoDesde = mesHoje(); });
      salvar(); fecharFolha(); render();
      toast('Condomínio desativado.');
    },
    'reativar-cond': function (d) {
      condominio(d.id).ativo = true;
      salvar(); fecharFolha(); render();
      toast('Condomínio reativado. Reative os alunos em Alunos → Mostrar inativos.');
    },
    'apagar-cond': function (d) {
      var c = condominio(d.id);
      if (!confirm('Apagar o condomínio ' + c.nome + '?')) return;
      estado.condominios = estado.condominios.filter(function (x) { return x.id !== d.id; });
      salvar(); fecharFolha(); render();
    },
    backup: fazerBackup,
    restaurar: function () { $('#arquivo-backup').click(); },
    'confirmar-importar': confirmarImportar,
    'csv-mes': function () {
      compartilhar(R.nomeArquivo('natacao-mes-' + ui.mes, new Date(), 'csv'), R.csvDoMes(estado, ui.mes, hoje(), ui.cond), 'text/csv');
    },
    'csv-todos': function () {
      compartilhar(R.nomeArquivo('natacao-pagamentos', new Date(), 'csv'), R.csvPagamentos(estado), 'text/csv');
    },
    'textos-padrao': function () {
      if (!confirm('Voltar os dois textos para o original?')) return;
      estado.config.modeloCobranca = R.MODELO_COBRANCA;
      estado.config.modeloLembrete = R.MODELO_LEMBRETE;
      salvar(); render();
      toast('Textos originais de volta.');
    }
  };

  document.addEventListener('click', function (ev) {
    var aba = ev.target.closest('#abas button');
    if (aba) { ui.aba = aba.dataset.aba; render(); window.scrollTo(0, 0); return; }
    var el = ev.target.closest('[data-acao]');
    if (!el) return;
    var fn = acoes[el.dataset.acao];
    if (!fn) return;
    if (el.tagName !== 'A') ev.preventDefault();
    fn(el.dataset, el);
  });

  document.addEventListener('submit', function (ev) {
    var form = ev.target;
    ev.preventDefault();
    var tipo = form.dataset.form;
    if (tipo === 'aluno') salvarAluno(form);
    else if (tipo === 'cond') salvarCond(form);
    else if (tipo === 'pagamento') salvarPagamento(form);
    else if (tipo === 'config') {
      var dias = Number(form.elements.diasAviso.value);
      estado.config.nome = form.elements.nome.value.trim();
      estado.config.chavePix = form.elements.chavePix.value.trim();
      estado.config.diasAviso = Math.floor(dias) === dias && dias >= 0 && dias <= 31 ? dias : 3;
      salvar(); render(); toast('Dados salvos.');
    } else if (tipo === 'mensagens') {
      estado.config.modeloCobranca = form.elements.modeloCobranca.value.trim() || R.MODELO_COBRANCA;
      estado.config.modeloLembrete = form.elements.modeloLembrete.value.trim() || R.MODELO_LEMBRETE;
      salvar(); render(); toast('Textos salvos.');
    }
  });

  document.addEventListener('input', function (ev) {
    if (ev.target.dataset.campo === 'busca') { ui.busca = ev.target.value; desenharListaAlunos(); }
  });
  document.addEventListener('change', function (ev) {
    var c = ev.target.dataset.campo;
    if (c === 'filtro-cond') { ui.cond = ev.target.value; gravarLocal('filtroCond', ui.cond); render(); }
    else if (c === 'filtro-cond-alunos') { ui.condAlunos = ev.target.value; desenharListaAlunos(); }
    else if (c === 'inativos') { ui.inativos = ev.target.checked; desenharListaAlunos(); }
    else if (c === 'toggle-ativo') { $('#campo-inativo').hidden = ev.target.checked; }
  });
  $('#arquivo-backup').addEventListener('change', arquivoEscolhido);

  // Ao voltar para o app num outro dia, atualiza "hoje".
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && $('#folha').hidden) render();
  });

  // ---------- início ----------
  function iniciar() {
    ui.cond = lerLocal('filtroCond') || '';
    dbLer('estado').then(function (salvo) {
      if (salvo) estado = R.normalizarEstado(salvo, hoje());
    }).catch(function (e) {
      bloqueado = true;
      console.error(e);
    }).then(function () {
      render();
      pedirPersistencia();
      if (navigator.storage && navigator.storage.persisted) {
        navigator.storage.persisted().then(function (p) { ui.persistente = p; }).catch(function () {});
      }
    });
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }
  iniciar();
})();
