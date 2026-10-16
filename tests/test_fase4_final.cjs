// =========================================================================
// SUÍTE DE TESTES DA FASE 4: WHATSAPP, BACKUP V3 & SEGURANÇA SINCRONIZADA
// Tucano Cloud — Tucano Auto Peças
// =========================================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('=================================================================');
console.log('INICIANDO SUÍTE DE TESTES DA FASE 4: WHATSAPP, BACKUP V3 & SEGURANÇA');
console.log('=================================================================\n');

// 1. Criação do Sandbox VM isolado para carregar todos os módulos
const sandbox = {
    console: console,
    Math: Math,
    Date: Date,
    Intl: Intl,
    parseInt: parseInt,
    parseFloat: parseFloat,
    isNaN: isNaN,
    String: String,
    Number: Number,
    Boolean: Boolean,
    Array: Array,
    Object: Object,
    encodeURIComponent: encodeURIComponent,
    decodeURIComponent: decodeURIComponent
};
vm.createContext(sandbox);

function carregarModuloNoSandbox(relPath) {
    const fullPath = path.join(__dirname, '..', relPath);
    const code = fs.readFileSync(fullPath, 'utf8');
    vm.runInContext(code, sandbox);
}

carregarModuloNoSandbox('src/js/nucleo-financeiro.js');
carregarModuloNoSandbox('src/js/clientes.js');
carregarModuloNoSandbox('src/js/relatorios.js');
carregarModuloNoSandbox('src/js/configuracoes.js');
carregarModuloNoSandbox('src/js/impressao.js');
carregarModuloNoSandbox('src/js/whatsapp.js');
carregarModuloNoSandbox('src/js/backup-v3.js');
carregarModuloNoSandbox('src/js/seguranca.js');

// Extração das funções da VM
const {
    construirUrlWhatsApp,
    gerarMensagemWhatsAppEmissaoNota,
    gerarMensagemWhatsAppReciboPagamento,
    gerarMensagemWhatsAppLembreteVencimento,
    gerarMensagemWhatsAppCobrancaNota,
    gerarMensagemWhatsAppExtratoCliente,
    gerarMensagemWhatsAppResumoRelatorio,
    listarAlertasVencimentoECobranca,
    construirPayloadBackupV3,
    analisarArquivoBackupImportacao,
    planejarOperacoesMergeNaoDestrutivo,
    gerarHashDeterministicoSenha,
    verificarSenhaContraHashOuLocal,
    gerarMensagemWhatsAppNotasConsolidadas,
    formatarTelefoneEmTempoReal,
    formatarCpfCnpjEmTempoReal,
    normalizarTelefoneCliente,
    validarEFormatarCpfCnpj
} = sandbox;

// =========================================================================
// 1. TESTES DE WHATSAPP: URLS E NORMALIZAÇÃO DE NÚMEROS
// =========================================================================
console.log('1. Testando construção de URLs e parâmetros do WhatsApp...');

// Número brasileiro formatado comum
const url1 = construirUrlWhatsApp('(22) 99999-8888', 'Olá Tucano!');
assert.strictEqual(url1.valido, true);
assert.strictEqual(url1.waNumber, '5522999998888');
assert(url1.urlWeb.includes('https://wa.me/5522999998888?text=Ol%C3%A1%20Tucano!'));
assert(url1.urlProtocolo.includes('whatsapp://send?phone=5522999998888'));

// Número com 55 já inserido
const url2 = construirUrlWhatsApp('552225220000', 'Confirmação');
assert.strictEqual(url2.valido, true);
assert.strictEqual(url2.waNumber, '552225220000');

// Telefone inválido (poucos dígitos)
const urlInvalido = construirUrlWhatsApp('12345', 'Teste');
assert.strictEqual(urlInvalido.valido, false);
assert(urlInvalido.erro.includes('inválido'));

console.log('   ✓ Construção de URLs do WhatsApp e validação telefônica 100% aprovadas!');

// =========================================================================
// 2. TESTES DE MENSAGENS DO WHATSAPP (TEMPLATES CORDIAS E TRANSPARENTES)
// =========================================================================
console.log('2. Testando geradores de mensagens para WhatsApp...');

const configEmpresa = {
    nomeFantasia: 'TUCANO AUTO PEÇAS',
    chavePix: '22999998888',
    tipoChavePix: 'Celular',
    titularPix: 'Tucano Auto Peças Ltda',
    diasAlertaVencimento: 3,
    rodapeDocumentos: 'Obrigado pela preferência e parceria!'
};

// 2.1 Emissão de Nota a Prazo
const notaExemplo = {
    id: 'n1',
    numeroControle: 'NP-000100',
    cliente: 'Carlos Silva',
    dataEmissao: '2026-10-01',
    dataVencimento: '2026-10-20',
    valorOriginal: 450.00,
    numeroPedido: 'PED-9988',
    pagamentos: {}
};

const msgEmissao = gerarMensagemWhatsAppEmissaoNota(notaExemplo, configEmpresa);
assert(msgEmissao.includes('TUCANO AUTO PEÇAS'));
assert(msgEmissao.includes('Carlos Silva'));
assert(msgEmissao.includes('#NP-000100'));
assert(msgEmissao.includes('R$ 450,00'));
assert(msgEmissao.includes('20/10/2026'));
assert(msgEmissao.includes('22999998888'));
assert(msgEmissao.includes('PED-9988'));

// 2.2 Recibo de Pagamento Parcial e Quitação
const notaComPagamento = {
    id: 'n1',
    numeroControle: 'NP-000100',
    cliente: 'Carlos Silva',
    valorOriginal: 500.00,
    pagamentos: {
        p1: {
            id: 'p1',
            numeroRecibo: 'REC-000101',
            dataPagamento: '2026-10-05',
            formaPagamento: 'PIX',
            valor: 200.00,
            saldoApos: 300.00,
            status: 'ATIVO'
        }
    }
};

const msgReciboParcial = gerarMensagemWhatsAppReciboPagamento(notaComPagamento, 'p1', configEmpresa);
assert(msgReciboParcial.includes('REC-000101'));
assert(msgReciboParcial.includes('R$ 200,00'));
assert(msgReciboParcial.includes('*Saldo Restante a Pagar:* R$ 300,00'));

// Pagamento de Quitação
const notaQuitada = {
    id: 'n1',
    numeroControle: 'NP-000100',
    cliente: 'Carlos Silva',
    valorOriginal: 500.00,
    pagamentos: {
        p1: { id: 'p1', valor: 200.00, status: 'ATIVO' },
        p2: {
            id: 'p2',
            numeroRecibo: 'REC-000102',
            dataPagamento: '2026-10-10',
            formaPagamento: 'Dinheiro',
            valor: 300.00,
            saldoApos: 0.00,
            status: 'ATIVO'
        }
    }
};
const msgQuitacao = gerarMensagemWhatsAppReciboPagamento(notaQuitada, 'p2', configEmpresa);
assert(msgQuitacao.includes('COMPROVANTE DE QUITAÇÃO DEFINITIVA'));
assert(msgQuitacao.includes('100% QUITADA'));

// Pagamento Estornado
const notaEstornada = {
    id: 'n1',
    numeroControle: 'NP-000100',
    cliente: 'Carlos Silva',
    valorOriginal: 500.00,
    pagamentos: {
        p1: {
            id: 'p1',
            numeroRecibo: 'REC-000101',
            status: 'ESTORNADO',
            motivoEstorno: 'Valor digitado incorretamente pelo operador'
        }
    }
};
const msgEstorno = gerarMensagemWhatsAppReciboPagamento(notaEstornada, 'p1', configEmpresa);
assert(msgEstorno.includes('ESTORNADO/CANCELADO'));
assert(msgEstorno.includes('Valor digitado incorretamente'));

// 2.3 Lembrete de Vencimento
const notaVencendo = {
    id: 'n1',
    numeroControle: 'NP-000200',
    cliente: 'Juliana Rocha',
    dataVencimento: '2026-10-15',
    valorOriginal: 320.00,
    pagamentos: {}
};
const msgLembreteHoje = gerarMensagemWhatsAppLembreteVencimento(notaVencendo, configEmpresa, '2026-10-15');
assert(msgLembreteHoje.includes('vence HOJE'));
assert(msgLembreteHoje.includes('R$ 320,00'));
assert(msgLembreteHoje.includes('22999998888'));

// 2.4 Cobrança de Nota Vencida
const notaVencida = {
    id: 'n1',
    numeroControle: 'NP-000300',
    cliente: 'Roberto Souza',
    dataVencimento: '2026-10-05',
    valorOriginal: 800.00,
    pagamentos: {
        p1: { id: 'p1', valor: 300.00, status: 'ATIVO' }
    }
};
const msgCobranca = gerarMensagemWhatsAppCobrancaNota(notaVencida, configEmpresa, '2026-10-15');
assert(msgCobranca.includes('COMUNICADO DE NOTA EM ABERTO'));
assert(msgCobranca.includes('10 dias em atraso'));
assert(msgCobranca.includes('*Saldo Devedor Pendente:* R$ 500,00'));
assert(msgCobranca.includes('22999998888'));

// 2.5 Extrato da Conta Corrente do Cliente
const clienteExemplo = { id: 'cli1', codigo: 'CLI-0005', nome: 'Auto Mecânica Modelo' };
const resumoCarteiraExemplo = {
    totalComprado: 2500.00,
    totalPago: 1500.00,
    saldoDevedor: 1000.00,
    notas: [
        { id: 'n1', numeroControle: 'NP-001', dataVencimento: '2026-10-10', valorOriginal: 1000.00, pagamentos: {} }
    ]
};
const msgExtrato = gerarMensagemWhatsAppExtratoCliente(clienteExemplo, resumoCarteiraExemplo, configEmpresa, '2026-10-15');
assert(msgExtrato.includes('EXTRATO CONSOLIDADO DE CONTA CORRENTE'));
assert(msgExtrato.includes('Auto Mecânica Modelo'));
assert(msgExtrato.includes('*Total Comprado Histórico:* R$ 2.500,00'));
assert(msgExtrato.includes('*Total Já Pago:* R$ 1.500,00'));
assert(msgExtrato.includes('*SALDO TOTAL A PAGAR:* R$ 1.000,00'));

// 2.6 Resumo Executivo de Relatórios
const relatorioExemplo = {
    tipo: 'NOTAS_VENCIMENTO',
    intervalo: { descricaoPeriodo: 'Mês Atual (10/2026)' },
    dados: {
        autoSoma: {
            quantidadeRegistros: 15,
            somaValorOriginal: 12000.00,
            somaTotalRecebido: 7500.00,
            somaSaldoDevedor: 4500.00
        }
    }
};
const msgRelatorio = gerarMensagemWhatsAppResumoRelatorio(relatorioExemplo, { tipoRelatorio: 'NOTAS_VENCIMENTO' }, configEmpresa);
assert(msgRelatorio.includes('RESUMO EXECUTIVO DE RELATÓRIO'));
assert(msgRelatorio.includes('CONTAS A RECEBER POR VENCIMENTO'));
assert(msgRelatorio.includes('Mês Atual (10/2026)'));
assert(msgRelatorio.includes('15'));
assert(msgRelatorio.includes('R$ 4.500,00'));

console.log('   ✓ Todos os 6 templates de mensagem do WhatsApp 100% validados!');

// =========================================================================
// 3. TESTE DE CATEGORIZAÇÃO E CENTRAL DE ALERTAS DE VENCIMENTO/COBRANÇA
// =========================================================================
console.log('3. Testando categorização de alertas de vencimento e cobrança...');

const loteNotasAlertas = [
    { id: 'n_hoje', dataVencimento: '2026-10-15', valorOriginal: 100.00, status: 'ABERTA' },
    { id: 'n_amanha', dataVencimento: '2026-10-16', valorOriginal: 200.00, status: 'ABERTA' },
    { id: 'n_2dias', dataVencimento: '2026-10-17', valorOriginal: 300.00, status: 'ABERTA' },
    { id: 'n_longe', dataVencimento: '2026-10-30', valorOriginal: 400.00, status: 'ABERTA' },
    { id: 'n_vencida1', dataVencimento: '2026-10-10', valorOriginal: 500.00, status: 'ABERTA' },
    { id: 'n_quitada', dataVencimento: '2026-10-15', valorOriginal: 100.00, status: 'QUITADA', pagamentos: { p: { valor: 100.00 } } },
    { id: 'n_cancelada', dataVencimento: '2026-10-10', valorOriginal: 500.00, status: 'CANCELADA' }
];

const alertas = listarAlertasVencimentoECobranca(loteNotasAlertas, {}, configEmpresa, '2026-10-15');
assert.strictEqual(alertas.vencendoHoje.qtd, 1);
assert.strictEqual(alertas.vencendoHoje.somaSaldo, 100.00);

assert.strictEqual(alertas.vencendoProximosDias.qtd, 2); // n_amanha (+1) e n_2dias (+2) dentro dos 3 dias
assert.strictEqual(alertas.vencendoProximosDias.somaSaldo, 500.00);

assert.strictEqual(alertas.vencidas.qtd, 1); // n_vencida1
assert.strictEqual(alertas.vencidas.somaSaldo, 500.00);

assert.strictEqual(alertas.totalAlertas, 4);

console.log('   ✓ Categorização da Central de Alertas aprovada com precisão de centavos!');

// =========================================================================
// 4. TESTES DE BACKUP SCHEMA V3 E MERGE NÃO-DESTRUTIVO
// =========================================================================
console.log('4. Testando Backup Schema V3 e plano de merge 100% não-destrutivo...');

const valesTeste = [{ id: 'v1', valorOriginal: 100.00 }];
const notasTeste = [{ id: 'n1', numeroControle: 'NP-001', valorOriginal: 500.00, pagamentos: { p1: { id: 'p1', valor: 200.00 } } }];
const clientesTeste = [{ id: 'cli1', nome: 'Cliente Teste' }];

// 4.1 Construção do Payload V3
const payloadV3 = construirPayloadBackupV3(valesTeste, notasTeste, clientesTeste, configEmpresa, '2026-10-15');
assert.strictEqual(payloadV3.schemaVersion, 3);
assert.strictEqual(payloadV3.app, 'Tucano Cloud');
assert.strictEqual(payloadV3.resumoContagem.vales, 1);
assert.strictEqual(payloadV3.resumoContagem.notasPrazo, 1);
assert.strictEqual(payloadV3.resumoContagem.clientes, 1);
assert.strictEqual(payloadV3.resumoContagem.temConfiguracoes, true);

// 4.2 Análise de Arquivos de Backup (V1, V2 e V3)
const analiseV1 = analisarArquivoBackupImportacao([{ id: 'v_legado', valor: 50.00 }], {});
assert.strictEqual(analiseV1.schemaVersion, 1);
assert.strictEqual(analiseV1.vales.total, 1);

const analiseV2 = analisarArquivoBackupImportacao({ schemaVersion: 2, vales: valesTeste, notasPrazo: notasTeste }, {});
assert.strictEqual(analiseV2.schemaVersion, 2);
assert.strictEqual(analiseV2.vales.total, 1);
assert.strictEqual(analiseV2.notasPrazo.total, 1);
assert.strictEqual(analiseV2.clientes.total, 0);

const analiseV3 = analisarArquivoBackupImportacao(payloadV3, {});
assert.strictEqual(analiseV3.schemaVersion, 3);
assert.strictEqual(analiseV3.clientes.total, 1);

// 4.3 Auditoria e Plano de Merge Não Destrutivo
// Cenário: Banco já possui n1 com p1. Backup traz n1 com p1 e p2 (novo), além de n2 (nova nota).
const estadoBancoAtual = {
    valesMap: { v1: { id: 'v1', valorOriginal: 100.00 } },
    notasPrazoMap: {
        n1: {
            id: 'n1',
            numeroControle: 'NP-001',
            valorOriginal: 500.00,
            pagamentos: {
                p1: { id: 'p1', valor: 200.00, status: 'ATIVO' }
            }
        }
    },
    clientesMap: {},
    configEmpresa: null
};

const backupParaImportar = {
    schemaVersion: 3,
    vales: [
        { id: 'v1', valorOriginal: 100.00, baixas: { b1: { id: 'b1', valorUsado: 50.00 } } },
        { id: 'v2', valorOriginal: 80.00 }
    ],
    notasPrazo: [
        {
            id: 'n1',
            clienteId: 'cli1', // Vínculo novo trazido pelo backup
            valorOriginal: 500.00,
            pagamentos: {
                p1: { id: 'p1', valor: 200.00 },
                p2: { id: 'p2', valor: 300.00, status: 'ATIVO' } // Pagamento novo a incorporar!
            }
        },
        {
            id: 'n2',
            numeroControle: 'NP-002',
            valorOriginal: 150.00,
            pagamentos: {}
        }
    ],
    clientes: [
        { id: 'cli1', nome: 'Auto Peças Modelo' }
    ],
    configuracoes: {
        empresa: configEmpresa
    }
};

const plano = planejarOperacoesMergeNaoDestrutivo(backupParaImportar, estadoBancoAtual);
assert.strictEqual(plano.valido, true);

// Garantia inegociável: notasPrazo/n1 JAMAIS sofre .set() destrutivo!
assert.strictEqual(plano.updates['notasPrazo/n1'], undefined, 'Nota existente NUNCA deve sofrer .set() destrutivo!');

// Pagamento p2 deve ser incorporado em sua rota atômica
assert.deepStrictEqual(plano.updates['notasPrazo/n1/pagamentos/p2'], { id: 'p2', valor: 300.00, status: 'ATIVO' });

// Vínculo clienteId deve ser incorporado sem sobrescrever a nota
assert.strictEqual(plano.updates['notasPrazo/n1/clienteId'], 'cli1');

// Baixa b1 deve ser incorporada no vale existente
assert.deepStrictEqual(plano.updates['vales/v1/baixas/b1'], { id: 'b1', valorUsado: 50.00 });

// Registros 100% novos podem ser adicionados
assert(plano.updates['vales/v2'] !== undefined);
assert(plano.updates['notasPrazo/n2'] !== undefined);
assert(plano.updates['clientes/cli1'] !== undefined);
assert(plano.updates['configuracoes/empresa'] !== undefined);

console.log('   ✓ Blindagem e merge 100% não-destrutivo do Schema V3 validados!');

// =========================================================================
// 5. TESTES DE SEGURANÇA E HASH DETERMINÍSTICO DA SENHA MASTER
// =========================================================================
console.log('5. Testando hash determinístico e validação da senha master...');

const hashPadrao1234 = gerarHashDeterministicoSenha('1234');
assert(typeof hashPadrao1234 === 'string');
assert(hashPadrao1234.startsWith('tc_'));
assert.strictEqual(hashPadrao1234.length, 19); // 'tc_' + 8 hex + 8 hex

// Determinismo estrito: a mesma senha sempre produz exatamente o mesmo hash
const hashRepetido = gerarHashDeterministicoSenha('1234');
assert.strictEqual(hashPadrao1234, hashRepetido, 'O hash deve ser puramente determinístico');

// Senhas diferentes produzem hashes distintos
const hashOutra = gerarHashDeterministicoSenha('4321');
assert.notStrictEqual(hashPadrao1234, hashOutra, 'Senhas diferentes devem gerar hashes diferentes');

// Validação contra hash remoto (Firebase)
assert.strictEqual(verificarSenhaContraHashOuLocal('1234', hashPadrao1234, '9999'), true);
assert.strictEqual(verificarSenhaContraHashOuLocal('errada', hashPadrao1234, '9999'), false);

// Fallback contra senha local legada (quando hash remoto não configurado)
assert.strictEqual(verificarSenhaContraHashOuLocal('1234', null, '1234'), true);
assert.strictEqual(verificarSenhaContraHashOuLocal('admin', null, 'admin'), true);
assert.strictEqual(verificarSenhaContraHashOuLocal('errada', null, 'admin'), false);

console.log('   ✓ Hash determinístico FNV-1a/DJB2 e validação de segurança 100% aprovados!');

// =========================================================================
// 6. TESTES DA FASE 5: REGRAS OPERACIONAIS, MÁSCARAS E WHATSAPP CONSOLIDADO
// =========================================================================
console.log('6. Testando requisitos da Fase 5 (Senha 1234, Máscaras e Zap Consolidado)...');

// 6.1: Senha Master 1234 sempre funcional
assert.strictEqual(verificarSenhaContraHashOuLocal(' 1234 ', null, null), true, '1234 com trim deve ser aceita com hash nulo');
assert.strictEqual(verificarSenhaContraHashOuLocal('1234', '', 'undefined'), true, '1234 deve ser aceita se cache legado corrompido');
assert.strictEqual(verificarSenhaContraHashOuLocal('1234', null, '[object Object]'), true, '1234 de recuperação deve funcionar');
assert.strictEqual(verificarSenhaContraHashOuLocal('1234', hashPadrao1234, null), true, '1234 válida contra seu próprio hash');

// 6.2: Formatação e validação estrita de telefone (11 dígitos para WhatsApp)
assert.strictEqual(formatarTelefoneEmTempoReal('22999998888'), '(22) 99999-8888');
assert.strictEqual(formatarTelefoneEmTempoReal('2225220000', true), '(22) 2522-0000');
const telValido = normalizarTelefoneCliente('(22) 99999-8888');
assert.strictEqual(telValido.valido, true);
assert.strictEqual(telValido.limpo, '22999998888');
const telInvalidoDDD = normalizarTelefoneCliente('(05) 99999-8888');
assert.strictEqual(telInvalidoDDD.valido, false);
const telIncompleto = normalizarTelefoneCliente('(22) 9999-888');
assert.strictEqual(telIncompleto.valido, false);

// 6.3: Formatação estrita de CPF/CNPJ
assert.strictEqual(formatarCpfCnpjEmTempoReal('12345678909'), '123.456.789-09');
assert.strictEqual(formatarCpfCnpjEmTempoReal('11222333000144'), '11.222.333/0001-44');
assert.strictEqual(validarEFormatarCpfCnpj('').opcionalVazio, true);
assert.strictEqual(validarEFormatarCpfCnpj('123456789').valido, false, 'Documento incompleto deve ser inválido');

// 6.4: WhatsApp consolidado com notas individuais + auto-soma
const clienteConsolidado = {
    id: 'cli_teste',
    codigo: 'CLI-0001',
    nome: 'OFICINA DO MARCOS',
    telefone: '(22) 99888-7766'
};
const notasConsolidadas = [
    {
        numeroControle: 'NP-000005',
        dataEmissao: '2026-10-09',
        dataVencimento: '2026-11-08',
        valorOriginal: 90.00,
        pagamentos: {}
    },
    {
        numeroControle: 'NP-000006',
        dataEmissao: '2026-10-09',
        dataVencimento: '2026-11-08',
        valorOriginal: 55.00,
        pagamentos: {}
    }
];
const cfgEmpresaZap = {
    nomeFantasia: 'TUCANO AUTO PEÇAS',
    chavePix: '22999990000',
    tipoChavePix: 'Celular',
    titularPix: 'Tucano Auto Peças Ltda'
};
const msgConsolidada = gerarMensagemWhatsAppNotasConsolidadas(clienteConsolidado, notasConsolidadas, cfgEmpresaZap, '2026-10-15');
assert(msgConsolidada.includes('TUCANO AUTO PEÇAS'));
assert(msgConsolidada.includes('OFICINA DO MARCOS'));
assert(msgConsolidada.includes('CLI-0001'));
assert(msgConsolidada.includes('NP-000005'));
assert(msgConsolidada.includes('NP-000006'));
assert(msgConsolidada.includes('R$ 90,00'));
assert(msgConsolidada.includes('R$ 55,00'));
assert(msgConsolidada.includes('RESUMO TOTAL DAS NOTAS (2 NOTAS):'));
assert(msgConsolidada.includes('VALOR TOTAL SOMADO A PAGAR: R$ 145,00'));
assert(msgConsolidada.includes('22999990000'));

console.log('   ✓ Requisitos da Fase 5 100% testados e validados!');

// =========================================================================
// 7. TESTES DA FASE 6: RESOLVEDOR UNIVERSAL, WHATSAPP POR CÓDIGO E ATALHO DE RECIBO
// =========================================================================
console.log('7. Testando requisitos da Fase 6 (Resolvedor Universal, WhatsApp por Código e Atalhos de Recibo)...');

const {
    resolverClienteEResumoPorIdentificador,
    obterClientePorIdOuChave,
    imprimirReciboOuComprovanteVendaLinha,
    enviarWhatsAppExtratoCliente,
    enviarWhatsAppTodasNotasCliente
} = sandbox;

assert(typeof resolverClienteEResumoPorIdentificador === 'function', 'resolverClienteEResumoPorIdentificador deve existir');
assert(typeof imprimirReciboOuComprovanteVendaLinha === 'function', 'imprimirReciboOuComprovanteVendaLinha deve existir');

// 7.1: Resolução por ID do Firebase e por Código CLI-0004
const mapClientesFase6 = {
    'cli_mattedi': {
        id: 'cli_mattedi',
        codigo: 'CLI-0004',
        nome: 'Auto Peças Mattedi',
        telefone: '(22) 99777-6655',
        cpfCnpj: '12.345.678/0001-90',
        limiteCredito: 5000.00
    }
};
const listaClientesFase6 = Object.values(mapClientesFase6);
const notasFase6 = [
    {
        id: 'np_m1',
        numeroControle: 'NP-000010',
        clienteId: 'cli_mattedi',
        cliente: 'Auto Peças Mattedi',
        valorOriginal: 1200.00,
        dataEmissao: '2026-10-01',
        dataVencimento: '2026-10-31',
        status: 'ABERTA',
        pagamentos: {
            pag1: { id: 'pag1', valor: 400.00, status: 'ATIVO', numeroRecibo: 'REC-000001', dataPagamento: '2026-10-10' }
        }
    },
    {
        id: 'np_m2',
        numeroControle: 'NP-000011',
        clienteId: 'cli_mattedi',
        cliente: 'Auto Peças Mattedi',
        valorOriginal: 850.00,
        dataEmissao: '2026-10-05',
        dataVencimento: '2026-11-05',
        status: 'ABERTA',
        pagamentos: {
            pag2a: { id: 'pag2a', valor: 300.00, status: 'ATIVO', numeroRecibo: 'REC-000002', dataPagamento: '2026-10-12' },
            pag2b: { id: 'pag2b', valor: 200.00, status: 'ATIVO', numeroRecibo: 'REC-000003', dataPagamento: '2026-10-14' }
        }
    },
    {
        id: 'np_m3',
        numeroControle: 'NP-000012',
        clienteId: 'cli_mattedi',
        cliente: 'Auto Peças Mattedi',
        valorOriginal: 350.00,
        dataEmissao: '2026-10-15',
        dataVencimento: '2026-11-15',
        status: 'ABERTA',
        pagamentos: {}
    }
];

// Busca por ID
const resolvidoPorId = resolverClienteEResumoPorIdentificador('cli_mattedi', mapClientesFase6, listaClientesFase6, notasFase6, '2026-10-16');
assert(resolvidoPorId, 'Deve resolver cliente por ID técnico');
assert.strictEqual(resolvidoPorId.cliente.id, 'cli_mattedi');
assert.strictEqual(resolvidoPorId.cliente.codigo, 'CLI-0004');
assert.strictEqual(resolvidoPorId.resumoCarteira.saldoDevedor, 1500.00);

// Busca por Código CLI-0004
const resolvidoPorCodigo = resolverClienteEResumoPorIdentificador('CLI-0004', mapClientesFase6, listaClientesFase6, notasFase6, '2026-10-16');
assert(resolvidoPorCodigo, 'Deve resolver cliente pelo código CLI-0004');
assert.strictEqual(resolvidoPorCodigo.cliente.id, 'cli_mattedi');
assert.strictEqual(resolvidoPorCodigo.cliente.nome, 'Auto Peças Mattedi');

// Busca por Nome Normalizado
const resolvidoPorNome = resolverClienteEResumoPorIdentificador('auto pecas mattedi', mapClientesFase6, listaClientesFase6, notasFase6, '2026-10-16');
assert(resolvidoPorNome, 'Deve resolver cliente por nome normalizado');
assert.strictEqual(resolvidoPorNome.cliente.id, 'cli_mattedi');

// Helper de conveniência obterClientePorIdOuChave
sandbox.clientesMap = mapClientesFase6;
sandbox.listaGlobalClientes = listaClientesFase6;
sandbox.listaGlobalNotasPrazo = notasFase6;
const cliPorCodigo = obterClientePorIdOuChave('CLI-0004');
assert(cliPorCodigo, 'obterClientePorIdOuChave deve encontrar por código CLI-0004');
assert.strictEqual(cliPorCodigo.codigo, 'CLI-0004');

// 7.2: Testes da função inteligente imprimirReciboOuComprovanteVendaLinha
// Caso 1: Exatamente 1 pagamento ativo
let reciboImpressoChamado = null;
sandbox.imprimirReciboPagamentoA4 = function(nId, pId) {
    reciboImpressoChamado = { nId, pId };
};
const resCaso1 = imprimirReciboOuComprovanteVendaLinha('np_m1', notasFase6);
assert.strictEqual(resCaso1.status, 'PAGAMENTO_UNICO');
assert.strictEqual(resCaso1.pagtoId, 'pag1');
assert.deepStrictEqual(reciboImpressoChamado, { nId: 'np_m1', pId: 'pag1' });

// Caso 2: 2 ou mais pagamentos parciais ativos
let ultimoReciboChamado = null;
sandbox.imprimirUltimoReciboNota = function(nId) {
    ultimoReciboChamado = nId;
};
const resCaso2 = imprimirReciboOuComprovanteVendaLinha('np_m2', notasFase6);
assert.strictEqual(resCaso2.status, 'PAGAMENTOS_MULTIPLOS');
assert.strictEqual(resCaso2.totalPagamentos, 2);
assert.strictEqual(ultimoReciboChamado, 'np_m2');

// Caso 3: Nota sem nenhum pagamento registrado (ABERTA)
let notaPrazoA4Chamada = null;
sandbox.imprimirNotaPrazoA4 = function(nId) {
    notaPrazoA4Chamada = nId;
};
const resCaso3 = imprimirReciboOuComprovanteVendaLinha('np_m3', notasFase6);
assert.strictEqual(resCaso3.status, 'SEM_PAGAMENTO');
assert.strictEqual(notaPrazoA4Chamada, 'np_m3');

// 7.3: Envio de WhatsApp Extrato por Código CLI-0004 sem erro de cliente não selecionado
let modalZapAberto = null;
sandbox.abrirModalEnvioWhatsApp = async function(dados) {
    modalZapAberto = dados;
};
sandbox.obterConfiguracoesEmpresaSegura = function() {
    return { nomeFantasia: 'TUCANO AUTO PEÇAS', chavePix: '22999990000', tipoChavePix: 'Celular' };
};
sandbox.obterDataLocalISO = function() { return '2026-10-16'; };

enviarWhatsAppExtratoCliente('CLI-0004').then(() => {
    assert(modalZapAberto, 'Deve abrir modal de WhatsApp ao chamar com código CLI-0004 sem disparar erro de não selecionado');
    assert.strictEqual(modalZapAberto.clienteId, 'cli_mattedi');
    assert(modalZapAberto.mensagem.includes('Auto Peças Mattedi'));
    assert(modalZapAberto.mensagem.includes('CLI-0004'));
    assert(modalZapAberto.mensagem.includes('R$ 1.500,00'));
    console.log('   ✓ Requisitos da Fase 6 (Resolvedor Universal, WhatsApp por Código e Atalhos de Recibo) 100% testados e validados!');

    console.log('\n=================================================================');
    console.log('SUÍTE DA FASE 4, 5 E 6 CONCLUÍDA COM 100% DE SUCESSO!');
    console.log('=================================================================\n');
}).catch(err => {
    console.error(err);
    process.exit(1);
});
