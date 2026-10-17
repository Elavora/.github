'use strict';

// Contrato: docs/versionamento.md
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'release-version.cjs');
const { parseTag, bumpFromLabels, nextVersion, BUMP_LABELS } = require(SCRIPT);

test.describe('BUMP_LABELS', () => {
  test('mapeamento documentado, em minúsculas', () => {
    assert.ok(BUMP_LABELS && typeof BUMP_LABELS === 'object', 'BUMP_LABELS precisa ser exportado');
    assert.deepEqual(Object.keys(BUMP_LABELS).sort(), ['major', 'minor']);
    assert.deepEqual([...BUMP_LABELS.major].sort(), ['upgrade']);
    assert.deepEqual([...BUMP_LABELS.minor].sort(), ['enhancement', 'feature', 'improvement']);
    for (const nome of [...BUMP_LABELS.major, ...BUMP_LABELS.minor]) {
      assert.equal(nome, nome.toLowerCase());
    }
  });

  test('bumpFromLabels segue BUMP_LABELS', () => {
    for (const nome of BUMP_LABELS.major) assert.equal(bumpFromLabels([nome]), 'major');
    for (const nome of BUMP_LABELS.minor) assert.equal(bumpFromLabels([nome]), 'minor');
  });
});

test.describe('parseTag', () => {
  test('estável 1.2.0', () => {
    assert.deepEqual(parseTag('1.2.0'), {
      name: '1.2.0', major: 1, minor: 2, patch: 0, beta: null, legacy: false,
    });
  });

  test('pré-release 1.2.0-beta.3', () => {
    assert.deepEqual(parseTag('1.2.0-beta.3'), {
      name: '1.2.0-beta.3', major: 1, minor: 2, patch: 0, beta: 3, legacy: false,
    });
  });

  test('estável legada v0.2.0', () => {
    assert.deepEqual(parseTag('v0.2.0'), {
      name: 'v0.2.0', major: 0, minor: 2, patch: 0, beta: null, legacy: true,
    });
  });

  test('estável legada v1.2.0', () => {
    assert.deepEqual(parseTag('v1.2.0'), {
      name: 'v1.2.0', major: 1, minor: 2, patch: 0, beta: null, legacy: true,
    });
  });

  test('componentes com mais de um dígito e zero', () => {
    assert.deepEqual(parseTag('0.10.0'), {
      name: '0.10.0', major: 0, minor: 10, patch: 0, beta: null, legacy: false,
    });
    assert.deepEqual(parseTag('10.0.12-beta.11'), {
      name: '10.0.12-beta.11', major: 10, minor: 0, patch: 12, beta: 11, legacy: false,
    });
  });

  for (const name of [
    'v1.2.0-rc.1',
    'v1.0.0-rc.1',
    '1.2.0-rc.1',
    '1.2.0-beta',
    '1.2.0-beta.0',
    '1.2',
    '01.2.0',
    '1.02.0',
    '1.2.00',
    '0.17.1-32',
    'latest',
    '',
  ]) {
    test(`ignora ${JSON.stringify(name)}`, () => {
      assert.equal(parseTag(name), null);
    });
  }
});

test.describe('bumpFromLabels', () => {
  const casos = [
    [[], 'patch'],
    [['upgrade'], 'major'],
    [['enhancement'], 'minor'],
    [['feature'], 'minor'],
    [['improvement'], 'minor'],
    [['bug'], 'patch'],
    [['documentation'], 'patch'],
    [['tests'], 'patch'],
    [['refactor'], 'patch'],
    [['deprecated'], 'patch'],
    [['dependencies'], 'patch'],
    [['question'], 'patch'],
    [['release'], 'patch'],
    [['bug', 'enhancement'], 'minor'],
    [['bug', 'Enhancement'], 'minor'],
    [['upgrade', 'bug'], 'major'],
    [['bug', 'enhancement', 'upgrade'], 'major'],
    [['feature', 'enhancement', 'improvement'], 'minor'],
    [['dependencies', 'feature'], 'minor'],
    [['improvement', 'upgrade'], 'major'],
    [['Upgrade'], 'major'],
    [['FEATURE'], 'minor'],
    [['Improvement'], 'minor'],
    // labels obsoletas valem patch, como qualquer label desconhecida
    [['major'], 'patch'],
    [['minor'], 'patch'],
    [['patch'], 'patch'],
    [['breaking'], 'patch'],
    [['breaking', 'major', 'minor'], 'patch'],
    [['IA'], 'patch'],
    [['php'], 'patch'],
  ];
  for (const [labels, esperado] of casos) {
    test(`${JSON.stringify(labels)} → ${esperado}`, () => {
      assert.equal(bumpFromLabels(labels), esperado);
    });
  }
});

test.describe('nextVersion: tabela de exemplos da documentação', () => {
  // [tags existentes, labels, tag nova, bump, previous]
  const exemplos = [
    [[], [], '0.0.1-beta.1', 'patch', null],
    [[], ['release'], '0.0.1', 'patch', null],
    [[], ['upgrade', 'release'], '1.0.0', 'major', null],
    [['1.1.1'], ['bug'], '1.1.2-beta.1', 'patch', '1.1.1'],
    [['1.1.1'], ['documentation'], '1.1.2-beta.1', 'patch', '1.1.1'],
    [['1.1.1'], ['dependencies'], '1.1.2-beta.1', 'patch', '1.1.1'],
    [['1.1.1', '1.1.2-beta.1'], ['bug'], '1.1.2-beta.2', 'patch', '1.1.1'],
    [['1.1.1', '1.1.2-beta.2'], ['enhancement'], '1.2.0-beta.1', 'minor', '1.1.1'],
    [['1.1.1', '1.1.2-beta.2', '1.2.0-beta.1'], ['bug'], '1.2.0-beta.2', 'patch', '1.1.1'],
    [['1.1.1', '1.2.0-beta.1'], ['question'], '1.2.0-beta.2', 'patch', '1.1.1'],
    [['1.1.1'], ['feature'], '1.2.0-beta.1', 'minor', '1.1.1'],
    [['1.1.1'], ['improvement'], '1.2.0-beta.1', 'minor', '1.1.1'],
    [['1.1.1'], ['refactor', 'tests', 'deprecated'], '1.1.2-beta.1', 'patch', '1.1.1'],
    [['1.1.1'], ['dependencies', 'feature'], '1.2.0-beta.1', 'minor', '1.1.1'],
    [['1.1.1', '1.2.0-beta.3'], ['upgrade'], '2.0.0-beta.1', 'major', '1.1.1'],
    [['1.1.1', '1.2.0-beta.3'], ['release'], '1.2.0', 'patch', '1.1.1'],
    [['1.1.1', '1.2.0-beta.3'], ['release', 'bug'], '1.2.0', 'patch', '1.1.1'],
    [['1.1.1', '1.2.0-beta.3'], ['release', 'upgrade'], '2.0.0', 'major', '1.1.1'],
    [['1.1.1'], ['release', 'enhancement'], '1.2.0', 'minor', '1.1.1'],
    [['1.1.1'], ['bug', 'enhancement', 'upgrade'], '2.0.0-beta.1', 'major', '1.1.1'],
    [['1.2.0', '1.2.0-beta.3'], ['bug'], '1.2.1-beta.1', 'patch', '1.2.0'],
    [['1.9.0', '1.10.0'], ['bug'], '1.10.1-beta.1', 'patch', '1.10.0'],
    [['1.1.1'], ['Enhancement'], '1.2.0-beta.1', 'minor', '1.1.1'],
    [['1.1.1'], ['major'], '1.1.2-beta.1', 'patch', '1.1.1'],
    [['1.1.1'], ['breaking', 'release'], '1.1.2', 'patch', '1.1.1'],
    [['v0.1.0', 'v0.1.1', 'v0.2.0'], ['bug'], '0.2.1-beta.1', 'patch', 'v0.2.0'],
    [['v0.2.0', '0.2.1-beta.1'], ['release'], '0.2.1', 'patch', 'v0.2.0'],
    [['v1.0.0', 'v1.1.0-rc.1', 'v2.0.0-rc.1'], ['upgrade'], '2.0.0-beta.1', 'major', 'v1.0.0'],
    [['0.17.1-32', 'latest'], [], '0.0.1-beta.1', 'patch', null],
  ];

  for (const [tags, labels, tag, bump, previous] of exemplos) {
    const titulo = `tags ${JSON.stringify(tags)} + labels ${JSON.stringify(labels)} → ${tag}`;
    test(titulo, () => {
      const prerelease = tag.includes('-beta.');
      const version = tag.replace(/-beta\.\d+$/, '');
      assert.deepEqual(nextVersion({ tags, labels }), {
        tag, version, prerelease, bump, previous,
      });
    });
  }
});

test.describe('nextVersion: regras do algoritmo', () => {
  test('a ordem das tags não importa', () => {
    const tags = ['1.2.0-beta.1', '1.1.2-beta.2', '1.1.1'];
    assert.equal(nextVersion({ tags, labels: ['bug'] }).tag, '1.2.0-beta.2');
    assert.equal(nextVersion({ tags: [...tags].reverse(), labels: ['bug'] }).tag, '1.2.0-beta.2');
  });

  test('S é a maior estável comparada numericamente', () => {
    const r = nextVersion({ tags: ['1.10.0', '1.9.0', '1.2.0'], labels: ['enhancement'] });
    assert.equal(r.previous, '1.10.0');
    assert.equal(r.tag, '1.11.0-beta.1');
  });

  test('N é 1 + o maior número de beta da base, mesmo com lacunas', () => {
    const r = nextVersion({ tags: ['1.1.1', '1.1.2-beta.1', '1.1.2-beta.5'], labels: [] });
    assert.equal(r.tag, '1.1.2-beta.6');
  });

  test('beta 1.10 é comparada numericamente como maior que 1.9', () => {
    const r = nextVersion({ tags: ['1.1.1', '1.9.0-beta.4', '1.10.0-beta.2'], labels: ['bug'] });
    assert.equal(r.tag, '1.10.0-beta.3');
  });

  test('beta com base igual a S é superada; base menor também', () => {
    const r = nextVersion({ tags: ['1.1.0-beta.7', '1.2.0-beta.3', '1.2.0'], labels: ['bug'] });
    assert.equal(r.tag, '1.2.1-beta.1');
  });

  test('beta com número de dois dígitos', () => {
    const r = nextVersion({ tags: ['1.1.1', '1.1.2-beta.9', '1.1.2-beta.10'], labels: [] });
    assert.equal(r.tag, '1.1.2-beta.11');
  });

  test('major zera minor e patch; minor zera patch', () => {
    assert.equal(nextVersion({ tags: ['1.4.7'], labels: ['upgrade', 'release'] }).tag, '2.0.0');
    assert.equal(nextVersion({ tags: ['1.4.7'], labels: ['feature', 'release'] }).tag, '1.5.0');
  });

  test('beta pendente maior que C prevalece', () => {
    // C = 1.1.2 (patch), P = 2.0.0
    const r = nextVersion({ tags: ['1.1.1', '2.0.0-beta.1'], labels: ['bug'] });
    assert.equal(r.tag, '2.0.0-beta.2');
    assert.equal(r.version, '2.0.0');
  });

  test('legada e nova com o mesmo número representam a mesma versão', () => {
    for (const tags of [['v1.2.0', '1.2.0'], ['1.2.0', 'v1.2.0']]) {
      const r = nextVersion({ tags, labels: ['bug'] });
      assert.equal(r.tag, '1.2.1-beta.1');
      assert.equal(r.version, '1.2.1');
      assert.equal(r.previous, '1.2.0', 'com as duas formas, previous é o nome sem prefixo');
    }
  });

  test('só a legada existe: previous é a legada', () => {
    const r = nextVersion({ tags: ['v1.2.0', 'v1.1.0'], labels: ['bug'] });
    assert.equal(r.previous, 'v1.2.0');
  });

  test('estável legada superando beta nova com a mesma base', () => {
    const r = nextVersion({ tags: ['v1.2.0', '1.2.0-beta.4'], labels: [] });
    assert.equal(r.tag, '1.2.1-beta.1');
  });

  test('labels sem diferenciar caixa para release', () => {
    const r = nextVersion({ tags: ['1.1.1'], labels: ['Release'] });
    assert.equal(r.tag, '1.1.2');
    assert.equal(r.prerelease, false);
  });

  test('tags não reconhecidas são ignoradas sem erro', () => {
    const r = nextVersion({
      tags: ['latest', 'foo', '1.2', '01.2.0', '1.3.0-rc.1', '1.3.0-beta', '1.3.0-beta.0', 'v9.0.0-rc.1', '1.1.1'],
      labels: ['bug'],
    });
    assert.equal(r.tag, '1.1.2-beta.1');
    assert.equal(r.previous, '1.1.1');
  });

  for (const labels of ['bug', [1], [null], null, {}, ['bug', 2]]) {
    test(`labels inválidas ${JSON.stringify(labels)} lançam TypeError`, () => {
      assert.equal(typeof nextVersion, 'function');
      assert.throws(() => nextVersion({ tags: [], labels }), TypeError);
    });
  }
});

test.describe('linha de comando', () => {
  function run(...args) {
    return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
  }

  test('exemplo da documentação', () => {
    const r = run('1.1.1 1.2.0-beta.1', '["bug"]');
    assert.equal(r.status, 0, r.stderr);
    assert.equal(
      r.stdout.trim(),
      '{"tag":"1.2.0-beta.2","version":"1.2.0","prerelease":true,"bump":"patch","previous":"1.1.1"}',
    );
    assert.equal(r.stdout.trim().split('\n').length, 1);
  });

  test('tags separadas por quebra de linha', () => {
    const r = run('1.1.1\n1.1.2-beta.2\n1.2.0-beta.1\n', '["bug"]');
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout), {
      tag: '1.2.0-beta.2', version: '1.2.0', prerelease: true, bump: 'patch', previous: '1.1.1',
    });
  });

  test('sem tags e sem labels', () => {
    const r = run('', '[]');
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout), {
      tag: '0.0.1-beta.1', version: '0.0.1', prerelease: true, bump: 'patch', previous: null,
    });
  });

  test('estável com release', () => {
    const r = run('v0.2.0 0.2.1-beta.1', '["release"]');
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout), {
      tag: '0.2.1', version: '0.2.1', prerelease: false, bump: 'patch', previous: 'v0.2.0',
    });
  });

  for (const labels of ['[bug', '{"a":1}', '"bug"', '[1]', 'null', '["bug",2]']) {
    test(`labels ${labels} saem com código 1, mensagem em stderr e nada em stdout`, () => {
      const r = run('1.1.1', labels);
      assert.equal(r.status, 1);
      assert.notEqual(r.stderr.trim(), '');
      assert.equal(r.stdout, '');
    });
  }

  test('sem o segundo argumento, as labels são []', () => {
    const r = run('1.1.1 1.2.0-beta.1');
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout), {
      tag: '1.2.0-beta.2', version: '1.2.0', prerelease: true, bump: 'patch', previous: '1.1.1',
    });
  });

  test('sem argumentos, tags e labels são []', () => {
    const r = run();
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout), {
      tag: '0.0.1-beta.1', version: '0.0.1', prerelease: true, bump: 'patch', previous: null,
    });
  });

  test('labels de minor pela CLI', () => {
    const r = run('1.1.1', '["improvement"]');
    assert.equal(r.status, 0, r.stderr);
    assert.equal(JSON.parse(r.stdout).tag, '1.2.0-beta.1');
  });
});
