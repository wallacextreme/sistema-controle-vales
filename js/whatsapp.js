// =========================================================================
// MÓDULO DE COMUNICAÇÃO WHATSAPP & CENTRAL DE LEMBRETES/COBRANÇA (FASE 4 / T-401)
// Tucano Cloud — Tucano Auto Peças
//
// REGRAS PERMANENTES DE BLINDAGEM (AGENTS.md):
// 1. Somente 'function nome(...) {}' e 'var NOME = ...;' no nível superior (compatível com vm.runInContext).
// 2. Proibido const, let ou class no topo do arquivo.
// 3. Proibido acessar window, document, database, auth, Swal ou localStorage no topo do arquivo.
// 4. Todas as rotinas monetárias utilizam o núcleo financeiro seguro em centavos inteiros.
// =========================================================================

// =========================================================================
// PARTE 1: FUNÇÕES PURAS DE FORMATAÇÃO DE MENSAGENS E URLS (VM-SAFE)
// =========================================================================

/**
 * Constrói as URLs e parâmetros de disparo para WhatsApp (Web e Protocolo Nativo).
 */
function construirUrlWhatsApp(telefoneBruto, textoMensagem) {
    var msg = (textoMensagem !== undefined && textoMensagem !== null) ? String(textoMensagem) : '';
    var telLimpo = '';
    var waNumber = '';
    var telFmt = '';

    if (typeof normalizarTelefoneCliente === 'function') {
        var norm = normalizarTelefoneCliente(telefoneBruto);
        if (norm.valido && !norm.opcionalVazio) {
            waNumber = norm.waNumber;
            telFmt = norm.formatado;
            telLimpo = norm.limpo;
        }
    } else {
        var digitos = String(telefoneBruto || '').replace(/\D/g, '');
        if (digitos.indexOf('55') === 0 && (digitos.length === 12 || digitos.length === 13)) {
            digitos = digitos.slice(2);
        }
        if (digitos.length === 10 || digitos.length === 11) {
            telLimpo = digitos;
            waNumber = '55' + digitos;
            telFmt = (digitos.length === 11)
                ? digitos.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
                : digitos.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
        }
    }

    if (!waNumber) {
        return {
            valido: false,
            waNumber: '',
            telefoneFormatado: String(telefoneBruto || '').trim(),
            urlWeb: '',
            urlProtocolo: '',
            textoMensagem: msg,
            erro: 'Número de telefone inválido ou não informado (necessário DDD + 8 ou 9 dígitos).'
        };
    }

    var msgEncoded = encodeURIComponent(msg);
    return {
        valido: true,
        waNumber: waNumber,
        telefoneFormatado: telFmt || waNumber,
        urlWeb: 'https://wa.me/' + waNumber + '?text=' + msgEncoded,
        urlProtocolo: 'whatsapp://send?phone=' + waNumber + '&text=' + msgEncoded,
        textoMensagem: msg,
        erro: null
    };
}

/**
 * Helper interno para formatação de moeda em mensagens de texto.
 */
function formatarMoedaTextoZap(valor) {
    if (typeof centavosParaReais === 'function' && typeof moedaParaCentavos === 'function') {
        var centavos = moedaParaCentavos(valor);
        var reais = centavosParaReais(centavos);
        return 'R$ ' + reais.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    var num = parseFloat(valor) || 0;
    return 'R$ ' + num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Helper interno para formatação de datas YYYY-MM-DD em DD/MM/YYYY.
 */
function formatarDataTextoZap(dataStr) {
    if (!dataStr) return '-';
    var s = String(dataStr).split('T')[0];
    var p = s.split('-');
    if (p.length === 3) return p[2] + '/' + p[1] + '/' + p[0];
    return s;
}

/**
 * Helper interno seguro para obter o saldo e situação da nota com fallback autônomo.
 */
function calcularSituacaoNotaSeguraZap(nota, dataReferenciaISO) {
    if (typeof calcularSituacaoNota === 'function') {
        return calcularSituacaoNota(nota, dataReferenciaISO);
    }
    var n = (nota && typeof nota === 'object') ? nota : {};
    var vOrig = parseFloat(n.valorOriginal) || 0;
    var pagtos = [];
    if (typeof extrairPagamentosNota === 'function') {
        pagtos = extrairPagamentosNota(n);
    } else if (n.pagamentos) {
        pagtos = Array.isArray(n.pagamentos) ? n.pagamentos : Object.values(n.pagamentos);
    }
    var totalPago = 0;
    for (var i = 0; i < pagtos.length; i++) {
        if (pagtos[i] && pagtos[i].status !== 'ESTORNADO') {
            totalPago += parseFloat(pagtos[i].valor) || 0;
        }
    }
    var saldo = Math.max(0, Math.round((vOrig - totalPago) * 100) / 100);
    var statusFin = n.status || (saldo <= 0 ? 'QUITADA' : (totalPago > 0 ? 'PARCIAL' : 'ABERTA'));
    return {
        saldo: saldo,
        totalPago: totalPago,
        totalRecebido: totalPago,
        statusFinanceiro: statusFin,
        indicadorCobranca: ''
    };
}

/**
 * Gera mensagem cordial de confirmação na emissão de Nota a Prazo.
 */
function gerarMensagemWhatsAppEmissaoNota(nota, configEmpresa) {
    var n = (nota && typeof nota === 'object') ? nota : {};
    var cfg = (configEmpresa && typeof configEmpresa === 'object') ? configEmpresa : {};
    var empNome = (cfg.nomeFantasia && String(cfg.nomeFantasia).trim()) || 'TUCANO AUTO PEÇAS';
    var clienteNome = (n.cliente && String(n.cliente).trim()) || 'Cliente';
    var numNota = n.numeroControle || n.id || '-';
    var valorOrig = formatarMoedaTextoZap(n.valorOriginal);
    var vencimento = formatarDataTextoZap(n.dataVencimento);
    var emissao = formatarDataTextoZap(n.dataEmissao);
    var rodape = cfg.rodapeDocumentos || 'Agradecemos pela preferência e confiança!';

    var linhas = [
        '🚗 *' + empNome + '*',
        'Olá, *' + clienteNome + '*!',
        '',
        'Confirmamos a emissão da sua *Nota a Prazo* em nosso sistema:',
        '📄 *Nº da Nota:* #' + numNota,
        '📅 *Data da Compra:* ' + emissao,
        '💵 *Valor Total:* ' + valorOrig,
        '⏰ *Data de Vencimento:* ' + vencimento
    ];

    if (n.numeroPedido || n.numeroDocumento) {
        linhas.push('📦 *Pedido/Doc:* ' + (n.numeroPedido || n.numeroDocumento));
    }

    if (cfg.chavePix && String(cfg.chavePix).trim()) {
        linhas.push('');
        linhas.push('💳 *Chave PIX para Pagamento:*');
        linhas.push('🔑 `' + String(cfg.chavePix).trim() + '` (' + (cfg.tipoChavePix || 'Chave PIX') + ')');
        if (cfg.titularPix) {
            linhas.push('👤 *Titular:* ' + cfg.titularPix);
        }
    }

    linhas.push('');
    linhas.push(rodape);

    return linhas.join('\n');
}

/**
 * Gera mensagem de comprovante de recebimento de pagamento ou quitação.
 */
function gerarMensagemWhatsAppReciboPagamento(nota, idPagamento, configEmpresa) {
    var n = (nota && typeof nota === 'object') ? nota : {};
    var cfg = (configEmpresa && typeof configEmpresa === 'object') ? configEmpresa : {};
    var empNome = (cfg.nomeFantasia && String(cfg.nomeFantasia).trim()) || 'TUCANO AUTO PEÇAS';
    var clienteNome = (n.cliente && String(n.cliente).trim()) || 'Cliente';
    var numNota = n.numeroControle || n.id || '-';

    var pagtos = [];
    if (typeof extrairPagamentosNota === 'function') {
        pagtos = extrairPagamentosNota(n);
    } else if (n.pagamentos) {
        pagtos = Array.isArray(n.pagamentos) ? n.pagamentos : Object.values(n.pagamentos);
    }

    var pagto = null;
    if (idPagamento) {
        pagto = pagtos.find(function(p) { return p && String(p.id) === String(idPagamento); });
    }
    if (!pagto && pagtos.length > 0) {
        pagto = pagtos[pagtos.length - 1];
    }

    if (!pagto) {
        return 'Nenhum pagamento localizado para esta nota.';
    }

    if (pagto.status === 'ESTORNADO') {
        return [
            '🚗 *' + empNome + '*',
            'Olá, *' + clienteNome + '*!',
            '',
            '⚠️ *AVISO DE ESTORNO DE PAGAMENTO*',
            'Informamos que o pagamento referente ao recibo *' + (pagto.numeroRecibo || pagto.id) + '* da Nota #' + numNota + ' foi *ESTORNADO/CANCELADO* em nosso sistema.',
            'Motivo: ' + (pagto.motivoEstorno || 'Ajuste administrativo'),
            '',
            'Caso tenha dúvidas, entre em contato com nossa equipe.'
        ].join('\n');
    }

    // Calcula saldo restante
    var valorOrig = parseFloat(n.valorOriginal) || 0;
    var totalPago = 0;
    for (var i = 0; i < pagtos.length; i++) {
        if (pagtos[i] && pagtos[i].status !== 'ESTORNADO') {
            totalPago += parseFloat(pagtos[i].valor) || 0;
        }
    }
    var saldoRestante = Math.max(0, Math.round((valorOrig - totalPago) * 100) / 100);
    if (pagto.saldoApos !== undefined) {
        saldoRestante = Math.max(0, parseFloat(pagto.saldoApos) || 0);
    }

    var isQuitada = saldoRestante <= 0;
    var tituloComprovante = isQuitada ? '🎉 *COMPROVANTE DE QUITAÇÃO DEFINITIVA*' : '🧾 *COMPROVANTE DE PAGAMENTO*';

    var linhas = [
        '🚗 *' + empNome + '*',
        'Olá, *' + clienteNome + '*!',
        '',
        tituloComprovante,
        'Confirmamos o recebimento do seu pagamento com sucesso:',
        '📄 *Nº do Recibo:* ' + (pagto.numeroRecibo || pagto.id),
        '📋 *Nota Ref.:* #' + numNota,
        '📅 *Data do Pagamento:* ' + formatarDataTextoZap(pagto.dataPagamento),
        '💳 *Forma de Pagamento:* ' + (pagto.formaPagamento || 'Dinheiro'),
        '💵 *Valor Pago:* ' + formatarMoedaTextoZap(pagto.valor)
    ];

    if (isQuitada) {
        linhas.push('');
        linhas.push('✅ *SITUAÇÃO:* Esta nota foi *100% QUITADA*. Agradecemos pela pontualidade e parceria!');
    } else {
        linhas.push('');
        linhas.push('📊 *Saldo Restante a Pagar:* ' + formatarMoedaTextoZap(saldoRestante));
        if (cfg.chavePix && String(cfg.chavePix).trim()) {
            linhas.push('🔑 *Chave PIX:* `' + String(cfg.chavePix).trim() + '` (' + (cfg.tipoChavePix || 'PIX') + ')');
        }
    }

    linhas.push('');
    linhas.push(cfg.rodapeDocumentos || 'Obrigado pela preferência e parceria!');

    return linhas.join('\n');
}

/**
 * Gera mensagem de lembrete cordial de vencimento próximo ou hoje.
 */
function gerarMensagemWhatsAppLembreteVencimento(nota, configEmpresa, dataReferenciaISO) {
    var n = (nota && typeof nota === 'object') ? nota : {};
    var cfg = (configEmpresa && typeof configEmpresa === 'object') ? configEmpresa : {};
    var empNome = (cfg.nomeFantasia && String(cfg.nomeFantasia).trim()) || 'TUCANO AUTO PEÇAS';
    var clienteNome = (n.cliente && String(n.cliente).trim()) || 'Cliente';
    var numNota = n.numeroControle || n.id || '-';
    var hojeISO = dataReferenciaISO || (typeof obterDataLocalISO === 'function' ? obterDataLocalISO() : new Date().toISOString().slice(0, 10));

    var diasAteVencimento = 0;
    if (typeof calcularDiasEntreDatasISO === 'function') {
        diasAteVencimento = calcularDiasEntreDatasISO(hojeISO, n.dataVencimento);
    } else {
        var d1 = new Date(hojeISO + 'T00:00:00');
        var d2 = new Date(n.dataVencimento + 'T00:00:00');
        diasAteVencimento = Math.round((d2 - d1) / 86400000);
    }

    var situacao = calcularSituacaoNotaSeguraZap(n, hojeISO);

    var textoQuando = '';
    if (diasAteVencimento === 0) {
        textoQuando = '*vence HOJE* (' + formatarDataTextoZap(n.dataVencimento) + ')';
    } else if (diasAteVencimento === 1) {
        textoQuando = '*vence AMANHÃ* (' + formatarDataTextoZap(n.dataVencimento) + ')';
    } else if (diasAteVencimento > 1) {
        textoQuando = 'vence em *' + diasAteVencimento + ' dias* (' + formatarDataTextoZap(n.dataVencimento) + ')';
    } else {
        textoQuando = 'venceu em ' + formatarDataTextoZap(n.dataVencimento);
    }

    var linhas = [
        '🚗 *' + empNome + '*',
        'Olá, *' + clienteNome + '*! Tudo bem?',
        '',
        '🔔 *LEMBRETE AMIGÁVEL DE VENCIMENTO*',
        'Gostaríamos de lembrar que sua Nota a Prazo #' + numNota + ' ' + textoQuando + ':',
        '💵 *Valor Original:* ' + formatarMoedaTextoZap(n.valorOriginal)
    ];

    if (situacao.totalPago > 0) {
        linhas.push('💰 *Valor já amortizado:* ' + formatarMoedaTextoZap(situacao.totalPago));
    }
    linhas.push('📊 *Saldo Atual a Pagar:* ' + formatarMoedaTextoZap(situacao.saldo));

    if (cfg.chavePix && String(cfg.chavePix).trim()) {
        linhas.push('');
        linhas.push('💳 *Chave PIX para Quitação:*');
        linhas.push('🔑 `' + String(cfg.chavePix).trim() + '` (' + (cfg.tipoChavePix || 'Chave PIX') + ')');
        if (cfg.titularPix) {
            linhas.push('👤 *Titular:* ' + cfg.titularPix);
        }
    }

    linhas.push('');
    linhas.push('_Caso já tenha realizado o pagamento, por favor desconsidere este aviso._');
    linhas.push(cfg.rodapeDocumentos || 'Estamos à disposição!');

    return linhas.join('\n');
}

/**
 * Gera mensagem profissional, transparente e educada de cobrança de nota vencida.
 */
function gerarMensagemWhatsAppCobrancaNota(nota, configEmpresa, dataReferenciaISO) {
    var n = (nota && typeof nota === 'object') ? nota : {};
    var cfg = (configEmpresa && typeof configEmpresa === 'object') ? configEmpresa : {};
    var empNome = (cfg.nomeFantasia && String(cfg.nomeFantasia).trim()) || 'TUCANO AUTO PEÇAS';
    var clienteNome = (n.cliente && String(n.cliente).trim()) || 'Cliente';
    var numNota = n.numeroControle || n.id || '-';
    var hojeISO = dataReferenciaISO || (typeof obterDataLocalISO === 'function' ? obterDataLocalISO() : new Date().toISOString().slice(0, 10));

    var diasAtraso = 0;
    if (typeof calcularDiasEntreDatasISO === 'function') {
        diasAtraso = Math.max(0, calcularDiasEntreDatasISO(n.dataVencimento, hojeISO));
    } else {
        var dVenc = new Date(n.dataVencimento + 'T00:00:00');
        var dHoje = new Date(hojeISO + 'T00:00:00');
        diasAtraso = Math.max(0, Math.round((dHoje - dVenc) / 86400000));
    }

    var situacao = calcularSituacaoNotaSeguraZap(n, hojeISO);

    var linhas = [
        '🚗 *' + empNome + '*',
        'Prezado(a) *' + clienteNome + '*,',
        '',
        '⚠️ *COMUNICADO DE NOTA EM ABERTO*',
        'Identificamos em nosso sistema que a Nota a Prazo #' + numNota + ' encontra-se pendente de pagamento:',
        '📅 *Vencimento Original:* ' + formatarDataTextoZap(n.dataVencimento) + (diasAtraso > 0 ? ' (' + diasAtraso + ' dias em atraso)' : ''),
        '💵 *Valor da Compra:* ' + formatarMoedaTextoZap(n.valorOriginal)
    ];

    if (situacao.totalPago > 0) {
        linhas.push('💰 *Valor já Amortizado:* ' + formatarMoedaTextoZap(situacao.totalPago));
    }
    linhas.push('📊 *Saldo Devedor Pendente:* ' + formatarMoedaTextoZap(situacao.saldo));

    if (cfg.chavePix && String(cfg.chavePix).trim()) {
        linhas.push('');
        linhas.push('💳 *Chave PIX para Regularização:*');
        linhas.push('🔑 `' + String(cfg.chavePix).trim() + '` (' + (cfg.tipoChavePix || 'Chave PIX') + ')');
        if (cfg.titularPix) {
            linhas.push('👤 *Titular:* ' + cfg.titularPix);
        }
    }

    linhas.push('');
    linhas.push('Solicitamos a gentileza de nos enviar o comprovante após a transferência ou entrar em contato conosco para alinhamento.');
    linhas.push(cfg.rodapeDocumentos || 'Agradecemos a sua atenção e parceria.');

    return linhas.join('\n');
}

/**
 * Gera mensagem com o Extrato Consolidado da Conta Corrente do Cliente.
 */
function gerarMensagemWhatsAppExtratoCliente(cliente, resumoCarteira, configEmpresa, dataReferenciaISO) {
    var c = (cliente && typeof cliente === 'object') ? cliente : {};
    var r = (resumoCarteira && typeof resumoCarteira === 'object') ? resumoCarteira : {};
    var cfg = (configEmpresa && typeof configEmpresa === 'object') ? configEmpresa : {};
    var empNome = (cfg.nomeFantasia && String(cfg.nomeFantasia).trim()) || 'TUCANO AUTO PEÇAS';
    var clienteNome = (c.nome && String(c.nome).trim()) || 'Cliente';
    var codFicha = c.codigo ? ' (Ficha: *' + c.codigo + '*)' : '';
    var hojeISO = dataReferenciaISO || (typeof obterDataLocalISO === 'function' ? obterDataLocalISO() : new Date().toISOString().slice(0, 10));

    var linhas = [
        '🚗 *' + empNome + '*',
        'Olá, *' + clienteNome + '*' + codFicha + '!',
        '',
        '📊 *EXTRATO CONSOLIDADO DE CONTA CORRENTE*',
        'Data de Posição: ' + formatarDataTextoZap(hojeISO),
        ''
    ];

    var notas = r.notasDoCliente || r.notas || [];
    var notasPendentes = notas.filter(function(n) {
        if (!n || n.status === 'CANCELADA') return false;
        var sit = calcularSituacaoNotaSeguraZap(n, hojeISO);
        return sit.saldo > 0;
    });

    var totalSomadoCent = 0;
    if (notasPendentes.length > 0) {
        linhas.push('📝 *Notas com Saldo Pendente:*');
        for (var i = 0; i < notasPendentes.length; i++) {
            var np = notasPendentes[i];
            var sitN = calcularSituacaoNotaSeguraZap(np, hojeISO);
            totalSomadoCent += Math.round(sitN.saldo * 100);
            var numNota = np.numeroControle || np.id || ('NP-' + (i + 1));
            var dataEmissaoFmt = formatarDataTextoZap(np.dataEmissao);
            var dataVencFmt = formatarDataTextoZap(np.dataVencimento);
            var saldoFmt = formatarMoedaTextoZap(sitN.saldo);

            linhas.push('• Nota *' + numNota + '* | Emissão: ' + dataEmissaoFmt + ' | Vencimento: *' + dataVencFmt + '* | Valor: *' + saldoFmt + '*');
        }
        linhas.push('');
    }

    var totalSomado = totalSomadoCent > 0 ? (totalSomadoCent / 100) : (r.saldoDevedor || 0);
    var qtdNotas = notasPendentes.length;

    linhas.push('----------------------------------------');
    if (qtdNotas > 0) {
        linhas.push('📊 *RESUMO TOTAL DAS NOTAS (' + qtdNotas + ' NOTA' + (qtdNotas !== 1 ? 'S' : '') + '):*');
        linhas.push('💰 *VALOR TOTAL SOMADO A PAGAR: ' + formatarMoedaTextoZap(totalSomado) + '*');
    }
    if (r.totalComprado !== undefined) {
        linhas.push('🛒 *Total Comprado Histórico:* ' + formatarMoedaTextoZap(r.totalComprado || 0));
    }
    if (r.totalPago !== undefined) {
        linhas.push('✅ *Total Já Pago:* ' + formatarMoedaTextoZap(r.totalPago || 0));
    }
    linhas.push('⚠️ *SALDO TOTAL A PAGAR:* ' + formatarMoedaTextoZap(r.saldoDevedor !== undefined ? r.saldoDevedor : totalSomado));
    linhas.push('----------------------------------------');

    if (cfg.chavePix && String(cfg.chavePix).trim() && (totalSomado > 0 || r.saldoDevedor > 0)) {
        linhas.push('');
        linhas.push('💳 *Chave PIX para Liquidação:*');
        linhas.push('🔑 `' + String(cfg.chavePix).trim() + '` (' + (cfg.tipoChavePix || 'Chave PIX') + ')');
        if (cfg.titularPix) {
            linhas.push('👤 *Titular:* ' + cfg.titularPix);
        }
    }

    linhas.push('');
    linhas.push('Para qualquer esclarecimento, nossa equipe está sempre à disposição!');
    linhas.push(cfg.rodapeDocumentos || 'Obrigado pela preferência e parceria!');

    return linhas.join('\n');
}

/**
 * Gera mensagem WhatsApp consolidada contendo lista individual de notas e auto-soma.
 */
function gerarMensagemWhatsAppNotasConsolidadas(cliente, listaNotas, configEmpresa, dataReferenciaISO) {
    var c = (cliente && typeof cliente === 'object') ? cliente : {};
    var notas = Array.isArray(listaNotas) ? listaNotas : [];
    var cfg = (configEmpresa && typeof configEmpresa === 'object') ? configEmpresa : {};
    var empNome = (cfg.nomeFantasia && String(cfg.nomeFantasia).trim()) || 'TUCANO AUTO PEÇAS';
    var clienteNome = (c.nome && String(c.nome).trim()) || (notas[0] && (notas[0].cliente || notas[0].nomeCliente)) || 'Cliente';
    var codFicha = c.codigo ? ' (Ficha: *' + c.codigo + '*)' : '';
    var hojeISO = dataReferenciaISO || (typeof obterDataLocalISO === 'function' ? obterDataLocalISO() : new Date().toISOString().slice(0, 10));

    var linhas = [
        '🚗 *' + empNome + '*',
        'Olá, *' + clienteNome + '*' + codFicha + '!',
        '',
        '📋 *NOTAS A PRAZO PENDENTES DE PAGAMENTO*'
    ];

    var totalSomadoCent = 0;
    var qtdNotas = 0;

    for (var i = 0; i < notas.length; i++) {
        var n = notas[i];
        if (!n || n.status === 'CANCELADA') continue;
        var sit = calcularSituacaoNotaSeguraZap(n, hojeISO);
        if (sit.saldo <= 0) continue;

        qtdNotas++;
        totalSomadoCent += Math.round(sit.saldo * 100);

        var numNota = n.numeroControle || n.id || ('Nota ' + (i + 1));
        var dataEmissaoFmt = formatarDataTextoZap(n.dataEmissao);
        var dataVencFmt = formatarDataTextoZap(n.dataVencimento);
        var saldoFmt = formatarMoedaTextoZap(sit.saldo);

        linhas.push('• Nota *' + numNota + '* | Emissão: ' + dataEmissaoFmt + ' | Vencimento: *' + dataVencFmt + '* | Valor: *' + saldoFmt + '*');
    }

    var totalSomado = totalSomadoCent / 100;

    linhas.push('');
    linhas.push('📊 *RESUMO TOTAL DAS NOTAS (' + qtdNotas + ' NOTA' + (qtdNotas !== 1 ? 'S' : '') + '):*');
    linhas.push('💰 *VALOR TOTAL SOMADO A PAGAR: ' + formatarMoedaTextoZap(totalSomado) + '*');

    if (cfg.chavePix && String(cfg.chavePix).trim() && totalSomado > 0) {
        linhas.push('');
        linhas.push('💳 *Chave PIX para Pagamento:*');
        linhas.push('🔑 `' + String(cfg.chavePix).trim() + '` (' + (cfg.tipoChavePix || 'Chave PIX') + ')');
        if (cfg.titularPix) {
            linhas.push('👤 *Titular:* ' + cfg.titularPix);
        }
    }

    linhas.push('');
    linhas.push(cfg.rodapeDocumentos || 'Estamos à disposição!');

    return linhas.join('\n');
}

/**
 * Gera mensagem com o resumo executivo dos relatórios analíticos para o operador/gerente.
 */
function gerarMensagemWhatsAppResumoRelatorio(resultadoRelatorio, estadoFiltros, configEmpresa) {
    var res = (resultadoRelatorio && typeof resultadoRelatorio === 'object') ? resultadoRelatorio : {};
    var dados = res.dados || {};
    var auto = dados.autoSoma || {};
    var intervalo = res.intervalo || {};
    var f = (estadoFiltros && typeof estadoFiltros === 'object') ? estadoFiltros : {};
    var cfg = (configEmpresa && typeof configEmpresa === 'object') ? configEmpresa : {};
    var empNome = (cfg.nomeFantasia && String(cfg.nomeFantasia).trim()) || 'TUCANO AUTO PEÇAS';

    var tipo = f.tipoRelatorio || res.tipo || 'NOTAS_GERAL';
    var titulo = 'RELATÓRIO FINANCEIRO';
    if (tipo === 'NOTAS_VENCIMENTO') titulo = 'CONTAS A RECEBER POR VENCIMENTO';
    else if (tipo === 'RECEBIMENTOS_PAGAMENTOS') titulo = 'RECEBIMENTOS E FLUXO DE CAIXA';
    else if (tipo === 'NOTAS_GERAL') titulo = 'RELATÓRIO GERAL DE NOTAS';
    else if (tipo === 'CLIENTES_POSICAO') titulo = 'POSIÇÃO POR CLIENTE';

    var linhas = [
        '🚗 *' + empNome + '*',
        '📊 *RESUMO EXECUTIVO DE RELATÓRIO*',
        '📋 *Relatório:* ' + titulo,
        '🗓️ *Período:* ' + (intervalo.descricaoPeriodo || 'Todo o Período')
    ];

    if (f.clienteFiltro && f.clienteFiltro !== 'TODOS') {
        linhas.push('👤 *Filtro de Cliente:* ' + f.clienteFiltro);
    }

    linhas.push('');
    linhas.push('----------------------------------------');
    if (tipo === 'RECEBIMENTOS_PAGAMENTOS') {
        linhas.push('💵 *Pagamentos Ativos:* ' + (auto.quantidadePagamentosAtivos || 0));
        linhas.push('✅ *Total Recebido:* ' + formatarMoedaTextoZap(auto.somaValorRecebidoAtivo || 0));
        if (auto.quantidadePagamentosEstornados > 0) {
            linhas.push('🚫 *Estornados:* ' + auto.quantidadePagamentosEstornados + ' (' + formatarMoedaTextoZap(auto.somaValorEstornado || 0) + ')');
        }
    } else {
        linhas.push('📝 *Quantidade de Registros:* ' + (auto.quantidadeRegistros || 0));
        linhas.push('🛒 *Total Original:* ' + formatarMoedaTextoZap(auto.somaValorOriginal || 0));
        linhas.push('✅ *Total Já Recebido:* ' + formatarMoedaTextoZap(auto.somaTotalRecebido || 0));
        linhas.push('⚠️ *SALDO DEVEDOR TOTAL:* ' + formatarMoedaTextoZap(auto.somaSaldoDevedor || 0));
    }
    linhas.push('----------------------------------------');

    var hojeRef = (typeof obterDataLocalISO === 'function') ? obterDataLocalISO() : new Date().toISOString().slice(0, 10);
    linhas.push('📅 Posição gerada em: ' + formatarDataTextoZap(hojeRef));

    return linhas.join('\n');
}

/**
 * Filtra e categoriza notas pendentes em grupos de alerta (Vencendo Hoje, Próximos Dias e Vencidas).
 */
function listarAlertasVencimentoECobranca(listaNotas, mapaClientes, configEmpresa, dataReferenciaISO) {
    var notas = Array.isArray(listaNotas) ? listaNotas : [];
    var cfg = (configEmpresa && typeof configEmpresa === 'object') ? configEmpresa : {};
    var diasAlerta = parseInt(cfg.diasAlertaVencimento, 10) || 3;
    var hojeISO = dataReferenciaISO || (typeof obterDataLocalISO === 'function' ? obterDataLocalISO() : new Date().toISOString().slice(0, 10));

    var vencendoHoje = [];
    var vencendoProximosDias = [];
    var vencidas = [];

    var centavosHoje = 0;
    var centavosProximos = 0;
    var centavosVencidas = 0;

    for (var i = 0; i < notas.length; i++) {
        var nota = notas[i];
        if (!nota || nota.status === 'CANCELADA') continue;

        var sit = calcularSituacaoNotaSeguraZap(nota, hojeISO);

        if (sit.statusFinanceiro === 'CANCELADA' || sit.saldo <= 0) continue;

        var saldoCentavos = (typeof moedaParaCentavos === 'function')
            ? moedaParaCentavos(sit.saldo)
            : Math.round(sit.saldo * 100);

        var dataVenc = String(nota.dataVencimento || '').split('T')[0];
        if (dataVenc === hojeISO) {
            vencendoHoje.push(nota);
            centavosHoje += saldoCentavos;
        } else if (dataVenc < hojeISO) {
            vencidas.push(nota);
            centavosVencidas += saldoCentavos;
        } else {
            var diffDias = 0;
            if (typeof calcularDiasEntreDatasISO === 'function') {
                diffDias = calcularDiasEntreDatasISO(hojeISO, dataVenc);
            } else {
                var dH = new Date(hojeISO + 'T00:00:00');
                var dV = new Date(dataVenc + 'T00:00:00');
                diffDias = Math.round((dV - dH) / 86400000);
            }

            if (diffDias >= 1 && diffDias <= diasAlerta) {
                vencendoProximosDias.push(nota);
                centavosProximos += saldoCentavos;
            }
        }
    }

    var somaHoje = (typeof centavosParaReais === 'function') ? centavosParaReais(centavosHoje) : Math.round(centavosHoje) / 100;
    var somaProximos = (typeof centavosParaReais === 'function') ? centavosParaReais(centavosProximos) : Math.round(centavosProximos) / 100;
    var somaVencidas = (typeof centavosParaReais === 'function') ? centavosParaReais(centavosVencidas) : Math.round(centavosVencidas) / 100;

    return {
        vencendoHoje: {
            notas: vencendoHoje,
            qtd: vencendoHoje.length,
            somaSaldo: somaHoje
        },
        vencendoProximosDias: {
            notas: vencendoProximosDias,
            qtd: vencendoProximosDias.length,
            somaSaldo: somaProximos,
            diasConfigurados: diasAlerta
        },
        vencidas: {
            notas: vencidas,
            qtd: vencidas.length,
            somaSaldo: somaVencidas
        },
        totalAlertas: vencendoHoje.length + vencendoProximosDias.length + vencidas.length
    };
}

// =========================================================================
// PARTE 2: DISPARO SEGURO (TAURI V2 / NAVEGADOR) E MODAL DE REVISÃO
// =========================================================================

/**
 * Abre URL externa usando o plugin Opener do Tauri v2 ou window.open como fallback.
 */
async function abrirUrlExternaWhatsApp(urlWeb, urlProtocolo) {
    try {
        // Tauri v2 com withGlobalTauri: true
        if (typeof window !== 'undefined' && window.__TAURI__) {
            if (window.__TAURI__.opener && typeof window.__TAURI__.opener.openUrl === 'function') {
                await window.__TAURI__.opener.openUrl(urlWeb);
                return true;
            }
            if (window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
                try {
                    await window.__TAURI__.core.invoke('plugin:opener|open_url', { url: urlWeb });
                    return true;
                } catch (eInv) {
                    console.warn('[WhatsApp] Erro no plugin opener do Tauri:', eInv);
                }
            }
        }
    } catch (eTauri) {
        console.warn('[WhatsApp] Falha ao acionar Tauri Opener, tentando window.open:', eTauri);
    }

    // Fallback padrão para ambiente Web ou desenvolvimento
    if (typeof window !== 'undefined' && typeof window.open === 'function') {
        window.open(urlWeb, '_blank', 'noopener,noreferrer');
        return true;
    }
    return false;
}

/**
 * Exibe modal do SweetAlert2 permitindo revisar e editar o telefone e a mensagem antes do envio.
 */
async function abrirModalEnvioWhatsApp(opcoes) {
    var opts = (opcoes && typeof opcoes === 'object') ? opcoes : {};
    var telInicial = opts.telefone || '';
    var msgInicial = opts.mensagem || '';
    var tituloModal = opts.titulo || '📲 Enviar WhatsApp';
    var notaId = opts.notaId || null;
    var clienteId = opts.clienteId || null;
    var tipoComunicacao = opts.tipoComunicacao || 'GERAL';

    if (typeof Swal === 'undefined') {
        console.error('[WhatsApp] SweetAlert2 não disponível.');
        return false;
    }

    var htmlModal = `
        <div class="text-left text-xs space-y-3">
            <div>
                <label class="block font-bold text-slate-300 uppercase tracking-wider text-[10px] mb-1">
                    Número do WhatsApp (DDD + Número):
                </label>
                <input type="text" id="campoZapTelefoneModal" value="${telInicial}" 
                    placeholder="(22) 99999-9999"
                    class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <p class="text-[10px] text-slate-400 mt-0.5">Se você atualizar o número aqui, ele será salvo no cadastro para envios futuros.</p>
            </div>
            <div>
                <label class="block font-bold text-slate-300 uppercase tracking-wider text-[10px] mb-1">
                    Mensagem (Edite se desejar antes de enviar):
                </label>
                <textarea id="campoZapMensagemModal" rows="8" 
                    class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white font-sans text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 custom-scrollbar leading-relaxed">${msgInicial}</textarea>
            </div>
            <div class="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>🛡️ Envio transparente e criptografado via WhatsApp Oficial.</span>
            </div>
        </div>
    `;

    var resModal = await Swal.fire({
        title: tituloModal,
        html: htmlModal,
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: '📲 Abrir WhatsApp',
        denyButtonText: '📋 Copiar Texto',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#059669',
        denyButtonColor: '#475569',
        cancelButtonColor: '#334155',
        focusConfirm: false,
        didOpen: function() {
            var elTel = document.getElementById('campoZapTelefoneModal');
            if (elTel && typeof IMask !== 'undefined') {
                IMask(elTel, {
                    mask: [
                        { mask: '(00) 0000-0000' },
                        { mask: '(00) 00000-0000' }
                    ]
                });
            }
        },
        preConfirm: function() {
            var elTel = document.getElementById('campoZapTelefoneModal');
            var elMsg = document.getElementById('campoZapMensagemModal');
            var telValor = elTel ? elTel.value.trim() : '';
            var msgValor = elMsg ? elMsg.value.trim() : '';

            var urlObj = construirUrlWhatsApp(telValor, msgValor);
            if (!urlObj.valido) {
                Swal.showValidationMessage(urlObj.erro || 'Telefone inválido.');
                return false;
            }
            return {
                telefone: telValor,
                mensagem: msgValor,
                urlWeb: urlObj.urlWeb,
                urlProtocolo: urlObj.urlProtocolo
            };
        }
    });

    if (resModal.isDenied) {
        // Copiar texto para área de transferência
        var elMsgCopiar = document.getElementById('campoZapMensagemModal');
        var textoParaCopiar = elMsgCopiar ? elMsgCopiar.value : msgInicial;
        try {
            if (navigator && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                await navigator.clipboard.writeText(textoParaCopiar);
                Swal.fire({
                    title: 'Copiado!',
                    text: 'A mensagem foi copiada para a sua área de transferência.',
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                Swal.fire('Aviso', 'Copie manualmente o texto da mensagem.', 'info');
            }
        } catch (eClip) {
            Swal.fire('Erro', 'Não foi possível acessar a área de transferência.', 'error');
        }
        return false;
    }

    if (!resModal.isConfirmed || !resModal.value) {
        return false;
    }

    var dadosConfirmados = resModal.value;

    // Dispara abertura do WhatsApp
    await abrirUrlExternaWhatsApp(dadosConfirmados.urlWeb, dadosConfirmados.urlProtocolo);

    // Gravação segura e não-destrutiva de log de envio e atualização do telefone
    try {
        var agoraISO = new Date().toISOString();
        var operador = (typeof auth !== 'undefined' && auth.currentUser && auth.currentUser.email) ? auth.currentUser.email : 'Operador';
        var updates = {};

        var logComunicacao = {
            tipo: tipoComunicacao,
            dataHora: agoraISO,
            telefone: dadosConfirmados.telefone,
            operador: operador
        };

        if (notaId && typeof database !== 'undefined') {
            updates['notasPrazo/' + notaId + '/ultimaComunicacaoWhatsApp'] = logComunicacao;
            if (dadosConfirmados.telefone) {
                updates['notasPrazo/' + notaId + '/telefone'] = dadosConfirmados.telefone;
            }
        }

        if (clienteId && typeof database !== 'undefined') {
            updates['clientes/' + clienteId + '/ultimaComunicacaoWhatsApp'] = logComunicacao;
            if (dadosConfirmados.telefone) {
                updates['clientes/' + clienteId + '/telefone'] = dadosConfirmados.telefone;
            }
        }

        if (Object.keys(updates).length > 0) {
            await database.ref().update(updates);
        }
    } catch (eSave) {
        console.warn('[WhatsApp] Falha ao registrar log de comunicação:', eSave);
    }

    return true;
}

// =========================================================================
// PARTE 3: ATALHOS RÁPIDOS CHAMADOS PELA UI
// =========================================================================

/**
 * Envia notificação da Nota a Prazo no WhatsApp (Lembrete, Cobrança ou Emissão).
 */
async function enviarWhatsAppNota(idNota, modoSugerido) {
    if (typeof listaGlobalNotasPrazo === 'undefined') return;
    var nota = listaGlobalNotasPrazo.find(function(x) { return String(x.id) === String(idNota); });
    if (!nota) {
        if (typeof Swal !== 'undefined') Swal.fire('Erro', 'Nota a prazo não encontrada.', 'error');
        return;
    }

    var cfg = (typeof obterConfiguracoesEmpresaSegura === 'function') ? obterConfiguracoesEmpresaSegura() : {};
    var hojeISO = (typeof obterDataLocalISO === 'function') ? obterDataLocalISO() : new Date().toISOString().slice(0, 10);
    var sit = (typeof calcularSituacaoNota === 'function') ? calcularSituacaoNota(nota, hojeISO) : { saldo: parseFloat(nota.valorOriginal) || 0 };

    var modo = modoSugerido;
    if (!modo) {
        if (sit.statusFinanceiro === 'QUITADA') {
            modo = 'RECIBO';
        } else if (sit.indicadorCobranca === 'VENCIDA') {
            modo = 'COBRANCA';
        } else if (sit.indicadorCobranca === 'VENCENDO') {
            modo = 'LEMBRETE';
        } else {
            modo = 'EMISSAO';
        }
    }

    var msg = '';
    var tituloModal = '📲 Enviar WhatsApp';
    if (modo === 'COBRANCA') {
        msg = gerarMensagemWhatsAppCobrancaNota(nota, cfg, hojeISO);
        tituloModal = '⚠️ Cobrança via WhatsApp';
    } else if (modo === 'LEMBRETE') {
        msg = gerarMensagemWhatsAppLembreteVencimento(nota, cfg, hojeISO);
        tituloModal = '🔔 Lembrete de Vencimento';
    } else if (modo === 'RECIBO') {
        msg = gerarMensagemWhatsAppReciboPagamento(nota, null, cfg);
        tituloModal = '🧾 Comprovante via WhatsApp';
    } else {
        msg = gerarMensagemWhatsAppEmissaoNota(nota, cfg);
        tituloModal = '📄 Confirmação de Nota via WhatsApp';
    }

    await abrirModalEnvioWhatsApp({
        telefone: nota.telefone || '',
        mensagem: msg,
        titulo: tituloModal,
        notaId: nota.id,
        clienteId: nota.clienteId || null,
        tipoComunicacao: modo
    });
}

/**
 * Envia comprovante de um recibo específico de pagamento no WhatsApp.
 */
async function enviarWhatsAppReciboNota(idNota, idPagamento) {
    if (typeof listaGlobalNotasPrazo === 'undefined') return;
    var nota = listaGlobalNotasPrazo.find(function(x) { return String(x.id) === String(idNota); });
    if (!nota) return;

    var cfg = (typeof obterConfiguracoesEmpresaSegura === 'function') ? obterConfiguracoesEmpresaSegura() : {};
    var msg = gerarMensagemWhatsAppReciboPagamento(nota, idPagamento, cfg);

    await abrirModalEnvioWhatsApp({
        telefone: nota.telefone || '',
        mensagem: msg,
        titulo: '🧾 Comprovante de Pagamento via WhatsApp',
        notaId: nota.id,
        clienteId: nota.clienteId || null,
        tipoComunicacao: 'RECIBO'
    });
}

/**
 * Envia o Extrato Consolidado da Conta Corrente do Cliente no WhatsApp.
 */
async function enviarWhatsAppExtratoCliente(clienteIdOuChave) {
    var resolvido = (typeof resolverClienteEResumoPorIdentificador === 'function')
        ? resolverClienteEResumoPorIdentificador(clienteIdOuChave)
        : null;
    var cliente = resolvido ? resolvido.cliente : null;
    var resumoResolvido = resolvido ? resolvido.resumoCarteira : null;

    if (!cliente && typeof obterClientePorIdOuChave === 'function') {
        cliente = obterClientePorIdOuChave(clienteIdOuChave);
    }
    if (!cliente && typeof mapaGlobalClientes !== 'undefined' && clienteIdOuChave) {
        cliente = mapaGlobalClientes[clienteIdOuChave];
    }
    if (!cliente && typeof clientesMap !== 'undefined' && clienteIdOuChave) {
        cliente = clientesMap[clienteIdOuChave];
    }
    if (!cliente && typeof listaGlobalClientes !== 'undefined') {
        cliente = listaGlobalClientes.find(function(c) {
            return c && (c.id === clienteIdOuChave || c.codigo === clienteIdOuChave);
        });
    }
    if (!cliente && typeof clienteIdFichaAtual !== 'undefined' && clienteIdFichaAtual) {
        if (typeof resolverClienteEResumoPorIdentificador === 'function') {
            var resFicha = resolverClienteEResumoPorIdentificador(clienteIdFichaAtual);
            if (resFicha) {
                cliente = resFicha.cliente;
                resumoResolvido = resFicha.resumoCarteira;
            }
        }
    }
    if (!cliente) {
        if (typeof Swal !== 'undefined') Swal.fire('Atenção', 'Selecione ou abra a ficha de um cliente para enviar o extrato.', 'warning');
        return;
    }

    var resumo = resumoResolvido || ((typeof calcularResumoCarteiraCliente === 'function' && typeof listaGlobalNotasPrazo !== 'undefined')
        ? calcularResumoCarteiraCliente(cliente, listaGlobalNotasPrazo)
        : { totalComprado: 0, totalPago: 0, saldoDevedor: 0 });

    var cfg = (typeof obterConfiguracoesEmpresaSegura === 'function') ? obterConfiguracoesEmpresaSegura() : {};
    var hojeISO = (typeof obterDataLocalISO === 'function') ? obterDataLocalISO() : new Date().toISOString().slice(0, 10);
    var msg = gerarMensagemWhatsAppExtratoCliente(cliente, resumo, cfg, hojeISO);

    await abrirModalEnvioWhatsApp({
        telefone: cliente.telefone || '',
        mensagem: msg,
        titulo: '📊 Extrato de Conta Corrente via WhatsApp',
        clienteId: cliente.id,
        tipoComunicacao: 'EXTRATO'
    });
}

/**
 * Envia cobrança consolidada de todas as notas em atraso do cliente no WhatsApp.
 */
async function enviarWhatsAppCobrancaCliente(clienteIdOuChave) {
    var resolvido = (typeof resolverClienteEResumoPorIdentificador === 'function')
        ? resolverClienteEResumoPorIdentificador(clienteIdOuChave)
        : null;
    var cliente = resolvido ? resolvido.cliente : null;
    var resumoResolvido = resolvido ? resolvido.resumoCarteira : null;

    if (!cliente && typeof obterClientePorIdOuChave === 'function') {
        cliente = obterClientePorIdOuChave(clienteIdOuChave);
    }
    if (!cliente && typeof mapaGlobalClientes !== 'undefined' && clienteIdOuChave) {
        cliente = mapaGlobalClientes[clienteIdOuChave];
    }
    if (!cliente && typeof clientesMap !== 'undefined' && clienteIdOuChave) {
        cliente = clientesMap[clienteIdOuChave];
    }
    if (!cliente && typeof listaGlobalClientes !== 'undefined') {
        cliente = listaGlobalClientes.find(function(c) {
            return c && (c.id === clienteIdOuChave || c.codigo === clienteIdOuChave);
        });
    }
    if (!cliente && typeof clienteIdFichaAtual !== 'undefined' && clienteIdFichaAtual) {
        if (typeof resolverClienteEResumoPorIdentificador === 'function') {
            var resFichaCob = resolverClienteEResumoPorIdentificador(clienteIdFichaAtual);
            if (resFichaCob) {
                cliente = resFichaCob.cliente;
                resumoResolvido = resFichaCob.resumoCarteira;
            }
        }
    }
    if (!cliente) {
        if (typeof Swal !== 'undefined') Swal.fire('Atenção', 'Selecione ou abra a ficha de um cliente para enviar cobrança.', 'warning');
        return;
    }

    var resumo = resumoResolvido || ((typeof calcularResumoCarteiraCliente === 'function' && typeof listaGlobalNotasPrazo !== 'undefined')
        ? calcularResumoCarteiraCliente(cliente, listaGlobalNotasPrazo)
        : { totalComprado: 0, totalPago: 0, saldoDevedor: 0 });

    var cfg = (typeof obterConfiguracoesEmpresaSegura === 'function') ? obterConfiguracoesEmpresaSegura() : {};
    var hojeISO = (typeof obterDataLocalISO === 'function') ? obterDataLocalISO() : new Date().toISOString().slice(0, 10);
    var msg = gerarMensagemWhatsAppExtratoCliente(cliente, resumo, cfg, hojeISO);

    await abrirModalEnvioWhatsApp({
        telefone: cliente.telefone || '',
        mensagem: msg,
        titulo: '⚠️ Cobrança de Carteira via WhatsApp',
        clienteId: cliente.id,
        tipoComunicacao: 'COBRANCA_CARTEIRA'
    });
}

/**
 * Envia o resumo executivo do relatório analítico atualmente filtrado via WhatsApp.
 */
async function enviarWhatsAppRelatorioAtual() {
    if (typeof ultimoResultadoRelatorio === 'undefined' || !ultimoResultadoRelatorio) {
        if (typeof Swal !== 'undefined') Swal.fire('Aviso', 'Nenhum relatório foi gerado ainda.', 'info');
        return;
    }

    var cfg = (typeof obterConfiguracoesEmpresaSegura === 'function') ? obterConfiguracoesEmpresaSegura() : {};
    var f = (typeof estadoFiltrosRelatorio !== 'undefined') ? estadoFiltrosRelatorio : {};
    var msg = gerarMensagemWhatsAppResumoRelatorio(ultimoResultadoRelatorio, f, cfg);

    await abrirModalEnvioWhatsApp({
        telefone: (cfg.whatsappLoja || cfg.telefone || ''),
        mensagem: msg,
        titulo: '📈 Resumo de Relatório via WhatsApp',
        tipoComunicacao: 'RELATORIO'
    });
}

/**
 * Envia todas as notas filtradas no relatório juntas em uma única mensagem no WhatsApp.
 */
async function enviarWhatsAppTodasNotasFiltradas() {
    if (typeof ultimoResultadoRelatorio === 'undefined' || !ultimoResultadoRelatorio) {
        if (typeof Swal !== 'undefined') Swal.fire('Aviso', 'Nenhum relatório foi gerado para envio.', 'info');
        return;
    }

    var dados = ultimoResultadoRelatorio.dados || {};
    var registros = dados.registros || [];
    var cfg = (typeof obterConfiguracoesEmpresaSegura === 'function') ? obterConfiguracoesEmpresaSegura() : {};
    var hojeISO = (typeof obterDataLocalISO === 'function') ? obterDataLocalISO() : new Date().toISOString().slice(0, 10);

    var clienteAlvo = null;
    var f = (typeof estadoFiltrosRelatorio !== 'undefined') ? estadoFiltrosRelatorio : {};
    if (f.clienteFiltro && f.clienteFiltro !== 'TODOS') {
        if (typeof obterClientePorIdOuChave === 'function') {
            clienteAlvo = obterClientePorIdOuChave(f.clienteFiltro);
        }
    }

    var notasPendentes = registros.filter(function(r) {
        if (!r || r.status === 'CANCELADA') return false;
        var saldo = (r.saldoDevedor !== undefined) ? r.saldoDevedor : (r.saldo !== undefined ? r.saldo : 0);
        return saldo > 0;
    });

    if (notasPendentes.length === 0) {
        if (typeof Swal !== 'undefined') Swal.fire('Aviso', 'Não há notas com saldo pendente nos registros filtrados.', 'info');
        return;
    }

    if (!clienteAlvo && notasPendentes[0]) {
        var cliId = notasPendentes[0].clienteId;
        if (cliId && typeof obterClientePorIdOuChave === 'function') {
            clienteAlvo = obterClientePorIdOuChave(cliId);
        }
        if (!clienteAlvo) {
            clienteAlvo = {
                nome: notasPendentes[0].cliente || 'Cliente',
                telefone: notasPendentes[0].telefone || ''
            };
        }
    }

    var msg = gerarMensagemWhatsAppNotasConsolidadas(clienteAlvo, notasPendentes, cfg, hojeISO);
    var telDestino = (clienteAlvo && clienteAlvo.telefone) ? clienteAlvo.telefone : (notasPendentes[0] ? notasPendentes[0].telefone : '');

    await abrirModalEnvioWhatsApp({
        telefone: telDestino,
        mensagem: msg,
        titulo: '📲 Enviar Todas as Notas Filtradas (WhatsApp)',
        clienteId: clienteAlvo ? clienteAlvo.id : null,
        tipoComunicacao: 'CONSOLIDADO_NOTAS'
    });
}

/**
 * Envia todas as notas pendentes de um cliente juntas no WhatsApp.
 */
async function enviarWhatsAppTodasNotasCliente(clienteIdOuChave) {
    var resolvido = (typeof resolverClienteEResumoPorIdentificador === 'function')
        ? resolverClienteEResumoPorIdentificador(clienteIdOuChave)
        : null;
    var cliente = resolvido ? resolvido.cliente : null;

    if (!cliente && typeof obterClientePorIdOuChave === 'function') {
        cliente = obterClientePorIdOuChave(clienteIdOuChave);
    }
    if (!cliente && typeof mapaGlobalClientes !== 'undefined' && clienteIdOuChave) {
        cliente = mapaGlobalClientes[clienteIdOuChave];
    }
    if (!cliente && typeof clientesMap !== 'undefined' && clienteIdOuChave) {
        cliente = clientesMap[clienteIdOuChave];
    }
    if (!cliente && typeof listaGlobalClientes !== 'undefined') {
        cliente = listaGlobalClientes.find(function(c) {
            return c && (c.id === clienteIdOuChave || c.codigo === clienteIdOuChave);
        });
    }
    if (!cliente && typeof clienteIdFichaAtual !== 'undefined' && clienteIdFichaAtual) {
        if (typeof resolverClienteEResumoPorIdentificador === 'function') {
            var resFichaTodas = resolverClienteEResumoPorIdentificador(clienteIdFichaAtual);
            if (resFichaTodas) {
                cliente = resFichaTodas.cliente;
                if (!resolvido) resolvido = resFichaTodas;
            }
        }
    }

    if (!cliente) {
        if (typeof Swal !== 'undefined') Swal.fire('Atenção', 'Selecione ou abra a ficha de um cliente para enviar as notas.', 'warning');
        return;
    }

    var notasRef = (typeof listaGlobalNotasPrazo !== 'undefined') ? listaGlobalNotasPrazo : [];
    var todasNotasCliente = (resolvido && resolvido.resumoCarteira && Array.isArray(resolvido.resumoCarteira.notasDoCliente))
        ? resolvido.resumoCarteira.notasDoCliente
        : notasRef.filter(function(n) {
            if (!n || n.status === 'CANCELADA') return false;
            if (typeof notaPertenceAoCliente === 'function') {
                return notaPertenceAoCliente(n, cliente);
            }
            return n.clienteId === cliente.id || (n.cliente && n.cliente.toLowerCase() === (cliente.nome || '').toLowerCase());
        });

    var notasPendentes = todasNotasCliente.filter(function(n) {
        if (!n || n.status === 'CANCELADA') return false;
        var saldo = (n.saldo !== undefined) ? n.saldo : ((typeof calcularSaldoNota === 'function') ? calcularSaldoNota(n) : 0);
        return saldo > 0;
    });

    if (notasPendentes.length === 0) {
        if (typeof Swal !== 'undefined') Swal.fire('Aviso', 'Nenhuma nota com saldo pendente localizada para este cliente.', 'info');
        return;
    }

    var cfg = (typeof obterConfiguracoesEmpresaSegura === 'function') ? obterConfiguracoesEmpresaSegura() : {};
    var hojeISO = (typeof obterDataLocalISO === 'function') ? obterDataLocalISO() : new Date().toISOString().slice(0, 10);
    var msg = gerarMensagemWhatsAppNotasConsolidadas(cliente, notasPendentes, cfg, hojeISO);

    await abrirModalEnvioWhatsApp({
        telefone: (cliente && cliente.telefone) ? cliente.telefone : (notasPendentes[0] ? notasPendentes[0].telefone : ''),
        mensagem: msg,
        titulo: '📲 Enviar Todas as Notas do Cliente (WhatsApp)',
        clienteId: cliente ? cliente.id : null,
        tipoComunicacao: 'CONSOLIDADO_NOTAS_CLIENTE'
    });
}

// Export para testes em ambiente Node.js / VM
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        construirUrlWhatsApp: construirUrlWhatsApp,
        formatarMoedaTextoZap: formatarMoedaTextoZap,
        formatarDataTextoZap: formatarDataTextoZap,
        calcularSituacaoNotaSeguraZap: calcularSituacaoNotaSeguraZap,
        gerarMensagemWhatsAppEmissaoNota: gerarMensagemWhatsAppEmissaoNota,
        gerarMensagemWhatsAppReciboPagamento: gerarMensagemWhatsAppReciboPagamento,
        gerarMensagemWhatsAppLembreteVencimento: gerarMensagemWhatsAppLembreteVencimento,
        gerarMensagemWhatsAppCobrancaNota: gerarMensagemWhatsAppCobrancaNota,
        gerarMensagemWhatsAppExtratoCliente: gerarMensagemWhatsAppExtratoCliente,
        gerarMensagemWhatsAppNotasConsolidadas: gerarMensagemWhatsAppNotasConsolidadas,
        gerarMensagemWhatsAppResumoRelatorio: gerarMensagemWhatsAppResumoRelatorio,
        listarAlertasVencimentoECobranca: listarAlertasVencimentoECobranca,
        enviarWhatsAppTodasNotasFiltradas: enviarWhatsAppTodasNotasFiltradas,
        enviarWhatsAppTodasNotasCliente: enviarWhatsAppTodasNotasCliente,
        enviarWhatsAppExtratoCliente: enviarWhatsAppExtratoCliente,
        enviarWhatsAppCobrancaCliente: enviarWhatsAppCobrancaCliente
    };
}

