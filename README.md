# Tucano Cloud — Vales de Crédito, Notas a Prazo & Crediário Comercial

[![GitHub Pages](https://img.shields.io/badge/Demo-GitHub%20Pages-blue?style=for-the-badge&logo=github)](https://wallacextreme.github.io/sistema-controle-vales/)
[![Tauri v2](https://img.shields.io/badge/Desktop-Tauri%20v2-orange?style=for-the-badge&logo=tauri)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-1.96-black?style=for-the-badge&logo=rust)](https://www.rust-lang.org/)
[![Firebase](https://img.shields.io/badge/Database-Firebase%20RTDB-amber?style=for-the-badge&logo=firebase)](https://firebase.google.com/)
[![PWA](https://img.shields.io/badge/PWA-Offline--First-violet?style=for-the-badge&logo=pwa)](https://web.dev/progressive-web-apps/)
[![Windows](https://img.shields.io/badge/Instaladores-.EXE%20%7C%20.MSI-0078D6?style=for-the-badge&logo=windows)](https://github.com/wallacextreme/sistema-controle-vales/releases)

Sistema corporativo de alta precisão para gestão comercial de varejo e lojas, contendo controle de **Vales de Crédito ao Consumidor**, **Notas a Prazo / Crediário Comercial**, **Carteira de Clientes**, **Relatórios Financeiros com Auto-Soma**, **Motor de Impressão A4**, **Integração WhatsApp** e **Auditoria Imutável**.

Desenvolvido para execução como **Aplicativo Desktop Nativo Windows (.exe e .msi)** via **Tauri v2 (Rust)**, **PWA Instalável** e **Web App** sobre **Google Firebase Realtime Database**.

---

## 🌐 Demonstração Online & Links
- **Demo Online (GitHub Pages):** [https://wallacextreme.github.io/sistema-controle-vales/](https://wallacextreme.github.io/sistema-controle-vales/)
- **Repositório GitHub:** [https://github.com/wallacextreme/sistema-controle-vales](https://github.com/wallacextreme/sistema-controle-vales)
- **Instaladores Windows Oficiais:** Disponíveis na pasta `src-tauri/target/release/bundle/` (`.msi` e `.exe`).

---

## 🚀 Funcionalidades Principais

### 1. 👥 Carteira e Cadastro de Clientes (`CLI-XXXX`)
- **Sequência Atômica de Clientes:** Geração automática e concorrente de códigos sequenciais (`CLI-0001`, `CLI-0002`...).
- **Ficha Financeira Completa:** Visão 360° do cliente com total comprado, total pago, saldo devedor atual e limite de crédito com cálculo em tempo real de saldo disponível.
- **Validação Estrita de Documentos e Telefones:** Validação algorítmica de CPF/CNPJ com dígitos verificadores e máscara obrigatória de celular com DDD de 11 dígitos.
- **Conciliação e Vínculo Inteligente:** Localização e vinculação automática de vendas avulsas legadas à ficha cadastral do cliente.

### 2. 📅 Notas a Prazo & Crediário Comercial (`NP-XXXXXX`)
- **Sequência Atômica e Imutável:** Numeração distribuída `NP-000001` sem colisões.
- **Cálculo Preciso de Vencimento:** Prazos rápidos de 15, 30, 45 ou 60 dias com tratamento exato para anos bissextos e viradas de ano.
- **Baixas e Amortizações Múltiplas:** Suporte a pagamentos parciais acumulados com recibos sequenciais `REC-000001`.
- **Estorno Seguro:** Bloqueio contra exclusão direta de dados; correções são registradas por evento de estorno com operador, data/hora e motivo obrigatório.
- **Cancelamento Transacional:** Bloqueia notas canceladas de receberem novas baixas, mantendo histórico contábil.

### 3. 🏷️ Vales de Crédito ao Consumidor (Módulo Legado Integrado)
- **Compatibilidade 100%:** Emissão, controle de saldo e baixas de vales de troca ou devolução sem interrupção de formatos legados.
- **Auditoria e CSV:** Exportação de movimentações e painel de controle protegido por senha mestre.

### 4. 📊 Relatórios Analíticos com Auto-Soma em Tempo Real
- **Auto-Soma de Centavos Inteiros:** Cálculos financeiros sem erros de arredondamento de ponto flutuante.
- **Aging de Vencimento:** Categorização automática em faixas de atraso (A Vencer, Vence Hoje, 1 a 30 dias, 31 a 60 dias, 61 a 90 dias e +90 dias).
- **Subtotais de Caixa por Forma de Pagamento:** Apuração discriminada de Dinheiro, PIX, Cartão de Crédito e Cartão de Débito.

### 5. 🖨️ Motor de Impressão A4 Multipágina
- **Recibo de Pagamento A4:** Texto declaratório com valor por extenso automático em reais (BRL), saldo devedor restante e vias para assinaturas.
- **Nota a Prazo A4:** Termo de reconhecimento de dívida com dados completos do credor e devedor.
- **Extrato Consolidado de Cliente A4:** Histórico completo de compras e amortizações.
- **Impressão Térmica / Meia Folha:** Preservação dos layouts de vales de crédito.

### 6. 📲 Central de Cobrança e Notificações via WhatsApp
- **Atalhos Rápidos de 1 Clique:** Envio de lembrete de vencimento, cobrança de títulos em atraso, recibo de pagamento instantâneo e extrato consolidado.
- **Envio Consolidado:** Botão para disparar todas as notas em aberto juntas com soma total e chave PIX da empresa configurada.

### 7. 💾 Backup Schema V3 com Merge Não-Destrutivo
- **Merge Cirúrgico:** Restauração não-destrutiva que preserva registros e pagamentos efetuados no servidor, incorporando novos dados sem sobrescrever o banco.

### 8. 📱 PWA (Progressive Web App)
- **Manifesto Web App:** Ícones adaptativos, tema escuro nativo e modo de exibição `standalone`.
- **Service Worker (`sw.js`):** Cache-first seguro para o App Shell, mantendo requisições dinâmicas de banco de dados desimpedidas.

---

## 🔒 Segurança, Sigilo de Dados e Proteção de Informações dos Clientes

A proteção dos dados e a segurança das operações do lojista e dos clientes são o pilar central da arquitetura:

1. **Acesso Não Autenticado 100% Bloqueado (`database.rules.json`):**
   - As regras de segurança do Firebase Realtime Database bloqueiam leitura e escrita anônima (`.read: "auth != null"`, `.write: "auth != null"`). Ninguém tem acesso aos dados dos clientes, notas ou vales sem autenticação ativa.
2. **Credenciais Protegidas Fora do Repositório (`.gitignore`):**
   - O arquivo `firebase-config.js` é estritamente ignorado e **nunca** é enviado ao GitHub.
   - Na ausência do arquivo local de credenciais, o sistema entra em modo placeholder seguro sem conectar ao banco real da loja.
3. **Senhas Criptografadas com Hash Determinístico:**
   - A senha mestre para estornos e configurações sensíveis é armazenada exclusivamente em formato de hash criptográfico determinístico (FNV-1a / DJB2). Senhas em texto puro **nunca** são salvas no banco de dados.
4. **Concorrência Segura por Transações Atômicas:**
   - Baixas financeiras, cancelamentos e contadores sequenciais utilizam `ref.transaction()` nativo do Firebase, impedindo saldo negativo, troco fantasma ou corridas de rede.
5. **Idempotência contra Duplos Cliques:**
   - Tokens únicos `IDEMP-...` impedem a duplicação de baixas ou geração de recibos repetidos em conexões instáveis.

---

## 📦 Como Compilar os Instaladores Desktop (.exe e .msi)

### Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 18 ou superior)
- [Rust & Cargo](https://www.rust-lang.org/) (instalador `rustup`)
- Ferramenta WiX (necessária para geração do pacote `.msi` no Windows)

### Gerando os Instaladores:
```bash
# Instalar dependências
npm install

# Compilar instaladores Windows completos (.exe com instalador NSIS e .msi)
npm run build:windows

# Ou individualmente:
npm run build:exe
npm run build:msi
```

Os arquivos gerados são gravados em:
- **Instalador NSIS (.exe):** `src-tauri/target/release/bundle/nsis/controle-vales-tucano_0.1.0_x64-setup.exe`
- **Pacote Windows Installer (.msi):** `src-tauri/target/release/bundle/msi/controle-vales-tucano_0.1.0_x64_en-US.msi`

---

## 🧪 Suíte de Testes Automatizados

O sistema inclui suítes completas de testes automatizados e validações de integridade:

```bash
node tests/run_suite_completa.cjs
```

**Módulos Validados:**
- `tests/test_nucleo_financeiro.cjs`: Precisão de centavos, auto-soma e normalização monetária.
- `tests/test_fase1_clientes.cjs`: Validações de CPF/CNPJ, máscaras, limites e carteira consolidada.
- `tests/test_fase2_relatorios.cjs`: Métricas analíticas, aging de atraso e agrupamentos de caixa.
- `tests/test_fase3_impressao_config.cjs`: Geradores de HTML para impressão A4 e meia folha.
- `tests/test_fase4_final.cjs`: WhatsApp, backup V3, hash de senhas e resolvedor universal da Fase 6.
- `tests/test_integridade_index.cjs`: Verificação estrutural do `index.html`, modais, z-index e atalhos.
- `tests/test_rules_semantics.cjs`: Auditoria semântica das regras de segurança do Firebase.
- `tests/run_all_audits.cjs`: Testes concorrentes de concorrência transacional (2x R$700 e 2x R$500).

---

## 👨‍💻 Autor & Licença
Desenvolvido por **Wallace** ([@wallacextreme](https://github.com/wallacextreme)).  
Todos os direitos reservados à Tucano Auto Peças.
