'use strict';

// Contrato: docs/notas-de-release.md (todas as seções) e docs/release.md (passo 6 do job release e entradas).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'release-notes.cjs');

let mod = null;
let loadError = null;
try {
  mod = require(SCRIPT);
} catch (err) {
  loadError = err;
}

function exported(name) {
  assert.ok(mod, `scripts/release-notes.cjs não carregou: ${loadError && loadError.message}`);
  assert.ok(name in mod, `scripts/release-notes.cjs precisa exportar ${name}`);
  return mod[name];
}

function fn(name) {
  const f = exported(name);
  assert.equal(typeof f, 'function', `${name} precisa ser uma função exportada`);
  return f;
}

// Pega a função fora do closure: uma falha de exportação não pode passar como o TypeError esperado.
function throwsType(name, ...args) {
  const f = fn(name);
  assert.throws(() => f(...args), (err) => {
    if (err instanceof assert.AssertionError) throw err;
    return err instanceof TypeError;
  }, `${name}(${args.map((a) => JSON.stringify(a)).join(', ')}) deveria lançar TypeError`);
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

const REPO = 'Elavora/.github';
const prUrl = (n) => `https://github.com/${REPO}/pull/${n}`;
const userLink = (login) => `[${login}](https://github.com/${login})`;

function pr(over = {}) {
  const number = over.number ?? 1;
  return { number, title: 'feat: algo', url: prUrl(number), labels: [], author: 'ScriptPlayerAgent', body: null, ...over };
}

function render(args) {
  return fn('renderReleaseNotes')({ repository: REPO, previousTag: null, previousStable: null, pulls: [], ...args });
}

// Texto do único item do corpo (a linha que começa com "- " em "O que há de novo").
function itemLines(body) {
  const start = body.indexOf('## O que há de novo');
  const end = body.indexOf('## Contribuidores');
  return body.slice(start, end === -1 ? undefined : end).split('\n').filter((l) => l.startsWith('- '));
}

function desdeLine(body) {
  const lines = body.split('\n');
  const i = lines.indexOf('## O que há de novo');
  assert.ok(i !== -1, 'título "## O que há de novo" ausente');
  assert.equal(lines[i + 1], '', 'linha em branco depois de "## O que há de novo"');
  assert.equal(lines[i + 3], '', 'linha em branco depois da linha "desde"');
  return lines[i + 2];
}

// ---------------------------------------------------------------------------
// Exemplos de "Como fica uma release"
// ---------------------------------------------------------------------------

const STABLE_EXAMPLE_BODY = `Versão estável **1.2.0**, com salto minor (novidades compatíveis).

Reúne as betas \`1.1.1-beta.1\` e \`1.2.0-beta.1\`. Cada item mostra a beta em que entrou; os itens sem beta são novos nesta versão.

## O que há de novo

Mudanças desde a versão estável \`1.1.0\`.

### Novidades

- Release com resumo, grupos por label e link de comparação. ([#41](https://github.com/Elavora/.github/pull/41)) por [ScriptPlayerAgent](https://github.com/ScriptPlayerAgent) · entrou na \`1.2.0-beta.1\`

### Correções

- Aceita tag legada como estável anterior ([#42](https://github.com/Elavora/.github/pull/42)) por [Felipe-Cavalca](https://github.com/Felipe-Cavalca)

### Outras mudanças

- Corrige exemplo do chamador ([#40](https://github.com/Elavora/.github/pull/40)) por [ScriptPlayerAgent](https://github.com/ScriptPlayerAgent) · entrou na \`1.1.1-beta.1\`
- Bump actions/checkout from 7.0.1 to 7.0.2 ([#43](https://github.com/Elavora/.github/pull/43)) por [dependabot](https://github.com/apps/dependabot)

## Contribuidores

- [dependabot](https://github.com/apps/dependabot)
- [Felipe-Cavalca](https://github.com/Felipe-Cavalca)
- [ScriptPlayerAgent](https://github.com/ScriptPlayerAgent)

**Comparação completa:** [\`1.1.0...1.2.0\`](https://github.com/Elavora/.github/compare/1.1.0...1.2.0)
`;

const BETA_EXAMPLE_BODY = `Pré-release **1.2.0-beta.1** da \`1.2.0\`, com salto minor (novidades compatíveis) em relação à última estável.

## O que há de novo

Mudanças desde \`1.1.1-beta.1\`. Última versão estável: \`1.1.0\`.

### Novidades

- Release com resumo, grupos por label e link de comparação. ([#41](https://github.com/Elavora/.github/pull/41)) por [ScriptPlayerAgent](https://github.com/ScriptPlayerAgent)

## Contribuidores

- [ScriptPlayerAgent](https://github.com/ScriptPlayerAgent)

**Comparação completa:** [\`1.1.1-beta.1...1.2.0-beta.1\`](https://github.com/Elavora/.github/compare/1.1.1-beta.1...1.2.0-beta.1)
`;

function stableExampleArgs() {
  return {
    repository: 'Elavora/.github',
    tag: '1.2.0',
    previousTag: '1.2.0-beta.1',
    previousStable: '1.1.0',
    betas: ['1.2.0-beta.1', '1.1.1-beta.1'],
    pulls: [
      { number: 43, title: 'build(deps): bump actions/checkout from 7.0.1 to 7.0.2', url: 'https://github.com/Elavora/.github/pull/43', labels: ['dependencies', 'release'], author: 'dependabot[bot]', body: null, introducedIn: null },
      { number: 41, title: 'feat: gera as notas de release em pt-BR', url: 'https://github.com/Elavora/.github/pull/41', labels: ['enhancement'], author: 'ScriptPlayerAgent', body: '## Notas de release\n\nRelease com resumo, grupos por label e link de comparação.', introducedIn: '1.2.0-beta.1' },
      { number: 40, title: 'docs: corrige exemplo do chamador', url: 'https://github.com/Elavora/.github/pull/40', labels: ['documentation'], author: 'ScriptPlayerAgent', body: '', introducedIn: '1.1.1-beta.1' },
      { number: 42, title: 'fix: aceita tag legada como estável anterior', url: 'https://github.com/Elavora/.github/pull/42', labels: ['bug'], author: 'Felipe-Cavalca', introducedIn: null },
    ],
  };
}

test.describe('exemplos da seção "Como fica uma release"', () => {
  test('estável 1.2.0: corpo exato', () => {
    assert.equal(fn('renderReleaseNotes')(stableExampleArgs()), STABLE_EXAMPLE_BODY);
  });

  test('estável 1.2.0: título', () => {
    assert.equal(fn('releaseTitle')({ repository: 'Elavora/.github', tag: '1.2.0' }), 'Elavora/.github 1.2.0');
  });

  test('beta 1.2.0-beta.1: corpo exato (introducedIn ignorado na beta)', () => {
    const body = fn('renderReleaseNotes')({
      repository: 'Elavora/.github',
      tag: '1.2.0-beta.1',
      previousTag: '1.1.1-beta.1',
      previousStable: '1.1.0',
      betas: [],
      pulls: [
        { number: 41, title: 'feat: gera as notas de release em pt-BR', url: 'https://github.com/Elavora/.github/pull/41', labels: ['enhancement'], author: 'ScriptPlayerAgent', body: '## Notas de release\n\nRelease com resumo, grupos por label e link de comparação.', introducedIn: '1.2.0-beta.1' },
      ],
    });
    assert.equal(body, BETA_EXAMPLE_BODY);
  });

  test('o corpo gerado de PRs sem @ não contém nenhum @', () => {
    assert.ok(!fn('renderReleaseNotes')(stableExampleArgs()).includes('@'));
  });

  test('não altera os objetos recebidos', () => {
    const args = stableExampleArgs();
    const copy = JSON.parse(JSON.stringify(args));
    deepFreeze(args);
    assert.equal(fn('renderReleaseNotes')(args), STABLE_EXAMPLE_BODY);
    assert.deepEqual(args, copy);
  });
});

// ---------------------------------------------------------------------------
// Constantes exportadas
// ---------------------------------------------------------------------------

test.describe('constantes exportadas', () => {
  test("RELEASE_NOTES_HEADING é '## Notas de release'", () => {
    assert.equal(exported('RELEASE_NOTES_HEADING'), '## Notas de release');
  });

  test('MAX_BODY_LENGTH é 125000', () => {
    assert.equal(exported('MAX_BODY_LENGTH'), 125000);
  });

  test('GROUPS é a tabela de grupos, na ordem, com labels em minúsculas', () => {
    assert.deepEqual(JSON.parse(JSON.stringify(exported('GROUPS'))), [
      { title: 'Quebra de compatibilidade', labels: ['upgrade'] },
      { title: 'Novidades', labels: ['feature', 'enhancement'] },
      { title: 'Melhorias', labels: ['improvement'] },
      { title: 'Correções', labels: ['bug'] },
      { title: 'Outras mudanças', labels: [] },
    ]);
  });
});

// ---------------------------------------------------------------------------
// releaseTitle
// ---------------------------------------------------------------------------

test.describe('releaseTitle', () => {
  test('formato <owner>/<repo> <tag> (tabela "Título da release")', () => {
    const f = fn('releaseTitle');
    assert.equal(f({ repository: 'Elavora/.github', tag: '1.2.0' }), 'Elavora/.github 1.2.0');
    assert.equal(f({ repository: 'Elavora/devcontainers', tag: '0.4.0-beta.1' }), 'Elavora/devcontainers 0.4.0-beta.1');
    assert.equal(f({ repository: 'Elavora/api-framework', tag: '2.0.0' }), 'Elavora/api-framework 2.0.0');
    assert.equal(f({ repository: 'Elavora/devcontainers', tag: '0.4.0' }), 'Elavora/devcontainers 0.4.0');
  });

  test('aceita ponto, sublinhado e hífen no nome do repositório', () => {
    assert.equal(fn('releaseTitle')({ repository: 'Org-1/a_b.c-d', tag: '1.0.0' }), 'Org-1/a_b.c-d 1.0.0');
  });

  for (const repository of ['Elavora', 'Elavora/x/y', '', undefined, null, 42, 'Ela vora/x', '/x', 'Elavora/', 'Ela.vora/x']) {
    test(`repository inválido ${JSON.stringify(repository)} lança TypeError`, () => {
      throwsType('releaseTitle', { repository, tag: '1.2.0' });
    });
  }

  for (const tag of ['v1.2.0', '1.2', undefined, null, '', 'x', 'v1.2.0-beta.1', 7]) {
    test(`tag inválida ou legada ${JSON.stringify(tag)} lança TypeError`, () => {
      throwsType('releaseTitle', { repository: 'Elavora/.github', tag });
    });
  }
});

// ---------------------------------------------------------------------------
// extractReleaseNotes
// ---------------------------------------------------------------------------

test.describe('extractReleaseNotes', () => {
  const table = [
    [null, null],
    ['## Objetivo\nX', null],
    ['## Notas de release\n<!-- opcional -->\n', null],
    ['## Notas de release\n\nAdiciona o cache.\n', 'Adiciona o cache.'],
    ['## Notas de release\r\nAdiciona o cache.\r\n## Riscos\r\nNenhum', 'Adiciona o cache.'],
    ['## NOTAS DE RELEASE\nA\n\n  - B\n### Detalhe\nC\n# Fim', 'A\n  - B\n### Detalhe\nC'],
    ['<!-- ## Notas de release -->\n## Notas de release\nA', 'A'],
    ['### Notas de release\nA', null],
    // Linha de atribuição (regra 4).
    ['## Notas de release\nA\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)', 'A'],
    ['## Notas de release\r\nA\r\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\r\n', 'A'],
    ['## Notas de release\nA\n  🤖 Generated with X\nB', 'A'],
    ['## Notas de release\n🤖 Generated with [Claude Code](https://claude.com/claude-code)', null],
    ['## Notas de release\nA 🤖 Generated with X', 'A 🤖 Generated with X'],
    ['## Notas de release\nA\n🤖 Generated by X', 'A\n🤖 Generated by X'],
    ['## Objetivo\n🤖 Generated with X\n## Notas de release\nA', 'A'],
  ];
  for (const [body, expected] of table) {
    test(`tabela da doc: ${JSON.stringify(body)} → ${JSON.stringify(expected)}`, () => {
      assert.equal(fn('extractReleaseNotes')(body), expected);
    });
  }

  for (const body of [undefined, 123, {}, [], true]) {
    test(`corpo ${JSON.stringify(body)} (não string) → null, sem lançar`, () => {
      assert.equal(fn('extractReleaseNotes')(body), null);
    });
  }

  test('sem argumento → null', () => {
    assert.equal(fn('extractReleaseNotes')(), null);
  });

  test('corpo vazio → null', () => {
    assert.equal(fn('extractReleaseNotes')(''), null);
  });

  test('marcador em minúsculas vale', () => {
    assert.equal(fn('extractReleaseNotes')('## notas de release\nA'), 'A');
  });

  test('marcador com espaços no fim vale', () => {
    assert.equal(fn('extractReleaseNotes')('## Notas de release   \nA'), 'A');
  });

  test('# Notas de release e ## Notas de release: não valem', () => {
    assert.equal(fn('extractReleaseNotes')('# Notas de release\nA'), null);
    assert.equal(fn('extractReleaseNotes')('## Notas de release:\nA'), null);
  });

  test('comentário HTML de várias linhas é removido', () => {
    const body = '## Notas de release\n\n<!--\nInstrução\n## Notas de release\nOutra\n-->\nTexto real\n';
    assert.equal(fn('extractReleaseNotes')(body), 'Texto real');
  });

  test('comentário no meio da linha é removido', () => {
    assert.equal(fn('extractReleaseNotes')('## Notas de release\nA <!-- x -->B'), 'A B');
  });

  test('vale o primeiro marcador: seção vazia antes de outro marcador → null', () => {
    assert.equal(fn('extractReleaseNotes')('## Notas de release\n\n## Outra\n## Notas de release\nB'), null);
  });

  test('a seção termina no próximo título de nível 2', () => {
    assert.equal(fn('extractReleaseNotes')('## Objetivo\nX\n## Notas de release\nA\nB\n## Riscos\nC'), 'A\nB');
  });

  test('linha que começa com # sem espaço não encerra a seção', () => {
    assert.equal(fn('extractReleaseNotes')('## Notas de release\nA\n#tag\nB'), 'A\n#tag\nB');
  });

  test('título de nível 4 fica dentro da seção', () => {
    assert.equal(fn('extractReleaseNotes')('## Notas de release\n#### X\nA'), '#### X\nA');
  });

  test('espaços do fim removidos, linhas em branco descartadas, indentação preservada', () => {
    assert.equal(fn('extractReleaseNotes')('## Notas de release\n  A  \n\n   \n    B\t\nC'), '  A\n    B\nC');
  });

  test('vai até o fim do corpo quando não há outro título', () => {
    assert.equal(fn('extractReleaseNotes')('Intro\n\n## Notas de release\nA\n\nB\n'), 'A\nB');
  });

  test('o template da organização sem preenchimento não gera notas', () => {
    assert.equal(fn('extractReleaseNotes')(templateText()), null);
  });

  test('o template preenchido gera as notas', () => {
    assert.equal(fn('extractReleaseNotes')(`${templateText()}\nAdiciona X.\n`), 'Adiciona X.');
  });

  test('atribuição: a comparação diferencia maiúsculas', () => {
    const f = fn('extractReleaseNotes');
    assert.equal(f('## Notas de release\nA\n🤖 generated with X'), 'A\n🤖 generated with X');
    assert.equal(f('## Notas de release\nA\n🤖 GENERATED WITH X'), 'A\n🤖 GENERATED WITH X');
  });

  test('atribuição: espaços no fim da linha não impedem o fim da seção', () => {
    assert.equal(fn('extractReleaseNotes')('## Notas de release\nA\n🤖 Generated with X   \nB'), 'A');
  });

  test('atribuição: basta o começo "🤖 Generated with", sem o resto da linha', () => {
    assert.equal(fn('extractReleaseNotes')('## Notas de release\nA\n🤖 Generated with\nB'), 'A');
  });

  test('atribuição: tudo depois dela fica fora, inclusive títulos e outro marcador', () => {
    const body = '## Notas de release\nA\n🤖 Generated with X\n### Detalhe\nB\n## Notas de release\nC';
    assert.equal(fn('extractReleaseNotes')(body), 'A');
  });

  test('atribuição: título de nível 2 antes dela continua encerrando a seção', () => {
    assert.equal(fn('extractReleaseNotes')('## Notas de release\nA\n## Riscos\nB\n🤖 Generated with X'), 'A');
  });

  test('atribuição: texto sem o emoji não encerra a seção', () => {
    assert.equal(fn('extractReleaseNotes')('## Notas de release\nA\nGenerated with X'), 'A\nGenerated with X');
  });

  test('o template preenchido, seguido da atribuição dos agentes, gera só as notas', () => {
    const body = `${templateText()}\nAdiciona X.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n`;
    assert.equal(fn('extractReleaseNotes')(body), 'Adiciona X.');
  });
});

// ---------------------------------------------------------------------------
// groupOf
// ---------------------------------------------------------------------------

test.describe('groupOf', () => {
  const table = [
    [['bug', 'upgrade'], 'Quebra de compatibilidade'],
    [['Enhancement'], 'Novidades'],
    [['Enhancement', 'bug'], 'Novidades'],
    [['feature'], 'Novidades'],
    [['improvement', 'bug'], 'Melhorias'],
    [['bug'], 'Correções'],
    [['BUG'], 'Correções'],
    [['UPGRADE', 'feature'], 'Quebra de compatibilidade'],
    [['documentation', 'release'], 'Outras mudanças'],
    [['release'], 'Outras mudanças'],
    [['tests', 'refactor', 'dependencies', 'deprecated'], 'Outras mudanças'],
    [[], 'Outras mudanças'],
  ];
  for (const [labels, expected] of table) {
    test(`${JSON.stringify(labels)} → ${expected}`, () => {
      assert.equal(fn('groupOf')(labels), expected);
    });
  }

  for (const labels of [undefined, null, 'bug', [1], ['bug', null], { 0: 'bug' }]) {
    test(`labels inválido ${JSON.stringify(labels)} lança TypeError`, () => {
      throwsType('groupOf', labels);
    });
  }
});

// ---------------------------------------------------------------------------
// assignIntroducedIn
// ---------------------------------------------------------------------------

test.describe('assignIntroducedIn', () => {
  test('exemplo da doc', () => {
    const result = fn('assignIntroducedIn')({
      pulls: [
        { number: 40, commits: ['a1'] },
        { number: 41, commits: ['b2'] },
        { number: 42, commits: ['c3', 'c4'] },
      ],
      betas: [
        { tag: '1.2.0-beta.1', commits: ['b2', 'a1'] },
        { tag: '1.1.1-beta.1', commits: ['a1'] },
      ],
    });
    assert.deepEqual(result, [
      { number: 40, commits: ['a1'], introducedIn: '1.1.1-beta.1' },
      { number: 41, commits: ['b2'], introducedIn: '1.2.0-beta.1' },
      { number: 42, commits: ['c3', 'c4'], introducedIn: null },
    ]);
  });

  test('ordena as betas numericamente (beta.10 depois de beta.2; 1.10.0 depois de 1.9.0)', () => {
    const f = fn('assignIntroducedIn');
    const r1 = f({
      pulls: [{ number: 1, commits: ['x'] }],
      betas: [{ tag: '1.2.0-beta.10', commits: ['x'] }, { tag: '1.2.0-beta.2', commits: ['x'] }],
    });
    assert.equal(r1[0].introducedIn, '1.2.0-beta.2');
    const r2 = f({
      pulls: [{ number: 1, commits: ['x'] }],
      betas: [{ tag: '1.10.0-beta.1', commits: ['x'] }, { tag: '1.9.0-beta.3', commits: ['x'] }],
    });
    assert.equal(r2[0].introducedIn, '1.9.0-beta.3');
  });

  test('basta um commit do PR estar na beta', () => {
    const r = fn('assignIntroducedIn')({
      pulls: [{ number: 1, commits: ['a', 'b', 'c'] }],
      betas: [{ tag: '0.1.0-beta.1', commits: ['z', 'c'] }],
    });
    assert.equal(r[0].introducedIn, '0.1.0-beta.1');
  });

  test('sem betas → todos com introducedIn null', () => {
    const r = fn('assignIntroducedIn')({ pulls: [{ number: 1, commits: ['a'] }, { number: 2, commits: [] }], betas: [] });
    assert.deepEqual(r, [{ number: 1, commits: ['a'], introducedIn: null }, { number: 2, commits: [], introducedIn: null }]);
  });

  test('sem PRs → array vazio', () => {
    assert.deepEqual(fn('assignIntroducedIn')({ pulls: [], betas: [{ tag: '1.0.0-beta.1', commits: ['a'] }] }), []);
  });

  test('devolve cópias na mesma ordem, com os outros campos sem mudança, sem alterar a entrada', () => {
    const pulls = deepFreeze([
      { number: 9, title: 't', labels: ['bug'], commits: ['q'], extra: { a: 1 } },
      { number: 3, title: 'u', labels: [], commits: ['w'], introducedIn: 'velho' },
    ]);
    const betas = deepFreeze([{ tag: '2.0.0-beta.1', commits: ['w'] }]);
    const r = fn('assignIntroducedIn')({ pulls, betas });
    assert.notEqual(r, pulls);
    assert.notEqual(r[0], pulls[0]);
    assert.deepEqual(r, [
      { number: 9, title: 't', labels: ['bug'], commits: ['q'], extra: { a: 1 }, introducedIn: null },
      { number: 3, title: 'u', labels: [], commits: ['w'], introducedIn: '2.0.0-beta.1' },
    ]);
    assert.equal(pulls[1].introducedIn, 'velho');
    assert.ok(!('introducedIn' in pulls[0]));
  });

  const ok = { pulls: [{ number: 1, commits: ['a'] }], betas: [{ tag: '1.0.0-beta.1', commits: ['a'] }] };
  const invalid = [
    ['pulls não é array', { ...ok, pulls: null }],
    ['pulls ausente', { betas: ok.betas }],
    ['betas não é array', { ...ok, betas: {} }],
    ['betas ausente', { pulls: ok.pulls }],
    ['PR sem commits', { ...ok, pulls: [{ number: 1 }] }],
    ['PR com commits não array', { ...ok, pulls: [{ number: 1, commits: 'a' }] }],
    ['PR com commit não string', { ...ok, pulls: [{ number: 1, commits: [1] }] }],
    ['PR nulo', { ...ok, pulls: [null] }],
    ['beta sem commits', { ...ok, betas: [{ tag: '1.0.0-beta.1' }] }],
    ['beta com commit não string', { ...ok, betas: [{ tag: '1.0.0-beta.1', commits: [null] }] }],
    ["beta com tag estável '1.2.0'", { ...ok, betas: [{ tag: '1.2.0', commits: ['a'] }] }],
    ["beta com tag legada 'v1.2.0'", { ...ok, betas: [{ tag: 'v1.2.0', commits: ['a'] }] }],
    ["beta com tag 'x'", { ...ok, betas: [{ tag: 'x', commits: ['a'] }] }],
    ['beta sem tag', { ...ok, betas: [{ commits: ['a'] }] }],
  ];
  for (const [name, args] of invalid) {
    test(`${name} lança TypeError`, () => {
      throwsType('assignIntroducedIn', args);
    });
  }
});

// ---------------------------------------------------------------------------
// renderReleaseNotes: linha de resumo
// ---------------------------------------------------------------------------

test.describe('renderReleaseNotes: linha de resumo', () => {
  const cases = [
    ['1.2.0', '1.1.0', 'Versão estável **1.2.0**, com salto minor (novidades compatíveis).'],
    ['2.0.0', 'v1.4.2', 'Versão estável **2.0.0**, com salto major (quebra de compatibilidade).'],
    ['1.1.2', '1.1.1', 'Versão estável **1.1.2**, com salto patch (correções e ajustes).'],
    ['1.0.0', null, 'Versão estável **1.0.0**.'],
    ['1.2.0-beta.2', '1.1.0', 'Pré-release **1.2.0-beta.2** da `1.2.0`, com salto minor (novidades compatíveis) em relação à última estável.'],
    ['1.1.2-beta.1', '1.1.1', 'Pré-release **1.1.2-beta.1** da `1.1.2`, com salto patch (correções e ajustes) em relação à última estável.'],
    ['0.0.1-beta.1', null, 'Pré-release **0.0.1-beta.1** da `0.0.1`.'],
    ['2.1.0-beta.1', '1.4.2', 'Pré-release **2.1.0-beta.1** da `2.1.0`, com salto major (quebra de compatibilidade) em relação à última estável.'],
    ['1.3.0', '1.2.5', 'Versão estável **1.3.0**, com salto minor (novidades compatíveis).'],
    // Base não maior que a da estável anterior → patch.
    ['1.1.0', '1.2.0', 'Versão estável **1.1.0**, com salto patch (correções e ajustes).'],
    ['1.1.0-beta.1', '1.1.0', 'Pré-release **1.1.0-beta.1** da `1.1.0`, com salto patch (correções e ajustes) em relação à última estável.'],
    // previousStable não reconhecida → sem estável anterior.
    ['1.2.0', 'foo', 'Versão estável **1.2.0**.'],
    ['1.2.0-beta.1', '1.1', 'Pré-release **1.2.0-beta.1** da `1.2.0`.'],
  ];
  for (const [tag, previousStable, line] of cases) {
    test(`${tag}, estável anterior ${JSON.stringify(previousStable)}`, () => {
      const body = render({ tag, previousStable });
      assert.equal(body.split('\n')[0], line);
      assert.equal(body.split('\n')[1], '');
    });
  }

  test('previousStable undefined equivale a null', () => {
    const body = fn('renderReleaseNotes')({ repository: REPO, tag: '1.0.0', pulls: [] });
    assert.equal(body.split('\n')[0], 'Versão estável **1.0.0**.');
  });
});

// ---------------------------------------------------------------------------
// renderReleaseNotes: linha "desde"
// ---------------------------------------------------------------------------

test.describe('renderReleaseNotes: linha "desde"', () => {
  const cases = [
    ['estável com anterior', { tag: '1.2.0', previousTag: null, previousStable: '1.1.0' }, 'Mudanças desde a versão estável `1.1.0`.'],
    ['estável com anterior legada', { tag: '2.0.0', previousTag: null, previousStable: 'v1.4.2' }, 'Mudanças desde a versão estável `v1.4.2`.'],
    ['estável sem anterior', { tag: '1.0.0', previousTag: null, previousStable: null }, 'Primeira versão estável; mudanças desde o início do projeto.'],
    ['estável ignora previousTag', { tag: '1.2.0', previousTag: '1.2.0-beta.3', previousStable: '1.1.0' }, 'Mudanças desde a versão estável `1.1.0`.'],
    ['estável sem anterior ignora previousTag', { tag: '1.0.0', previousTag: '1.0.0-beta.1', previousStable: null }, 'Primeira versão estável; mudanças desde o início do projeto.'],
    ['estável com anterior não reconhecida', { tag: '1.2.0', previousTag: null, previousStable: 'foo' }, 'Primeira versão estável; mudanças desde o início do projeto.'],
    ['beta, partida e estável', { tag: '1.2.0-beta.2', previousTag: '1.2.0-beta.1', previousStable: '1.1.0' }, 'Mudanças desde `1.2.0-beta.1`. Última versão estável: `1.1.0`.'],
    ['beta, partida igual à estável', { tag: '1.1.2-beta.1', previousTag: '1.1.1', previousStable: '1.1.1' }, 'Mudanças desde `1.1.1`. Última versão estável: `1.1.1`.'],
    ['beta, partida sem estável', { tag: '0.1.0-beta.2', previousTag: '0.1.0-beta.1', previousStable: null }, 'Mudanças desde `0.1.0-beta.1`. Ainda não há versão estável.'],
    ['beta, sem partida e com estável', { tag: '1.2.0-beta.1', previousTag: null, previousStable: '1.1.0' }, 'Mudanças desde o início do projeto. Última versão estável: `1.1.0`.'],
    ['beta, sem partida nem estável', { tag: '0.0.1-beta.1', previousTag: null, previousStable: null }, 'Mudanças desde o início do projeto. Ainda não há versão estável.'],
    ['beta, estável não reconhecida', { tag: '0.1.0-beta.2', previousTag: '0.1.0-beta.1', previousStable: 'foo' }, 'Mudanças desde `0.1.0-beta.1`. Ainda não há versão estável.'],
    ['beta, previousTag undefined', { tag: '0.0.1-beta.1', previousTag: undefined, previousStable: undefined }, 'Mudanças desde o início do projeto. Ainda não há versão estável.'],
  ];
  for (const [name, args, line] of cases) {
    test(name, () => {
      assert.equal(desdeLine(render(args)), line);
    });
  }

  test('a linha "desde" aparece também sem nenhum PR', () => {
    const body = render({ tag: '1.2.0', previousStable: '1.1.0' });
    assert.ok(body.includes('## O que há de novo\n\nMudanças desde a versão estável `1.1.0`.\n\nNenhum pull request encontrado neste intervalo.\n\n'));
  });
});

// ---------------------------------------------------------------------------
// renderReleaseNotes: linha das betas
// ---------------------------------------------------------------------------

test.describe('renderReleaseNotes: linha das betas', () => {
  const TAIL = 'Cada item mostra a beta em que entrou; os itens sem beta são novos nesta versão.';

  test('uma beta', () => {
    const body = render({ tag: '1.2.0', previousStable: '1.1.0', betas: ['1.2.0-beta.1'] });
    assert.equal(body.split('\n\n')[1], `Reúne a beta \`1.2.0-beta.1\`. ${TAIL}`);
  });

  test('duas betas, ordenadas', () => {
    const body = render({ tag: '1.2.0', previousStable: '1.1.0', betas: ['1.2.0-beta.1', '1.1.1-beta.1'] });
    assert.equal(body.split('\n\n')[1], `Reúne as betas \`1.1.1-beta.1\` e \`1.2.0-beta.1\`. ${TAIL}`);
  });

  test('três betas, ordem numérica, unidas com vírgula e "e"', () => {
    const body = render({ tag: '1.2.0', previousStable: '1.1.0', betas: ['1.2.0-beta.10', '1.2.0-beta.2', '1.1.1-beta.1'] });
    assert.equal(body.split('\n\n')[1], `Reúne as betas \`1.1.1-beta.1\`, \`1.2.0-beta.2\` e \`1.2.0-beta.10\`. ${TAIL}`);
  });

  test('exemplo da doc com três betas', () => {
    const body = render({ tag: '1.2.0', previousStable: '1.1.0', betas: ['1.2.0-beta.2', '1.1.1-beta.1', '1.2.0-beta.1'] });
    assert.equal(body.split('\n\n')[1], `Reúne as betas \`1.1.1-beta.1\`, \`1.2.0-beta.1\` e \`1.2.0-beta.2\`. ${TAIL}`);
  });

  test('sem betas (vazio ou omitido) a linha não existe', () => {
    for (const extra of [{ betas: [] }, {}]) {
      const body = render({ tag: '1.2.0', previousStable: '1.1.0', ...extra });
      assert.ok(!body.includes('Reúne'));
      assert.equal(body.split('\n\n')[1], '## O que há de novo');
    }
  });

  test('na beta, a lista de betas é ignorada', () => {
    const body = render({ tag: '1.2.0-beta.2', previousTag: '1.2.0-beta.1', previousStable: '1.1.0', betas: ['1.2.0-beta.1'] });
    assert.ok(!body.includes('Reúne'));
    assert.equal(body.split('\n\n')[1], '## O que há de novo');
  });
});

// ---------------------------------------------------------------------------
// renderReleaseNotes: grupos e itens
// ---------------------------------------------------------------------------

function groupTitles(body) {
  return body.split('\n').filter((l) => l.startsWith('### '));
}

test.describe('renderReleaseNotes: grupos', () => {
  test('ordem da tabela, omitindo grupos vazios', () => {
    const body = render({
      tag: '1.0.0',
      pulls: [
        pr({ number: 1, labels: ['documentation'] }),
        pr({ number: 2, labels: ['bug'] }),
        pr({ number: 3, labels: ['upgrade'] }),
        pr({ number: 4, labels: ['feature'] }),
      ],
    });
    assert.deepEqual(groupTitles(body), ['### Quebra de compatibilidade', '### Novidades', '### Correções', '### Outras mudanças']);
  });

  test('todos os cinco grupos', () => {
    const body = render({
      tag: '1.0.0',
      pulls: [5, 4, 3, 2, 1].map((n, i) => pr({ number: n, labels: [['upgrade'], ['enhancement'], ['improvement'], ['bug'], []][i] })),
    });
    assert.deepEqual(groupTitles(body), ['### Quebra de compatibilidade', '### Novidades', '### Melhorias', '### Correções', '### Outras mudanças']);
  });

  test('cada PR em um grupo só; labels sem diferenciar maiúsculas', () => {
    const body = render({
      tag: '1.0.0',
      pulls: [
        pr({ number: 1, title: 'a', labels: ['bug', 'upgrade'] }),
        pr({ number: 2, title: 'b', labels: ['Enhancement', 'bug'] }),
        pr({ number: 3, title: 'c', labels: ['improvement', 'bug'] }),
        pr({ number: 4, title: 'd', labels: ['documentation', 'release'] }),
        pr({ number: 5, title: 'e', labels: [] }),
        pr({ number: 6, title: 'f', labels: ['release'] }),
      ],
    });
    const sections = body.split('\n\n');
    const after = (title) => sections[sections.indexOf(title) + 1];
    assert.equal(after('### Quebra de compatibilidade'), `- A ([#1](${prUrl(1)})) por ${userLink('ScriptPlayerAgent')}`);
    assert.equal(after('### Novidades'), `- B ([#2](${prUrl(2)})) por ${userLink('ScriptPlayerAgent')}`);
    assert.equal(after('### Melhorias'), `- C ([#3](${prUrl(3)})) por ${userLink('ScriptPlayerAgent')}`);
    assert.ok(!sections.includes('### Correções'));
    assert.equal(after('### Outras mudanças'), [4, 5, 6].map((n) => `- ${'DEF'[n - 4]} ([#${n}](${prUrl(n)})) por ${userLink('ScriptPlayerAgent')}`).join('\n'));
  });

  test('dentro do grupo, ordem crescente numérica de número', () => {
    const body = render({ tag: '1.0.0', pulls: [pr({ number: 30, title: 'c' }), pr({ number: 4, title: 'a' }), pr({ number: 12, title: 'b' })] });
    assert.deepEqual(itemLines(body).map((l) => l.slice(0, 3)), ['- A', '- B', '- C']);
  });

  test('número repetido: vale a primeira ocorrência', () => {
    const body = render({ tag: '1.0.0', pulls: [pr({ number: 5, title: 'primeiro', labels: ['bug'] }), pr({ number: 5, title: 'segundo', labels: ['upgrade'] })] });
    assert.deepEqual(itemLines(body), [`- Primeiro ([#5](${prUrl(5)})) por ${userLink('ScriptPlayerAgent')}`]);
    assert.deepEqual(groupTitles(body), ['### Correções']);
  });

  test('sem PRs: linha fixa, sem grupos e sem Contribuidores', () => {
    const body = render({ tag: '1.0.0' });
    assert.equal(body, [
      'Versão estável **1.0.0**.',
      '## O que há de novo',
      'Primeira versão estável; mudanças desde o início do projeto.',
      'Nenhum pull request encontrado neste intervalo.',
      '**Histórico completo:** [commits até `1.0.0`](https://github.com/Elavora/.github/commits/1.0.0)',
    ].join('\n\n') + '\n');
  });
});

test.describe('renderReleaseNotes: texto do item (limpeza do título)', () => {
  const cases = [
    ['feat: gera as notas', 'Gera as notas'],
    ['fix(release)!: troca o título', 'Troca o título'],
    ['build(deps): bump x', 'Bump x'],
    ['refactor!: simplifica', 'Simplifica'],
    ['Feat(Escopo X): algo', 'Algo'],
    ['docs:   vários espaços', 'Vários espaços'],
    ['atualiza o README', 'Atualiza o README'],
    ['Já maiúsculo', 'Já maiúsculo'],
    ['fix:sem espaço', 'Fix:sem espaço'],
    ['fix: corrige `x`_y_ e *z*.', 'Corrige `x`_y_ e *z*.'],
    ['123 começa com número', '123 começa com número'],
    ['feat: ', 'feat:'],
    ['ébano: acento', 'Ébano: acento'],
  ];
  for (const [title, text] of cases) {
    test(`${JSON.stringify(title)} → ${JSON.stringify(text)}`, () => {
      const body = render({ tag: '1.0.0', pulls: [pr({ number: 7, title })] });
      assert.deepEqual(itemLines(body), [`- ${text} ([#7](${prUrl(7)})) por ${userLink('ScriptPlayerAgent')}`]);
    });
  }

  test('notas preenchidas substituem o título, sem limpeza', () => {
    const body = render({ tag: '1.0.0', pulls: [pr({ number: 7, title: 'feat: x', body: '## Notas de release\nfeat: texto livre.' })] });
    assert.deepEqual(itemLines(body), [`- feat: texto livre. ([#7](${prUrl(7)})) por ${userLink('ScriptPlayerAgent')}`]);
  });

  test('body vazio, sem marcador ou ausente usa o título', () => {
    for (const extra of [{ body: '' }, { body: '## Objetivo\nX' }, { body: undefined }, { body: null }]) {
      const p = pr({ number: 7, title: 'fix: y', ...extra });
      if (extra.body === undefined) delete p.body;
      assert.deepEqual(itemLines(render({ tag: '1.0.0', pulls: [p] })), [`- Y ([#7](${prUrl(7)})) por ${userLink('ScriptPlayerAgent')}`]);
    }
  });

  test('notas de várias linhas: exemplo do PR #44', () => {
    const body = render({
      tag: '1.2.0',
      previousStable: '1.1.0',
      pulls: [pr({
        number: 44,
        labels: ['enhancement'],
        body: '## Notas de release\n\n- O título da release passa a ser `<owner>/<repo> <tag>`.\n  A entrada `package_name` é ignorada.\n',
      })],
    });
    const expected = '- O título da release passa a ser `<owner>/<repo> <tag>`. ([#44](https://github.com/Elavora/.github/pull/44)) por [ScriptPlayerAgent](https://github.com/ScriptPlayerAgent)\n'
      + '    A entrada `package_name` é ignorada.';
    assert.ok(body.includes(`### Novidades\n\n${expected}\n\n## Contribuidores`), body);
  });

  test('notas de várias linhas: marcador "* " removido, demais linhas com dois espaços a mais', () => {
    const body = render({ tag: '1.0.0', pulls: [pr({ number: 7, body: '## Notas de release\n* Primeira\nSegunda\n  - Terceira' })] });
    assert.ok(body.includes(`- Primeira ([#7](${prUrl(7)})) por ${userLink('ScriptPlayerAgent')}\n  Segunda\n    - Terceira\n`), body);
  });

  test('a linha de atribuição dos agentes não entra no item', () => {
    const body = render({ tag: '1.0.0', pulls: [pr({ number: 7, body: '## Notas de release\nTexto\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n' })] });
    assert.deepEqual(itemLines(body), [`- Texto ([#7](${prUrl(7)})) por ${userLink('ScriptPlayerAgent')}`]);
    assert.ok(!body.includes('Generated with'), body);
  });

  test('primeira linha sem marcador fica como está', () => {
    const body = render({ tag: '1.0.0', pulls: [pr({ number: 7, body: '## Notas de release\nTexto\nMais' })] });
    assert.ok(body.includes(`- Texto ([#7](${prUrl(7)})) por ${userLink('ScriptPlayerAgent')}\n  Mais\n`), body);
  });
});

test.describe('renderReleaseNotes: autores sem @menção', () => {
  test('usuário vira link para o perfil', () => {
    const body = render({ tag: '1.0.0', pulls: [pr({ number: 1, author: 'Felipe-Cavalca' })] });
    assert.deepEqual(itemLines(body), [`- Algo ([#1](${prUrl(1)})) por [Felipe-Cavalca](https://github.com/Felipe-Cavalca)`]);
    assert.ok(!body.includes('@'));
  });

  test('bot: sufixo [bot] removido e perfil do app', () => {
    const body = render({ tag: '1.0.0', pulls: [pr({ number: 1, author: 'dependabot[bot]' })] });
    assert.deepEqual(itemLines(body), [`- Algo ([#1](${prUrl(1)})) por [dependabot](https://github.com/apps/dependabot)`]);
    assert.ok(body.includes('## Contribuidores\n\n- [dependabot](https://github.com/apps/dependabot)\n\n'));
    assert.ok(!body.includes('[bot]'));
  });

  test('sem autor (null ou ausente): sem " por ...", e sem Contribuidores', () => {
    const semCampo = pr({ number: 2 });
    delete semCampo.author;
    const body = render({ tag: '1.0.0', pulls: [pr({ number: 1, author: null }), semCampo] });
    assert.deepEqual(itemLines(body), [`- Algo ([#1](${prUrl(1)}))`, `- Algo ([#2](${prUrl(2)}))`]);
    assert.ok(!body.includes('## Contribuidores'));
    assert.ok(!body.includes(' por '));
  });

  test('nenhum @ no corpo gerado a partir de PRs sem @', () => {
    const body = render({
      tag: '1.2.0',
      previousStable: '1.1.0',
      betas: ['1.2.0-beta.1'],
      pulls: [
        pr({ number: 1, author: 'a-user', labels: ['bug'], introducedIn: '1.2.0-beta.1' }),
        pr({ number: 2, author: 'renovate[bot]', body: '## Notas de release\nNota\ncom duas linhas' }),
        pr({ number: 3, author: null }),
      ],
    });
    assert.ok(!body.includes('@'), body);
  });
});

test.describe('renderReleaseNotes: "entrou na"', () => {
  test('na estável, só para PR com introducedIn', () => {
    const body = render({
      tag: '1.2.0',
      previousStable: '1.1.0',
      betas: ['1.2.0-beta.1'],
      pulls: [pr({ number: 1, introducedIn: '1.2.0-beta.1' }), pr({ number: 2, introducedIn: null }), pr({ number: 3 })],
    });
    assert.deepEqual(itemLines(body), [
      `- Algo ([#1](${prUrl(1)})) por ${userLink('ScriptPlayerAgent')} · entrou na \`1.2.0-beta.1\``,
      `- Algo ([#2](${prUrl(2)})) por ${userLink('ScriptPlayerAgent')}`,
      `- Algo ([#3](${prUrl(3)})) por ${userLink('ScriptPlayerAgent')}`,
    ]);
  });

  test('na estável, sem autor: o sufixo vem logo depois do link do PR', () => {
    const body = render({ tag: '1.2.0', previousStable: '1.1.0', betas: ['1.2.0-beta.1'], pulls: [pr({ number: 1, author: null, introducedIn: '1.2.0-beta.1' })] });
    assert.deepEqual(itemLines(body), [`- Algo ([#1](${prUrl(1)})) · entrou na \`1.2.0-beta.1\``]);
  });

  test('na beta, nunca aparece', () => {
    const body = render({ tag: '1.2.0-beta.2', previousTag: '1.2.0-beta.1', previousStable: '1.1.0', pulls: [pr({ number: 1, introducedIn: '1.2.0-beta.1' })] });
    assert.ok(!body.includes('entrou na'));
  });
});

// ---------------------------------------------------------------------------
// renderReleaseNotes: Contribuidores
// ---------------------------------------------------------------------------

function contributors(body) {
  const i = body.indexOf('## Contribuidores\n\n');
  if (i === -1) return null;
  const rest = body.slice(i + '## Contribuidores\n\n'.length);
  return rest.slice(0, rest.indexOf('\n\n')).split('\n');
}

test.describe('renderReleaseNotes: Contribuidores', () => {
  test('sem repetir (sem diferenciar maiúsculas), grafia da primeira ocorrência, ordem alfabética em minúsculas', () => {
    const body = render({
      tag: '1.0.0',
      pulls: [
        pr({ number: 9, author: 'zeta' }),
        pr({ number: 1, author: 'ALPHA' }),
        pr({ number: 2, author: 'Alpha' }),
        pr({ number: 3, author: 'beta[bot]' }),
        pr({ number: 4, author: 'Zeta' }),
        pr({ number: 5, author: null }),
        pr({ number: 6, author: '1user' }),
        pr({ number: 7, author: 'Beta[bot]' }),
      ],
    });
    assert.deepEqual(contributors(body), [
      '- [1user](https://github.com/1user)',
      '- [ALPHA](https://github.com/ALPHA)',
      '- [beta](https://github.com/apps/beta)',
      '- [zeta](https://github.com/zeta)',
    ]);
  });

  test('os itens mantêm a grafia de cada PR', () => {
    const body = render({ tag: '1.0.0', pulls: [pr({ number: 1, author: 'ALPHA' }), pr({ number: 2, author: 'Alpha' })] });
    assert.deepEqual(itemLines(body), [
      `- Algo ([#1](${prUrl(1)})) por [ALPHA](https://github.com/ALPHA)`,
      `- Algo ([#2](${prUrl(2)})) por [Alpha](https://github.com/Alpha)`,
    ]);
  });

  test('Contribuidores vem depois dos grupos e antes da comparação', () => {
    const body = render({ tag: '1.1.0', previousStable: '1.0.0', pulls: [pr({ number: 1 })] });
    const blocks = body.split('\n\n');
    assert.deepEqual(blocks.slice(-3), [
      '## Contribuidores',
      '- [ScriptPlayerAgent](https://github.com/ScriptPlayerAgent)',
      '**Comparação completa:** [`1.0.0...1.1.0`](https://github.com/Elavora/.github/compare/1.0.0...1.1.0)\n',
    ]);
  });
});

// ---------------------------------------------------------------------------
// renderReleaseNotes: linha de comparação
// ---------------------------------------------------------------------------

test.describe('renderReleaseNotes: linha de comparação', () => {
  const lastLine = (body) => body.split('\n').filter(Boolean).pop();
  const cases = [
    ['estável usa a estável anterior', { tag: '1.2.0', previousTag: '1.2.0-beta.1', previousStable: '1.1.0' }, '**Comparação completa:** [`1.1.0...1.2.0`](https://github.com/Elavora/.github/compare/1.1.0...1.2.0)'],
    ['estável com legada', { tag: '2.0.0', previousTag: null, previousStable: 'v1.4.2' }, '**Comparação completa:** [`v1.4.2...2.0.0`](https://github.com/Elavora/.github/compare/v1.4.2...2.0.0)'],
    ['estável sem anterior (previousTag ignorado)', { tag: '1.0.0', previousTag: '1.0.0-beta.1', previousStable: null }, '**Histórico completo:** [commits até `1.0.0`](https://github.com/Elavora/.github/commits/1.0.0)'],
    ['beta usa a tag de partida', { tag: '1.2.0-beta.2', previousTag: '1.2.0-beta.1', previousStable: '1.1.0' }, '**Comparação completa:** [`1.2.0-beta.1...1.2.0-beta.2`](https://github.com/Elavora/.github/compare/1.2.0-beta.1...1.2.0-beta.2)'],
    ['beta sem tag de partida', { tag: '0.0.1-beta.1', previousTag: null, previousStable: null }, '**Histórico completo:** [commits até `0.0.1-beta.1`](https://github.com/Elavora/.github/commits/0.0.1-beta.1)'],
    ['beta sem tag de partida, com estável', { tag: '1.2.0-beta.1', previousTag: null, previousStable: '1.1.0' }, '**Histórico completo:** [commits até `1.2.0-beta.1`](https://github.com/Elavora/.github/commits/1.2.0-beta.1)'],
  ];
  for (const [name, args, line] of cases) {
    test(name, () => {
      assert.equal(lastLine(render(args)), line);
    });
  }

  test('usa o repositório recebido', () => {
    const body = fn('renderReleaseNotes')({ repository: 'Elavora/api-framework', tag: '2.0.0', previousTag: null, previousStable: '1.0.0', pulls: [] });
    assert.ok(body.endsWith('**Comparação completa:** [`1.0.0...2.0.0`](https://github.com/Elavora/api-framework/compare/1.0.0...2.0.0)\n'));
  });
});

// ---------------------------------------------------------------------------
// renderReleaseNotes: formato geral
// ---------------------------------------------------------------------------

test.describe('renderReleaseNotes: formato geral', () => {
  const samples = () => [
    fn('renderReleaseNotes')(stableExampleArgs()),
    render({ tag: '0.0.1-beta.1' }),
    render({ tag: '1.0.0', pulls: [pr({ number: 1, body: '## Notas de release\nA   \n  B  ' })] }),
  ];

  test('termina com uma única quebra de linha', () => {
    for (const body of samples()) {
      assert.ok(body.endsWith('\n'));
      assert.ok(!body.endsWith('\n\n'));
    }
  });

  test('sem \\r e sem espaços no fim das linhas', () => {
    for (const body of samples()) {
      assert.ok(!body.includes('\r'));
      for (const line of body.split('\n')) assert.equal(line, line.replace(/\s+$/, ''), JSON.stringify(line));
    }
  });

  test('blocos separados por uma linha em branco (nunca duas)', () => {
    for (const body of samples()) assert.ok(!body.includes('\n\n\n'));
  });
});

// ---------------------------------------------------------------------------
// renderReleaseNotes: validação
// ---------------------------------------------------------------------------

test.describe('renderReleaseNotes: TypeError', () => {
  const base = () => ({ repository: REPO, tag: '1.2.0', previousTag: null, previousStable: '1.1.0', pulls: [pr()], betas: [] });
  const withPr = (over, drop) => {
    const p = { ...pr(), ...over };
    if (drop) delete p[drop];
    return { ...base(), pulls: [p] };
  };
  const invalid = [
    ['repository inválido', { ...base(), repository: 'Elavora' }],
    ['repository ausente', { ...base(), repository: undefined }],
    ['tag legada', { ...base(), tag: 'v1.2.0' }],
    ['tag 1.2', { ...base(), tag: '1.2' }],
    ['tag ausente', { ...base(), tag: undefined }],
    ['previousTag número', { ...base(), previousTag: 1 }],
    ['previousTag objeto', { ...base(), previousTag: {} }],
    ['previousStable número', { ...base(), previousStable: 110 }],
    ['previousStable booleano', { ...base(), previousStable: false }],
    ['pulls não array', { ...base(), pulls: {} }],
    ['pulls ausente', { ...base(), pulls: undefined }],
    ['PR nulo', { ...base(), pulls: [null] }],
    ['number 0', withPr({ number: 0 })],
    ['number negativo', withPr({ number: -1 })],
    ['number fracionário', withPr({ number: 1.5 })],
    ['number string', withPr({ number: '1' })],
    ['number ausente', withPr({}, 'number')],
    ['title ausente', withPr({}, 'title')],
    ['title número', withPr({ title: 1 })],
    ['url ausente', withPr({}, 'url')],
    ['url número', withPr({ url: 1 })],
    ['labels ausente', withPr({}, 'labels')],
    ['labels string', withPr({ labels: 'bug' })],
    ['labels com não string', withPr({ labels: ['bug', 1] })],
    ['author número', withPr({ author: 1 })],
    ['body número', withPr({ body: 1 })],
    ['introducedIn número', withPr({ introducedIn: 1 })],
    ['betas não array', { ...base(), betas: '1.2.0-beta.1' }],
    ['betas com não string', { ...base(), betas: [1] }],
    ['betas null', { ...base(), betas: null }],
  ];
  for (const [name, args] of invalid) {
    test(`${name} lança TypeError`, () => {
      throwsType('renderReleaseNotes', args);
    });
  }

  test('campos a mais (como commits) são ignorados', () => {
    const body = fn('renderReleaseNotes')({ ...base(), pulls: [{ ...pr(), commits: ['a'], merged_at: 'x' }] });
    assert.deepEqual(itemLines(body), [`- Algo ([#1](${prUrl(1)})) por ${userLink('ScriptPlayerAgent')}`]);
  });

  test('previousTag e previousStable undefined são aceitos', () => {
    const body = fn('renderReleaseNotes')({ repository: REPO, tag: '1.0.0', pulls: [] });
    assert.equal(typeof body, 'string');
  });
});

// ---------------------------------------------------------------------------
// renderReleaseNotes: limite de tamanho
// ---------------------------------------------------------------------------

test.describe('renderReleaseNotes: limite de tamanho', () => {
  const LIMIT = 125000;
  const HEAD = ['Versão estável **1.0.0**.', '## O que há de novo', 'Primeira versão estável; mudanças desde o início do projeto.'];
  const HIST = '**Histórico completo:** [commits até `1.0.0`](https://github.com/Elavora/.github/commits/1.0.0)';
  const notice = (n) => `_E mais ${n} pull requests que não couberam aqui. Veja a lista completa na comparação._`;
  const item = (p) => `- ${p.title} ([#${p.number}](${p.url})) por [${p.author}](https://github.com/${p.author})`;

  // Monta o corpo esperado pelas regras da doc, com os `removed` últimos itens retirados.
  function expectedBody(groups, authors, removed) {
    const flat = groups.flatMap((g) => g.pulls.map((p) => ({ g: g.title, line: item(p) })));
    const kept = flat.slice(0, flat.length - removed);
    const parts = [...HEAD];
    for (const g of groups) {
      const lines = kept.filter((k) => k.g === g.title).map((k) => k.line);
      if (lines.length) parts.push(`### ${g.title}`, lines.join('\n'));
    }
    if (removed) parts.push(notice(removed));
    parts.push('## Contribuidores', authors.map((a) => `- [${a}](https://github.com/${a})`).join('\n'), HIST);
    return parts.join('\n\n') + '\n';
  }

  function minimalCut(groups, authors) {
    const total = groups.reduce((s, g) => s + g.pulls.length, 0);
    for (let removed = 0; removed <= total; removed++) {
      const body = expectedBody(groups, authors, removed);
      if (body.length <= LIMIT) return { body, removed };
    }
    throw new Error('não coube');
  }

  const mk = (number, title, labels, author) => ({ number, title, url: prUrl(number), labels, author, body: null });

  test('corta itens do fim, apaga o grupo que fica vazio e mantém os autores retirados', () => {
    const fixes = [];
    for (let i = 0; i < 1000; i++) fixes.push(mk(1000 + i, `Correção ${'y'.repeat(150)}`, ['bug'], 'autor-a'));
    const others = [mk(5000, 'Outra coisa', [], 'autor-b')];
    const groups = [{ title: 'Correções', pulls: fixes }, { title: 'Outras mudanças', pulls: others }];
    const { body: expected, removed } = minimalCut(groups, ['autor-a', 'autor-b']);
    assert.ok(removed > 1);

    const body = render({ tag: '1.0.0', pulls: [...others, ...fixes].reverse() });
    assert.ok(body.length <= LIMIT, `corpo com ${body.length} caracteres`);
    assert.equal(body, expected);
    assert.ok(!body.includes('### Outras mudanças'));
    assert.ok(body.includes('- [autor-b](https://github.com/autor-b)'));
    assert.ok(body.includes(`\n\n${notice(removed)}\n\n## Contribuidores\n\n`));
  });

  test('exatamente 125000 caracteres não corta; 125001 corta um item', () => {
    const pulls = [];
    for (let i = 0; i < 400; i++) pulls.push(mk(1000 + i, `Item ${'z'.repeat(200)}`, [], 'autor-a'));
    const groups = () => [{ title: 'Outras mudanças', pulls }];
    const delta = LIMIT - expectedBody(groups(), ['autor-a'], 0).length;
    assert.ok(delta > 0);
    pulls[0] = { ...pulls[0], title: pulls[0].title + 'w'.repeat(delta) };
    const exact = expectedBody(groups(), ['autor-a'], 0);
    assert.equal(exact.length, LIMIT);
    assert.equal(render({ tag: '1.0.0', pulls }), exact);

    pulls[0] = { ...pulls[0], title: pulls[0].title + 'w' };
    const { body: expected, removed } = minimalCut(groups(), ['autor-a']);
    assert.equal(removed, 1);
    const body = render({ tag: '1.0.0', pulls });
    assert.equal(body, expected);
    assert.ok(body.includes(notice(1)));
  });

  test('o tamanho é contado com string.length (caracteres não ASCII contam 1)', () => {
    const pulls = [];
    for (let i = 0; i < 400; i++) pulls.push(mk(1000 + i, `Ação ${'ç'.repeat(200)}`, [], 'autor-a'));
    const groups = [{ title: 'Outras mudanças', pulls }];
    const full = expectedBody(groups, ['autor-a'], 0);
    assert.ok(full.length <= LIMIT && Buffer.byteLength(full) > LIMIT, 'premissa do teste');
    assert.equal(render({ tag: '1.0.0', pulls }), full);
  });
});

// ---------------------------------------------------------------------------
// Template de PR da organização
// ---------------------------------------------------------------------------

// Declaração de função (içada): os testes de extractReleaseNotes, mais acima, também usam o template.
function templateText() {
  return `## Objetivo

<!-- O que este PR resolve e por quê. Cite a issue, se houver (Closes #123). -->

## Principais mudanças

<!-- Lista curta do que mudou. -->

## Testes executados

<!-- Comandos que você rodou e o resultado. -->

## Riscos

<!-- O que pode quebrar, como reverter e o que conferir depois do merge. -->

## Notas de release

<!--
Opcional. O que você escrever aqui substitui o título do PR na GitHub Release, em português.
Deixe vazio para usar o título. Pode ter mais de uma linha.
As labels do PR definem a versão e o grupo na release: veja docs/release.md no Elavora/.github.
-->
`;
}
const TEMPLATE = templateText();

test.describe('.github/PULL_REQUEST_TEMPLATE.md', () => {
  test('conteúdo exato da seção "Template de PR da organização"', () => {
    const file = path.join(ROOT, '.github', 'PULL_REQUEST_TEMPLATE.md');
    assert.ok(fs.existsSync(file), '.github/PULL_REQUEST_TEMPLATE.md precisa existir');
    assert.equal(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'), TEMPLATE);
  });
});

// ---------------------------------------------------------------------------
// Workflows (lidos como texto): docs/release.md passo 6 e docs/notas-de-release.md "Testes"
// ---------------------------------------------------------------------------

function readWorkflow(name) {
  const file = path.join(ROOT, '.github', 'workflows', name);
  assert.ok(fs.existsSync(file), `.github/workflows/${name} precisa existir`);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

// Remove comentários de linha inteira para não casar texto comentado.
const codeLines = (text) => text.split('\n').filter((l) => !/^\s*#/.test(l));
const indentOf = (l) => l.match(/^ */)[0].length;

function block(ls, key) {
  const re = new RegExp(`^\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*(#.*)?$`);
  const start = ls.findIndex((l) => re.test(l));
  if (start === -1) return null;
  const base = indentOf(ls[start]);
  const out = [];
  for (let i = start + 1; i < ls.length; i++) {
    if (ls[i].trim() !== '' && indentOf(ls[i]) <= base) break;
    out.push(ls[i]);
  }
  return out;
}

// Divide a lista `steps:` em passos (cada um começa com `- ` na indentação mínima).
function splitSteps(ls) {
  const nonEmpty = ls.filter((l) => l.trim() !== '');
  const min = Math.min(...nonEmpty.map(indentOf));
  const steps = [];
  for (const l of ls) {
    if (indentOf(l) === min && /^\s*- /.test(l)) steps.push([l]);
    else if (steps.length) steps[steps.length - 1].push(l);
  }
  return steps.map((s) => s.join('\n'));
}

test.describe('release.yml: notas de release', () => {
  test('não usa mais generate_release_notes', () => {
    assert.doesNotMatch(codeLines(readWorkflow('release.yml')).join('\n'), /generate_release_notes/);
  });

  test('o valor de package_name não é usado (nem no título)', () => {
    assert.doesNotMatch(codeLines(readWorkflow('release.yml')).join('\n'), /inputs\.package_name/);
  });

  test("a entrada package_name continua aceita: string, opcional, padrão ''", () => {
    const ls = codeLines(readWorkflow('release.yml'));
    const call = block(ls, 'workflow_call');
    assert.ok(call, 'workflow_call ausente');
    const inputs = block(call, 'inputs');
    assert.ok(inputs, 'inputs ausente');
    const b = block(inputs, 'package_name');
    assert.ok(b, 'entrada package_name ausente');
    const get = (k) => {
      const m = b.map((l) => l.match(new RegExp(`^\\s*${k}:\\s*(.*?)\\s*(#.*)?$`))).find(Boolean);
      return m ? m[1].replace(/^(['"])(.*)\1$/, '$2') : undefined;
    };
    assert.equal(get('type'), 'string');
    assert.notEqual(get('required'), 'true');
    assert.equal(get('default'), '');
  });

  test('o passo que cria a release usa releaseTitle e renderReleaseNotes de scripts/release-notes.cjs', () => {
    const ls = codeLines(readWorkflow('release.yml'));
    const jobs = block(ls, 'jobs');
    assert.ok(jobs, 'jobs ausente');
    const release = block(jobs, 'release');
    assert.ok(release, 'job release ausente');
    const steps = block(release, 'steps');
    assert.ok(steps, 'steps do job release ausente');
    const creating = splitSteps(steps).filter((s) => /make_latest/.test(s) && /prerelease/.test(s));
    assert.equal(creating.length, 1, 'esperado um passo que cria a release (com prerelease e make_latest)');
    assert.match(creating[0], /release-notes\.cjs/);
    assert.match(creating[0], /releaseTitle/);
    assert.match(creating[0], /renderReleaseNotes/);
  });
});

test.describe('auto-release.yml', () => {
  test('não passa mais package_name', () => {
    assert.doesNotMatch(codeLines(readWorkflow('auto-release.yml')).join('\n'), /package_name/);
  });
});

// ---------------------------------------------------------------------------
// Casos de borda fixados pela doc: string vazia, estável anterior beta ou não reconhecida, betas inválidas
// ---------------------------------------------------------------------------

test.describe('renderReleaseNotes: string vazia e estável anterior inválida', () => {
  const lastLine = (body) => body.split('\n').filter(Boolean).pop();
  const hist = (tag) => `**Histórico completo:** [commits até \`${tag}\`](https://github.com/Elavora/.github/commits/${tag})`;
  const FIRST = 'Primeira versão estável; mudanças desde o início do projeto.';

  test("exemplo da doc: 1.0.0 com previousStable '1.0.0-beta.3'", () => {
    const body = render({ tag: '1.0.0', previousStable: '1.0.0-beta.3' });
    assert.equal(body.split('\n')[0], 'Versão estável **1.0.0**.');
    assert.equal(desdeLine(body), FIRST);
    assert.equal(lastLine(body), hist('1.0.0'));
  });

  for (const previousStable of ['', 'foo', '1.1', '1.1.0-beta.2', 'v1.1.0-beta.1']) {
    test(`estável com previousStable ${JSON.stringify(previousStable)} e previousTag preenchida: sem estável anterior, histórico`, () => {
      const body = render({ tag: '1.2.0', previousTag: '1.2.0-beta.1', previousStable });
      assert.equal(body.split('\n')[0], 'Versão estável **1.2.0**.');
      assert.equal(desdeLine(body), FIRST);
      assert.equal(lastLine(body), hist('1.2.0'));
      assert.ok(!body.includes('Comparação completa'));
    });
  }

  for (const previousStable of ['', '1.1.0-beta.2']) {
    test(`beta com previousStable ${JSON.stringify(previousStable)}: sem estável anterior, comparação pela tag de partida`, () => {
      const body = render({ tag: '1.2.0-beta.2', previousTag: '1.2.0-beta.1', previousStable });
      assert.equal(body.split('\n')[0], 'Pré-release **1.2.0-beta.2** da `1.2.0`.');
      assert.equal(desdeLine(body), 'Mudanças desde `1.2.0-beta.1`. Ainda não há versão estável.');
      assert.equal(lastLine(body), '**Comparação completa:** [`1.2.0-beta.1...1.2.0-beta.2`](https://github.com/Elavora/.github/compare/1.2.0-beta.1...1.2.0-beta.2)');
    });
  }

  test("beta com previousTag '': sem tag de partida, histórico", () => {
    const body = render({ tag: '1.2.0-beta.1', previousTag: '', previousStable: '1.1.0' });
    assert.equal(desdeLine(body), 'Mudanças desde o início do projeto. Última versão estável: `1.1.0`.');
    assert.equal(lastLine(body), hist('1.2.0-beta.1'));
  });

  test("beta com previousTag '' e previousStable '': igual a sem nenhuma tag", () => {
    const body = render({ tag: '0.0.1-beta.1', previousTag: '', previousStable: '' });
    assert.equal(body, render({ tag: '0.0.1-beta.1', previousTag: null, previousStable: null }));
    assert.equal(desdeLine(body), 'Mudanças desde o início do projeto. Ainda não há versão estável.');
  });

  test("estável com previousStable '' é igual a null", () => {
    assert.equal(render({ tag: '1.0.0', previousStable: '' }), render({ tag: '1.0.0', previousStable: null }));
  });

  test("introducedIn '' equivale a null (sem \"entrou na\")", () => {
    const body = render({ tag: '1.2.0', previousStable: '1.1.0', pulls: [pr({ number: 1, introducedIn: '' })] });
    assert.deepEqual(itemLines(body), [`- Algo ([#1](${prUrl(1)})) por ${userLink('ScriptPlayerAgent')}`]);
    assert.ok(!body.includes('entrou na'));
  });
});

test.describe('renderReleaseNotes: betas inválidas e ordem', () => {
  for (const bad of ['1.2.0', 'v1.2.0', 'x', '', 'v1.2.0-beta.1']) {
    for (const tag of ['1.2.0', '1.2.0-beta.2']) {
      test(`betas com ${JSON.stringify(bad)} lança TypeError (tag ${tag})`, () => {
        throwsType('renderReleaseNotes', {
          repository: REPO, tag, previousTag: '1.2.0-beta.1', previousStable: '1.1.0', pulls: [], betas: ['1.2.0-beta.1', bad],
        });
      });
    }
  }

  test('ordem por base e depois por N, numericamente', () => {
    const body = render({ tag: '1.10.0', previousStable: '1.8.0', betas: ['1.10.0-beta.1', '1.9.0-beta.10', '1.9.0-beta.2'] });
    assert.equal(body.split('\n\n')[1], 'Reúne as betas `1.9.0-beta.2`, `1.9.0-beta.10` e `1.10.0-beta.1`. Cada item mostra a beta em que entrou; os itens sem beta são novos nesta versão.');
  });
});
