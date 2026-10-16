// [FASE 0 / T-001] Núcleo Financeiro, Datas e Utilitários - Tucano Cloud
// Regras Permanentes:
// 1. Apenas 'var' e 'function' no nível superior (compatível com vm.runInContext e browser clássico).
// 2. Proibido acessar DOM/Firebase no topo do arquivo.
// 3. Aritmética financeira sempre em centavos inteiros.
// 4. Datas de negócio sempre no fuso 'America/Sao_Paulo' (YYYY-MM-DD).

// Estado global de conectividade RTDB
var estadoConexaoFirebase = true;

// Tabelas para valor por extenso em BRL
var UNIDADES_EXTENSO = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
var DEZ_A_DEZENOVE_EXTENSO = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
var DEZENAS_EXTENSO = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
var CENTENAS_EXTENSO = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
var ESCALAS_EXTENSO = [
    { singular: '', plural: '' },
    { singular: 'mil', plural: 'mil' },
    { singular: 'milhão', plural: 'milhões' },
    { singular: 'bilhão', plural: 'bilhões' },
    { singular: 'trilhão', plural: 'trilhões' }
];

// =========================================================================
// 1. ARITMÉTICA MONETÁRIA EM CENTAVOS INTEIROS
// =========================================================================

/**
 * Converte number ou string ("R$ 1.234,56", "1234.56", 1234.56) para inteiro de centavos.
 * Retorna 0 se inválido ou NaN.
 */
function moedaParaCentavos(valor) {
    if (valor === null || valor === undefined || valor === '') return 0;
    if (typeof valor === 'number') {
        if (!isFinite(valor) || isNaN(valor)) return 0;
        return Math.round(valor * 100);
    }
    if (typeof valor === 'string') {
        var str = valor.trim();
        if (!str) return 0;
        var negativo = (str.indexOf('-') !== -1 || str.indexOf('(') !== -1);
        var limpo = str.replace(/[^\d.,]/g, '');
        if (!limpo) return 0;
        var temVirgula = limpo.indexOf(',') !== -1;
        var temPonto = limpo.indexOf('.') !== -1;
        var normalizado = limpo;

        if (temVirgula && temPonto) {
            if (limpo.lastIndexOf(',') > limpo.lastIndexOf('.')) {
                // Formato brasileiro: 1.234,56
                normalizado = limpo.replace(/\./g, '').replace(',', '.');
            } else {
                // Formato internacional: 1,234.56
                normalizado = limpo.replace(/,/g, '');
            }
        } else if (temVirgula) {
            var partesVirgula = limpo.split(',');
            if (partesVirgula.length === 2) {
                normalizado = limpo.replace(',', '.');
            } else {
                normalizado = limpo.replace(/,/g, '');
            }
        }

        var num = parseFloat(normalizado);
        if (isNaN(num) || !isFinite(num)) return 0;
        var centavos = Math.round(num * 100);
        return negativo ? -Math.abs(centavos) : centavos;
    }
    return 0;
}

/**
 * Converte inteiro de centavos para number em reais com 2 casas decimais.
 */
function centavosParaReais(centavos) {
    return Math.round(Number(centavos) || 0) / 100;
}

/**
 * Arredonda valor monetário convertendo para centavos inteiros e de volta para reais.
 */
function arredondarMoeda(valor) {
    return centavosParaReais(moedaParaCentavos(valor));
}

/**
 * Soma um array de valores monetários em centavos inteiros e retorna o total em reais.
 */
function somarValoresMoeda(listaValores) {
    if (!listaValores || !Array.isArray(listaValores)) return 0;
    var totalCentavos = 0;
    for (var i = 0; i < listaValores.length; i++) {
        totalCentavos += moedaParaCentavos(listaValores[i]);
    }
    return centavosParaReais(totalCentavos);
}

// =========================================================================
// 2. DATAS DE NEGÓCIO NO FUSO America/Sao_Paulo (YYYY-MM-DD)
// =========================================================================

/**
 * Retorna a data no formato ISO YYYY-MM-DD no fuso 'America/Sao_Paulo'.
 * Aceita Date, timestamp number ou string YYYY-MM-DD.
 * Nunca usa toISOString() para datas de negócio.
 */
function obterDataLocalISO(dataRef) {
    if (typeof dataRef === 'string') {
        var str = dataRef.trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
            return str.slice(0, 10);
        }
    }

    var d;
    if (dataRef === null || dataRef === undefined || dataRef === '') {
        d = new Date();
    } else if (dataRef instanceof Date || (dataRef && typeof dataRef.getTime === 'function')) {
        d = dataRef;
    } else if (typeof dataRef === 'number') {
        d = new Date(dataRef);
    } else if (typeof dataRef === 'string') {
        d = new Date(dataRef);
    } else {
        d = new Date();
    }

    if (isNaN(d.getTime())) {
        d = new Date();
    }

    try {
        var fmt = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Sao_Paulo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        var res = fmt.format(d);
        if (/^\d{4}-\d{2}-\d{2}$/.test(res)) {
            return res;
        }
    } catch (e) {}

    // Fallback estruturado com formatToParts
    try {
        var dtf = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Sao_Paulo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        var parts = dtf.formatToParts(d);
        var y = '', m = '', day = '';
        for (var i = 0; i < parts.length; i++) {
            if (parts[i].type === 'year') y = parts[i].value;
            if (parts[i].type === 'month') m = parts[i].value;
            if (parts[i].type === 'day') day = parts[i].value;
        }
        if (y && m && day) {
            return y + '-' + m + '-' + day;
        }
    } catch (e2) {}

    var ano = d.getFullYear();
    var mes = String(d.getMonth() + 1).padStart(2, '0');
    var dia = String(d.getDate()).padStart(2, '0');
    return ano + '-' + mes + '-' + dia;
}

/**
 * Adiciona meses a uma data YYYY-MM-DD com ajuste seguro de final de mês.
 * Retorna sempre YYYY-MM-DD.
 */
function adicionarMesesDataLocalISO(dataIsoStr, meses) {
    var baseISO = obterDataLocalISO(dataIsoStr);
    var qtdMeses = parseInt(meses, 10);
    if (isNaN(qtdMeses)) qtdMeses = 0;
    if (qtdMeses === 0) return baseISO;

    var partes = baseISO.split('-');
    var ano = parseInt(partes[0], 10);
    var mes = parseInt(partes[1], 10); // 1 a 12
    var dia = parseInt(partes[2], 10);

    var indiceMesAlvo = (mes - 1) + qtdMeses;
    var anoAlvo = ano + Math.floor(indiceMesAlvo / 12);
    var mesAlvo = (indiceMesAlvo % 12 + 12) % 12 + 1; // 1 a 12

    // Último dia do mês alvo
    var diasNoMesAlvo = new Date(anoAlvo, mesAlvo, 0).getDate();
    var diaAlvo = Math.min(dia, diasNoMesAlvo);

    var mesStr = mesAlvo < 10 ? '0' + mesAlvo : String(mesAlvo);
    var diaStr = diaAlvo < 10 ? '0' + diaAlvo : String(diaAlvo);
    return anoAlvo + '-' + mesStr + '-' + diaStr;
}

/**
 * Calcula a diferença exata em dias corridos entre dataVencimentoISO e dataReferenciaISO.
 * Retorna > 0 se vencimento for futuro, < 0 se já venceu, 0 se igual.
 */
function calcularDiferencaDiasISO(dataVencimentoISO, dataReferenciaISO) {
    if (!dataVencimentoISO || !dataReferenciaISO) return 0;
    var vStr = String(dataVencimentoISO).slice(0, 10);
    var rStr = String(dataReferenciaISO).slice(0, 10);
    var pV = vStr.split('-');
    var pR = rStr.split('-');
    if (pV.length !== 3 || pR.length !== 3) return 0;

    var aV = parseInt(pV[0], 10), mV = parseInt(pV[1], 10), dV = parseInt(pV[2], 10);
    var aR = parseInt(pR[0], 10), mR = parseInt(pR[1], 10), dR = parseInt(pR[2], 10);

    var utcV = Date.UTC(aV, mV - 1, dV);
    var utcR = Date.UTC(aR, mR - 1, dR);
    var msPorDia = 86400000; // 24 * 60 * 60 * 1000
    return Math.round((utcV - utcR) / msPorDia);
}

// =========================================================================
// 3. VALOR POR EXTENSO EM PORTUGUÊS (BRL)
// =========================================================================

function converterGrupoAbaixoMilExtenso(n) {
    if (n === 0) return '';
    if (n === 100) return 'cem';
    var resultado = '';
    var c = Math.floor(n / 100);
    var resto = n % 100;
    if (c > 0) {
        resultado += (c === 1 && resto === 0) ? 'cem' : CENTENAS_EXTENSO[c];
        if (resto > 0) resultado += ' e ';
    }
    if (resto > 0) {
        if (resto < 10) {
            resultado += UNIDADES_EXTENSO[resto];
        } else if (resto < 20) {
            resultado += DEZ_A_DEZENOVE_EXTENSO[resto - 10];
        } else {
            var d = Math.floor(resto / 10);
            var u = resto % 10;
            resultado += DEZENAS_EXTENSO[d];
            if (u > 0) resultado += ' e ' + UNIDADES_EXTENSO[u];
        }
    }
    return resultado;
}

function converterInteiroPorExtensoBRL(num) {
    if (num === 0) return 'zero';
    var grupos = [];
    var temp = num;
    while (temp > 0) {
        grupos.push(temp % 1000);
        temp = Math.floor(temp / 1000);
    }

    var partes = [];
    for (var i = grupos.length - 1; i >= 0; i--) {
        var g = grupos[i];
        if (g === 0) continue;
        var textoGrupo = converterGrupoAbaixoMilExtenso(g);
        var escala = ESCALAS_EXTENSO[i];
        if (i === 1) {
            partes.push({ texto: (g === 1 ? 'um mil' : textoGrupo + ' mil'), valor: g, nivel: i });
        } else if (i > 1) {
            var nomeEscala = (g === 1) ? escala.singular : escala.plural;
            partes.push({ texto: textoGrupo + ' ' + nomeEscala, valor: g, nivel: i });
        } else {
            partes.push({ texto: textoGrupo, valor: g, nivel: i });
        }
    }
    if (partes.length === 1) return partes[0].texto;

    var resultado = partes[0].texto;
    for (var j = 1; j < partes.length; j++) {
        var atual = partes[j];
        var conectarComE = false;
        if (j === partes.length - 1) {
            if (atual.valor < 100 || (atual.valor % 100 === 0)) {
                conectarComE = true;
            }
        }
        if (conectarComE) {
            resultado += ' e ' + atual.texto;
        } else {
            resultado += ', ' + atual.texto;
        }
    }
    return resultado;
}

/**
 * Converte qualquer valor monetário (number ou string) para texto por extenso em português do Brasil.
 * Exemplos:
 *  0.01 -> "um centavo"
 *  1.00 -> "um real"
 *  150.50 -> "cento e cinquenta reais e cinquenta centavos"
 *  1234.56 -> "um mil, duzentos e trinta e quatro reais e cinquenta e seis centavos"
 *  1000000.00 -> "um milhão de reais"
 */
function valorPorExtensoBRL(valor) {
    var centavosTotais = moedaParaCentavos(valor);
    var negativo = centavosTotais < 0;
    var absCentavos = Math.abs(centavosTotais);
    var reais = Math.floor(absCentavos / 100);
    var centavos = absCentavos % 100;

    if (reais === 0 && centavos === 0) return 'zero reais';

    var partes = [];
    if (reais > 0) {
        var textoReais = converterInteiroPorExtensoBRL(reais);
        var sufixoReais = ' reais';
        if (reais === 1) {
            sufixoReais = ' real';
        } else if (reais >= 1000000 && (reais % 1000000 === 0)) {
            sufixoReais = ' de reais';
        }
        partes.push(textoReais + sufixoReais);
    }

    if (centavos > 0) {
        var textoCentavos = converterInteiroPorExtensoBRL(centavos);
        var sufixoCentavos = (centavos === 1) ? ' centavo' : ' centavos';
        partes.push(textoCentavos + sufixoCentavos);
    }

    var resultado = partes.join(' e ');
    return (negativo ? 'menos ' : '') + resultado;
}

// =========================================================================
// 4. UTILITÁRIOS SEGUROS E GUARDA DE CONEXÃO
// =========================================================================

/**
 * Escape seguro de HTML para evitar injeção XSS em funções puras do núcleo.
 */
function nucleoEscapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Atualiza o estado da conexão RTDB monitorado pelo núcleo.
 */
function atualizarEstadoConexaoNucleo(conectado) {
    estadoConexaoFirebase = Boolean(conectado);
}

/**
 * Garante conexão ativa antes de permitir operações financeiras críticas.
 * Retorna false e exibe alerta se offline; retorna true se online.
 */
function garantirConexaoParaOperacaoFinanceira(nomeOperacao) {
    var navegadorOnline = true;
    if (typeof navigator !== 'undefined' && navigator && typeof navigator.onLine === 'boolean') {
        navegadorOnline = navigator.onLine;
    }
    var online = (estadoConexaoFirebase !== false) && (navegadorOnline !== false);
    if (!online) {
        var operacao = nomeOperacao ? String(nomeOperacao) : 'Operação financeira';
        if (typeof Swal !== 'undefined' && Swal && typeof Swal.fire === 'function') {
            Swal.fire({
                icon: 'error',
                title: 'Operação Bloqueada: Sem Conexão',
                html: 'Não é possível realizar <b>' + nucleoEscapeHtml(operacao) + '</b> enquanto o sistema estiver offline.<br><br>Verifique a sua conexão com a internet e com o servidor antes de continuar.',
                confirmButtonColor: '#ef4444',
                confirmButtonText: 'Entendido'
            });
        }
        return false;
    }
    return true;
}

// Export para ambientes Node.js / testes automatizados
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        moedaParaCentavos: moedaParaCentavos,
        centavosParaReais: centavosParaReais,
        arredondarMoeda: arredondarMoeda,
        somarValoresMoeda: somarValoresMoeda,
        obterDataLocalISO: obterDataLocalISO,
        adicionarMesesDataLocalISO: adicionarMesesDataLocalISO,
        calcularDiferencaDiasISO: calcularDiferencaDiasISO,
        converterGrupoAbaixoMilExtenso: converterGrupoAbaixoMilExtenso,
        converterInteiroPorExtensoBRL: converterInteiroPorExtensoBRL,
        valorPorExtensoBRL: valorPorExtensoBRL,
        nucleoEscapeHtml: nucleoEscapeHtml,
        atualizarEstadoConexaoNucleo: atualizarEstadoConexaoNucleo,
        garantirConexaoParaOperacaoFinanceira: garantirConexaoParaOperacaoFinanceira
    };
}
