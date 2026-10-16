// [FASE 3 / T-301] Módulo de Configurações da Empresa, PIX e Parâmetros - Tucano Cloud
// Regras Permanentes (AGENTS.md):
// 1. Apenas 'var' e 'function' no nível superior (compatível com vm.runInContext e browser clássico).
// 2. Proibido acessar DOM/Firebase/Storage/Swal no topo do arquivo.
// 3. Sem colisão de identificadores com index.html, nucleo-financeiro.js, clientes.js ou relatorios.js.

// =========================================================================
// VARIÁVEIS DE ESTADO E PADRÕES DO MÓDULO DE CONFIGURAÇÕES
// =========================================================================
var CONFIG_EMPRESA_PADRAO = {
    nomeFantasia: 'TUCANO AUTO PEÇAS',
    razaoSocial: 'Tucano Auto Peças',
    subtitulo: 'Comércio de Peças e Acessórios Automotivos',
    cnpj: '',
    inscricaoEstadual: '',
    telefone: '',
    whatsappLoja: '',
    endereco: 'Nova Friburgo - RJ',
    cidadeUf: 'Nova Friburgo - RJ',
    chavePix: '',
    tipoChavePix: 'CNPJ/Celular/E-mail',
    titularPix: 'Tucano Auto Peças',
    diasAlertaVencimento: 3,
    rodapeDocumentos: 'Obrigado pela preferência e parceria!'
};

var configEmpresaAtual = null;
var configEmpresaRefGlobal = null;

// =========================================================================
// PARTE 1 — FUNÇÕES PURAS DE NORMALIZAÇÃO E VALIDAÇÃO (VM-SAFE)
// =========================================================================

/**
 * Normaliza e mescla os dados da empresa com os padrões estabelecidos.
 */
function normalizarConfiguracoesEmpresa(dadosBrutos) {
    var b = dadosBrutos && typeof dadosBrutos === 'object' ? dadosBrutos : {};
    var p = CONFIG_EMPRESA_PADRAO;

    var diasAlerta = parseInt(b.diasAlertaVencimento, 10);
    if (isNaN(diasAlerta) || diasAlerta < 1 || diasAlerta > 30) {
        diasAlerta = p.diasAlertaVencimento;
    }

    var cnpjLimpo = '';
    if (b.cnpj) {
        var rawCnpj = String(b.cnpj).trim();
        var dCnpj = rawCnpj.replace(/\D/g, '');
        if (dCnpj.length > 0 && dCnpj !== '00000000000100') {
            if (typeof validarEFormatarCpfCnpj === 'function') {
                var fmt = validarEFormatarCpfCnpj(rawCnpj);
                cnpjLimpo = fmt.valido ? fmt.formatado : rawCnpj;
            } else {
                cnpjLimpo = rawCnpj;
            }
        }
    }

    return {
        nomeFantasia: (b.nomeFantasia && String(b.nomeFantasia).trim()) || p.nomeFantasia,
        razaoSocial: (b.razaoSocial && String(b.razaoSocial).trim()) || (b.nomeFantasia && String(b.nomeFantasia).trim()) || p.razaoSocial,
        subtitulo: (b.subtitulo !== undefined && String(b.subtitulo).trim()) || p.subtitulo,
        cnpj: cnpjLimpo,
        inscricaoEstadual: b.inscricaoEstadual ? String(b.inscricaoEstadual).trim() : '',
        telefone: b.telefone ? String(b.telefone).trim() : '',
        whatsappLoja: b.whatsappLoja ? String(b.whatsappLoja).trim() : (b.telefone ? String(b.telefone).trim() : ''),
        endereco: (b.endereco !== undefined && String(b.endereco).trim()) || p.endereco,
        cidadeUf: (b.cidadeUf !== undefined && String(b.cidadeUf).trim()) || p.cidadeUf,
        chavePix: b.chavePix ? String(b.chavePix).trim() : '',
        tipoChavePix: b.tipoChavePix ? String(b.tipoChavePix).trim() : p.tipoChavePix,
        titularPix: (b.titularPix && String(b.titularPix).trim()) || p.titularPix,
        diasAlertaVencimento: diasAlerta,
        rodapeDocumentos: (b.rodapeDocumentos !== undefined && String(b.rodapeDocumentos).trim()) || p.rodapeDocumentos,
        atualizadoEm: b.atualizadoEm || null,
        atualizadoPor: b.atualizadoPor || null
    };
}

/**
 * Retorna as configurações ativas com fallback seguro para os padrões de fábrica.
 */
function obterConfiguracoesEmpresaSegura() {
    return normalizarConfiguracoesEmpresa(configEmpresaAtual);
}

/**
 * Valida a consistência dos dados de configuração antes da gravação.
 */
function validarDadosConfiguracaoEmpresa(dados) {
    if (!dados || typeof dados !== 'object') {
        return { valido: false, erro: 'Dados de configuração inválidos ou ausentes.' };
    }

    var nome = dados.nomeFantasia ? String(dados.nomeFantasia).trim() : '';
    if (!nome) {
        return { valido: false, erro: 'O Nome Fantasia da empresa é obrigatório.' };
    }

    if (dados.cnpj) {
        var cnpjStr = String(dados.cnpj).trim();
        var digitosCnpj = cnpjStr.replace(/\D/g, '');
        // Trata máscara vazia 00.000.000/0001-00 ou campo em branco como opcional
        if (digitosCnpj.length > 0 && digitosCnpj !== '00000000000100') {
            if (typeof validarEFormatarCpfCnpj === 'function') {
                var resCnpj = validarEFormatarCpfCnpj(cnpjStr);
                if (!resCnpj.valido) {
                    return { valido: false, erro: 'CNPJ inválido: ' + (resCnpj.erro || 'Verifique os dígitos.') };
                }
            }
        }
    }

    if (dados.diasAlertaVencimento !== undefined && dados.diasAlertaVencimento !== null && dados.diasAlertaVencimento !== '') {
        var dias = parseInt(dados.diasAlertaVencimento, 10);
        if (isNaN(dias) || dias < 1 || dias > 30) {
            return { valido: false, erro: 'Os dias de alerta de vencimento devem estar entre 1 e 30 dias.' };
        }
    }

    var normalizado = normalizarConfiguracoesEmpresa(dados);
    return {
        valido: true,
        erro: null,
        dadosNormalizados: normalizado
    };
}

// =========================================================================
// PARTE 2 — SINCRONIZAÇÃO FIREBASE RTDB E INTERFACE DO USUÁRIO (RUNTIME)
// =========================================================================

/**
 * Inicializa a escuta em tempo real do nó `/configuracoes/empresa`.
 */
function iniciarListenerConfiguracoesEmpresa() {
    if (typeof database === 'undefined' || !database) return;

    // Recupera cache local para disponibilidade instantânea
    try {
        if (typeof localStorage !== 'undefined') {
            var cache = localStorage.getItem('configEmpresaTucanoCache');
            if (cache) {
                configEmpresaAtual = normalizarConfiguracoesEmpresa(JSON.parse(cache));
            }
        }
    } catch (e) {
        console.warn('[Configurações] Falha ao ler cache local:', e);
    }

    encerrarListenerConfiguracoesEmpresa();

    configEmpresaRefGlobal = database.ref('configuracoes/empresa');
    configEmpresaRefGlobal.on('value', function(snapshot) {
        var val = snapshot.val();
        if (val) {
            configEmpresaAtual = normalizarConfiguracoesEmpresa(val);
        } else {
            // Se o nó ainda não existe no RTDB, utiliza os valores padrão oficiais
            configEmpresaAtual = normalizarConfiguracoesEmpresa(CONFIG_EMPRESA_PADRAO);
        }

        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('configEmpresaTucanoCache', JSON.stringify(configEmpresaAtual));
            }
        } catch (e) {}

        // Atualiza formulário do modal se estiver aberto
        preencherFormularioConfiguracoesEmpresa(configEmpresaAtual);
    }, function(err) {
        console.error('[Configurações] Erro no listener do Firebase:', err);
    });
}

/**
 * Encerra a escuta do nó `/configuracoes/empresa` (usado no logout).
 */
function encerrarListenerConfiguracoesEmpresa() {
    if (configEmpresaRefGlobal) {
        configEmpresaRefGlobal.off();
        configEmpresaRefGlobal = null;
    }
}

/**
 * Preenche os inputs do formulário de configurações da empresa.
 */
function preencherFormularioConfiguracoesEmpresa(cfg) {
    if (!cfg) return;
    var elNome = document.getElementById('configNomeFantasia');
    var elRazao = document.getElementById('configRazaoSocial');
    var elSub = document.getElementById('configSubtitulo');
    var elCnpj = document.getElementById('configCnpj');
    var elIe = document.getElementById('configInscricaoEstadual');
    var elTel = document.getElementById('configTelefone');
    var elWhats = document.getElementById('configWhatsappLoja');
    var elEnd = document.getElementById('configEndereco');
    var elCid = document.getElementById('configCidadeUf');
    var elPix = document.getElementById('configChavePix');
    var elTipoPix = document.getElementById('configTipoChavePix');
    var elTitPix = document.getElementById('configTitularPix');
    var elDias = document.getElementById('configDiasAlerta');
    var elRodape = document.getElementById('configRodapeDoc');

    if (elNome) elNome.value = cfg.nomeFantasia || '';
    if (elRazao) elRazao.value = cfg.razaoSocial || '';
    if (elSub) elSub.value = cfg.subtitulo || '';
    if (elCnpj) elCnpj.value = cfg.cnpj || '';
    if (elIe) elIe.value = cfg.inscricaoEstadual || '';
    if (elTel) elTel.value = cfg.telefone || '';
    if (elWhats) elWhats.value = cfg.whatsappLoja || '';
    if (elEnd) elEnd.value = cfg.endereco || '';
    if (elCid) elCid.value = cfg.cidadeUf || '';
    if (elPix) elPix.value = cfg.chavePix || '';
    if (elTipoPix) elTipoPix.value = cfg.tipoChavePix || 'CNPJ/Celular/E-mail';
    if (elTitPix) elTitPix.value = cfg.titularPix || '';
    if (elDias) elDias.value = cfg.diasAlertaVencimento || 3;
    if (elRodape) elRodape.value = cfg.rodapeDocumentos || '';
}

/**
 * Abre o modal de Configurações da Empresa e PIX.
 */
function abrirModalConfiguracoesEmpresa() {
    var modal = document.getElementById('modalConfiguracoesEmpresa');
    if (!modal) return;
    preencherFormularioConfiguracoesEmpresa(obterConfiguracoesEmpresaSegura());
    modal.classList.remove('hidden');
}

/**
 * Fecha o modal de Configurações da Empresa.
 */
function fecharModalConfiguracoesEmpresa() {
    var modal = document.getElementById('modalConfiguracoesEmpresa');
    if (modal) modal.classList.add('hidden');
}

/**
 * Salva as configurações editadas no Firebase RTDB e atualiza o estado em memória e localStorage.
 */
async function salvarConfiguracoesEmpresaModal() {
    if (typeof garantirConexaoParaOperacaoFinanceira === 'function') {
        if (!garantirConexaoParaOperacaoFinanceira('Salvar Configurações da Empresa')) {
            return;
        }
    }

    var elNome = document.getElementById('configNomeFantasia');
    var elRazao = document.getElementById('configRazaoSocial');
    var elSub = document.getElementById('configSubtitulo');
    var elCnpj = document.getElementById('configCnpj') || document.getElementById('cfgEmpresaCnpj');
    var elIe = document.getElementById('configInscricaoEstadual');
    var elTel = document.getElementById('configTelefone') || document.getElementById('cfgEmpresaTelefone');
    var elWhats = document.getElementById('configWhatsappLoja') || document.getElementById('cfgEmpresaWhatsapp');
    var elEnd = document.getElementById('configEndereco');
    var elCid = document.getElementById('configCidadeUf');
    var elPix = document.getElementById('configChavePix');
    var elTipoPix = document.getElementById('configTipoChavePix') || document.getElementById('cfgEmpresaTipoChavePix');
    var elTitPix = document.getElementById('configTitularPix');
    var elDias = document.getElementById('configDiasAlerta');
    var elRodape = document.getElementById('configRodapeDoc');

    var cnpjVal = elCnpj ? elCnpj.value.trim() : '';
    // Se for máscara vazia ou sem dígitos, trata como opcional vazio
    if (cnpjVal === '00.000.000/0001-00' || cnpjVal.replace(/\D/g, '') === '' || cnpjVal.replace(/\D/g, '') === '00000000000100') {
        cnpjVal = '';
    }

    var dadosForm = {
        nomeFantasia: elNome ? elNome.value : '',
        razaoSocial: elRazao ? elRazao.value : '',
        subtitulo: elSub ? elSub.value : '',
        cnpj: cnpjVal,
        inscricaoEstadual: elIe ? elIe.value : '',
        telefone: elTel ? elTel.value : '',
        whatsappLoja: elWhats ? elWhats.value : '',
        endereco: elEnd ? elEnd.value : '',
        cidadeUf: elCid ? elCid.value : '',
        chavePix: elPix ? elPix.value : '',
        tipoChavePix: elTipoPix ? elTipoPix.value : '',
        titularPix: elTitPix ? elTitPix.value : '',
        diasAlertaVencimento: elDias ? elDias.value : 3,
        rodapeDocumentos: elRodape ? elRodape.value : ''
    };

    var validacao = validarDadosConfiguracaoEmpresa(dadosForm);
    if (!validacao.valido) {
        if (typeof Swal !== 'undefined') {
            Swal.fire('Atenção', validacao.erro, 'warning');
        } else {
            alert(validacao.erro);
        }
        return;
    }

    var userEmail = (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser.email : 'operador';
    var dadosParaSalvar = validacao.dadosNormalizados;
    dadosParaSalvar.atualizadoEm = new Date().toISOString();
    dadosParaSalvar.atualizadoPor = userEmail;

    // Atualiza imediatamente cache local e variável em memória
    configEmpresaAtual = dadosParaSalvar;
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('configEmpresaTucanoCache', JSON.stringify(dadosParaSalvar));
        }
    } catch (eCache) {
        console.warn('[Configurações] Falha ao gravar cache local:', eCache);
    }

    try {
        if (typeof database !== 'undefined' && database) {
            await database.ref('configuracoes/empresa').set(dadosParaSalvar);
        }

        fecharModalConfiguracoesEmpresa();

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'Salvo com Sucesso!',
                text: 'As configurações da empresa e Chave PIX foram salvas.',
                timer: 2500,
                showConfirmButton: false
            });
        }
    } catch (err) {
        console.error('[Configurações] Erro ao sincronizar no Firebase:', err);
        fecharModalConfiguracoesEmpresa();
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'warning',
                title: 'Salvo no Dispositivo',
                text: 'As configurações foram salvas localmente com sucesso. Houve aviso ao sincronizar no Firebase: ' + (err.message || err)
            });
        }
    }
}

// Export para testes em ambiente Node.js / VM
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CONFIG_EMPRESA_PADRAO: CONFIG_EMPRESA_PADRAO,
        normalizarConfiguracoesEmpresa: normalizarConfiguracoesEmpresa,
        obterConfiguracoesEmpresaSegura: obterConfiguracoesEmpresaSegura,
        validarDadosConfiguracaoEmpresa: validarDadosConfiguracaoEmpresa
    };
}
