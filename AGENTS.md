# AGENTS.md — Regras Permanentes do Projeto Tucano Cloud (Tucano Auto Peças)

> Este arquivo vale para **qualquer agente** (Antigravity, Gemini, Claude etc.) que editar este repositório.
> Leia-o **inteiro** antes de tocar em qualquer arquivo. Em caso de conflito, este arquivo prevalece sobre
> preferências do agente. O plano de evolução está em `docs/PLANO_IMPLEMENTACAO.md`.

---

## 1. Arquitetura (NÃO MUDAR)

| Camada | Tecnologia | Observação |
|---|---|---|
| Desktop | Tauri v2 (`src-tauri/`) | `frontendDist: ../src`, `withGlobalTauri: true`, plugin `opener` já instalado |
| UI principal | `src/index.html` (HTML + CSS + JS inline em **arquivo único**) | ~3.000 linhas — **nunca reescrever inteiro** |
| Módulos JS auxiliares | `src/js/*.js` (scripts clássicos, sem bundler) | carregados por `<script src="js/...">` **antes** do `<script>` inline principal |
| Bibliotecas (CDN) | Tailwind CDN, SweetAlert2 11, IMask, Firebase 9.23.0 **compat** (app/auth/database) | não trocar versões |
| Banco | Firebase Realtime Database | nós: `/vales`, `/notasPrazo`, `/clientes`, `/configuracoes`, `/sequencias` |
| Regras | `database.rules.json` | deploy é **manual** pelo operador (`firebase deploy --only database`) |
| Testes | Node puro (`tests/*.cjs`) | sem Jest/Mocha; usar `assert` + `vm` |

**Proibido:** React, Vue, Svelte, TypeScript, bundlers (Vite/Webpack), ES Modules (`import/export`) no front-end,
novas dependências npm de runtime, troca do Firebase compat por modular.

### 1.1 Ordem obrigatória de carregamento em `src/index.html`
```html
<script src="firebase-config.js"></script>
<script src="js/nucleo-financeiro.js"></script>   <!-- Fase 0 -->
<script src="js/clientes.js"></script>            <!-- Fase 1 -->
<script src="js/relatorios.js"></script>          <!-- Fase 2 -->
<script src="js/configuracoes.js"></script>       <!-- Fase 3 -->
<script src="js/impressao.js"></script>           <!-- Fase 3 -->
<script src="js/whatsapp.js"></script>            <!-- Fase 4 -->
<script src="js/backup-v3.js"></script>           <!-- Fase 4 -->
<script src="js/seguranca.js"></script>           <!-- Fase 4 -->
<script>  /* script principal inline (já existente) */ </script>
```

### 1.2 Regras para módulos `src/js/*.js`
1. No **nível superior** do arquivo use **somente** `function nome(...) {}` e `var NOME = ...;` (nunca `const`/`let`/`class`
   no topo) — isso permite que os testes carreguem o arquivo com `vm.runInContext`.
2. **Nenhum** código no topo pode tocar `document`, `window`, `database`, `auth`, `Swal`, `IMask` ou `localStorage`.
   Inicialização de UI fica dentro de `function inicializarModuloXxx()` chamada no final do script inline do `index.html`.
3. **Nunca** declarar um nome global que já exista no `index.html` (ex.: `escapeHtml`, `fD`, `toF`, `database`, `auth`,
   `listaGlobalNotasPrazo`, `calcularSituacaoNota`...). Um nome duplicado entre `var` (módulo) e `let/const` (inline)
   gera `SyntaxError` e **derruba o sistema inteiro**. O teste `tests/test_integridade_index.cjs` verifica isso.
4. Funções **puras** (sem DOM/Firebase) ficam no topo do módulo e são testadas em `tests/`.
   Funções de **UI** podem usar globais do `index.html` (`database`, `auth`, `escapeHtml`, `formatadorMoeda`, `Swal`)
   **apenas em tempo de execução** (dentro do corpo da função).
5. Código de uma fase só chama **sem guarda** funções de fases anteriores/mesma fase. Para chamar algo de fase futura use
   `if (typeof nomeFuncao === 'function') nomeFuncao(...)`.

---

## 2. BLINDAGEM ANTI-TRUNCAMENTO (REGRA DE OURO)

1. **É TERMINANTEMENTE PROIBIDO** escrever `// ... resto do código ...`, `/* ... */`, `<!-- ... -->`, `// (código existente)`
   ou qualquer marcador que omita linhas. Todo trecho escrito deve estar **completo**.
2. **Nunca** sobrescrever `src/index.html` inteiro (nada de `write_to_file` com `Overwrite=true` nesse arquivo).
   Use **somente** edições cirúrgicas por âncora (`replace_file_content` / `multi_replace_file_content`).
3. Âncoras textuais do `docs/PLANO_IMPLEMENTACAO.md` são a referência oficial; números de linha são aproximados
   (baseline commit `742dc38`, 2.952 linhas) e mudam a cada edição.
4. Após **cada** edição em `src/index.html`:
   - `node tests/test_integridade_index.cjs` deve passar;
   - o arquivo deve terminar em `</html>`;
   - `git diff --numstat src/index.html` não pode mostrar mais linhas removidas do que o "Orçamento de remoção" da tarefa.
5. Se uma âncora não for encontrada **exatamente**, PARE, releia o trecho com `view_file` e ajuste a âncora.
   Nunca "chute" substituições amplas.

---

## 3. Regras Financeiras (inegociáveis)

1. **Dinheiro em centavos inteiros** para qualquer soma/comparação: use `moedaParaCentavos()`, `centavosParaReais()`,
   `somarValoresMoeda()`, `arredondarMoeda()` de `src/js/nucleo-financeiro.js`. Proibido comparar floats com tolerância
   (`+ 0.001`) em código novo. Valores gravados no banco continuam em **reais (number com 2 casas)** por compatibilidade.
2. **Datas de negócio** (emissão, vencimento, pagamento, baixa, "hoje", nomes de arquivo) sempre via
   `obterDataLocalISO()` (fuso fixo `America/Sao_Paulo`, formato `YYYY-MM-DD`).
   **Proibido** `new Date().toISOString().split('T')[0]` e `input.valueAsDate = new Date()`.
   `toISOString()` só é permitido para **timestamps de auditoria** (`criadoEm`, `atualizadoEm`, `exportedAt`, `canceladaEm`...).
3. Toda escrita financeira concorrente (baixa, estorno, cancelamento, criação de vale, sequências) usa
   `ref.transaction()` e revalida o estado **dentro** da transação.
4. Sequências `NP-XXXXXX`, `REC-XXXXXX`, `CLI-XXXX` são atômicas (`/sequencias/*`) e nunca reutilizadas.
   Número reservado e não utilizado é registrado em `/sequencias/notasInutilizadas` ou `/sequencias/recibosInutilizados`.
5. Operações financeiras exigem conexão: chamar `garantirConexaoParaOperacaoFinanceira('Descrição')` antes.
6. Nada é apagado no módulo Notas a Prazo: cancelamento e estorno são **marcações** com motivo, operador e data.
   Nota com pagamento **ativo** não pode ser cancelada (estornar antes).
7. Recibo impresso é **documento histórico**: usa `saldoAnterior`/`saldoApos` gravados no pagamento.
8. Backups: merge **100% não-destrutivo**; nunca `set()` sobre registro existente; compatível com V1, V2 e V3.
9. **Proibido** alterar fluxo visual/funcional do módulo **Vales** além das correções cirúrgicas da Fase 0.

---

## 4. Convenções de Código

- Idioma: **Português do Brasil** em nomes de funções, variáveis, mensagens e comentários.
- Nomes: `camelCase` para funções/variáveis, `MAIUSCULAS_COM_UNDERLINE` para constantes de módulo.
- IDs HTML novos: `camelCase` descritivo e **único** (ex.: `btnFichaWhatsAppCobranca`). Nunca renomear IDs existentes.
- Todo texto vindo do banco inserido em HTML passa por `escapeHtml()` (UI) ou `nucleoEscapeHtml()` (funções puras).
- Comentário de rastreio em todo bloco novo: `// [FASE N / T-XXX] descrição curta`.
- Mensagens ao operador: SweetAlert2 (`Swal.fire`), claras, educadas, em português.
- Arquivos em UTF-8 sem BOM; preserve a quebra de linha existente de cada arquivo.
- Não criar arquivos `.json` com "backup" no nome dentro do repositório (bloqueados pelo `.gitignore`).

---

## 5. Comandos Obrigatórios (rodar na pasta raiz do repositório)

```powershell
# Suíte completa (OBRIGATÓRIO antes de qualquer commit)
node tests/run_suite_completa.cjs

# Suítes legadas (devem continuar 100% verdes)
node tests/run_all_audits.cjs
node tests/test_rules_semantics.cjs

# Integridade do index.html (após CADA edição)
node tests/test_integridade_index.cjs

# Conferir remoções
git diff --numstat src/index.html
```
Enquanto `tests/run_suite_completa.cjs` não existir (antes da T-001), rode as duas suítes legadas.

**Commit:** somente com a suíte 100% verde. Mensagem: `feat(faseN): T-XXX descrição curta`. Um commit por tarefa.
**Deploy de regras/Firebase:** nunca executar automaticamente — listar no relatório para o operador.

---

## 6. Mapa de Documentos

| Documento | Uso |
|---|---|
| `docs/PLANO_IMPLEMENTACAO.md` | Diagnóstico, decisões, modelo de dados e tarefas atômicas com código |
| `docs/TASKS.md` | Checklist mestre de progresso |
| `docs/QUALITY_GATES.md` | Verificações obrigatórias por tarefa e por fase |
| `docs/PROMPTS_EXECUCAO.md` | Prompts prontos por fase para o executor |
