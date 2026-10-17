'use strict';

// Contrato: docs/labels.md
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const { validateCatalog, planLabelSync } = require(path.join(ROOT, 'scripts', 'sync-labels.cjs'));

// Catálogo da tabela de docs/labels.md, na mesma ordem.
const CATALOGO = Object.freeze([
  ['bug', 'd73a4a', 'Algo não está funcionando'],
  ['documentation', '0075ca', 'Melhorias ou acréscimos à documentação'],
  ['duplicate', 'cfd3d7', 'Esta issue ou pull request já existe'],
  ['enhancement', 'a2eeef', 'Nova funcionalidade ou pedido'],
  ['good first issue', '7057ff', 'Boa para quem está começando'],
  ['help wanted', '008672', 'Precisa de atenção extra'],
  ['invalid', 'e4e669', 'Isto não parece certo'],
  ['question', 'd876e3', 'Mais informações são necessárias'],
  ['wontfix', 'ffffff', 'Isto não será feito'],
  ['upgrade', '5319e7', 'Alteração incompatível; gera versão major'],
  ['release', '0052cc', 'Gera versão estável em vez de pré-release'],
  ['feature', '0e8a16', 'Nova funcionalidade compatível; gera versão minor'],
  ['improvement', '84b6eb', 'Melhoria compatível; gera versão minor'],
  ['refactor', 'fbca04', 'Refatoração sem mudança funcional'],
  ['tests', 'bfdadc', 'Criação ou alteração de testes'],
  ['deprecated', 'e4e669', 'Recurso obsoleto ou em processo de remoção'],
  ['dependencies', '0366d6', 'Atualização de dependências'],
].map(([name, color, description]) => Object.freeze({ name, color, description })));

const catalogo = () => CATALOGO.map((l) => ({ ...l }));
const item = (over = {}) => ({ name: 'bug', color: 'd73a4a', description: 'Algo', ...over });

function assertValido(c) {
  assert.equal(typeof validateCatalog, 'function');
  assert.equal(validateCatalog(c), undefined);
}

function assertInvalido(c) {
  assert.equal(typeof validateCatalog, 'function');
  assert.throws(() => validateCatalog(c), (e) => {
    assert.ok(e instanceof Error);
    assert.notEqual(String(e.message).trim(), '');
    return true;
  });
}

test.describe('validateCatalog', () => {
  test('o catálogo da documentação é válido', () => assertValido(catalogo()));

  test('um item só é válido', () => assertValido([item()]));

  test('descrição vazia e com exatamente 100 caracteres são válidas', () => {
    assertValido([item({ description: '' })]);
    assertValido([item({ description: 'x'.repeat(100) })]);
    assertValido([item({ description: 'ç'.repeat(100) })]);
  });

  test('nome com espaço no meio é válido', () => assertValido([item({ name: 'good first issue' })]));

  const invalidos = [
    ['objeto com labels', { labels: [item()] }],
    ['objeto com labels e remove', { labels: [item()], remove: [] }],
    ['array vazio', []],
    ['null', null],
    ['undefined', undefined],
    ['string', 'bug'],
    ['item null', [null]],
    ['item string', ['bug']],
    ['item array', [['bug', 'd73a4a', 'x']]],
    ['chave extra', [item({ default: true })]],
    ['sem name', [{ color: 'd73a4a', description: 'x' }]],
    ['sem color', [{ name: 'bug', description: 'x' }]],
    ['sem description', [{ name: 'bug', color: 'd73a4a' }]],
    ['name não string', [item({ name: 1 })]],
    ['color não string', [item({ color: 0xd73a4a })]],
    ['description null', [item({ description: null })]],
    ['description não string', [item({ description: 5 })]],
    ['name vazio', [item({ name: '' })]],
    ['name com espaço à esquerda', [item({ name: ' bug' })]],
    ['name com espaço à direita', [item({ name: 'bug ' })]],
    ['name duplicado', [item(), item()]],
    ['name duplicado na caixa', [item({ name: 'Bug' }), item({ name: 'bug' })]],
    ['color com #', [item({ color: '#d73a4a' })]],
    ['color maiúscula', [item({ color: 'D73A4A' })]],
    ['color com 3 dígitos', [item({ color: 'fff' })]],
    ['color com 7 dígitos', [item({ color: 'd73a4a0' })]],
    ['color não hexadecimal', [item({ color: 'gggggg' })]],
    ['color vazia', [item({ color: '' })]],
    ['description com 101 caracteres', [item({ description: 'x'.repeat(101) })]],
  ];
  for (const [nome, c] of invalidos) {
    test(`inválido: ${nome}`, () => assertInvalido(c));
  }

  test('um item inválido no meio do catálogo invalida tudo', () => {
    const c = catalogo();
    c[8] = { ...c[8], color: 'FFFFFF' };
    assertInvalido(c);
  });
});

function nomesDoPlano(plano) {
  return {
    update: plano.update.map((u) => u.current),
    remove: plano.remove,
    unchanged: plano.unchanged,
  };
}

function assertCadaExistenteUmaVez(plano, existing) {
  const { update, remove, unchanged } = nomesDoPlano(plano);
  const todos = [...update, ...remove, ...unchanged];
  assert.equal(todos.length, existing.length, 'cada label existente aparece exatamente uma vez');
  assert.deepEqual([...todos].sort(), existing.map((l) => l.name).sort());
}

test.describe('planLabelSync', () => {
  test('exemplo da documentação', () => {
    const existing = [
      { name: 'Bug', color: 'd73a4a', description: 'Algo não está funcionando' },
      { name: 'enhancement', color: 'A2EEEF', description: 'Nova funcionalidade ou pedido' },
      { name: 'php', color: '2b67c6', description: 'Pull requests that update php code' },
      { name: 'Major', color: 'b60205', description: null },
      { name: 'IA', color: '000000', description: '' },
    ];
    const plano = planLabelSync(catalogo(), existing);

    assert.deepEqual(Object.keys(plano).sort(), ['create', 'remove', 'unchanged', 'update']);
    assert.deepEqual(plano.update, [
      { current: 'Bug', name: 'bug', color: 'd73a4a', description: 'Algo não está funcionando' },
    ]);
    assert.deepEqual(plano.unchanged, ['enhancement']);
    assert.deepEqual(plano.remove, ['php', 'Major', 'IA']);

    const esperado = CATALOGO.filter((l) => !['bug', 'enhancement'].includes(l.name));
    assert.equal(plano.create.length, 15);
    const porNome = (a, b) => a.name.localeCompare(b.name);
    assert.deepEqual([...plano.create].sort(porNome), esperado.map((l) => ({ ...l })).sort(porNome));
    assertCadaExistenteUmaVez(plano, existing);
  });

  test('repositório vazio: cria o catálogo inteiro', () => {
    const plano = planLabelSync(catalogo(), []);
    assert.equal(plano.create.length, 17);
    assert.deepEqual(
      plano.create.map((l) => l.name).sort(),
      CATALOGO.map((l) => l.name).sort(),
    );
    assert.deepEqual(plano.update, []);
    assert.deepEqual(plano.remove, []);
    assert.deepEqual(plano.unchanged, []);
  });

  test('repositório igual ao catálogo: tudo inalterado', () => {
    const plano = planLabelSync(catalogo(), catalogo());
    assert.deepEqual(plano.create, []);
    assert.deepEqual(plano.update, []);
    assert.deepEqual(plano.remove, []);
    assert.deepEqual([...plano.unchanged].sort(), CATALOGO.map((l) => l.name).sort());
  });

  test('cor comparada sem diferenciar caixa', () => {
    const c = [item()];
    const plano = planLabelSync(c, [{ name: 'bug', color: 'D73A4A', description: 'Algo' }]);
    assert.deepEqual(plano.unchanged, ['bug']);
    assert.deepEqual(plano.update, []);
    assert.deepEqual(plano.create, []);
    assert.deepEqual(plano.remove, []);
  });

  test('cor diferente: update', () => {
    const plano = planLabelSync([item()], [{ name: 'bug', color: 'ee0701', description: 'Algo' }]);
    assert.deepEqual(plano.update, [{ current: 'bug', name: 'bug', color: 'd73a4a', description: 'Algo' }]);
    assert.deepEqual(plano.unchanged, []);
  });

  test('descrição diferente: update', () => {
    const plano = planLabelSync([item()], [{ name: 'bug', color: 'd73a4a', description: "Something isn't working" }]);
    assert.deepEqual(plano.update, [{ current: 'bug', name: 'bug', color: 'd73a4a', description: 'Algo' }]);
  });

  test('descrição null conta como "" ', () => {
    const vazio = planLabelSync([item({ description: '' })], [{ name: 'bug', color: 'd73a4a', description: null }]);
    assert.deepEqual(vazio.unchanged, ['bug']);
    assert.deepEqual(vazio.update, []);

    const cheio = planLabelSync([item()], [{ name: 'bug', color: 'd73a4a', description: null }]);
    assert.deepEqual(cheio.update, [{ current: 'bug', name: 'bug', color: 'd73a4a', description: 'Algo' }]);
  });

  test('só a caixa do nome difere: update com current no nome do repositório', () => {
    const plano = planLabelSync([item()], [{ name: 'BUG', color: 'd73a4a', description: 'Algo' }]);
    assert.deepEqual(plano.update, [{ current: 'BUG', name: 'bug', color: 'd73a4a', description: 'Algo' }]);
    assert.deepEqual(plano.create, []);
    assert.deepEqual(plano.remove, []);
  });

  test('prune total: tudo fora do catálogo é removido com o nome do repositório', () => {
    const existing = [
      { name: 'major', color: 'b60205', description: null },
      { name: 'Minor', color: 'fbca04', description: '' },
      { name: 'patch', color: 'c2e0c6', description: 'x' },
      { name: 'breaking', color: 'b60205', description: 'x' },
      { name: 'github_actions', color: '000000', description: 'x' },
      { name: 'IA', color: '111111', description: 'x' },
    ];
    const plano = planLabelSync([item()], existing);
    assert.deepEqual(plano.remove, ['major', 'Minor', 'patch', 'breaking', 'github_actions', 'IA']);
    assert.deepEqual(plano.create, [item()]);
    assertCadaExistenteUmaVez(plano, existing);
  });

  test('labels da Elavora no catálogo não são removidas', () => {
    const existing = ['feature', 'improvement', 'refactor', 'tests', 'deprecated', 'dependencies', 'upgrade', 'release']
      .map((n) => ({ ...CATALOGO.find((l) => l.name === n) }));
    const plano = planLabelSync(catalogo(), existing);
    assert.deepEqual(plano.remove, []);
    assert.deepEqual([...plano.unchanged].sort(), existing.map((l) => l.name).sort());
    assert.equal(plano.create.length, 9);
  });

  test('cada label existente aparece em exatamente uma lista', () => {
    const existing = [
      { name: 'Bug', color: 'd73a4a', description: 'Algo não está funcionando' },
      { name: 'question', color: 'D876E3', description: 'Mais informações são necessárias' },
      { name: 'wontfix', color: 'ffffff', description: null },
      { name: 'php', color: '2b67c6', description: null },
      { name: 'Help Wanted', color: '008672', description: 'Precisa de atenção extra' },
    ];
    const plano = planLabelSync(catalogo(), existing);
    assertCadaExistenteUmaVez(plano, existing);
    assert.deepEqual(plano.update.map((u) => u.current).sort(), ['Bug', 'Help Wanted', 'wontfix']);
    assert.deepEqual(plano.unchanged, ['question']);
    assert.deepEqual(plano.remove, ['php']);
    for (const c of plano.create) {
      assert.ok(!['bug', 'question', 'wontfix', 'help wanted'].includes(c.name));
    }
  });

  for (const [nome, c] of [
    ['objeto', { labels: [item()] }],
    ['array vazio', []],
    ['color inválida', [item({ color: '#d73a4a' })]],
  ]) {
    test(`catálogo inválido (${nome}): lança antes de montar o plano`, () => {
      assert.equal(typeof planLabelSync, 'function');
      const existing = [{ name: 'IA', color: '000000', description: '' }];
      assert.throws(() => planLabelSync(c, existing), Error);
    });
  }
});

test.describe('.github/labels.json', () => {
  const arquivo = path.join(ROOT, '.github', 'labels.json');

  test('existe, é JSON e satisfaz validateCatalog', () => {
    const real = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
    assertValido(real);
  });

  test('tem as 17 labels da documentação, na ordem da tabela', () => {
    const real = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
    assert.ok(Array.isArray(real));
    assert.equal(real.length, 17);
    assert.deepEqual(real, catalogo());
  });

  test('não contém as labels obsoletas', () => {
    const real = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
    const nomes = real.map((l) => l.name.toLowerCase());
    for (const n of ['major', 'minor', 'patch', 'breaking']) assert.ok(!nomes.includes(n), n);
  });
});
