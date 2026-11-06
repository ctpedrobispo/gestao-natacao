# Natação – Mensalidades

App simples para a professora de natação controlar alunos e mensalidades nos condomínios.
Funciona no iPhone, sem internet, sem conta, sem servidor e sem mensalidade.
**Os dados ficam só no telefone dela.** Nada é enviado para lugar nenhum: as mensagens do
WhatsApp só saem quando ela mesma aperta "enviar".

## O que o app faz

- **Este mês:** quem pagou, quem vence nos próximos dias, quem está atrasado (inclusive de meses
  anteriores), total recebido × a receber, filtro por condomínio e troca de mês.
- **Marcar pago com um toque** (Pix ou dinheiro); "Desfazer" logo em seguida; "Alterar" para mudar data,
  forma ou valor.
- **Cobrar / Lembrete no WhatsApp:** abre o WhatsApp com a mensagem pronta (nome, mês, valor,
  vencimento, chave Pix). Os textos podem ser mudados em Ajustes.
- **Alunos** por condomínio, com busca pelo nome do aluno ou do responsável. Aluno que sai é
  **desativado** (o histórico fica guardado).
- **Condomínios:** cadastrar, editar, desativar.
- Vencimento no dia 29, 30 ou 31: nos meses mais curtos vale o último dia do mês.
- Mensalidade sem valor fica **vazia** (não vira zero e não entra no total).
- **Cópia de segurança** (arquivo .json) e **planilha** (.csv para Numbers/Excel).

## Como instalar no iPhone

1. Abra o link do app no **Safari** (não funciona instalar pelo Chrome do iPhone).
2. Toque em **Compartilhar** (quadrado com a seta para cima).
3. Role e toque em **Adicionar à Tela de Início** → **Adicionar**.
4. Use **sempre pelo ícone "Natação"** na tela de início.

> Importante: os dados do ícone e os dados da aba do Safari são **separados**. Cadastre tudo
> pelo ícone. Depois de instalado, o app abre mesmo sem internet.

## Cópia de segurança (faça toda semana)

O app avisa na tela inicial quando a última cópia tem mais de 7 dias.

**Fazer a cópia**
1. Ajustes → **Salvar cópia de segurança**.
2. No menu que abre, escolha **Salvar em Arquivos** (de preferência na pasta do iCloud Drive)
   ou mande o arquivo **no WhatsApp para você mesma**.
3. O arquivo se chama `natacao-copia-AAAA-MM-DD-HHMM.json`. Guarde as últimas.

**Restaurar (telefone novo, app apagado, ou algo deu errado)**
1. Instale o app de novo (passos acima).
2. Ajustes → **Restaurar de uma cópia** → escolha o arquivo `.json` mais recente.
3. Confira o resumo (quantos condomínios, alunos e pagamentos) e toque em **Restaurar**.

> ⚠️ **Nunca apague o ícone do app sem antes fazer uma cópia de segurança.** Apagar o ícone
> (ou "Limpar histórico e dados" do Safari) apaga todos os alunos e pagamentos do telefone.
> Sem a cópia, não há como recuperar.

## Planilha

Ajustes → **Planilha do mês** ou **Planilha de todos os pagamentos**. Abre no Numbers,
Excel ou Planilhas Google (separador `;`, valores com vírgula).

---

## Para quem mantém (Pedro)

- Arquivos do app: `index.html`, `estilo.css`, `regras.js` (regras, sem tela), `app.js` (telas),
  `sw.js` (funcionar offline), `manifest.webmanifest`, `icones/`. Sem bibliotecas, sem CDN.
- Testes das regras: `node --test` (status do mês, atraso, vencimento em meses curtos, mensagem e
  link do WhatsApp, cópia de segurança, planilha).
- Testar no computador: `node ferramentas/servidor.js` → http://127.0.0.1:8850
- Ícones: `node ferramentas/gerar-icones.js` (desenhados por código).
- **Mudou algum arquivo do app?** Suba o número em `sw.js` (`natacao-v1` → `natacao-v2`); senão o
  telefone continua com a versão antiga guardada. Ela precisa fechar e abrir o app 1–2 vezes.
- **Dados de alunos nunca entram neste repositório.** Os dados ficam no IndexedDB do telefone
  (banco `gestao-natacao`, chave `estado`). Ao restaurar uma cópia, o app guarda o estado anterior
  na chave `antesDeRestaurar`, por segurança.
- Telefone para o WhatsApp: precisa do DDD; o app põe o 55 na frente (`https://wa.me/55DDDNUMERO`).

### Versões

- **v1** (06/11/2026): primeira versão — condomínios, alunos, mensalidades do mês, atrasos de meses
  anteriores, WhatsApp com mensagem pronta, cópia de segurança, planilha, offline.
