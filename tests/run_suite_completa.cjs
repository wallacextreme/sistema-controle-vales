// =========================================================================
// SUÍTE COMPLETA DE TESTES - TUCANO CLOUD (AGENTS.md)
// =========================================================================
const { execSync } = require('child_process');
const path = require('path');

console.log('=================================================================');
console.log('INICIANDO EXECUÇÃO DA SUÍTE COMPLETA - TUCANO CLOUD');
console.log('=================================================================\n');

const suites = [
    { nome: 'Núcleo Financeiro e Utilitários', arquivo: 'tests/test_nucleo_financeiro.cjs' },
    { nome: 'Gestão de Clientes e Carteira (Fase 1)', arquivo: 'tests/test_fase1_clientes.cjs' },
    { nome: 'Relatórios e Auto-Soma (Fase 2)', arquivo: 'tests/test_fase2_relatorios.cjs' },
    { nome: 'Configurações e Impressão (Fase 3)', arquivo: 'tests/test_fase3_impressao_config.cjs' },
    { nome: 'WhatsApp, Backup V3 e Segurança (Fase 4)', arquivo: 'tests/test_fase4_final.cjs' },
    { nome: 'Integridade e Blindagem do index.html', arquivo: 'tests/test_integridade_index.cjs' },
    { nome: 'Auditorias e Blindagens Legadas', arquivo: 'tests/run_all_audits.cjs' },
    { nome: 'Semântica de Regras RTDB', arquivo: 'tests/test_rules_semantics.cjs' }
];

let falhas = 0;

for (const suite of suites) {
    console.log(`\n>>> Executando: ${suite.nome} (${suite.arquivo})`);
    try {
        const out = execSync(`node ${suite.arquivo}`, {
            cwd: path.join(__dirname, '..'),
            stdio: 'inherit'
        });
        console.log(`>>> [PASSOU] ${suite.nome}`);
    } catch (e) {
        console.error(`>>> [FALHOU] ${suite.nome}`);
        falhas++;
    }
}

console.log('\n=================================================================');
if (falhas === 0) {
    console.log('TODAS AS SUÍTES PASSARAM COM 100% DE SUCESSO! SISTEMA BLINDADO.');
    console.log('=================================================================\n');
    process.exit(0);
} else {
    console.error(`FALHA NA SUÍTE COMPLETA: ${falhas} teste(s) falharam.`);
    console.log('=================================================================\n');
    process.exit(1);
}
