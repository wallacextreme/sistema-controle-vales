# PLANO_IMPLEMENTACAO.md — Plano Estratégico de Evolução do Tucano Cloud

> Arquitetura, regras de negócio e cronograma de implementação do Tucano Cloud (Tucano Auto Peças).
> Documento oficial de referência para todos os agentes e desenvolvedores.

---

## 1. Diretrizes de Arquitetura

O sistema Tucano Cloud adota uma arquitetura desktop híbrida baseada em:
- **Tauri v2** para o empacotamento nativo em Windows.
- **Frontend SPA em arquivo único (`src/index.html`)** com scripts auxiliares clássicos (`src/js/*.js`) sem empacotadores (bundlers) ou frameworks reativos externos.
- **Firebase Realtime Database (SDK 9.23.0 compat)** com suporte a transações concorrentes e regras atômicas no servidor.
- **Node puro (`tests/*.cjs`)** para verificação contínua e garantia estrita contra regressões de regras e integridade.

---

## 2. Fase 0: Núcleo Financeiro, Correções Críticas e Blindagem de Testes

### Objetivos Alcançados:
1. **Padronização Monetária:** Aritmética de ponto flutuante eliminada nas regras de negócio; todas as operações ocorrem em centavos inteiros via `moedaParaCentavos()` e `centavosParaReais()`.
2. **Datas de Negócio em Fuso Canônico:** Eliminação definitiva de `new Date().toISOString().split('T')[0]` para datas de negócio, substituído por `obterDataLocalISO()` garantindo coerência no fuso `America/Sao_Paulo`.
3. **Fidelidade Documental:** Recibos de pagamento utilizam saldos históricos reais (`saldoAnterior` e `saldoApos`) e exibem valor por extenso via `valorPorExtensoBRL()`.
4. **Proteção Transacional:**
   - Bloqueio de cancelamento de notas com pagamentos ativos.
   - Registro de recibos inutilizados em `sequencias/recibosInutilizados`.
   - Prevenção ativa de colisão de IDs no cadastro de vales.
5. **Guardas de Conectividade:** Monitoramento de status de rede e bloqueio de submissão offline para evitar divergências locais.

---

## 3. Modelo de Dados RTDB

- `/vales/{idVale}`: Vales de crédito (legados e novos).
- `/vales/{idVale}/baixas/{idBaixa}`: Histórico de utilização parcial/total.
- `/notasPrazo/{idNota}`: Notas a prazo emitidas.
- `/notasPrazo/{idNota}/pagamentos/{idPagamento}`: Baixas de pagamento com `numeroRecibo`, `saldoAnterior` e `saldoApos`.
- `/sequencias/notasPrazo`: Contador atômico `NP-XXXXXX`.
- `/sequencias/recibos`: Contador atômico `REC-XXXXXX`.
- `/sequencias/recibosInutilizados`: Registro de auditoria para recibos reservados cujas transações foram rejeitadas.
- `/clientes/{idCliente}`: Cadastros unificados de clientes (Fase 1).
- `/configuracoes/empresa`: Parâmetros da empresa, chave PIX e preferências de impressão (Fase 3).
- `/configuracoes/seguranca`: Hash determinístico da senha master sincronizada em tempo real (Fase 4).

---

## 4. Evolução Modular e Arquitetura Entregue (Fases 0 a 4)

1. **Fase 0 — Núcleo Financeiro e Utilitários (`src/js/nucleo-financeiro.js`):**
   - Eliminação de floating point nas regras de negócio; aritmética estrita em centavos inteiros.
   - Fuso canônico `America/Sao_Paulo` via `obterDataLocalISO()`.
   - Proteção de concorrência com idempotência e registro de recibos inutilizados.

2. **Fase 1 — Gestão de Clientes e Carteira (`src/js/clientes.js`):**
   - Unificação de clientes (`CLI-XXXX`), validação de CPF/CNPJ, telefones e limite de crédito.
   - Algoritmo de conciliação de notas legadas e ficha completa com extrato de conta corrente.

3. **Fase 2 — Relatórios Analíticos com Auto-Soma (`src/js/relatorios.js`):**
   - 4 modalidades de relatório com Auto-Soma matemática provada em centavos.
   - Exportação em CSV compatível com Microsoft Excel (BOM UTF-8, delimitador `;` e linha de auto-soma).

4. **Fase 3 — Configurações da Empresa e Motor de Impressão A4 (`src/js/configuracoes.js` e `src/js/impressao.js`):**
   - Parametrização em tempo real e cache local da empresa e chave PIX.
   - Layouts A4 multipágina com repetidores de cabeçalho (`thead`) e rodapé fixo de auto-soma (`tfoot`), recibos com valor por extenso, comprovantes de estorno e notas a prazo com termos de dívida.

5. **Fase 4 — Central WhatsApp, Backup Schema V3 e Segurança (`src/js/whatsapp.js`, `src/js/backup-v3.js` e `src/js/seguranca.js`):**
   - Deep links transparentes para WhatsApp via Tauri v2 Opener e Web com 6 templates e Central de Alertas.
   - Backup Schema V3 compatível com V1 e V2 com garantia estrita de merge 100% não-destrutivo.
   - Hash determinístico FNV-1a/DJB2 para senha mestre com sincronização em tempo real na nuvem.
