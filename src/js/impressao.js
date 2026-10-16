// [FASE 3 / T-302] Motor de Impressão Profissional A4 Multipágina - Tucano Cloud
// Regras Permanentes (AGENTS.md):
// 1. Apenas 'var' e 'function' no nível superior (compatível com vm.runInContext e browser clássico).
// 2. Proibido acessar DOM/Firebase/Storage/Swal no topo do arquivo.
// 3. Sem colisão de identificadores com index.html, nucleo-financeiro.js, clientes.js, relatorios.js ou configuracoes.js.

// =========================================================================
// PARTE 1 — GERADORES PUROS DE HTML PARA IMPRESSÃO A4 (VM-SAFE)
// =========================================================================

/**
 * Formata valor monetário puro para impressão.
 */
function formatarMoedaImpressao(valor) {
    if (typeof formatarMoedaRelatorio === 'function') {
        return formatarMoedaRelatorio(valor);
    }
    var num = typeof valor === 'number' ? valor : (parseFloat(valor) || 0);
    return 'R$ ' + num.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Converte data ISO YYYY-MM-DD para formato brasileiro DD/MM/YYYY.
 */
function formatarDataImpressaoBr(dataIso) {
    if (!dataIso) return '-';
    var str = String(dataIso).slice(0, 10);
    var p = str.split('-');
    if (p.length !== 3) return str;
    return p[2] + '/' + p[1] + '/' + p[0];
}

/**
 * Escapa HTML de forma pura e segura.
 */
function impressaoEscapeHtml(texto) {
    if (typeof nucleoEscapeHtml === 'function') {
        return nucleoEscapeHtml(texto);
    }
    if (texto === null || texto === undefined) return '';
    return String(texto)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * 1. Gera o cabeçalho padronizado da empresa para documentos A4.
 */
function gerarCabecalhoEmpresaPrintHtml(configEmpresa, tituloDocumento, subtituloDocumento, corDestaque) {
    var cfg = (configEmpresa && typeof configEmpresa === 'object') ? configEmpresa : {};
    var nome = impressaoEscapeHtml(cfg.nomeFantasia || 'TUCANO AUTO PEÇAS');
    var sub = impressaoEscapeHtml(cfg.subtitulo || 'Comércio de Peças e Acessórios Automotivos');
    var tit = impressaoEscapeHtml(tituloDocumento || 'DOCUMENTO OFICIAL');
    var subTit = subtituloDocumento ? impressaoEscapeHtml(subtituloDocumento) : '';
    var cor = corDestaque || '#000000';

    var dadosExtras = [];
    if (cfg.cnpj) dadosExtras.push('CNPJ: ' + impressaoEscapeHtml(cfg.cnpj));
    if (cfg.inscricaoEstadual) dadosExtras.push('IE: ' + impressaoEscapeHtml(cfg.inscricaoEstadual));
    if (cfg.endereco) dadosExtras.push(impressaoEscapeHtml(cfg.endereco));
    if (cfg.telefone || cfg.whatsappLoja) dadosExtras.push('Tel/WhatsApp: ' + impressaoEscapeHtml(cfg.whatsappLoja || cfg.telefone));

    var linhaExtras = dadosExtras.length > 0
        ? '<p style="font-size:10px !important; margin:2px 0 0 0; color:#475569;">' + dadosExtras.join(' • ') + '</p>'
        : '';

    return `
        <div style="text-align:center; border-bottom:2px solid #000; padding-bottom:12px; margin-bottom:16px;">
            <h1 style="font-size:20px !important; letter-spacing:1px; margin:0; font-weight:900; text-transform:uppercase;">${nome}</h1>
            <p style="font-size:11px !important; margin:2px 0 0 0; color:#333;">${sub}</p>
            ${linhaExtras}
            <h2 style="font-size:15px !important; margin-top:8px; text-transform:uppercase; font-weight:900; color:${cor};">
                ${tit}
            </h2>
            ${subTit ? '<p style="font-size:10.5px !important; margin:2px 0 0 0; color:#64748b; font-weight:600;">' + subTit + '</p>' : ''}
        </div>
    `;
}

/**
 * 2. Gera o bloco informativo de pagamento via PIX se a empresa possuir chave configurada.
 */
function gerarBlocoPixPrintHtml(configEmpresa, valorSugerido) {
    var cfg = (configEmpresa && typeof configEmpresa === 'object') ? configEmpresa : {};
    if (!cfg.chavePix) return '';

    var valorTxt = '';
    if (typeof valorSugerido === 'number' && valorSugerido > 0) {
        valorTxt = ' (Valor a pagar: <strong>' + formatarMoedaImpressao(valorSugerido) + '</strong>)';
    }

    return `
        <div style="margin-top:14px; padding:10px 14px; border:1.5px dashed #0284c7; background:#f0f9ff; border-radius:6px; font-size:10.5px; line-height:1.4;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <div>
                    <strong style="color:#0369a1; text-transform:uppercase; font-size:11px;">💵 PAGAMENTO RÁPIDO VIA PIX${valorTxt}:</strong><br>
                    <span>Chave (${impressaoEscapeHtml(cfg.tipoChavePix || 'Chave')}): <strong style="font-family:monospace; font-size:12px; color:#0f172a;">${impressaoEscapeHtml(cfg.chavePix)}</strong></span>
                </div>
                <div style="text-align:right;">
                    <span style="color:#64748b; font-size:10px;">Beneficiário / Titular:</span><br>
                    <strong style="color:#0f172a; font-size:11px;">${impressaoEscapeHtml(cfg.titularPix || cfg.nomeFantasia || 'Tucano Auto Peças')}</strong>
                </div>
            </div>
        </div>
    `;
}

/**
 * 3. Gera o documento completo A4 de uma Nota a Prazo.
 */
function gerarHtmlImpressaoNotaPrazoA4(nota, configEmpresa, dataReferenciaISO) {
    if (!nota) return '<div class="p-8 text-center text-red-600">Nota não informada para impressão.</div>';

    var cfg = (configEmpresa && typeof configEmpresa === 'object') ? configEmpresa : {};
    var hojeRef = dataReferenciaISO || (typeof obterDataLocalISO === 'function' ? obterDataLocalISO() : new Date().toISOString().slice(0, 10));

    var valorOrig = parseFloat(nota.valorOriginal) || 0;
    var pagtos = [];
    if (typeof extrairPagamentosNota === 'function') {
        pagtos = extrairPagamentosNota(nota);
    } else if (Array.isArray(nota.pagamentos)) {
        pagtos = nota.pagamentos;
    } else if (nota.pagamentos && typeof nota.pagamentos === 'object') {
        pagtos = Object.values(nota.pagamentos);
    }

    var pagtosAtivos = pagtos.filter(function(p) { return p && p.status !== 'ESTORNADO'; });
    var totRecCent = 0;
    for (var i = 0; i < pagtosAtivos.length; i++) {
        var p = pagtosAtivos[i];
        if (typeof moedaParaCentavos === 'function') {
            totRecCent += moedaParaCentavos(p.valor);
        } else {
            totRecCent += Math.round((parseFloat(p.valor) || 0) * 100);
        }
    }

    var totalPago = (typeof centavosParaReais === 'function') ? centavosParaReais(totRecCent) : (totRecCent / 100);
    var vOrigCent = (typeof moedaParaCentavos === 'function') ? moedaParaCentavos(valorOrig) : Math.round(valorOrig * 100);
    var saldoCent = (nota.status === 'CANCELADA') ? 0 : Math.max(0, vOrigCent - totRecCent);
    var saldo = (typeof centavosParaReais === 'function') ? centavosParaReais(saldoCent) : (saldoCent / 100);

    var tabelaPagtosHtml = '';
    if (pagtosAtivos.length > 0) {
        var linhasP = '';
        for (var j = 0; j < pagtosAtivos.length; j++) {
            var b = pagtosAtivos[j];
            linhasP += `
                <tr style="border-bottom:1px dotted #cbd5e1;">
                    <td style="padding:4px; font-family:monospace;">${impressaoEscapeHtml(b.numeroRecibo || '-')}</td>
                    <td style="padding:4px;">${formatarDataImpressaoBr(b.dataPagamento || b.data)}</td>
                    <td style="padding:4px;">${impressaoEscapeHtml(b.formaPagamento || '-')}</td>
                    <td style="padding:4px; text-align:right; font-weight:bold; color:#15803d;">${formatarMoedaImpressao(b.valor)}</td>
                </tr>
            `;
        }

        tabelaPagtosHtml = `
            <div style="margin-top:14px; border:1px solid #cbd5e1; padding:10px; border-radius:6px; background:#f8fafc;">
                <strong style="font-size:11px; text-transform:uppercase; color:#334155;">Histórico de Pagamentos Recebidos (${pagtosAtivos.length} baixas):</strong>
                <table style="width:100%; border-collapse:collapse; margin-top:6px; font-size:10.5px;">
                    <thead>
                        <tr style="border-bottom:1px solid #94a3b8; text-align:left; color:#475569;">
                            <th style="padding:4px;">Recibo</th>
                            <th style="padding:4px;">Data</th>
                            <th style="padding:4px;">Forma</th>
                            <th style="padding:4px; text-align:right;">Valor</th>
                        </tr>
                    </thead>
                    <tbody>${linhasP}</tbody>
                </table>
            </div>
        `;
    }

    var blocoPix = (saldo > 0) ? gerarBlocoPixPrintHtml(cfg, saldo) : '';

    return `
        <div class="a4-print-full">
            <div>
                ${gerarCabecalhoEmpresaPrintHtml(cfg, 'COMPROVANTE DE NOTA A PRAZO / CONTAS A RECEBER', 'Venda a Prazo Vinculada ao Cliente')}

                <div style="display:flex; justify-content:space-between; background:#f1f5f9; padding:10px 14px; border:1px solid #cbd5e1; border-radius:6px; margin-bottom:16px;">
                    <div>
                        <span style="font-size:10.5px; color:#475569;">Nº DE CONTROLE:</span><br>
                        <strong style="font-size:16px; font-family:monospace; color:#0f172a;">${impressaoEscapeHtml(nota.numeroControle || nota.id)}</strong>
                    </div>
                    <div style="text-align:center;">
                        <span style="font-size:10.5px; color:#475569;">EMISSÃO:</span><br>
                        <strong style="font-size:14px;">${formatarDataImpressaoBr(nota.dataEmissao)}</strong>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:10.5px; color:#475569;">VENCIMENTO:</span><br>
                        <strong style="font-size:16px; color:#b91c1c;">${formatarDataImpressaoBr(nota.dataVencimento)}</strong>
                    </div>
                </div>

                <table style="width:100%; border-collapse:collapse; margin-bottom:16px; font-size:11.5px;">
                    <tr>
                        <td style="padding:6px; border:1px solid #cbd5e1; width:60%;"><strong>CLIENTE:</strong> ${impressaoEscapeHtml(nota.cliente ? nota.cliente.toUpperCase() : 'S/ NOME')}</td>
                        <td style="padding:6px; border:1px solid #cbd5e1;"><strong>CPF / CNPJ:</strong> ${impressaoEscapeHtml(nota.cpfCnpj || '-')}</td>
                    </tr>
                    <tr>
                        <td style="padding:6px; border:1px solid #cbd5e1;"><strong>TELEFONE:</strong> ${impressaoEscapeHtml(nota.telefone || '-')}</td>
                        <td style="padding:6px; border:1px solid #cbd5e1;"><strong>Nº PEDIDO / DOC:</strong> ${impressaoEscapeHtml(nota.numeroPedido || nota.numeroDocumento || '-')}</td>
                    </tr>
                    <tr>
                        <td colspan="2" style="padding:6px; border:1px solid #cbd5e1;">
                            <strong>OBSERVAÇÕES / REFERÊNCIA:</strong><br>
                            ${impressaoEscapeHtml(nota.observacao || 'Venda de mercadorias / autopeças a prazo.')}
                        </td>
                    </tr>
                </table>

                <div style="display:flex; gap:10px; margin-bottom:16px;">
                    <div style="flex:1; border:2px solid #000; padding:10px; text-align:center; border-radius:6px;">
                        <div style="font-size:10px; font-weight:bold; text-transform:uppercase;">VALOR ORIGINAL</div>
                        <div style="font-size:20px; font-weight:900; margin-top:3px;">${formatarMoedaImpressao(valorOrig)}</div>
                    </div>
                    <div style="flex:1; border:2px solid #000; padding:10px; text-align:center; border-radius:6px; background:#f8fafc;">
                        <div style="font-size:10px; font-weight:bold; text-transform:uppercase;">TOTAL RECEBIDO</div>
                        <div style="font-size:20px; font-weight:900; color:#15803d; margin-top:3px;">${formatarMoedaImpressao(totalPago)}</div>
                    </div>
                    <div style="flex:1; border:2px solid #000; padding:10px; text-align:center; border-radius:6px; background:${saldo > 0 ? '#fef2f2' : '#f0fdf4'};">
                        <div style="font-size:10px; font-weight:bold; text-transform:uppercase;">SALDO RESTANTE</div>
                        <div style="font-size:20px; font-weight:900; color:${saldo > 0 ? '#b91c1c' : '#15803d'}; margin-top:3px;">${formatarMoedaImpressao(saldo)}</div>
                    </div>
                </div>

                ${tabelaPagtosHtml}
                ${blocoPix}

                <div style="margin-top:20px; padding:12px; border:1px dashed #666; background:#fafafa; font-size:10.5px; line-height:1.5; border-radius:6px;">
                    <strong>TERMO DE RECONHECIMENTO DE DÍVIDA:</strong><br>
                    Reconheço(emos) a exatidão da dívida acima descrita, correspondente à aquisição de mercadorias e/ou prestação de serviços junto à <strong>${impressaoEscapeHtml(cfg.nomeFantasia || 'TUCANO AUTO PEÇAS')}</strong>, e comprometo-me(nos) a efetuar a liquidação integral até a data de vencimento indicada neste comprovante.
                </div>
            </div>

            <div>
                <div style="display:flex; justify-content:space-between; margin-top:45px; padding-bottom:10px;">
                    <div class="linha-assinatura-a4">
                        <strong>${impressaoEscapeHtml(cfg.nomeFantasia || 'TUCANO AUTO PEÇAS')}</strong><br>
                        <span>Responsável Financeiro</span>
                    </div>
                    <div class="linha-assinatura-a4">
                        <strong>${impressaoEscapeHtml(nota.cliente ? nota.cliente.toUpperCase() : 'ASSINATURA DO CLIENTE')}</strong><br>
                        <span>Assinatura do Cliente / Devedor</span>
                    </div>
                </div>
                <div style="text-align:center; font-size:10px; color:#64748b; margin-top:8px;">
                    ${impressaoEscapeHtml(cfg.rodapeDocumentos || 'Obrigado pela preferência e parceria!')}
                </div>
            </div>
        </div>
    `;
}

/**
 * 4. Gera o documento completo A4 de um Recibo de Pagamento, Quitação ou Estorno.
 */
function gerarHtmlImpressaoReciboPagamentoA4(nota, idPagamento, opcoes, configEmpresa) {
    if (!nota) return '<div class="p-8 text-center text-red-600">Nota não informada para emissão de recibo.</div>';

    var cfg = (configEmpresa && typeof configEmpresa === 'object') ? configEmpresa : {};
    var opt = (opcoes && typeof opcoes === 'object') ? opcoes : {};
    var isSegundaVia = Boolean(opt.segundaVia);

    var pagtos = [];
    if (typeof extrairPagamentosNota === 'function') {
        pagtos = extrairPagamentosNota(nota);
    } else if (Array.isArray(nota.pagamentos)) {
        pagtos = nota.pagamentos;
    } else if (nota.pagamentos && typeof nota.pagamentos === 'object') {
        pagtos = Object.values(nota.pagamentos);
    }

    var pagto = pagtos.find(function(p) { return p && String(p.id) === String(idPagamento); });
    if (!pagto) {
        return '<div class="p-8 text-center text-red-600">Pagamento não localizado nesta nota.</div>';
    }

    var valorOrig = parseFloat(nota.valorOriginal) || 0;
    var valorPago = parseFloat(pagto.valor) || 0;

    // Caso 1: Pagamento ESTORNADO -> Gera Comprovante Oficial de Estorno
    if (pagto.status === 'ESTORNADO') {
        return `
            <div class="a4-print-full">
                <div>
                    ${gerarCabecalhoEmpresaPrintHtml(cfg, 'COMPROVANTE DE ESTORNO DE PAGAMENTO', 'Operação Financeira Cancelada / Revertida', '#dc2626')}

                    <div style="display:flex; justify-content:space-between; background:#fef2f2; padding:10px 14px; border:1.5px solid #f87171; border-radius:6px; margin-bottom:16px;">
                        <div>
                            <span style="font-size:10.5px; color:#991b1b;">Nº DO RECIBO ESTORNADO:</span><br>
                            <strong style="font-size:16px; font-family:monospace; color:#dc2626;">${impressaoEscapeHtml(pagto.numeroRecibo || pagto.id)}</strong>
                        </div>
                        <div style="text-align:center;">
                            <span style="font-size:10.5px; color:#991b1b;">NOTA VINCULADA:</span><br>
                            <strong style="font-size:14px; font-family:monospace;">${impressaoEscapeHtml(nota.numeroControle || nota.id)}</strong>
                        </div>
                        <div style="text-align:right;">
                            <span style="font-size:10.5px; color:#991b1b;">DATA DO ESTORNO:</span><br>
                            <strong style="font-size:14px; color:#dc2626;">${formatarDataImpressaoBr(pagto.estornadoEm || pagto.dataPagamento)}</strong>
                        </div>
                    </div>

                    <table style="width:100%; border-collapse:collapse; margin-bottom:16px; font-size:11.5px;">
                        <tr>
                            <td style="padding:6px; border:1px solid #cbd5e1; width:60%;"><strong>CLIENTE:</strong> ${impressaoEscapeHtml(nota.cliente ? nota.cliente.toUpperCase() : 'S/ NOME')}</td>
                            <td style="padding:6px; border:1px solid #cbd5e1;"><strong>CPF / CNPJ:</strong> ${impressaoEscapeHtml(nota.cpfCnpj || '-')}</td>
                        </tr>
                        <tr>
                            <td style="padding:6px; border:1px solid #cbd5e1;"><strong>VALOR DO ESTORNO:</strong> <strong style="color:#dc2626; font-size:13px;">${formatarMoedaImpressao(valorPago)}</strong></td>
                            <td style="padding:6px; border:1px solid #cbd5e1;"><strong>FORMA DE ORIGEM:</strong> ${impressaoEscapeHtml(pagto.formaPagamento || 'Dinheiro')}</td>
                        </tr>
                        <tr>
                            <td style="padding:6px; border:1px solid #cbd5e1;"><strong>OPERADOR DO ESTORNO:</strong> ${impressaoEscapeHtml(pagto.estornadoPor || pagto.operador || 'Sistema')}</td>
                            <td style="padding:6px; border:1px solid #cbd5e1;"><strong>DATA DO PAGAMENTO ORIGINAL:</strong> ${formatarDataImpressaoBr(pagto.dataPagamento)}</td>
                        </tr>
                        <tr>
                            <td colspan="2" style="padding:8px; border:1px solid #cbd5e1; background:#fff1f2;">
                                <strong>MOTIVO / JUSTIFICATIVA DO ESTORNO:</strong><br>
                                <span style="color:#991b1b; font-weight:600;">${impressaoEscapeHtml(pagto.motivoEstorno || 'Estorno autorizado de baixa indevida ou duplicada.')}</span>
                            </td>
                        </tr>
                    </table>

                    <div style="margin-top:20px; padding:12px; border:1px dashed #dc2626; background:#fafafa; font-size:11px; line-height:1.5; border-radius:6px; color:#7f1d1d;">
                        <strong>AVISO LEGAL DE AUDITORIA:</strong><br>
                        Este documento comprova o cancelamento e estorno da baixa financeira acima identificada. O valor foi restaurado ao saldo devedor da respectiva Nota a Prazo.
                    </div>
                </div>

                <div>
                    <div style="display:flex; justify-content:space-between; margin-top:50px; padding-bottom:10px;">
                        <div class="linha-assinatura-a4">
                            <strong>${impressaoEscapeHtml(cfg.nomeFantasia || 'TUCANO AUTO PEÇAS')}</strong><br>
                            <span>Responsável pelo Estorno</span>
                        </div>
                        <div class="linha-assinatura-a4">
                            <strong>${impressaoEscapeHtml(nota.cliente ? nota.cliente.toUpperCase() : 'CLIENTE')}</strong><br>
                            <span>Ciente do Cliente</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Caso 2: Pagamento ATIVO -> Gera Recibo de Pagamento ou Quitação
    var idxPagto = pagtos.findIndex(function(p) { return p && String(p.id) === String(idPagamento); });
    var pagtosAteEste = (idxPagto !== -1) ? pagtos.slice(0, idxPagto + 1) : pagtos;
    var pagtosAtivosAteAgora = pagtosAteEste.filter(function(p) { return p && p.status !== 'ESTORNADO'; });

    var totalRecebidoAcumulado = 0;
    var saldoRestante = 0;

    if (pagto.saldoAnterior !== undefined && pagto.saldoApos !== undefined) {
        saldoRestante = Math.max(0, parseFloat(pagto.saldoApos) || 0);
        totalRecebidoAcumulado = Math.max(0, Math.round((valorOrig - saldoRestante) * 100) / 100);
    } else {
        for (var k = 0; k < pagtosAtivosAteAgora.length; k++) {
            totalRecebidoAcumulado += parseFloat(pagtosAtivosAteAgora[k].valor) || 0;
        }
        totalRecebidoAcumulado = Math.round(totalRecebidoAcumulado * 100) / 100;
        saldoRestante = Math.max(0, Math.round((valorOrig - totalRecebidoAcumulado) * 100) / 100);
    }

    var isQuitacao = saldoRestante <= 0;
    var tituloRecibo = isQuitacao ? 'RECIBO DE QUITAÇÃO DEFINITIVA' : 'RECIBO DE PAGAMENTO';
    var subtituloRecibo = isSegundaVia ? '2ª VIA / REIMPRESSÃO OFICIAL' : 'Comprovante Oficial de Baixa Financeira';

    var valorExtenso = (typeof valorPorExtensoBRL === 'function')
        ? valorPorExtensoBRL(valorPago)
        : '';

    var blocoPixRestante = (saldoRestante > 0) ? gerarBlocoPixPrintHtml(cfg, saldoRestante) : '';

    return `
        <div class="a4-print-full">
            <div>
                ${gerarCabecalhoEmpresaPrintHtml(cfg, tituloRecibo, subtituloRecibo, isQuitacao ? '#15803d' : '#000000')}

                <div style="display:flex; justify-content:space-between; background:#f1f5f9; padding:10px 14px; border:1px solid #cbd5e1; border-radius:6px; margin-bottom:16px;">
                    <div>
                        <span style="font-size:10.5px; color:#475569;">Nº DO RECIBO:</span><br>
                        <strong style="font-size:16px; font-family:monospace; color:#1e40af;">${impressaoEscapeHtml(pagto.numeroRecibo || pagto.id)}</strong>
                        ${isSegundaVia ? '<span style="background:#f59e0b; color:#000; font-size:9.5px; font-weight:900; padding:1px 5px; border-radius:3px; margin-left:4px;">2ª VIA</span>' : ''}
                    </div>
                    <div style="text-align:center;">
                        <span style="font-size:10.5px; color:#475569;">NOTA VINCULADA:</span><br>
                        <strong style="font-size:14px; font-family:monospace;">${impressaoEscapeHtml(nota.numeroControle || nota.id)}</strong>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:10.5px; color:#475569;">DATA DO PAGAMENTO:</span><br>
                        <strong style="font-size:15px;">${formatarDataImpressaoBr(pagto.dataPagamento)}</strong>
                    </div>
                </div>

                <table style="width:100%; border-collapse:collapse; margin-bottom:16px; font-size:11.5px;">
                    <tr>
                        <td style="padding:6px; border:1px solid #cbd5e1; width:60%;"><strong>CLIENTE:</strong> ${impressaoEscapeHtml(nota.cliente ? nota.cliente.toUpperCase() : 'S/ NOME')}</td>
                        <td style="padding:6px; border:1px solid #cbd5e1;"><strong>CPF / CNPJ:</strong> ${impressaoEscapeHtml(nota.cpfCnpj || '-')}</td>
                    </tr>
                    <tr>
                        <td style="padding:6px; border:1px solid #cbd5e1;"><strong>Nº PEDIDO / DOC:</strong> ${impressaoEscapeHtml(nota.numeroPedido || nota.numeroDocumento || '-')}</td>
                        <td style="padding:6px; border:1px solid #cbd5e1;"><strong>FORMA DE PAGAMENTO:</strong> ${impressaoEscapeHtml(pagto.formaPagamento || 'Dinheiro')}</td>
                    </tr>
                    <tr>
                        <td style="padding:6px; border:1px solid #cbd5e1;"><strong>EMISSÃO DA VENDA:</strong> ${formatarDataImpressaoBr(nota.dataEmissao)}</td>
                        <td style="padding:6px; border:1px solid #cbd5e1;"><strong>VENCIMENTO ORIGINAL:</strong> ${formatarDataImpressaoBr(nota.dataVencimento)}</td>
                    </tr>
                    <tr>
                        <td colspan="2" style="padding:6px; border:1px solid #cbd5e1;">
                            <strong>OBSERVAÇÕES DO PAGAMENTO:</strong><br>
                            ${impressaoEscapeHtml(pagto.observacao || 'Pagamento referente à Nota a Prazo indicada acima.')}
                        </td>
                    </tr>
                </table>

                <div style="display:flex; gap:10px; margin-bottom:18px;">
                    <div style="flex:1; border:1.5px solid #64748b; padding:10px; text-align:center; border-radius:6px;">
                        <div style="font-size:10px; font-weight:bold; text-transform:uppercase;">VALOR ORIGINAL</div>
                        <div style="font-size:18px; font-weight:bold; margin-top:3px;">${formatarMoedaImpressao(valorOrig)}</div>
                    </div>
                    <div style="flex:1.2; border:2.5px solid #16a34a; padding:10px; text-align:center; border-radius:6px; background:#f0fdf4;">
                        <div style="font-size:10.5px; font-weight:900; text-transform:uppercase; color:#15803d;">PAGO NESTE RECIBO</div>
                        <div style="font-size:22px; font-weight:900; color:#15803d; margin-top:3px;">${formatarMoedaImpressao(valorPago)}</div>
                    </div>
                    <div style="flex:1; border:1.5px solid #64748b; padding:10px; text-align:center; border-radius:6px;">
                        <div style="font-size:10px; font-weight:bold; text-transform:uppercase;">TOTAL RECEBIDO</div>
                        <div style="font-size:18px; font-weight:bold; margin-top:3px;">${formatarMoedaImpressao(totalRecebidoAcumulado)}</div>
                    </div>
                    <div style="flex:1; border:1.5px solid #64748b; padding:10px; text-align:center; border-radius:6px; background:${saldoRestante > 0 ? '#fef2f2' : '#f0fdf4'};">
                        <div style="font-size:10px; font-weight:bold; text-transform:uppercase;">SALDO RESTANTE</div>
                        <div style="font-size:18px; font-weight:900; color:${saldoRestante > 0 ? '#b91c1c' : '#15803d'}; margin-top:3px;">
                            ${formatarMoedaImpressao(saldoRestante)}
                        </div>
                    </div>
                </div>

                ${blocoPixRestante}

                <div style="margin-top:16px; padding:12px; border:1px solid #94a3b8; background:#f8fafc; font-size:11px; line-height:1.6; border-radius:6px;">
                    <strong>DECLARAÇÃO DE RECEBIMENTO:</strong><br>
                    Declaramos para os devidos fins que recebemos de <strong>${impressaoEscapeHtml(nota.cliente ? nota.cliente.toUpperCase() : 'CLIENTE')}</strong> a importância de <strong>${formatarMoedaImpressao(valorPago)}${valorExtenso ? ' (' + impressaoEscapeHtml(valorExtenso) + ')' : ''}</strong> através de <strong>${impressaoEscapeHtml(pagto.formaPagamento || 'Dinheiro')}</strong>, referente ao ${isQuitacao ? '<strong>PAGAMENTO TOTAL E QUITAÇÃO DEFINITIVA</strong>' : '<strong>PAGAMENTO PARCIAL</strong>'} da Nota a Prazo nº <strong>${impressaoEscapeHtml(nota.numeroControle || nota.id)}</strong>${saldoRestante > 0 ? `, restando o saldo de <strong>${formatarMoedaImpressao(saldoRestante)}</strong>` : ''}.
                </div>
            </div>

            <div>
                <div style="display:flex; justify-content:space-between; margin-top:50px; padding-bottom:10px;">
                    <div class="linha-assinatura-a4">
                        <strong>${impressaoEscapeHtml(cfg.nomeFantasia || 'TUCANO AUTO PEÇAS')}</strong><br>
                        <span>Responsável pelo Recebimento</span>
                    </div>
                    <div class="linha-assinatura-a4">
                        <strong>${impressaoEscapeHtml(nota.cliente ? nota.cliente.toUpperCase() : 'ASSINATURA DO CLIENTE')}</strong><br>
                        <span>Assinatura do Cliente / Pagador</span>
                    </div>
                </div>
                <div style="text-align:center; font-size:10px; color:#64748b; margin-top:8px;">
                    ${impressaoEscapeHtml(cfg.rodapeDocumentos || 'Obrigado pela preferência e parceria!')}
                </div>
            </div>
        </div>
    `;
}

/**
 * 5. Gera o extrato de conta corrente / posição consolidada da carteira de um cliente (multipage A4).
 */
function gerarHtmlImpressaoExtratoClienteA4(cliente, resumoCarteira, configEmpresa, dataReferenciaISO) {
    if (!cliente) return '<div class="p-8 text-center text-red-600">Cliente não informado para impressão de extrato.</div>';

    var cfg = (configEmpresa && typeof configEmpresa === 'object') ? configEmpresa : {};
    var r = (resumoCarteira && typeof resumoCarteira === 'object') ? resumoCarteira : {};
    var hojeRef = dataReferenciaISO || (typeof obterDataLocalISO === 'function' ? obterDataLocalISO() : new Date().toISOString().slice(0, 10));

    var notasCli = Array.isArray(r.notas) ? r.notas : [];

    var linhasNotasHtml = '';
    for (var i = 0; i < notasCli.length; i++) {
        var n = notasCli[i];
        var sit = (typeof relatorioObterSituacaoNota === 'function') ? relatorioObterSituacaoNota(n) : { saldo: n.saldoDevedor || 0, totalRecebido: n.totalRecebido || 0, statusFinanceiro: n.status || 'ABERTA' };
        var classif = (typeof classificarFaixaVencimentoNota === 'function') ? classificarFaixaVencimentoNota(n, hojeRef) : { rotuloFaixa: '-' };

        var corSaldo = sit.saldo > 0 ? 'color:#b91c1c; font-weight:bold;' : 'color:#15803d;';

        linhasNotasHtml += `
            <tr>
                <td style="font-family:monospace; font-weight:bold;">${impressaoEscapeHtml(n.numeroControle || n.id)}</td>
                <td>${formatarDataImpressaoBr(n.dataEmissao)}</td>
                <td>${formatarDataImpressaoBr(n.dataVencimento)}</td>
                <td>${impressaoEscapeHtml(sit.statusFinanceiro)}</td>
                <td>${impressaoEscapeHtml(classif.rotuloFaixa)}</td>
                <td style="text-align:right;">${formatarMoedaImpressao(n.valorOriginal)}</td>
                <td style="text-align:right; color:#15803d;">${formatarMoedaImpressao(sit.totalRecebido)}</td>
                <td style="text-align:right; ${corSaldo}">${formatarMoedaImpressao(sit.saldo)}</td>
            </tr>
        `;
    }

    var totalComprado = r.totalOriginal !== undefined ? r.totalOriginal : 0;
    var totalPago = r.totalRecebido !== undefined ? r.totalRecebido : 0;
    var saldoDevedor = r.saldoTotal !== undefined ? r.saldoTotal : 0;

    var blocoPix = (saldoDevedor > 0) ? gerarBlocoPixPrintHtml(cfg, saldoDevedor) : '';

    return `
        <div class="a4-print-relatorio">
            ${gerarCabecalhoEmpresaPrintHtml(cfg, 'EXTRATO DE CONTA CORRENTE / POSIÇÃO CONSOLIDADA', 'Ficha Financeira e Histórico de Lançamentos')}

            <div style="background:#f1f5f9; padding:10px 14px; border:1px solid #cbd5e1; border-radius:6px; margin-bottom:16px; font-size:11px;">
                <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                    <div>
                        <strong style="font-size:13px; color:#0f172a;">${impressaoEscapeHtml(cliente.nome ? cliente.nome.toUpperCase() : 'S/ NOME')}</strong>
                        <span style="font-family:monospace; color:#475569; margin-left:6px;">(${impressaoEscapeHtml(cliente.codigo || 'CLI')})</span><br>
                        <span>CPF / CNPJ: <strong>${impressaoEscapeHtml(cliente.cpfCnpj || '-')}</strong> • Telefone: <strong>${impressaoEscapeHtml(cliente.telefone || '-')}</strong></span><br>
                        <span>Endereço: <strong>${impressaoEscapeHtml(cliente.endereco || '-')}</strong></span>
                    </div>
                    <div style="text-align:right;">
                        <span>Limite de Crédito: <strong>${formatarMoedaImpressao(cliente.limiteCredito || 0)}</strong></span><br>
                        <span>Saldo Devedor Atual: <strong style="color:#b91c1c; font-size:13px;">${formatarMoedaImpressao(saldoDevedor)}</strong></span><br>
                        <span>Emissão do Extrato: <strong>${formatarDataImpressaoBr(hojeRef)}</strong></span>
                    </div>
                </div>
            </div>

            <div style="display:flex; gap:10px; margin-bottom:16px;">
                <div style="flex:1; border:1.5px solid #64748b; padding:8px; text-align:center; border-radius:6px;">
                    <div style="font-size:9.5px; font-weight:bold; text-transform:uppercase; color:#475569;">TOTAL EM COMPRAS</div>
                    <div style="font-size:16px; font-weight:900; margin-top:2px;">${formatarMoedaImpressao(totalComprado)}</div>
                </div>
                <div style="flex:1; border:1.5px solid #16a34a; padding:8px; text-align:center; border-radius:6px; background:#f0fdf4;">
                    <div style="font-size:9.5px; font-weight:900; text-transform:uppercase; color:#15803d;">TOTAL JÁ PAGO</div>
                    <div style="font-size:16px; font-weight:900; color:#15803d; margin-top:2px;">${formatarMoedaImpressao(totalPago)}</div>
                </div>
                <div style="flex:1; border:1.5px solid #b91c1c; padding:8px; text-align:center; border-radius:6px; background:#fef2f2;">
                    <div style="font-size:9.5px; font-weight:900; text-transform:uppercase; color:#b91c1c;">SALDO DEVEDOR ATUAL</div>
                    <div style="font-size:16px; font-weight:900; color:#b91c1c; margin-top:2px;">${formatarMoedaImpressao(saldoDevedor)}</div>
                </div>
            </div>

            ${blocoPix}

            <div style="margin-top:14px; margin-bottom:18px;">
                <h3 style="font-size:12px; font-weight:bold; text-transform:uppercase; margin-bottom:6px; border-bottom:1px solid #000; padding-bottom:3px;">
                    Histórico de Notas a Prazo (${notasCli.length} títulos):
                </h3>
                <table>
                    <thead>
                        <tr>
                            <th>Nº Controle</th>
                            <th>Emissão</th>
                            <th>Vencimento</th>
                            <th>Status</th>
                            <th>Situação</th>
                            <th style="text-align:right;">Valor Original</th>
                            <th style="text-align:right;">Recebido</th>
                            <th style="text-align:right;">Saldo</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${linhasNotasHtml || '<tr><td colspan="8" style="text-align:center; padding:12px; font-style:italic;">Nenhuma nota encontrada para este cliente.</td></tr>'}
                    </tbody>
                    <tfoot>
                        <tr style="background:#f8fafc; font-weight:bold; border-top:2px solid #000;">
                            <td colspan="5">AUTO-SOMA DO EXTRATO (${notasCli.length} títulos):</td>
                            <td style="text-align:right;">${formatarMoedaImpressao(totalComprado)}</td>
                            <td style="text-align:right; color:#15803d;">${formatarMoedaImpressao(totalPago)}</td>
                            <td style="text-align:right; color:#b91c1c;">${formatarMoedaImpressao(saldoDevedor)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div style="display:flex; justify-content:space-between; margin-top:40px; padding-bottom:10px;">
                <div class="linha-assinatura-a4">
                    <strong>${impressaoEscapeHtml(cfg.nomeFantasia || 'TUCANO AUTO PEÇAS')}</strong><br>
                    <span>Responsável Financeiro</span>
                </div>
                <div class="linha-assinatura-a4">
                    <strong>${impressaoEscapeHtml(cliente.nome ? cliente.nome.toUpperCase() : 'CLIENTE')}</strong><br>
                    <span>Ciente e Conferência do Cliente</span>
                </div>
            </div>
            <div style="text-align:center; font-size:10px; color:#64748b; margin-top:8px;">
                ${impressaoEscapeHtml(cfg.rodapeDocumentos || 'Obrigado pela preferência e parceria!')}
            </div>
        </div>
    `;
}

/**
 * 6. Gera o documento completo A4 multipágina de qualquer Relatório Analítico da Fase 2.
 */
function gerarHtmlImpressaoRelatorioA4(resultadoRelatorio, estadoFiltros, configEmpresa, operadorEmail) {
    if (!resultadoRelatorio || !resultadoRelatorio.dados) {
        return '<div class="p-8 text-center text-red-600">Nenhum resultado de relatório disponível para impressão.</div>';
    }

    var cfg = (configEmpresa && typeof configEmpresa === 'object') ? configEmpresa : {};
    var f = (estadoFiltros && typeof estadoFiltros === 'object') ? estadoFiltros : {};
    var res = resultadoRelatorio.dados;
    var auto = res.autoSoma || {};
    var intervalo = resultadoRelatorio.intervalo || {};
    var hojeRef = (typeof obterDataLocalISO === 'function') ? obterDataLocalISO() : new Date().toISOString().slice(0, 10);

    var tipo = (f && f.tipoRelatorio) || (resultadoRelatorio && resultadoRelatorio.tipo) || 'NOTAS_GERAL';
    var tituloRelatorio = 'RELATÓRIO DE NOTAS A PRAZO';
    if (tipo === 'NOTAS_VENCIMENTO') tituloRelatorio = 'RELATÓRIO DE CONTAS A RECEBER POR VENCIMENTO';
    else if (tipo === 'RECEBIMENTOS_PAGAMENTOS') tituloRelatorio = 'RELATÓRIO DE RECEBIMENTOS E FLUXO DE CAIXA';
    else if (tipo === 'NOTAS_GERAL') tituloRelatorio = 'RELATÓRIO GERAL DE NOTAS A PRAZO';
    else if (tipo === 'CLIENTES_POSICAO') tituloRelatorio = 'RELATÓRIO DE POSIÇÃO CONSOLIDADA POR CLIENTE';

    var htmlTotais = '';
    var htmlTabela = '';

    if (f.tipoRelatorio === 'RECEBIMENTOS_PAGAMENTOS') {
        htmlTotais = `
            <div style="display:flex; gap:10px; margin-bottom:14px;">
                <div style="flex:1; border:1px solid #cbd5e1; padding:8px; text-align:center; border-radius:4px;">
                    <div style="font-size:9px; font-weight:bold; text-transform:uppercase; color:#64748b;">PAGAMENTOS ATIVOS</div>
                    <div style="font-size:15px; font-weight:bold; color:#15803d; margin-top:2px;">${auto.quantidadePagamentosAtivos || 0} baixas</div>
                </div>
                <div style="flex:1; border:1px solid #cbd5e1; padding:8px; text-align:center; border-radius:4px; background:#f0fdf4;">
                    <div style="font-size:9px; font-weight:bold; text-transform:uppercase; color:#15803d;">TOTAL RECEBIDO ATIVO</div>
                    <div style="font-size:15px; font-weight:900; color:#15803d; margin-top:2px;">${formatarMoedaImpressao(auto.somaValorRecebidoAtivo)}</div>
                </div>
                <div style="flex:1; border:1px solid #cbd5e1; padding:8px; text-align:center; border-radius:4px; background:#fef2f2;">
                    <div style="font-size:9px; font-weight:bold; text-transform:uppercase; color:#b91c1c;">ESTORNADOS</div>
                    <div style="font-size:15px; font-weight:bold; color:#b91c1c; margin-top:2px;">${auto.quantidadePagamentosEstornados || 0} (${formatarMoedaImpressao(auto.somaValorEstornado)})</div>
                </div>
            </div>
        `;

        var pagtos = res.pagamentos || res.linhas || [];
        var rowsP = '';
        for (var i = 0; i < pagtos.length; i++) {
            var p = pagtos[i];
            rowsP += `
                <tr style="${p.status === 'ESTORNADO' ? 'text-decoration:line-through; color:#94a3b8;' : ''}">
                    <td style="font-family:monospace;">${impressaoEscapeHtml(p.numeroRecibo || '-')}</td>
                    <td>${formatarDataImpressaoBr(p.dataPagamento)}</td>
                    <td style="font-family:monospace;">${impressaoEscapeHtml(p.numeroControle || '-')}</td>
                    <td>${impressaoEscapeHtml(p.clienteNome || '-')}</td>
                    <td>${impressaoEscapeHtml(p.formaPagamento || '-')}</td>
                    <td>${impressaoEscapeHtml(p.status || 'ATIVO')}</td>
                    <td style="text-align:right; font-weight:bold;">${formatarMoedaImpressao(p.valor)}</td>
                </tr>
            `;
        }

        htmlTabela = `
            <table>
                <thead>
                    <tr>
                        <th>Nº Recibo</th>
                        <th>Data</th>
                        <th>Nota Ref.</th>
                        <th>Cliente</th>
                        <th>Forma</th>
                        <th>Status</th>
                        <th style="text-align:right;">Valor</th>
                    </tr>
                </thead>
                <tbody>${rowsP || '<tr><td colspan="7" style="text-align:center; padding:12px;">Nenhum pagamento registrado no período.</td></tr>'}</tbody>
                <tfoot>
                    <tr style="background:#f8fafc; font-weight:bold; border-top:2px solid #000;">
                        <td colspan="6">AUTO-SOMA DO FLUXO DE CAIXA (${auto.quantidadePagamentosAtivos || 0} pagamentos ativos):</td>
                        <td style="text-align:right; color:#15803d;">${formatarMoedaImpressao(auto.somaValorRecebidoAtivo)}</td>
                    </tr>
                </tfoot>
            </table>
        `;
    } else {
        htmlTotais = `
            <div style="display:flex; gap:10px; margin-bottom:14px;">
                <div style="flex:1; border:1px solid #cbd5e1; padding:8px; text-align:center; border-radius:4px;">
                    <div style="font-size:9px; font-weight:bold; text-transform:uppercase; color:#64748b;">REGISTROS</div>
                    <div style="font-size:15px; font-weight:bold; margin-top:2px;">${auto.quantidadeRegistros || 0} notas</div>
                </div>
                <div style="flex:1; border:1px solid #cbd5e1; padding:8px; text-align:center; border-radius:4px;">
                    <div style="font-size:9px; font-weight:bold; text-transform:uppercase; color:#64748b;">VALOR ORIGINAL</div>
                    <div style="font-size:15px; font-weight:bold; margin-top:2px;">${formatarMoedaImpressao(auto.somaValorOriginal)}</div>
                </div>
                <div style="flex:1; border:1px solid #cbd5e1; padding:8px; text-align:center; border-radius:4px; background:#f0fdf4;">
                    <div style="font-size:9px; font-weight:bold; text-transform:uppercase; color:#15803d;">TOTAL RECEBIDO</div>
                    <div style="font-size:15px; font-weight:900; color:#15803d; margin-top:2px;">${formatarMoedaImpressao(auto.somaTotalRecebido)}</div>
                </div>
                <div style="flex:1; border:1px solid #cbd5e1; padding:8px; text-align:center; border-radius:4px; background:#fef2f2;">
                    <div style="font-size:9px; font-weight:bold; text-transform:uppercase; color:#b91c1c;">SALDO DEVEDOR</div>
                    <div style="font-size:15px; font-weight:900; color:#b91c1c; margin-top:2px;">${formatarMoedaImpressao(auto.somaSaldoDevedor)}</div>
                </div>
            </div>
        `;

        var notas = res.linhas || [];
        var rowsN = '';
        for (var j = 0; j < notas.length; j++) {
            var n = notas[j];
            rowsN += `
                <tr>
                    <td style="font-family:monospace; font-weight:bold;">${impressaoEscapeHtml(n.numeroControle || n.id)}</td>
                    <td>${impressaoEscapeHtml(n.clienteNome || '-')}</td>
                    <td>${formatarDataImpressaoBr(n.dataEmissao)}</td>
                    <td>${formatarDataImpressaoBr(n.dataVencimento)}</td>
                    <td>${impressaoEscapeHtml(n.statusFinanceiro)}</td>
                    <td style="text-align:right;">${formatarMoedaImpressao(n.valorOriginal)}</td>
                    <td style="text-align:right; color:#15803d;">${formatarMoedaImpressao(n.totalRecebido)}</td>
                    <td style="text-align:right; font-weight:bold; ${n.saldoDevedor > 0 ? 'color:#b91c1c;' : 'color:#15803d;'}">${formatarMoedaImpressao(n.saldoDevedor)}</td>
                </tr>
            `;
        }

        htmlTabela = `
            <table>
                <thead>
                    <tr>
                        <th>Nº Controle</th>
                        <th>Cliente</th>
                        <th>Emissão</th>
                        <th>Vencimento</th>
                        <th>Situação</th>
                        <th style="text-align:right;">Valor Original</th>
                        <th style="text-align:right;">Recebido</th>
                        <th style="text-align:right;">Saldo</th>
                    </tr>
                </thead>
                <tbody>${rowsN || '<tr><td colspan="8" style="text-align:center; padding:12px;">Nenhuma nota encontrada com os filtros selecionados.</td></tr>'}</tbody>
                <tfoot>
                    <tr style="background:#f8fafc; font-weight:bold; border-top:2px solid #000;">
                        <td colspan="5">AUTO-SOMA DO RELATÓRIO (${auto.quantidadeRegistros || 0} notas):</td>
                        <td style="text-align:right;">${formatarMoedaImpressao(auto.somaValorOriginal)}</td>
                        <td style="text-align:right; color:#15803d;">${formatarMoedaImpressao(auto.somaTotalRecebido)}</td>
                        <td style="text-align:right; color:#b91c1c;">${formatarMoedaImpressao(auto.somaSaldoDevedor)}</td>
                    </tr>
                </tfoot>
            </table>
        `;
    }

    return `
        <div class="a4-print-relatorio">
            ${gerarCabecalhoEmpresaPrintHtml(cfg, tituloRelatorio, 'Relatório Gerencial e Auditoria de Contas')}

            <div style="display:flex; justify-content:space-between; background:#f1f5f9; padding:8px 12px; border:1px solid #cbd5e1; border-radius:4px; margin-bottom:14px; font-size:10.5px;">
                <div>
                    <strong>Período Analisado:</strong> ${impressaoEscapeHtml(intervalo.descricaoPeriodo || 'Todo o Histórico')}<br>
                    <strong>Filtro de Cliente:</strong> ${impressaoEscapeHtml(f.clienteFiltro || 'Todos os Clientes')}
                </div>
                <div style="text-align:right;">
                    <strong>Emissão do Relatório:</strong> ${formatarDataImpressaoBr(hojeRef)}<br>
                    <strong>Critério de Data:</strong> ${f.baseData === 'EMISSAO' ? 'Data de Emissão' : 'Data de Vencimento'}
                </div>
            </div>

            ${htmlTotais}
            ${htmlTabela}

            <div style="display:flex; justify-content:space-between; margin-top:35px; padding-bottom:10px;">
                <div class="linha-assinatura-a4">
                    <strong>${impressaoEscapeHtml(cfg.nomeFantasia || 'TUCANO AUTO PEÇAS')}</strong><br>
                    <span>Responsável Financeiro</span>
                </div>
                <div class="linha-assinatura-a4">
                    <strong>CONFERÊNCIA E AUDITORIA</strong><br>
                    <span>Assinatura do Gestor / Direção</span>
                </div>
            </div>
            <div style="text-align:center; font-size:10px; color:#64748b; margin-top:8px;">
                ${impressaoEscapeHtml(cfg.rodapeDocumentos || 'Obrigado pela preferência e parceria!')}
            </div>
        </div>
    `;
}

// =========================================================================
// PARTE 2 — FUNÇÕES DE DISPARO DE IMPRESSÃO NO DOM (RUNTIME)
// =========================================================================

/**
 * Injeta o HTML gerado na área de impressão final e dispara a janela do navegador.
 */
function executarImpressaoHtmlNaAreaFinal(htmlConteudo) {
    if (typeof document === 'undefined') return;
    var area = document.getElementById('areaImpressaoFinal');
    if (!area) {
        console.error('[Impressão] Elemento #areaImpressaoFinal não encontrado no DOM.');
        return;
    }
    area.innerHTML = htmlConteudo;
    setTimeout(function() {
        if (typeof window !== 'undefined' && typeof window.print === 'function') {
            window.print();
        }
    }, 300);
}

/**
 * Dispara a impressão de uma 2ª via de recibo de pagamento.
 */
function reimprimirReciboSegundaViaA4(idNota, idPagamento) {
    if (typeof imprimirReciboPagamentoA4 === 'function') {
        imprimirReciboPagamentoA4(idNota, idPagamento, { segundaVia: true });
    }
}

/**
 * Dispara a impressão de Extrato de Conta Corrente de um Cliente a partir da Ficha do Cliente.
 */
function dispararImpressaoExtratoClienteA4(clienteIdOuObj) {
    if (!clienteIdOuObj) return;

    var cli = null;
    if (typeof clienteIdOuObj === 'object') {
        cli = clienteIdOuObj;
    } else if (typeof clientesMap !== 'undefined' && clientesMap[clienteIdOuObj]) {
        cli = clientesMap[clienteIdOuObj];
    } else if (typeof listaGlobalClientes !== 'undefined') {
        cli = listaGlobalClientes.find(function(c) { return String(c.id) === String(clienteIdOuObj); });
    }

    if (!cli) {
        if (typeof Swal !== 'undefined') {
            Swal.fire('Atenção', 'Cliente não localizado para impressão do extrato.', 'warning');
        }
        return;
    }

    var notasRef = (typeof listaGlobalNotasPrazo !== 'undefined') ? listaGlobalNotasPrazo : [];
    var resumo = (typeof obterResumoFinanceiroCliente === 'function')
        ? obterResumoFinanceiroCliente(cli.id, notasRef)
        : { totalOriginal: 0, totalRecebido: 0, saldoTotal: 0, notas: [] };

    var cfg = (typeof obterConfiguracoesEmpresaSegura === 'function')
        ? obterConfiguracoesEmpresaSegura()
        : {};

    var hojeRef = (typeof obterDataLocalISO === 'function') ? obterDataLocalISO() : new Date().toISOString().slice(0, 10);
    var html = gerarHtmlImpressaoExtratoClienteA4(cli, resumo, cfg, hojeRef);
    executarImpressaoHtmlNaAreaFinal(html);
}

/**
 * [FASE 6 / T-603] Função inteligente de atalho para imprimir recibo ou comprovante de uma linha de venda.
 */
function imprimirReciboOuComprovanteVendaLinha(idNota, listaNotasRef) {
    var lNotas = (listaNotasRef && Array.isArray(listaNotasRef))
        ? listaNotasRef
        : ((typeof listaGlobalNotasPrazo !== 'undefined') ? listaGlobalNotasPrazo : []);

    var nota = lNotas.find(function(n) { return n && String(n.id) === String(idNota); });
    if (!nota) {
        if (typeof Swal !== 'undefined') {
            Swal.fire('Aviso', 'Nota não localizada para impressão do recibo.', 'warning');
        }
        return { status: 'NAO_ENCONTRADA' };
    }

    var pagtos = [];
    if (typeof extrairPagamentosNota === 'function') {
        pagtos = extrairPagamentosNota(nota);
    } else if (typeof extrairPagamentosNotaCliente === 'function') {
        pagtos = extrairPagamentosNotaCliente(nota);
    } else if (nota.pagamentos && typeof nota.pagamentos === 'object') {
        pagtos = Object.keys(nota.pagamentos).map(function(k) {
            var item = nota.pagamentos[k] || {};
            return Object.assign({ id: k }, item);
        });
    }

    var pagtosAtivos = pagtos.filter(function(p) {
        return p && p.status !== 'ESTORNADO';
    });

    var numNota = nota.numeroControle || nota.id || 'NP-000000';

    // Caso 1: Apenas 1 pagamento ativo registrado
    if (pagtosAtivos.length === 1) {
        if (typeof imprimirReciboPagamentoA4 === 'function') {
            imprimirReciboPagamentoA4(nota.id, pagtosAtivos[0].id);
        }
        return { status: 'PAGAMENTO_UNICO', notaId: nota.id, pagtoId: pagtosAtivos[0].id };
    }

    // Caso 2: 2 ou mais pagamentos parciais ativos registrados
    if (pagtosAtivos.length > 1) {
        if (typeof Swal !== 'undefined') {
            var opcoesSelect = {};
            for (var idx = 0; idx < pagtosAtivos.length; idx++) {
                var p = pagtosAtivos[idx];
                var v = (typeof formatadorMoeda !== 'undefined') ? formatadorMoeda.format(parseFloat(p.valor) || 0) : ('R$ ' + (parseFloat(p.valor) || 0).toFixed(2));
                var dataFmt = (typeof formatarDataTextoZap === 'function') ? formatarDataTextoZap(p.dataPagamento) : (p.dataPagamento ? String(p.dataPagamento).slice(0, 10) : '');
                var recNum = p.numeroRecibo || ('Recibo #' + (idx + 1));
                opcoesSelect[p.id] = recNum + ' — ' + v + ' (' + dataFmt + ' - ' + (p.formaPagamento || 'Dinheiro') + ')';
            }

            var ultimoId = pagtosAtivos[pagtosAtivos.length - 1].id;

            Swal.fire({
                title: 'Imprimir Recibo (' + numNota + ')',
                text: 'Esta nota possui ' + pagtosAtivos.length + ' pagamentos recebidos. Selecione qual recibo deseja imprimir:',
                input: 'select',
                inputOptions: opcoesSelect,
                inputValue: ultimoId,
                showCancelButton: true,
                confirmButtonText: '🖨️ Imprimir Recibo Selecionado',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#4f46e5',
                showDenyButton: true,
                denyButtonText: '🧾 Imprimir Todos Juntos / Extrato',
                denyButtonColor: '#059669'
            }).then(function(result) {
                if (result.isConfirmed && result.value) {
                    if (typeof imprimirReciboPagamentoA4 === 'function') {
                        imprimirReciboPagamentoA4(nota.id, result.value);
                    }
                } else if (result.isDenied) {
                    if (typeof abrirModalExtratoNota === 'function') {
                        abrirModalExtratoNota(nota.id);
                    }
                }
            });
        } else {
            if (typeof imprimirUltimoReciboNota === 'function') {
                imprimirUltimoReciboNota(nota.id);
            }
        }
        return { status: 'PAGAMENTOS_MULTIPLOS', notaId: nota.id, totalPagamentos: pagtosAtivos.length };
    }

    // Caso 3: Nota ainda ABERTA sem nenhum pagamento registrado
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Nenhum Pagamento Registrado',
            html: `Esta nota (<strong>${numNota}</strong>) ainda não possui pagamentos recebidos.<br><br>O que você deseja fazer?`,
            icon: 'info',
            showCancelButton: true,
            cancelButtonText: 'Fechar',
            showDenyButton: true,
            confirmButtonText: '💵 Registrar Pagamento e Imprimir Recibo',
            confirmButtonColor: '#059669',
            denyButtonText: '🖨️ Imprimir Comprovante da Nota (A4)',
            denyButtonColor: '#4f46e5'
        }).then(function(result) {
            if (result.isConfirmed) {
                if (typeof fecharModalFichaCliente === 'function') fecharModalFichaCliente();
                if (typeof abrirModalBaixaNota === 'function') {
                    abrirModalBaixaNota(nota.id);
                }
            } else if (result.isDenied) {
                if (typeof imprimirNotaPrazoA4 === 'function') {
                    imprimirNotaPrazoA4(nota.id);
                }
            }
        });
    } else {
        if (typeof imprimirNotaPrazoA4 === 'function') {
            imprimirNotaPrazoA4(nota.id);
        }
    }
    return { status: 'SEM_PAGAMENTO', notaId: nota.id };
}

// Export para testes em ambiente Node.js / VM
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        formatarMoedaImpressao: formatarMoedaImpressao,
        formatarDataImpressaoBr: formatarDataImpressaoBr,
        impressaoEscapeHtml: impressaoEscapeHtml,
        gerarCabecalhoEmpresaPrintHtml: gerarCabecalhoEmpresaPrintHtml,
        gerarBlocoPixPrintHtml: gerarBlocoPixPrintHtml,
        gerarHtmlImpressaoNotaPrazoA4: gerarHtmlImpressaoNotaPrazoA4,
        gerarHtmlImpressaoReciboPagamentoA4: gerarHtmlImpressaoReciboPagamentoA4,
        gerarHtmlImpressaoExtratoClienteA4: gerarHtmlImpressaoExtratoClienteA4,
        gerarHtmlImpressaoRelatorioA4: gerarHtmlImpressaoRelatorioA4,
        dispararImpressaoExtratoClienteA4: dispararImpressaoExtratoClienteA4,
        imprimirReciboOuComprovanteVendaLinha: imprimirReciboOuComprovanteVendaLinha
    };
}
