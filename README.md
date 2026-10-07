# Tucano Cloud - Sistema de Controle de Vales

Sistema de gerenciamento, emissão e controle de vales de compra e trocas comerciais para lojas e varejo. Desenvolvido como aplicação desktop leve e de alta performance utilizando **Tauri v2** e **Firebase Realtime Database**.

---

## 🚀 Funcionalidades

- **Emissão de Vales**: Cadastro ágil com cliente, vendedor, autorizador, valor e datas de emissão/validade.
- **Controle de Saldo e Baixas**: Amortização parcial e baixa total de vales com histórico detalhado por operação.
- **Sincronização em Tempo Real**: Atualizações automáticas e instantâneas via Firebase Realtime Database com indicador visual de status de conexão (Online/Offline).
- **Impressão Profissional**: Geração e formatação de comprovantes em meia folha A4 e compatibilidade para impressão rápida / PDF.
- **Painel de Controle e Auditoria**: Visão consolidada de vales em aberto, parciais e quitados com métricas e filtros rápidos.
- **Segurança e Privilégios**: Autenticação de operadores por Firebase Auth e proteção para operações administrativas sensíveis (cancelamento, alteração de regras) por Senha Mestre local.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: HTML5, Vanilla JavaScript, CSS3 moderno com TailwindCSS e componentes SweetAlert2.
- **Backend / Desktop**: [Tauri v2](https://tauri.app/) (Rust) - executável nativo leve e seguro.
- **Banco de Dados & Autenticação**: Google Firebase (Realtime Database & Firebase Authentication).
- **Utilitários**: IMask (máscaras de campos monetários) e html2pdf.js.

---

## 📦 Como Executar e Configurar

### 1. Clonar o repositório
```bash
git clone https://github.com/<usuario>/<repositorio>.git
cd <repositorio>
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

## 🔒 Segurança e Dados
- As credenciais ativas de produção e os dados dos clientes **não** fazem parte do controle de versão (`.gitignore`).
- As transações com o Firebase são protegidas por autenticação de usuário e regras de segurança (Security Rules).
