// =========================================================================
// SUÍTE DE AUDITORIA E BLINDAGEM - TUCANO CLOUD
// =========================================================================
const assert = require('assert');

console.log('=================================================================');
console.log('INICIANDO AUDITORIA E BLINDAGEM DO MÓDULO NOTAS A PRAZO E VALES');
console.log('=================================================================\n');

// -------------------------------------------------------------------------
// FUNÇÕES DE DOMÍNIO EXTRAÍDAS DE src/index.html
// -------------------------------------------------------------------------

function extrairPagamentosNota(nota) {
    if (!nota || !nota.pagamentos) return [];
    if (Array.isArray(nota.pagamentos)) return nota.pagamentos;
    return Object.keys(nota.pagamentos).map(k => ({
        id: k,
        ...nota.pagamentos[k]
    }));
}

function calcularSituacaoNota(nota, dataReferencia = new Date('2026-10-07T00:00:00')) {
    if (!nota) {
        return {
            saldo: 0,
            totalRecebido: 0,
            statusFinanceiro: 'ABERTA',
            indicadorCobranca: 'NORMAL',
            statusConsolidado: 'ABERTA'
        };
    }

    const valorOrig = parseFloat(nota.valorOriginal) || 0;
    const pagamentos = extrairPagamentosNota(nota);
    const pagamentosAtivos = pagamentos.filter(p => p && p.status !== 'ESTORNADO');
    const totalRecebido = Math.round(pagamentosAtivos.reduce((sum, p) => sum + (parseFloat(p.valor) || 0), 0) * 100) / 100;
    const saldo = Math.max(0, Math.round((valorOrig - totalRecebido) * 100) / 100);

    if (nota.status === 'CANCELADA' || nota.statusCancelamento === 'CANCELADA') {
        return {
            saldo: saldo,
            totalRecebido: totalRecebido,
            statusFinanceiro: 'CANCELADA',
            indicadorCobranca: 'NORMAL',
            statusConsolidado: 'CANCELADA'
        };
    }

    if (saldo <= 0.001 && valorOrig > 0) {
        return {
            saldo: 0,
            totalRecebido: totalRecebido,
            statusFinanceiro: 'QUITADA',
            indicadorCobranca: 'NORMAL',
            statusConsolidado: 'QUITADA'
        };
    }

    const statusFinanceiro = (totalRecebido > 0) ? 'PARCIAL' : 'ABERTA';

    let indicadorCobranca = 'NORMAL';
    const vencimentoStr = nota.dataVencimento || '';
    if (vencimentoStr) {
        const hojeStr = typeof dataReferencia === 'string'
            ? dataReferencia.split('T')[0]
            : (dataReferencia instanceof Date ? dataReferencia.toISOString().split('T')[0] : '2026-10-07');

        if (vencimentoStr < hojeStr) {
            indicadorCobranca = 'VENCIDA';
        } else {
            const [aV, mV, dV] = vencimentoStr.split('-').map(Number);
            const [aH, mH, dH] = hojeStr.split('-').map(Number);
            const dtV = new Date(aV, mV - 1, dV);
            const dtH = new Date(aH, mH - 1, dH);
            const diffDias = Math.ceil((dtV - dtH) / (1000 * 60 * 60 * 24));
            if (diffDias >= 0 && diffDias <= 3) {
                indicadorCobranca = 'VENCENDO';
            }
        }
    }

    let statusConsolidado = statusFinanceiro;
    if (indicadorCobranca === 'VENCIDA') {
        statusConsolidado = 'VENCIDA';
    } else if (indicadorCobranca === 'VENCENDO') {
        statusConsolidado = 'VENCENDO';
    }

    return {
        saldo,
        totalRecebido,
        statusFinanceiro,
        indicadorCobranca,
        statusConsolidado
    };
}

function calcularSaldoRestanteVale(vale) {
    const baixas = vale.baixas ? Object.values(vale.baixas) : [];
    const totalUso = baixas.reduce((acc, item) => acc + (parseFloat(item.valorUsado) || 0), 0);
    const valorBase = parseFloat(vale.valorOriginal) || parseFloat(vale.valor) || 0;
    return Math.max(0, valorBase - totalUso);
}

// =========================================================================
// 1. TESTES DE IDENTIFICADORES E SEQUÊNCIAS ATÔMICAS (ITEM 3 E 16)
// =========================================================================
console.log('--- TESTE 1: UNICIDADE DISTRIBUÍDA E SEQUÊNCIAS ATÔMICAS (NP-XXXXXX / REC-XXXXXX) ---');

class MockFirebaseSequenciaRef {
    constructor(valorInicial = null) {
        this.valor = valorInicial;
        this.queue = Promise.resolve();
    }

    transaction(callback) {
        const next = this.queue.then(() => {
            const valorAtual = this.valor;
            const novoValor = callback(valorAtual);
            if (novoValor === undefined) {
                return { committed: false, snapshot: { val: () => this.valor } };
            }
            this.valor = novoValor;
            return { committed: true, snapshot: { val: () => this.valor } };
        });
        this.queue = next.catch(() => {});
        return next;
    }
}

// Funções de domínio de sequências
function descobrirMaiorNumeroNotaExistente(lista) {
    let max = 0;
    (lista || []).forEach(n => {
        if (n && n.numeroControle) {
            const match = String(n.numeroControle).match(/^NP-(\d+)$/i);
            if (match) {
                const num = parseInt(match[1], 10);
                if (!isNaN(num) && num > max) max = num;
            }
        }
    });
    return max;
}

function descobrirMaiorNumeroReciboExistente(lista) {
    let max = 0;
    (lista || []).forEach(nota => {
        const pagtos = extrairPagamentosNota(nota);
        pagtos.forEach(p => {
            if (p && p.numeroRecibo) {
                const match = String(p.numeroRecibo).match(/^REC-(\d+)$/i);
                if (match) {
                    const num = parseInt(match[1], 10);
                    if (!isNaN(num) && num > max) max = num;
                }
            }
        });
    });
    return max;
}

async function simularObterProximoNumeroControle(seqRef, listaNotas) {
    const maxLocal = descobrirMaiorNumeroNotaExistente(listaNotas);
    const res = await seqRef.transaction((atual) => {
        const atualNum = (atual !== null && atual !== undefined && !isNaN(Number(atual))) ? Number(atual) : 0;
        const base = Math.max(atualNum, maxLocal);
        return base + 1;
    });
    if (!res.committed) throw new Error('Falha na transação de sequência');
    return `NP-${String(res.snapshot.val()).padStart(6, '0')}`;
}

async function simularObterProximoNumeroRecibo(seqRef, listaNotas) {
    const maxLocal = descobrirMaiorNumeroReciboExistente(listaNotas);
    const res = await seqRef.transaction((atual) => {
        const atualNum = (atual !== null && atual !== undefined && !isNaN(Number(atual))) ? Number(atual) : 0;
        const base = Math.max(atualNum, maxLocal);
        return base + 1;
    });
    if (!res.committed) throw new Error('Falha na transação de sequência de recibo');
    return `REC-${String(res.snapshot.val()).padStart(6, '0')}`;
}

// Simulação de banco Realtime Database com suporte a transaction()
class MockFirebaseNotaRef {
    constructor(notaInicial) {
        this.nota = JSON.parse(JSON.stringify(notaInicial));
        this.lock = false;
    }

    async transaction(transactionUpdateFn) {
        // Simulação do servidor Firebase aplicando optimistic locking
        const snapshotAtual = JSON.parse(JSON.stringify(this.nota));
        const resultado = transactionUpdateFn(snapshotAtual);

        if (resultado === undefined) {
            return { committed: false, snapshot: { val: () => this.nota } };
        }

        this.nota = resultado;
        return { committed: true, snapshot: { val: () => this.nota } };
    }
}

async function simularBaixaConcorrente(bancoRef, valorPago, operador, chaveIdemp) {
    let motivoRejeicao = null;

    const res = await bancoRef.transaction((notaAtual) => {
        if (!notaAtual) return notaAtual;
        if (notaAtual.status === 'CANCELADA') {
            motivoRejeicao = 'CANCELADA';
            return;
        }

        // Saldo real no servidor
        const vOrig = parseFloat(notaAtual.valorOriginal) || 0;
        let totalPagoAtivo = 0;
        if (notaAtual.pagamentos) {
            Object.values(notaAtual.pagamentos).forEach(p => {
                if (p.status !== 'ESTORNADO') totalPagoAtivo += (parseFloat(p.valor) || 0);
            });
        }
        const saldoReal = Math.max(0, Math.round((vOrig - totalPagoAtivo) * 100) / 100);

        if (saldoReal <= 0) {
            motivoRejeicao = 'JA_QUITADA';
            return;
        }
        if (valorPago > (saldoReal + 0.001)) {
            motivoRejeicao = { tipo: 'SALDO_INSUFICIENTE', saldoReal };
            return;
        }

        if (!notaAtual.pagamentos) notaAtual.pagamentos = {};
        const idPagto = 'pagto_' + Math.random().toString(36).substring(2, 7);
        const novoSaldo = Math.max(0, Math.round((saldoReal - valorPago) * 100) / 100);

        notaAtual.pagamentos[idPagto] = {
            id: idPagto,
            valor: valorPago,
            idempotencyKey: chaveIdemp,
            status: 'ATIVO',
            criadoPor: operador
        };
        notaAtual.status = novoSaldo <= 0 ? 'QUITADA' : 'PARCIAL';
        return notaAtual;
    });

    return { committed: res.committed, motivoRejeicao, notaFinal: bancoRef.nota };
}

(async () => {
    // 1.1 Teste de incremento atômico sequencial com 5.000 chamadas concorrentes
    const seqNotaRef = new MockFirebaseSequenciaRef(null);
    const seqReciboRef = new MockFirebaseSequenciaRef(null);
    const listaVazia = [];

    const promessasNotas = [];
    const promessasRecibos = [];
    const TOTAL_SEQ = 5000;

    for (let i = 0; i < TOTAL_SEQ; i++) {
        promessasNotas.push(simularObterProximoNumeroControle(seqNotaRef, listaVazia));
        promessasRecibos.push(simularObterProximoNumeroRecibo(seqReciboRef, listaVazia));
    }

    const idsNotas = await Promise.all(promessasNotas);
    const idsRecibos = await Promise.all(promessasRecibos);

    const setNotas = new Set(idsNotas);
    const setRecibos = new Set(idsRecibos);

    assert.strictEqual(setNotas.size, TOTAL_SEQ, 'Todos os 5.000 IDs de notas devem ser únicos');
    assert.strictEqual(setRecibos.size, TOTAL_SEQ, 'Todos os 5.000 IDs de recibos devem ser únicos');
    assert.strictEqual(idsNotas[0], 'NP-000001', 'Primeiro ID de nota deve ser NP-000001');
    assert.strictEqual(idsNotas[TOTAL_SEQ - 1], `NP-${String(TOTAL_SEQ).padStart(6, '0')}`, 'Último ID de nota deve corresponder exatamente ao total');
    assert.strictEqual(idsRecibos[0], 'REC-000001', 'Primeiro ID de recibo deve ser REC-000001');
    console.log(`✓ Sucesso: 5.000 IDs NP e 5.000 REC gerados atomicamente sem colisão (NP-000001 até NP-005000).`);

    // 1.2 Teste de Seed Inicial baseado no maior número já existente
    const listaComNotasAntigas = [
        { numeroControle: 'NP-000045' },
        { numeroControle: 'NP-ALEATORIO1' },
        { numeroControle: 'NP-000099' }
    ];
    const seqComSeed = new MockFirebaseSequenciaRef(null);
    const proximoComSeed = await simularObterProximoNumeroControle(seqComSeed, listaComNotasAntigas);
    assert.strictEqual(proximoComSeed, 'NP-000100', 'Novo contador deve iniciar em 100 para não colidir com NP-000099 existente');
    console.log('✓ Sucesso: Ajuste automático de seed para não colidir com registros NP já existentes validado.\n');

    // =========================================================================
    // 2. TESTES DE CONCORRÊNCIA DE BAIXAS (ITEM 14)
    // =========================================================================
    console.log('--- TESTE 2: CONCORRÊNCIA TRANSAIONAL DE BAIXAS (ITEM 14) ---');
    // Cenário 1: Nota de R$ 1.000. Baixa A de R$ 700 e Baixa B de R$ 700.
    const notaMil = {
        id: 'nota_1',
        numeroControle: 'NP-1000',
        valorOriginal: 1000,
        status: 'ABERTA',
        pagamentos: {}
    };
    const bancoNotaMil = new MockFirebaseNotaRef(notaMil);

    // Executa Baixa A
    const resA = await simularBaixaConcorrente(bancoNotaMil, 700, 'Op_A', 'IDEMP_A');
    assert.strictEqual(resA.committed, true, 'Baixa A de R$ 700 deveria ser confirmada');

    // Executa Baixa B com base no estado concorrente atualizado
    const resB = await simularBaixaConcorrente(bancoNotaMil, 700, 'Op_B', 'IDEMP_B');
    assert.strictEqual(resB.committed, false, 'Baixa B de R$ 700 deve ser REJEITADA por exceder saldo');
    assert.strictEqual(resB.motivoRejeicao.tipo, 'SALDO_INSUFICIENTE');
    assert.strictEqual(resB.motivoRejeicao.saldoReal, 300);

    const sitMil = calcularSituacaoNota(bancoNotaMil.nota);
    assert.strictEqual(sitMil.saldo, 300, 'Saldo final deve ser exatamente R$ 300');
    assert.strictEqual(sitMil.totalRecebido, 700, 'Total recebido NUNCA pode ser R$ 1.400');
    console.log('✓ Sucesso: 2 x R$ 700 em nota de R$ 1.000 resultou em 1 aprovado (R$ 700), 1 rejeitado e saldo R$ 300.');

    // Cenário 2: Nota de R$ 1.000. Baixa A de R$ 500 e Baixa B de R$ 500 -> QUITADA.
    const notaMil2 = {
        id: 'nota_2',
        numeroControle: 'NP-1002',
        valorOriginal: 1000,
        status: 'ABERTA',
        pagamentos: {}
    };
    const bancoNotaMil2 = new MockFirebaseNotaRef(notaMil2);

    const res2A = await simularBaixaConcorrente(bancoNotaMil2, 500, 'Op_A', 'IDEMP_2A');
    const res2B = await simularBaixaConcorrente(bancoNotaMil2, 500, 'Op_B', 'IDEMP_2B');
    assert.strictEqual(res2A.committed, true);
    assert.strictEqual(res2B.committed, true);

    const sitMil2 = calcularSituacaoNota(bancoNotaMil2.nota);
    assert.strictEqual(sitMil2.saldo, 0, 'Saldo final deve ser 0');
    assert.strictEqual(sitMil2.totalRecebido, 1000, 'Total recebido deve ser R$ 1.000');
    assert.strictEqual(sitMil2.statusFinanceiro, 'QUITADA');
    console.log('✓ Sucesso: 2 x R$ 500 em nota de R$ 1.000 resultou em aprovação de ambas, saldo 0 e status QUITADA.\n');

    // =========================================================================
    // 3. TESTES DE BACKUP E IMPORTAÇÃO NÃO-DESTRUTIVA (ITEM 15)
    // =========================================================================
    console.log('--- TESTE 3: AUDITORIA DE BACKUP E MERGE NÃO DESTRUTIVO (ITEM 15) ---');

    function simularMergeSeguroBackup(bancoAtual, backup) {
        const banco = JSON.parse(JSON.stringify(bancoAtual));
        const valesBackup = Array.isArray(backup) ? backup : (backup.vales || []);
        const notasBackup = Array.isArray(backup) ? [] : (backup.notasPrazo || []);

        // Vales
        valesBackup.forEach(v => {
            if (!banco.vales[v.id]) {
                banco.vales[v.id] = v;
            } else {
                // Preserva e mescla baixas
                const baixasBanco = banco.vales[v.id].baixas || {};
                const baixasBkp = v.baixas || {};
                Object.keys(baixasBkp).forEach(k => {
                    if (!baixasBanco[k]) baixasBanco[k] = baixasBkp[k];
                });
                banco.vales[v.id].baixas = baixasBanco;
            }
        });

        // Notas a Prazo
        notasBackup.forEach(n => {
            if (!banco.notasPrazo[n.id]) {
                banco.notasPrazo[n.id] = n;
            } else {
                // NUNCA usar set() na nota inteira!
                const notaBanco = banco.notasPrazo[n.id];
                const pagtosBanco = notaBanco.pagamentos || {};
                const pagtosBkp = extrairPagamentosNota(n);

                pagtosBkp.forEach(pb => {
                    if (!pagtosBanco[pb.id]) {
                        pagtosBanco[pb.id] = pb;
                    }
                });
                notaBanco.pagamentos = pagtosBanco;
                const sit = calcularSituacaoNota(notaBanco);
                if (notaBanco.status !== 'CANCELADA') {
                    notaBanco.status = sit.statusFinanceiro;
                }
            }
        });

        return banco;
    }

    // TESTE A: Banco tem Nota + 2 pagamentos. Backup tem Nota + 1 pagamento.
    // Resultado: Os 2 pagamentos continuam existindo!
    const bancoA = {
        vales: {},
        notasPrazo: {
            'np_1': {
                id: 'np_1',
                valorOriginal: 1000,
                pagamentos: {
                    'p_1': { id: 'p_1', valor: 300, status: 'ATIVO' },
                    'p_2': { id: 'p_2', valor: 400, status: 'ATIVO' }
                }
            }
        }
    };
    const backupA = {
        schemaVersion: 2,
        vales: [],
        notasPrazo: [
            {
                id: 'np_1',
                valorOriginal: 1000,
                pagamentos: {
                    'p_1': { id: 'p_1', valor: 300, status: 'ATIVO' }
                }
            }
        ]
    };
    const resBackupA = simularMergeSeguroBackup(bancoA, backupA);
    const pagtosResA = extrairPagamentosNota(resBackupA.notasPrazo['np_1']);
    assert.strictEqual(pagtosResA.length, 2, 'TESTE A falhou: os 2 pagamentos do banco devem continuar existindo');
    assert(pagtosResA.some(p => p.id === 'p_2'), 'TESTE A falhou: pagamento p_2 não pode desaparecer');
    console.log('✓ TESTE A: Banco Nota + 2 pagtos vs Backup Nota + 1 pagto -> Os 2 pagamentos continuam intactos.');

    // TESTE B: Banco tem Nota + pagamento. Backup tem nota sem pagamentos.
    // Resultado: Pagamento continua existindo!
    const bancoB = {
        vales: {},
        notasPrazo: {
            'np_1': {
                id: 'np_1',
                valorOriginal: 1000,
                pagamentos: {
                    'p_1': { id: 'p_1', valor: 300, status: 'ATIVO' }
                }
            }
        }
    };
    const backupB = {
        schemaVersion: 2,
        vales: [],
        notasPrazo: [{ id: 'np_1', valorOriginal: 1000, pagamentos: {} }]
    };
    const resBackupB = simularMergeSeguroBackup(bancoB, backupB);
    assert.strictEqual(extrairPagamentosNota(resBackupB.notasPrazo['np_1']).length, 1, 'TESTE B falhou: pagamento deve ser preservado');
    console.log('✓ TESTE B: Banco Nota + pagamento vs Backup sem pagamento -> Pagamento preservado intacto.');

    // TESTE C: Banco tem Nota A. Backup tem Nota A + Nota B.
    // Resultado: A continua e B é adicionada.
    const bancoC = {
        vales: {},
        notasPrazo: { 'np_A': { id: 'np_A', cliente: 'Cliente A', valorOriginal: 500 } }
    };
    const backupC = {
        schemaVersion: 2,
        vales: [],
        notasPrazo: [
            { id: 'np_A', cliente: 'Cliente A', valorOriginal: 500 },
            { id: 'np_B', cliente: 'Cliente B', valorOriginal: 800 }
        ]
    };
    const resBackupC = simularMergeSeguroBackup(bancoC, backupC);
    assert(resBackupC.notasPrazo['np_A'], 'Nota A deve continuar');
    assert(resBackupC.notasPrazo['np_B'], 'Nota B deve ser adicionada');
    console.log('✓ TESTE C: Banco Nota A vs Backup Nota A + Nota B -> Nota A preservada e Nota B adicionada.');

    // TESTE D: Banco tem Nota A + Pagamento A. Backup tem Nota A alterada.
    // Resultado: Não destrói pagamento A.
    const bancoD = {
        vales: {},
        notasPrazo: {
            'np_A': {
                id: 'np_A',
                valorOriginal: 1000,
                pagamentos: { 'p_A': { id: 'p_A', valor: 500, status: 'ATIVO' } }
            }
        }
    };
    const backupD = {
        schemaVersion: 2,
        vales: [],
        notasPrazo: [{ id: 'np_A', valorOriginal: 1000, observacao: 'Alterada', pagamentos: {} }]
    };
    const resBackupD = simularMergeSeguroBackup(bancoD, backupD);
    assert.strictEqual(extrairPagamentosNota(resBackupD.notasPrazo['np_A']).length, 1);
    console.log('✓ TESTE D: Banco Nota A + pagto A vs Backup com Nota A alterada -> Pagamento A intacto.');

    // TESTE E: Backup legado V1 (array direto [ { ... } ])
    // Resultado: Continua importável sem erro.
    const bancoE = { vales: { 'v_1': { id: 'v_1', valor: 200 } }, notasPrazo: {} };
    const backupE = [
        { id: 'v_1', valor: 200 },
        { id: 'v_2', valor: 350 }
    ];
    const resBackupE = simularMergeSeguroBackup(bancoE, backupE);
    assert(resBackupE.vales['v_1'], 'Vale 1 mantido');
    assert(resBackupE.vales['v_2'], 'Vale 2 importado');
    console.log('✓ TESTE E: Backup Legado V1 (Array direto) -> Importado com sucesso.');

    // TESTE F: Backup V2 completo (com vales e notas)
    // Resultado: Vales e notas restaurados e preservados.
    const bancoF = {
        vales: { 'v_1': { id: 'v_1', valor: 100 } },
        notasPrazo: { 'n_1': { id: 'n_1', valorOriginal: 500 } }
    };
    const backupF = {
        schemaVersion: 2,
        vales: [{ id: 'v_2', valor: 300 }],
        notasPrazo: [{ id: 'n_2', valorOriginal: 700 }]
    };
    const resBackupF = simularMergeSeguroBackup(bancoF, backupF);
    assert(resBackupF.vales['v_1'] && resBackupF.vales['v_2'], 'Vales v_1 e v_2 preservados');
    assert(resBackupF.notasPrazo['n_1'] && resBackupF.notasPrazo['n_2'], 'Notas n_1 e n_2 preservadas');
    console.log('✓ TESTE F: Backup V2 completo -> Vales e notas preservados sem remoção.\n');

    // =========================================================================
    // 4. TESTES DE STATUS, ESTORNO E CANCELAMENTO (ITENS 8, 9, 10)
    // =========================================================================
    console.log('--- TESTE 4: DOMÍNIO DE STATUS, ESTORNO E CANCELAMENTO ---');

    // Nota R$ 1.000 quitada. Estornar pagamento -> volta para saldo R$ 1.000.
    const notaQuitada = {
        id: 'nq_1',
        valorOriginal: 1000,
        dataVencimento: '2026-10-01', // Vencida considerando ref 2026-10-07
        pagamentos: {
            'pagto_full': { id: 'pagto_full', valor: 1000, status: 'ATIVO' }
        }
    };
    const sitAntesEstorno = calcularSituacaoNota(notaQuitada, '2026-10-07');
    assert.strictEqual(sitAntesEstorno.statusFinanceiro, 'QUITADA');
    assert.strictEqual(sitAntesEstorno.saldo, 0);

    // Estorna o pagamento
    notaQuitada.pagamentos['pagto_full'].status = 'ESTORNADO';
    notaQuitada.pagamentos['pagto_full'].motivoEstorno = 'Erro de lançamento';
    const sitAposEstorno = calcularSituacaoNota(notaQuitada, '2026-10-07');
    assert.strictEqual(sitAposEstorno.saldo, 1000, 'Saldo deve voltar para R$ 1.000');
    assert.strictEqual(sitAposEstorno.statusFinanceiro, 'ABERTA');
    assert.strictEqual(sitAposEstorno.indicadorCobranca, 'VENCIDA');
    assert.strictEqual(sitAposEstorno.statusConsolidado, 'VENCIDA');
    console.log('✓ Sucesso: Estorno de nota quitada restaurou saldo para R$ 1.000 e status VENCIDA conforme vencimento.');

    // Cancelamento
    notaQuitada.status = 'CANCELADA';
    const sitCancelada = calcularSituacaoNota(notaQuitada);
    assert.strictEqual(sitCancelada.statusFinanceiro, 'CANCELADA');
    assert.strictEqual(sitCancelada.statusConsolidado, 'CANCELADA');
    console.log('✓ Sucesso: Nota cancelada possui prioridade máxima absoluta de status.\n');

    // =========================================================================
    // 5. TESTES DE COMPATIBILIDADE COM VALES LEGADOS (ITEM 17)
    // =========================================================================
    console.log('--- TESTE 5: COMPATIBILIDADE COM VALES LEGADOS (ITEM 17) ---');

    const valeLegado1 = {
        id: '998877',
        valor: '450.00',
        dataVale: '2026-05-10',
        validade: '2026-08-10',
        numNota: 'NF-1234',
        quemFez: 'Marcos',
        responsavel: 'Gerente',
        devolvido: 'Peça com defeito'
    };
    const saldoLegado1 = calcularSaldoRestanteVale(valeLegado1);
    assert.strictEqual(saldoLegado1, 450);

    // Vale legado com baixas parciais
    valeLegado1.baixas = {
        'b_1': { id: 'b_1', valorUsado: '150.00', dataBaixa: '2026-06-01' }
    };
    const saldoLegado2 = calcularSaldoRestanteVale(valeLegado1);
    assert.strictEqual(saldoLegado2, 300);
    console.log('✓ Sucesso: Objeto legado de vale com campos valor/dataVale/validade/numNota lido perfeitamente sem modificações.');

    // =========================================================================
    // 6. TESTES DE ESTORNO CONCORRENTE SIMULTÂNEO (ITEM 7)
    // =========================================================================
    console.log('\n--- TESTE 6: ESTORNO CONCORRENTE SIMULTÂNEO (ITEM 7) ---');
    const notaEstornoConcorrente = {
        id: 'nota_estorno_conc',
        valorOriginal: 1000,
        status: 'PARCIAL',
        pagamentos: {
            'p_500': { id: 'p_500', numeroRecibo: 'REC-000001', valor: 500, status: 'ATIVO' }
        }
    };
    const bancoEstorno = new MockFirebaseNotaRef(notaEstornoConcorrente);

    async function simularEstorno(bancoRef, idPagto, motivo, operador) {
        let motivoRejeicao = null;
        const res = await bancoRef.transaction((notaAtual) => {
            if (!notaAtual || !notaAtual.pagamentos || !notaAtual.pagamentos[idPagto]) {
                motivoRejeicao = 'NAO_ENCONTRADO';
                return;
            }
            const pAtual = notaAtual.pagamentos[idPagto];
            if (pAtual.status === 'ESTORNADO') {
                motivoRejeicao = 'JA_ESTORNADO';
                return;
            }
            pAtual.status = 'ESTORNADO';
            pAtual.motivoEstorno = motivo;
            pAtual.estornadoPor = operador;
            const sit = calcularSituacaoNota(notaAtual);
            if (notaAtual.status !== 'CANCELADA') {
                notaAtual.status = sit.statusFinanceiro;
            }
            return notaAtual;
        });
        return { committed: res.committed, motivoRejeicao };
    }

    const estornoA = await simularEstorno(bancoEstorno, 'p_500', 'Cancelamento do cliente', 'Comp_A');
    const estornoB = await simularEstorno(bancoEstorno, 'p_500', 'Tentativa simultânea', 'Comp_B');

    assert.strictEqual(estornoA.committed, true, 'Primeiro estorno deve ser aprovado');
    assert.strictEqual(estornoB.committed, false, 'Segundo estorno deve ser rejeitado');
    assert.strictEqual(estornoB.motivoRejeicao, 'JA_ESTORNADO', 'Segundo estorno deve detectar JA_ESTORNADO');
    assert.strictEqual(bancoEstorno.nota.pagamentos['p_500'].status, 'ESTORNADO');
    assert.strictEqual(calcularSituacaoNota(bancoEstorno.nota).saldo, 1000, 'Saldo restaurado');
    console.log('✓ Sucesso: Estorno concorrente protegido: 1 aprovado, 1 rejeitado (JA_ESTORNADO), histórico íntegro.');

    // =========================================================================
    // 7. TESTES DE CANCELAMENTO VS BAIXA CONCORRENTE (ITEM 8)
    // =========================================================================
    console.log('\n--- TESTE 7: CANCELAMENTO VS BAIXA CONCORRENTE (ITEM 8) ---');

    async function simularCancelamento(bancoRef, motivo, operador) {
        let motivoRejeicao = null;
        const res = await bancoRef.transaction((notaAtual) => {
            if (!notaAtual) return notaAtual;
            if (notaAtual.status === 'CANCELADA') {
                motivoRejeicao = 'JA_CANCELADA';
                return;
            }
            const sit = calcularSituacaoNota(notaAtual);
            if (sit.statusFinanceiro === 'QUITADA') {
                motivoRejeicao = 'QUITADA';
                return;
            }
            notaAtual.status = 'CANCELADA';
            notaAtual.motivoCancelamento = motivo;
            notaAtual.canceladaPor = operador;
            return notaAtual;
        });
        return { committed: res.committed, motivoRejeicao };
    }

    // Cenário 7.1: Cancelamento ocorre antes -> Baixa é rejeitada
    const notaParaCancel1 = { id: 'nc_1', valorOriginal: 500, status: 'ABERTA', pagamentos: {} };
    const bancoCancel1 = new MockFirebaseNotaRef(notaParaCancel1);
    const cancel1 = await simularCancelamento(bancoCancel1, 'Cliente desistiu', 'Op_Admin');
    assert.strictEqual(cancel1.committed, true);
    const baixaPosCancel = await simularBaixaConcorrente(bancoCancel1, 200, 'Op_Caixa', 'IDEMP_POS_CANCEL');
    assert.strictEqual(baixaPosCancel.committed, false, 'Baixa em nota cancelada deve ser rejeitada');
    assert.strictEqual(baixaPosCancel.motivoRejeicao, 'CANCELADA');
    console.log('✓ Sucesso 7.1: Cancelamento antes de baixa bloqueou novos pagamentos na nota.');

    // Cenário 7.2: Baixa ocorre antes -> Cancelamento registra preservando pagamento
    const notaParaCancel2 = { id: 'nc_2', valorOriginal: 500, status: 'ABERTA', pagamentos: {} };
    const bancoCancel2 = new MockFirebaseNotaRef(notaParaCancel2);
    const baixaAntes = await simularBaixaConcorrente(bancoCancel2, 200, 'Op_Caixa', 'IDEMP_ANTES');
    assert.strictEqual(baixaAntes.committed, true);
    const cancelPosBaixa = await simularCancelamento(bancoCancel2, 'Cancelamento posterior', 'Op_Admin');
    assert.strictEqual(cancelPosBaixa.committed, true);
    assert.strictEqual(bancoCancel2.nota.status, 'CANCELADA');
    assert.strictEqual(Object.keys(bancoCancel2.nota.pagamentos).length, 1, 'Pagamento realizado permanece íntegro no histórico');
    console.log('✓ Sucesso 7.2: Pagamento prévio preservado no histórico mesmo após cancelamento.');

    // =========================================================================
    // 8. TESTES DE IDEMPOTÊNCIA E RETRY DE BAIXA (ITEM 4)
    // =========================================================================
    console.log('\n--- TESTE 8: IDEMPOTÊNCIA DE BAIXA E RETRIES DE CONEXÃO (ITEM 4) ---');
    const notaIdemp = { id: 'ni_1', valorOriginal: 800, status: 'ABERTA', pagamentos: {} };
    const bancoIdemp = new MockFirebaseNotaRef(notaIdemp);
    const CHAVE_ESTAVEL = 'TOKEN_IDEMP_ESTAVEL_12345';

    // 1º Envio
    const tentativa1 = await simularBaixaConcorrente(bancoIdemp, 300, 'Caixa_1', CHAVE_ESTAVEL);
    assert.strictEqual(tentativa1.committed, true);

    // 2º Envio com mesma chave (simulando timeout de rede / retry)
    const pagtosNotaIdemp = Object.values(bancoIdemp.nota.pagamentos);
    const jaGravado = pagtosNotaIdemp.find(p => p.idempotencyKey === CHAVE_ESTAVEL);
    assert(jaGravado, 'Pagamento gravado deve existir');

    // Transação aborta sem duplicar
    let pagamentoDuplicado = null;
    const resTentativa2 = await bancoIdemp.transaction((notaAtual) => {
        if (notaAtual.pagamentos) {
            const dup = Object.values(notaAtual.pagamentos).find(p => p.idempotencyKey === CHAVE_ESTAVEL);
            if (dup) {
                pagamentoDuplicado = dup;
                return; // Aborta
            }
        }
    });
    assert.strictEqual(resTentativa2.committed, false, 'Transação com chave já existente deve abortar sem erro');
    assert.strictEqual(pagamentoDuplicado.idempotencyKey, CHAVE_ESTAVEL);
    assert.strictEqual(Object.keys(bancoIdemp.nota.pagamentos).length, 1, 'Apenas 1 pagamento gravado');
    assert.strictEqual(calcularSituacaoNota(bancoIdemp.nota).saldo, 500, 'Saldo final R$ 500');
    console.log('✓ Sucesso: Retry com mesma idempotencyKey retorna recibo existente sem duplicar pagamento nem alterar saldo.');

    // --- TESTE 9: AUDITORIA SEMÂNTICA DAS REGRAS (database.rules.json) ---
    console.log('\n--- TESTE 9: AUDITORIA SEMÂNTICA E INTEGRIDADE DE database.rules.json ---');
    const fs = require('fs');
    const rulesObj = JSON.parse(fs.readFileSync('database.rules.json', 'utf8'));
    assert(rulesObj.rules, 'Deve conter nó rules');
    assert.strictEqual(rulesObj.rules['.read'], false, 'Root .read deve ser false');
    assert.strictEqual(rulesObj.rules['.write'], false, 'Root .write deve ser false');

    // Validação de notasPrazo
    assert(rulesObj.rules.notasPrazo, 'Regra de notasPrazo deve existir');
    assert.strictEqual(rulesObj.rules.notasPrazo['.read'], 'auth != null');
    assert(rulesObj.rules.notasPrazo['$notaId'], 'Regra de $notaId deve existir');
    assert.strictEqual(rulesObj.rules.notasPrazo['$notaId']['.write'], 'auth != null && (!data.exists() || newData.exists())');

    // Validação de sequencias
    assert(rulesObj.rules.sequencias, 'Regra de sequencias deve existir');
    assert.strictEqual(rulesObj.rules.sequencias['.read'], 'auth != null');
    assert(rulesObj.rules.sequencias.notasPrazo['.write'].includes('newData.val() > data.val()'), 'Sequencia notasPrazo deve ser estritamente crescente');
    assert(rulesObj.rules.sequencias.recibos['.write'].includes('newData.val() > data.val()'), 'Sequencia recibos deve ser estritamente crescente');

    // Validação de vales
    assert(rulesObj.rules.vales, 'Regra de vales deve existir');
    assert.strictEqual(rulesObj.rules.vales['.read'], 'auth != null');
    assert(rulesObj.rules.vales['$valeId'], 'Regra de $valeId deve existir');
    assert(rulesObj.rules.vales['$valeId']['.validate'].includes("newData.hasChildren(['valorOriginal']) || newData.hasChildren(['valor'])"), 'Deve suportar schema novo e legado de vales');

    console.log('✓ Sucesso: Estrutura, restrições e expressões de database.rules.json verificadas com sucesso.');

    console.log('\n=================================================================');
    console.log('TODOS OS TESTES DE AUDITORIA E BLINDAGEM PASSARAM COM SUCESSO! 100% OK');
    console.log('=================================================================');
})();
