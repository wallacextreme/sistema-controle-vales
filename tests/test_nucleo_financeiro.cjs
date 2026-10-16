// =========================================================================
// TESTES DO NÚCLEO FINANCEIRO, DATAS E UTILITÁRIOS (FASE 0 / T-001)
// =========================================================================
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('--- TESTE DO NÚCLEO FINANCEIRO (src/js/nucleo-financeiro.js) ---');

// 1. Teste de carregamento clássico via VM (conforme exigido pelo AGENTS.md)
const caminhoModulo = path.join(__dirname, '../src/js/nucleo-financeiro.js');
const codigoModulo = fs.readFileSync(caminhoModulo, 'utf8');

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(codigoModulo, sandbox);

assert.strictEqual(typeof sandbox.moedaParaCentavos, 'function', 'moedaParaCentavos deve estar acessível no sandbox VM');
assert.strictEqual(typeof sandbox.centavosParaReais, 'function', 'centavosParaReais deve estar acessível no sandbox VM');
assert.strictEqual(typeof sandbox.arredondarMoeda, 'function', 'arredondarMoeda deve estar acessível no sandbox VM');
assert.strictEqual(typeof sandbox.somarValoresMoeda, 'function', 'somarValoresMoeda deve estar acessível no sandbox VM');
assert.strictEqual(typeof sandbox.obterDataLocalISO, 'function', 'obterDataLocalISO deve estar acessível no sandbox VM');
assert.strictEqual(typeof sandbox.adicionarMesesDataLocalISO, 'function', 'adicionarMesesDataLocalISO deve estar acessível no sandbox VM');
assert.strictEqual(typeof sandbox.calcularDiferencaDiasISO, 'function', 'calcularDiferencaDiasISO deve estar acessível no sandbox VM');
assert.strictEqual(typeof sandbox.valorPorExtensoBRL, 'function', 'valorPorExtensoBRL deve estar acessível no sandbox VM');
assert.strictEqual(typeof sandbox.nucleoEscapeHtml, 'function', 'nucleoEscapeHtml deve estar acessível no sandbox VM');
assert.strictEqual(typeof sandbox.garantirConexaoParaOperacaoFinanceira, 'function', 'garantirConexaoParaOperacaoFinanceira deve estar acessível no sandbox VM');

console.log('✓ Sucesso: Carregamento no VM context sem erros de sintaxe ou referências globais proibidas.');

// Referência ao núcleo carregado no sandbox da VM (padrão AGENTS.md)
const nucleo = sandbox;

// -------------------------------------------------------------------------
// 2. ARITMÉTICA MONETÁRIA
// -------------------------------------------------------------------------
// moedaParaCentavos
assert.strictEqual(nucleo.moedaParaCentavos(1234.56), 123456);
assert.strictEqual(nucleo.moedaParaCentavos("R$ 1.234,56"), 123456);
assert.strictEqual(nucleo.moedaParaCentavos("1234.56"), 123456);
assert.strictEqual(nucleo.moedaParaCentavos("1234,56"), 123456);
assert.strictEqual(nucleo.moedaParaCentavos("0,50"), 50);
assert.strictEqual(nucleo.moedaParaCentavos("0.01"), 1);
assert.strictEqual(nucleo.moedaParaCentavos(0), 0);
assert.strictEqual(nucleo.moedaParaCentavos(""), 0);
assert.strictEqual(nucleo.moedaParaCentavos(null), 0);
assert.strictEqual(nucleo.moedaParaCentavos(undefined), 0);
assert.strictEqual(nucleo.moedaParaCentavos(NaN), 0);
assert.strictEqual(nucleo.moedaParaCentavos("invalido"), 0);
assert.strictEqual(nucleo.moedaParaCentavos("-R$ 50,25"), -5025);
assert.strictEqual(nucleo.moedaParaCentavos("-50.25"), -5025);

// centavosParaReais
assert.strictEqual(nucleo.centavosParaReais(123456), 1234.56);
assert.strictEqual(nucleo.centavosParaReais(50), 0.5);
assert.strictEqual(nucleo.centavosParaReais(1), 0.01);
assert.strictEqual(nucleo.centavosParaReais(0), 0);
assert.strictEqual(nucleo.centavosParaReais(-5025), -50.25);
assert.strictEqual(nucleo.centavosParaReais(null), 0);

// arredondarMoeda
assert.strictEqual(nucleo.arredondarMoeda(1234.56), 1234.56);
assert.strictEqual(nucleo.arredondarMoeda("R$ 1.234,567"), 1234.57);
assert.strictEqual(nucleo.arredondarMoeda(10.004), 10.00);
assert.strictEqual(nucleo.arredondarMoeda(10.005), 10.01);

// somarValoresMoeda (eliminação de imprecisão de float)
assert.strictEqual(nucleo.somarValoresMoeda([0.1, 0.2]), 0.3);
assert.strictEqual(nucleo.somarValoresMoeda(["R$ 10,50", 20.30, "15,20"]), 46.00);
assert.strictEqual(nucleo.somarValoresMoeda([]), 0);
assert.strictEqual(nucleo.somarValoresMoeda(null), 0);

console.log('✓ Sucesso: Aritmética em centavos inteiros validada (100% livre de imprecisão de float).');

// -------------------------------------------------------------------------
// 3. DATAS DE NEGÓCIO NO FUSO America/Sao_Paulo
// -------------------------------------------------------------------------
// obterDataLocalISO
const hojeISO = nucleo.obterDataLocalISO();
assert.match(hojeISO, /^\d{4}-\d{2}-\d{2}$/, 'obterDataLocalISO() deve retornar YYYY-MM-DD');

assert.strictEqual(nucleo.obterDataLocalISO('2026-10-15'), '2026-10-15');
assert.strictEqual(nucleo.obterDataLocalISO('2026-10-15 14:30:00'), '2026-10-15');
assert.strictEqual(nucleo.obterDataLocalISO(new Date(2026, 9, 15)), '2026-10-15');

// adicionarMesesDataLocalISO
assert.strictEqual(nucleo.adicionarMesesDataLocalISO('2026-01-31', 1), '2026-02-28', 'Jan 31 + 1 mes deve travar em 28/fev');
assert.strictEqual(nucleo.adicionarMesesDataLocalISO('2026-01-31', 2), '2026-03-31');
assert.strictEqual(nucleo.adicionarMesesDataLocalISO('2026-05-31', 1), '2026-06-30', 'Maio 31 + 1 mes deve travar em 30/jun');
assert.strictEqual(nucleo.adicionarMesesDataLocalISO('2026-10-15', 2), '2026-12-15');
assert.strictEqual(nucleo.adicionarMesesDataLocalISO('2026-11-15', 2), '2027-01-15', 'Virada de ano deve somar corretamente');
assert.strictEqual(nucleo.adicionarMesesDataLocalISO('2026-03-31', -1), '2026-02-28');

// calcularDiferencaDiasISO
assert.strictEqual(nucleo.calcularDiferencaDiasISO('2026-10-15', '2026-10-15'), 0);
assert.strictEqual(nucleo.calcularDiferencaDiasISO('2026-10-18', '2026-10-15'), 3);
assert.strictEqual(nucleo.calcularDiferencaDiasISO('2026-10-10', '2026-10-15'), -5);
assert.strictEqual(nucleo.calcularDiferencaDiasISO('2026-11-01', '2026-10-31'), 1);

console.log('✓ Sucesso: Datas de negócio ISO (America/Sao_Paulo, adição de meses e diferença de dias) validadas.');

// -------------------------------------------------------------------------
// 4. VALOR POR EXTENSO EM PORTUGUÊS (BRL)
// -------------------------------------------------------------------------
// Casos exatos da especificação
assert.strictEqual(nucleo.valorPorExtensoBRL(0.01), 'um centavo');
assert.strictEqual(nucleo.valorPorExtensoBRL(1.00), 'um real');
assert.strictEqual(nucleo.valorPorExtensoBRL(150.50), 'cento e cinquenta reais e cinquenta centavos');
assert.strictEqual(nucleo.valorPorExtensoBRL(1234.56), 'um mil, duzentos e trinta e quatro reais e cinquenta e seis centavos');
assert.strictEqual(nucleo.valorPorExtensoBRL(1000000.00), 'um milhão de reais');

// Casos complementares
assert.strictEqual(nucleo.valorPorExtensoBRL(0), 'zero reais');
assert.strictEqual(nucleo.valorPorExtensoBRL(0.50), 'cinquenta centavos');
assert.strictEqual(nucleo.valorPorExtensoBRL(2.00), 'dois reais');
assert.strictEqual(nucleo.valorPorExtensoBRL(1.01), 'um real e um centavo');
assert.strictEqual(nucleo.valorPorExtensoBRL(2.02), 'dois reais e dois centavos');
assert.strictEqual(nucleo.valorPorExtensoBRL(100.00), 'cem reais');
assert.strictEqual(nucleo.valorPorExtensoBRL(105.00), 'cento e cinco reais');
assert.strictEqual(nucleo.valorPorExtensoBRL(1000.00), 'um mil reais');
assert.strictEqual(nucleo.valorPorExtensoBRL(1005.00), 'um mil e cinco reais');
assert.strictEqual(nucleo.valorPorExtensoBRL(1100.00), 'um mil e cem reais');
assert.strictEqual(nucleo.valorPorExtensoBRL(1000000.50), 'um milhão de reais e cinquenta centavos');
assert.strictEqual(nucleo.valorPorExtensoBRL(1000001.00), 'um milhão e um reais');
assert.strictEqual(nucleo.valorPorExtensoBRL(2000000.00), 'dois milhões de reais');

console.log('✓ Sucesso: Conversão de valores monetários por extenso em BRL 100% validada.');

// -------------------------------------------------------------------------
// 5. UTILITÁRIOS E GUARDA DE CONEXÃO
// -------------------------------------------------------------------------
// nucleoEscapeHtml
assert.strictEqual(nucleo.nucleoEscapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
assert.strictEqual(nucleo.nucleoEscapeHtml("João d'Água & Filhos"), 'João d&#39;Água &amp; Filhos');
assert.strictEqual(nucleo.nucleoEscapeHtml(null), '');
assert.strictEqual(nucleo.nucleoEscapeHtml(undefined), '');

// atualizarEstadoConexaoNucleo e garantirConexaoParaOperacaoFinanceira
nucleo.atualizarEstadoConexaoNucleo(true);
assert.strictEqual(nucleo.garantirConexaoParaOperacaoFinanceira('Teste Online'), true);

nucleo.atualizarEstadoConexaoNucleo(false);
assert.strictEqual(nucleo.garantirConexaoParaOperacaoFinanceira('Teste Offline'), false);

// Restaura estado para true
nucleo.atualizarEstadoConexaoNucleo(true);
assert.strictEqual(nucleo.garantirConexaoParaOperacaoFinanceira('Teste Restaurado'), true);

console.log('✓ Sucesso: nucleoEscapeHtml e guarda de conexão financeira validados.');
console.log('=================================================================');
console.log('SUÍTE DO NÚCLEO FINANCEIRO PASSOU COM 100% DE SUCESSO!');
console.log('=================================================================\n');
