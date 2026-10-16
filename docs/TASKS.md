# TASKS.md — Checklist Mestre de Progresso do Tucano Cloud

> Rastreamento oficial das fases e tarefas atômicas de implementação do sistema Tucano Cloud (Tucano Auto Peças), em conformidade estrita com o `AGENTS.md`.

---

## 🟢 FASE 0: Núcleo Financeiro, Correções Críticas e Blindagem de Testes (CONCLUÍDA)

- [x] **T-001: Criar Módulo `src/js/nucleo-financeiro.js`**
  - [x] Aritmética monetária em centavos inteiros (`moedaParaCentavos`, `centavosParaReais`, `arredondarMoeda`, `somarValoresMoeda`).
  - [x] Datas de negócio seguras no fuso `America/Sao_Paulo` (`obterDataLocalISO`, `adicionarMesesDataLocalISO`, `calcularDiferencaDiasISO`).
  - [x] Conversão de valores monetários por extenso em português do Brasil (`valorPorExtensoBRL`).
  - [x] Utilitários e guardas (`nucleoEscapeHtml`, `estadoConexaoFirebase`, `atualizarEstadoConexaoNucleo`, `garantirConexaoParaOperacaoFinanceira`).
  - [x] Isolamento absoluto de escopo (somente `var` e `function` no topo, sem acesso a DOM/Firebase).

- [x] **T-002: Carregamento Modular em `src/index.html`**
  - [x] Inclusão de `<script src="js/nucleo-financeiro.js"></script>` logo após `firebase-config.js`.

- [x] **T-003: Aplicação de Correções Cirúrgicas em `src/index.html`**
  - [x] **Item 1: Datas de Negócio Locais:** Migração completa de `toISOString().split('T')[0]` e `valueAsDate = new Date()` para `obterDataLocalISO()` e `adicionarMesesDataLocalISO(hojeISO, 3)` em `verificarSeVencido`, `confirmarProcessoDeBaixa`, `exportarValesCSV`, `gerarBackupDadosJSON`, `resetDatas`, `resetDatasNotaPrazo`, `abrirModalBaixaNota`, `calcularSituacaoNota`, `atualizarDashboardNotasPrazo` e `atualizarTabelaNotasPrazo`.
  - [x] **Item 2: Aritmética em Centavos Inteiros:** Uso de `moedaParaCentavos` e `centavosParaReais` em `calcularSaldoRestante(vale)` e `calcularSituacaoNota(nota)`.
  - [x] **Item 3: Monitor de Conexão e Guardas:** Invocação de `atualizarEstadoConexaoNucleo(isConnected)` no listener `.info/connected` e guarda `garantirConexaoParaOperacaoFinanceira` nas 6 escritas (`formCadastroVale`, `confirmarProcessoDeBaixa`, `formCadastroNotaPrazo`, `confirmarProcessoDeBaixaNota`, `solicitarCancelamentoNota`, `solicitarEstornoPagamento`).
  - [x] **Item 4: Unicidade e Rastreabilidade de Sequências:** Prevenção ativa de colisão de ID em `formCadastroVale` e descarte auditado em `sequencias/recibosInutilizados` quando transação não comitar.
  - [x] **Item 5: Bloqueio de Cancelamento com Pagamentos Ativos:** Exigência de `!temPagto` no botão da tabela e rejeição estrita na transação com motivo `PAGAMENTOS_ATIVOS`.
  - [x] **Item 6: Fidelidade Histórica e Extenso em Recibos A4:** Respeito aos campos imutáveis `pagto.saldoAnterior` e `pagto.saldoApos` com fallback histórico estrito e inclusão de `valorPorExtensoBRL(valorPago)` na Declaração de Recebimento.
  - [x] **Item 7: Limpeza de Memória no Logout:** Esvaziamento completo de `valesMap = {};` e `listaGlobalVales = [];` ao deslogar.

- [x] **T-004: Blindagem da Suíte de Testes Automatizada**
  - [x] `tests/test_nucleo_financeiro.cjs`: testes unitários do núcleo em contexto VM puro.
  - [x] `tests/test_integridade_index.cjs`: testes de fechamento `</html>`, ausência de marcadores de truncamento, validação de sintaxe V8, isolamento de escopo sem colisões e auditoria dos helpers da Fase 0.
  - [x] `tests/run_suite_completa.cjs`: orquestrador com 100% dos testes verdes.

---

## 🟢 FASE 1: Gestão de Clientes, Carteira e Conciliação de Notas Antigas (CONCLUÍDA)

- [x] **T-101: Criar Módulo `src/js/clientes.js`**
  - [x] **Parte 1 (Funções Puras de Domínio):** `normalizarNomeCliente`, `limparDigitosDocumento`, `validarCPF`, `validarCNPJ`, `validarEFormatarCpfCnpj`, `normalizarTelefoneCliente`, `notaPertenceAoCliente`.
  - [x] **Carteira e Auto-Soma em Centavos:** `calcularResumoCarteiraCliente` (aritmética inteira, total emitido bruto/líquido/cancelado/recebido, saldo devedor, contagem de status/vencidas, histórico de pagamentos e controle de limite de crédito).
  - [x] **Consolidação Geral e Órfãs:** `consolidarCarteiraGeralClientes` (agrupamento de clientes cadastrados + notas órfãs virtuais com totais gerais em centavos inteiros).
  - [x] **Assistente de Conciliação em Lote:** `gerarSugestoesConciliacaoClientes` para migração não-destrutiva de notas legadas.
  - [x] **Parte 2 (Firebase, UI e Modais):** `obterProximoCodigoCliente` (`CLI-XXXX` atômico), `iniciarListenerClientes`, `encerrarListenerClientes`, `alternarSubAbaNotasPrazo`, `aoSelecionarOuDigitarClienteNota`, `definirFiltroCarteiraClientes`, `atualizarTabelaCarteiraClientes`, `abrirModalFormCliente`, `salvarCadastroClienteModal`, `abrirModalFichaCliente`, `imprimirExtratoClienteA4`, `abrirModalConciliacaoClientes`, `executarConciliacaoClientesConfirmada`.
  - [x] Blindagem anti-colisão e compatibilidade com VM V8 (`var` e `function` no topo).

- [x] **T-102: Integração Cirúrgica de Clientes em `src/index.html`**
  - [x] Inclusão de `<script src="js/clientes.js"></script>` logo após `js/nucleo-financeiro.js`.
  - [x] Sub-navegação elegante na aba Notas a Prazo (`btnSubAbaLancamentos` vs `btnSubAbaClientes`, `btnConciliacaoRapida` com badge dinâmico e `➕ Novo Cliente`).
  - [x] Sub-aba `subAbaConteudoClientes` com 4 cards de KPIs da carteira, barra de pesquisa, filtros rápidos (`Todos`, `Com Saldo`, `Vencidos`, `Sem Saldo`, `Limite Excedido`) e tabela com rodapé de Auto-Soma.
  - [x] Autocomplete e resumo do cliente no formulário (`campoNotaClienteId`, `listaClientesAutocomplete`, `#boxResumoClienteNota`).
  - [x] Validação de Limite de Crédito com alerta confirmatório `Swal.fire` no submit de `formCadastroNotaPrazo`.
  - [x] Gravação de `clienteId` nas novas notas emitidas.
  - [x] Modais HTML inseridos: `#modalCadastroCliente`, `#modalFichaCliente` (ficha completa com extrato A4), `#modalConciliacaoClientes`.
  - [x] Ciclo de vida: `iniciarListenerClientes()` no login e `encerrarListenerClientes()` no logout em `auth.onAuthStateChanged`.

- [x] **T-103: Regras de Segurança e Blindagem de Testes da Fase 1**
  - [x] Regras de segurança em `database.rules.json` para `/clientes` e `/sequencias/clientes`.
  - [x] Testes semânticos de regras em `tests/test_rules_semantics.cjs` (item 7).
  - [x] Suíte unitária e de domínio em `tests/test_fase1_clientes.cjs` (100% verde).
  - [x] Auditoria de integração da UI em `tests/test_integridade_index.cjs` (item 7).
  - [x] Orquestrador `tests/run_suite_completa.cjs` atualizado com todas as 5 suítes passando.

---

## 🚀 FASE 2: Relatórios Analíticos com Auto-Soma em Tempo Real, Filtros e CSV (CONCLUÍDA)
- [x] **T-201:** Criar `src/js/relatorios.js` com motor puro de filtragem, cálculos em centavos inteiros e auto-soma.
  - [x] `resolverIntervaloPeriodoRelatorio`: cálculo dinâmico de datas para 8 atalhos e períodos personalizados.
  - [x] `classificarFaixaVencimentoNota`: classificação matemática de faixas de atraso (Aging: `A_VENCER`, `VENCE_HOJE`, `ATRASO_1_30`, `ATRASO_31_60`, `ATRASO_61_90`, `ATRASO_MAIS_90`).
  - [x] `gerarRelatorioNotasDetalhado`: auto-soma garantida em centavos com prova matemática (linhas == saldo == faixas == clientes == CSV).
  - [x] `gerarRelatorioPagamentosRecebidos`: relatório de fluxo de caixa com subtotais por forma de pagamento e por dia.
  - [x] `gerarCSVRelatorioNotas` e `gerarCSVRelatorioPagamentos`: exportação padrão Microsoft Excel com BOM UTF-8 (`\uFEFF`), delimitador `;` e linha final `TOTAL GERAL (AUTO-SOMA)`.
  - [x] Impressão A4 completa via `imprimirRelatorioAtualA4()`.
- [x] **T-202:** Integrar Sub-Aba de Relatórios em `src/index.html` e `src/js/clientes.js`.
  - [x] Carregamento seguro de `js/relatorios.js` respeitando a ordem canônica de `AGENTS.md`.
  - [x] Botão `#btnSubAbaNotasRelatorios` (`📊 Relatórios & Auto-Soma`) na sub-navegação.
  - [x] Suporte à 3ª sub-aba em `alternarSubAbaNotasPrazo('relatorios')`.
  - [x] Container `#subAbaNotasRelatorios` com seletores, cards de auto-soma em tempo real, painel dinâmico e tabela com rodapé `<tfoot>` fixo de Auto-Soma.
- [x] **T-203:** Testes Automatizados e Auditorias da Fase 2.
  - [x] Criado `tests/test_fase2_relatorios.cjs` validando todas as funções puras e invariantes matemáticas em VM isolada.
  - [x] Atualizado `tests/test_integridade_index.cjs` com Item 8 (validação dos elementos de UI e scripts da Fase 2).
  - [x] Adicionado ao orquestrador `tests/run_suite_completa.cjs` com todas as 6 suítes passando 100%.

---

## 🚀 FASE 3: Configurações da Empresa/PIX e Motor de Impressão Profissional A4 Multipágina (CONCLUÍDA)
- [x] **T-301:** Criar `src/js/configuracoes.js` (Dados da Empresa, Chave PIX e Parâmetros de Cobrança).
  - [x] Funções puras VM-safe: `CONFIG_EMPRESA_PADRAO`, `normalizarConfiguracoesEmpresa`, `obterConfiguracoesEmpresaSegura`, `validarDadosConfiguracaoEmpresa`.
  - [x] Sincronização em tempo real via `database.ref('configuracoes/empresa')` com fallback local imediato em `localStorage`.
  - [x] Modal de Configurações da Empresa (`#modalConfiguracoesEmpresa`) com proteção por `garantirConexaoParaOperacaoFinanceira` e `validarSenhaMaster`.
- [x] **T-302:** Criar `src/js/impressao.js` (Motor de Impressão A4 Multipágina, Cabeçalhos Oficiais, Recibos 1ª/2ª Via, Estorno e Extratos).
  - [x] Geradores HTML A4 puros: `gerarCabecalhoEmpresaPrintHtml`, `gerarBlocoPixPrintHtml`.
  - [x] Layout A4 oficial para Nota a Prazo (`gerarHtmlImpressaoNotaPrazoA4`) com dados da empresa, cliente, termos de confissão de dívida e bloco PIX.
  - [x] Layout A4 oficial para Recibos (`gerarHtmlImpressaoReciboPagamentoA4`) com distinção entre Recibo Parcial, Quitação Definitiva, marcação de 2ª Via e Comprovante de Estorno (`status === 'ESTORNADO'`).
  - [x] Extrato da Conta Corrente do Cliente (`gerarHtmlImpressaoExtratoClienteA4`) com paginação `.a4-print-relatorio`, auto-soma completa e bloco PIX para liquidação.
  - [x] Relatórios Analíticos Multipágina (`gerarHtmlImpressaoRelatorioA4`) com repetidores de cabeçalho (`thead`) e rodapé (`tfoot`) de auto-soma.
  - [x] Disparadores DOM: `executarImpressaoHtmlNaAreaFinal`, `reimprimirReciboSegundaViaA4` e `dispararImpressaoExtratoClienteA4`.
- [x] **T-303:** Atualizar CSS `@media print` e Integrar Fase 3 em `src/index.html`, `src/js/clientes.js` e `src/js/relatorios.js`.
  - [x] Estilo `@media print` com regras para `.a4-print-relatorio` (page-break-inside avoid, thead table-header-group, tfoot table-footer-group).
  - [x] Inclusão dos scripts em ordem canônica: `relatorios.js -> configuracoes.js -> impressao.js`.
  - [x] Botão `⚙️ Empresa / PIX` (`#btnAbrirConfigEmpresa`) adicionado ao cabeçalho principal.
  - [x] Modal `#modalConfiguracoesEmpresa` adicionado ao HTML.
  - [x] `auth.onAuthStateChanged` iniciando e encerrando listeners de configurações.
  - [x] Conexão das rotinas legadas e novas de impressão aos geradores da Fase 3.
- [x] **T-304:** Atualizar `database.rules.json` e Suíte de Testes da Fase 3.
  - [x] Regras de segurança no RTDB para `/configuracoes/empresa` com validação de campos essenciais.
  - [x] Criado `tests/test_fase3_impressao_config.cjs` cobrindo 100% das funções puras de configuração e geradores A4.
  - [x] Atualizado `tests/test_rules_semantics.cjs` (Item 8) e `tests/test_integridade_index.cjs` (Item 9).
  - [x] Orquestrador `tests/run_suite_completa.cjs` atualizado com todas as 7 suítes passando 100%.

---

## 🚀 FASE 4 FINAL: Central WhatsApp, Backup Schema V3 e Segurança Sincronizada (CONCLUÍDA)
- [x] **T-401:** Criar `src/js/whatsapp.js` (Templates Transparentes de WhatsApp, Lembretes, Cobrança, Recibos e Deep Links).
  - [x] `construirUrlWhatsApp`: normalização telefônica com DDI 55, DDD e codificação URI para `wa.me` e `whatsapp://send`.
  - [x] Templates de mensagens transparentes e cordiais:
    - [x] Emissão de Nota a Prazo (`gerarMensagemWhatsAppEmissaoNota`).
    - [x] Comprovante de Pagamento e Quitação (`gerarMensagemWhatsAppReciboPagamento`).
    - [x] Lembrete de Vencimento Próximo/Hoje (`gerarMensagemWhatsAppLembreteVencimento`).
    - [x] Cobrança de Nota Vencida (`gerarMensagemWhatsAppCobrancaNota`).
    - [x] Extrato da Conta Corrente do Cliente com Auto-Soma (`gerarMensagemWhatsAppExtratoCliente`).
    - [x] Resumo Executivo de Relatórios (`gerarMensagemWhatsAppResumoRelatorio`).
  - [x] Central de Alertas: `listarAlertasVencimentoECobranca` agrupando Vencendo Hoje, Próximos Dias e Vencidas com soma em centavos.
  - [x] Disparo seguro compatível com Tauri v2 (`plugin:opener`) e fallback para navegador via `abrirUrlExternaWhatsApp`.
  - [x] Modal de revisão e edição prévia (`abrirModalEnvioWhatsApp`) com registro não-destrutivo de auditoria (`ultimaComunicacaoWhatsApp`).
- [x] **T-402:** Criar `src/js/backup-v3.js` (Backup e Importação Schema V3 com Merge 100% Não-Destrutivo).
  - [x] `construirPayloadBackupV3`: estrutura unificada V3 contendo vales, notasPrazo, clientes e configuracoes.
  - [x] `analisarArquivoBackupImportacao`: compatibilidade reversa com V1 (vales), V2 (vales + notas) e V3 (completo).
  - [x] `planejarOperacoesMergeNaoDestrutivo`: garantia estrita contra `.set()` destrutivo em registros já existentes.
  - [x] Incorporação granular de pagamentos novos por rota atômica (`notasPrazo/{id}/pagamentos/{idPagto}`).
  - [x] Execução de exportação (`executarExportacaoBackupV3`) e importação (`executarImportacaoBackupV3`) integradas à UI.
- [x] **T-403:** Criar `src/js/seguranca.js` (Sincronização Segura de Senha Mestre e Auditoria).
  - [x] Hash determinístico e seguro FNV-1a/DJB2 com salt fixo (`gerarHashDeterministicoSenha`).
  - [x] Validação sincronizada contra `/configuracoes/seguranca` com fallback local (`verificarSenhaContraHashOuLocal`).
  - [x] Listener em tempo real (`iniciarListenerSeguranca`) e alteração sincronizada (`alterarSenhaMasterSincronizada`).
- [x] **T-404:** Integração dos Módulos, Regras RTDB e Suíte Unificada.
  - [x] Scripts carregados na ordem canônica obrigatória de 9 scripts conforme `AGENTS.md`.
  - [x] Botões de disparo rápido no WhatsApp na tabela de notas, no extrato de notas, na carteira de clientes, na ficha de cliente e na sub-aba de relatórios.
  - [x] Regras de segurança no `database.rules.json` para `/configuracoes/seguranca`.
  - [x] Suíte `tests/test_fase4_final.cjs` cobrindo 100% das funções puras.
  - [x] `tests/test_rules_semantics.cjs` atualizado com Item 9 (100% verde).
  - [x] `tests/test_integridade_index.cjs` atualizado com Item 10 (100% verde).
  - [x] Orquestrador `tests/run_suite_completa.cjs` executando todas as 8 suítes com 100% de aprovação.
