// [FASE 2 / T-201] Módulo de Relatórios Detalhados, Auto-Soma e Exportação CSV - Tucano Cloud
// Regras Permanentes (AGENTS.md):
// 1. Apenas 'var' e 'function' no nível superior (compatível com vm.runInContext e browser clássico).
// 2. Proibido acessar DOM/Firebase no topo do arquivo.
// 3. Aritmética financeira sempre em centavos inteiros via nucleo-financeiro.js.
// 4. Sem colisão de identificadores com index.html, nucleo-financeiro.js ou clientes.js.

// =========================================================================
// VARIÁVEIS DE ESTADO DO MÓDULO DE RELATÓRIOS
// =========================================================================
var estadoFiltrosRelatorio = {
    tipoRelatorio: 'NOTAS_VENCIMENTO', // 'NOTAS_VENCIMENTO' | 'RECEBIMENTOS_PAGAMENTOS' | 'NOTAS_GERAL' | 'CLIENTES_POSICAO'
    atalhoPeriodo: 'TODOS',
    baseData: 'VENCIMENTO',           // 'VENCIMENTO' | 'EMISSAO'
    dataInicio: '',
    dataFim: '',
    clienteFiltro: 'TODOS',
    statusFiltro: 'TODAS',
    faixaVencimentoFiltro: 'TODAS',
    formaPagamentoFiltro: 'TODAS',
    statusPagamentoFiltro: 'ATIVOS',   // 'ATIVOS' | 'ESTORNADOS' | 'TODOS'
    buscaTexto: ''
};

var ultimoResultadoRelatorio = null;

// =========================================================================
// PARTE 1 — FUNÇÕES PURAS DE FILTRAGEM, CÁLCULO E AUTO-SOMA
// =========================================================================

/**
 * Formata valor monetário para exibição textual em relatórios.
 */
function formatarMoedaRelatorio(valor) {
    if (typeof formatadorMoeda !== 'undefined' && formatadorMoeda && typeof formatadorMoeda.format === 'function') {
        return formatadorMoeda.format(typeof valor === 'number' ? valor : (parseFloat(valor) || 0));
    }
    var num = typeof valor === 'number' ? valor : (parseFloat(valor) || 0);
    return 'R$ ' + num.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Formata valor monetário para CSV compatível com Excel em português (ex: 1234,56).
 */
function formatarMoedaCsv(valor) {
    var num = typeof valor === 'number' ? valor : (parseFloat(valor) || 0);
    return num.toFixed(2).replace('.', ',');
}

/**
 * Converte data ISO YYYY-MM-DD para formato brasileiro DD/MM/YYYY.
 */
function formatarDataIsoBr(dataIso) {
    if (!dataIso) return '-';
    var str = String(dataIso).slice(0, 10);
    var partes = str.split('-');
    if (partes.length !== 3) return str;
    return partes[2] + '/' + partes[1] + '/' + partes[0];
}

/**
 * Extrai pagamentos de uma nota de forma pura e compatível.
 */
function relatorioExtrairPagamentosNota(nota) {
    if (!nota) return [];
    if (typeof extrairPagamentosNota === 'function') {
        return extrairPagamentosNota(nota);
    }
    if (!nota.pagamentos) return [];
    if (Array.isArray(nota.pagamentos)) return nota.pagamentos.filter(Boolean);
    if (typeof nota.pagamentos === 'object') return Object.values(nota.pagamentos).filter(Boolean);
    return [];
}

/**
 * Obtém a situação financeira e de cobrança da nota de forma pura e segura.
 */
function relatorioObterSituacaoNota(nota) {
    if (!nota) {
        return {
            statusFinanceiro: 'ABERTA',
            indicadorCobranca: 'ABERTA',
            statusConsolidado: 'ABERTA',
            saldo: 0,
            totalRecebido: 0
        };
    }
    if (typeof calcularSituacaoNota === 'function') {
        return calcularSituacaoNota(nota);
    }
    if (typeof obterSituacaoNotaSegura === 'function') {
        return obterSituacaoNotaSegura(nota);
    }

    var valorOrig = parseFloat(nota.valorOriginal !== undefined ? nota.valorOriginal : (nota.saldoDevedor !== undefined ? nota.saldoDevedor : 0)) || 0;
    var pagtos = relatorioExtrairPagamentosNota(nota);
    var totPagoCent = 0;
    for (var i = 0; i < pagtos.length; i++) {
        var p = pagtos[i];
        if (p && p.status !== 'ESTORNADO') {
            totPagoCent += moedaParaCentavos(p.valor);
        }
    }
    var totPago = centavosParaReais(totPagoCent);
    var valorOrigCent = moedaParaCentavos(valorOrig);
    var saldoCent = (pagtos.length === 0 && nota.saldoDevedor !== undefined) ? moedaParaCentavos(nota.saldoDevedor) : Math.max(0, valorOrigCent - totPagoCent);
    var saldo = centavosParaReais(saldoCent);

    var stFin = nota.statusFinanceiro || 'ABERTA';
    if (nota.status === 'CANCELADA' || nota.statusFinanceiro === 'CANCELADA') {
        stFin = 'CANCELADA';
        saldo = 0;
        saldoCent = 0;
    } else if (saldo <= 0) {
        stFin = 'QUITADA';
    } else if (totPago > 0) {
        stFin = 'PARCIAL';
    }

    return {
        statusFinanceiro: stFin,
        indicadorCobranca: stFin,
        statusConsolidado: stFin,
        saldo: saldo,
        totalRecebido: totPago
    };
}

/**
 * Auxiliar para somar ou subtrair dias em formato ISO YYYY-MM-DD.
 */
function relatorioSomarDiasIso(dataIso, dias) {
    var p = dataIso.split('-');
    var d = new Date(Date.UTC(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10)));
    d.setUTCDate(d.getUTCDate() + dias);
    var y = d.getUTCFullYear();
    var m = String(d.getUTCMonth() + 1).padStart(2, '0');
    var dia = String(d.getUTCDate()).padStart(2, '0');
    return y + '-' + m + '-' + dia;
}

/**
 * 1. Resolve o intervalo de datas e a descrição do período para qualquer atalho selecionado.
 */
function resolverIntervaloPeriodoRelatorio(atalhoPeriodo, dataInicioCustom, dataFimCustom, dataReferenciaISO) {
    var hoje = obterDataLocalISO(dataReferenciaISO);
    var p = hoje.split('-');
    var ano = parseInt(p[0], 10);
    var mes = parseInt(p[1], 10);
    var dia = parseInt(p[2], 10);

    var atalho = String(atalhoPeriodo || 'TODOS').toUpperCase();

    if (atalho === 'HOJE') {
        return {
            dataInicio: hoje,
            dataFim: hoje,
            descricaoPeriodo: 'Hoje (' + formatarDataIsoBr(hoje) + ')'
        };
    }

    if (atalho === 'ONTEM') {
        var ontem = relatorioSomarDiasIso(hoje, -1);
        return {
            dataInicio: ontem,
            dataFim: ontem,
            descricaoPeriodo: 'Ontem (' + formatarDataIsoBr(ontem) + ')'
        };
    }

    if (atalho === 'ULTIMOS_7_DIAS') {
        var d7 = relatorioSomarDiasIso(hoje, -6);
        return {
            dataInicio: d7,
            dataFim: hoje,
            descricaoPeriodo: 'Últimos 7 Dias (' + formatarDataIsoBr(d7) + ' a ' + formatarDataIsoBr(hoje) + ')'
        };
    }

    if (atalho === 'ULTIMOS_30_DIAS') {
        var d30 = relatorioSomarDiasIso(hoje, -29);
        return {
            dataInicio: d30,
            dataFim: hoje,
            descricaoPeriodo: 'Últimos 30 Dias (' + formatarDataIsoBr(d30) + ' a ' + formatarDataIsoBr(hoje) + ')'
        };
    }

    if (atalho === 'MES_ATUAL') {
        var mesStr = String(mes).padStart(2, '0');
        var ultDiaMes = new Date(ano, mes, 0).getDate();
        var dtIni = ano + '-' + mesStr + '-01';
        var dtFim = ano + '-' + mesStr + '-' + String(ultDiaMes).padStart(2, '0');
        return {
            dataInicio: dtIni,
            dataFim: dtFim,
            descricaoPeriodo: 'Mês Atual (' + mesStr + '/' + ano + ')'
        };
    }

    if (atalho === 'MES_ANTERIOR') {
        var anoAnt = (mes === 1) ? (ano - 1) : ano;
        var mesAnt = (mes === 1) ? 12 : (mes - 1);
        var mesAntStr = String(mesAnt).padStart(2, '0');
        var ultDiaMesAnt = new Date(anoAnt, mesAnt, 0).getDate();
        var dtIniAnt = anoAnt + '-' + mesAntStr + '-01';
        var dtFimAnt = anoAnt + '-' + mesAntStr + '-' + String(ultDiaMesAnt).padStart(2, '0');
        return {
            dataInicio: dtIniAnt,
            dataFim: dtFimAnt,
            descricaoPeriodo: 'Mês Anterior (' + mesAntStr + '/' + anoAnt + ')'
        };
    }

    if (atalho === 'ANO_ATUAL') {
        return {
            dataInicio: ano + '-01-01',
            dataFim: ano + '-12-31',
            descricaoPeriodo: 'Ano Atual (' + ano + ')'
        };
    }

    if (atalho === 'PERSONALIZADO') {
        var ini = dataInicioCustom ? String(dataInicioCustom).slice(0, 10) : null;
        var fim = dataFimCustom ? String(dataFimCustom).slice(0, 10) : null;
        var desc = 'Período Personalizado';
        if (ini && fim) {
            desc = formatarDataIsoBr(ini) + ' até ' + formatarDataIsoBr(fim);
        } else if (ini) {
            desc = 'A partir de ' + formatarDataIsoBr(ini);
        } else if (fim) {
            desc = 'Até ' + formatarDataIsoBr(fim);
        }
        return {
            dataInicio: ini,
            dataFim: fim,
            descricaoPeriodo: desc
        };
    }

    // Default: 'TODOS'
    return {
        dataInicio: null,
        dataFim: null,
        descricaoPeriodo: 'Todo o Período'
    };
}

/**
 * 2. Classifica a faixa de vencimento e dias de atraso de uma nota a prazo.
 */
function classificarFaixaVencimentoNota(nota, dataReferenciaISO) {
    if (!nota) {
        return { faixa: 'QUITADA_OU_CANCELADA', diasEmAtraso: 0, rotuloFaixa: 'Quitada/Cancelada' };
    }

    if (nota.status === 'CANCELADA' || nota.statusFinanceiro === 'CANCELADA') {
        return { faixa: 'QUITADA_OU_CANCELADA', diasEmAtraso: 0, rotuloFaixa: 'Cancelada' };
    }

    var saldoNota = (nota.saldoDevedor !== undefined) ? parseFloat(nota.saldoDevedor) : ((nota.saldo !== undefined) ? parseFloat(nota.saldo) : null);
    if (saldoNota !== null && saldoNota <= 0) {
        return { faixa: 'QUITADA_OU_CANCELADA', diasEmAtraso: 0, rotuloFaixa: 'Quitada' };
    }

    var sit = relatorioObterSituacaoNota(nota);
    if (sit.statusFinanceiro === 'CANCELADA' || nota.status === 'CANCELADA') {
        return { faixa: 'QUITADA_OU_CANCELADA', diasEmAtraso: 0, rotuloFaixa: 'Cancelada' };
    }
    if ((saldoNota === null ? sit.saldo <= 0 : saldoNota <= 0) || sit.statusFinanceiro === 'QUITADA' || nota.status === 'QUITADA') {
        return { faixa: 'QUITADA_OU_CANCELADA', diasEmAtraso: 0, rotuloFaixa: 'Quitada' };
    }

    var hoje = obterDataLocalISO(dataReferenciaISO);
    var venc = String(nota.dataVencimento || '').slice(0, 10);
    if (!venc) {
        return { faixa: 'A_VENCER', diasEmAtraso: 0, rotuloFaixa: 'A Vencer' };
    }

    var dif = calcularDiferencaDiasISO(venc, hoje);

    if (dif > 0) {
        return {
            faixa: 'A_VENCER',
            diasEmAtraso: 0,
            rotuloFaixa: 'A Vencer (' + dif + 'd)'
        };
    }

    if (dif === 0) {
        return {
            faixa: 'VENCE_HOJE',
            diasEmAtraso: 0,
            rotuloFaixa: 'Vence Hoje'
        };
    }

    // Vencida (dif < 0)
    var atraso = Math.abs(dif);

    if (atraso <= 30) {
        return {
            faixa: 'ATRASO_1_30',
            diasEmAtraso: atraso,
            rotuloFaixa: '1 a 30 dias (' + atraso + 'd)'
        };
    }
    if (atraso <= 60) {
        return {
            faixa: 'ATRASO_31_60',
            diasEmAtraso: atraso,
            rotuloFaixa: '31 a 60 dias (' + atraso + 'd)'
        };
    }
    if (atraso <= 90) {
        return {
            faixa: 'ATRASO_61_90',
            diasEmAtraso: atraso,
            rotuloFaixa: '61 a 90 dias (' + atraso + 'd)'
        };
    }

    return {
        faixa: 'ATRASO_MAIS_90',
        diasEmAtraso: atraso,
        rotuloFaixa: '+90 dias (' + atraso + 'd)'
    };
}

/**
 * 3. Gera Relatório Detalhado de Notas a Prazo com Auto-Soma em centavos inteiros.
 */
function gerarRelatorioNotasDetalhado(listaNotas, mapaClientes, filtros, dataReferenciaISO) {
    var notasArr = Array.isArray(listaNotas) ? listaNotas : [];
    var f = filtros || {};
    var dataRef = obterDataLocalISO(dataReferenciaISO);

    var baseData = (f.baseData === 'EMISSAO') ? 'EMISSAO' : 'VENCIMENTO';
    var dataInicio = f.dataInicio ? String(f.dataInicio).slice(0, 10) : null;
    var dataFim = f.dataFim ? String(f.dataFim).slice(0, 10) : null;

    if (f.atalhoPeriodo && (!dataInicio || !dataFim)) {
        var resPeriodo = resolverIntervaloPeriodoRelatorio(f.atalhoPeriodo, dataInicio, dataFim, dataRef);
        dataInicio = resPeriodo.dataInicio;
        dataFim = resPeriodo.dataFim;
    }
    var clienteFiltro = f.clienteFiltro || 'TODOS';
    var statusFiltro = f.statusFiltro || 'TODAS';
    var faixaFiltro = f.faixaVencimentoFiltro || 'TODAS';
    var busca = (f.buscaTexto || '').toLowerCase().trim();

    var linhas = [];

    var somaValorOriginalCent = 0;
    var somaValorCanceladoCent = 0;
    var somaValorEmitidoLiquidoCent = 0;
    var somaTotalRecebidoCent = 0;
    var somaSaldoDevedorCent = 0;

    var faixasMap = {
        'A_VENCER': { qtd: 0, saldoCent: 0 },
        'VENCE_HOJE': { qtd: 0, saldoCent: 0 },
        'ATRASO_1_30': { qtd: 0, saldoCent: 0 },
        'ATRASO_31_60': { qtd: 0, saldoCent: 0 },
        'ATRASO_61_90': { qtd: 0, saldoCent: 0 },
        'ATRASO_MAIS_90': { qtd: 0, saldoCent: 0 }
    };

    var gruposClienteMap = {};

    for (var i = 0; i < notasArr.length; i++) {
        var nota = notasArr[i];
        if (!nota) continue;

        var sit = relatorioObterSituacaoNota(nota);
        var classif = classificarFaixaVencimentoNota(nota, dataRef);

        // 1. Filtro de Data
        var campoData = (baseData === 'EMISSAO')
            ? String(nota.dataEmissao || '').slice(0, 10)
            : String(nota.dataVencimento || '').slice(0, 10);

        if (dataInicio && campoData && campoData < dataInicio) continue;
        if (dataFim && campoData && campoData > dataFim) continue;

        // 2. Filtro de Cliente
        if (clienteFiltro && clienteFiltro !== 'TODOS') {
            var matchCli = false;
            if (nota.clienteId && String(nota.clienteId) === String(clienteFiltro)) {
                matchCli = true;
            } else if (typeof normalizarNomeCliente === 'function') {
                var nNota = normalizarNomeCliente(nota.cliente);
                var nFiltro = normalizarNomeCliente(clienteFiltro);
                if (nNota && nFiltro && (nNota === nFiltro || nNota.indexOf(nFiltro) !== -1)) {
                    matchCli = true;
                }
            } else if ((nota.cliente || '').toLowerCase().indexOf(String(clienteFiltro).toLowerCase()) !== -1) {
                matchCli = true;
            }
            if (!matchCli) continue;
        }

        // 3. Filtro de Status
        if (statusFiltro && statusFiltro !== 'TODAS') {
            if (statusFiltro === 'PENDENTES') {
                if (sit.saldo <= 0 || sit.statusFinanceiro === 'CANCELADA') continue;
            } else if (statusFiltro === 'ABERTA') {
                if (sit.statusFinanceiro !== 'ABERTA') continue;
            } else if (statusFiltro === 'PARCIAL') {
                if (sit.statusFinanceiro !== 'PARCIAL') continue;
            } else if (statusFiltro === 'QUITADA') {
                if (sit.statusFinanceiro !== 'QUITADA') continue;
            } else if (statusFiltro === 'CANCELADA') {
                if (sit.statusFinanceiro !== 'CANCELADA') continue;
            } else if (statusFiltro === 'VENCENDO') {
                if (sit.saldo <= 0 || sit.statusFinanceiro === 'CANCELADA' || classif.faixa !== 'VENCE_HOJE') continue;
            } else if (statusFiltro === 'VENCIDA') {
                if (sit.saldo <= 0 || sit.statusFinanceiro === 'CANCELADA') continue;
                if (classif.faixa === 'A_VENCER' || classif.faixa === 'VENCE_HOJE' || classif.faixa === 'QUITADA_OU_CANCELADA') continue;
            }
        }

        // 4. Filtro de Faixa de Vencimento
        if (faixaFiltro && faixaFiltro !== 'TODAS') {
            if (classif.faixa !== faixaFiltro) continue;
        }

        // 5. Filtro de Busca Textual
        if (busca) {
            var haystack = [
                nota.numeroControle || '',
                nota.cliente || '',
                nota.numeroPedido || '',
                nota.numeroDocumento || '',
                nota.cpfCnpj || '',
                nota.telefone || '',
                nota.observacao || ''
            ].join(' ').toLowerCase();

            if (haystack.indexOf(busca) === -1) continue;
        }

        // Linha aprovada nos filtros
        var valorOrig = parseFloat(nota.valorOriginal) || 0;
        var valorOrigCent = moedaParaCentavos(valorOrig);
        var recCent = moedaParaCentavos(sit.totalRecebido);
        var saldoCent = moedaParaCentavos(sit.saldo);

        somaValorOriginalCent += valorOrigCent;

        if (sit.statusFinanceiro === 'CANCELADA') {
            somaValorCanceladoCent += valorOrigCent;
        } else {
            somaValorEmitidoLiquidoCent += valorOrigCent;
            somaTotalRecebidoCent += recCent;
            somaSaldoDevedorCent += saldoCent;

            // Acumula nas faixas de vencimento ativas
            if (faixasMap[classif.faixa]) {
                faixasMap[classif.faixa].qtd++;
                faixasMap[classif.faixa].saldoCent += saldoCent;
            }
        }

        // Subtotais por Cliente
        var nomeCli = (nota.cliente || 'Sem Nome').trim();
        var chaveCli = typeof normalizarNomeCliente === 'function' ? normalizarNomeCliente(nomeCli) : nomeCli.toUpperCase();
        if (!gruposClienteMap[chaveCli]) {
            gruposClienteMap[chaveCli] = {
                clienteNome: nomeCli,
                clienteId: nota.clienteId || null,
                cpfCnpj: nota.cpfCnpj || '',
                telefone: nota.telefone || '',
                qtdNotas: 0,
                somaOriginalCent: 0,
                somaRecebidoCent: 0,
                somaSaldoCent: 0
            };
        }
        gruposClienteMap[chaveCli].qtdNotas++;
        gruposClienteMap[chaveCli].somaOriginalCent += valorOrigCent;
        if (sit.statusFinanceiro !== 'CANCELADA') {
            gruposClienteMap[chaveCli].somaRecebidoCent += recCent;
            gruposClienteMap[chaveCli].somaSaldoCent += saldoCent;
        }

        linhas.push({
            id: nota.id,
            numeroControle: nota.numeroControle || nota.id,
            clienteId: nota.clienteId || null,
            clienteNome: nomeCli,
            cpfCnpj: nota.cpfCnpj || '',
            telefone: nota.telefone || '',
            numeroPedido: nota.numeroPedido || '',
            numeroDocumento: nota.numeroDocumento || '',
            dataEmissao: String(nota.dataEmissao || '').slice(0, 10),
            dataVencimento: String(nota.dataVencimento || '').slice(0, 10),
            valorOriginal: valorOrig,
            totalRecebido: (sit.statusFinanceiro === 'CANCELADA') ? 0 : sit.totalRecebido,
            saldoDevedor: (sit.statusFinanceiro === 'CANCELADA') ? 0 : sit.saldo,
            statusFinanceiro: sit.statusFinanceiro,
            indicadorCobranca: sit.indicadorCobranca,
            statusConsolidado: sit.statusConsolidado,
            faixaVencimento: classif.faixa,
            rotuloFaixa: classif.rotuloFaixa,
            diasEmAtraso: classif.diasEmAtraso
        });
    }

    // Ordenação padrão: data crescente (ou numeroControle)
    linhas.sort(function(a, b) {
        var dtA = (baseData === 'EMISSAO') ? a.dataEmissao : a.dataVencimento;
        var dtB = (baseData === 'EMISSAO') ? b.dataEmissao : b.dataVencimento;
        if (dtA !== dtB) return dtA.localeCompare(dtB);
        return a.numeroControle.localeCompare(b.numeroControle);
    });

    // Formata subtotais por cliente
    var subtotaisPorCliente = Object.values(gruposClienteMap).map(function(g) {
        return {
            clienteNome: g.clienteNome,
            clienteId: g.clienteId,
            cpfCnpj: g.cpfCnpj,
            telefone: g.telefone,
            qtdNotas: g.qtdNotas,
            somaOriginal: centavosParaReais(g.somaOriginalCent),
            somaRecebido: centavosParaReais(g.somaRecebidoCent),
            somaSaldo: centavosParaReais(g.somaSaldoCent)
        };
    }).sort(function(a, b) {
        if (b.somaSaldo !== a.somaSaldo) return b.somaSaldo - a.somaSaldo;
        return a.clienteNome.localeCompare(b.clienteNome);
    });

    // Formata resumo por faixa de vencimento
    var resumoPorFaixaVencimento = {
        A_VENCER: { qtd: faixasMap.A_VENCER.qtd, saldo: centavosParaReais(faixasMap.A_VENCER.saldoCent) },
        VENCE_HOJE: { qtd: faixasMap.VENCE_HOJE.qtd, saldo: centavosParaReais(faixasMap.VENCE_HOJE.saldoCent) },
        ATRASO_1_30: { qtd: faixasMap.ATRASO_1_30.qtd, saldo: centavosParaReais(faixasMap.ATRASO_1_30.saldoCent) },
        ATRASO_31_60: { qtd: faixasMap.ATRASO_31_60.qtd, saldo: centavosParaReais(faixasMap.ATRASO_31_60.saldoCent) },
        ATRASO_61_90: { qtd: faixasMap.ATRASO_61_90.qtd, saldo: centavosParaReais(faixasMap.ATRASO_61_90.saldoCent) },
        ATRASO_MAIS_90: { qtd: faixasMap.ATRASO_MAIS_90.qtd, saldo: centavosParaReais(faixasMap.ATRASO_MAIS_90.saldoCent) }
    };

    return {
        linhas: linhas,
        autoSoma: {
            quantidadeRegistros: linhas.length,
            somaValorOriginal: centavosParaReais(somaValorOriginalCent),
            somaValorCancelado: centavosParaReais(somaValorCanceladoCent),
            somaValorEmitidoLiquido: centavosParaReais(somaValorEmitidoLiquidoCent),
            somaTotalRecebido: centavosParaReais(somaTotalRecebidoCent),
            somaSaldoDevedor: centavosParaReais(somaSaldoDevedorCent),
            resumoPorFaixaVencimento: resumoPorFaixaVencimento,
            subtotaisPorCliente: subtotaisPorCliente
        }
    };
}

/**
 * 4. Gera Relatório de Pagamentos Recebidos (Fluxo de Caixa) com Auto-Soma em centavos.
 */
function gerarRelatorioPagamentosRecebidos(listaNotas, mapaClientes, filtros, dataReferenciaISO) {
    var notasArr = Array.isArray(listaNotas) ? listaNotas : [];
    var f = filtros || {};

    var dataRef = obterDataLocalISO(dataReferenciaISO);
    var dataInicio = f.dataInicio ? String(f.dataInicio).slice(0, 10) : null;
    var dataFim = f.dataFim ? String(f.dataFim).slice(0, 10) : null;

    if (f.atalhoPeriodo && (!dataInicio || !dataFim)) {
        var resPeriodoP = resolverIntervaloPeriodoRelatorio(f.atalhoPeriodo, dataInicio, dataFim, dataRef);
        dataInicio = resPeriodoP.dataInicio;
        dataFim = resPeriodoP.dataFim;
    }
    var clienteFiltro = f.clienteFiltro || 'TODOS';
    var formaFiltro = f.formaPagamentoFiltro || 'TODAS';
    var statusPagtoFiltro = f.statusPagamentoFiltro || 'ATIVOS';
    var busca = (f.buscaTexto || '').toLowerCase().trim();

    var linhas = [];
    var somaValorRecebidoAtivoCent = 0;
    var somaValorEstornadoCent = 0;
    var qtdAtivos = 0;
    var qtdEstornados = 0;

    var formasMap = {};
    var diasMap = {};

    for (var i = 0; i < notasArr.length; i++) {
        var nota = notasArr[i];
        if (!nota) continue;

        // Filtro prévio de cliente da nota
        if (clienteFiltro && clienteFiltro !== 'TODOS') {
            var matchCli = false;
            if (nota.clienteId && String(nota.clienteId) === String(clienteFiltro)) {
                matchCli = true;
            } else if (typeof normalizarNomeCliente === 'function') {
                var nNota = normalizarNomeCliente(nota.cliente);
                var nFiltro = normalizarNomeCliente(clienteFiltro);
                if (nNota && nFiltro && (nNota === nFiltro || nNota.indexOf(nFiltro) !== -1)) {
                    matchCli = true;
                }
            } else if ((nota.cliente || '').toLowerCase().indexOf(String(clienteFiltro).toLowerCase()) !== -1) {
                matchCli = true;
            }
            if (!matchCli) continue;
        }

        var pagtos = relatorioExtrairPagamentosNota(nota);

        for (var j = 0; j < pagtos.length; j++) {
            var p = pagtos[j];
            if (!p) continue;

            var dtP = String(p.dataPagamento || '').slice(0, 10);

            // 1. Filtro por Data de Pagamento
            if (dataInicio && dtP && dtP < dataInicio) continue;
            if (dataFim && dtP && dtP > dataFim) continue;

            // 2. Filtro por Forma de Pagamento
            var forma = p.formaPagamento || 'Dinheiro';
            if (formaFiltro && formaFiltro !== 'TODAS') {
                if (forma.toLowerCase() !== formaFiltro.toLowerCase()) continue;
            }

            // 3. Filtro por Status do Pagamento
            var isEstornado = (p.status === 'ESTORNADO');
            if (statusPagtoFiltro === 'ATIVOS' && isEstornado) continue;
            if (statusPagtoFiltro === 'ESTORNADOS' && !isEstornado) continue;

            // 4. Busca Textual
            if (busca) {
                var hay = [
                    p.numeroRecibo || '',
                    nota.numeroControle || '',
                    nota.cliente || '',
                    forma,
                    p.observacao || ''
                ].join(' ').toLowerCase();

                if (hay.indexOf(busca) === -1) continue;
            }

            var valor = parseFloat(p.valor) || 0;
            var valorCent = moedaParaCentavos(valor);

            if (isEstornado) {
                somaValorEstornadoCent += valorCent;
                qtdEstornados++;
            } else {
                somaValorRecebidoAtivoCent += valorCent;
                qtdAtivos++;

                // Agrupamento por Forma
                if (!formasMap[forma]) {
                    formasMap[forma] = { formaPagamento: forma, qtd: 0, totalCent: 0 };
                }
                formasMap[forma].qtd++;
                formasMap[forma].totalCent += valorCent;

                // Agrupamento por Dia
                var diaChave = dtP || 'SEM_DATA';
                if (!diasMap[diaChave]) {
                    diasMap[diaChave] = { dataPagamento: diaChave, qtd: 0, totalCent: 0 };
                }
                diasMap[diaChave].qtd++;
                diasMap[diaChave].totalCent += valorCent;
            }

            linhas.push({
                id: p.id,
                notaId: nota.id,
                notaNumeroControle: nota.numeroControle || nota.id,
                clienteId: nota.clienteId || null,
                clienteNome: nota.cliente || 'Sem Nome',
                numeroRecibo: p.numeroRecibo || '-',
                dataPagamento: dtP,
                formaPagamento: forma,
                valor: valor,
                status: isEstornado ? 'ESTORNADO' : 'ATIVO',
                operador: p.operador || p.quemRecebeu || '-',
                observacao: p.observacao || ''
            });
        }
    }

    // Ordenação cronológica de pagamentos
    linhas.sort(function(a, b) {
        if (a.dataPagamento !== b.dataPagamento) return a.dataPagamento.localeCompare(b.dataPagamento);
        return a.numeroRecibo.localeCompare(b.numeroRecibo);
    });

    var subtotaisPorFormaPagamento = Object.values(formasMap).map(function(item) {
        return {
            formaPagamento: item.formaPagamento,
            qtd: item.qtd,
            totalRecebido: centavosParaReais(item.totalCent)
        };
    }).sort(function(a, b) {
        return b.totalRecebido - a.totalRecebido;
    });

    var subtotaisPorDia = Object.values(diasMap).map(function(item) {
        return {
            dataPagamento: item.dataPagamento,
            qtd: item.qtd,
            totalDia: centavosParaReais(item.totalCent)
        };
    }).sort(function(a, b) {
        return a.dataPagamento.localeCompare(b.dataPagamento);
    });

    return {
        linhas: linhas,
        pagamentos: linhas,
        autoSoma: {
            quantidadePagamentosAtivos: qtdAtivos,
            quantidadePagamentosEstornados: qtdEstornados,
            quantidadeTotalLinhas: linhas.length,
            somaValorRecebidoAtivo: centavosParaReais(somaValorRecebidoAtivoCent),
            somaValorEstornado: centavosParaReais(somaValorEstornadoCent),
            subtotaisPorFormaPagamento: subtotaisPorFormaPagamento,
            subtotaisPorDia: subtotaisPorDia
        }
    };
}

/**
 * 5.1 Gera arquivo CSV para o Relatório de Notas a Prazo (com linha final de Auto-Soma).
 */
function gerarCSVRelatorioNotas(resultadoRelatorio) {
    if (!resultadoRelatorio) return '';
    var linhas = resultadoRelatorio.linhas || [];
    var auto = resultadoRelatorio.autoSoma || {};

    var cabecalho = [
        'Nº Controle',
        'Cliente',
        'CPF/CNPJ',
        'Telefone',
        'Emissão',
        'Vencimento',
        'Status Financeiro',
        'Faixa Vencimento',
        'Atraso (Dias)',
        'Valor Original (R$)',
        'Total Recebido (R$)',
        'Saldo Devedor (R$)',
        'Nº Pedido',
        'Nº Documento'
    ].join(';');

    var corpo = [];
    for (var i = 0; i < linhas.length; i++) {
        var r = linhas[i];
        var colunas = [
            '"' + (r.numeroControle || '') + '"',
            '"' + (r.clienteNome || '').replace(/"/g, '""') + '"',
            '"' + (r.cpfCnpj || '') + '"',
            '"' + (r.telefone || '') + '"',
            r.dataEmissao || '',
            r.dataVencimento || '',
            r.statusConsolidado || r.statusFinanceiro || '',
            '"' + (r.rotuloFaixa || r.faixaVencimento || '') + '"',
            r.diasEmAtraso || 0,
            formatarMoedaCsv(r.valorOriginal),
            formatarMoedaCsv(r.totalRecebido),
            formatarMoedaCsv(r.saldoDevedor),
            '"' + (r.numeroPedido || '') + '"',
            '"' + (r.numeroDocumento || '') + '"'
        ];
        corpo.push(colunas.join(';'));
    }

    // Linha final obrigatória de Auto-Soma
    var linhaAutoSoma = [
        '"TOTAL GERAL (AUTO-SOMA)"',
        '"(' + auto.quantidadeRegistros + ' registros)"',
        '""',
        '""',
        '""',
        '""',
        '""',
        '""',
        '""',
        formatarMoedaCsv(auto.somaValorOriginal),
        formatarMoedaCsv(auto.somaTotalRecebido),
        formatarMoedaCsv(auto.somaSaldoDevedor),
        '""',
        '""'
    ].join(';');

    corpo.push(linhaAutoSoma);

    return '\uFEFF' + cabecalho + '\r\n' + corpo.join('\r\n');
}

/**
 * 5.2 Gera arquivo CSV para o Relatório de Pagamentos Recebidos (com linha final de Auto-Soma).
 */
function gerarCSVRelatorioPagamentos(resultadoRelatorio) {
    if (!resultadoRelatorio) return '';
    var pagtos = resultadoRelatorio.pagamentos || [];
    var auto = resultadoRelatorio.autoSoma || {};

    var cabecalho = [
        'Nº Recibo',
        'Data Pagamento',
        'Nº Nota',
        'Cliente',
        'Forma de Pagamento',
        'Valor Pago (R$)',
        'Status',
        'Operador',
        'Observação'
    ].join(';');

    var corpo = [];
    for (var i = 0; i < pagtos.length; i++) {
        var p = pagtos[i];
        var colunas = [
            '"' + (p.numeroRecibo || '') + '"',
            p.dataPagamento || '',
            '"' + (p.notaNumeroControle || '') + '"',
            '"' + (p.clienteNome || '').replace(/"/g, '""') + '"',
            '"' + (p.formaPagamento || 'Dinheiro') + '"',
            formatarMoedaCsv(p.valor),
            p.status || 'ATIVO',
            '"' + (p.operador || '') + '"',
            '"' + (p.observacao || '').replace(/"/g, '""') + '"'
        ];
        corpo.push(colunas.join(';'));
    }

    // Linha final obrigatória de Auto-Soma
    var linhaAutoSoma = [
        '"TOTAL GERAL (AUTO-SOMA)"',
        '"(' + auto.quantidadePagamentosAtivos + ' pagamentos ativos)"',
        '""',
        '""',
        '""',
        formatarMoedaCsv(auto.somaValorRecebidoAtivo),
        '""',
        '""',
        '""'
    ].join(';');

    corpo.push(linhaAutoSoma);

    return '\uFEFF' + cabecalho + '\r\n' + corpo.join('\r\n');
}

// =========================================================================
// PARTE 2 — INTERFACE, INTERATIVIDADE, IMPRESSÃO A4 E EXPORTAÇÃO
// =========================================================================

/**
 * Atualiza o seletor de clientes na barra de filtros de relatórios.
 */
function atualizarSeletorClientesRelatorio() {
    var select = document.getElementById('selectFiltroClienteRelatorio');
    if (!select) return;

    var valorAtual = select.value || 'TODOS';
    var clientesArr = (typeof listaGlobalClientes !== 'undefined') ? listaGlobalClientes : [];

    var ordenados = clientesArr.slice().sort(function(a, b) {
        return (a.nome || '').localeCompare(b.nome || '');
    });

    var html = '<option value="TODOS">Todos os Clientes</option>';
    for (var i = 0; i < ordenados.length; i++) {
        var c = ordenados[i];
        var sel = (String(c.id) === String(valorAtual) || String(c.nome) === String(valorAtual)) ? 'selected' : '';
        html += '<option value="' + nucleoEscapeHtml(c.id) + '" ' + sel + '>' + nucleoEscapeHtml(c.nome) + ' (' + nucleoEscapeHtml(c.codigo || 'CLI') + ')</option>';
    }
    select.innerHTML = html;
}

/**
 * Aplica atalho de período na interface e recalcula o relatório.
 */
function aplicarAtalhoPeriodoRelatorio(atalho) {
    estadoFiltrosRelatorio.atalhoPeriodo = atalho || 'TODOS';
    var res = resolverIntervaloPeriodoRelatorio(atalho, null, null, obterDataLocalISO());

    var inputIni = document.getElementById('inputDataInicioRelatorio');
    var inputFim = document.getElementById('inputDataFimRelatorio');

    if (inputIni) inputIni.value = res.dataInicio || '';
    if (inputFim) inputFim.value = res.dataFim || '';

    estadoFiltrosRelatorio.dataInicio = res.dataInicio || '';
    estadoFiltrosRelatorio.dataFim = res.dataFim || '';

    // Atualiza estilo dos botões de atalho
    var botoes = ['TODOS', 'HOJE', 'ONTEM', 'ULTIMOS_7_DIAS', 'ULTIMOS_30_DIAS', 'MES_ATUAL', 'MES_ANTERIOR', 'ANO_ATUAL'];
    for (var i = 0; i < botoes.length; i++) {
        var b = botoes[i];
        var elBtn = document.getElementById('btnAtalhoRel_' + b);
        if (elBtn) {
            if (b === estadoFiltrosRelatorio.atalhoPeriodo) {
                elBtn.className = 'px-2.5 py-1 rounded-lg text-xs font-bold transition bg-indigo-600 text-white shadow';
            } else {
                elBtn.className = 'px-2.5 py-1 rounded-lg text-xs font-bold transition bg-slate-800 hover:bg-slate-700 text-slate-300';
            }
        }
    }

    renderizarPainelRelatoriosNotasPrazo();
}

/**
 * Lê valores da UI e atualiza o estado de filtros do relatório.
 */
function aoAlterarFiltrosRelatorio() {
    var tipo = document.getElementById('selectTipoRelatorio')?.value || 'NOTAS_VENCIMENTO';
    var baseData = document.getElementById('selectBaseDataRelatorio')?.value || 'VENCIMENTO';
    var dataIni = document.getElementById('inputDataInicioRelatorio')?.value || '';
    var dataFim = document.getElementById('inputDataFimRelatorio')?.value || '';
    var cliente = document.getElementById('selectFiltroClienteRelatorio')?.value || 'TODOS';
    var status = document.getElementById('selectFiltroStatusRelatorio')?.value || 'TODAS';
    var faixa = document.getElementById('selectFiltroFaixaRelatorio')?.value || 'TODAS';
    var forma = document.getElementById('selectFiltroFormaRelatorio')?.value || 'TODAS';
    var statusPagto = document.getElementById('selectFiltroStatusPagamentoRelatorio')?.value || 'ATIVOS';
    var busca = document.getElementById('inputBuscaRelatorio')?.value || '';

    estadoFiltrosRelatorio.tipoRelatorio = tipo;
    estadoFiltrosRelatorio.baseData = baseData;
    estadoFiltrosRelatorio.dataInicio = dataIni;
    estadoFiltrosRelatorio.dataFim = dataFim;
    estadoFiltrosRelatorio.clienteFiltro = cliente;
    estadoFiltrosRelatorio.statusFiltro = status;
    estadoFiltrosRelatorio.faixaVencimentoFiltro = faixa;
    estadoFiltrosRelatorio.formaPagamentoFiltro = forma;
    estadoFiltrosRelatorio.statusPagamentoFiltro = statusPagto;
    estadoFiltrosRelatorio.buscaTexto = busca;

    // Alterna visibilidade dos filtros específicos conforme o tipo de relatório
    var boxFiltrosNotas = document.getElementById('boxFiltrosEspecificosNotas');
    var boxFiltrosPagtos = document.getElementById('boxFiltrosEspecificosPagtos');

    if (tipo === 'RECEBIMENTOS_PAGAMENTOS') {
        if (boxFiltrosNotas) boxFiltrosNotas.classList.add('hidden');
        if (boxFiltrosPagtos) boxFiltrosPagtos.classList.remove('hidden');
    } else {
        if (boxFiltrosNotas) boxFiltrosNotas.classList.remove('hidden');
        if (boxFiltrosPagtos) boxFiltrosPagtos.classList.add('hidden');
    }

    renderizarPainelRelatoriosNotasPrazo();
}

/**
 * Restaura todos os filtros para os valores padrão.
 */
function limparFiltrosRelatorio() {
    estadoFiltrosRelatorio.tipoRelatorio = 'NOTAS_VENCIMENTO';
    estadoFiltrosRelatorio.atalhoPeriodo = 'TODOS';
    estadoFiltrosRelatorio.baseData = 'VENCIMENTO';
    estadoFiltrosRelatorio.dataInicio = '';
    estadoFiltrosRelatorio.dataFim = '';
    estadoFiltrosRelatorio.clienteFiltro = 'TODOS';
    estadoFiltrosRelatorio.statusFiltro = 'TODAS';
    estadoFiltrosRelatorio.faixaVencimentoFiltro = 'TODAS';
    estadoFiltrosRelatorio.formaPagamentoFiltro = 'TODAS';
    estadoFiltrosRelatorio.statusPagamentoFiltro = 'ATIVOS';
    estadoFiltrosRelatorio.buscaTexto = '';

    var selTipo = document.getElementById('selectTipoRelatorio');
    var selBase = document.getElementById('selectBaseDataRelatorio');
    var inIni = document.getElementById('inputDataInicioRelatorio');
    var inFim = document.getElementById('inputDataFimRelatorio');
    var selCli = document.getElementById('selectFiltroClienteRelatorio');
    var selStatus = document.getElementById('selectFiltroStatusRelatorio');
    var selFaixa = document.getElementById('selectFiltroFaixaRelatorio');
    var selForma = document.getElementById('selectFiltroFormaRelatorio');
    var selStPag = document.getElementById('selectFiltroStatusPagamentoRelatorio');
    var inBusca = document.getElementById('inputBuscaRelatorio');

    if (selTipo) selTipo.value = 'NOTAS_VENCIMENTO';
    if (selBase) selBase.value = 'VENCIMENTO';
    if (inIni) inIni.value = '';
    if (inFim) inFim.value = '';
    if (selCli) selCli.value = 'TODOS';
    if (selStatus) selStatus.value = 'TODAS';
    if (selFaixa) selFaixa.value = 'TODAS';
    if (selForma) selForma.value = 'TODAS';
    if (selStPag) selStPag.value = 'ATIVOS';
    if (inBusca) inBusca.value = '';

    aplicarAtalhoPeriodoRelatorio('TODOS');
}

/**
 * Abre o relatório filtrado diretamente para um cliente específico.
 */
function abrirRelatorioClienteEspecifico(clienteIdOuChave) {
    if (!clienteIdOuChave) return;
    limparFiltrosRelatorio();
    estadoFiltrosRelatorio.clienteFiltro = clienteIdOuChave;

    var selCli = document.getElementById('selectFiltroClienteRelatorio');
    if (selCli) selCli.value = clienteIdOuChave;

    if (typeof alternarSubAbaNotasPrazo === 'function') {
        alternarSubAbaNotasPrazo('relatorios');
    }
}

/**
 * Renderiza todos os painéis, cards de Auto-Soma e tabela de resultados do relatório ativo.
 */
function renderizarPainelRelatoriosNotasPrazo() {
    atualizarSeletorClientesRelatorio();

    var notasRef = (typeof listaGlobalNotasPrazo !== 'undefined') ? listaGlobalNotasPrazo : [];
    var mapaCliRef = (typeof clientesMap !== 'undefined') ? clientesMap : {};
    var hojeRef = obterDataLocalISO();

    var tipo = estadoFiltrosRelatorio.tipoRelatorio;
    var elSubtitulo = document.getElementById('relatorioPeriodoDescricao');
    var intervalo = resolverIntervaloPeriodoRelatorio(estadoFiltrosRelatorio.atalhoPeriodo, estadoFiltrosRelatorio.dataInicio, estadoFiltrosRelatorio.dataFim, hojeRef);

    if (elSubtitulo) {
        elSubtitulo.innerText = intervalo.descricaoPeriodo;
    }

    if (tipo === 'RECEBIMENTOS_PAGAMENTOS') {
        // Relatório de Fluxo de Caixa / Pagamentos
        var resultadoPagtos = gerarRelatorioPagamentosRecebidos(notasRef, mapaCliRef, estadoFiltrosRelatorio, hojeRef);
        ultimoResultadoRelatorio = { tipo: tipo, dados: resultadoPagtos, intervalo: intervalo };
        renderizarUIRecebimentosPagamentos(resultadoPagtos);
    } else {
        // Relatórios de Notas a Prazo
        var resultadoNotas = gerarRelatorioNotasDetalhado(notasRef, mapaCliRef, estadoFiltrosRelatorio, hojeRef);
        ultimoResultadoRelatorio = { tipo: tipo, dados: resultadoNotas, intervalo: intervalo };
        renderizarUINotasDetalhado(resultadoNotas, tipo);
    }
}

/**
 * Renderiza UI para Relatórios de Notas (Vencimento, Geral ou Posição de Clientes).
 */
function renderizarUINotasDetalhado(res, tipo) {
    var auto = res.autoSoma;

    // Atualiza Cards de Auto-Soma
    var elCard1 = document.getElementById('relatorioCardKpi1');
    var elCard2 = document.getElementById('relatorioCardKpi2');
    var elCard3 = document.getElementById('relatorioCardKpi3');
    var elCard4 = document.getElementById('relatorioCardKpi4');

    if (elCard1) elCard1.innerHTML = '<div class="text-[10px] uppercase font-bold text-slate-400">Total de Registros</div><div class="text-xl font-extrabold text-indigo-400 mt-1">' + auto.quantidadeRegistros + ' notas</div>';
    if (elCard2) elCard2.innerHTML = '<div class="text-[10px] uppercase font-bold text-slate-400">Valor Original Líquido</div><div class="text-xl font-extrabold text-blue-400 mt-1">' + formatarMoedaRelatorio(auto.somaValorEmitidoLiquido) + '</div>';
    if (elCard3) elCard3.innerHTML = '<div class="text-[10px] uppercase font-bold text-slate-400">Total Já Recebido</div><div class="text-xl font-extrabold text-emerald-400 mt-1">' + formatarMoedaRelatorio(auto.somaTotalRecebido) + '</div>';
    if (elCard4) elCard4.innerHTML = '<div class="text-[10px] uppercase font-bold text-slate-400">Saldo Devedor Pendente</div><div class="text-xl font-extrabold text-amber-400 mt-1">' + formatarMoedaRelatorio(auto.somaSaldoDevedor) + '</div>';

    // Painel Secundário: Aging / Faixas de Vencimento
    var painelFaixas = document.getElementById('painelSubtotaisRelatorio');
    if (painelFaixas) {
        var fx = auto.resumoPorFaixaVencimento;
        painelFaixas.innerHTML = `
            <div class="bg-slate-900/60 p-3 rounded-2xl border border-slate-700/60">
                <div class="text-xs font-bold text-slate-300 uppercase mb-2 flex items-center justify-between">
                    <span>⏱️ Posição por Faixas de Atraso (Aging de Vencimento)</span>
                    <span class="text-[11px] font-semibold text-slate-400">Auto-Soma: ${formatarMoedaRelatorio(auto.somaSaldoDevedor)}</span>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                    <div class="bg-slate-800 p-2 rounded-xl border border-blue-500/30">
                        <div class="text-[9px] uppercase font-bold text-blue-300">A Vencer</div>
                        <div class="font-extrabold text-blue-400 mt-0.5">${formatarMoedaRelatorio(fx.A_VENCER.saldo)}</div>
                        <div class="text-[10px] text-slate-400">${fx.A_VENCER.qtd} nota(s)</div>
                    </div>
                    <div class="bg-slate-800 p-2 rounded-xl border border-yellow-500/40">
                        <div class="text-[9px] uppercase font-bold text-yellow-300">Vence Hoje</div>
                        <div class="font-extrabold text-yellow-300 mt-0.5">${formatarMoedaRelatorio(fx.VENCE_HOJE.saldo)}</div>
                        <div class="text-[10px] text-slate-400">${fx.VENCE_HOJE.qtd} nota(s)</div>
                    </div>
                    <div class="bg-slate-800 p-2 rounded-xl border border-amber-500/30">
                        <div class="text-[9px] uppercase font-bold text-amber-300">1 a 30 dias</div>
                        <div class="font-extrabold text-amber-400 mt-0.5">${formatarMoedaRelatorio(fx.ATRASO_1_30.saldo)}</div>
                        <div class="text-[10px] text-slate-400">${fx.ATRASO_1_30.qtd} nota(s)</div>
                    </div>
                    <div class="bg-slate-800 p-2 rounded-xl border border-rose-500/30">
                        <div class="text-[9px] uppercase font-bold text-rose-300">31 a 60 dias</div>
                        <div class="font-extrabold text-rose-400 mt-0.5">${formatarMoedaRelatorio(fx.ATRASO_31_60.saldo)}</div>
                        <div class="text-[10px] text-slate-400">${fx.ATRASO_31_60.qtd} nota(s)</div>
                    </div>
                    <div class="bg-slate-800 p-2 rounded-xl border border-red-500/40">
                        <div class="text-[9px] uppercase font-bold text-red-300">61 a 90 dias</div>
                        <div class="font-extrabold text-red-400 mt-0.5">${formatarMoedaRelatorio(fx.ATRASO_61_90.saldo)}</div>
                        <div class="text-[10px] text-slate-400">${fx.ATRASO_61_90.qtd} nota(s)</div>
                    </div>
                    <div class="bg-slate-800 p-2 rounded-xl border border-red-600/60 bg-red-950/20">
                        <div class="text-[9px] uppercase font-bold text-red-400">+90 dias</div>
                        <div class="font-extrabold text-red-500 mt-0.5">${formatarMoedaRelatorio(fx.ATRASO_MAIS_90.saldo)}</div>
                        <div class="text-[10px] text-slate-400">${fx.ATRASO_MAIS_90.qtd} nota(s)</div>
                    </div>
                </div>
            </div>
        `;
    }

    // Tabela Detalhada
    var thead = document.getElementById('tabelaCabecalhoRelatorios');
    var tbody = document.getElementById('tabelaCorpoRelatoriosNotas');
    var tfoot = document.getElementById('tabelaRodapeAutoSomaRelatorios');

    if (thead) {
        thead.innerHTML = `
            <tr>
                <th class="p-3">Nº Controle</th>
                <th>Cliente</th>
                <th>Emissão</th>
                <th>Vencimento</th>
                <th>Situação</th>
                <th>Atraso</th>
                <th class="text-right">Valor Original</th>
                <th class="text-right">Total Recebido</th>
                <th class="text-right">Saldo Devedor</th>
                <th class="text-right p-3">Ações</th>
            </tr>
        `;
    }

    if (tbody) {
        if (res.linhas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="p-8 text-center text-slate-400 italic">Nenhum registro localizado para os filtros informados.</td></tr>';
            if (tfoot) tfoot.classList.add('hidden');
            return;
        }

        var html = '';
        for (var i = 0; i < res.linhas.length; i++) {
            var r = res.linhas[i];
            var corSaldo = (r.saldoDevedor > 0) ? (r.diasEmAtraso > 0 ? 'text-red-400 font-bold' : 'text-amber-400 font-bold') : 'text-emerald-400';

            var badgeSit = '';
            if (r.statusFinanceiro === 'CANCELADA') {
                badgeSit = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-slate-400">CANCELADA</span>';
            } else if (r.statusFinanceiro === 'QUITADA') {
                badgeSit = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400">QUITADA</span>';
            } else if (r.diasEmAtraso > 0) {
                badgeSit = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400">VENCIDA</span>';
            } else if (r.faixaVencimento === 'VENCE_HOJE') {
                badgeSit = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/20 text-yellow-300 animate-pulse">VENCE HOJE</span>';
            } else {
                badgeSit = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400">A VENCER</span>';
            }

            html += `
                <tr class="border-b border-slate-700/30 hover:bg-slate-800/50 transition">
                    <td class="p-3 font-mono text-indigo-400 font-bold text-xs">${nucleoEscapeHtml(r.numeroControle)}</td>
                    <td class="font-semibold text-slate-200">
                        <div>${nucleoEscapeHtml(r.clienteNome)}</div>
                        <div class="text-[10px] text-slate-400">${r.cpfCnpj ? nucleoEscapeHtml(r.cpfCnpj) : ''} ${r.telefone ? ' • ' + nucleoEscapeHtml(r.telefone) : ''}</div>
                    </td>
                    <td class="text-xs text-slate-300">${formatarDataIsoBr(r.dataEmissao)}</td>
                    <td class="text-xs font-semibold ${r.diasEmAtraso > 0 ? 'text-red-400' : 'text-slate-300'}">${formatarDataIsoBr(r.dataVencimento)}</td>
                    <td>${badgeSit}</td>
                    <td class="text-xs ${r.diasEmAtraso > 0 ? 'text-red-400 font-bold' : 'text-slate-400'}">${r.diasEmAtraso > 0 ? r.diasEmAtraso + ' dia(s)' : '-'}</td>
                    <td class="text-xs text-right font-semibold text-slate-300">${formatarMoedaRelatorio(r.valorOriginal)}</td>
                    <td class="text-xs text-right font-semibold text-emerald-400">${formatarMoedaRelatorio(r.totalRecebido)}</td>
                    <td class="text-xs text-right ${corSaldo}">${formatarMoedaRelatorio(r.saldoDevedor)}</td>
                    <td class="p-3 text-right whitespace-nowrap space-x-1">
                        <button onclick="imprimirReciboOuComprovanteVendaLinha('${nucleoEscapeHtml(r.id)}')" class="bg-indigo-600 hover:bg-indigo-500 px-2 py-0.5 rounded text-[11px] font-bold text-white transition shadow inline-flex items-center gap-1" title="Imprimir Recibo de Pagamento desta Venda">🧾 Recibo</button>
                        <button onclick="imprimirNotaPrazoA4('${nucleoEscapeHtml(r.id)}')" class="bg-slate-700 hover:bg-slate-600 px-2 py-0.5 rounded text-[11px] font-bold text-white transition shadow inline-flex items-center gap-1" title="Imprimir Nota em A4">🖨️ Nota</button>
                        <button onclick="abrirModalExtratoNota('${nucleoEscapeHtml(r.id)}')" class="p-1 rounded hover:bg-slate-700 text-xs transition" title="Extrato">📋</button>
                    </td>
                </tr>
            `;
        }
        tbody.innerHTML = html;
    }

    // Rodapé de Auto-Soma
    if (tfoot) {
        tfoot.classList.remove('hidden');
        tfoot.innerHTML = `
            <tr class="bg-slate-900/90 text-xs font-bold text-slate-200 border-t-2 border-slate-700">
                <td colspan="6" class="p-3 uppercase text-slate-400">AUTO-SOMA DO RELATÓRIO (${auto.quantidadeRegistros} notas):</td>
                <td class="text-right text-slate-200">${formatarMoedaRelatorio(auto.somaValorOriginal)}</td>
                <td class="text-right text-emerald-400">${formatarMoedaRelatorio(auto.somaTotalRecebido)}</td>
                <td class="text-right text-amber-400 font-extrabold text-sm">${formatarMoedaRelatorio(auto.somaSaldoDevedor)}</td>
                <td></td>
            </tr>
        `;
    }
}

/**
 * Renderiza UI para Relatório de Recebimentos / Pagamentos (Caixa).
 */
function renderizarUIRecebimentosPagamentos(res) {
    var auto = res.autoSoma;

    var elCard1 = document.getElementById('relatorioCardKpi1');
    var elCard2 = document.getElementById('relatorioCardKpi2');
    var elCard3 = document.getElementById('relatorioCardKpi3');
    var elCard4 = document.getElementById('relatorioCardKpi4');

    if (elCard1) elCard1.innerHTML = '<div class="text-[10px] uppercase font-bold text-slate-400">Pagamentos Ativos</div><div class="text-xl font-extrabold text-emerald-400 mt-1">' + auto.quantidadePagamentosAtivos + ' baixas</div>';
    if (elCard2) elCard2.innerHTML = '<div class="text-[10px] uppercase font-bold text-slate-400">Total Recebido Ativo</div><div class="text-xl font-extrabold text-emerald-400 mt-1">' + formatarMoedaRelatorio(auto.somaValorRecebidoAtivo) + '</div>';
    if (elCard3) elCard3.innerHTML = '<div class="text-[10px] uppercase font-bold text-slate-400">Pagamentos Estornados</div><div class="text-xl font-extrabold text-rose-400 mt-1">' + auto.quantidadePagamentosEstornados + ' (' + formatarMoedaRelatorio(auto.somaValorEstornado) + ')</div>';
    if (elCard4) elCard4.innerHTML = '<div class="text-[10px] uppercase font-bold text-slate-400">Média por Pagamento</div><div class="text-xl font-extrabold text-blue-400 mt-1">' + (auto.quantidadePagamentosAtivos > 0 ? formatarMoedaRelatorio(auto.somaValorRecebidoAtivo / auto.quantidadePagamentosAtivos) : 'R$ 0,00') + '</div>';

    // Subtotais por Forma de Pagamento
    var painelFaixas = document.getElementById('painelSubtotaisRelatorio');
    if (painelFaixas) {
        var htmlFormas = '';
        var formas = auto.subtotaisPorFormaPagamento || [];
        for (var i = 0; i < formas.length; i++) {
            var f = formas[i];
            htmlFormas += `
                <div class="bg-slate-800 p-2.5 rounded-xl border border-slate-700">
                    <div class="text-[10px] uppercase font-bold text-slate-400">${nucleoEscapeHtml(f.formaPagamento)}</div>
                    <div class="font-extrabold text-emerald-400 text-sm mt-0.5">${formatarMoedaRelatorio(f.totalRecebido)}</div>
                    <div class="text-[10px] text-slate-500">${f.qtd} pagamento(s)</div>
                </div>
            `;
        }

        painelFaixas.innerHTML = `
            <div class="bg-slate-900/60 p-3 rounded-2xl border border-slate-700/60">
                <div class="text-xs font-bold text-slate-300 uppercase mb-2 flex items-center justify-between">
                    <span>💵 Subtotais por Forma de Pagamento</span>
                    <span class="text-[11px] font-semibold text-emerald-400">Auto-Soma: ${formatarMoedaRelatorio(auto.somaValorRecebidoAtivo)}</span>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                    ${htmlFormas || '<div class="text-slate-400 italic">Nenhum pagamento registrado no período.</div>'}
                </div>
            </div>
        `;
    }

    var thead = document.getElementById('tabelaCabecalhoRelatorios');
    var tbody = document.getElementById('tabelaCorpoRelatoriosNotas');
    var tfoot = document.getElementById('tabelaRodapeAutoSomaRelatorios');

    if (thead) {
        thead.innerHTML = `
            <tr>
                <th class="p-3">Nº Recibo</th>
                <th>Data Pagamento</th>
                <th>Nota Ref.</th>
                <th>Cliente</th>
                <th>Forma</th>
                <th>Status</th>
                <th>Operador</th>
                <th class="text-right">Valor Pago</th>
                <th class="text-right p-3">Ações</th>
            </tr>
        `;
    }

    if (tbody) {
        if (res.pagamentos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="p-8 text-center text-slate-400 italic">Nenhum pagamento localizado para os filtros informados.</td></tr>';
            if (tfoot) tfoot.classList.add('hidden');
            return;
        }

        var html = '';
        for (var j = 0; j < res.pagamentos.length; j++) {
            var p = res.pagamentos[j];
            var isEstornado = (p.status === 'ESTORNADO');

            html += `
                <tr class="border-b border-slate-700/30 hover:bg-slate-800/50 transition ${isEstornado ? 'opacity-50 line-through' : ''}">
                    <td class="p-3 font-mono text-indigo-400 font-bold text-xs">${nucleoEscapeHtml(p.numeroRecibo)}</td>
                    <td class="text-xs text-slate-300">${formatarDataIsoBr(p.dataPagamento)}</td>
                    <td class="text-xs font-mono text-slate-300 font-bold">${nucleoEscapeHtml(p.notaNumeroControle)}</td>
                    <td class="font-semibold text-slate-200">${nucleoEscapeHtml(p.clienteNome)}</td>
                    <td class="text-xs text-slate-300 font-medium">${nucleoEscapeHtml(p.formaPagamento)}</td>
                    <td>
                        ${isEstornado ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">ESTORNADO</span>' : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">ATIVO</span>'}
                    </td>
                    <td class="text-xs text-slate-400">${nucleoEscapeHtml(p.operador)}</td>
                    <td class="text-xs text-right font-extrabold ${isEstornado ? 'text-slate-400' : 'text-emerald-400'}">${formatarMoedaRelatorio(p.valor)}</td>
                    <td class="p-3 text-right whitespace-nowrap">
                        <button onclick="imprimirReciboPagamentoA4('${nucleoEscapeHtml(p.notaId)}', '${nucleoEscapeHtml(p.id)}')" class="bg-slate-700 hover:bg-slate-600 px-2 py-0.5 rounded text-[11px] font-bold text-white transition">🧾 Recibo</button>
                    </td>
                </tr>
            `;
        }
        tbody.innerHTML = html;
    }

    if (tfoot) {
        tfoot.classList.remove('hidden');
        tfoot.innerHTML = `
            <tr class="bg-slate-900/90 text-xs font-bold text-slate-200 border-t-2 border-slate-700">
                <td colspan="7" class="p-3 uppercase text-slate-400">AUTO-SOMA PAGAMENTOS ATIVOS (${auto.quantidadePagamentosAtivos} baixas):</td>
                <td class="text-right text-emerald-400 font-extrabold text-sm">${formatarMoedaRelatorio(auto.somaValorRecebidoAtivo)}</td>
                <td></td>
            </tr>
        `;
    }
}

/**
 * Exporta o relatório ativo atual em arquivo CSV compatível com Excel.
 */
function exportarRelatorioAtualCSV() {
    if (!ultimoResultadoRelatorio || !ultimoResultadoRelatorio.dados) {
        renderizarPainelRelatoriosNotasPrazo();
    }
    if (!ultimoResultadoRelatorio || !ultimoResultadoRelatorio.dados) {
        Swal.fire('Aviso', 'Nenhum dado disponível para exportação.', 'info');
        return;
    }

    var csv = '';
    var tipo = ultimoResultadoRelatorio.tipo;
    var hojeStr = obterDataLocalISO();

    if (tipo === 'RECEBIMENTOS_PAGAMENTOS') {
        csv = gerarCSVRelatorioPagamentos(ultimoResultadoRelatorio.dados);
    } else {
        csv = gerarCSVRelatorioNotas(ultimoResultadoRelatorio.dados);
    }

    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'relatorio_tucano_' + tipo.toLowerCase() + '_' + hojeStr + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Gera documento A4 limpo e aciona impressão do relatório ativo.
 */
function imprimirRelatorioAtualA4() {
    if (!ultimoResultadoRelatorio || !ultimoResultadoRelatorio.dados) {
        renderizarPainelRelatoriosNotasPrazo();
    }
    if (!ultimoResultadoRelatorio || !ultimoResultadoRelatorio.dados) {
        Swal.fire('Aviso', 'Nenhum dado disponível para impressão.', 'info');
        return;
    }

    if (typeof gerarHtmlImpressaoRelatorioA4 === 'function' && typeof executarImpressaoHtmlNaAreaFinal === 'function') {
        var cfg = (typeof obterConfiguracoesEmpresaSegura === 'function') ? obterConfiguracoesEmpresaSegura() : {};
        var userEmail = (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser.email : '';
        var htmlRel = gerarHtmlImpressaoRelatorioA4(ultimoResultadoRelatorio, estadoFiltrosRelatorio, cfg, userEmail);
        executarImpressaoHtmlNaAreaFinal(htmlRel);
        return;
    }

    var area = document.getElementById('areaImpressaoFinal');
    if (!area) return;

    var tipo = ultimoResultadoRelatorio.tipo;
    var dados = ultimoResultadoRelatorio.dados;
    var intervalo = ultimoResultadoRelatorio.intervalo || {};
    var hojeStr = obterDataLocalISO();

    var tituloRelatorio = 'RELATÓRIO DE NOTAS A PRAZO';
    if (tipo === 'NOTAS_VENCIMENTO') tituloRelatorio = 'RELATÓRIO DE CONTAS A RECEBER POR VENCIMENTO';
    else if (tipo === 'RECEBIMENTOS_PAGAMENTOS') tituloRelatorio = 'RELATÓRIO DE RECEBIMENTOS E FLUXO DE CAIXA';
    else if (tipo === 'NOTAS_GERAL') tituloRelatorio = 'RELATÓRIO GERAL DE NOTAS A PRAZO';
    else if (tipo === 'CLIENTES_POSICAO') tituloRelatorio = 'RELATÓRIO DE POSIÇÃO CONSOLIDADA POR CLIENTE';

    var htmlTabela = '';
    var htmlTotais = '';

    if (tipo === 'RECEBIMENTOS_PAGAMENTOS') {
        var autoP = dados.autoSoma;
        htmlTotais = `
            <div style="display:flex; gap:10px; margin-bottom:14px;">
                <div style="flex:1; border:1px solid #64748b; padding:6px; text-align:center; border-radius:4px;">
                    <div style="font-size:9px; font-weight:bold; text-transform:uppercase;">PAGTOS ATIVOS</div>
                    <div style="font-size:14px; font-weight:bold; margin-top:2px;">${autoP.quantidadePagamentosAtivos}</div>
                </div>
                <div style="flex:1.5; border:2px solid #16a34a; padding:6px; text-align:center; border-radius:4px; background:#f0fdf4;">
                    <div style="font-size:9px; font-weight:bold; text-transform:uppercase; color:#15803d;">TOTAL RECEBIDO</div>
                    <div style="font-size:16px; font-weight:900; color:#15803d; margin-top:2px;">${formatarMoedaRelatorio(autoP.somaValorRecebidoAtivo)}</div>
                </div>
                <div style="flex:1; border:1px solid #64748b; padding:6px; text-align:center; border-radius:4px;">
                    <div style="font-size:9px; font-weight:bold; text-transform:uppercase;">ESTORNADOS</div>
                    <div style="font-size:14px; font-weight:bold; color:#b91c1c; margin-top:2px;">${autoP.quantidadePagamentosEstornados} (${formatarMoedaRelatorio(autoP.somaValorEstornado)})</div>
                </div>
            </div>
        `;

        var linhasP = dados.pagamentos || [];
        var rowsP = '';
        for (var i = 0; i < linhasP.length; i++) {
            var p = linhasP[i];
            rowsP += `
                <tr style="border-bottom:1px solid #cbd5e1; ${p.status === 'ESTORNADO' ? 'text-decoration:line-through; opacity:0.6;' : ''}">
                    <td style="padding:4px; font-family:monospace;">${nucleoEscapeHtml(p.numeroRecibo)}</td>
                    <td style="padding:4px;">${formatarDataIsoBr(p.dataPagamento)}</td>
                    <td style="padding:4px; font-family:monospace;">${nucleoEscapeHtml(p.notaNumeroControle)}</td>
                    <td style="padding:4px; font-weight:bold;">${nucleoEscapeHtml(p.clienteNome)}</td>
                    <td style="padding:4px;">${nucleoEscapeHtml(p.formaPagamento)}</td>
                    <td style="padding:4px; text-align:center;">${p.status}</td>
                    <td style="padding:4px; text-align:right; font-weight:bold; color:#15803d;">${formatarMoedaRelatorio(p.valor)}</td>
                </tr>
            `;
        }

        htmlTabela = `
            <table style="width:100%; border-collapse:collapse; font-size:10px;">
                <thead>
                    <tr style="background:#e2e8f0; border-bottom:2px solid #94a3b8; text-align:left;">
                        <th style="padding:5px;">Recibo</th>
                        <th style="padding:5px;">Data</th>
                        <th style="padding:5px;">Nota</th>
                        <th style="padding:5px;">Cliente</th>
                        <th style="padding:5px;">Forma</th>
                        <th style="padding:5px; text-align:center;">Status</th>
                        <th style="padding:5px; text-align:right;">Valor</th>
                    </tr>
                </thead>
                <tbody>${rowsP}</tbody>
                <tfoot>
                    <tr style="background:#f8fafc; font-weight:bold; border-top:2px solid #000;">
                        <td colspan="6" style="padding:5px;">AUTO-SOMA TOTAL RECEBIDO (${autoP.quantidadePagamentosAtivos} pagamentos ativos):</td>
                        <td style="padding:5px; text-align:right; color:#15803d;">${formatarMoedaRelatorio(autoP.somaValorRecebidoAtivo)}</td>
                    </tr>
                </tfoot>
            </table>
        `;
    } else {
        var autoN = dados.autoSoma;
        htmlTotais = `
            <div style="display:flex; gap:10px; margin-bottom:14px;">
                <div style="flex:1; border:1px solid #64748b; padding:6px; text-align:center; border-radius:4px;">
                    <div style="font-size:9px; font-weight:bold; text-transform:uppercase;">NOTAS</div>
                    <div style="font-size:14px; font-weight:bold; margin-top:2px;">${autoN.quantidadeRegistros}</div>
                </div>
                <div style="flex:1; border:1px solid #64748b; padding:6px; text-align:center; border-radius:4px;">
                    <div style="font-size:9px; font-weight:bold; text-transform:uppercase;">VALOR ORIGINAL</div>
                    <div style="font-size:14px; font-weight:bold; margin-top:2px;">${formatarMoedaRelatorio(autoN.somaValorOriginal)}</div>
                </div>
                <div style="flex:1; border:1px solid #16a34a; padding:6px; text-align:center; border-radius:4px; background:#f0fdf4;">
                    <div style="font-size:9px; font-weight:bold; text-transform:uppercase; color:#15803d;">TOTAL RECEBIDO</div>
                    <div style="font-size:14px; font-weight:bold; color:#15803d; margin-top:2px;">${formatarMoedaRelatorio(autoN.somaTotalRecebido)}</div>
                </div>
                <div style="flex:1.2; border:2px solid #b91c1c; padding:6px; text-align:center; border-radius:4px; background:#fef2f2;">
                    <div style="font-size:9px; font-weight:bold; text-transform:uppercase; color:#b91c1c;">SALDO DEVEDOR</div>
                    <div style="font-size:16px; font-weight:900; color:#b91c1c; margin-top:2px;">${formatarMoedaRelatorio(autoN.somaSaldoDevedor)}</div>
                </div>
            </div>
        `;

        var linhasN = dados.linhas || [];
        var rowsN = '';
        for (var j = 0; j < linhasN.length; j++) {
            var n = linhasN[j];
            rowsN += `
                <tr style="border-bottom:1px solid #cbd5e1;">
                    <td style="padding:4px; font-family:monospace; font-weight:bold;">${nucleoEscapeHtml(n.numeroControle)}</td>
                    <td style="padding:4px; font-weight:bold;">${nucleoEscapeHtml(n.clienteNome)}</td>
                    <td style="padding:4px;">${formatarDataIsoBr(n.dataEmissao)}</td>
                    <td style="padding:4px;">${formatarDataIsoBr(n.dataVencimento)}</td>
                    <td style="padding:4px; font-size:9px;">${n.statusConsolidado}</td>
                    <td style="padding:4px; text-align:right;">${formatarMoedaRelatorio(n.valorOriginal)}</td>
                    <td style="padding:4px; text-align:right; color:#15803d;">${formatarMoedaRelatorio(n.totalRecebido)}</td>
                    <td style="padding:4px; text-align:right; font-weight:bold; color:${n.saldoDevedor > 0 ? '#b91c1c' : '#15803d'};">${formatarMoedaRelatorio(n.saldoDevedor)}</td>
                </tr>
            `;
        }

        htmlTabela = `
            <table style="width:100%; border-collapse:collapse; font-size:10px;">
                <thead>
                    <tr style="background:#e2e8f0; border-bottom:2px solid #94a3b8; text-align:left;">
                        <th style="padding:5px;">Nº Nota</th>
                        <th style="padding:5px;">Cliente</th>
                        <th style="padding:5px;">Emissão</th>
                        <th style="padding:5px;">Vencimento</th>
                        <th style="padding:5px;">Situação</th>
                        <th style="padding:5px; text-align:right;">Valor Orig.</th>
                        <th style="padding:5px; text-align:right;">Recebido</th>
                        <th style="padding:5px; text-align:right;">Saldo</th>
                    </tr>
                </thead>
                <tbody>${rowsN}</tbody>
                <tfoot>
                    <tr style="background:#f8fafc; font-weight:bold; border-top:2px solid #000;">
                        <td colspan="5" style="padding:5px;">AUTO-SOMA DO RELATÓRIO (${autoN.quantidadeRegistros} notas):</td>
                        <td style="padding:5px; text-align:right;">${formatarMoedaRelatorio(autoN.somaValorOriginal)}</td>
                        <td style="padding:5px; text-align:right; color:#15803d;">${formatarMoedaRelatorio(autoN.somaTotalRecebido)}</td>
                        <td style="padding:5px; text-align:right; color:#b91c1c;">${formatarMoedaRelatorio(autoN.somaSaldoDevedor)}</td>
                    </tr>
                </tfoot>
            </table>
        `;
    }

    area.innerHTML = `
        <div class="a4-print-full">
            <div>
                <div style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px; margin-bottom:12px;">
                    <h1 style="font-size:18px !important; letter-spacing:1px; margin:0;">TUCANO AUTO PEÇAS</h1>
                    <p style="font-size:10px !important; margin:2px 0; color:#333;">Comércio de Peças e Acessórios Automotivos • Gestão Financeira Cloud</p>
                    <h2 style="font-size:14px !important; margin-top:6px; text-transform:uppercase; font-weight:900;">
                        ${tituloRelatorio}
                    </h2>
                </div>

                <div style="display:flex; justify-content:space-between; background:#f1f5f9; padding:8px 12px; border:1px solid #cbd5e1; border-radius:4px; margin-bottom:12px; font-size:10.5px;">
                    <div>
                        <strong>Período Analisado:</strong> ${nucleoEscapeHtml(intervalo.descricaoPeriodo || 'Todo o Período')}<br>
                        <strong>Filtro de Cliente:</strong> ${nucleoEscapeHtml(estadoFiltrosRelatorio.clienteFiltro)}
                    </div>
                    <div style="text-align:right;">
                        <strong>Emissão do Relatório:</strong> ${formatarDataIsoBr(hojeStr)}<br>
                        <strong>Critério de Data:</strong> ${estadoFiltrosRelatorio.baseData === 'EMISSAO' ? 'Data de Emissão' : 'Data de Vencimento'}
                    </div>
                </div>

                ${htmlTotais}
                ${htmlTabela}
            </div>

            <div style="display:flex; justify-content:space-between; margin-top:35px; padding-bottom:10px;">
                <div class="linha-assinatura-a4">
                    <strong>TUCANO AUTO PEÇAS</strong><br>
                    <span>Responsável Financeiro</span>
                </div>
                <div class="linha-assinatura-a4">
                    <strong>CONFERÊNCIA E AUDITORIA</strong><br>
                    <span>Assinatura do Gestor</span>
                </div>
            </div>
        </div>
    `;

    setTimeout(function() { window.print(); }, 300);
}

// Export para testes em ambiente Node.js / VM
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        resolverIntervaloPeriodoRelatorio: resolverIntervaloPeriodoRelatorio,
        classificarFaixaVencimentoNota: classificarFaixaVencimentoNota,
        gerarRelatorioNotasDetalhado: gerarRelatorioNotasDetalhado,
        gerarRelatorioPagamentosRecebidos: gerarRelatorioPagamentosRecebidos,
        gerarCSVRelatorioNotas: gerarCSVRelatorioNotas,
        gerarCSVRelatorioPagamentos: gerarCSVRelatorioPagamentos,
        formatarMoedaRelatorio: formatarMoedaRelatorio,
        formatarMoedaCsv: formatarMoedaCsv,
        formatarDataIsoBr: formatarDataIsoBr
    };
}
