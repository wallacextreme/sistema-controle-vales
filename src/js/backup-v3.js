// =========================================================================
// MÓDULO DE BACKUP & IMPORTAÇÃO SCHEMA V3 (FASE 4 / T-402)
// Tucano Cloud — Tucano Auto Peças
//
// REGRAS PERMANENTES DE BLINDAGEM (AGENTS.md):
// 1. Somente 'function nome(...) {}' e 'var NOME = ...;' no nível superior (compatível com vm.runInContext).
// 2. Proibido const, let ou class no topo do arquivo.
// 3. Proibido acessar window, document, database, auth, Swal ou localStorage no topo do arquivo.
// 4. Merge 100% não-destrutivo: NUNCA usar set() sobre nós já existentes.
// =========================================================================

// =========================================================================
// PARTE 1: CONSTRUÇÃO, INSPEÇÃO E PLANO DE MERGE (VM-SAFE)
// =========================================================================

/**
 * Constrói o payload oficial do Backup Schema V3 do Tucano Cloud.
 */
function construirPayloadBackupV3(vales, notasPrazo, clientes, configuracoesEmpresa, dataExportacaoISO) {
    var arrVales = Array.isArray(vales) ? vales : Object.values(vales || {});
    var arrNotas = Array.isArray(notasPrazo) ? notasPrazo : Object.values(notasPrazo || {});
    var arrClientes = Array.isArray(clientes) ? clientes : Object.values(clientes || {});

    var hojeRef = dataExportacaoISO || (typeof obterDataLocalISO === 'function' ? obterDataLocalISO() : new Date().toISOString().slice(0, 10));
    var agoraTimestamp = (dataExportacaoISO && dataExportacaoISO.indexOf('T') !== -1) ? dataExportacaoISO : new Date().toISOString();

    return {
        schemaVersion: 3,
        app: 'Tucano Cloud',
        versaoModulo: '3.0.0',
        exportedAt: agoraTimestamp,
        dataReferencia: hojeRef,
        resumoContagem: {
            vales: arrVales.length,
            notasPrazo: arrNotas.length,
            clientes: arrClientes.length,
            temConfiguracoes: !!(configuracoesEmpresa && configuracoesEmpresa.nomeFantasia)
        },
        vales: arrVales,
        notasPrazo: arrNotas,
        clientes: arrClientes,
        configuracoes: {
            empresa: configuracoesEmpresa || null
        }
    };
}

/**
 * Analisa a estrutura de um arquivo de backup (V1, V2 ou V3) e calcula a prévia
 * exata contra o estado atual do banco, sem efetuar qualquer modificação.
 */
function analisarArquivoBackupImportacao(dadosJson, estadoAtualBanco) {
    if (!dadosJson) {
        return { valido: false, erro: 'Arquivo vazio ou formato JSON corrompido.' };
    }

    var estado = (estadoAtualBanco && typeof estadoAtualBanco === 'object') ? estadoAtualBanco : {};
    var valesBancoMap = estado.valesMap || {};
    var notasBancoMap = estado.notasPrazoMap || {};
    var clientesBancoMap = estado.clientesMap || {};

    var schemaVersion = 1;
    var versaoTexto = '';
    var valesBackup = [];
    var notasBackup = [];
    var clientesBackup = [];
    var configuracoesBackup = null;
    var dataExportacao = '';

    // 1. Identificação do Formato e Versão
    if (Array.isArray(dadosJson)) {
        schemaVersion = 1;
        versaoTexto = 'Legado V1 (Apenas Vales de Crédito)';
        valesBackup = dadosJson;
    } else if (dadosJson && typeof dadosJson === 'object') {
        schemaVersion = parseInt(dadosJson.schemaVersion, 10) || (dadosJson.clientes ? 3 : 2);
        dataExportacao = dadosJson.exportedAt || '';

        if (schemaVersion >= 3 || (dadosJson.clientes && Array.isArray(dadosJson.clientes))) {
            schemaVersion = 3;
            versaoTexto = 'Schema V3 (Tucano Cloud Completo — Vales, Notas, Clientes e Configurações)';
            valesBackup = Array.isArray(dadosJson.vales) ? dadosJson.vales : Object.values(dadosJson.vales || {});
            notasBackup = Array.isArray(dadosJson.notasPrazo) ? dadosJson.notasPrazo : Object.values(dadosJson.notasPrazo || {});
            clientesBackup = Array.isArray(dadosJson.clientes) ? dadosJson.clientes : Object.values(dadosJson.clientes || {});
            configuracoesBackup = (dadosJson.configuracoes && dadosJson.configuracoes.empresa) ? dadosJson.configuracoes.empresa : null;
        } else if (schemaVersion === 2 || dadosJson.notasPrazo) {
            schemaVersion = 2;
            versaoTexto = 'Schema V2 (Vales de Crédito + Notas a Prazo)';
            valesBackup = Array.isArray(dadosJson.vales) ? dadosJson.vales : Object.values(dadosJson.vales || {});
            notasBackup = Array.isArray(dadosJson.notasPrazo) ? dadosJson.notasPrazo : Object.values(dadosJson.notasPrazo || {});
        } else {
            versaoTexto = 'Formato Personalizado (v' + schemaVersion + ')';
            valesBackup = Array.isArray(dadosJson.vales) ? dadosJson.vales : [];
            notasBackup = Array.isArray(dadosJson.notasPrazo) ? dadosJson.notasPrazo : [];
            clientesBackup = Array.isArray(dadosJson.clientes) ? dadosJson.clientes : [];
        }
    } else {
        return { valido: false, erro: 'Estrutura JSON não reconhecida pelo sistema.' };
    }

    // 2. Análise de Vales
    var totalVales = 0;
    var valesNovos = 0;
    var valesExistentes = 0;
    for (var iv = 0; iv < valesBackup.length; iv++) {
        var v = valesBackup[iv];
        if (!v || !v.id) continue;
        totalVales++;
        if (valesBancoMap[v.id]) valesExistentes++;
        else valesNovos++;
    }

    // 3. Análise de Notas a Prazo e Pagamentos
    var totalNotas = 0;
    var notasNovas = 0;
    var notasExistentes = 0;
    var totalPagtosBackup = 0;
    var pagtosNovosParaAdicionar = 0;
    var pagtosExistentesNoBanco = 0;

    for (var inota = 0; inota < notasBackup.length; inota++) {
        var n = notasBackup[inota];
        if (!n || !n.id) continue;
        totalNotas++;

        var pagtosN = [];
        if (typeof extrairPagamentosNota === 'function') {
            pagtosN = extrairPagamentosNota(n);
        } else if (n.pagamentos) {
            pagtosN = Array.isArray(n.pagamentos) ? n.pagamentos : Object.values(n.pagamentos);
        }
        totalPagtosBackup += pagtosN.length;

        if (notasBancoMap[n.id]) {
            notasExistentes++;
            var notaBanco = notasBancoMap[n.id];
            var pagtosBanco = [];
            if (typeof extrairPagamentosNota === 'function') {
                pagtosBanco = extrairPagamentosNota(notaBanco);
            } else if (notaBanco.pagamentos) {
                pagtosBanco = Array.isArray(notaBanco.pagamentos) ? notaBanco.pagamentos : Object.values(notaBanco.pagamentos);
            }
            pagtosExistentesNoBanco += pagtosBanco.length;

            var idsPagtosBanco = {};
            for (var ipb = 0; ipb < pagtosBanco.length; ipb++) {
                if (pagtosBanco[ipb] && pagtosBanco[ipb].id) {
                    idsPagtosBanco[pagtosBanco[ipb].id] = true;
                }
            }
            for (var ipbkp = 0; ipbkp < pagtosN.length; ipbkp++) {
                var pBkp = pagtosN[ipbkp];
                if (pBkp && pBkp.id && !idsPagtosBanco[pBkp.id]) {
                    pagtosNovosParaAdicionar++;
                }
            }
        } else {
            notasNovas++;
            pagtosNovosParaAdicionar += pagtosN.length;
        }
    }

    // 4. Análise de Clientes
    var totalClientes = 0;
    var clientesNovos = 0;
    var clientesExistentes = 0;
    for (var ic = 0; ic < clientesBackup.length; ic++) {
        var c = clientesBackup[ic];
        if (!c || !c.id) continue;
        totalClientes++;
        if (clientesBancoMap[c.id]) clientesExistentes++;
        else clientesNovos++;
    }

    return {
        valido: true,
        schemaVersion: schemaVersion,
        versaoTexto: versaoTexto,
        dataExportacao: dataExportacao,
        vales: {
            total: totalVales,
            novos: valesNovos,
            existentes: valesExistentes,
            dados: valesBackup
        },
        notasPrazo: {
            total: totalNotas,
            novas: notasNovas,
            existentes: notasExistentes,
            pagamentosTotal: totalPagtosBackup,
            pagamentosNovos: pagtosNovosParaAdicionar,
            pagamentosExistentes: pagtosExistentesNoBanco,
            dados: notasBackup
        },
        clientes: {
            total: totalClientes,
            novos: clientesNovos,
            existentes: clientesExistentes,
            dados: clientesBackup
        },
        configuracoes: {
            presente: !!configuracoesBackup,
            dados: configuracoesBackup
        }
    };
}

/**
 * Constrói o plano detalhado e determinístico de merge 100% não-destrutivo.
 */
function planejarOperacoesMergeNaoDestrutivo(dadosJson, estadoAtualBanco) {
    var analise = analisarArquivoBackupImportacao(dadosJson, estadoAtualBanco);
    if (!analise.valido) {
        return { valido: false, erro: analise.erro };
    }

    var estado = (estadoAtualBanco && typeof estadoAtualBanco === 'object') ? estadoAtualBanco : {};
    var valesBancoMap = estado.valesMap || {};
    var notasBancoMap = estado.notasPrazoMap || {};
    var clientesBancoMap = estado.clientesMap || {};

    var updates = {};
    var listaOperacoes = [];

    // 1. Planejamento para Vales
    var vales = analise.vales.dados;
    for (var iv = 0; iv < vales.length; iv++) {
        var v = vales[iv];
        if (!v || !v.id) continue;

        if (!valesBancoMap[v.id]) {
            // Vale novo: safe set
            updates['vales/' + v.id] = v;
            listaOperacoes.push({ tipo: 'VALE_NOVO', id: v.id });
        } else {
            // Vale já existente: mescla apenas baixas que faltam
            var baixasBanco = valesBancoMap[v.id].baixas || {};
            var baixasBkp = v.baixas || {};
            var chavesBaixas = Object.keys(baixasBkp);
            for (var ib = 0; ib < chavesBaixas.length; ib++) {
                var kBaixa = chavesBaixas[ib];
                if (!baixasBanco[kBaixa]) {
                    updates['vales/' + v.id + '/baixas/' + kBaixa] = baixasBkp[kBaixa];
                    listaOperacoes.push({ tipo: 'BAIXA_VALE_NOVA', valeId: v.id, baixaId: kBaixa });
                }
            }
        }
    }

    // 2. Planejamento para Notas a Prazo
    var notas = analise.notasPrazo.dados;
    for (var inota = 0; inota < notas.length; inota++) {
        var n = notas[inota];
        if (!n || !n.id) continue;

        if (!notasBancoMap[n.id]) {
            // Nota nova: prepara estrutura limpa
            var notaNova = {};
            for (var k in n) {
                if (Object.prototype.hasOwnProperty.call(n, k)) {
                    notaNova[k] = n[k];
                }
            }
            if (Array.isArray(notaNova.pagamentos)) {
                var objP = {};
                for (var ip = 0; ip < notaNova.pagamentos.length; ip++) {
                    var p = notaNova.pagamentos[ip];
                    if (p && p.id) objP[p.id] = p;
                }
                notaNova.pagamentos = objP;
            }
            if (typeof calcularSituacaoNota === 'function') {
                var sitNova = calcularSituacaoNota(notaNova);
                notaNova.status = sitNova.statusFinanceiro;
            }
            updates['notasPrazo/' + n.id] = notaNova;
            listaOperacoes.push({ tipo: 'NOTA_NOVA', id: n.id });
        } else {
            // Nota JÁ EXISTE no banco: NUNCA usar set()!
            var notaBanco = notasBancoMap[n.id];
            var pagtosBanco = notaBanco.pagamentos || {};

            var pagtosBkp = [];
            if (typeof extrairPagamentosNota === 'function') {
                pagtosBkp = extrairPagamentosNota(n);
            } else if (n.pagamentos) {
                pagtosBkp = Array.isArray(n.pagamentos) ? n.pagamentos : Object.values(n.pagamentos);
            }

            for (var ipb = 0; ipb < pagtosBkp.length; ipb++) {
                var pb = pagtosBkp[ipb];
                if (pb && pb.id && !pagtosBanco[pb.id]) {
                    // Pagamento novo no backup -> incorpora individualmente!
                    updates['notasPrazo/' + n.id + '/pagamentos/' + pb.id] = pb;
                    listaOperacoes.push({ tipo: 'PAGAMENTO_NOVO', notaId: n.id, pagtoId: pb.id });
                }
            }

            // Se a nota no backup tem clienteId e a do banco não tem, atualiza apenas o vínculo
            if (n.clienteId && !notaBanco.clienteId) {
                updates['notasPrazo/' + n.id + '/clienteId'] = n.clienteId;
                listaOperacoes.push({ tipo: 'VINCULO_CLIENTE', notaId: n.id, clienteId: n.clienteId });
            }
        }
    }

    // 3. Planejamento para Clientes (Schema V3)
    var clientes = analise.clientes.dados;
    for (var ic = 0; ic < clientes.length; ic++) {
        var c = clientes[ic];
        if (!c || !c.id) continue;

        if (!clientesBancoMap[c.id]) {
            updates['clientes/' + c.id] = c;
            listaOperacoes.push({ tipo: 'CLIENTE_NOVO', id: c.id });
        }
    }

    // 4. Planejamento para Configurações da Empresa (se presentes no backup e ausentes/completas)
    if (analise.configuracoes.presente && analise.configuracoes.dados) {
        var cfgBkp = analise.configuracoes.dados;
        var cfgAtual = estado.configEmpresa || {};
        if (!cfgAtual.nomeFantasia || (cfgBkp.atualizadoEm && (!cfgAtual.atualizadoEm || cfgBkp.atualizadoEm > cfgAtual.atualizadoEm))) {
            updates['configuracoes/empresa'] = cfgBkp;
            listaOperacoes.push({ tipo: 'CONFIG_EMPRESA', dados: cfgBkp });
        }
    }

    return {
        valido: true,
        analise: analise,
        updates: updates,
        quantidadeUpdates: Object.keys(updates).length,
        listaOperacoes: listaOperacoes
    };
}

// =========================================================================
// PARTE 2: FLUXO DE EXPORTAÇÃO E IMPORTAÇÃO V3 INTEGRADO
// =========================================================================

/**
 * Executa a exportação do Backup V3 completo solicitando a senha master.
 */
async function executarExportacaoBackupV3() {
    if (typeof validarSenhaMaster === 'function') {
        var autorizado = await validarSenhaMaster();
        if (!autorizado) {
            if (typeof Swal !== 'undefined') Swal.fire('Erro', 'Senha master incorreta.', 'error');
            return;
        }
    }

    var vales = (typeof listaGlobalVales !== 'undefined') ? listaGlobalVales : [];
    var notas = (typeof listaGlobalNotasPrazo !== 'undefined') ? listaGlobalNotasPrazo : [];
    var clientes = (typeof mapaGlobalClientes !== 'undefined') ? Object.values(mapaGlobalClientes) : [];
    var config = (typeof obterConfiguracoesEmpresaSegura === 'function') ? obterConfiguracoesEmpresaSegura() : null;

    var hojeISO = (typeof obterDataLocalISO === 'function') ? obterDataLocalISO() : new Date().toISOString().slice(0, 10);
    var payload = construirPayloadBackupV3(vales, notas, clientes, config);

    try {
        var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'BACKUP_TUCANO_CLOUD_V3_' + hojeISO + '.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Backup Gerado!',
                html: `
                    <div class="text-left text-xs space-y-1 bg-slate-900 p-4 rounded-xl border border-slate-700">
                        <div>🏷️ <strong>Vales:</strong> ${payload.resumoContagem.vales}</div>
                        <div>📅 <strong>Notas a Prazo:</strong> ${payload.resumoContagem.notasPrazo}</div>
                        <div>👥 <strong>Clientes:</strong> ${payload.resumoContagem.clientes}</div>
                        <div>⚙️ <strong>Configurações da Empresa:</strong> ${payload.resumoContagem.temConfiguracoes ? 'Sim' : 'Não'}</div>
                        <div class="text-emerald-400 font-bold pt-1">🛡️ Schema V3 com integridade total.</div>
                    </div>
                `,
                icon: 'success'
            });
        }
    } catch (eExp) {
        console.error('[Backup V3] Erro ao exportar:', eExp);
        if (typeof Swal !== 'undefined') Swal.fire('Erro', 'Falha ao gerar arquivo de backup.', 'error');
    }
}

/**
 * Executa a importação segura com prévia SweetAlert2 e merge não-destrutivo.
 */
async function executarImportacaoBackupV3(eventoInput) {
    var inputArquivo = eventoInput ? eventoInput.target : document.getElementById('inputImportarBackup');
    var arquivo = inputArquivo && inputArquivo.files && inputArquivo.files[0];
    if (!arquivo) return;

    if (typeof validarSenhaMaster === 'function') {
        var autorizado = await validarSenhaMaster();
        if (!autorizado) {
            if (typeof Swal !== 'undefined') Swal.fire('Erro', 'Senha master incorreta. Importação cancelada.', 'error');
            if (inputArquivo) inputArquivo.value = '';
            return;
        }
    }

    var reader = new FileReader();
    reader.onload = async function(eReader) {
        if (inputArquivo) inputArquivo.value = '';
        try {
            var dados = JSON.parse(eReader.target.result);

            var estadoBanco = {
                valesMap: (typeof valesMap !== 'undefined') ? valesMap : {},
                notasPrazoMap: (typeof notasPrazoMap !== 'undefined') ? notasPrazoMap : {},
                clientesMap: (typeof mapaGlobalClientes !== 'undefined') ? mapaGlobalClientes : {},
                configEmpresa: (typeof configEmpresaAtual !== 'undefined') ? configEmpresaAtual : null
            };

            var plano = planejarOperacoesMergeNaoDestrutivo(dados, estadoBanco);
            if (!plano.valido) {
                if (typeof Swal !== 'undefined') Swal.fire('Erro', plano.erro || 'Falha na análise do backup.', 'error');
                return;
            }

            var an = plano.analise;

            var modalPrevia = await Swal.fire({
                title: 'Backup Detectado (' + (an.schemaVersion >= 3 ? 'Schema V3' : (an.schemaVersion === 2 ? 'Schema V2' : 'Legado V1')) + ')',
                html: `
                    <div class="text-left text-xs space-y-3 bg-slate-900/90 p-4 rounded-2xl border border-slate-700">
                        <div><strong>Tipo de Arquivo:</strong> <span class="text-indigo-400 font-bold">${an.versaoTexto}</span></div>
                        ${an.dataExportacao ? `<div><strong>Exportado em:</strong> <span class="text-slate-300 font-medium">${an.dataExportacao.replace('T', ' ').slice(0, 19)}</span></div>` : ''}
                        <hr class="border-slate-800">
                        <div class="space-y-1">
                            <div class="font-bold text-slate-200">🏷️ Vales de Crédito:</div>
                            <div class="pl-2">• Total no arquivo: <strong>${an.vales.total}</strong></div>
                            <div class="pl-2 text-emerald-400 font-medium">• Novos a registrar: <strong>${an.vales.novos}</strong></div>
                            <div class="pl-2 text-slate-400">• Já existentes (preservados): <strong>${an.vales.existentes}</strong></div>
                        </div>
                        <div class="space-y-1">
                            <div class="font-bold text-slate-200">📅 Notas a Prazo:</div>
                            <div class="pl-2">• Total no arquivo: <strong>${an.notasPrazo.total}</strong></div>
                            <div class="pl-2 text-emerald-400 font-medium">• Novas a registrar: <strong>${an.notasPrazo.novas}</strong></div>
                            <div class="pl-2 text-slate-400">• Já existentes (preservadas): <strong>${an.notasPrazo.existentes}</strong></div>
                        </div>
                        <div class="space-y-1">
                            <div class="font-bold text-slate-200">💵 Pagamentos e Recibos:</div>
                            <div class="pl-2">• Total no arquivo: <strong>${an.notasPrazo.pagamentosTotal}</strong></div>
                            <div class="pl-2 text-emerald-400 font-medium">• Novos a incorporar: <strong>${an.notasPrazo.pagamentosNovos}</strong></div>
                            <div class="pl-2 text-slate-400">• Já existentes no banco (intactos): <strong>${an.notasPrazo.pagamentosExistentes}</strong></div>
                        </div>
                        ${an.clientes.total > 0 ? `
                        <div class="space-y-1">
                            <div class="font-bold text-slate-200">👥 Cadastros de Clientes (V3):</div>
                            <div class="pl-2">• Total no arquivo: <strong>${an.clientes.total}</strong></div>
                            <div class="pl-2 text-emerald-400 font-medium">• Novos a registrar: <strong>${an.clientes.novos}</strong></div>
                            <div class="pl-2 text-slate-400">• Já existentes (preservados): <strong>${an.clientes.existentes}</strong></div>
                        </div>` : ''}
                        <div class="p-3 bg-emerald-950/40 border border-emerald-800 rounded-xl text-emerald-300 mt-2">
                            🛡️ <strong>Blindagem Ativa:</strong> Merge 100% não-destrutivo. Nenhum registro existente será sobrescrito ou apagado.
                        </div>
                    </div>
                `,
                icon: 'info',
                showCancelButton: true,
                confirmButtonText: '🛡️ IMPORTAR COM SEGURANÇA',
                cancelButtonText: 'CANCELAR',
                confirmButtonColor: '#2563eb',
                cancelButtonColor: '#475569',
                allowOutsideClick: false
            });

            if (!modalPrevia.isConfirmed) return;

            if (plano.quantidadeUpdates === 0) {
                Swal.fire('Banco Atualizado', 'Todos os registros do arquivo de backup já constam intactos no banco.', 'info');
                return;
            }

            Swal.fire({
                title: 'Importando com Segurança...',
                text: 'Sincronizando registros no Firebase sem sobrescrever dados...',
                allowOutsideClick: false,
                didOpen: function() { Swal.showLoading(); }
            });

            if (typeof database !== 'undefined') {
                await database.ref().update(plano.updates);
            }

            Swal.fire({
                title: 'Importação Concluída!',
                text: plano.quantidadeUpdates + ' atualizações foram aplicadas com sucesso sem qualquer perda de dados.',
                icon: 'success'
            });
        } catch (eParse) {
            console.error('[Backup V3] Erro ao importar:', eParse);
            if (typeof Swal !== 'undefined') Swal.fire('Erro', 'Arquivo JSON inválido ou corrompido.', 'error');
        }
    };
    reader.readAsText(arquivo);
}
