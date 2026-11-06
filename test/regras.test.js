'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../regras.js');

function estadoExemplo() {
  const e = R.estadoVazio();
  e.config.nome = 'Carla';
  e.config.chavePix = 'carla@exemplo.com';
  e.condominios.push({ id: 'c1', nome: 'Jardins', obs: '', ativo: true });
  e.condominios.push({ id: 'c2', nome: 'Mar Azul', obs: '', ativo: true });
  e.alunos.push(
    { id: 'a1', condominioId: 'c1', nome: 'Ana Souza', responsavel: 'Maria Souza', telefone: '(81) 98888-7777', valor: 150, diaVencimento: 10, aulas: '', obs: '', inicio: '2026-01', ativo: true, inativoDesde: null },
    { id: 'a2', condominioId: 'c1', nome: 'Bruno Lima', responsavel: '', telefone: '81 3333-4444', valor: 120.5, diaVencimento: 5, aulas: '', obs: '', inicio: '2026-01', ativo: true, inativoDesde: null },
    { id: 'a3', condominioId: 'c2', nome: 'Caio Melo', responsavel: 'José', telefone: '', valor: null, diaVencimento: 31, aulas: '', obs: '', inicio: '2026-01', ativo: true, inativoDesde: null }
  );
  return R.normalizarEstado(e, '2026-11-06');
}

test('vencimento em meses curtos cai no último dia', () => {
  assert.equal(R.vencimentoNoMes('2026-02', 31), '2026-02-28');
  assert.equal(R.vencimentoNoMes('2028-02', 30), '2028-02-29'); // bissexto
  assert.equal(R.vencimentoNoMes('2026-02', 29), '2026-02-28');
  assert.equal(R.vencimentoNoMes('2026-04', 31), '2026-04-30');
  assert.equal(R.vencimentoNoMes('2026-01', 31), '2026-01-31');
  assert.equal(R.vencimentoNoMes('2026-11', 5), '2026-11-05');
  assert.equal(R.vencimentoNoMes('2026-11', null), null);
  assert.equal(R.vencimentoNoMes('2026-11', 0), null);
  assert.equal(R.vencimentoNoMes('2026-11', 32), null);
});

test('troca de mês e ano', () => {
  assert.equal(R.somarMeses('2026-12', 1), '2027-01');
  assert.equal(R.somarMeses('2026-01', -1), '2025-12');
  assert.equal(R.somarMeses('2026-11', -24), '2024-11');
  assert.equal(R.diffDias('2026-02-27', '2026-03-01'), 2);
  assert.equal(R.nomeMes('2026-03'), 'março/2026');
  assert.equal(R.nomeMesTitulo('2026-11'), 'Novembro 2026');
});

test('status: pago, atrasado, vence em breve, pendente', () => {
  const base = { mes: '2026-11', diaVencimento: 10, diasAviso: 3 };
  assert.equal(R.statusMensalidade({ ...base, pago: true, hoje: '2026-11-20' }).status, 'pago');
  const atr = R.statusMensalidade({ ...base, hoje: '2026-11-13' });
  assert.equal(atr.status, 'atrasado');
  assert.equal(atr.diasAtraso, 3);
  const hojeVence = R.statusMensalidade({ ...base, hoje: '2026-11-10' });
  assert.equal(hojeVence.status, 'vence');
  assert.equal(hojeVence.diasParaVencer, 0);
  assert.equal(R.statusMensalidade({ ...base, hoje: '2026-11-07' }).status, 'vence');
  const pend = R.statusMensalidade({ ...base, hoje: '2026-11-06' });
  assert.equal(pend.status, 'pendente');
  assert.equal(pend.diasParaVencer, 4);
  // mês futuro
  assert.equal(R.statusMensalidade({ ...base, mes: '2026-12', hoje: '2026-11-06' }).status, 'pendente');
  // mês passado sem pagar = atrasado
  assert.equal(R.statusMensalidade({ ...base, mes: '2026-09', hoje: '2026-11-06' }).status, 'atrasado');
});

test('atraso com vencimento dia 31 em fevereiro', () => {
  const s = R.statusMensalidade({ mes: '2026-02', diaVencimento: 31, hoje: '2026-03-02', diasAviso: 3 });
  assert.equal(s.vencimento, '2026-02-28');
  assert.equal(s.status, 'atrasado');
  assert.equal(s.diasAtraso, 2);
  assert.equal(R.statusMensalidade({ mes: '2026-02', diaVencimento: 31, hoje: '2026-02-28', diasAviso: 3 }).status, 'vence');
});

test('sem dia de vencimento: pendente no mês, atrasado depois', () => {
  assert.equal(R.statusMensalidade({ mes: '2026-11', diaVencimento: null, hoje: '2026-11-29', diasAviso: 3 }).status, 'pendente');
  const s = R.statusMensalidade({ mes: '2026-11', diaVencimento: null, hoje: '2026-12-02', diasAviso: 3 });
  assert.equal(s.status, 'atrasado');
  assert.equal(s.vencimento, null);
});

test('resumo do mês: totais recebido × a receber e valor vazio', () => {
  const e = estadoExemplo();
  R.marcarPago(e, 'a1', '2026-11', { data: '2026-11-04', forma: 'pix' });
  const r = R.resumoMes(e, '2026-11', '2026-11-06', '');
  assert.equal(r.itens.length, 3);
  assert.deepEqual(r.itens.map(i => i.status), ['atrasado', 'pendente', 'pago']);
  assert.equal(r.totais.recebido, 150);
  assert.equal(r.totais.qtdPagos, 1);
  assert.equal(r.totais.aReceber, 120.5); // Caio sem valor não entra como zero
  assert.equal(r.totais.qtdSemValor, 1);
  assert.equal(r.totais.qtdAtrasados, 1);
  const so1 = R.resumoMes(e, '2026-11', '2026-11-06', 'c2');
  assert.equal(so1.itens.length, 1);
  assert.equal(so1.itens[0].aluno.nome, 'Caio Melo');
  assert.equal(so1.itens[0].valor, null);
});

test('desfazer pagamento volta para aberto', () => {
  const e = estadoExemplo();
  R.marcarPago(e, 'a2', '2026-11', { data: '2026-11-06', forma: 'dinheiro' });
  assert.equal(R.resumoMes(e, '2026-11', '2026-11-06', '').totais.qtdPagos, 1);
  assert.equal(R.desfazerPagamento(e, 'a2', '2026-11'), true);
  assert.equal(R.resumoMes(e, '2026-11', '2026-11-06', '').totais.qtdPagos, 0);
  // marcar duas vezes não duplica
  R.marcarPago(e, 'a2', '2026-11', { data: '2026-11-06', forma: 'pix' });
  R.marcarPago(e, 'a2', '2026-11', { data: '2026-11-07', forma: 'dinheiro' });
  assert.equal(e.pagamentos.length, 1);
  assert.equal(e.pagamentos[0].forma, 'dinheiro');
});

test('valor pago fica guardado mesmo se a mensalidade mudar depois', () => {
  const e = estadoExemplo();
  R.marcarPago(e, 'a1', '2026-10', { data: '2026-10-09', forma: 'pix' });
  e.alunos[0].valor = 180;
  const r = R.resumoMes(e, '2026-10', '2026-11-06', '');
  assert.equal(r.itens.find(i => i.aluno.id === 'a1').valor, 150);
});

test('aluno inativo e aluno que começou depois', () => {
  const e = estadoExemplo();
  e.alunos[1].ativo = false;
  e.alunos[1].inativoDesde = '2026-11';
  e.alunos[2].inicio = '2026-12';
  const nov = R.resumoMes(e, '2026-11', '2026-11-06', '');
  assert.deepEqual(nov.itens.map(i => i.aluno.id), ['a1']);
  const out = R.resumoMes(e, '2026-10', '2026-11-06', '');
  assert.ok(out.itens.some(i => i.aluno.id === 'a2')); // em outubro ainda devia
  // histórico pago aparece mesmo se inativo
  R.marcarPago(e, 'a2', '2026-11', { data: '2026-11-02', forma: 'pix' });
  assert.ok(R.resumoMes(e, '2026-11', '2026-11-06', '').itens.some(i => i.aluno.id === 'a2'));
});

test('condomínio desativado some da lista do mês', () => {
  const e = estadoExemplo();
  e.condominios[1].ativo = false;
  assert.equal(R.resumoMes(e, '2026-11', '2026-11-06', '').itens.length, 2);
});

test('pendências de meses anteriores', () => {
  const e = estadoExemplo();
  e.alunos.forEach(a => { a.inicio = '2026-09'; });
  R.marcarPago(e, 'a1', '2026-09', { data: '2026-09-10', forma: 'pix' });
  R.marcarPago(e, 'a1', '2026-10', { data: '2026-10-10', forma: 'pix' });
  R.marcarPago(e, 'a2', '2026-09', { data: '2026-09-05', forma: 'pix' });
  const p = R.pendenciasAnteriores(e, '2026-11', '2026-11-06', '');
  // a2 deve outubro; a3 deve setembro e outubro (sem valor)
  assert.deepEqual(p.itens.map(i => i.aluno.id + ' ' + i.mes), ['a3 2026-09', 'a2 2026-10', 'a3 2026-10']);
  assert.equal(p.total, 120.5);
  assert.equal(p.qtdSemValor, 2);
});

test('telefone para o WhatsApp', () => {
  assert.equal(R.normalizarTelefone('(81) 98888-7777'), '5581988887777');
  assert.equal(R.normalizarTelefone('81 3333-4444'), '558133334444');
  assert.equal(R.normalizarTelefone('+55 81 98888-7777'), '5581988887777');
  assert.equal(R.normalizarTelefone('0 81 98888-7777'), '5581988887777');
  assert.equal(R.normalizarTelefone('55 91234-5678'), '5555912345678'); // DDD 55 (RS)
  assert.equal(R.normalizarTelefone('98888-7777'), null); // sem DDD
  assert.equal(R.normalizarTelefone(''), null);
});

test('mensagem de cobrança pronta e link do WhatsApp', () => {
  const e = estadoExemplo();
  const r = R.resumoMes(e, '2026-11', '2026-11-13', '');
  const ana = r.itens.find(i => i.aluno.id === 'a1');
  assert.equal(ana.status, 'atrasado');
  assert.equal(R.tipoMensagem(ana), 'cobranca');
  const msg = R.mensagemDoItem(ana, e.config);
  assert.equal(msg, [
    'Olá, Maria! Tudo bem?',
    'Passando para lembrar da mensalidade da natação de Ana, referente a novembro/2026.',
    'Vencimento: 10/11/2026',
    'Valor: R$ 150,00',
    'Chave Pix: carla@exemplo.com',
    'Se já pagou, por favor desconsidere esta mensagem. Obrigada!',
    'Carla'
  ].join('\n'));
  const link = R.linkWhatsApp(ana.aluno.telefone, msg);
  assert.ok(link.startsWith('https://wa.me/5581988887777?text='));
  assert.equal(decodeURIComponent(link.split('?text=')[1]), msg);
  assert.ok(!link.includes(' '));
});

test('lembrete sem valor e sem Pix: as linhas vazias saem', () => {
  const e = estadoExemplo();
  e.config.chavePix = '';
  const caio = R.resumoMes(e, '2026-11', '2026-11-06', '').itens.find(i => i.aluno.id === 'a3');
  assert.equal(R.tipoMensagem(caio), 'lembrete');
  const msg = R.mensagemDoItem(caio, e.config);
  assert.ok(!msg.includes('Valor:'));
  assert.ok(!msg.includes('Chave Pix'));
  assert.ok(msg.startsWith('Olá, José!'));
  assert.ok(msg.includes('vence em 30/11/2026'));
});

test('modelo editado: campo desconhecido fica como está', () => {
  const d = { contato: 'Maria', valor: 'R$ 10,00' };
  assert.equal(R.montarMensagem('Oi {contato}, {valor} {outro}', d), 'Oi Maria, R$ 10,00 {outro}');
  assert.equal(R.montarMensagem('Oi {contato}\r\nValor: {valor}', d), 'Oi Maria\nValor: R$ 10,00');
});

test('dinheiro: ler e escrever no formato brasileiro', () => {
  assert.equal(R.formatarMoeda(150), 'R$ 150,00');
  assert.equal(R.formatarMoeda(1234.5), 'R$ 1.234,50');
  assert.equal(R.formatarMoeda(null), '');
  assert.equal(R.lerValor('150'), 150);
  assert.equal(R.lerValor('150,50'), 150.5);
  assert.equal(R.lerValor('R$ 1.250,00'), 1250);
  assert.equal(R.lerValor('1.250'), 1250);
  assert.equal(R.lerValor('99.90'), 99.9);
  assert.equal(R.lerValor(''), null);
  assert.equal(R.lerValor('   '), null);
  assert.ok(Number.isNaN(R.lerValor('abc')));
  assert.ok(Number.isNaN(R.lerValor('-5')));
});

test('busca por nome sem acento e pelo responsável', () => {
  const e = estadoExemplo();
  assert.deepEqual(R.buscarAlunos(e.alunos, 'ana').map(a => a.id), ['a1']);
  assert.deepEqual(R.buscarAlunos(e.alunos, 'JOSE').map(a => a.id), ['a3']);
  assert.equal(R.buscarAlunos(e.alunos, '').length, 3);
});

test('cópia de segurança: exportar e importar de volta igual', () => {
  const e = estadoExemplo();
  R.marcarPago(e, 'a1', '2026-11', { data: '2026-11-04', forma: 'pix' });
  e.avisos[R.chave('a2', '2026-11')] = '2026-11-06';
  const texto = R.criarBackup(e, '2026-11-06T12:00:00.000Z');
  const lido = R.lerBackup(texto, '2026-11-06');
  assert.equal(lido.ok, true);
  assert.deepEqual(lido.estado, e);
  assert.deepEqual(lido.resumo, { geradoEm: '2026-11-06T12:00:00.000Z', condominios: 2, alunos: 3, pagamentos: 1 });
  // valor vazio continua vazio (não vira zero)
  assert.equal(lido.estado.alunos[2].valor, null);
});

test('importar arquivo errado não aceita', () => {
  assert.equal(R.lerBackup('não é json').ok, false);
  assert.equal(R.lerBackup('{"a":1}').ok, false);
  assert.equal(R.lerBackup(JSON.stringify({ app: 'gestao-natacao', dados: { condominios: 'x' } })).ok, false);
  assert.equal(R.lerBackup(JSON.stringify({ app: 'gestao-natacao', dados: { condominios: [], alunos: [{ id: 'x' }] } })).ok, false);
});

test('importar dados antigos completa o que falta', () => {
  const r = R.lerBackup(JSON.stringify({
    app: 'gestao-natacao',
    dados: { condominios: [{ id: 'c', nome: 'X' }], alunos: [{ id: 'a', nome: 'Y', condominioId: 'c', valor: '' }] }
  }), '2026-11-06');
  assert.equal(r.ok, true);
  assert.equal(r.estado.alunos[0].valor, null);
  assert.equal(r.estado.alunos[0].inicio, '2026-11');
  assert.equal(r.estado.config.diasAviso, 3);
  assert.equal(r.estado.config.modeloCobranca, R.MODELO_COBRANCA);
});

test('aviso de backup com mais de 7 dias', () => {
  const e = estadoExemplo();
  assert.deepEqual(R.situacaoBackup(e, '2026-11-06'), { precisa: true, dias: null });
  e.ultimoBackup = '2026-10-30T10:00:00.000Z';
  assert.equal(R.situacaoBackup(e, '2026-11-06').precisa, false); // 7 dias
  assert.equal(R.situacaoBackup(e, '2026-11-07').precisa, true); // 8 dias
  assert.equal(R.situacaoBackup(R.estadoVazio(), '2026-11-06').precisa, false); // sem dados
});

test('planilha CSV com ; e aspas', () => {
  assert.equal(R.campoCSV('a;b'), '"a;b"');
  assert.equal(R.campoCSV('diz "oi"'), '"diz ""oi"""');
  assert.equal(R.campoCSV(null), '');
  const e = estadoExemplo();
  R.marcarPago(e, 'a1', '2026-11', { data: '2026-11-04', forma: 'pix' });
  const csv = R.csvDoMes(e, '2026-11', '2026-11-13', '');
  assert.ok(csv.startsWith('﻿Mês;Condomínio;Aluno'));
  assert.ok(csv.includes('novembro/2026;Jardins;Ana Souza;Maria Souza;(81) 98888-7777;150,00;10/11/2026;Pago;;04/11/2026;Pix'));
  assert.ok(csv.includes('Caio Melo;José;;;30/11/2026;A vencer'));
  const todos = R.csvPagamentos(e);
  assert.ok(todos.includes('novembro/2026;Jardins;Ana Souza;Maria Souza;150,00;04/11/2026;Pix'));
});
