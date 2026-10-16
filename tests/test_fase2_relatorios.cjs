// =========================================================================
// TESTE DA FASE 2: RELATÓRIOS DETALHADOS, AUTO-SOMA E CSV (AGENTS.md)
// =========================================================================
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('=================================================================');
console.log('INICIANDO SUÍTE DE TESTES DA FASE 2: RELATÓRIOS & AUTO-SOMA');
console.log('=================================================================\n');

// 1. Carregamento dos módulos no contexto VM isolado
const nucleoJs = fs.readFileSync(path.join(__dirname, '../src/js/nucleo-financeiro.js'), 'utf8');
const clientesJs = fs.readFileSync(path.join(__dirname, '../src/js/clientes.js'), 'utf8');
const relatoriosJs = fs.readFileSync(path.join(__dirname, '../src/js/relatorios.js'), 'utf8');

const sandbox = {
    console: console,
    Math: Math,
    Date: Date,
    parseInt: parseInt,
    parseFloat: parseFloat,
    isNaN: isNaN,
    isFinite: isFinite,
    String: String,
    Number: Number,
    Array: Array,
    Object: Object,
    RegExp: RegExp,
    document: null,
    window: null,
    module: { exports: {} }
};

const context = vm.createContext(sandbox);
vm.runInContext(nucleoJs, context);
vm.runInContext(clientesJs, context);
vm.runInContext(relatoriosJs, context);

const {
    moedaParaCentavos,
    centavosParaReais,
    obterDataLocalISO,
    calcularDiferencaDiasISO,
    adicionarDiasDataLocalISO
} = sandbox;

const {
    resolverIntervaloPeriodoRelatorio,
    classificarFaixaVencimentoNota,
    gerarRelatorioNotasDetalhado,
    gerarRelatorioPagamentosRecebidos,
    gerarCSVRelatorioNotas,
    gerarCSVRelatorioPagamentos,
    formatarMoedaCsv
} = sandbox;

assert(typeof resolverIntervaloPeriodoRelatorio === 'function', 'resolverIntervaloPeriodoRelatorio deve ser uma função');
assert(typeof classificarFaixaVencimentoNota === 'function', 'classificarFaixaVencimentoNota deve ser uma função');
assert(typeof gerarRelatorioNotasDetalhado === 'function', 'gerarRelatorioNotasDetalhado deve ser uma função');
assert(typeof gerarRelatorioPagamentosRecebidos === 'function', 'gerarRelatorioPagamentosRecebidos deve ser uma função');
assert(typeof gerarCSVRelatorioNotas === 'function', 'gerarCSVRelatorioNotas deve ser uma função');
assert(typeof gerarCSVRelatorioPagamentos === 'function', 'gerarCSVRelatorioPagamentos deve ser uma função');

// =========================================================================
// 2. TESTES DE resolverIntervaloPeriodoRelatorio
// =========================================================================
console.log('1. Testando resolução de intervalos de período...');
const dataRef = '2026-10-15';

const rTodos = resolverIntervaloPeriodoRelatorio('TODOS', null, null, dataRef);
assert.strictEqual(rTodos.dataInicio, null);
assert.strictEqual(rTodos.dataFim, null);
assert(rTodos.descricaoPeriodo.includes('Todo o Período'));

const rHoje = resolverIntervaloPeriodoRelatorio('HOJE', null, null, dataRef);
assert.strictEqual(rHoje.dataInicio, '2026-10-15');
assert.strictEqual(rHoje.dataFim, '2026-10-15');

const rOntem = resolverIntervaloPeriodoRelatorio('ONTEM', null, null, dataRef);
assert.strictEqual(rOntem.dataInicio, '2026-10-14');
assert.strictEqual(rOntem.dataFim, '2026-10-14');

const r7Dias = resolverIntervaloPeriodoRelatorio('ULTIMOS_7_DIAS', null, null, dataRef);
assert.strictEqual(r7Dias.dataFim, '2026-10-15');
assert.strictEqual(r7Dias.dataInicio, '2026-10-09');

const r30Dias = resolverIntervaloPeriodoRelatorio('ULTIMOS_30_DIAS', null, null, dataRef);
assert.strictEqual(r30Dias.dataFim, '2026-10-15');
assert.strictEqual(r30Dias.dataInicio, '2026-09-16');

const rMesAtual = resolverIntervaloPeriodoRelatorio('MES_ATUAL', null, null, dataRef);
assert.strictEqual(rMesAtual.dataInicio, '2026-10-01');
assert.strictEqual(rMesAtual.dataFim, '2026-10-31');

const rMesAnterior = resolverIntervaloPeriodoRelatorio('MES_ANTERIOR', null, null, dataRef);
assert.strictEqual(rMesAnterior.dataInicio, '2026-09-01');
assert.strictEqual(rMesAnterior.dataFim, '2026-09-30');

const rAnoAtual = resolverIntervaloPeriodoRelatorio('ANO_ATUAL', null, null, dataRef);
assert.strictEqual(rAnoAtual.dataInicio, '2026-01-01');
assert.strictEqual(rAnoAtual.dataFim, '2026-12-31');

const rCustom = resolverIntervaloPeriodoRelatorio('PERSONALIZADO', '2026-03-01', '2026-05-31', dataRef);
assert.strictEqual(rCustom.dataInicio, '2026-03-01');
assert.strictEqual(rCustom.dataFim, '2026-05-31');
console.log('   ✓ Todos os atalhos de período validados com precisão de calendário!');

// =========================================================================
// 3. TESTES DE classificarFaixaVencimentoNota
// =========================================================================
console.log('2. Testando classificação de faixas de vencimento (Aging)...');

// Quitada ou cancelada
const fxQuitada = classificarFaixaVencimentoNota({ saldoDevedor: 0, statusFinanceiro: 'QUITADA', dataVencimento: '2026-08-01' }, dataRef);
assert.strictEqual(fxQuitada.faixa, 'QUITADA_OU_CANCELADA');

const fxCancelada = classificarFaixaVencimentoNota({ saldoDevedor: 150, statusFinanceiro: 'CANCELADA', dataVencimento: '2026-08-01' }, dataRef);
assert.strictEqual(fxCancelada.faixa, 'QUITADA_OU_CANCELADA');

// A Vencer (vencimento futuro)
const fxAVencer = classificarFaixaVencimentoNota({ saldoDevedor: 200, statusFinanceiro: 'ABERTA', dataVencimento: '2026-10-25' }, dataRef);
assert.strictEqual(fxAVencer.faixa, 'A_VENCER');
assert.strictEqual(fxAVencer.diasEmAtraso, 0);

// Vence Hoje
const fxVenceHoje = classificarFaixaVencimentoNota({ saldoDevedor: 300, statusFinanceiro: 'VENCENDO', dataVencimento: '2026-10-15' }, dataRef);
assert.strictEqual(fxVenceHoje.faixa, 'VENCE_HOJE');
assert.strictEqual(fxVenceHoje.diasEmAtraso, 0);

// Atraso 1 a 30 dias (10 dias de atraso: vencimento 2026-10-05)
const fxAtraso1_30 = classificarFaixaVencimentoNota({ saldoDevedor: 400, statusFinanceiro: 'VENCIDA', dataVencimento: '2026-10-05' }, dataRef);
assert.strictEqual(fxAtraso1_30.faixa, 'ATRASO_1_30');
assert.strictEqual(fxAtraso1_30.diasEmAtraso, 10);

// Atraso 31 a 60 dias (44 dias de atraso: vencimento 2026-09-01)
const fxAtraso31_60 = classificarFaixaVencimentoNota({ saldoDevedor: 500, statusFinanceiro: 'VENCIDA', dataVencimento: '2026-09-01' }, dataRef);
assert.strictEqual(fxAtraso31_60.faixa, 'ATRASO_31_60');
assert.strictEqual(fxAtraso31_60.diasEmAtraso, 44);

// Atraso 61 a 90 dias (76 dias de atraso: vencimento 2026-07-31)
const fxAtraso61_90 = classificarFaixaVencimentoNota({ saldoDevedor: 600, statusFinanceiro: 'VENCIDA', dataVencimento: '2026-07-31' }, dataRef);
assert.strictEqual(fxAtraso61_90.faixa, 'ATRASO_61_90');
assert.strictEqual(fxAtraso61_90.diasEmAtraso, 76);

// Atraso mais de 90 dias (167 dias de atraso: vencimento 2026-05-01)
const fxAtrasoMais90 = classificarFaixaVencimentoNota({ saldoDevedor: 700, statusFinanceiro: 'VENCIDA', dataVencimento: '2026-05-01' }, dataRef);
assert.strictEqual(fxAtrasoMais90.faixa, 'ATRASO_MAIS_90');
assert.strictEqual(fxAtrasoMais90.diasEmAtraso, 167);

console.log('   ✓ Todas as faixas de vencimento classificadas com exatidão matemática!');

// =========================================================================
// 4. MOCK DE DADOS PARA PROVA MATEMÁTICA DE AUTO-SOMA
// =========================================================================
console.log('3. Preparando massa de teste complexa com clientes e notas...');

const mapaClientes = {
    'cli_01': { id: 'cli_01', nome: 'OFICINA DO MARCOS LTDA', cpfCnpj: '11.222.333/0001-44', telefone: '(11) 98888-1111' },
    'cli_02': { id: 'cli_02', nome: 'AUTO CENTER SILVA & FILHOS', cpfCnpj: '22.333.444/0001-55', telefone: '(11) 97777-2222' },
    'cli_03': { id: 'cli_03', nome: 'MECÂNICA TUCANO VELOZ', cpfCnpj: '33.444.555/0001-66', telefone: '(11) 96666-3333' }
};

const listaNotas = [
    // Nota 1: cli_01, R$ 1.500,00, paga R$ 500,00 (saldo R$ 1.000,00), a vencer
    {
        id: 'nota_01',
        numeroControle: 'NP-001',
        clienteId: 'cli_01',
        cliente: 'OFICINA DO MARCOS LTDA',
        valorOriginal: 1500.00,
        dataEmissao: '2026-10-01',
        dataVencimento: '2026-10-30',
        status: 'PARCIAL',
        pagamentos: [
            { id: 'pag_01', data: '2026-10-05', valor: 500.00, formaPagamento: 'PIX', status: 'ATIVO', numeroRecibo: 'REC-001' }
        ]
    },
    // Nota 2: cli_01, R$ 850,50, paga R$ 0,00 (saldo R$ 850,50), vence hoje
    {
        id: 'nota_02',
        numeroControle: 'NP-002',
        clienteId: 'cli_01',
        cliente: 'OFICINA DO MARCOS LTDA',
        valorOriginal: 850.50,
        dataEmissao: '2026-09-15',
        dataVencimento: '2026-10-15',
        status: 'ABERTA'
    },
    // Nota 3: cli_02, R$ 2.400,00, atraso 1 a 30 dias (venc 2026-10-05, saldo R$ 2.400,00)
    {
        id: 'nota_03',
        numeroControle: 'NP-003',
        clienteId: 'cli_02',
        cliente: 'AUTO CENTER SILVA & FILHOS',
        valorOriginal: 2400.00,
        dataEmissao: '2026-09-05',
        dataVencimento: '2026-10-05',
        status: 'ABERTA'
    },
    // Nota 4: cli_02, R$ 1.250,75, atraso 31 a 60 dias (venc 2026-09-01), recebeu R$ 250,75 em Dinheiro
    {
        id: 'nota_04',
        numeroControle: 'NP-004',
        clienteId: 'cli_02',
        cliente: 'AUTO CENTER SILVA & FILHOS',
        valorOriginal: 1250.75,
        dataEmissao: '2026-08-01',
        dataVencimento: '2026-09-01',
        status: 'PARCIAL',
        pagamentos: [
            { id: 'pag_02', data: '2026-09-10', valor: 250.75, formaPagamento: 'Dinheiro', status: 'ATIVO', numeroRecibo: 'REC-002' }
        ]
    },
    // Nota 5: cli_03, R$ 3.100,00, atraso 61 a 90 dias (venc 2026-07-25), saldo R$ 3.100,00
    {
        id: 'nota_05',
        numeroControle: 'NP-005',
        clienteId: 'cli_03',
        cliente: 'MECÂNICA TUCANO VELOZ',
        valorOriginal: 3100.00,
        dataEmissao: '2026-06-25',
        dataVencimento: '2026-07-25',
        status: 'ABERTA'
    },
    // Nota 6: cli_03, R$ 900,00, atraso > 90 dias (venc 2026-05-10), saldo R$ 900,00
    {
        id: 'nota_06',
        numeroControle: 'NP-006',
        clienteId: 'cli_03',
        cliente: 'MECÂNICA TUCANO VELOZ',
        valorOriginal: 900.00,
        dataEmissao: '2026-04-10',
        dataVencimento: '2026-05-10',
        status: 'ABERTA'
    },
    // Nota 7: cli_03, R$ 600,00, QUITADA (recebeu R$ 600,00 via Cartão de Crédito)
    {
        id: 'nota_07',
        numeroControle: 'NP-007',
        clienteId: 'cli_03',
        cliente: 'MECÂNICA TUCANO VELOZ',
        valorOriginal: 600.00,
        dataEmissao: '2026-09-01',
        dataVencimento: '2026-10-01',
        status: 'QUITADA',
        pagamentos: [
            { id: 'pag_03', data: '2026-09-20', valor: 600.00, formaPagamento: 'Cartão de Crédito', status: 'ATIVO', numeroRecibo: 'REC-003' }
        ]
    },
    // Nota 8: cli_01, R$ 500,00, CANCELADA
    {
        id: 'nota_08',
        numeroControle: 'NP-008',
        clienteId: 'cli_01',
        cliente: 'OFICINA DO MARCOS LTDA',
        valorOriginal: 500.00,
        dataEmissao: '2026-10-02',
        dataVencimento: '2026-10-20',
        status: 'CANCELADA'
    },
    // Nota 9: cli_02, com pagamento estornado
    {
        id: 'nota_09',
        numeroControle: 'NP-009',
        clienteId: 'cli_02',
        cliente: 'AUTO CENTER SILVA & FILHOS',
        valorOriginal: 1000.00,
        dataEmissao: '2026-09-10',
        dataVencimento: '2026-10-10',
        status: 'ABERTA',
        pagamentos: [
            { id: 'pag_04', data: '2026-09-15', valor: 300.00, formaPagamento: 'PIX', status: 'ESTORNADO', numeroRecibo: 'REC-004' }
        ]
    }
];

// =========================================================================
// 5. PROVA MATEMÁTICA DA AUTO-SOMA: NOTAS DETALHADO
// =========================================================================
console.log('4. Executando prova matemática da Auto-Soma em Notas Detalhado...');

const relatorioNotas = gerarRelatorioNotasDetalhado(listaNotas, mapaClientes, {
    atalhoPeriodo: 'TODOS',
    clienteFiltro: 'TODOS',
    statusFiltro: 'TODAS',
    faixaVencimentoFiltro: 'TODAS'
}, dataRef);

const autoN = relatorioNotas.autoSoma;
assert.strictEqual(relatorioNotas.linhas.length, 9, 'Devem existir 9 notas no relatório sem filtros restritivos');
assert.strictEqual(autoN.quantidadeRegistros, 9);

// 1. Prova da soma do valor original
let somaCentOriginalEsperada = 0;
let somaCentRecebidoEsperada = 0;
let somaCentSaldoEsperada = 0;

for (const linha of relatorioNotas.linhas) {
    somaCentOriginalEsperada += moedaParaCentavos(linha.valorOriginal);
    somaCentRecebidoEsperada += moedaParaCentavos(linha.totalRecebido);
    somaCentSaldoEsperada += moedaParaCentavos(linha.saldoDevedor);
}

assert.strictEqual(moedaParaCentavos(autoN.somaValorOriginal), somaCentOriginalEsperada, 'Auto-Soma: Valor original deve bater no centavo exato');
assert.strictEqual(moedaParaCentavos(autoN.somaTotalRecebido), somaCentRecebidoEsperada, 'Auto-Soma: Total recebido deve bater no centavo exato');
assert.strictEqual(moedaParaCentavos(autoN.somaSaldoDevedor), somaCentSaldoEsperada, 'Auto-Soma: Saldo devedor deve bater no centavo exato');

// 2. Prova de que a soma das faixas de vencimento é IDÊNTICA à auto-soma do saldo devedor
const fx = autoN.resumoPorFaixaVencimento;
const somaFaixasCent = moedaParaCentavos(fx.A_VENCER.saldo) +
                      moedaParaCentavos(fx.VENCE_HOJE.saldo) +
                      moedaParaCentavos(fx.ATRASO_1_30.saldo) +
                      moedaParaCentavos(fx.ATRASO_31_60.saldo) +
                      moedaParaCentavos(fx.ATRASO_61_90.saldo) +
                      moedaParaCentavos(fx.ATRASO_MAIS_90.saldo);

assert.strictEqual(somaFaixasCent, moedaParaCentavos(autoN.somaSaldoDevedor), 'A soma das faixas de atraso deve ser RIGOROSAMENTE IGUAL a somaSaldoDevedor');

// 3. Prova de que a soma dos subtotais por cliente é IDÊNTICA à auto-soma do saldo devedor
let somaClientesSaldoCent = 0;
for (const subCli of autoN.subtotaisPorCliente) {
    somaClientesSaldoCent += moedaParaCentavos(subCli.somaSaldo);
}
assert.strictEqual(somaClientesSaldoCent, moedaParaCentavos(autoN.somaSaldoDevedor), 'A soma dos saldos por cliente deve ser RIGOROSAMENTE IGUAL a somaSaldoDevedor');

console.log(`   ✓ Prova da Auto-Soma das Notas aprovada: Saldo Geral = R$ ${autoN.somaSaldoDevedor} (Faixas = R$ ${centavosParaReais(somaFaixasCent)} | Clientes = R$ ${centavosParaReais(somaClientesSaldoCent)})`);

// =========================================================================
// 6. PROVA MATEMÁTICA DE FILTRAGEM COMBINÁVEL DE NOTAS
// =========================================================================
console.log('5. Testando filtros combináveis de Notas (Período, Status, Cliente, Faixa)...');

// Filtro por Cliente cli_01
const relCli1 = gerarRelatorioNotasDetalhado(listaNotas, mapaClientes, {
    atalhoPeriodo: 'TODOS',
    clienteFiltro: 'cli_01',
    statusFiltro: 'TODAS',
    faixaVencimentoFiltro: 'TODAS'
}, dataRef);
assert.strictEqual(relCli1.linhas.length, 3, 'Cliente cli_01 deve ter 3 notas');

// Filtro apenas notas PENDENTES (exclui QUITADA e CANCELADA)
const relPendentes = gerarRelatorioNotasDetalhado(listaNotas, mapaClientes, {
    atalhoPeriodo: 'TODOS',
    clienteFiltro: 'TODOS',
    statusFiltro: 'PENDENTES',
    faixaVencimentoFiltro: 'TODAS'
}, dataRef);
assert.strictEqual(relPendentes.linhas.length, 7, 'Devem existir 7 notas pendentes');
for (const l of relPendentes.linhas) {
    assert(l.saldoDevedor > 0, 'Todas as notas pendentes devem ter saldo > 0');
    assert(l.statusFinanceiro !== 'CANCELADA', 'Nenhuma nota cancelada pode estar em pendentes');
}

// Filtro por Faixa de Atraso: ATRASO_1_30
const relAtraso1_30 = gerarRelatorioNotasDetalhado(listaNotas, mapaClientes, {
    atalhoPeriodo: 'TODOS',
    clienteFiltro: 'TODOS',
    statusFiltro: 'TODAS',
    faixaVencimentoFiltro: 'ATRASO_1_30'
}, dataRef);
assert.strictEqual(relAtraso1_30.linhas.length, 2);
const controles1_30 = relAtraso1_30.linhas.map(function(l) { return l.numeroControle; });
assert(controles1_30.includes('NP-003'));
assert(controles1_30.includes('NP-009'));

// Filtro por Base de Data: EMISSAO em Outubro/2026
const relEmissaoOut = gerarRelatorioNotasDetalhado(listaNotas, mapaClientes, {
    atalhoPeriodo: 'MES_ATUAL',
    baseData: 'EMISSAO',
    clienteFiltro: 'TODOS',
    statusFiltro: 'TODAS',
    faixaVencimentoFiltro: 'TODAS'
}, dataRef);
// Notas com emissão em outubro: nota_01 (01/10), nota_08 (02/10)
assert.strictEqual(relEmissaoOut.linhas.length, 2);

console.log('   ✓ Todos os filtros combináveis de Notas validados com sucesso!');

// =========================================================================
// 7. PROVA MATEMÁTICA DA AUTO-SOMA: PAGAMENTOS RECEBIDOS (FLUXO DE CAIXA)
// =========================================================================
console.log('6. Executando prova matemática da Auto-Soma em Pagamentos Recebidos (Caixa)...');

const relatorioPagtos = gerarRelatorioPagamentosRecebidos(listaNotas, mapaClientes, {
    atalhoPeriodo: 'TODOS',
    clienteFiltro: 'TODOS',
    formaPagamentoFiltro: 'TODAS',
    statusPagamentoFiltro: 'TODOS'
}, dataRef);

const autoP = relatorioPagtos.autoSoma;
assert.strictEqual(relatorioPagtos.linhas.length, 4, 'Total de 4 baixas registradas na massa');
assert.strictEqual(autoP.quantidadePagamentosAtivos, 3, 'Devem existir 3 pagamentos ativos');
assert.strictEqual(autoP.quantidadePagamentosEstornados, 1, 'Deve existir 1 pagamento estornado');

// Prova da soma dos pagamentos ativos:
// pag_01: R$ 500,00 (PIX)
// pag_02: R$ 250,75 (Dinheiro)
// pag_03: R$ 600,00 (Cartão de Crédito)
// Total Ativo Esperado: R$ 1.350,75
assert.strictEqual(moedaParaCentavos(autoP.somaValorRecebidoAtivo), 135075, 'Auto-Soma: Valor ativo deve ser exatamente R$ 1.350,75');
assert.strictEqual(moedaParaCentavos(autoP.somaValorEstornado), 30000, 'Auto-Soma: Valor estornado deve ser exatamente R$ 300,00');

// Prova de que a soma das Formas de Pagamento bate 100% com o valor recebido ativo
let somaFormasCent = 0;
for (const subF of autoP.subtotaisPorFormaPagamento) {
    somaFormasCent += moedaParaCentavos(subF.totalRecebido);
}
assert.strictEqual(somaFormasCent, moedaParaCentavos(autoP.somaValorRecebidoAtivo), 'A soma das formas de pagamento deve ser RIGOROSAMENTE IGUAL a somaValorRecebidoAtivo');

// Prova de que a soma dos Subtotais por Dia bate 100% com o valor recebido ativo
let somaDiasCent = 0;
for (const subD of autoP.subtotaisPorDia) {
    somaDiasCent += moedaParaCentavos(subD.totalDia);
}
assert.strictEqual(somaDiasCent, moedaParaCentavos(autoP.somaValorRecebidoAtivo), 'A soma dos dias deve ser RIGOROSAMENTE IGUAL a somaValorRecebidoAtivo');

// Filtro apenas por PIX
const relPix = gerarRelatorioPagamentosRecebidos(listaNotas, mapaClientes, {
    atalhoPeriodo: 'TODOS',
    clienteFiltro: 'TODOS',
    formaPagamentoFiltro: 'PIX',
    statusPagamentoFiltro: 'ATIVOS'
}, dataRef);
assert.strictEqual(relPix.linhas.length, 1);
assert.strictEqual(relPix.linhas[0].numeroRecibo, 'REC-001');
assert.strictEqual(moedaParaCentavos(relPix.autoSoma.somaValorRecebidoAtivo), 50000);

console.log(`   ✓ Prova da Auto-Soma de Caixa aprovada: Total Ativo = R$ ${autoP.somaValorRecebidoAtivo} (Formas = R$ ${centavosParaReais(somaFormasCent)} | Dias = R$ ${centavosParaReais(somaDiasCent)})`);

// =========================================================================
// 8. TESTE DE GERAÇÃO E AUDITORIA DE CSV (EXCEL UTF-8 COM BOM)
// =========================================================================
console.log('7. Testando exportação de CSV compatível com Microsoft Excel...');

// CSV de Notas
const csvNotas = gerarCSVRelatorioNotas(relatorioNotas);
assert(csvNotas.startsWith('\uFEFF'), 'CSV deve iniciar com BOM UTF-8 (\\uFEFF) para abrir com acentuação correta no Excel');
assert(csvNotas.includes(';'), 'CSV deve utilizar delimitador ponto e vírgula (;)');
assert(csvNotas.includes('TOTAL GERAL (AUTO-SOMA)'), 'CSV deve conter linha obrigatória de TOTAL GERAL (AUTO-SOMA)');

// Verifica que o total final no CSV de Notas reflete o saldo da Auto-Soma
const valorSaldoCsvFormatado = formatarMoedaCsv(autoN.somaSaldoDevedor);
assert(csvNotas.includes(valorSaldoCsvFormatado), `Linha final do CSV deve conter saldo formatado com vírgula: "${valorSaldoCsvFormatado}"`);

// CSV de Pagamentos
const csvPagtos = gerarCSVRelatorioPagamentos(relatorioPagtos);
assert(csvPagtos.startsWith('\uFEFF'), 'CSV de pagamentos deve iniciar com BOM UTF-8');
assert(csvPagtos.includes('TOTAL GERAL (AUTO-SOMA)'), 'CSV de pagamentos deve conter linha de TOTAL GERAL');

const valorPagoCsvFormatado = formatarMoedaCsv(autoP.somaValorRecebidoAtivo);
assert(csvPagtos.includes(valorPagoCsvFormatado), `Linha final do CSV deve conter valor pago formatado: "${valorPagoCsvFormatado}"`);

console.log('   ✓ Exportações CSV validadas com BOM, delimitadores e linha final de Auto-Soma!');

console.log('\n=================================================================');
console.log('SUÍTE DA FASE 2 (RELATÓRIOS & AUTO-SOMA) CONCLUÍDA COM 100% DE SUCESSO!');
console.log('=================================================================\n');
