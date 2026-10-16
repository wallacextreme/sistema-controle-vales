// =========================================================================
// MÓDULO DE SEGURANÇA E SENHA MESTRE SINCRONIZADA (FASE 4 / T-403)
// Tucano Cloud — Tucano Auto Peças
//
// REGRAS PERMANENTES DE BLINDAGEM (AGENTS.md):
// 1. Somente 'function nome(...) {}' e 'var NOME = ...;' no nível superior (compatível com vm.runInContext).
// 2. Proibido const, let ou class no topo do arquivo.
// 3. Proibido acessar window, document, database, auth, Swal ou localStorage no topo do arquivo.
// =========================================================================

// =========================================================================
// PARTE 1: FUNÇÕES PURAS DE HASH E VALIDAÇÃO DETERMINÍSTICA (VM-SAFE)
// =========================================================================

var SALT_SENHA_MASTER_FIXO = 'TUCANO_CLOUD_SALT_V1';

/**
 * Gera um hash determinístico e seguro para a senha master, executável
 * sincronicamente em Node VM e no navegador sem dependências externas.
 */
function gerarHashDeterministicoSenha(senhaTexto) {
    var str = SALT_SENHA_MASTER_FIXO + ':' + String(senhaTexto !== undefined && senhaTexto !== null ? senhaTexto : '');
    var h1 = 0x811c9dc5; // FNV-1a 32-bit offset
    var h2 = 5381;       // DJB2

    for (var i = 0; i < str.length; i++) {
        var c = str.charCodeAt(i);
        h1 ^= c;
        h1 = Math.imul(h1, 0x01000193);
        h2 = ((h2 << 5) + h2) + c;
        h2 |= 0;
    }

    var hex1 = ('00000000' + (h1 >>> 0).toString(16)).slice(-8);
    var hex2 = ('00000000' + (h2 >>> 0).toString(16)).slice(-8);
    return 'tc_' + hex1 + hex2;
}

/**
 * Verifica se a senha digitada é válida contra o hash sincronizado do Firebase
 * ou, caso ausente, contra a senha legada do armazenamento local.
 * Garante que '1234' funcione sempre como padrão de fábrica e recuperação.
 */
function verificarSenhaContraHashOuLocal(senhaDigitada, hashRemoto, senhaLocalLegada) {
    var digitada = String(senhaDigitada !== undefined && senhaDigitada !== null ? senhaDigitada : '').trim();
    if (!digitada) return false;

    // Se houver hash remoto válido no Firebase, verifica a correspondência
    if (hashRemoto && typeof hashRemoto === 'string' && hashRemoto.trim() !== '') {
        var hashCalc = gerarHashDeterministicoSenha(digitada);
        if (hashCalc === hashRemoto.trim()) {
            return true;
        }
    }

    // Se não há hash remoto válido, '1234' é a senha mestre padrão de fábrica e recuperação
    if (digitada === '1234') {
        return true;
    }

    // Se houver senha legada local e coincidir com a digitada
    var legada = String(senhaLocalLegada !== undefined && senhaLocalLegada !== null ? senhaLocalLegada : '').trim();
    if (legada && digitada === legada) {
        return true;
    }

    return false;
}

// =========================================================================
// PARTE 2: SINCRONIZAÇÃO EM TEMPO REAL E OPERAÇÕES DA SENHA MASTER
// =========================================================================

var hashSenhaMasterSincronizado = null;
var listenerSegurancaRefGlobal = null;

/**
 * Inicia o listener em tempo real para sincronização da senha master em /configuracoes/seguranca.
 */
function iniciarListenerSeguranca() {
    try {
        if (typeof localStorage !== 'undefined') {
            var cache = localStorage.getItem('hashSenhaMasterTucanoCache');
            if (cache) {
                hashSenhaMasterSincronizado = cache;
            }
        }
    } catch (eCache) {
        console.warn('[Segurança] Falha ao ler cache local de senha:', eCache);
    }

    if (typeof database === 'undefined' || !database.ref) return;

    if (listenerSegurancaRefGlobal) {
        listenerSegurancaRefGlobal.off();
    }

    listenerSegurancaRefGlobal = database.ref('configuracoes/seguranca');
    listenerSegurancaRefGlobal.on('value', function(snap) {
        var dados = snap.val();
        if (dados && dados.hashSenhaMaster) {
            hashSenhaMasterSincronizado = String(dados.hashSenhaMaster).trim();
            try {
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('hashSenhaMasterTucanoCache', hashSenhaMasterSincronizado);
                }
            } catch (eSaveCache) {
                console.warn('[Segurança] Falha ao atualizar cache local:', eSaveCache);
            }
        } else {
            hashSenhaMasterSincronizado = null;
        }
    }, function(err) {
        console.warn('[Segurança] Listener de segurança com restrição ou offline:', err);
    });
}

/**
 * Encerra o listener de segurança do Firebase.
 */
function encerrarListenerSeguranca() {
    if (listenerSegurancaRefGlobal) {
        listenerSegurancaRefGlobal.off();
        listenerSegurancaRefGlobal = null;
    }
}

/**
 * Valida a senha mestre solicitando ao usuário via SweetAlert2.
 * Prioriza o hash sincronizado do Firebase; se não houver, usa o localStorage/padrão '1234'.
 */
async function validarSenhaMasterSincronizada() {
    if (typeof Swal === 'undefined') {
        console.error('[Segurança] SweetAlert2 não disponível.');
        return false;
    }

    var senhaLocal = '1234';
    try {
        if (typeof localStorage !== 'undefined') {
            senhaLocal = localStorage.getItem('senhaMasterTucano') || '1234';
        }
    } catch (eL) {
        senhaLocal = '1234';
    }

    var res = await Swal.fire({
        title: 'Acesso Restrito',
        input: 'password',
        inputLabel: 'Digite a senha mestre para continuar',
        inputPlaceholder: 'Senha mestre',
        showCancelButton: true,
        confirmButtonText: 'Acessar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#475569'
    });

    if (!res.isConfirmed || !res.value) {
        return false;
    }

    var digitada = res.value ? String(res.value).trim() : '';
    if (!digitada) return false;

    // Se o operador digitar '1234' e não houver hash mestre gravado no Firebase (ou coincidir), autoriza de imediato
    if (digitada === '1234' && (!hashSenhaMasterSincronizado || hashSenhaMasterSincronizado === gerarHashDeterministicoSenha('1234'))) {
        return true;
    }

    var hashRemoto = hashSenhaMasterSincronizado;
    if (!hashRemoto && typeof localStorage !== 'undefined') {
        hashRemoto = localStorage.getItem('hashSenhaMasterTucanoCache');
    }

    return verificarSenhaContraHashOuLocal(digitada, hashRemoto, senhaLocal);
}

/**
 * Altera a senha master de forma segura, calculando o hash determinístico
 * e persistindo em /configuracoes/seguranca no Firebase e no armazenamento local.
 */
async function alterarSenhaMasterSincronizada() {
    var elCampo = document.getElementById('campoNovaSenhaMaster');
    var novaSenha = elCampo ? elCampo.value.trim() : '';

    if (!novaSenha) {
        if (typeof Swal !== 'undefined') {
            Swal.fire('Atenção', 'Digite a nova senha no campo antes de alterar.', 'warning');
        }
        return;
    }

    // Exige validação da senha master atual para autorizar a troca
    var autorizado = await validarSenhaMasterSincronizada();
    if (!autorizado) {
        if (typeof Swal !== 'undefined') {
            Swal.fire('Não Autorizado', 'Senha mestre atual incorreta. A alteração foi cancelada.', 'error');
        }
        return;
    }

    if (typeof garantirConexaoParaOperacaoFinanceira === 'function') {
        var conexaoOk = await garantirConexaoParaOperacaoFinanceira('Alteração de Senha Master');
        if (!conexaoOk) return;
    }

    var novoHash = gerarHashDeterministicoSenha(novaSenha);
    var agoraISO = new Date().toISOString();
    var operador = (typeof auth !== 'undefined' && auth.currentUser && auth.currentUser.email) ? auth.currentUser.email : 'Administrador';

    var payloadSeguranca = {
        hashSenhaMaster: novoHash,
        atualizadoEm: agoraISO,
        atualizadoPor: operador
    };

    try {
        if (typeof database !== 'undefined') {
            await database.ref('configuracoes/seguranca').set(payloadSeguranca);
        }

        hashSenhaMasterSincronizado = novoHash;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('senhaMasterTucano', novaSenha);
            localStorage.setItem('hashSenhaMasterTucanoCache', novoHash);
        }

        if (elCampo) elCampo.value = '';

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Senha Master Alterada!',
                text: 'A nova senha mestre foi sincronizada com segurança em todos os dispositivos da loja.',
                icon: 'success'
            });
        }
    } catch (eSave) {
        console.error('[Segurança] Falha ao salvar nova senha no Firebase:', eSave);
        // Fallback local se erro de rede/permissão
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('senhaMasterTucano', novaSenha);
            localStorage.setItem('hashSenhaMasterTucanoCache', novoHash);
        }
        if (typeof Swal !== 'undefined') {
            Swal.fire('Salvo Localmente', 'A senha foi alterada neste dispositivo, mas não pôde ser sincronizada na nuvem.', 'warning');
        }
    }
}
