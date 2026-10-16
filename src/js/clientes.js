// [FASE 1 / T-101] Módulo de Gestão de Clientes e Carteira - Tucano Cloud
// Regras Permanentes:
// 1. Apenas 'var' e 'function' no nível superior (compatível com vm.runInContext e browser clássico).
// 2. Proibido acessar DOM/Firebase no topo do arquivo.
// 3. Aritmética financeira sempre em centavos inteiros via nucleo-financeiro.js.

// =========================================================================
// VARIÁVEIS DE ESTADO DO MÓDULO DE CLIENTES
// =========================================================================
var clientesMap = {};
var listaGlobalClientes = [];
var clientesRefGlobal = null;
var subAbaNotasAtiva = 'lancamentos';
var filtroCarteiraClientes = 'todos';
var clienteIdFichaAtual = null;

// =========================================================================
// PARTE 1 — FUNÇÕES PURAS DE DOMÍNIO
// =========================================================================

/**
 * Remove acentos, converte para maiúsculas e remove espaços excedentes.
 */
function normalizarNomeCliente(nome) {
    if (!nome) return '';
    return String(nome)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Retorna somente os dígitos 0-9 de uma string.
 */
function limparDigitosDocumento(valor) {
    if (!valor) return '';
    return String(valor).replace(/\D/g, '');
}

/**
 * Validação dos dígitos verificadores do CPF (11 dígitos).
 */
function validarCPF(cpfStr) {
    var d = limparDigitosDocumento(cpfStr);
    if (d.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(d)) return false;

    var soma = 0;
    for (var i = 0; i < 9; i++) {
        soma += parseInt(d.charAt(i), 10) * (10 - i);
    }
    var resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(d.charAt(9), 10)) return false;

    soma = 0;
    for (var j = 0; j < 10; j++) {
        soma += parseInt(d.charAt(j), 10) * (11 - j);
    }
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(d.charAt(10), 10)) return false;

    return true;
}

/**
 * Validação dos dígitos verificadores do CNPJ (14 dígitos).
 */
function validarCNPJ(cnpjStr) {
    var d = limparDigitosDocumento(cnpjStr);
    if (d.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(d)) return false;

    var pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    var soma = 0;
    for (var i = 0; i < 12; i++) {
        soma += parseInt(d.charAt(i), 10) * pesos1[i];
    }
    var resto = soma % 11;
    var dig1 = resto < 2 ? 0 : 11 - resto;
    if (dig1 !== parseInt(d.charAt(12), 10)) return false;

    var pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    soma = 0;
    for (var j = 0; j < 13; j++) {
        soma += parseInt(d.charAt(j), 10) * pesos2[j];
    }
    resto = soma % 11;
    var dig2 = resto < 2 ? 0 : 11 - resto;
    if (dig2 !== parseInt(d.charAt(13), 10)) return false;

    return true;
}

/**
 * Valida e formata CPF ou CNPJ. Aceita campo opcional vazio.
 */
function validarEFormatarCpfCnpj(valor) {
    if (valor === null || valor === undefined || String(valor).trim() === '') {
        return { valido: true, opcionalVazio: true, tipo: null, limpo: '', formatado: '', erro: null };
    }
    var d = limparDigitosDocumento(valor);
    if (d.length === 11) {
        var cpfValido = validarCPF(d);
        var fmtCPF = d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        return {
            valido: cpfValido,
            opcionalVazio: false,
            tipo: 'CPF',
            limpo: d,
            formatado: fmtCPF,
            erro: cpfValido ? null : 'CPF com dígito verificador inválido.'
        };
    }
    if (d.length === 14) {
        var cnpjValido = validarCNPJ(d);
        var fmtCNPJ = d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        return {
            valido: cnpjValido,
            opcionalVazio: false,
            tipo: 'CNPJ',
            limpo: d,
            formatado: fmtCNPJ,
            erro: cnpjValido ? null : 'CNPJ com dígito verificador inválido.'
        };
    }
    return {
        valido: false,
        opcionalVazio: false,
        tipo: null,
        limpo: d,
        formatado: String(valor).trim(),
        erro: 'Documento incompleto! O CPF deve possuir exatamente 11 dígitos ou o CNPJ exatamente 14 dígitos.'
    };
}

/**
 * Normaliza e valida número de telefone brasileiro (DDD 11-99 + 9 dígitos de celular).
 * Opcionalmente permite fixo (10 dígitos) caso permitirFixo seja true.
 */
function normalizarTelefoneCliente(telefoneStr) {
    if (telefoneStr === null || telefoneStr === undefined || String(telefoneStr).trim() === '') {
        return { valido: true, opcionalVazio: true, limpo: '', waNumber: '', formatado: '', erro: null };
    }
    var d = limparDigitosDocumento(telefoneStr);
    if (d.indexOf('55') === 0 && (d.length === 12 || d.length === 13)) {
        d = d.slice(2);
    }
    if (d.length !== 10 && d.length !== 11) {
        return {
            valido: false,
            opcionalVazio: false,
            limpo: d,
            waNumber: '',
            formatado: String(telefoneStr).trim(),
            erro: 'Telefone deve possuir DDD + 8 ou 9 dígitos (10 ou 11 números no total).'
        };
    }
    var ddd = parseInt(d.slice(0, 2), 10);
    if (isNaN(ddd) || ddd < 11 || ddd > 99) {
        return {
            valido: false,
            opcionalVazio: false,
            limpo: d,
            waNumber: '',
            formatado: String(telefoneStr).trim(),
            erro: 'DDD do telefone inválido (' + d.slice(0, 2) + '). Deve ser entre 11 e 99.'
        };
    }
    var formatado = '';
    if (d.length === 11) {
        formatado = d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else {
        formatado = d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return {
        valido: true,
        opcionalVazio: false,
        limpo: d,
        waNumber: '55' + d,
        formatado: formatado,
        erro: null
    };
}

/**
 * Formata telefone em tempo real enquanto o operador digita.
 */
function formatarTelefoneEmTempoReal(valor, permitirFixo) {
    var nums = String(valor || '').replace(/\D/g, '');
    if (nums.indexOf('55') === 0 && (nums.length === 12 || nums.length === 13)) {
        nums = nums.slice(2);
    }
    nums = nums.slice(0, 11);
    if (!nums) return '';
    if (permitirFixo && nums.length <= 10) {
        if (nums.length <= 2) return '(' + nums;
        if (nums.length <= 6) return '(' + nums.slice(0, 2) + ') ' + nums.slice(2);
        return '(' + nums.slice(0, 2) + ') ' + nums.slice(2, 6) + '-' + nums.slice(6);
    }
    if (nums.length <= 2) return '(' + nums;
    if (nums.length <= 7) return '(' + nums.slice(0, 2) + ') ' + nums.slice(2);
    return '(' + nums.slice(0, 2) + ') ' + nums.slice(2, 7) + '-' + nums.slice(7);
}

/**
 * Formata CPF (até 11 dígitos) ou CNPJ (12 a 14 dígitos) dinamicamente.
 */
function formatarCpfCnpjEmTempoReal(valor) {
    var nums = String(valor || '').replace(/\D/g, '').slice(0, 14);
    if (!nums) return '';
    if (nums.length <= 11) {
        if (nums.length <= 3) return nums;
        if (nums.length <= 6) return nums.slice(0, 3) + '.' + nums.slice(3);
        if (nums.length <= 9) return nums.slice(0, 3) + '.' + nums.slice(3, 6) + '.' + nums.slice(6);
        return nums.slice(0, 3) + '.' + nums.slice(3, 6) + '.' + nums.slice(6, 9) + '-' + nums.slice(9);
    }
    if (nums.length <= 12) {
        return nums.slice(0, 2) + '.' + nums.slice(2, 5) + '.' + nums.slice(5, 8) + '/' + nums.slice(8);
    }
    return nums.slice(0, 2) + '.' + nums.slice(2, 5) + '.' + nums.slice(5, 8) + '/' + nums.slice(8, 12) + '-' + nums.slice(12);
}

/**
 * Verifica se uma nota pertence a um cliente por ID ou por fallback de nome/documento.
 */
function notaPertenceAoCliente(nota, cliente) {
    if (!nota || !cliente) return false;
    if (nota.clienteId && cliente.id && String(nota.clienteId) === String(cliente.id)) {
        return true;
    }
    var nNota = normalizarNomeCliente(nota.cliente);
    var nCli = normalizarNomeCliente(cliente.nome);
    if (nNota && nCli && nNota === nCli) {
        return true;
    }
    var docNota = limparDigitosDocumento(nota.cpfCnpj);
    var docCli = limparDigitosDocumento(cliente.cpfCnpj);
    if (docNota && docCli && docNota.length >= 11 && docNota === docCli) {
        return true;
    }
    return false;
}

function extrairPagamentosNotaCliente(nota) {
    if (!nota || !nota.pagamentos) return [];
    if (Array.isArray(nota.pagamentos)) return nota.pagamentos;
    return Object.keys(nota.pagamentos).map(function(k) {
        return {
            id: k,
            ...nota.pagamentos[k]
        };
    });
}

function obterSituacaoNotaSegura(nota, dataReferenciaISO) {
    if (typeof calcularSituacaoNota === 'function') {
        return calcularSituacaoNota(nota, dataReferenciaISO);
    }
    if (!nota) {
        return { saldo: 0, totalRecebido: 0, statusFinanceiro: 'ABERTA', indicadorCobranca: 'NORMAL', statusConsolidado: 'ABERTA' };
    }
    var vOrigCent = moedaParaCentavos(nota.valorOriginal);
    var vOrig = centavosParaReais(vOrigCent);
    var pagtos = extrairPagamentosNotaCliente(nota).filter(function(p) { return p && p.status !== 'ESTORNADO'; });
    var totRecCent = pagtos.reduce(function(sum, p) { return sum + moedaParaCentavos(p ? p.valor : 0); }, 0);
    var totRec = centavosParaReais(totRecCent);
    var sldCent = Math.max(0, vOrigCent - totRecCent);
    var sld = centavosParaReais(sldCent);

    if (nota.status === 'CANCELADA' || nota.statusCancelamento === 'CANCELADA') {
        return { saldo: sld, totalRecebido: totRec, statusFinanceiro: 'CANCELADA', indicadorCobranca: 'NORMAL', statusConsolidado: 'CANCELADA' };
    }
    if (sldCent === 0 && vOrigCent > 0) {
        return { saldo: 0, totalRecebido: totRec, statusFinanceiro: 'QUITADA', indicadorCobranca: 'NORMAL', statusConsolidado: 'QUITADA' };
    }
    var stFin = totRecCent > 0 ? 'PARCIAL' : 'ABERTA';
    var indCob = 'NORMAL';
    var vencStr = nota.dataVencimento || '';
    if (vencStr) {
        var refStr = obterDataLocalISO(dataReferenciaISO);
        if (vencStr < refStr) {
            indCob = 'VENCIDA';
        } else {
            var diff = calcularDiferencaDiasISO(vencStr, refStr);
            if (diff >= 0 && diff <= 3) indCob = 'VENCENDO';
        }
    }
    var stCons = stFin;
    if (indCob === 'VENCIDA') stCons = 'VENCIDA';
    else if (indCob === 'VENCENDO') stCons = 'VENCENDO';

    return {
        saldo: sld,
        totalRecebido: totRec,
        statusFinanceiro: stFin,
        indicadorCobranca: indCob,
        statusConsolidado: stCons
    };
}

/**
 * Calcula o resumo da carteira financeira de um cliente com aritmética em centavos inteiros.
 */
function calcularResumoCarteiraCliente(cliente, listaNotas, dataReferenciaISO) {
    var notasCliente = [];
    if (Array.isArray(listaNotas)) {
        for (var i = 0; i < listaNotas.length; i++) {
            var n = listaNotas[i];
            if (notaPertenceAoCliente(n, cliente)) {
                notasCliente.push(n);
            }
        }
    }

    var totalEmitidoBrutoCent = 0;
    var totalCanceladoCent = 0;
    var totalEmitidoLiquidoCent = 0;
    var totalRecebidoCent = 0;
    var saldoDevedorCent = 0;

    var qtdNotasTotal = notasCliente.length;
    var qtdNotasAbertas = 0;
    var qtdNotasParciais = 0;
    var qtdNotasVencendo = 0;
    var qtdNotasVencidas = 0;
    var qtdNotasQuitadas = 0;
    var qtdNotasCanceladas = 0;

    var pagamentosDoCliente = [];
    var ultimoPagamentoData = null;
    var ultimoPagamentoValor = 0;

    for (var j = 0; j < notasCliente.length; j++) {
        var nota = notasCliente[j];
        var sit = obterSituacaoNotaSegura(nota, dataReferenciaISO);
        var vOrigCent = moedaParaCentavos(nota.valorOriginal);

        totalEmitidoBrutoCent += vOrigCent;

        if (sit.statusFinanceiro === 'CANCELADA') {
            totalCanceladoCent += vOrigCent;
            qtdNotasCanceladas++;
            continue;
        }

        totalEmitidoLiquidoCent += vOrigCent;
        totalRecebidoCent += moedaParaCentavos(sit.totalRecebido);
        saldoDevedorCent += moedaParaCentavos(sit.saldo);

        if (sit.statusFinanceiro === 'QUITADA') {
            qtdNotasQuitadas++;
        } else if (sit.statusFinanceiro === 'PARCIAL') {
            qtdNotasParciais++;
        } else {
            qtdNotasAbertas++;
        }

        if (sit.indicadorCobranca === 'VENCIDA') {
            qtdNotasVencidas++;
        } else if (sit.indicadorCobranca === 'VENCENDO') {
            qtdNotasVencendo++;
        }

        var pagtos = extrairPagamentosNotaCliente(nota);
        for (var k = 0; k < pagtos.length; k++) {
            var p = pagtos[k];
            if (p && p.status !== 'ESTORNADO') {
                pagamentosDoCliente.push({
                    ...p,
                    notaId: nota.id,
                    notaNumeroControle: nota.numeroControle || nota.id
                });
                var dtPagto = (p.dataPagamento || '').slice(0, 10);
                if (!ultimoPagamentoData || dtPagto > ultimoPagamentoData) {
                    ultimoPagamentoData = dtPagto;
                    ultimoPagamentoValor = centavosParaReais(moedaParaCentavos(p.valor));
                }
            }
        }
    }

    // Ordenação de notas (mais recentes primeiro)
    notasCliente.sort(function(a, b) {
        var dtA = a.dataVencimento || a.dataEmissao || '';
        var dtB = b.dataVencimento || b.dataEmissao || '';
        return dtB.localeCompare(dtA);
    });

    // Ordenação de pagamentos (mais recentes primeiro)
    pagamentosDoCliente.sort(function(a, b) {
        var dtA = (a.dataPagamento || '').slice(0, 10);
        var dtB = (b.dataPagamento || '').slice(0, 10);
        return dtB.localeCompare(dtA);
    });

    var saldoDevedor = centavosParaReais(saldoDevedorCent);
    var limiteCredito = arredondarMoeda(cliente.limiteCredito || 0);
    var limiteDisponivel = null;
    var limiteExcedido = false;

    if (limiteCredito > 0) {
        var limCent = moedaParaCentavos(limiteCredito);
        var dispCent = limCent - saldoDevedorCent;
        limiteDisponivel = centavosParaReais(Math.max(0, dispCent));
        limiteExcedido = saldoDevedorCent > limCent;
    }

    return {
        clienteId: cliente.id || null,
        clienteNome: cliente.nome || 'Cliente',
        totalEmitidoBruto: centavosParaReais(totalEmitidoBrutoCent),
        totalCancelado: centavosParaReais(totalCanceladoCent),
        totalEmitidoLiquido: centavosParaReais(totalEmitidoLiquidoCent),
        totalRecebido: centavosParaReais(totalRecebidoCent),
        saldoDevedor: saldoDevedor,
        qtdNotasTotal: qtdNotasTotal,
        qtdNotasAbertas: qtdNotasAbertas,
        qtdNotasParciais: qtdNotasParciais,
        qtdNotasVencendo: qtdNotasVencendo,
        qtdNotasVencidas: qtdNotasVencidas,
        qtdNotasQuitadas: qtdNotasQuitadas,
        qtdNotasCanceladas: qtdNotasCanceladas,
        ultimoPagamentoData: ultimoPagamentoData,
        ultimoPagamentoValor: ultimoPagamentoValor,
        limiteCredito: limiteCredito,
        limiteDisponivel: limiteDisponivel,
        limiteExcedido: limiteExcedido,
        notasDoCliente: notasCliente,
        pagamentosDoCliente: pagamentosDoCliente
    };
}

/**
 * Consolida toda a carteira de clientes com auto-soma em centavos inteiros.
 */
function consolidarCarteiraGeralClientes(mapaClientes, listaNotas, dataReferenciaISO) {
    var clientesArr = Object.values(mapaClientes || {});
    var notasArr = Array.isArray(listaNotas) ? listaNotas : [];
    var itensCarteira = [];

    var notasVinculadasSet = new Set();

    var totalClientes = clientesArr.length;
    var clientesComSaldo = 0;
    var clientesComVencidas = 0;
    var somaEmitidoLiquidoCent = 0;
    var somaTotalPagoCent = 0;
    var somaSaldoDevedorCent = 0;

    for (var i = 0; i < clientesArr.length; i++) {
        var cli = clientesArr[i];
        var resumo = calcularResumoCarteiraCliente(cli, notasArr, dataReferenciaISO);

        if (resumo.saldoDevedor > 0) clientesComSaldo++;
        if (resumo.qtdNotasVencidas > 0) clientesComVencidas++;

        somaEmitidoLiquidoCent += moedaParaCentavos(resumo.totalEmitidoLiquido);
        somaTotalPagoCent += moedaParaCentavos(resumo.totalRecebido);
        somaSaldoDevedorCent += moedaParaCentavos(resumo.saldoDevedor);

        for (var n = 0; n < resumo.notasDoCliente.length; n++) {
            notasVinculadasSet.add(resumo.notasDoCliente[n].id);
        }

        itensCarteira.push({
            cliente: cli,
            resumo: resumo,
            naoCadastrado: false
        });
    }

    // Identificação de notas avulsas/órfãs
    var notasOrfasPorNome = {};
    for (var j = 0; j < notasArr.length; j++) {
        var nota = notasArr[j];
        if (!notasVinculadasSet.has(nota.id)) {
            var chave = normalizarNomeCliente(nota.cliente) || 'AVULSO';
            if (!notasOrfasPorNome[chave]) {
                notasOrfasPorNome[chave] = {
                    nomeOriginal: nota.cliente || 'Cliente Avulso',
                    cpfCnpj: nota.cpfCnpj || '',
                    telefone: nota.telefone || '',
                    notas: []
                };
            }
            notasOrfasPorNome[chave].notas.push(nota);
        }
    }

    var qtdNotasSemVinculo = 0;
    var chavesOrfas = Object.keys(notasOrfasPorNome);
    for (var k = 0; k < chavesOrfas.length; k++) {
        var grupo = notasOrfasPorNome[chavesOrfas[k]];
        qtdNotasSemVinculo += grupo.notas.length;

        var clienteVirtual = {
            id: 'avulso_' + chavesOrfas[k].toLowerCase().replace(/[^a-z0-9]/g, '_'),
            codigo: 'N/C',
            nome: grupo.nomeOriginal,
            cpfCnpj: grupo.cpfCnpj,
            telefone: grupo.telefone,
            limiteCredito: 0,
            naoCadastrado: true
        };

        var resumoVirtual = calcularResumoCarteiraCliente(clienteVirtual, grupo.notas, dataReferenciaISO);
        if (resumoVirtual.saldoDevedor > 0) clientesComSaldo++;
        if (resumoVirtual.qtdNotasVencidas > 0) clientesComVencidas++;

        somaEmitidoLiquidoCent += moedaParaCentavos(resumoVirtual.totalEmitidoLiquido);
        somaTotalPagoCent += moedaParaCentavos(resumoVirtual.totalRecebido);
        somaSaldoDevedorCent += moedaParaCentavos(resumoVirtual.saldoDevedor);

        itensCarteira.push({
            cliente: clienteVirtual,
            resumo: resumoVirtual,
            naoCadastrado: true
        });
    }

    // Ordenação padrão: quem tem maior saldo devedor primeiro
    itensCarteira.sort(function(a, b) {
        if (b.resumo.saldoDevedor !== a.resumo.saldoDevedor) {
            return b.resumo.saldoDevedor - a.resumo.saldoDevedor;
        }
        return a.cliente.nome.localeCompare(b.cliente.nome);
    });

    return {
        itensCarteira: itensCarteira,
        totaisGerais: {
            totalClientes: itensCarteira.length,
            clientesComSaldo: clientesComSaldo,
            clientesComVencidas: clientesComVencidas,
            somaEmitidoLiquido: centavosParaReais(somaEmitidoLiquidoCent),
            somaTotalPago: centavosParaReais(somaTotalPagoCent),
            somaSaldoDevedor: centavosParaReais(somaSaldoDevedorCent),
            qtdNotasSemVinculo: qtdNotasSemVinculo
        }
    };
}

/**
 * Gera sugestões para conciliação em lote de notas legadas órfãs.
 */
function gerarSugestoesConciliacaoClientes(mapaClientes, listaNotas) {
    var clientesArr = Object.values(mapaClientes || {});
    var notasArr = Array.isArray(listaNotas) ? listaNotas : [];

    // Mapeamento de clientes por nome normalizado e por CPF/CNPJ limpo
    var clientesPorNome = {};
    var clientesPorDoc = {};
    for (var i = 0; i < clientesArr.length; i++) {
        var c = clientesArr[i];
        var nNorm = normalizarNomeCliente(c.nome);
        if (nNorm) clientesPorNome[nNorm] = c;
        var doc = limparDigitosDocumento(c.cpfCnpj);
        if (doc && doc.length >= 11) clientesPorDoc[doc] = c;
    }

    var grupos = {};
    for (var j = 0; j < notasArr.length; j++) {
        var nota = notasArr[j];
        if (!nota.clienteId) {
            var chave = normalizarNomeCliente(nota.cliente) || 'SEM_NOME';
            if (!grupos[chave]) {
                var docNota = limparDigitosDocumento(nota.cpfCnpj);
                var clienteMatch = clientesPorNome[chave] || (docNota ? clientesPorDoc[docNota] : null);

                grupos[chave] = {
                    chaveNome: chave,
                    nomeSugerido: nota.cliente || 'Sem Nome',
                    cpfCnpjSugerido: nota.cpfCnpj || '',
                    telefoneSugerido: nota.telefone || '',
                    clienteExistenteId: clienteMatch ? clienteMatch.id : null,
                    clienteExistenteNome: clienteMatch ? clienteMatch.nome : null,
                    clienteExistenteCodigo: clienteMatch ? clienteMatch.codigo : null,
                    notasIds: [],
                    qtdNotas: 0,
                    somaValorOriginalCent: 0
                };
            }
            grupos[chave].notasIds.push(nota.id);
            grupos[chave].qtdNotas++;
            grupos[chave].somaValorOriginalCent += moedaParaCentavos(nota.valorOriginal);
            if (!grupos[chave].cpfCnpjSugerido && nota.cpfCnpj) {
                grupos[chave].cpfCnpjSugerido = nota.cpfCnpj;
            }
            if (!grupos[chave].telefoneSugerido && nota.telefone) {
                grupos[chave].telefoneSugerido = nota.telefone;
            }
        }
    }

    var resultado = Object.values(grupos).map(function(g) {
        return {
            chaveNome: g.chaveNome,
            nomeSugerido: g.nomeSugerido,
            cpfCnpjSugerido: g.cpfCnpjSugerido,
            telefoneSugerido: g.telefoneSugerido,
            clienteExistenteId: g.clienteExistenteId,
            clienteExistenteNome: g.clienteExistenteNome,
            clienteExistenteCodigo: g.clienteExistenteCodigo,
            notasIds: g.notasIds,
            qtdNotas: g.qtdNotas,
            somaValorOriginal: centavosParaReais(g.somaValorOriginalCent)
        };
    });

    resultado.sort(function(a, b) {
        return b.qtdNotas - a.qtdNotas;
    });

    return resultado;
}

/**
 * [FASE 6 / T-601] Resolvedor Universal de Cliente e Resumo da Carteira.
 * Aceita: cliente.id, cliente.codigo (ex: 'CLI-0004'), chaveCliente (ex: 'avulso_...'),
 * nome normalizado do cliente, ou clienteIdFichaAtual (fallback).
 * Retorna sempre { cliente, resumoCarteira } ou null se não localizado.
 */
function resolverClienteEResumoPorIdentificador(identificador, clientesMapRef, listaClientesRef, notasRef, dataRefISO) {
    var idAlvo = identificador;
    if (!idAlvo && typeof clienteIdFichaAtual !== 'undefined' && clienteIdFichaAtual) {
        idAlvo = clienteIdFichaAtual;
    }
    if (!idAlvo) return null;

    var cMap = (clientesMapRef && typeof clientesMapRef === 'object')
        ? clientesMapRef
        : (typeof clientesMap !== 'undefined' ? clientesMap : {});
    var lClientes = (listaClientesRef && Array.isArray(listaClientesRef))
        ? listaClientesRef
        : (typeof listaGlobalClientes !== 'undefined' ? listaGlobalClientes : []);
    var lNotas = (notasRef && Array.isArray(notasRef))
        ? notasRef
        : (typeof listaGlobalNotasPrazo !== 'undefined' ? listaGlobalNotasPrazo : []);
    var hojeISO = dataRefISO || (typeof obterDataLocalISO === 'function' ? obterDataLocalISO() : '');

    var clienteEncontrado = null;
    var resumoDireto = null;

    // 1. Busca direta por chave no mapa de clientes
    if (cMap && cMap[idAlvo]) {
        clienteEncontrado = cMap[idAlvo];
    }

    // 2. Busca na listaGlobalClientes (por ID, código ex: 'CLI-0004', ou nome normalizado)
    if (!clienteEncontrado && lClientes.length > 0) {
        var strId = String(idAlvo).trim();
        var strNorm = normalizarNomeCliente(strId);
        clienteEncontrado = lClientes.find(function(c) {
            if (!c) return false;
            if (c.id === strId) return true;
            if (c.codigo && String(c.codigo).toUpperCase() === strId.toUpperCase()) return true;
            if (normalizarNomeCliente(c.nome) === strNorm) return true;
            return false;
        });
    }

    // 3. Busca nas propriedades de clientesMap caso não encontrado
    if (!clienteEncontrado && cMap) {
        var strIdMap = String(idAlvo).trim();
        var strNormMap = normalizarNomeCliente(strIdMap);
        var chavesMap = Object.keys(cMap);
        for (var i = 0; i < chavesMap.length; i++) {
            var itemCli = cMap[chavesMap[i]];
            if (itemCli) {
                if (itemCli.id === strIdMap ||
                    (itemCli.codigo && String(itemCli.codigo).toUpperCase() === strIdMap.toUpperCase()) ||
                    normalizarNomeCliente(itemCli.nome) === strNormMap) {
                    clienteEncontrado = itemCli;
                    break;
                }
            }
        }
    }

    // 4. Caso não encontre nos clientes cadastrados (ex: cliente órfão/avulso de notas), busca na carteira consolidada
    if (!clienteEncontrado && typeof consolidarCarteiraGeralClientes === 'function') {
        var consolidado = consolidarCarteiraGeralClientes(cMap, lNotas, hojeISO);
        if (consolidado && Array.isArray(consolidado.itensCarteira)) {
            var strIdCons = String(idAlvo).trim();
            var strNormCons = normalizarNomeCliente(strIdCons);
            var itemCarteira = consolidado.itensCarteira.find(function(it) {
                if (!it || !it.cliente) return false;
                if (it.cliente.id === strIdCons || it.chaveCliente === strIdCons) return true;
                if (it.cliente.codigo && String(it.cliente.codigo).toUpperCase() === strIdCons.toUpperCase()) return true;
                if (normalizarNomeCliente(it.cliente.nome) === strNormCons) return true;
                return false;
            });
            if (itemCarteira) {
                clienteEncontrado = itemCarteira.cliente;
                resumoDireto = itemCarteira.resumo;
            }
        }
    }

    // 5. Último fallback: busca em notas legadas por nome de cliente ou ID
    if (!clienteEncontrado && lNotas.length > 0) {
        var strIdNota = String(idAlvo).trim();
        var strNormNota = normalizarNomeCliente(strIdNota);
        var notaSample = lNotas.find(function(n) {
            if (!n) return false;
            if (n.id === strIdNota || n.clienteId === strIdNota) return true;
            if (normalizarNomeCliente(n.cliente) === strNormNota) return true;
            var chaveAvulso = 'avulso_' + (normalizarNomeCliente(n.cliente) || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
            if (chaveAvulso === strIdNota) return true;
            return false;
        });
        if (notaSample) {
            clienteEncontrado = {
                id: strIdNota,
                codigo: 'N/C',
                nome: notaSample.cliente || 'Cliente Avulso',
                cpfCnpj: notaSample.cpfCnpj || '',
                telefone: notaSample.telefone || '',
                limiteCredito: 0,
                naoCadastrado: true
            };
        }
    }

    if (!clienteEncontrado) return null;

    var resumoFinal = resumoDireto;
    if (!resumoFinal && typeof calcularResumoCarteiraCliente === 'function') {
        resumoFinal = calcularResumoCarteiraCliente(clienteEncontrado, lNotas, hojeISO);
    }

    return {
        cliente: clienteEncontrado,
        resumoCarteira: resumoFinal
    };
}

/**
 * [FASE 6 / T-601] Helper de conveniência retrocompatível para obter apenas o cliente.
 */
function obterClientePorIdOuChave(identificador) {
    var res = resolverClienteEResumoPorIdentificador(identificador);
    return res ? res.cliente : null;
}

// =========================================================================
// PARTE 2 — INTEGRAÇÃO FIREBASE, AUTOCOMPLETE, CARTEIRA E MODAIS
// =========================================================================

/**
 * Reserva número sequencial atômico CLI-XXXX no Firebase RTDB com fallback seguro.
 */
async function obterProximoCodigoCliente() {
    var maxNumero = 0;
    if (typeof listaGlobalClientes !== 'undefined' && Array.isArray(listaGlobalClientes)) {
        for (var i = 0; i < listaGlobalClientes.length; i++) {
            var cod = listaGlobalClientes[i] && listaGlobalClientes[i].codigo;
            if (cod && typeof cod === 'string') {
                var m = cod.match(/\d+/);
                if (m) {
                    var n = parseInt(m[0], 10);
                    if (!isNaN(n) && n > maxNumero) maxNumero = n;
                }
            }
        }
    }

    if (typeof database !== 'undefined' && database && database.ref) {
        try {
            var refSeq = database.ref('sequencias/clientes');
            var resultado = await refSeq.transaction(function(atual) {
                var seqAtual = (typeof atual === 'number' && !isNaN(atual)) ? atual : maxNumero;
                if (seqAtual < maxNumero) seqAtual = maxNumero;
                return seqAtual + 1;
            });
            if (resultado && resultado.committed && resultado.snapshot) {
                var proximo = resultado.snapshot.val();
                return 'CLI-' + String(proximo).padStart(4, '0');
            }
        } catch (eSeq) {
            console.warn('[Clientes] Transação de sequência de clientes falhou, acionando fallback seguro:', eSeq);
        }
    }

    var proximoFallback = (maxNumero > 0 ? maxNumero : (typeof listaGlobalClientes !== 'undefined' && listaGlobalClientes ? listaGlobalClientes.length : 0)) + 1;
    return 'CLI-' + String(proximoFallback).padStart(4, '0');
}

/**
 * Inicia listener em tempo real para sincronização de clientes.
 */
function iniciarListenerClientes() {
    if (typeof database === 'undefined' || !database) return;
    if (clientesRefGlobal) clientesRefGlobal.off();
    clientesRefGlobal = database.ref('clientes');

    clientesRefGlobal.on('child_added', function(snap) {
        var c = snap.val();
        if (c) {
            clientesMap[snap.key] = { id: snap.key, ...c };
            listaGlobalClientes = Object.values(clientesMap);
            atualizarAutocompleteClientes();
            atualizarTabelaCarteiraClientes();
            atualizarFichaClienteSeAberta(snap.key);
            atualizarBadgeNotasSemVinculo();
        }
    });

    clientesRefGlobal.on('child_changed', function(snap) {
        var c = snap.val();
        if (c) {
            clientesMap[snap.key] = { id: snap.key, ...c };
            listaGlobalClientes = Object.values(clientesMap);
            atualizarAutocompleteClientes();
            atualizarTabelaCarteiraClientes();
            atualizarFichaClienteSeAberta(snap.key);
            atualizarBadgeNotasSemVinculo();
        }
    });

    clientesRefGlobal.on('child_removed', function(snap) {
        delete clientesMap[snap.key];
        listaGlobalClientes = Object.values(clientesMap);
        atualizarAutocompleteClientes();
        atualizarTabelaCarteiraClientes();
        atualizarBadgeNotasSemVinculo();
    });
}

/**
 * Encerra listener e limpa memória local de clientes.
 */
function encerrarListenerClientes() {
    if (clientesRefGlobal) {
        clientesRefGlobal.off();
        clientesRefGlobal = null;
    }
    clientesMap = {};
    listaGlobalClientes = [];
}

/**
 * Alterna entre sub-abas 'lancamentos', 'clientes' e 'relatorios' no módulo de Notas a Prazo.
 */
function alternarSubAbaNotasPrazo(subAba) {
    subAbaNotasAtiva = subAba || 'lancamentos';
    var elLanc = document.getElementById('subAbaConteudoLancamentos');
    var elCli = document.getElementById('subAbaConteudoClientes');
    var elRel = document.getElementById('subAbaNotasRelatorios');
    var btnLanc = document.getElementById('btnSubAbaLancamentos');
    var btnCli = document.getElementById('btnSubAbaClientes');
    var btnRel = document.getElementById('btnSubAbaNotasRelatorios');

    var clsAtivo = 'px-4 py-2 rounded-xl font-bold text-xs transition-all duration-200 flex items-center gap-2 bg-indigo-600 text-white shadow-md';
    var clsInativo = 'px-4 py-2 rounded-xl font-bold text-xs transition-all duration-200 flex items-center gap-2 bg-slate-900 text-slate-300 hover:bg-slate-700 hover:text-white';

    if (elLanc) elLanc.classList.add('hidden');
    if (elCli) elCli.classList.add('hidden');
    if (elRel) elRel.classList.add('hidden');

    if (btnLanc) btnLanc.className = clsInativo;
    if (btnCli) btnCli.className = clsInativo;
    if (btnRel) btnRel.className = clsInativo;

    if (subAbaNotasAtiva === 'lancamentos') {
        if (elLanc) elLanc.classList.remove('hidden');
        if (btnLanc) btnLanc.className = clsAtivo;
        if (typeof atualizarDashboardNotasPrazo === 'function') atualizarDashboardNotasPrazo();
        if (typeof atualizarTabelaNotasPrazo === 'function') atualizarTabelaNotasPrazo();
    } else if (subAbaNotasAtiva === 'clientes') {
        if (elCli) elCli.classList.remove('hidden');
        if (btnCli) btnCli.className = clsAtivo;
        atualizarTabelaCarteiraClientes();
    } else if (subAbaNotasAtiva === 'relatorios') {
        if (elRel) elRel.classList.remove('hidden');
        if (btnRel) btnRel.className = clsAtivo;
        if (typeof renderizarPainelRelatoriosNotasPrazo === 'function') renderizarPainelRelatoriosNotasPrazo();
    }
}

/**
 * Atualiza o datalist de autocomplete e o select de clientes no formulário de notas.
 */
function atualizarAutocompleteClientes() {
    var datalist = document.getElementById('listaClientesAutocomplete');
    if (datalist) {
        var html = '';
        var ordenados = listaGlobalClientes.slice().sort(function(a, b) {
            return a.nome.localeCompare(b.nome);
        });
        for (var i = 0; i < ordenados.length; i++) {
            var c = ordenados[i];
            html += '<option value="' + nucleoEscapeHtml(c.nome) + '">';
        }
        datalist.innerHTML = html;
    }
    atualizarSelectClientesCadastrados();
}

/**
 * Define o prazo rápido em dias no formulário de Nova Nota a Prazo.
 */
function definirPrazoRapidoNota(dias) {
    var el = document.getElementById('campoNotaPrazoDias');
    if (!el) return;
    el.value = dias;
    var botoes = [10, 15, 30];
    botoes.forEach(function(d) {
        var btn = document.getElementById('btnPrazo' + d + 'd');
        if (btn) {
            if (d === dias) {
                btn.className = 'px-2 py-0.5 rounded text-[11px] font-bold transition bg-indigo-600 text-white shadow-sm';
            } else {
                btn.className = 'px-2 py-0.5 rounded text-[11px] font-bold transition bg-slate-700 hover:bg-slate-600 text-slate-300';
            }
        }
    });
    if (typeof aoMudarDataOuPrazoNota === 'function') {
        aoMudarDataOuPrazoNota();
    }
}

/**
 * Seleciona cliente pelo seletor dropdown com número da ficha.
 */
function aoSelecionarClientePeloSelect(clienteId) {
    if (!clienteId) return;
    var c = (clientesMap && clientesMap[clienteId]) || (listaGlobalClientes && listaGlobalClientes.find(function(item) { return item.id === clienteId; }));
    if (!c) return;
    var elNome = document.getElementById('campoNotaCliente');
    var elId = document.getElementById('campoNotaClienteId');
    var elCpf = document.getElementById('campoNotaCpfCnpj');
    var elTel = document.getElementById('campoNotaTelefone');

    if (elNome) elNome.value = c.nome;
    if (elId) elId.value = c.id;
    if (elCpf) elCpf.value = c.cpfCnpj || '';
    if (elTel) elTel.value = c.telefone || '';

    aoSelecionarOuDigitarClienteNota();
}

/**
 * Atualiza o dropdown seletor de clientes cadastrados no formulário de notas.
 */
function atualizarSelectClientesCadastrados() {
    var sel = document.getElementById('selectClienteCadastradoNota');
    if (!sel) return;
    var valorAtual = sel.value;
    var html = '<option value="">-- 📋 Escolher Cliente Cadastrado (Ficha) --</option>';
    var ordenados = (listaGlobalClientes || []).slice().sort(function(a, b) {
        var codA = a.codigo || '';
        var codB = b.codigo || '';
        if (codA && codB) return codA.localeCompare(codB);
        return (a.nome || '').localeCompare(b.nome || '');
    });
    for (var i = 0; i < ordenados.length; i++) {
        var c = ordenados[i];
        var cod = c.codigo || 'CLI';
        var tel = c.telefone ? ' — ' + c.telefone : '';
        html += '<option value="' + nucleoEscapeHtml(c.id) + '">' +
            '📋 [' + nucleoEscapeHtml(cod) + '] ' + nucleoEscapeHtml(c.nome) + tel +
            '</option>';
    }
    sel.innerHTML = html;
    if (valorAtual) sel.value = valorAtual;
}

/**
 * Monitora seleção/digitação de cliente no formulário de Nova Nota a Prazo.
 */
function aoSelecionarOuDigitarClienteNota() {
    var inputCliente = document.getElementById('campoNotaCliente');
    var inputId = document.getElementById('campoNotaClienteId');
    var inputCpf = document.getElementById('campoNotaCpfCnpj');
    var inputTel = document.getElementById('campoNotaTelefone');
    var boxResumo = document.getElementById('boxResumoClienteNota');
    var selCliente = document.getElementById('selectClienteCadastradoNota');
    if (!inputCliente) return;

    var nomeDigitado = inputCliente.value.trim();
    if (!nomeDigitado) {
        if (inputId) inputId.value = '';
        if (boxResumo) boxResumo.classList.add('hidden');
        if (selCliente) selCliente.value = '';
        return;
    }

    var normalizado = normalizarNomeCliente(nomeDigitado);
    var cliente = listaGlobalClientes.find(function(c) {
        return normalizarNomeCliente(c.nome) === normalizado || (c.codigo && c.codigo.toUpperCase() === normalizado);
    });

    if (cliente) {
        if (inputId) inputId.value = cliente.id;
        if (inputCpf && !inputCpf.value && cliente.cpfCnpj) inputCpf.value = cliente.cpfCnpj;
        if (inputTel && !inputTel.value && cliente.telefone) inputTel.value = cliente.telefone;
        if (selCliente && selCliente.value !== cliente.id) selCliente.value = cliente.id;

        if (boxResumo) {
            var notasRef = (typeof listaGlobalNotasPrazo !== 'undefined') ? listaGlobalNotasPrazo : [];
            var resumo = calcularResumoCarteiraCliente(cliente, notasRef);
            var saldoFmt = formatadorMoeda.format(resumo.saldoDevedor);
            var codFicha = cliente.codigo || 'CLI';
            var qtdNotasAberto = (resumo.qtdNotasAbertas || 0) + (resumo.qtdNotasParciais || 0);

            boxResumo.innerHTML = `
                <div class="bg-indigo-950/60 border border-indigo-500/40 rounded-2xl p-3.5 text-xs space-y-2 shadow-lg">
                    <div class="flex justify-between items-center gap-2 flex-wrap">
                        <div class="flex items-center gap-2">
                            <span class="px-2 py-0.5 rounded-lg bg-indigo-600 text-white font-mono font-bold text-[10px]">FICHA: ${nucleoEscapeHtml(codFicha)}</span>
                            <span class="font-bold text-white text-sm">${nucleoEscapeHtml(cliente.nome)}</span>
                        </div>
                        <button type="button" onclick="abrirModalFichaCliente('${nucleoEscapeHtml(cliente.id)}')" class="bg-indigo-700 hover:bg-indigo-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 shadow">
                            📋 Ver Ficha / Notas deste Cliente
                        </button>
                    </div>
                    <div class="grid grid-cols-2 gap-2 pt-2 border-t border-indigo-500/20 text-[11px]">
                        <div><span class="text-slate-400">Saldo Devedor Atual:</span> <strong class="${resumo.saldoDevedor > 0 ? 'text-amber-400' : 'text-emerald-400'} font-bold">${saldoFmt}</strong></div>
                        <div><span class="text-slate-400">Notas em Aberto:</span> <strong class="text-indigo-300 font-bold">${qtdNotasAberto} nota(s)</strong></div>
                    </div>
                    ${resumo.qtdNotasVencidas > 0 ? `<div class="text-[10px] text-red-400 font-bold flex items-center gap-1">⚠️ Atenção: Cliente possui ${resumo.qtdNotasVencidas} nota(s) vencida(s)!</div>` : ''}
                </div>
            `;
            boxResumo.classList.remove('hidden');
        }
    } else {
        if (inputId) inputId.value = '';
        if (boxResumo) boxResumo.classList.add('hidden');
        if (selCliente) selCliente.value = '';
    }
}

/**
 * Atualiza o badge indicador de notas sem vínculo a clientes.
 */
function atualizarBadgeNotasSemVinculo() {
    var badge = document.getElementById('badgeNotasSemVinculo');
    if (!badge) return;
    var notasRef = (typeof listaGlobalNotasPrazo !== 'undefined') ? listaGlobalNotasPrazo : [];
    var semVinculo = notasRef.filter(function(n) { return !n.clienteId; }).length;
    if (semVinculo > 0) {
        badge.innerText = semVinculo;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

/**
 * Define o filtro ativo para a tabela da carteira de clientes.
 */
function definirFiltroCarteiraClientes(filtro) {
    filtroCarteiraClientes = filtro || 'todos';
    var pills = ['todos', 'comSaldo', 'vencidos', 'semSaldo', 'limiteExcedido'];
    pills.forEach(function(p) {
        var el = document.getElementById('filtroCarteira_' + p);
        if (el) {
            if (p === filtroCarteiraClientes) {
                el.className = 'px-3 py-1.5 rounded-xl text-xs font-bold transition bg-indigo-600 text-white';
            } else {
                el.className = 'px-3 py-1.5 rounded-xl text-xs font-bold transition bg-slate-800 hover:bg-slate-700 text-slate-300';
            }
        }
    });
    atualizarTabelaCarteiraClientes();
}

/**
 * Renderiza a tabela da carteira de clientes com auto-soma.
 */
function atualizarTabelaCarteiraClientes() {
    var corpo = document.getElementById('tabelaCorpoCarteiraClientes');
    if (!corpo) return;

    var busca = (document.getElementById('inputFiltroBuscaClientes')?.value || '').toLowerCase().trim();
    var notasRef = (typeof listaGlobalNotasPrazo !== 'undefined') ? listaGlobalNotasPrazo : [];
    var consolidado = consolidarCarteiraGeralClientes(clientesMap, notasRef);

    // Atualiza cards de topo da carteira
    var elTotCli = document.getElementById('cardCarteiraTotalClientes');
    var elComSaldo = document.getElementById('cardCarteiraComSaldo');
    var elVencidas = document.getElementById('cardCarteiraComVencidas');
    var elSaldoGeral = document.getElementById('cardCarteiraSaldoGeral');
    if (elTotCli) elTotCli.innerText = consolidado.totaisGerais.totalClientes;
    if (elComSaldo) elComSaldo.innerText = consolidado.totaisGerais.clientesComSaldo;
    if (elVencidas) elVencidas.innerText = consolidado.totaisGerais.clientesComVencidas;
    if (elSaldoGeral) elSaldoGeral.innerText = formatadorMoeda.format(consolidado.totaisGerais.somaSaldoDevedor);

    // Filtragem
    var filtrados = consolidado.itensCarteira.filter(function(item) {
        var c = item.cliente;
        var r = item.resumo;

        var matchTexto = (c.nome || '').toLowerCase().includes(busca) ||
                           (c.codigo || '').toLowerCase().includes(busca) ||
                           (c.cpfCnpj || '').toLowerCase().includes(busca) ||
                           (c.telefone || '').toLowerCase().includes(busca);
        if (!matchTexto) return false;

        if (filtroCarteiraClientes === 'comSaldo') return r.saldoDevedor > 0;
        if (filtroCarteiraClientes === 'vencidos') return r.qtdNotasVencidas > 0;
        if (filtroCarteiraClientes === 'semSaldo') return r.saldoDevedor <= 0;
        if (filtroCarteiraClientes === 'limiteExcedido') return r.limiteExcedido;
        return true;
    });

    if (filtrados.length === 0) {
        corpo.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-slate-400 italic">Nenhum cliente localizado para os filtros informados.</td></tr>';
        document.getElementById('tabelaRodapeCarteiraAutoSoma')?.classList.add('hidden');
        return;
    }

    var somaFiltroCompradoCent = 0;
    var somaFiltroPagoCent = 0;
    var somaFiltroSaldoCent = 0;

    var html = '';
    for (var i = 0; i < filtrados.length; i++) {
        var it = filtrados[i];
        var c = it.cliente;
        var r = it.resumo;

        somaFiltroCompradoCent += moedaParaCentavos(r.totalEmitidoLiquido);
        somaFiltroPagoCent += moedaParaCentavos(r.totalRecebido);
        somaFiltroSaldoCent += moedaParaCentavos(r.saldoDevedor);

        var badgeSituacao = '';
        if (r.saldoDevedor <= 0) {
            badgeSituacao = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">QUITADO</span>';
        } else if (r.qtdNotasVencidas > 0) {
            badgeSituacao = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">VENCIDO (' + r.qtdNotasVencidas + ')</span>';
        } else if (r.qtdNotasVencendo > 0) {
            badgeSituacao = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 animate-pulse">VENCENDO</span>';
        } else {
            badgeSituacao = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">EM DIA</span>';
        }

        var badgeNaoCadastrado = it.naoCadastrado ? '<span class="ml-1 text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30" title="Notas emitidas para este nome sem cadastro oficial">NÃO CADASTRADO</span>' : '';

        var limiteTexto = '-';
        if (r.limiteCredito > 0) {
            limiteTexto = formatadorMoeda.format(r.limiteCredito);
            if (r.limiteExcedido) {
                limiteTexto += ' <span class="text-[10px] text-red-400 font-bold">(Excedido)</span>';
            }
        }

        var btnAcoes = '';
        var btnCobrarJuntas = r.saldoDevedor > 0
            ? `<button onclick="enviarWhatsAppTodasNotasCliente('${nucleoEscapeHtml(c.id)}')" class="bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 rounded text-xs font-bold text-white transition shadow inline-flex items-center gap-1" title="📲 Cobrar / Enviar Todas as Notas Juntas (${(r.qtdNotasAbertas || 0) + (r.qtdNotasParciais || 0)} notas • ${formatadorMoeda.format(r.saldoDevedor)})">📲 Cobrar (${formatadorMoeda.format(r.saldoDevedor)})</button>`
            : '';

        if (it.naoCadastrado) {
            btnAcoes = `
                ${btnCobrarJuntas}
                <button onclick="abrirModalFormCliente(null, '${nucleoEscapeHtml(c.nome)}')" class="bg-amber-600 hover:bg-amber-500 px-2.5 py-1 rounded text-xs font-bold text-white transition shadow" title="Cadastrar cliente oficial e vincular notas">Cadastrar</button>
                <button onclick="abrirModalFichaCliente('${nucleoEscapeHtml(c.id || c.codigo)}')" class="p-1.5 rounded hover:bg-slate-700 text-sm transition" title="Ver Ficha e Notas">📋</button>
            `;
        } else {
            btnAcoes = `
                ${btnCobrarJuntas}
                <button onclick="abrirModalFichaCliente('${nucleoEscapeHtml(c.id || c.codigo)}')" class="bg-indigo-600 hover:bg-indigo-500 px-2.5 py-1 rounded text-xs font-bold text-white transition shadow" title="Ver Ficha e Notas">Ficha</button>
                <button onclick="abrirModalFormCliente('${nucleoEscapeHtml(c.id)}')" class="bg-slate-700 hover:bg-slate-600 px-2.5 py-1 rounded text-xs font-bold text-white transition shadow inline-flex items-center gap-1" title="Editar Cadastro do Cliente">✏️ Editar</button>
                <button onclick="imprimirExtratoClienteA4('${nucleoEscapeHtml(c.id)}')" class="p-1.5 rounded hover:bg-slate-700 text-sm transition" title="Imprimir Extrato A4">🖨️</button>
                <button onclick="enviarWhatsAppExtratoCliente('${nucleoEscapeHtml(c.id)}')" class="p-1.5 rounded hover:bg-emerald-900/50 text-emerald-400 text-sm transition" title="Enviar Extrato no WhatsApp">📲</button>
            `;
        }

        html += `
            <tr class="border-b border-slate-700/30 hover:bg-slate-800/50 transition">
                <td class="p-3 font-mono text-indigo-400 font-bold text-xs cursor-pointer hover:text-indigo-300 transition" onclick="abrirModalFichaCliente('${nucleoEscapeHtml(c.id || c.codigo)}')" title="Clique para abrir a ficha completa do cliente">${nucleoEscapeHtml(c.codigo || '-')}</td>
                <td class="font-semibold text-slate-100">
                    <div class="flex items-center gap-1 cursor-pointer hover:text-indigo-300 transition" onclick="abrirModalFichaCliente('${nucleoEscapeHtml(c.id || c.codigo)}')" title="Clique para abrir a ficha completa do cliente">${nucleoEscapeHtml(c.nome)} ${badgeNaoCadastrado}</div>
                    <div class="text-[11px] text-slate-400 font-normal">
                        ${c.telefone ? '📞 ' + nucleoEscapeHtml(c.telefone) : ''}
                        ${c.cpfCnpj ? ' • ' + nucleoEscapeHtml(c.cpfCnpj) : ''}
                    </div>
                </td>
                <td class="text-xs text-slate-300 font-semibold">${limiteTexto}</td>
                <td class="font-semibold text-slate-300 text-xs">${formatadorMoeda.format(r.totalEmitidoLiquido)}</td>
                <td class="font-semibold text-emerald-400 text-xs">${formatadorMoeda.format(r.totalRecebido)}</td>
                <td class="font-bold text-sm ${r.saldoDevedor > 0 ? (r.qtdNotasVencidas > 0 ? 'text-red-400' : 'text-amber-400') : 'text-emerald-400'}">
                    ${formatadorMoeda.format(r.saldoDevedor)}
                </td>
                <td>${badgeSituacao}</td>
                <td class="p-3 text-right space-x-1 whitespace-nowrap">${btnAcoes}</td>
            </tr>
        `;
    }
    corpo.innerHTML = html;

    // Auto-Soma no rodapé da carteira
    var rodape = document.getElementById('tabelaRodapeCarteiraAutoSoma');
    if (rodape) {
        rodape.classList.remove('hidden');
        var elSomaComprado = document.getElementById('autoSomaCarteiraComprado');
        var elSomaPago = document.getElementById('autoSomaCarteiraPago');
        var elSomaSaldo = document.getElementById('autoSomaCarteiraSaldo');
        if (elSomaComprado) elSomaComprado.innerText = formatadorMoeda.format(centavosParaReais(somaFiltroCompradoCent));
        if (elSomaPago) elSomaPago.innerText = formatadorMoeda.format(centavosParaReais(somaFiltroPagoCent));
        if (elSomaSaldo) elSomaSaldo.innerText = formatadorMoeda.format(centavosParaReais(somaFiltroSaldoCent));
    }
}

/**
 * Abre modal de cadastro ou edição de cliente.
 */
function abrirModalFormCliente(idClienteEditar, dadosOuNome) {
    var modal = document.getElementById('modalCadastroCliente');
    if (!modal) return;

    var inputId = document.getElementById('campoClienteId');
    var inputCodigo = document.getElementById('campoClienteCodigo');
    var inputNome = document.getElementById('campoClienteNome');
    var inputCpf = document.getElementById('campoClienteCpfCnpj');
    var inputTel = document.getElementById('campoClienteTelefone');
    var inputLimite = document.getElementById('campoClienteLimiteCredito');
    var inputEnd = document.getElementById('campoClienteEndereco');
    var inputObs = document.getElementById('campoClienteObservacao');
    var titulo = document.getElementById('tituloModalCadastroCliente');

    var c = null;
    if (idClienteEditar) {
        if (clientesMap && clientesMap[idClienteEditar]) {
            c = clientesMap[idClienteEditar];
        } else if (typeof resolverClienteEResumoPorIdentificador === 'function') {
            var resolv = resolverClienteEResumoPorIdentificador(idClienteEditar);
            if (resolv && resolv.cliente && !resolv.cliente.naoCadastrado) {
                c = resolv.cliente;
            }
        }
    }

    if (c) {
        if (titulo) titulo.innerText = 'Editar Cliente (' + (c.codigo || 'CLI') + ')';
        if (inputId) inputId.value = c.id;
        if (inputCodigo) inputCodigo.value = c.codigo || '';
        if (inputNome) inputNome.value = c.nome || '';
        if (inputCpf) inputCpf.value = c.cpfCnpj || '';
        if (inputTel) inputTel.value = c.telefone || '';
        if (inputLimite) inputLimite.value = c.limiteCredito ? String(c.limiteCredito).replace('.', ',') : '';
        if (inputEnd) inputEnd.value = c.endereco || '';
        if (inputObs) inputObs.value = c.observacao || '';
    } else {
        if (titulo) titulo.innerText = 'Novo Cliente';
        if (inputId) inputId.value = '';
        if (inputCodigo) inputCodigo.value = 'NOVO';
        if (typeof dadosOuNome === 'object' && dadosOuNome !== null) {
            if (inputNome) inputNome.value = dadosOuNome.nome || '';
            if (inputCpf) inputCpf.value = dadosOuNome.cpfCnpj || '';
            if (inputTel) inputTel.value = dadosOuNome.telefone || '';
            if (inputLimite) inputLimite.value = dadosOuNome.limiteCredito ? String(dadosOuNome.limiteCredito).replace('.', ',') : '';
            if (inputEnd) inputEnd.value = dadosOuNome.endereco || '';
            if (inputObs) inputObs.value = dadosOuNome.observacao || '';
        } else {
            if (inputNome) inputNome.value = (typeof dadosOuNome === 'string') ? dadosOuNome : '';
            if (inputCpf) inputCpf.value = '';
            if (inputTel) inputTel.value = '';
            if (inputLimite) inputLimite.value = '';
            if (inputEnd) inputEnd.value = '';
            if (inputObs) inputObs.value = '';
        }
    }

    modal.classList.remove('hidden');
}

/**
 * [FASE 6 / T-602] Abre o formulário de edição/cadastro para o cliente da Ficha aberta atualmente.
 */
function editarClienteDaFichaAtual() {
    if (!clienteIdFichaAtual) {
        if (typeof Swal !== 'undefined') Swal.fire('Aviso', 'Nenhum cliente selecionado para edição.', 'info');
        return;
    }
    var resolvido = (typeof resolverClienteEResumoPorIdentificador === 'function')
        ? resolverClienteEResumoPorIdentificador(clienteIdFichaAtual)
        : null;

    if (!resolvido || !resolvido.cliente) {
        if (typeof Swal !== 'undefined') Swal.fire('Aviso', 'Cliente não localizado para edição.', 'info');
        return;
    }

    var c = resolvido.cliente;
    if (c.naoCadastrado) {
        abrirModalFormCliente(null, {
            nome: c.nome || '',
            cpfCnpj: c.cpfCnpj || '',
            telefone: c.telefone || ''
        });
    } else {
        abrirModalFormCliente(c.id);
    }
}

function fecharModalFormCliente() {
    var modal = document.getElementById('modalCadastroCliente');
    if (modal) modal.classList.add('hidden');
}

/**
 * Salva ou atualiza cadastro de cliente no Firebase RTDB com blindagem e fallback.
 */
async function salvarCadastroClienteModal(e) {
    if (e && e.preventDefault) e.preventDefault();

    if (typeof garantirConexaoParaOperacaoFinanceira === 'function' && !garantirConexaoParaOperacaoFinanceira('Cadastro de Cliente')) {
        return;
    }

    var id = (document.getElementById('campoClienteId')?.value || '').trim();
    var nome = (document.getElementById('campoClienteNome')?.value || '').trim();
    var cpfCnpjRaw = (document.getElementById('campoClienteCpfCnpj')?.value || document.getElementById('cliInputCpfCnpj')?.value || '').trim();
    var telRaw = (document.getElementById('campoClienteTelefone')?.value || document.getElementById('cliInputTelefone')?.value || '').trim();
    var limiteRaw = (document.getElementById('campoClienteLimiteCredito')?.value || document.getElementById('cliInputLimiteCredito')?.value || '').trim();
    var endereco = (document.getElementById('campoClienteEndereco')?.value || '').trim();
    var observacao = (document.getElementById('campoClienteObservacao')?.value || '').trim();

    if (!nome || nome.length < 2) {
        Swal.fire('Atenção', 'Informe o nome do cliente (mínimo 2 caracteres).', 'warning');
        return;
    }

    var validDoc = validarEFormatarCpfCnpj(cpfCnpjRaw);
    if (!validDoc.valido) {
        Swal.fire('CPF / CNPJ Inválido', validDoc.erro, 'warning');
        return;
    }

    var validTel = normalizarTelefoneCliente(telRaw);
    if (!validTel.valido) {
        Swal.fire('Telefone / WhatsApp Inválido', validTel.erro, 'warning');
        return;
    }
    if (!validTel.opcionalVazio && validTel.limpo.length !== 11) {
        Swal.fire('Telefone / WhatsApp Inválido', 'O WhatsApp/Celular do cliente deve possuir obrigatoriamente 11 dígitos (DDD de 11 a 99 + 9 dígitos). Ex: (22) 99999-9999.', 'warning');
        return;
    }

    var limiteCredito = 0;
    if (limiteRaw) {
        limiteCredito = centavosParaReais(moedaParaCentavos(limiteRaw));
    }

    var operadorAtual = (typeof auth !== 'undefined' && auth.currentUser && auth.currentUser.email) ? auth.currentUser.email : 'Operador';
    var agoraISO = new Date().toISOString();

    try {
        if (id) {
            // Edição de cliente existente
            var dadosAtualizados = {
                id: id,
                nome: nome,
                cpfCnpj: validDoc.formatado || '',
                telefone: validTel.formatado || '',
                limiteCredito: limiteCredito || 0,
                endereco: endereco || '',
                observacao: observacao || '',
                atualizadoEm: agoraISO,
                atualizadoPor: operadorAtual
            };
            await database.ref('clientes/' + id).update(dadosAtualizados);
            fecharModalFormCliente();
            var modalFichaEdit = document.getElementById('modalFichaCliente');
            if (modalFichaEdit && !modalFichaEdit.classList.contains('hidden')) {
                abrirModalFichaCliente(id);
            }
            Swal.fire('Sucesso!', 'Dados do cliente atualizados com sucesso.', 'success');
        } else {
            // Criação de novo cliente com sequência atômica CLI-XXXX (com fallback seguro)
            var codigoNovo = await obterProximoCodigoCliente();
            var novaRef = database.ref('clientes').push();
            var novoId = novaRef.key;

            var novoCliente = {
                id: novoId,
                codigo: codigoNovo,
                nome: nome,
                cpfCnpj: validDoc.formatado || '',
                telefone: validTel.formatado || '',
                limiteCredito: limiteCredito || 0,
                endereco: endereco || '',
                observacao: observacao || '',
                criadoEm: agoraISO,
                criadoPor: operadorAtual
            };
            await novaRef.set(novoCliente);
            fecharModalFormCliente();
            var modalFichaNovo = document.getElementById('modalFichaCliente');
            if (modalFichaNovo && !modalFichaNovo.classList.contains('hidden')) {
                abrirModalFichaCliente(novoId);
            }
            Swal.fire('Cadastrado!', 'Cliente ' + codigoNovo + ' cadastrado com sucesso.', 'success');

            // Se o formulário de notas estiver aberto com esse nome, vincula automaticamente
            var inputClienteForm = document.getElementById('campoNotaCliente');
            var inputIdForm = document.getElementById('campoNotaClienteId');
            if (inputClienteForm && normalizarNomeCliente(inputClienteForm.value) === normalizarNomeCliente(nome)) {
                if (inputIdForm) inputIdForm.value = novoId;
                aoSelecionarOuDigitarClienteNota();
            }
        }
    } catch (err) {
        console.error('[Clientes] Erro ao salvar cliente:', err);
        Swal.fire('Erro', 'Falha ao salvar cliente: ' + (err.message || err), 'error');
    }
}

/**
 * Atualiza a ficha do cliente caso esteja aberta no momento da alteração de dados.
 */
function atualizarFichaClienteSeAberta(clienteId) {
    if (clienteIdFichaAtual && String(clienteIdFichaAtual) === String(clienteId)) {
        abrirModalFichaCliente(clienteIdFichaAtual);
    }
}

/**
 * Abre a Ficha Financeira Completa do Cliente com Auto-Soma e Ações Rápidas.
 */
function abrirModalFichaCliente(clienteIdOuChave) {
    var modal = document.getElementById('modalFichaCliente');
    if (!modal) return;

    var notasRef = (typeof listaGlobalNotasPrazo !== 'undefined') ? listaGlobalNotasPrazo : [];
    var resolvido = (typeof resolverClienteEResumoPorIdentificador === 'function')
        ? resolverClienteEResumoPorIdentificador(clienteIdOuChave)
        : null;

    if (!resolvido || !resolvido.cliente) {
        Swal.fire('Aviso', 'Cliente não localizado.', 'info');
        return;
    }

    var cliente = resolvido.cliente;
    clienteIdFichaAtual = cliente.id || cliente.codigo || clienteIdOuChave;
    var resumo = resolvido.resumoCarteira || calcularResumoCarteiraCliente(cliente, notasRef);

    // [FASE 6 / T-601] Vinculação explícita dos botões de ação do cabeçalho da Ficha
    var btnZapTodas = document.getElementById('btnFichaWhatsAppTodasNotas');
    var btnZapExtrato = document.getElementById('btnFichaWhatsAppExtrato');
    var btnZapCobranca = document.getElementById('btnFichaWhatsAppCobranca');
    var btnPrintExtrato = document.getElementById('btnFichaImprimirExtrato');
    var btnEditar = document.getElementById('btnFichaEditarCliente');

    if (btnZapTodas) {
        btnZapTodas.onclick = function() { enviarWhatsAppTodasNotasCliente(clienteIdFichaAtual); };
    }
    if (btnZapExtrato) {
        btnZapExtrato.onclick = function() { enviarWhatsAppExtratoCliente(clienteIdFichaAtual); };
    }
    if (btnZapCobranca) {
        btnZapCobranca.onclick = function() { enviarWhatsAppCobrancaCliente(clienteIdFichaAtual); };
    }
    if (btnPrintExtrato) {
        btnPrintExtrato.onclick = function() {
            if (typeof dispararImpressaoExtratoClienteA4 === 'function') {
                dispararImpressaoExtratoClienteA4(clienteIdFichaAtual);
            } else if (typeof imprimirExtratoClienteA4 === 'function') {
                imprimirExtratoClienteA4(clienteIdFichaAtual);
            }
        };
    }
    if (btnEditar) {
        btnEditar.onclick = function() { editarClienteDaFichaAtual(); };
    }

    // Cabeçalho da Ficha
    var elNome = document.getElementById('fichaClienteNome');
    var elCodigo = document.getElementById('fichaClienteCodigo');
    var elDoc = document.getElementById('fichaClienteDocumento');
    var elTel = document.getElementById('fichaClienteTelefone');
    var elEnd = document.getElementById('fichaClienteEndereco');
    var elObs = document.getElementById('fichaClienteObservacao');

    if (elNome) elNome.innerText = cliente.nome;
    if (elCodigo) elCodigo.innerText = cliente.codigo || 'N/C';
    if (elDoc) elDoc.innerText = cliente.cpfCnpj ? 'CPF/CNPJ: ' + cliente.cpfCnpj : 'Documento não informado';
    if (elTel) elTel.innerText = cliente.telefone ? '📞 ' + cliente.telefone : 'Telefone não informado';
    if (elEnd) elEnd.innerText = cliente.endereco ? '📍 ' + cliente.endereco : '';
    if (elObs) elObs.innerText = cliente.observacao ? 'Observações: ' + cliente.observacao : '';

    // KPIs da Ficha
    var elKpiComprado = document.getElementById('fichaKpiTotalComprado');
    var elKpiPago = document.getElementById('fichaKpiTotalPago');
    var elKpiSaldo = document.getElementById('fichaKpiSaldoDevedor');
    var elKpiLimite = document.getElementById('fichaKpiLimiteCredito');

    if (elKpiComprado) elKpiComprado.innerText = formatadorMoeda.format(resumo.totalEmitidoLiquido);
    if (elKpiPago) elKpiPago.innerText = formatadorMoeda.format(resumo.totalRecebido);
    if (elKpiSaldo) {
        elKpiSaldo.innerText = formatadorMoeda.format(resumo.saldoDevedor);
        elKpiSaldo.className = 'text-xl font-extrabold ' + (resumo.saldoDevedor > 0 ? (resumo.qtdNotasVencidas > 0 ? 'text-red-400' : 'text-amber-400') : 'text-emerald-400');
    }
    if (elKpiLimite) {
        if (resumo.limiteCredito > 0) {
            elKpiLimite.innerText = formatadorMoeda.format(resumo.limiteCredito) + ' (Disp: ' + formatadorMoeda.format(resumo.limiteDisponivel) + ')';
        } else {
            elKpiLimite.innerText = 'Sem Limite';
        }
    }

    // Tabela de Notas do Cliente
    var corpoNotas = document.getElementById('tabelaCorpoFichaNotasCliente');
    if (corpoNotas) {
        if (resumo.notasDoCliente.length === 0) {
            corpoNotas.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-slate-400 italic">Nenhuma nota emitida para este cliente.</td></tr>';
        } else {
            var htmlNotas = '';
            for (var i = 0; i < resumo.notasDoCliente.length; i++) {
                var n = resumo.notasDoCliente[i];
                var sit = obterSituacaoNotaSegura(n);
                var vOrig = parseFloat(n.valorOriginal) || 0;

                var badgeStatus = '';
                if (sit.statusFinanceiro === 'CANCELADA') {
                    badgeStatus = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-slate-400">CANCELADA</span>';
                } else if (sit.statusFinanceiro === 'QUITADA') {
                    badgeStatus = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400">QUITADA</span>';
                } else if (sit.indicadorCobranca === 'VENCIDA') {
                    badgeStatus = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400">VENCIDA</span>';
                } else if (sit.indicadorCobranca === 'VENCENDO') {
                    badgeStatus = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/20 text-yellow-300">VENCENDO</span>';
                } else {
                    badgeStatus = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400">ABERTA</span>';
                }

                var temPagto = sit.totalRecebido > 0;
                var podeBaixar = sit.saldo > 0 && sit.statusFinanceiro !== 'CANCELADA';

                htmlNotas += `
                    <tr class="border-b border-slate-700/30 hover:bg-slate-800/50 transition">
                        <td class="p-2.5 font-mono text-indigo-400 font-bold text-xs">${nucleoEscapeHtml(n.numeroControle || n.id)}</td>
                        <td class="text-xs text-slate-300">${fD(n.dataEmissao)}</td>
                        <td class="text-xs font-semibold ${sit.indicadorCobranca === 'VENCIDA' ? 'text-red-400' : 'text-slate-300'}">${fD(n.dataVencimento)}</td>
                        <td class="text-xs font-semibold text-slate-200">${formatadorMoeda.format(vOrig)}</td>
                        <td class="text-xs font-semibold text-emerald-400">${formatadorMoeda.format(sit.totalRecebido)}</td>
                        <td class="text-xs font-bold ${sit.saldo > 0 ? (sit.indicadorCobranca === 'VENCIDA' ? 'text-red-400' : 'text-amber-400') : 'text-emerald-400'}">${formatadorMoeda.format(sit.saldo)}</td>
                        <td>${badgeStatus}</td>
                        <td class="p-2.5 text-right space-x-1 whitespace-nowrap">
                            ${podeBaixar ? `<button onclick="fecharModalFichaCliente(); abrirModalBaixaNota('${nucleoEscapeHtml(n.id)}')" class="bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 rounded text-xs font-bold text-white transition shadow inline-flex items-center gap-1" title="Registrar Pagamento / Baixar Nota">💵 Baixar</button>` : ''}
                            <button onclick="imprimirReciboOuComprovanteVendaLinha('${nucleoEscapeHtml(n.id)}')" class="bg-indigo-600 hover:bg-indigo-500 px-2.5 py-1 rounded text-xs font-bold text-white transition shadow inline-flex items-center gap-1" title="Imprimir Recibo de Pagamento desta Venda">🧾 Recibo</button>
                            <button onclick="imprimirNotaPrazoA4('${nucleoEscapeHtml(n.id)}')" class="bg-slate-700 hover:bg-slate-600 px-2.5 py-1 rounded text-xs font-bold text-white transition shadow inline-flex items-center gap-1" title="Imprimir Comprovante da Nota em A4">🖨️ Nota</button>
                            <button onclick="abrirModalExtratoNota('${nucleoEscapeHtml(n.id)}')" class="p-1.5 rounded hover:bg-slate-700 text-xs transition" title="Ver Extrato e Histórico">📋</button>
                            <button onclick="enviarWhatsAppNota('${nucleoEscapeHtml(n.id)}')" class="p-1.5 rounded hover:bg-emerald-900/60 text-emerald-400 text-xs transition" title="Enviar no WhatsApp">📲</button>
                        </td>
                    </tr>
                `;
            }
            corpoNotas.innerHTML = htmlNotas;

            var elSomaNotasOrig = document.getElementById('fichaAutoSomaNotasOriginal');
            var elSomaNotasPago = document.getElementById('fichaAutoSomaNotasPago');
            var elSomaNotasSaldo = document.getElementById('fichaAutoSomaNotasSaldo');
            if (elSomaNotasOrig) elSomaNotasOrig.innerText = formatadorMoeda.format(resumo.totalEmitidoLiquido);
            if (elSomaNotasPago) elSomaNotasPago.innerText = formatadorMoeda.format(resumo.totalRecebido);
            if (elSomaNotasSaldo) elSomaNotasSaldo.innerText = formatadorMoeda.format(resumo.saldoDevedor);
        }
    }

    // Tabela de Histórico de Pagamentos do Cliente
    var corpoPagtos = document.getElementById('tabelaCorpoFichaPagamentosCliente');
    if (corpoPagtos) {
        if (resumo.pagamentosDoCliente.length === 0) {
            corpoPagtos.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-400 italic">Nenhum pagamento registrado para este cliente até o momento.</td></tr>';
        } else {
            var htmlPagtos = '';
            for (var k = 0; k < resumo.pagamentosDoCliente.length; k++) {
                var p = resumo.pagamentosDoCliente[k];
                htmlPagtos += `
                    <tr class="border-b border-slate-700/30 hover:bg-slate-800/50 transition">
                        <td class="p-2.5 font-mono text-indigo-400 font-bold text-xs">${nucleoEscapeHtml(p.numeroRecibo || '-')}</td>
                        <td class="text-xs text-slate-300">${fD(p.dataPagamento)}</td>
                        <td class="text-xs font-mono text-slate-400">${nucleoEscapeHtml(p.notaNumeroControle || '-')}</td>
                        <td class="text-xs text-slate-300">${nucleoEscapeHtml(p.formaPagamento || 'Dinheiro')}</td>
                        <td class="text-xs font-bold text-emerald-400">${formatadorMoeda.format(parseFloat(p.valor) || 0)}</td>
                        <td class="p-2.5 text-right whitespace-nowrap">
                            <button onclick="imprimirReciboPagamentoA4('${nucleoEscapeHtml(p.notaId)}', '${nucleoEscapeHtml(p.id)}')" class="bg-slate-700 hover:bg-slate-600 px-2 py-0.5 rounded text-[11px] font-bold text-white transition">🧾 Imprimir Recibo</button>
                            <button onclick="enviarWhatsAppReciboNota('${nucleoEscapeHtml(p.notaId)}', '${nucleoEscapeHtml(p.id)}')" class="bg-emerald-700 hover:bg-emerald-600 px-2 py-0.5 rounded text-[11px] font-bold text-white transition ml-1" title="Enviar no WhatsApp">📲 Zap</button>
                        </td>
                    </tr>
                `;
            }
            corpoPagtos.innerHTML = htmlPagtos;
        }
    }

    modal.classList.remove('hidden');
}

function fecharModalFichaCliente() {
    var modal = document.getElementById('modalFichaCliente');
    if (modal) modal.classList.add('hidden');
    clienteIdFichaAtual = null;
}

/**
 * Imprime extrato consolidado do cliente em meia folha ou A4.
 */
function imprimirExtratoClienteA4(clienteIdOuChave) {
    if (typeof dispararImpressaoExtratoClienteA4 === 'function') {
        dispararImpressaoExtratoClienteA4(clienteIdOuChave);
        return;
    }
    var notasRef = (typeof listaGlobalNotasPrazo !== 'undefined') ? listaGlobalNotasPrazo : [];
    var cliente = clientesMap[clienteIdOuChave];
    if (!cliente) {
        var notaSample = notasRef.find(function(n) {
            return n.id === clienteIdOuChave ||
                   ('avulso_' + (normalizarNomeCliente(n.cliente) || '').toLowerCase().replace(/[^a-z0-9]/g, '_')) === clienteIdOuChave;
        });
        if (notaSample) {
            cliente = {
                id: clienteIdOuChave,
                codigo: 'N/C',
                nome: notaSample.cliente || 'Cliente Avulso',
                cpfCnpj: notaSample.cpfCnpj || '',
                telefone: notaSample.telefone || '',
                limiteCredito: 0
            };
        }
    }
    if (!cliente) return;

    var resumo = calcularResumoCarteiraCliente(cliente, notasRef);
    var area = document.getElementById('areaImpressaoFinal');
    if (!area) return;

    var hojeExtenso = obterDataLocalISO();

    var linhasNotasHtml = '';
    for (var i = 0; i < resumo.notasDoCliente.length; i++) {
        var n = resumo.notasDoCliente[i];
        var sit = obterSituacaoNotaSegura(n);
        linhasNotasHtml += `
            <tr style="border-bottom:1px solid #cbd5e1;">
                <td style="padding:5px 6px; font-family:monospace; font-weight:bold;">${nucleoEscapeHtml(n.numeroControle || n.id)}</td>
                <td style="padding:5px 6px;">${fD(n.dataEmissao)}</td>
                <td style="padding:5px 6px;">${fD(n.dataVencimento)}</td>
                <td style="padding:5px 6px; text-align:right;">${formatadorMoeda.format(parseFloat(n.valorOriginal) || 0)}</td>
                <td style="padding:5px 6px; text-align:right; color:#15803d;">${formatadorMoeda.format(sit.totalRecebido)}</td>
                <td style="padding:5px 6px; text-align:right; font-weight:bold; color:${sit.saldo > 0 ? '#b91c1c' : '#15803d'};">${formatadorMoeda.format(sit.saldo)}</td>
                <td style="padding:5px 6px; text-align:center; font-size:9px;">${sit.statusConsolidado}</td>
            </tr>
        `;
    }

    var linhasPagtosHtml = '';
    if (resumo.pagamentosDoCliente.length > 0) {
        for (var j = 0; j < resumo.pagamentosDoCliente.length; j++) {
            var p = resumo.pagamentosDoCliente[j];
            linhasPagtosHtml += `
                <tr style="border-bottom:1px dotted #cbd5e1;">
                    <td style="padding:4px 6px; font-family:monospace;">${nucleoEscapeHtml(p.numeroRecibo || '-')}</td>
                    <td style="padding:4px 6px;">${fD(p.dataPagamento)}</td>
                    <td style="padding:4px 6px; font-family:monospace;">${nucleoEscapeHtml(p.notaNumeroControle || '-')}</td>
                    <td style="padding:4px 6px;">${nucleoEscapeHtml(p.formaPagamento || 'Dinheiro')}</td>
                    <td style="padding:4px 6px; text-align:right; font-weight:bold; color:#15803d;">${formatadorMoeda.format(parseFloat(p.valor) || 0)}</td>
                </tr>
            `;
        }
    }

    area.innerHTML = `
        <div class="a4-print-full">
            <div>
                <div style="text-align:center; border-bottom:2px solid #000; padding-bottom:12px; margin-bottom:16px;">
                    <h1 style="font-size:20px !important; letter-spacing:1px; margin:0;">TUCANO AUTO PEÇAS</h1>
                    <p style="font-size:11px !important; margin:2px 0; color:#333;">Comércio de Peças e Acessórios Automotivos</p>
                    <h2 style="font-size:16px !important; margin-top:8px; text-transform:uppercase; font-weight:900;">
                        EXTRATO DA CONTA CORRENTE DO CLIENTE
                    </h2>
                </div>

                <div style="display:flex; justify-content:space-between; background:#f1f5f9; padding:10px 14px; border:1px solid #cbd5e1; border-radius:6px; margin-bottom:16px;">
                    <div>
                        <span style="font-size:10px; color:#64748b;">CLIENTE:</span><br>
                        <strong style="font-size:15px; color:#1e293b;">${nucleoEscapeHtml(cliente.nome)}</strong><br>
                        <span style="font-size:11px; color:#475569;">${cliente.codigo ? 'Código: ' + nucleoEscapeHtml(cliente.codigo) : ''} ${cliente.cpfCnpj ? ' • ' + nucleoEscapeHtml(cliente.cpfCnpj) : ''}</span>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:10px; color:#64748b;">EMISSÃO DO EXTRATO:</span><br>
                        <strong style="font-size:13px;">${fD(hojeExtenso)}</strong><br>
                        <span style="font-size:11px; color:#475569;">${cliente.telefone ? '📞 ' + nucleoEscapeHtml(cliente.telefone) : ''}</span>
                    </div>
                </div>

                <div style="display:flex; gap:10px; margin-bottom:16px;">
                    <div style="flex:1; border:1.5px solid #64748b; padding:8px; text-align:center; border-radius:6px;">
                        <div style="font-size:10px; font-weight:bold; text-transform:uppercase;">TOTAL COMPRADO</div>
                        <div style="font-size:16px; font-weight:bold; margin-top:2px;">${formatadorMoeda.format(resumo.totalEmitidoLiquido)}</div>
                    </div>
                    <div style="flex:1; border:1.5px solid #16a34a; padding:8px; text-align:center; border-radius:6px; background:#f0fdf4;">
                        <div style="font-size:10px; font-weight:bold; text-transform:uppercase; color:#15803d;">TOTAL JÁ PAGO</div>
                        <div style="font-size:16px; font-weight:bold; color:#15803d; margin-top:2px;">${formatadorMoeda.format(resumo.totalRecebido)}</div>
                    </div>
                    <div style="flex:1.2; border:2.5px solid ${resumo.saldoDevedor > 0 ? '#dc2626' : '#16a34a'}; padding:8px; text-align:center; border-radius:6px; background:${resumo.saldoDevedor > 0 ? '#fef2f2' : '#f0fdf4'};">
                        <div style="font-size:10px; font-weight:900; text-transform:uppercase; color:${resumo.saldoDevedor > 0 ? '#b91c1c' : '#15803d'};">SALDO DEVEDOR ATUAL</div>
                        <div style="font-size:20px; font-weight:900; color:${resumo.saldoDevedor > 0 ? '#b91c1c' : '#15803d'}; margin-top:2px;">${formatadorMoeda.format(resumo.saldoDevedor)}</div>
                    </div>
                </div>

                <div style="margin-bottom:16px;">
                    <strong style="font-size:11px; text-transform:uppercase; color:#1e293b;">Demonstrativo de Notas a Prazo (${resumo.notasDoCliente.length} registros):</strong>
                    <table style="width:100%; border-collapse:collapse; margin-top:4px; font-size:10.5px;">
                        <thead>
                            <tr style="background:#e2e8f0; border-bottom:2px solid #94a3b8; text-align:left;">
                                <th style="padding:6px;">Nº Nota</th>
                                <th style="padding:6px;">Emissão</th>
                                <th style="padding:6px;">Vencimento</th>
                                <th style="padding:6px; text-align:right;">Valor Orig.</th>
                                <th style="padding:6px; text-align:right;">Pago</th>
                                <th style="padding:6px; text-align:right;">Saldo</th>
                                <th style="padding:6px; text-align:center;">Situação</th>
                            </tr>
                        </thead>
                        <tbody>${linhasNotasHtml}</tbody>
                        <tfoot>
                            <tr style="background:#f8fafc; font-weight:bold; border-top:2px solid #000;">
                                <td colspan="3" style="padding:6px;">TOTALIZADOR:</td>
                                <td style="padding:6px; text-align:right;">${formatadorMoeda.format(resumo.totalEmitidoLiquido)}</td>
                                <td style="padding:6px; text-align:right; color:#15803d;">${formatadorMoeda.format(resumo.totalRecebido)}</td>
                                <td style="padding:6px; text-align:right; color:${resumo.saldoDevedor > 0 ? '#b91c1c' : '#15803d'};">${formatadorMoeda.format(resumo.saldoDevedor)}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                ${resumo.pagamentosDoCliente.length > 0 ? `
                    <div style="margin-bottom:16px;">
                        <strong style="font-size:11px; text-transform:uppercase; color:#1e293b;">Histórico de Baixas e Pagamentos Realizados (${resumo.pagamentosDoCliente.length}):</strong>
                        <table style="width:100%; border-collapse:collapse; margin-top:4px; font-size:10px;">
                            <thead>
                                <tr style="background:#f1f5f9; border-bottom:1px solid #94a3b8; text-align:left;">
                                    <th style="padding:4px 6px;">Recibo</th>
                                    <th style="padding:4px 6px;">Data</th>
                                    <th style="padding:4px 6px;">Nota Ref.</th>
                                    <th style="padding:4px 6px;">Forma</th>
                                    <th style="padding:4px 6px; text-align:right;">Valor</th>
                                </tr>
                            </thead>
                            <tbody>${linhasPagtosHtml}</tbody>
                        </table>
                    </div>
                ` : ''}

                ${resumo.saldoDevedor > 0 ? `
                    <div style="padding:10px; border:1px solid #94a3b8; background:#f8fafc; font-size:10.5px; border-radius:6px; margin-top:20px;">
                        Declaramos que o saldo pendente de pagamento apurado nesta data é de <strong>${formatadorMoeda.format(resumo.saldoDevedor)} (${valorPorExtensoBRL(resumo.saldoDevedor)})</strong>.
                    </div>
                ` : ''}
            </div>

            <div style="display:flex; justify-content:space-between; margin-top:40px; padding-bottom:15px;">
                <div class="linha-assinatura-a4">
                    <strong>TUCANO AUTO PEÇAS</strong><br>
                    <span>Responsável Financeiro</span>
                </div>
                <div class="linha-assinatura-a4">
                    <strong>${nucleoEscapeHtml(cliente.nome)}</strong><br>
                    <span>Assinatura do Cliente</span>
                </div>
            </div>
        </div>
    `;

    setTimeout(function() { window.print(); }, 300);
}

/**
 * Abre o modal para conciliação em lote de notas antigas órfãs.
 */
function abrirModalConciliacaoClientes() {
    var modal = document.getElementById('modalConciliacaoClientes');
    if (!modal) return;

    var notasRef = (typeof listaGlobalNotasPrazo !== 'undefined') ? listaGlobalNotasPrazo : [];
    var sugestoes = gerarSugestoesConciliacaoClientes(clientesMap, notasRef);

    var corpo = document.getElementById('tabelaCorpoConciliacaoClientes');
    var btnConfirmar = document.getElementById('btnExecutarConciliacaoClientes');

    if (!corpo) return;

    if (sugestoes.length === 0) {
        corpo.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-emerald-400 font-bold">🎉 Todas as notas a prazo já estão vinculadas a clientes cadastrados!</td></tr>';
        if (btnConfirmar) btnConfirmar.disabled = true;
    } else {
        var html = '';
        for (var i = 0; i < sugestoes.length; i++) {
            var s = sugestoes[i];
            var statusMatch = s.clienteExistenteId
                ? '<span class="text-emerald-400 font-bold">✓ Vincular a ' + nucleoEscapeHtml(s.clienteExistenteNome) + ' (' + s.clienteExistenteCodigo + ')</span>'
                : '<span class="text-amber-400 font-bold">➕ Criar Novo Cliente Oficial</span>';

            html += `
                <tr class="border-b border-slate-700/30">
                    <td class="p-3 font-semibold text-slate-100">${nucleoEscapeHtml(s.nomeSugerido)}</td>
                    <td class="text-xs text-slate-400">${nucleoEscapeHtml(s.cpfCnpjSugerido || '-')}</td>
                    <td class="text-xs font-bold text-center text-indigo-400">${s.qtdNotas} nota(s)</td>
                    <td class="text-xs font-bold text-right text-slate-200">${formatadorMoeda.format(s.somaValorOriginal)}</td>
                    <td class="text-xs">${statusMatch}</td>
                </tr>
            `;
        }
        corpo.innerHTML = html;
        if (btnConfirmar) btnConfirmar.disabled = false;
    }

    modal.classList.remove('hidden');
}

function fecharModalConciliacaoClientes() {
    var modal = document.getElementById('modalConciliacaoClientes');
    if (modal) modal.classList.add('hidden');
}

/**
 * Executa a conciliação atômica e não-destrutiva de notas no Firebase.
 */
async function executarConciliacaoClientesConfirmada() {
    if (typeof garantirConexaoParaOperacaoFinanceira === 'function' && !garantirConexaoParaOperacaoFinanceira('Conciliação de Clientes')) {
        return;
    }

    var notasRef = (typeof listaGlobalNotasPrazo !== 'undefined') ? listaGlobalNotasPrazo : [];
    var sugestoes = gerarSugestoesConciliacaoClientes(clientesMap, notasRef);

    if (sugestoes.length === 0) {
        Swal.fire('Informação', 'Não há notas órfãs pendentes de vinculação.', 'info');
        return;
    }

    var btn = document.getElementById('btnExecutarConciliacaoClientes');
    var txtOrig = btn ? btn.innerHTML : 'Vincular';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = 'Processando Conciliação...';
    }

    try {
        var operadorAtual = (typeof auth !== 'undefined' && auth.currentUser && auth.currentUser.email) ? auth.currentUser.email : 'Operador';
        var agoraISO = new Date().toISOString();
        var updates = {};

        for (var i = 0; i < sugestoes.length; i++) {
            var s = sugestoes[i];
            var idClienteDestino = s.clienteExistenteId;

            if (!idClienteDestino) {
                // Cria o cliente no banco
                var codigoNovo = await obterProximoCodigoCliente();
                var refNova = database.ref('clientes').push();
                idClienteDestino = refNova.key;

                updates['clientes/' + idClienteDestino] = {
                    id: idClienteDestino,
                    codigo: codigoNovo,
                    nome: s.nomeSugerido,
                    cpfCnpj: s.cpfCnpjSugerido || '',
                    telefone: s.telefoneSugerido || '',
                    limiteCredito: 0,
                    criadoEm: agoraISO,
                    criadoPor: operadorAtual,
                    origemConciliacao: true
                };
            }

            // Atualiza cada nota órfã com clienteId
            for (var j = 0; j < s.notasIds.length; j++) {
                var notaId = s.notasIds[j];
                updates['notasPrazo/' + notaId + '/clienteId'] = idClienteDestino;
                updates['notasPrazo/' + notaId + '/conciliadoEm'] = agoraISO;
                updates['notasPrazo/' + notaId + '/conciliadoPor'] = operadorAtual;
            }
        }

        await database.ref().update(updates);
        fecharModalConciliacaoClientes();
        Swal.fire('Conciliação Concluída!', 'Todas as notas foram vinculadas aos seus respectivos clientes com sucesso!', 'success');
        atualizarTabelaCarteiraClientes();
    } catch (err) {
        console.error(err);
        Swal.fire('Erro', 'Falha ao executar conciliação: ' + err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = txtOrig;
        }
    }
}

// Export para testes em ambiente Node.js / VM
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        normalizarNomeCliente: normalizarNomeCliente,
        limparDigitosDocumento: limparDigitosDocumento,
        validarCPF: validarCPF,
        validarCNPJ: validarCNPJ,
        validarEFormatarCpfCnpj: validarEFormatarCpfCnpj,
        normalizarTelefoneCliente: normalizarTelefoneCliente,
        formatarTelefoneEmTempoReal: formatarTelefoneEmTempoReal,
        formatarCpfCnpjEmTempoReal: formatarCpfCnpjEmTempoReal,
        definirPrazoRapidoNota: definirPrazoRapidoNota,
        aoSelecionarClientePeloSelect: aoSelecionarClientePeloSelect,
        atualizarSelectClientesCadastrados: atualizarSelectClientesCadastrados,
        notaPertenceAoCliente: notaPertenceAoCliente,
        calcularResumoCarteiraCliente: calcularResumoCarteiraCliente,
        consolidarCarteiraGeralClientes: consolidarCarteiraGeralClientes,
        gerarSugestoesConciliacaoClientes: gerarSugestoesConciliacaoClientes,
        obterProximoCodigoCliente: obterProximoCodigoCliente,
        resolverClienteEResumoPorIdentificador: resolverClienteEResumoPorIdentificador,
        obterClientePorIdOuChave: obterClientePorIdOuChave,
        editarClienteDaFichaAtual: editarClienteDaFichaAtual
    };
}
