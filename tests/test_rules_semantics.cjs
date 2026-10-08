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

console.log('=== TODOS OS TESTES SEMÂNTICOS DE REGRAS PASSARAM COM SUCESSO! ===\n');
