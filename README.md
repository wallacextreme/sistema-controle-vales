# Tucano Cloud - Vales de Crédito & Notas a Prazo

Sistema completo de gestão comercial para varejo e lojas, contendo dois módulos independentes de alta precisão: **Vales de Crédito ao Consumidor** e **Notas a Prazo (Contas a Receber)**. Desenvolvido como aplicação desktop de alta performance utilizando **Tauri v2** e **Firebase Realtime Database**.

---

## 🚀 Módulos do Sistema

### 1. 🏷️ Vales de Crédito
- **Emissão Ágil**: Cadastro com cliente, vendedor, autorizador, valor e datas de emissão/validade.
- **Controle de Saldo e Amortizações**: Baixas parciais e totais com histórico por operação.
- **Impressão Térmica / Meia Folha A4**: Layout otimizado para meia folha A4 com vias para carimbo/assinatura.
- **Painel de Auditoria e CSV**: Exportação para contabilidade e auditoria com senha mestre.

### 2. 📅 Notas a Prazo (Contas a Receber)
- **Emissão e Cálculo de Vencimento**: Cálculo automático de 30 dias corridos (com precisão para viradas de mês, anos bissextos e viradas de ano). Identificador legível único `NP-XXXXXXXX`.
- **Baixas e Amortizações Múltiplas**: Controle estrito de saldo devedor. Bloqueio automático de pagamentos acima do saldo ou em notas já quitadas/canceladas.
- **Recibos Individuais**: Cada pagamento gera seu próprio recibo numerado `REC-XXXXXXXX`.
- **Estorno Seguro**: Pagamentos incorretos podem ser estornados com senha mestre e motivo registrado, sem apagar o histórico da auditoria.
- **Cancelamento Controlado**: Notas canceladas são mantidas no banco de dados para conformidade fiscal e auditoria.
- **Impressão Independente em A4**:
  - Comprovante de Nota a Prazo em A4 com Termo de Reconhecimento de Dívida.
  - Recibo de Pagamento Parcial / Recibo de Quitação Definitiva em A4 com texto declaratório e assinaturas da empresa e do cliente.
- **Dashboard e Filtros em Tempo Real**: Métricas consolidadas (Abertas, Parciais, Vencendo, Vencidas, Quitadas, Recebido Hoje) e busca avançada por cliente, NP, pedido, NF e telefone.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: HTML5, Vanilla JavaScript, CSS3 com TailwindCSS e componentes SweetAlert2.
- **Backend / Desktop**: [Tauri v2](https://tauri.app/) (Rust) - executável nativo leve e seguro.
- **Banco de Dados & Autenticação**: Google Firebase (Realtime Database `/vales` e `/notasPrazo` independentes + Firebase Authentication).
- **Utilitários**: IMask (máscaras monetárias) e html2pdf.js.

---

## 📦 Como Executar e Configurar

### 1. Clonar o repositório
```bash
git clone https://github.com/wallacextreme/sistema-controle-vales.git
cd sistema-controle-vales
```

### 2. Configurar o Firebase
Copie o arquivo de exemplo de configuração e insira as credenciais do seu projeto Firebase Console:
```bash
cp src/firebase-config.example.js src/firebase-config.js
```
Abra `src/firebase-config.js` e preencha com as credenciais do seu projeto Firebase:
```javascript
window.firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "seu-projeto.firebaseapp.com",
    databaseURL: "https://seu-projeto-default-rtdb.firebaseio.com",
    projectId: "seu-projeto",
    storageBucket: "seu-projeto.firebasestorage.app",
    messagingSenderId: "SEU_SENDER_ID",
    appId: "SEU_APP_ID"
};
```

### 3. Instalar dependências e rodar no Tauri
```bash
# Com Bun ou NPM:
bun install
bun run tauri dev
# ou:
npm install
npm run tauri dev
```

---

## 🔒 Segurança, Concorrência e Blindagem de Dados

- **Proteção Concorrente de Baixas**: Baixas utilizam transações atômicas nativas do Firebase (`ref.transaction()`). O saldo real do servidor é revalidado no momento da gravação, impedindo que acessos simultâneos resultem em saldo negativo ou cobranças acima do valor devido.
- **Cancelamento e Estorno Transacionais**: Operações de cancelamento de notas e estorno de pagamentos também são executadas via `ref.transaction()`, eliminando condições de corrida entre cancelamento simultâneo e novos pagamentos, além de rejeitar estornos duplicados concorrentes.
- **Idempotência (Proteção contra Duplo Clique e Retries)**: Cada tentativa de baixa gera um token único de idempotência (`IDEMP-...`). Cliques múltiplos ou reenvios após oscilação de conexão retornam o recibo já gravado sem duplicar pagamentos ou consumir números sequenciais.
- **Sequências Atômicas Distribuídas (`NP-000001` / `REC-000001`)**: Contadores atômicos em `/sequencias/notasPrazo` e `/sequencias/recibos` garantem unicidade absoluta e ordenação estrita entre múltiplos computadores conectados, sem reutilização de números em cancelamentos ou estornos e com seed automático que protege identificadores existentes.
- **Regras de Segurança de Produção**: Arquivo `database.rules.json` incluído para validação e restrição estrita de permissões nas coleções `/vales`, `/notasPrazo` e `/sequencias`, garantindo imutabilidade de IDs e validação de tipos de dados.
- **Dashboard Financeiro Auditável**: Exibição detalhada de Total a Receber (saldo ativo), Total Recebido, Total Emitido Bruto, (-) Cancelado e Total Emitido Líquido Ativo.
- **Backup com Pré-Visualização e Merge Não-Destrutivo**:
  - Antes da importação, uma tela de pré-visualização apresenta a contagem de registros novos, existentes e pagamentos a incorporar.
  - A importação realiza **merge individualizado** por chave e subcoleção (`/pagamentos/{id}`).
  - **Nunca** utiliza `set()` na nota inteira sobre registros existentes, impedindo que backups antigos apaguem pagamentos mais recentes efetuados em produção.
  - Backups legados v1 (`[ { ... } ]`) continuam 100% suportados e restauráveis sem conflitos.
- **Histórico Imutável e Auditoria**: Pagamentos confirmados não podem ser alterados diretamente. Correções são tratadas exclusivamente via **Estorno**, gerando um novo evento de auditoria com operador, data e justificativa obrigatória, recalculando o saldo e preservando o recibo original.
- **Zero Migração Destrutiva**: A coleção legada `/vales` e seus layouts de impressão em meia folha A4 permanecem 100% intactos.
- **Suíte de Testes Automatizados**: A suíte em `tests/run_all_audits.cjs` valida sequências atômicas distribuídas, cenários concorrentes de pagamentos simultâneos (2x R$700 e 2x R$500), estornos concorrentes, cancelamento concorrente vs baixa, idempotência com retries de rede, merge não-destrutivo de backups e compatibilidade com registros legados.
