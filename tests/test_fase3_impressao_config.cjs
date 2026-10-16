// =========================================================================
// TESTE DA FASE 3: CONFIGURAÇÕES DA EMPRESA, PIX E IMPRESSÃO PROFISSIONAL A4
// =========================================================================
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('=================================================================');
console.log('INICIANDO SUÍTE DE TESTES DA FASE 3: CONFIGURAÇÕES, PIX & IMPRESSÃO');
console.log('=================================================================\n');

// 1. Carregamento dos módulos no contexto VM isolado
const nucleoJs = fs.readFileSync(path.join(__dirname, '../src/js/nucleo-financeiro.js'), 'utf8');
const clientesJs = fs.readFileSync(path.join(__dirname, '../src/js/clientes.js'), 'utf8');
const relatoriosJs = fs.readFileSync(path.join(__dirname, '../src/js/relatorios.js'), 'utf8');
const configuracoesJs = fs.readFileSync(path.join(__dirname, '../src/js/configuracoes.js'), 'utf8');
const impressaoJs = fs.readFileSync(path.join(__dirname, '../src/js/impressao.js'), 'utf8');

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
vm.runInContext(configuracoesJs, context);
vm.runInContext(impressaoJs, context);

const {
    CONFIG_EMPRESA_PADRAO,
    normalizarConfiguracoesEmpresa,
    validarDadosConfiguracaoEmpresa,
    obterConfiguracoesEmpresaSegura
} = sandbox;

const {
    gerarCabecalhoEmpresaPrintHtml,
    gerarBlocoPixPrintHtml,
    gerarHtmlImpressaoNotaPrazoA4,
    gerarHtmlImpressaoReciboPagamentoA4,
    gerarHtmlImpressaoExtratoClienteA4,
    gerarHtmlImpressaoRelatorioA4,
    formatarMoedaImpressao,
    formatarDataImpressaoBr
} = sandbox;

assert(typeof normalizarConfiguracoesEmpresa === 'function', 'normalizarConfiguracoesEmpresa deve existir');
assert(typeof validarDadosConfiguracaoEmpresa === 'function', 'validarDadosConfiguracaoEmpresa deve existir');
assert(typeof gerarCabecalhoEmpresaPrintHtml === 'function', 'gerarCabecalhoEmpresaPrintHtml deve existir');
assert(typeof gerarBlocoPixPrintHtml === 'function', 'gerarBlocoPixPrintHtml deve existir');
assert(typeof gerarHtmlImpressaoNotaPrazoA4 === 'function', 'gerarHtmlImpressaoNotaPrazoA4 deve existir');
assert(typeof gerarHtmlImpressaoReciboPagamentoA4 === 'function', 'gerarHtmlImpressaoReciboPagamentoA4 deve existir');
assert(typeof gerarHtmlImpressaoExtratoClienteA4 === 'function', 'gerarHtmlImpressaoExtratoClienteA4 deve existir');
assert(typeof gerarHtmlImpressaoRelatorioA4 === 'function', 'gerarHtmlImpressaoRelatorioA4 deve existir');

// =========================================================================
// 2. TESTES DE CONFIGURAÇÕES DA EMPRESA E NORMALIZAÇÃO
// =========================================================================
console.log('1. Testando normalização e validação de configurações da empresa...');

// Objeto vazio -> adota padrões oficiais
const cfgVazia = normalizarConfiguracoesEmpresa({});
assert.strictEqual(cfgVazia.nomeFantasia, 'TUCANO AUTO PEÇAS');
assert.strictEqual(cfgVazia.diasAlertaVencimento, 3);
assert.strictEqual(cfgVazia.endereco, 'Nova Friburgo - RJ');

// Objeto com dias inválidos (> 30 ou < 1)
const cfgDiasInvalido = normalizarConfiguracoesEmpresa({ diasAlertaVencimento: 99 });
assert.strictEqual(cfgDiasInvalido.diasAlertaVencimento, 3, 'Dias de alerta > 30 deve retornar ao padrão (3)');

const cfgDiasValido = normalizarConfiguracoesEmpresa({ diasAlertaVencimento: 7 });
assert.strictEqual(cfgDiasValido.diasAlertaVencimento, 7);

// Validação: nome vazio deve falhar
const valSemNome = validarDadosConfiguracaoEmpresa({ nomeFantasia: '' });
assert.strictEqual(valSemNome.valido, false);
assert(valSemNome.erro.includes('Nome Fantasia'));

// Validação: dias inválidos deve falhar
const valDias = validarDadosConfiguracaoEmpresa({ nomeFantasia: 'Tucano', diasAlertaVencimento: 0 });
assert.strictEqual(valDias.valido, false);

// Validação: CNPJ com dígito verificador inválido deve falhar
const valCnpjInvalido = validarDadosConfiguracaoEmpresa({ nomeFantasia: 'Tucano', cnpj: '11.222.333/0001-44' });
assert.strictEqual(valCnpjInvalido.valido, false);
assert(valCnpjInvalido.erro.includes('CNPJ inválido'));

// Validação completa bem-sucedida (com CNPJ válido)
const valOk = validarDadosConfiguracaoEmpresa({
    nomeFantasia: 'Tucano Auto Peças Express',
    razaoSocial: 'Tucano Peças Eireli',
    cnpj: '11.222.333/0001-81',
    chavePix: 'financeiro@tucanopecas.com.br',
    tipoChavePix: 'E-mail',
    titularPix: 'Tucano Peças Eireli',
    diasAlertaVencimento: 5
});
assert.strictEqual(valOk.valido, true);
assert.strictEqual(valOk.dadosNormalizados.nomeFantasia, 'Tucano Auto Peças Express');
assert.strictEqual(valOk.dadosNormalizados.chavePix, 'financeiro@tucanopecas.com.br');
assert.strictEqual(valOk.dadosNormalizados.diasAlertaVencimento, 5);

console.log('   ✓ Normalização e validação de configurações 100% aprovadas!');

// =========================================================================
// 3. TESTES DE CABEÇALHO PADRÃO E BLOCO PIX
// =========================================================================
console.log('2. Testando cabeçalho A4 e bloco informativo de pagamento PIX...');

const configExemplo = {
    nomeFantasia: 'TUCANO AUTO PEÇAS',
    subtitulo: 'Peças e Acessórios de Alta Qualidade',
    cnpj: '11.222.333/0001-81',
    telefone: '(22) 2522-0000',
    whatsappLoja: '(22) 99999-8888',
    endereco: 'Av. Alberto Braune, 100 - Centro, Nova Friburgo - RJ',
    chavePix: '22999998888',
    tipoChavePix: 'Celular',
    titularPix: 'Tucano Auto Peças Ltda',
    rodapeDocumentos: 'Agradecemos a confiança!'
};

const cabecalhoHtml = gerarCabecalhoEmpresaPrintHtml(configExemplo, 'COMPROVANTE DE TESTE', 'Subtítulo do Teste');
assert(cabecalhoHtml.includes('TUCANO AUTO PEÇAS'));
assert(cabecalhoHtml.includes('Peças e Acessórios de Alta Qualidade'));
assert(cabecalhoHtml.includes('11.222.333/0001-81'));
assert(cabecalhoHtml.includes('Av. Alberto Braune, 100'));
assert(cabecalhoHtml.includes('COMPROVANTE DE TESTE'));

// Bloco PIX sem chave configurada -> vazio
const pixSemChave = gerarBlocoPixPrintHtml({ chavePix: '' }, 150.00);
assert.strictEqual(pixSemChave, '');

// Bloco PIX com chave configurada
const pixComChave = gerarBlocoPixPrintHtml(configExemplo, 250.75);
assert(pixComChave.includes('PAGAMENTO RÁPIDO VIA PIX'));
assert(pixComChave.includes('22999998888'));
assert(pixComChave.includes('Celular'));
assert(pixComChave.includes('Tucano Auto Peças Ltda'));
assert(pixComChave.includes('250,75'));

console.log('   ✓ Cabeçalho padronizado e bloco PIX gerados com perfeição!');

// =========================================================================
// 4. TESTE DE IMPRESSÃO A4 DE NOTA A PRAZO
// =========================================================================
console.log('3. Testando impressão A4 profissional de Nota a Prazo...');

const notaExemplo = {
    id: 'nota_100',
    numeroControle: 'NP-000100',
    cliente: 'OFICINA DO MARCOS LTDA',
    cpfCnpj: '12.345.678/0001-90',
    telefone: '(22) 98888-2222',
    numeroPedido: 'PED-4589',
    numeroDocumento: 'NF-1029',
    dataEmissao: '2026-10-01',
    dataVencimento: '2026-10-30',
    valorOriginal: 1200.00,
    status: 'PARCIAL',
    observacao: 'Troca de pastilhas e óleo motor.',
    pagamentos: [
        { id: 'pag_1', dataPagamento: '2026-10-10', valor: 400.00, formaPagamento: 'PIX', numeroRecibo: 'REC-0001', status: 'ATIVO' }
    ]
};

const htmlNota = gerarHtmlImpressaoNotaPrazoA4(notaExemplo, configExemplo, '2026-10-15');
assert(htmlNota.includes('class="a4-print-full"'), 'Deve conter container .a4-print-full');
assert(htmlNota.includes('TUCANO AUTO PEÇAS'));
assert(htmlNota.includes('NP-000100'));
assert(htmlNota.includes('OFICINA DO MARCOS LTDA'));
assert(htmlNota.includes('12.345.678/0001-90'));
assert(htmlNota.includes('R$ 1.200,00')); // Valor original
assert(htmlNota.includes('R$ 400,00'));   // Total recebido
assert(htmlNota.includes('R$ 800,00'));   // Saldo restante
assert(htmlNota.includes('TERMO DE RECONHECIMENTO DE DÍVIDA'));
assert(htmlNota.includes('REC-0001'));     // Histórico de pagamentos
assert(htmlNota.includes('22999998888'), 'Deve conter chave PIX para pagamento do saldo restante');

console.log('   ✓ Impressão A4 de Nota a Prazo validada com todos os blocos exigidos!');

// =========================================================================
// 5. TESTE DE RECIBO DE PAGAMENTO, QUITAÇÃO, 2ª VIA E ESTORNO
// =========================================================================
console.log('4. Testando recibos de pagamento (parcial, quitação, 2ª via e comprovante de estorno)...');

// Caso A: Recibo Parcial
const htmlReciboParcial = gerarHtmlImpressaoReciboPagamentoA4(notaExemplo, 'pag_1', { segundaVia: false }, configExemplo);
assert(htmlReciboParcial.includes('RECIBO DE PAGAMENTO'));
assert(htmlReciboParcial.includes('REC-0001'));
assert(htmlReciboParcial.includes('R$ 400,00'));
assert(htmlReciboParcial.includes('quatrocentos reais')); // valor por extenso
assert(htmlReciboParcial.includes('R$ 800,00')); // saldo restante

// Caso B: 2ª Via do Recibo
const htmlRecibo2Via = gerarHtmlImpressaoReciboPagamentoA4(notaExemplo, 'pag_1', { segundaVia: true }, configExemplo);
assert(htmlRecibo2Via.includes('2ª VIA'));

// Caso C: Recibo de Quitação Definitiva
const notaQuitadaExemplo = {
    id: 'nota_200',
    numeroControle: 'NP-000200',
    cliente: 'AUTO CENTER SILVA',
    valorOriginal: 500.00,
    dataEmissao: '2026-10-05',
    dataVencimento: '2026-10-25',
    status: 'QUITADA',
    pagamentos: [
        { id: 'pag_2', dataPagamento: '2026-10-12', valor: 500.00, formaPagamento: 'Dinheiro', numeroRecibo: 'REC-0002', status: 'ATIVO', saldoApos: 0 }
    ]
};
const htmlReciboQuitacao = gerarHtmlImpressaoReciboPagamentoA4(notaQuitadaExemplo, 'pag_2', {}, configExemplo);
assert(htmlReciboQuitacao.includes('RECIBO DE QUITAÇÃO DEFINITIVA'));
assert(htmlReciboQuitacao.includes('PAGAMENTO TOTAL E QUITAÇÃO DEFINITIVA'));

// Caso D: Pagamento ESTORNADO -> Comprovante de Estorno
const notaComEstorno = {
    id: 'nota_300',
    numeroControle: 'NP-000300',
    cliente: 'TRANSPORTE VELOZ',
    valorOriginal: 800.00,
    pagamentos: [
        {
            id: 'pag_3',
            dataPagamento: '2026-10-08',
            valor: 350.00,
            formaPagamento: 'Cartão de Débito',
            numeroRecibo: 'REC-0003',
            status: 'ESTORNADO',
            estornadoEm: '2026-10-09',
            estornadoPor: 'gerente@tucano.com.br',
            motivoEstorno: 'Lançamento duplicado no terminal.'
        }
    ]
};
const htmlComprovanteEstorno = gerarHtmlImpressaoReciboPagamentoA4(notaComEstorno, 'pag_3', {}, configExemplo);
assert(htmlComprovanteEstorno.includes('COMPROVANTE DE ESTORNO DE PAGAMENTO'));
assert(htmlComprovanteEstorno.includes('REC-0003'));
assert(htmlComprovanteEstorno.includes('gerente@tucano.com.br'));
assert(htmlComprovanteEstorno.includes('Lançamento duplicado no terminal.'));
assert(htmlComprovanteEstorno.includes('AVISO LEGAL DE AUDITORIA'));

console.log('   ✓ Todos os cenários de recibo (Parcial, Quitação, 2ª Via e Estorno) 100% validados!');

// =========================================================================
// 6. TESTE DE EXTRATO DE CLIENTE (MULTIPÁGINA A4)
// =========================================================================
console.log('5. Testando extrato multipágina de Conta Corrente do Cliente...');

const clienteExemplo = {
    id: 'cli_01',
    codigo: 'CLI-0001',
    nome: 'OFICINA DO MARCOS LTDA',
    cpfCnpj: '12.345.678/0001-90',
    telefone: '(22) 98888-2222',
    endereco: 'Rua das Flores, 50 - Nova Friburgo - RJ',
    limiteCredito: 5000.00
};

const resumoCarteiraExemplo = {
    totalOriginal: 3500.00,
    totalRecebido: 1500.00,
    saldoTotal: 2000.00,
    notas: [
        { id: 'n1', numeroControle: 'NP-001', dataEmissao: '2026-09-01', dataVencimento: '2026-10-01', valorOriginal: 2000.00, totalRecebido: 1000.00, saldoDevedor: 1000.00, status: 'PARCIAL' },
        { id: 'n2', numeroControle: 'NP-002', dataEmissao: '2026-10-01', dataVencimento: '2026-10-30', valorOriginal: 1500.00, totalRecebido: 500.00, saldoDevedor: 1000.00, status: 'PARCIAL' }
    ]
};

const htmlExtrato = gerarHtmlImpressaoExtratoClienteA4(clienteExemplo, resumoCarteiraExemplo, configExemplo, '2026-10-15');
assert(htmlExtrato.includes('class="a4-print-relatorio"'), 'Extrato deve utilizar container multipágina .a4-print-relatorio');
assert(htmlExtrato.includes('EXTRATO DE CONTA CORRENTE / POSIÇÃO CONSOLIDADA'));
assert(htmlExtrato.includes('OFICINA DO MARCOS LTDA'));
assert(htmlExtrato.includes('CLI-0001'));
assert(htmlExtrato.includes('R$ 3.500,00')); // Total compras
assert(htmlExtrato.includes('R$ 1.500,00')); // Total pago
assert(htmlExtrato.includes('R$ 2.000,00')); // Saldo devedor
assert(htmlExtrato.includes('NP-001'));
assert(htmlExtrato.includes('NP-002'));
assert(htmlExtrato.includes('AUTO-SOMA DO EXTRATO'));

console.log('   ✓ Extrato multipágina de Cliente validado com sucesso!');

// =========================================================================
// 7. TESTE DE RELATÓRIO ANALÍTICO A4 (MULTIPÁGINA)
// =========================================================================
console.log('6. Testando relatório gerencial A4 multipágina com Auto-Soma...');

const resultadoRelatorioExemplo = {
    tipo: 'NOTAS_VENCIMENTO',
    intervalo: { descricaoPeriodo: 'Mês Atual (10/2026)' },
    dados: {
        autoSoma: {
            quantidadeRegistros: 2,
            somaValorOriginal: 3500.00,
            somaTotalRecebido: 1500.00,
            somaSaldoDevedor: 2000.00
        },
        linhas: [
            { id: 'n1', numeroControle: 'NP-001', clienteNome: 'MARCOS', dataEmissao: '2026-10-01', dataVencimento: '2026-10-20', statusFinanceiro: 'ABERTA', valorOriginal: 2000.00, totalRecebido: 1000.00, saldoDevedor: 1000.00 },
            { id: 'n2', numeroControle: 'NP-002', clienteNome: 'SILVA', dataEmissao: '2026-10-02', dataVencimento: '2026-10-25', statusFinanceiro: 'PARCIAL', valorOriginal: 1500.00, totalRecebido: 500.00, saldoDevedor: 1000.00 }
        ]
    }
};

const htmlRelatorio = gerarHtmlImpressaoRelatorioA4(resultadoRelatorioExemplo, { tipoRelatorio: 'NOTAS_VENCIMENTO', baseData: 'VENCIMENTO', clienteFiltro: 'TODOS' }, configExemplo, 'admin@tucano.com.br');
assert(htmlRelatorio.includes('class="a4-print-relatorio"'), 'Relatório deve utilizar container multipágina .a4-print-relatorio');
assert(htmlRelatorio.includes('RELATÓRIO DE CONTAS A RECEBER POR VENCIMENTO'));
assert(htmlRelatorio.includes('Mês Atual (10/2026)'));
assert(htmlRelatorio.includes('NP-001'));
assert(htmlRelatorio.includes('NP-002'));
assert(htmlRelatorio.includes('AUTO-SOMA DO RELATÓRIO (2 notas)'));
assert(htmlRelatorio.includes('R$ 2.000,00')); // Saldo da auto-soma

console.log('   ✓ Relatório gerencial A4 multipágina validado com precisão!');

console.log('\n=================================================================');
console.log('SUÍTE DA FASE 3 (CONFIGURAÇÕES & IMPRESSÃO) CONCLUÍDA COM 100% DE SUCESSO!');
console.log('=================================================================\n');
