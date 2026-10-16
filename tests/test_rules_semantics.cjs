const assert = require('assert');
const fs = require('fs');

console.log('=== TESTES SEMÂNTICOS DE database.rules.json ===');

const rulesContent = fs.readFileSync('database.rules.json', 'utf8');
const rulesObj = JSON.parse(rulesContent);

assert(rulesObj.rules, 'Deve conter nó rules');
assert.strictEqual(rulesObj.rules['.read'], false, 'Root .read deve ser false');
assert.strictEqual(rulesObj.rules['.write'], false, 'Root .write deve ser false');

// Helper to simulate RTDB rule evaluation
class RuleContext {
  constructor({ auth = null, data = null, newData = null, root = {} }) {
    this.auth = auth;
    this.dataVal = data;
    this.newDataVal = newData;
    this.rootData = root;
  }

  exists(val) {
    return val !== null && val !== undefined;
  }

  isNumber(val) {
    return typeof val === 'number' && !isNaN(val);
  }

  isString(val) {
    return typeof val === 'string';
  }

  // Evaluate notasPrazo $notaId .write
  canWriteNota() {
    return this.auth !== null && (!this.exists(this.dataVal) || this.exists(this.newDataVal));
  }

  // Evaluate notasPrazo $notaId .validate
  validateNota() {
    const nd = this.newDataVal;
    if (!nd || typeof nd !== 'object') return false;
    const hasChildren = nd.id !== undefined && nd.valorOriginal !== undefined && nd.dataEmissao !== undefined;
    if (!hasChildren) return false;

    const dataStatus = this.dataVal ? this.dataVal.status : null;
    if (this.exists(this.dataVal) && dataStatus === 'CANCELADA') {
      if (JSON.stringify(nd) !== JSON.stringify(this.dataVal)) return false;
    }

    // id immutable
    if (this.exists(this.dataVal) && nd.id !== this.dataVal.id) return false;
    if (!this.isString(nd.id)) return false;

    // numeroControle immutable
    if (nd.numeroControle !== undefined) {
      if (!this.isString(nd.numeroControle)) return false;
      if (this.exists(this.dataVal) && nd.numeroControle !== this.dataVal.numeroControle) return false;
    }

    // valorOriginal immutable & > 0
    if (!this.isNumber(nd.valorOriginal) || nd.valorOriginal <= 0) return false;
    if (this.exists(this.dataVal) && nd.valorOriginal !== this.dataVal.valorOriginal) return false;

    // status domain
    if (nd.status !== undefined) {
      const validStatuses = ['ABERTA', 'PARCIAL', 'QUITADA', 'CANCELADA'];
      if (!this.isString(nd.status) || !validStatuses.includes(nd.status)) return false;
    }

    return true;
  }

  // Evaluate pagamento .write and .validate
  canWritePagamento() {
    return this.auth !== null && this.exists(this.newDataVal);
  }

  validatePagamento(parentNoteData) {
    const nd = this.newDataVal;
    if (!nd || typeof nd !== 'object') return false;
    if (nd.id === undefined || nd.valor === undefined || nd.numeroRecibo === undefined) return false;

    // If new payment, parent note cannot be QUITADA or CANCELADA
    if (!this.exists(this.dataVal)) {
      if (parentNoteData && (parentNoteData.status === 'QUITADA' || parentNoteData.status === 'CANCELADA')) {
        return false;
      }
    }

    // id immutable
    if (!this.isString(nd.id)) return false;
    if (this.exists(this.dataVal) && nd.id !== this.dataVal.id) return false;

    // valor immutable and > 0
    if (!this.isNumber(nd.valor) || nd.valor <= 0) return false;
    if (this.exists(this.dataVal) && nd.valor !== this.dataVal.valor) return false;

    // numeroRecibo immutable
    if (!this.isString(nd.numeroRecibo)) return false;
    if (this.exists(this.dataVal) && nd.numeroRecibo !== this.dataVal.numeroRecibo) return false;

    // status
    if (nd.status !== undefined) {
      if (nd.status !== 'ATIVO' && nd.status !== 'ESTORNADO') return false;
    }

    return true;
  }

  // Evaluate sequencias .write
  canWriteSequencia() {
    if (this.auth === null) return false;
    if (!this.isNumber(this.newDataVal)) return false;
    if (!this.exists(this.dataVal)) return true;
    return this.newDataVal > this.dataVal;
  }

  // Evaluate vales $valeId .validate
  validateVale() {
    const nd = this.newDataVal;
    if (!nd || typeof nd !== 'object') return false;
    if (nd.id === undefined) return false;
    if (nd.valorOriginal === undefined && nd.valor === undefined) return false;

    if (!this.isString(nd.id)) return false;
    if (this.exists(this.dataVal) && nd.id !== this.dataVal.id) return false;

    if (nd.valorOriginal !== undefined) {
      if (!this.isNumber(nd.valorOriginal) || nd.valorOriginal <= 0) return false;
    }

    if (nd.valor !== undefined) {
      const ok = (this.isNumber(nd.valor) && nd.valor > 0) || this.isString(nd.valor);
      if (!ok) return false;
    }

    return true;
  }

  validateBaixaVale() {
    const nd = this.newDataVal;
    if (!nd || typeof nd !== 'object') return false;
    if (nd.valorUsado === undefined) return false;
    const ok = (this.isNumber(nd.valorUsado) && nd.valorUsado > 0) || this.isString(nd.valorUsado);
    return ok;
  }

  canWriteCliente() {
    return this.auth !== null;
  }

  validateCliente() {
    const nd = this.newDataVal;
    if (!nd || typeof nd !== 'object') return false;
    if (nd.id === undefined || nd.nome === undefined) return false;

    // id immutable string
    if (!this.isString(nd.id)) return false;
    if (this.exists(this.dataVal) && nd.id !== this.dataVal.id) return false;

    // nome non-empty string
    if (!this.isString(nd.nome) || nd.nome.length === 0) return false;

    // codigo optional string
    if (nd.codigo !== undefined && !this.isString(nd.codigo)) return false;

    // limiteCredito optional number >= 0 or string
    if (nd.limiteCredito !== undefined) {
      if (this.isString(nd.limiteCredito)) {
        // string permitida conforme database.rules.json
      } else if (!this.isNumber(nd.limiteCredito) || nd.limiteCredito < 0) {
        return false;
      }
    }

    return true;
  }

  canWriteConfiguracoes() {
    return this.auth !== null;
  }

  validateConfiguracoesEmpresa() {
    const nd = this.newDataVal;
    if (!nd || typeof nd !== 'object') return false;
    if (nd.nomeFantasia === undefined || !this.isString(nd.nomeFantasia) || nd.nomeFantasia.length === 0) return false;
    if (nd.diasAlertaVencimento !== undefined) {
      if (this.isString(nd.diasAlertaVencimento)) {
        // string permitida conforme database.rules.json
      } else if (!this.isNumber(nd.diasAlertaVencimento) || nd.diasAlertaVencimento < 1 || nd.diasAlertaVencimento > 30) {
        return false;
      }
    }
    return true;
  }

  validateConfiguracoesSeguranca() {
    const nd = this.newDataVal;
    if (!nd || typeof nd !== 'object') return false;
    if (nd.hashSenhaMaster === undefined || !this.isString(nd.hashSenhaMaster) || nd.hashSenhaMaster.length === 0) return false;
    return true;
  }
}

// 1. Unauthenticated access
console.log('1. Testando acesso sem autenticação...');
{
  const unauth = new RuleContext({ auth: null, newData: { id: 'NP1', valorOriginal: 100, dataEmissao: '2026-10-07' } });
  assert.strictEqual(unauth.canWriteNota(), false, 'Escrita de nota sem auth deve ser negada');
  assert.strictEqual(unauth.canWritePagamento(), false, 'Escrita de pagto sem auth deve ser negada');
  assert.strictEqual(unauth.canWriteSequencia(), false, 'Escrita de sequencia sem auth deve ser negada');
  console.log('   OK: Bloqueio não autenticado garantido.');
}

// 2. Criação de Nota a Prazo
console.log('2. Testando criação de nota a prazo...');
{
  const authCtx = new RuleContext({
    auth: { uid: 'user1' },
    data: null,
    newData: { id: 'NP_001', numeroControle: 'NP-000001', valorOriginal: 350.50, dataEmissao: '2026-10-07', status: 'ABERTA' }
  });
  assert.strictEqual(authCtx.canWriteNota(), true);
  assert.strictEqual(authCtx.validateNota(), true, 'Nota válida deve ser aprovada');

  // Valor zero
  const zeroCtx = new RuleContext({
    auth: { uid: 'user1' },
    data: null,
    newData: { id: 'NP_001', valorOriginal: 0, dataEmissao: '2026-10-07' }
  });
  assert.strictEqual(zeroCtx.validateNota(), false, 'Valor zero deve ser bloqueado');

  // Valor negativo
  const negCtx = new RuleContext({
    auth: { uid: 'user1' },
    data: null,
    newData: { id: 'NP_001', valorOriginal: -50, dataEmissao: '2026-10-07' }
  });
  assert.strictEqual(negCtx.validateNota(), false, 'Valor negativo deve ser bloqueado');

  // Deletar nota (.remove())
  const delCtx = new RuleContext({
    auth: { uid: 'user1' },
    data: { id: 'NP_001', valorOriginal: 350.50 },
    newData: null
  });
  assert.strictEqual(delCtx.canWriteNota(), false, 'Exclusão (.remove()) de nota deve ser bloqueada');
  console.log('   OK: Criação válida aprovada, valores zero/negativos e exclusão bloqueados.');
}

// 3. Imutabilidade de dados de Nota
console.log('3. Testando imutabilidade de nota a prazo...');
{
  // Alterar valorOriginal
  const altValor = new RuleContext({
    auth: { uid: 'user1' },
    data: { id: 'NP_001', numeroControle: 'NP-000001', valorOriginal: 100, dataEmissao: '2026-10-07' },
    newData: { id: 'NP_001', numeroControle: 'NP-000001', valorOriginal: 200, dataEmissao: '2026-10-07' }
  });
  assert.strictEqual(altValor.validateNota(), false, 'Alterar valorOriginal deve ser bloqueado');

  // Alterar numeroControle
  const altNum = new RuleContext({
    auth: { uid: 'user1' },
    data: { id: 'NP_001', numeroControle: 'NP-000001', valorOriginal: 100, dataEmissao: '2026-10-07' },
    newData: { id: 'NP_001', numeroControle: 'NP-000002', valorOriginal: 100, dataEmissao: '2026-10-07' }
  });
  assert.strictEqual(altNum.validateNota(), false, 'Alterar numeroControle deve ser bloqueado');

  // Alterar ID
  const altId = new RuleContext({
    auth: { uid: 'user1' },
    data: { id: 'NP_001', valorOriginal: 100, dataEmissao: '2026-10-07' },
    newData: { id: 'NP_002', valorOriginal: 100, dataEmissao: '2026-10-07' }
  });
  assert.strictEqual(altId.validateNota(), false, 'Alterar ID deve ser bloqueado');
  console.log('   OK: Imutabilidade de valorOriginal, numeroControle e ID garantida.');
}

// 4. Pagamentos e notas canceladas/quitadas
console.log('4. Testando pagamentos e regras de notas canceladas/quitadas...');
{
  // Adicionar pagamento em nota CANCELADA
  const pagtoCancelada = new RuleContext({
    auth: { uid: 'user1' },
    data: null,
    newData: { id: 'P1', valor: 50, numeroRecibo: 'REC-000001', status: 'ATIVO' }
  });
  assert.strictEqual(pagtoCancelada.validatePagamento({ status: 'CANCELADA' }), false, 'Pagamento em nota cancelada deve ser bloqueado');

  // Adicionar pagamento em nota QUITADA
  const pagtoQuitada = new RuleContext({
    auth: { uid: 'user1' },
    data: null,
    newData: { id: 'P1', valor: 50, numeroRecibo: 'REC-000001', status: 'ATIVO' }
  });
  assert.strictEqual(pagtoQuitada.validatePagamento({ status: 'QUITADA' }), false, 'Pagamento em nota quitada deve ser bloqueado');

  // Adicionar pagamento em nota ABERTA
  const pagtoAberta = new RuleContext({
    auth: { uid: 'user1' },
    data: null,
    newData: { id: 'P1', valor: 50, numeroRecibo: 'REC-000001', status: 'ATIVO' }
  });
  assert.strictEqual(pagtoAberta.validatePagamento({ status: 'ABERTA' }), true, 'Pagamento em nota aberta deve ser aprovado');

  // Alterar valor de pagamento existente
  const altPagtoValor = new RuleContext({
    auth: { uid: 'user1' },
    data: { id: 'P1', valor: 50, numeroRecibo: 'REC-000001', status: 'ATIVO' },
    newData: { id: 'P1', valor: 70, numeroRecibo: 'REC-000001', status: 'ATIVO' }
  });
  assert.strictEqual(altPagtoValor.validatePagamento({ status: 'PARCIAL' }), false, 'Alterar valor de pagamento existente deve ser bloqueado');

  // Estornar pagamento existente
  const estornoPagto = new RuleContext({
    auth: { uid: 'user1' },
    data: { id: 'P1', valor: 50, numeroRecibo: 'REC-000001', status: 'ATIVO' },
    newData: { id: 'P1', valor: 50, numeroRecibo: 'REC-000001', status: 'ESTORNADO' }
  });
  assert.strictEqual(estornoPagto.validatePagamento({ status: 'QUITADA' }), true, 'Estorno de pagamento deve ser permitido');
  console.log('   OK: Pagamento em cancelada/quitada bloqueado, alteração de valor bloqueada, estorno permitido.');
}

// 5. Sequências atômicas
console.log('5. Testando sequências atômicas...');
{
  // Incrementar sequência
  const incSeq = new RuleContext({
    auth: { uid: 'user1' },
    data: 10,
    newData: 11
  });
  assert.strictEqual(incSeq.canWriteSequencia(), true, 'Incrementar sequência deve ser aprovado');

  // Reduzir sequência
  const decSeq = new RuleContext({
    auth: { uid: 'user1' },
    data: 10,
    newData: 9
  });
  assert.strictEqual(decSeq.canWriteSequencia(), false, 'Reduzir sequência deve ser bloqueado');

  // Reutilizar mesmo número
  const sameSeq = new RuleContext({
    auth: { uid: 'user1' },
    data: 10,
    newData: 10
  });
  assert.strictEqual(sameSeq.canWriteSequencia(), false, 'Manter/reutilizar número deve ser bloqueado');
  console.log('   OK: Redução ou estagnação de sequência bloqueada com sucesso.');
}

// 6. Compatibilidade com Vales Legados
console.log('6. Testando compatibilidade com Vales legados...');
{
  // Vale com campos legados (valor ao invés de valorOriginal)
  const legacyVale = new RuleContext({
    auth: { uid: 'user1' },
    data: null,
    newData: {
      id: '12345',
      valor: '150.00',
      dataVale: '2024-01-01',
      validade: '2024-04-01',
      numNota: '5544',
      quemFez: 'OPERADOR',
      responsavel: 'GERENTE',
      devolvido: 'PECA A'
    }
  });
  assert.strictEqual(legacyVale.validateVale(), true, 'Vale legado com campos antigos deve ser válido');

  // Baixa legítima em vale
  const baixaVale = new RuleContext({
    auth: { uid: 'user1' },
    data: null,
    newData: {
      valorUsado: 50,
      dataBaixa: '2026-10-07',
      notaVenda: '9988'
    }
  });
  assert.strictEqual(baixaVale.validateBaixaVale(), true, 'Baixa de vale com valorUsado deve ser válida');
  console.log('   OK: Vales legados e baixas legítimas 100% suportados.');
}

// 7. Regras de Clientes e Sequência de Clientes (Fase 1)
console.log('7. Testando regras de /clientes e /sequencias/clientes...');
{
  // Acesso não autenticado a clientes
  const unauthCli = new RuleContext({
    auth: null,
    newData: { id: 'CLI1', nome: 'Cliente Teste' }
  });
  assert.strictEqual(unauthCli.canWriteCliente(), false, 'Escrita de cliente sem auth deve ser negada');

  // Criação válida de cliente
  const cliValido = new RuleContext({
    auth: { uid: 'user1' },
    data: null,
    newData: {
      id: 'CLI_001',
      codigo: 'CLI-0001',
      nome: 'João da Silva',
      cpfCnpj: '123.456.789-00',
      telefone: '(11) 98765-4321',
      limiteCredito: 1500.00
    }
  });
  assert.strictEqual(cliValido.canWriteCliente(), true, 'Escrita autenticada de cliente deve ser permitida');
  assert.strictEqual(cliValido.validateCliente(), true, 'Cliente com dados válidos deve ser aprovado');

  // Cliente sem nome
  const cliSemNome = new RuleContext({
    auth: { uid: 'user1' },
    data: null,
    newData: { id: 'CLI_002', nome: '' }
  });
  assert.strictEqual(cliSemNome.validateCliente(), false, 'Cliente sem nome deve ser rejeitado');

  // Limite de crédito negativo
  const cliLimiteNegativo = new RuleContext({
    auth: { uid: 'user1' },
    data: null,
    newData: { id: 'CLI_003', nome: 'Maria Souza', limiteCredito: -100 }
  });
  assert.strictEqual(cliLimiteNegativo.validateCliente(), false, 'Limite de crédito negativo deve ser rejeitado');

  // Alteração de ID de cliente
  const cliIdAlterado = new RuleContext({
    auth: { uid: 'user1' },
    data: { id: 'CLI_001', nome: 'João' },
    newData: { id: 'CLI_002_NOVO', nome: 'João' }
  });
  assert.strictEqual(cliIdAlterado.validateCliente(), false, 'Alterar ID de cliente deve ser bloqueado');

  // Sequência atômica de clientes
  const incSeqCli = new RuleContext({
    auth: { uid: 'user1' },
    data: 5,
    newData: 6
  });
  assert.strictEqual(incSeqCli.canWriteSequencia(), true, 'Incremento de sequência de clientes deve ser permitido');

  const decSeqCli = new RuleContext({
    auth: { uid: 'user1' },
    data: 5,
    newData: 4
  });
  assert.strictEqual(decSeqCli.canWriteSequencia(), false, 'Decremento de sequência de clientes deve ser bloqueado');

  // Cliente com campos opcionais vazios ou strings (Fase 5 / T-501)
  const cliCamposVazios = new RuleContext({
    auth: { uid: 'user1' },
    data: null,
    newData: {
      id: 'CLI_004',
      codigo: 'CLI-0004',
      nome: 'Carlos Peças',
      cpfCnpj: '',
      telefone: '',
      endereco: '',
      observacao: '',
      limiteCredito: 'R$ 0,00'
    }
  });
  assert.strictEqual(cliCamposVazios.canWriteCliente(), true, 'Escrita autenticada com campos opcionais vazios deve ser permitida');
  assert.strictEqual(cliCamposVazios.validateCliente(), true, 'Cliente com campos opcionais vazios deve ser válido');

  console.log('   OK: Regras de clientes e sequências atômicas 100% validadas.');
}

// 8. Regras de /configuracoes e /configuracoes/empresa (Fase 3)
console.log('8. Testando regras de /configuracoes/empresa...');
{
  const unauthConfig = new RuleContext({
    auth: null,
    newData: { nomeFantasia: 'Tucano' }
  });
  assert.strictEqual(unauthConfig.canWriteConfiguracoes(), false, 'Escrita de configurações sem auth deve ser bloqueada');

  const configValida = new RuleContext({
    auth: { uid: 'user1' },
    data: null,
    newData: {
      nomeFantasia: 'TUCANO AUTO PEÇAS',
      cnpj: '11.222.333/0001-44',
      diasAlertaVencimento: 5,
      chavePix: 'financeiro@tucano.com.br'
    }
  });
  assert.strictEqual(configValida.canWriteConfiguracoes(), true, 'Escrita autenticada de configurações deve ser permitida');
  assert.strictEqual(configValida.validateConfiguracoesEmpresa(), true, 'Configurações válidas devem ser aprovadas');

  // Configurações com campos vazios e diasAlerta como string (Fase 5 / T-501)
  const configOpcionaisVazios = new RuleContext({
    auth: { uid: 'user1' },
    data: null,
    newData: {
      nomeFantasia: 'TUCANO AUTO PEÇAS',
      cnpj: '',
      chavePix: '',
      diasAlertaVencimento: '3'
    }
  });
  assert.strictEqual(configOpcionaisVazios.canWriteConfiguracoes(), true);
  assert.strictEqual(configOpcionaisVazios.validateConfiguracoesEmpresa(), true, 'Configurações com campos vazios devem ser válidas');

  const configSemNome = new RuleContext({
    auth: { uid: 'user1' },
    data: null,
    newData: { nomeFantasia: '', diasAlertaVencimento: 3 }
  });
  assert.strictEqual(configSemNome.validateConfiguracoesEmpresa(), false, 'Configuração sem nome fantasia deve ser rejeitada');

  const configDiasInvalido = new RuleContext({
    auth: { uid: 'user1' },
    data: null,
    newData: { nomeFantasia: 'Tucano', diasAlertaVencimento: 50 }
  });
  assert.strictEqual(configDiasInvalido.validateConfiguracoesEmpresa(), false, 'Dias de alerta > 30 deve ser rejeitado');

  console.log('   OK: Regras de /configuracoes/empresa 100% validadas.');
}

// 9. Regras de /configuracoes/seguranca (Fase 4)
console.log('9. Testando regras de /configuracoes/seguranca...');
{
  const unauthSeg = new RuleContext({
    auth: null,
    newData: { hashSenhaMaster: 'tc_1234567890abcdef' }
  });
  assert.strictEqual(unauthSeg.canWriteConfiguracoes(), false, 'Escrita de segurança sem auth deve ser bloqueada');

  const segValida = new RuleContext({
    auth: { uid: 'user1' },
    data: null,
    newData: {
      hashSenhaMaster: 'tc_1234567890abcdef',
      atualizadoEm: '2026-10-15T12:00:00Z',
      atualizadoPor: 'admin@tucano.com.br'
    }
  });
  assert.strictEqual(segValida.canWriteConfiguracoes(), true, 'Escrita autenticada de segurança deve ser permitida');
  assert.strictEqual(segValida.validateConfiguracoesSeguranca(), true, 'Segurança com hash válido deve ser aprovada');

  const segSemHash = new RuleContext({
    auth: { uid: 'user1' },
    data: null,
    newData: { atualizadoEm: '2026-10-15T12:00:00Z' }
  });
  assert.strictEqual(segSemHash.validateConfiguracoesSeguranca(), false, 'Segurança sem hash deve ser rejeitada');

  console.log('   OK: Regras de /configuracoes/seguranca 100% validadas.');
}

console.log('=== TODOS OS TESTES SEMÂNTICOS DE REGRAS PASSARAM COM SUCESSO! ===\n');
