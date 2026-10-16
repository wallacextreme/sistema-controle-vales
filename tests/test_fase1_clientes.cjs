// =========================================================================
// TESTES DO MÓDULO DE CLIENTES E CARTEIRA (FASE 1 / T-101 e T-103)
// =========================================================================
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('--- TESTE DA GESTÃO DE CLIENTES E CARTEIRA (src/js/clientes.js) ---');

// 1. Carregamento Seguro no Sandbox V8 (padrão AGENTS.md)
const caminhoNucleo = path.join(__dirname, '../src/js/nucleo-financeiro.js');
const caminhoClientes = path.join(__dirname, '../src/js/clientes.js');

const codigoNucleo = fs.readFileSync(caminhoNucleo, 'utf8');
const codigoClientes = fs.readFileSync(caminhoClientes, 'utf8');

const sandbox = {};
vm.createContext(sandbox);

// Executa primeiro o núcleo financeiro e depois o módulo de clientes no mesmo contexto
vm.runInContext(codigoNucleo, sandbox);
vm.runInContext(codigoClientes, sandbox);

assert.strictEqual(typeof sandbox.normalizarNomeCliente, 'function', 'normalizarNomeCliente deve estar acessível no sandbox VM');
assert.strictEqual(typeof sandbox.limparDigitosDocumento, 'function', 'limparDigitosDocumento deve estar acessível no sandbox VM');
assert.strictEqual(typeof sandbox.validarCPF, 'function', 'validarCPF deve estar acessível no sandbox VM');
assert.strictEqual(typeof sandbox.validarCNPJ, 'function', 'validarCNPJ deve estar acessível no sandbox VM');
assert.strictEqual(typeof sandbox.validarEFormatarCpfCnpj, 'function', 'validarEFormatarCpfCnpj deve estar acessível no sandbox VM');
assert.strictEqual(typeof sandbox.normalizarTelefoneCliente, 'function', 'normalizarTelefoneCliente deve estar acessível no sandbox VM');
assert.strictEqual(typeof sandbox.notaPertenceAoCliente, 'function', 'notaPertenceAoCliente deve estar acessível no sandbox VM');
assert.strictEqual(typeof sandbox.calcularResumoCarteiraCliente, 'function', 'calcularResumoCarteiraCliente deve estar acessível no sandbox VM');
assert.strictEqual(typeof sandbox.consolidarCarteiraGeralClientes, 'function', 'consolidarCarteiraGeralClientes deve estar acessível no sandbox VM');
assert.strictEqual(typeof sandbox.gerarSugestoesConciliacaoClientes, 'function', 'gerarSugestoesConciliacaoClientes deve estar acessível no sandbox VM');

console.log('✓ Sucesso: Carregamento no VM context sem erros de sintaxe ou referências globais proibidas.');

const cl = sandbox;

// -------------------------------------------------------------------------
// 2. FUNÇÕES PURAS DE NORMALIZAÇÃO E DOCUMENTOS
// -------------------------------------------------------------------------
console.log('2. Testando normalização de nome e limpeza de documentos...');

// normalizarNomeCliente
assert.strictEqual(cl.normalizarNomeCliente('João da Silva'), 'JOAO DA SILVA');
assert.strictEqual(cl.normalizarNomeCliente('  auto  peças  tucano  ltda  '), 'AUTO PECAS TUCANO LTDA');
assert.strictEqual(cl.normalizarNomeCliente('ÁÉÍÓÚ çãõ'), 'AEIOU CAO');
assert.strictEqual(cl.normalizarNomeCliente(null), '');
assert.strictEqual(cl.normalizarNomeCliente(undefined), '');

// limparDigitosDocumento
assert.strictEqual(cl.limparDigitosDocumento('123.456.789-01'), '12345678901');
assert.strictEqual(cl.limparDigitosDocumento('00.000.000/0001-91'), '00000000000191');
assert.strictEqual(cl.limparDigitosDocumento('(11) 98765-4321'), '11987654321');
assert.strictEqual(cl.limparDigitosDocumento(null), '');

console.log('   ✓ Normalização e limpeza de caracteres validadas.');

// -------------------------------------------------------------------------
// 3. VALIDAÇÃO MATEMÁTICA DE CPF E CNPJ
// -------------------------------------------------------------------------
console.log('3. Testando validação matemática de CPF e CNPJ...');

// CPF Válido real
assert.strictEqual(cl.validarCPF('52998224725'), true, 'CPF válido deve ser aprovado');
assert.strictEqual(cl.validarCPF('05307323948'), true, 'CPF válido com zero inicial deve ser aprovado');
assert.strictEqual(cl.validarCPF('529.982.247-25'), true, 'CPF formatado válido deve ser aprovado');

// CPF Inválido
assert.strictEqual(cl.validarCPF('11111111111'), false, 'CPF com dígitos repetidos deve ser rejeitado');
assert.strictEqual(cl.validarCPF('00000000000'), false, 'CPF com zeros repetidos deve ser rejeitado');
assert.strictEqual(cl.validarCPF('12345678900'), false, 'CPF com dígito verificador errado deve ser rejeitado');
assert.strictEqual(cl.validarCPF('12345'), false, 'CPF com menos de 11 dígitos deve ser rejeitado');

// CNPJ Válido real
assert.strictEqual(cl.validarCNPJ('00000000000191'), true, 'CNPJ Banco do Brasil deve ser aprovado');
assert.strictEqual(cl.validarCNPJ('11.222.333/0001-81'), true, 'CNPJ formatado válido deve ser aprovado');
assert.strictEqual(cl.validarCNPJ('04.252.011/0001-10'), true, 'CNPJ válido deve ser aprovado');

// CNPJ Inválido
assert.strictEqual(cl.validarCNPJ('00000000000000'), false, 'CNPJ repetido deve ser rejeitado');
assert.strictEqual(cl.validarCNPJ('11111111111111'), false, 'CNPJ repetido deve ser rejeitado');
assert.strictEqual(cl.validarCNPJ('11222333000199'), false, 'CNPJ com dígito verificador errado deve ser rejeitado');

// validarEFormatarCpfCnpj
const vazio = cl.validarEFormatarCpfCnpj('');
assert.strictEqual(vazio.valido, true);
assert.strictEqual(vazio.opcionalVazio, true);

const nulo = cl.validarEFormatarCpfCnpj(null);
assert.strictEqual(nulo.valido, true);
assert.strictEqual(nulo.opcionalVazio, true);

const cpfFormatado = cl.validarEFormatarCpfCnpj('52998224725');
assert.strictEqual(cpfFormatado.valido, true);
assert.strictEqual(cpfFormatado.tipo, 'CPF');
assert.strictEqual(cpfFormatado.limpo, '52998224725');
assert.strictEqual(cpfFormatado.formatado, '529.982.247-25');

const cnpjFormatado = cl.validarEFormatarCpfCnpj('00000000000191');
assert.strictEqual(cnpjFormatado.valido, true);
assert.strictEqual(cnpjFormatado.tipo, 'CNPJ');
assert.strictEqual(cnpjFormatado.limpo, '00000000000191');
assert.strictEqual(cnpjFormatado.formatado, '00.000.000/0001-91');

const docInvalidoTam = cl.validarEFormatarCpfCnpj('123456');
assert.strictEqual(docInvalidoTam.valido, false);

console.log('   ✓ Validação matemática de CPF e CNPJ 100% validada.');

// -------------------------------------------------------------------------
// 4. NORMALIZAÇÃO E VALIDAÇÃO DE TELEFONE
// -------------------------------------------------------------------------
console.log('4. Testando normalização de telefone...');

const telVazio = cl.normalizarTelefoneCliente('');
assert.strictEqual(telVazio.valido, true);
assert.strictEqual(telVazio.opcionalVazio, true);

const telMovel = cl.normalizarTelefoneCliente('11987654321');
assert.strictEqual(telMovel.valido, true);
assert.strictEqual(telMovel.formatado, '(11) 98765-4321');
assert.strictEqual(telMovel.waNumber, '5511987654321');

const telCom55 = cl.normalizarTelefoneCliente('5511987654321');
assert.strictEqual(telCom55.valido, true);
assert.strictEqual(telCom55.formatado, '(11) 98765-4321');
assert.strictEqual(telCom55.waNumber, '5511987654321');

const telFixo = cl.normalizarTelefoneCliente('1133334444');
assert.strictEqual(telFixo.valido, true);
assert.strictEqual(telFixo.formatado, '(11) 3333-4444');
assert.strictEqual(telFixo.waNumber, '551133334444');

const telDddInvalido = cl.normalizarTelefoneCliente('05987654321');
assert.strictEqual(telDddInvalido.valido, false);

const telCurto = cl.normalizarTelefoneCliente('12345');
assert.strictEqual(telCurto.valido, false);

console.log('   ✓ Validação e normalização de telefone brasileira validadas.');

// -------------------------------------------------------------------------
// 5. ASSOCIAÇÃO DE NOTAS A CLIENTES (notaPertenceAoCliente)
// -------------------------------------------------------------------------
console.log('5. Testando vínculo e matching de notas por ID e fallback...');

const cli1 = { id: 'CLI_100', nome: 'Mecânica Modelo', cpfCnpj: '00.000.000/0001-91' };

// Match direto por clienteId
assert.strictEqual(cl.notaPertenceAoCliente({ clienteId: 'CLI_100', cliente: 'Outro Nome' }, cli1), true);

// Match por nome normalizado (nota antiga sem clienteId)
assert.strictEqual(cl.notaPertenceAoCliente({ cliente: 'Mecanica Modelo' }, cli1), true);
assert.strictEqual(cl.notaPertenceAoCliente({ cliente: '  MECÂNICA   MODELO  ' }, cli1), true);

// Match por CPF/CNPJ (nota antiga com nome ligeiramente diferente mas mesmo documento)
assert.strictEqual(cl.notaPertenceAoCliente({ cliente: 'Mecanica Mod.', cpfCnpj: '00.000.000/0001-91' }, cli1), true);

// Não pertence a outro cliente
assert.strictEqual(cl.notaPertenceAoCliente({ clienteId: 'CLI_999', cliente: 'Mecânica do Zé' }, cli1), false);
assert.strictEqual(cl.notaPertenceAoCliente({ cliente: 'Auto Peças Silva' }, cli1), false);

console.log('   ✓ Vínculo e retrocompatibilidade de notas validados.');

// -------------------------------------------------------------------------
// 6. CÁLCULO DE CARTEIRA POR CLIENTE (calcularResumoCarteiraCliente)
// -------------------------------------------------------------------------
console.log('6. Testando resumo financeiro e Auto-Soma da carteira do cliente...');

const clienteTeste = {
    id: 'CLI_01',
    codigo: 'CLI-0001',
    nome: 'Auto Center Tucano',
    cpfCnpj: '00.000.000/0001-91',
    limiteCredito: 2000.00
};

const hojeISO = '2026-10-15';

const notasDoCliente = [
    // Nota 1: R$ 500,00 quitada
    {
        id: 'NP_001',
        numeroControle: 'NP-000001',
        clienteId: 'CLI_01',
        cliente: 'Auto Center Tucano',
        dataEmissao: '2026-09-01',
        dataVencimento: '2026-10-01',
        valorOriginal: 500.00,
        status: 'QUITADA',
        pagamentos: {
            p1: { id: 'P_1', numeroRecibo: 'REC-000001', dataPagamento: '2026-09-20', valor: 500.00, status: 'ATIVO' }
        }
    },
    // Nota 2: R$ 800,00 com baixa parcial de R$ 300,00 (saldo 500, vencida)
    {
        id: 'NP_002',
        numeroControle: 'NP-000002',
        clienteId: 'CLI_01',
        cliente: 'Auto Center Tucano',
        dataEmissao: '2026-09-05',
        dataVencimento: '2026-10-05', // vencida em relação a 2026-10-15
        valorOriginal: 800.00,
        status: 'PARCIAL',
        pagamentos: {
            p2: { id: 'P_2', numeroRecibo: 'REC-000002', dataPagamento: '2026-10-02', valor: 300.00, status: 'ATIVO' }
        }
    },
    // Nota 3: R$ 400,00 aberta sem pagamento (vence em 2026-10-25, em dia)
    {
        id: 'NP_003',
        numeroControle: 'NP-000003',
        clienteId: 'CLI_01',
        cliente: 'Auto Center Tucano',
        dataEmissao: '2026-09-25',
        dataVencimento: '2026-10-25',
        valorOriginal: 400.00,
        status: 'ABERTA',
        pagamentos: {}
    },
    // Nota 4: R$ 300,00 cancelada (não entra no saldo a pagar)
    {
        id: 'NP_004',
        numeroControle: 'NP-000004',
        clienteId: 'CLI_01',
        cliente: 'Auto Center Tucano',
        dataEmissao: '2026-09-10',
        dataVencimento: '2026-10-10',
        valorOriginal: 300.00,
        status: 'CANCELADA',
        pagamentos: {}
    },
    // Nota de outro cliente (não deve ser incluída)
    {
        id: 'NP_005',
        numeroControle: 'NP-000005',
        clienteId: 'CLI_OUTRO',
        cliente: 'Outro Cliente',
        dataEmissao: '2026-10-01',
        dataVencimento: '2026-11-01',
        valorOriginal: 999.00,
        status: 'ABERTA'
    }
];

const resumo = cl.calcularResumoCarteiraCliente(clienteTeste, notasDoCliente, hojeISO);

// Conferência em centavos inteiros
assert.strictEqual(resumo.totalEmitidoBruto, 2000.00); // 500 + 800 + 400 + 300
assert.strictEqual(resumo.totalCancelado, 300.00);
assert.strictEqual(resumo.totalEmitidoLiquido, 1700.00); // 500 + 800 + 400
assert.strictEqual(resumo.totalRecebido, 800.00); // 500 + 300
assert.strictEqual(resumo.saldoDevedor, 900.00); // 500 (restante nota 2) + 400 (nota 3)

assert.strictEqual(resumo.qtdNotasTotal, 4);
assert.strictEqual(resumo.qtdNotasAbertas, 1);
assert.strictEqual(resumo.qtdNotasParciais, 1);
assert.strictEqual(resumo.qtdNotasQuitadas, 1);
assert.strictEqual(resumo.qtdNotasCanceladas, 1);
assert.strictEqual(resumo.qtdNotasVencidas, 1); // Nota 2 venceu em 2026-10-05

// Limite de crédito
assert.strictEqual(resumo.limiteCredito, 2000.00);
assert.strictEqual(resumo.limiteDisponivel, 1100.00); // 2000 - 900
assert.strictEqual(resumo.limiteExcedido, false);

// Histórico de pagamentos consolidado
assert.strictEqual(resumo.pagamentosDoCliente.length, 2);
assert.strictEqual(resumo.ultimoPagamentoValor, 300.00);
assert.strictEqual(resumo.ultimoPagamentoData, '2026-10-02');

console.log('   ✓ Resumo da carteira individual validado com exatidão em centavos.');

// -------------------------------------------------------------------------
// 7. CONSOLIDAÇÃO GERAL DA CARTEIRA E AUTO-SOMA
// -------------------------------------------------------------------------
console.log('7. Testando consolidação da carteira geral de clientes com notas órfãs...');

const mapaClientes = {
    'CLI_01': clienteTeste,
    'CLI_02': { id: 'CLI_02', codigo: 'CLI-0002', nome: 'Borracharia São Paulo', limiteCredito: 500.00 }
};

const todasNotas = [
    ...notasDoCliente.slice(0, 4),
    // Nota órfã sem clienteId e sem cliente correspondente
    {
        id: 'NP_ORFA_1',
        numeroControle: 'NP-000006',
        cliente: 'Cliente Não Cadastrado X',
        dataEmissao: '2026-10-01',
        dataVencimento: '2026-10-31',
        valorOriginal: 250.00,
        status: 'ABERTA'
    }
];

const carteiraGeral = cl.consolidarCarteiraGeralClientes(mapaClientes, todasNotas, hojeISO);

assert.strictEqual(carteiraGeral.totaisGerais.totalClientes, 3); // 2 cadastrados + 1 virtual órfão
assert.strictEqual(carteiraGeral.totaisGerais.clientesComSaldo, 2); // CLI_01 (saldo 900) e Órfão X (saldo 250)
assert.strictEqual(carteiraGeral.totaisGerais.clientesComVencidas, 1); // CLI_01
assert.strictEqual(carteiraGeral.totaisGerais.somaSaldoDevedor, 1150.00); // 900 + 250
assert.strictEqual(carteiraGeral.totaisGerais.qtdNotasSemVinculo, 1);

// Confere Auto-Soma dos itens da carteira
const somaItens = carteiraGeral.itensCarteira.reduce((acc, it) => acc + sandbox.moedaParaCentavos(it.resumo.saldoDevedor), 0);
assert.strictEqual(sandbox.centavosParaReais(somaItens), carteiraGeral.totaisGerais.somaSaldoDevedor);

console.log('   ✓ Consolidação da carteira e Auto-Soma geral 100% consistentes.');

// -------------------------------------------------------------------------
// 8. SUGESTÕES DE CONCILIAÇÃO EM LOTE DE NOTAS ANTIGAS
// -------------------------------------------------------------------------
console.log('8. Testando gerador de sugestões de conciliação para notas legadas...');

const notasLegadasParaConciliar = [
    { id: 'LEG_1', cliente: 'Auto Center Tucano', valorOriginal: 100.00 },
    { id: 'LEG_2', cliente: 'AUTO CENTER TUCANO', valorOriginal: 200.00 },
    { id: 'LEG_3', cliente: 'Cliente Novo Inédito', cpfCnpj: '52998224725', valorOriginal: 350.00 }
];

const sugestoes = cl.gerarSugestoesConciliacaoClientes(mapaClientes, notasLegadasParaConciliar);

assert.strictEqual(sugestoes.length, 2, 'Deve agrupar em 2 clientes');

// Primeiro grupo: Auto Center Tucano (já existe CLI_01)
const grupoTucano = sugestoes.find(s => s.chaveNome === 'AUTO CENTER TUCANO');
assert(grupoTucano, 'Deve sugerir vínculo para AUTO CENTER TUCANO');
assert.strictEqual(grupoTucano.clienteExistenteId, 'CLI_01');
assert.strictEqual(grupoTucano.qtdNotas, 2);
assert.strictEqual(grupoTucano.somaValorOriginal, 300.00);

// Segundo grupo: Cliente Novo Inédito (não existe no mapa, sugere criação)
const grupoNovo = sugestoes.find(s => s.chaveNome === 'CLIENTE NOVO INEDITO');
assert(grupoNovo, 'Deve sugerir criação para CLIENTE NOVO INEDITO');
assert.strictEqual(grupoNovo.clienteExistenteId, null);
assert.strictEqual(grupoNovo.qtdNotas, 1);
assert.strictEqual(grupoNovo.somaValorOriginal, 350.00);

console.log('   ✓ Sugestões de conciliação não-destrutiva validadas com sucesso.');

console.log('\n=================================================================');
console.log('SUÍTE DA FASE 1 (CLIENTES E CARTEIRA) PASSOU COM 100% DE SUCESSO!');
console.log('=================================================================\n');
