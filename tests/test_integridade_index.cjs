// =========================================================================
// TESTE DE INTEGRIDADE E BLINDAGEM DO src/index.html (AGENTS.md)
// =========================================================================
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('=================================================================');
console.log('INICIANDO VERIFICAÇÃO DE INTEGRIDADE DO src/index.html');
console.log('=================================================================\n');

const htmlPath = path.join(__dirname, '../src/index.html');
assert(fs.existsSync(htmlPath), 'src/index.html deve existir');

const html = fs.readFileSync(htmlPath, 'utf8');

// 1. Verificação de Fechamento do Documento
console.log('1. Verificando estrutura e fechamento HTML...');
assert(html.trim().endsWith('</html>'), 'src/index.html deve terminar obrigatoriamente com </html>');
console.log('   ✓ src/index.html termina perfeitamente com </html>');

// 2. Verificação de Marcadores Proibidos de Truncamento
console.log('2. Verificando marcadores proibidos de truncamento...');
const marcadoresProibidos = [
    '// ... resto',
    '/* ... resto',
    '<!-- ... resto',
    '// (código existente)',
    '/* (código existente)',
    '<!-- (código existente)',
    '// ... restante',
    '// ... demais',
    '// ... continuação'
];
for (const marcador of marcadoresProibidos) {
    assert(!html.toLowerCase().includes(marcador), `Encontrado marcador de truncamento proibido: "${marcador}"`);
}
console.log('   ✓ Nenhum marcador de truncamento encontrado no HTML.');

// 3. Verificação da Ordem dos Scripts Auxiliares
console.log('3. Verificando ordem de carregamento dos scripts...');
const regexScriptSrc = /<script\s+src="([^"]+)"><\/script>/g;
const scriptsCarregados = [];
let match;
while ((match = regexScriptSrc.exec(html)) !== null) {
    scriptsCarregados.push(match[1]);
}

const indiceFirebaseConfig = scriptsCarregados.indexOf('firebase-config.js');
assert(indiceFirebaseConfig !== -1, 'firebase-config.js deve ser carregado em src/index.html');

// Ordem canônica esperada conforme AGENTS.md
const ordemEsperada = [
    'firebase-config.js',
    'js/nucleo-financeiro.js',
    'js/clientes.js',
    'js/relatorios.js',
    'js/configuracoes.js',
    'js/impressao.js',
    'js/whatsapp.js',
    'js/backup-v3.js',
    'js/seguranca.js'
];

// Para cada script presente, garantir que os arquivos existam e estejam na ordem relativa
let ultimoIndice = -1;
for (const item of ordemEsperada) {
    const idx = scriptsCarregados.indexOf(item);
    if (idx !== -1) {
        assert(idx > ultimoIndice, `Script "${item}" está fora da ordem obrigatória definida em AGENTS.md`);
        ultimoIndice = idx;

        // Se for um módulo em js/, garantir existência no disco
        if (item.startsWith('js/')) {
            const arquivoModulo = path.join(__dirname, '../src', item);
            assert(fs.existsSync(arquivoModulo), `Arquivo do módulo "${item}" referenciado no HTML não foi encontrado no disco`);
        }
    }
}
console.log('   ✓ Ordem dos scripts auxiliares validada.');

// 4. Verificação de Sintaxe do Script Inline Principal
console.log('4. Verificando sintaxe JS do script inline principal...');
const scriptInlineMatch = html.match(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>\s*<\/body>/);
assert(scriptInlineMatch, 'Script inline principal antes de </body> não encontrado');
const codigoInline = scriptInlineMatch[1];

try {
    new vm.Script(codigoInline);
    console.log('   ✓ Sintaxe do script inline validada com sucesso pelo V8 VM.');
} catch (e) {
    assert.fail(`Erro de sintaxe no script inline de src/index.html: ${e.message}`);
}

// 5. Verificação de Colisão de Identificadores (Módulos vs Script Inline)
console.log('5. Verificando colisão de nomes entre módulos src/js/*.js e script inline...');

function extrairDeclaracoesNivelZero(codigo) {
    const declaracoes = new Set();
    const linhas = codigo.split('\n');
    let profundidade = 0;
    let emComentarioBloco = false;

    for (let l = 0; l < linhas.length; l++) {
        const linha = linhas[l];
        let i = 0;
        let limpa = '';
        while (i < linha.length) {
            if (emComentarioBloco) {
                if (linha[i] === '*' && linha[i + 1] === '/') {
                    emComentarioBloco = false;
                    i += 2;
                } else {
                    i++;
                }
                continue;
            }
            if (linha[i] === '/' && linha[i + 1] === '*') {
                emComentarioBloco = true;
                i += 2;
                continue;
            }
            if (linha[i] === '/' && linha[i + 1] === '/') {
                break; // comentário de linha
            }
            if (linha[i] === '"' || linha[i] === "'" || linha[i] === '`') {
                const quote = linha[i];
                i++;
                while (i < linha.length && linha[i] !== quote) {
                    if (linha[i] === '\\') i++;
                    i++;
                }
                i++; // consome quote final
                continue;
            }
            limpa += linha[i];
            i++;
        }

        if (profundidade === 0 && !emComentarioBloco) {
            const m = limpa.match(/^\s*(?:const|let|var|function)\s+([a-zA-Z0-9_$]+)/);
            if (m) {
                declaracoes.add(m[1]);
            }
        }

        for (let j = 0; j < limpa.length; j++) {
            if (limpa[j] === '{') profundidade++;
            else if (limpa[j] === '}') {
                if (profundidade > 0) profundidade--;
            }
        }
    }
    return declaracoes;
}

const declaracoesInline = extrairDeclaracoesNivelZero(codigoInline);
console.log(`   * Encontradas ${declaracoesInline.size} declarações no nível superior do script inline.`);

// Verifica cada arquivo em src/js/*.js
const pastaJs = path.join(__dirname, '../src/js');
if (fs.existsSync(pastaJs)) {
    const arquivosJs = fs.readdirSync(pastaJs).filter(f => f.endsWith('.js'));
    for (const arq of arquivosJs) {
        const conteudo = fs.readFileSync(path.join(pastaJs, arq), 'utf8');

        // Regra do AGENTS.md: proibido const/let/class no topo do arquivo do módulo
        const declsModulo = extrairDeclaracoesNivelZero(conteudo);
        
        // Verifica se usou const/let/class no nível zero
        const linhasModulo = conteudo.split('\n');
        let profMod = 0;
        for (const linha of linhasModulo) {
            const mProibido = linha.match(/^\s*(?:const|let|class)\s+([a-zA-Z0-9_$]+)/);
            if (profMod === 0 && mProibido) {
                assert.fail(`[AGENTS.md Regra 1.2] Proibido usar 'const', 'let' ou 'class' no nível superior de ${arq}. Encontrado: "${mProibido[0].trim()}"`);
            }
            for (let c of linha) {
                if (c === '{') profMod++;
                else if (c === '}' && profMod > 0) profMod--;
            }
        }

        // Verifica colisão
        for (const nomeIdentificador of declsModulo) {
            if (declaracoesInline.has(nomeIdentificador)) {
                assert.fail(`[AGENTS.md Regra 1.2] Colisão detectada: "${nomeIdentificador}" em ${arq} já está declarado no script inline de src/index.html! Isso causa SyntaxError e derruba a aplicação.`);
            }
        }
    }
}
// 6. Auditoria das Correções Cirúrgicas da Fase 0 (T-003)
console.log('6. Verificando adoção dos helpers do núcleo financeiro e correções cirúrgicas...');

// Helper de verificação
assert(codigoInline.includes('obterDataLocalISO(') || codigoInline.includes('obterDataLocalISO()'), 'src/index.html deve invocar obterDataLocalISO()');
assert(codigoInline.includes('adicionarMesesDataLocalISO('), 'src/index.html deve invocar adicionarMesesDataLocalISO()');
assert(codigoInline.includes('valorPorExtensoBRL('), 'src/index.html deve invocar valorPorExtensoBRL()');
assert(codigoInline.includes('atualizarEstadoConexaoNucleo('), 'src/index.html deve invocar atualizarEstadoConexaoNucleo()');
assert(codigoInline.includes('garantirConexaoParaOperacaoFinanceira('), 'src/index.html deve invocar garantirConexaoParaOperacaoFinanceira()');

// Verifica eliminação de toISOString().split('T')[0] nas datas de negócio
assert(!codigoInline.includes(".toISOString().split('T')[0]"), 'Não deve existir nenhum toISOString().split("T")[0] para datas de negócio em src/index.html');

// Verifica bloqueio de cancelamento de notas com pagamentos ativos
assert(codigoInline.includes('!temPagto'), 'atualizarTabelaNotasPrazo deve exigir !temPagto para exibir botão de cancelamento');
assert(codigoInline.includes('PAGAMENTOS_ATIVOS'), 'solicitarCancelamentoNota deve abortar transação caso a nota possua pagamentos ativos');

// Verifica registro de recibos inutilizados
assert(codigoInline.includes('sequencias/recibosInutilizados'), 'confirmarProcessoDeBaixaNota deve registrar recibos inutilizados se transação não comitar');

// Verifica limpeza de memória de vales no logout
assert(codigoInline.includes('valesMap = {};'), 'onAuthStateChanged (logout) deve limpar valesMap');
assert(codigoInline.includes('listaGlobalVales = [];'), 'onAuthStateChanged (logout) deve limpar listaGlobalVales');

console.log('   ✓ Todos os helpers do núcleo financeiro, bloqueios e limpezas da Fase 0 validados no inline!');

// 7. Auditoria das Integrações da Fase 1 (Clientes e Carteira)
console.log('7. Verificando integrações de UI e ciclo de vida da Fase 1 (Clientes)...');
assert(scriptsCarregados.includes('js/clientes.js'), 'src/index.html deve carregar js/clientes.js');
assert(codigoInline.includes('iniciarListenerClientes()'), 'onAuthStateChanged deve invocar iniciarListenerClientes() no login');
assert(codigoInline.includes('encerrarListenerClientes()'), 'onAuthStateChanged deve invocar encerrarListenerClientes() no logout');
assert(codigoInline.includes('limiteCredito > 0'), 'formCadastroNotaPrazo deve validar limiteCredito do cliente');

// Verificação de elementos HTML da Fase 1
assert(html.includes('id="modalCadastroCliente"'), 'Modal modalCadastroCliente deve existir em src/index.html');
assert(html.includes('id="modalFichaCliente"'), 'Modal modalFichaCliente deve existir em src/index.html');
assert(html.includes('id="modalConciliacaoClientes"'), 'Modal modalConciliacaoClientes deve existir em src/index.html');
assert(html.includes('id="btnSubAbaLancamentos"'), 'Botão btnSubAbaLancamentos deve existir em src/index.html');
assert(html.includes('id="btnSubAbaClientes"'), 'Botão btnSubAbaClientes deve existir em src/index.html');
assert(html.includes('id="subAbaConteudoClientes"'), 'Sub-aba subAbaConteudoClientes deve existir em src/index.html');
assert(html.includes('id="listaClientesAutocomplete"'), 'Datalist listaClientesAutocomplete deve existir em src/index.html');
assert(html.includes('id="boxResumoClienteNota"'), 'Elemento boxResumoClienteNota deve existir em src/index.html');
assert(html.includes('id="tabelaCorpoCarteiraClientes"'), 'Tabela tabelaCorpoCarteiraClientes deve existir em src/index.html');
assert(html.includes('id="tabelaRodapeCarteiraAutoSoma"'), 'Rodapé tabelaRodapeCarteiraAutoSoma deve existir em src/index.html');

console.log('   ✓ Todas as integrações de UI, modais, autocomplete e listeners da Fase 1 validados!');

// 8. Auditoria das Integrações da Fase 2 (Relatórios Detalhados e Auto-Soma)
console.log('8. Verificando integrações de UI e Auto-Soma da Fase 2 (Relatórios)...');
assert(scriptsCarregados.includes('js/relatorios.js'), 'src/index.html deve carregar js/relatorios.js');
assert(html.includes('id="btnSubAbaNotasRelatorios"'), 'Botão btnSubAbaNotasRelatorios deve existir em src/index.html');
assert(html.includes('id="subAbaNotasRelatorios"'), 'Sub-aba subAbaNotasRelatorios deve existir em src/index.html');
assert(html.includes('id="selectTipoRelatorio"'), 'Seletor selectTipoRelatorio deve existir em src/index.html');
assert(html.includes('id="relatorioPeriodoDescricao"'), 'Elemento relatorioPeriodoDescricao deve existir em src/index.html');
assert(html.includes('id="relatorioCardKpi1"'), 'Card relatorioCardKpi1 deve existir em src/index.html');
assert(html.includes('id="relatorioCardKpi2"'), 'Card relatorioCardKpi2 deve existir em src/index.html');
assert(html.includes('id="relatorioCardKpi3"'), 'Card relatorioCardKpi3 deve existir em src/index.html');
assert(html.includes('id="relatorioCardKpi4"'), 'Card relatorioCardKpi4 deve existir em src/index.html');
assert(html.includes('id="painelSubtotaisRelatorio"'), 'Painel painelSubtotaisRelatorio deve existir em src/index.html');
assert(html.includes('id="tabelaCabecalhoRelatorios"'), 'Cabeçalho tabelaCabecalhoRelatorios deve existir em src/index.html');
assert(html.includes('id="tabelaCorpoRelatoriosNotas"'), 'Corpo da tabela tabelaCorpoRelatoriosNotas deve existir em src/index.html');
assert(html.includes('id="tabelaRodapeAutoSomaRelatorios"'), 'Rodapé de auto-soma tabelaRodapeAutoSomaRelatorios deve existir em src/index.html');
assert(html.includes('id="btnAtalhoRel_TODOS"'), 'Botão de atalho btnAtalhoRel_TODOS deve existir em src/index.html');
assert(html.includes('id="btnAtalhoRel_HOJE"'), 'Botão de atalho btnAtalhoRel_HOJE deve existir em src/index.html');
assert(html.includes('id="btnAtalhoRel_MES_ATUAL"'), 'Botão de atalho btnAtalhoRel_MES_ATUAL deve existir em src/index.html');
assert(html.includes('imprimirRelatorioAtualA4()'), 'Botão de impressão A4 deve invocar imprimirRelatorioAtualA4()');
assert(html.includes('exportarRelatorioAtualCSV()'), 'Botão de exportação deve invocar exportarRelatorioAtualCSV()');

console.log('   ✓ Todas as integrações de UI, controles, cards e tabelas de Auto-Soma da Fase 2 validados!');

// 9. Auditoria das Integrações da Fase 3 (Configurações da Empresa, PIX e Motor de Impressão Profissional A4)
console.log('9. Verificando integrações da Fase 3 (Configurações, PIX e Impressão A4)...');
assert(scriptsCarregados.includes('js/configuracoes.js'), 'src/index.html deve carregar js/configuracoes.js');
assert(scriptsCarregados.includes('js/impressao.js'), 'src/index.html deve carregar js/impressao.js');
assert(html.includes('.a4-print-relatorio'), 'src/index.html deve conter estilo .a4-print-relatorio');
assert(html.includes('id="btnAbrirConfigEmpresa"'), 'Botão btnAbrirConfigEmpresa deve existir no header');
assert(html.includes('id="modalConfiguracoesEmpresa"'), 'Modal modalConfiguracoesEmpresa deve existir em src/index.html');
assert(html.includes('id="configNomeFantasia"'), 'Campo configNomeFantasia deve existir em modalConfiguracoesEmpresa');
assert(html.includes('id="configChavePix"'), 'Campo configChavePix deve existir em modalConfiguracoesEmpresa');
assert(html.includes('id="configDiasAlerta"'), 'Campo configDiasAlerta deve existir em modalConfiguracoesEmpresa');
assert(codigoInline.includes('iniciarListenerConfiguracoesEmpresa()'), 'onAuthStateChanged deve invocar iniciarListenerConfiguracoesEmpresa() no login');
assert(codigoInline.includes('encerrarListenerConfiguracoesEmpresa()'), 'onAuthStateChanged deve invocar encerrarListenerConfiguracoesEmpresa() no logout');
assert(codigoInline.includes('gerarHtmlImpressaoNotaPrazoA4'), 'imprimirNotaPrazoA4 deve integrar com gerarHtmlImpressaoNotaPrazoA4');
assert(codigoInline.includes('gerarHtmlImpressaoReciboPagamentoA4'), 'imprimirReciboPagamentoA4 deve integrar com gerarHtmlImpressaoReciboPagamentoA4');

console.log('   ✓ Todas as integrações de configuração da empresa, modal PIX e motor de impressão da Fase 3 validados!');

// 10. Auditoria das Integrações da Fase 4 (WhatsApp, Backup Schema V3 e Segurança Sincronizada)
console.log('10. Verificando integrações da Fase 4 (WhatsApp, Backup V3 e Segurança)...');
assert(scriptsCarregados.includes('js/whatsapp.js'), 'src/index.html deve carregar js/whatsapp.js');
assert(scriptsCarregados.includes('js/backup-v3.js'), 'src/index.html deve carregar js/backup-v3.js');
assert(scriptsCarregados.includes('js/seguranca.js'), 'src/index.html deve carregar js/seguranca.js');

// Verificação de elementos HTML da Fase 4
assert(html.includes('id="btnZapRelatorioAtual"'), 'Botão btnZapRelatorioAtual deve existir na sub-aba de relatórios');
assert(html.includes('id="btnZapPeloExtrato"'), 'Botão btnZapPeloExtrato deve existir em modalExtratoNotaPrazo');
assert(html.includes('id="btnFichaWhatsAppExtrato"'), 'Botão btnFichaWhatsAppExtrato deve existir em modalFichaCliente');
assert(html.includes('id="btnFichaWhatsAppCobranca"'), 'Botão btnFichaWhatsAppCobranca deve existir em modalFichaCliente');
assert(codigoInline.includes('enviarWhatsAppNota'), 'atualizarTabelaNotasPrazo deve conter botão com enviarWhatsAppNota()');
assert(codigoInline.includes('enviarWhatsAppReciboNota'), 'atualizarConteudoModalExtrato deve conter botão com enviarWhatsAppReciboNota()');

// Verificação de integrações de ciclo de vida e chamadas sincronizadas
assert(codigoInline.includes('iniciarListenerSeguranca()'), 'onAuthStateChanged deve invocar iniciarListenerSeguranca() no login');
assert(codigoInline.includes('encerrarListenerSeguranca()'), 'onAuthStateChanged deve invocar encerrarListenerSeguranca() no logout');
assert(codigoInline.includes('validarSenhaMasterSincronizada'), 'validarSenhaMaster deve integrar com validarSenhaMasterSincronizada()');
assert(codigoInline.includes('alterarSenhaMasterSincronizada'), 'alterarSenhaMaster deve integrar com alterarSenhaMasterSincronizada()');
assert(codigoInline.includes('executarExportacaoBackupV3'), 'gerarBackupDadosJSON deve integrar com executarExportacaoBackupV3()');
assert(codigoInline.includes('executarImportacaoBackupV3'), 'importarDadosJSON deve integrar com executarImportacaoBackupV3()');

console.log('   ✓ Todas as integrações de WhatsApp, Backup V3 e Segurança da Fase 4 validadas!');

// =========================================================================
// 11. VERIFICAÇÃO DE INTEGRIDADE DA FASE 6 (ATALHOS RECIBO, Z-INDEX E RESOLVEDOR)
// =========================================================================
console.log('11. Verificando integrações da Fase 6 (Z-Index modais, botões Ficha e atalhos 🧾 Recibo)...');

// 11.1 Z-Index de modalCadastroCliente vs modalFichaCliente
const matchModalCad = html.match(/id=["']modalCadastroCliente["'][^>]*class=["'][^"']*z-\[(\d+)\]/i);
assert(matchModalCad, 'modalCadastroCliente deve possuir classe z-[...]');
const zIndexCad = parseInt(matchModalCad[1], 10);

const matchModalFicha = html.match(/id=["']modalFichaCliente["'][^>]*class=["'][^"']*z-\[(\d+)\]/i);
assert(matchModalFicha, 'modalFichaCliente deve possuir classe z-[...]');
const zIndexFicha = parseInt(matchModalFicha[1], 10);

assert.strictEqual(zIndexCad, 95, 'modalCadastroCliente deve ter z-[95]');
assert.strictEqual(zIndexFicha, 80, 'modalFichaCliente deve ter z-[80]');
assert(zIndexCad > zIndexFicha, 'modalCadastroCliente (z-95) deve ter z-index superior a modalFichaCliente (z-80)');

// 11.2 Botão Editar Cadastro do Cliente na Ficha
assert(html.includes('id="btnFichaEditarCliente"'), 'Ficha deve possuir botão #btnFichaEditarCliente');
assert(html.includes('Editar Cadastro do Cliente'), 'Botão deve ter o texto claro "Editar Cadastro do Cliente"');
assert(html.includes('id="btnFichaImprimirExtrato"'), 'Ficha deve possuir botão #btnFichaImprimirExtrato');

// 11.3 Botões de atalho de Recibo nas linhas de venda
assert(codigoInline.includes("imprimirReciboOuComprovanteVendaLinha"), 'Tabela principal de notas deve chamar imprimirReciboOuComprovanteVendaLinha');
assert(codigoInline.includes('🧾 Recibo'), 'Tabela principal de notas deve ter o botão visível 🧾 Recibo');
assert(codigoInline.includes('🖨️ Nota'), 'Tabela principal de notas deve ter o botão visível 🖨️ Nota');

console.log('   ✓ Todas as integrações da Fase 6 (Z-Index, botões da Ficha e atalhos 🧾 Recibo) validadas!');

console.log('\n=================================================================');
console.log('INTEGRIDADE DE src/index.html 100% VALIDADA E APROVADA!');
console.log('=================================================================\n');
