'use strict';

// Contrato: docs/branches-temporarias.md, seções "Regra para os workflows" e
// "Estado de cada workflow deste repositório".
// Lê o YAML como texto (sem dependências externas) e confere o filtro de branch de cada gatilho.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const WORKFLOWS = path.join(ROOT, '.github', 'workflows');
const FILTERED = ['push', 'pull_request', 'pull_request_target'];
const OUT_OF_RULE = ['schedule', 'workflow_dispatch', 'workflow_call'];

const indent = (l) => l.match(/^ */)[0].length;
const unquote = (s) => s.trim().replace(/^(['"])(.*)\1$/, '$2');
const stripComment = (s) => s.replace(/\s+#.*$/, '');

// Lista YAML: `[a, 'b']` na mesma linha ou itens `- x` nas linhas seguintes.
function listValue(inline, rest) {
  const v = stripComment(inline).trim();
  if (v.startsWith('[')) {
    const inner = v.replace(/^\[/, '').replace(/\]$/, '').trim();
    return inner === '' ? [] : inner.split(',').map(unquote);
  }
  if (v !== '') return [unquote(v)];
  return rest.filter((l) => /^\s*-\s/.test(l)).map((l) => unquote(stripComment(l.replace(/^\s*-\s*/, ''))));
}

// Devolve { gatilho: { branches?: [], 'branches-ignore'?: [] } } do bloco `on:`.
function parseTriggers(text) {
  const ls = text.replace(/\r\n/g, '\n').split('\n').filter((l) => !/^\s*#/.test(l));
  const start = ls.findIndex((l) => /^(on|'on'|"on"|true):/.test(l));
  assert.notEqual(start, -1, 'o workflow precisa ter o bloco on:');
  const inline = stripComment(ls[start].replace(/^[^:]+:/, '')).trim();
  const triggers = {};
  if (inline !== '') {
    // `on: push` ou `on: [push, pull_request]`: nenhum filtro.
    for (const name of listValue(inline, [])) triggers[name] = {};
    return triggers;
  }
  const body = [];
  for (let i = start + 1; i < ls.length; i++) {
    if (ls[i].trim() !== '' && indent(ls[i]) === 0) break;
    body.push(ls[i]);
  }
  const nonEmpty = body.filter((l) => l.trim() !== '');
  if (nonEmpty.length === 0) return triggers;
  const base = Math.min(...nonEmpty.map(indent));
  for (let i = 0; i < body.length; i++) {
    const l = body[i];
    if (l.trim() === '' || indent(l) !== base) continue;
    const name = l.trim().split(':')[0];
    const child = [];
    for (let j = i + 1; j < body.length && (body[j].trim() === '' || indent(body[j]) > base); j++) child.push(body[j]);
    const filters = {};
    const childNonEmpty = child.filter((c) => c.trim() !== '');
    if (childNonEmpty.length > 0) {
      const cbase = Math.min(...childNonEmpty.map(indent));
      for (let k = 0; k < child.length; k++) {
        const c = child[k];
        if (c.trim() === '' || indent(c) !== cbase) continue;
        const m = c.match(/^\s*([\w-]+):\s*(.*)$/);
        if (!m || (m[1] !== 'branches' && m[1] !== 'branches-ignore')) continue;
        const sub = [];
        for (let n = k + 1; n < child.length && (child[n].trim() === '' || indent(child[n]) > cbase || /^\s*-\s/.test(child[n])); n++) {
          if (indent(child[n]) === cbase && !/^\s*-\s/.test(child[n])) break;
          sub.push(child[n]);
        }
        filters[m[1]] = listValue(m[2], sub);
      }
    }
    triggers[name] = filters;
  }
  return triggers;
}

// Devolve a lista de problemas (vazia quando o workflow segue a regra).
function violations(text) {
  const problems = [];
  for (const [name, f] of Object.entries(parseTriggers(text))) {
    if (!FILTERED.includes(name)) continue;
    const hasB = Array.isArray(f.branches);
    const hasI = Array.isArray(f['branches-ignore']);
    if (hasB && hasI) {
      problems.push(`${name}: branches e branches-ignore no mesmo gatilho`);
    } else if (hasB) {
      if (f.branches.length === 0) problems.push(`${name}: branches vazio`);
      for (const b of f.branches) {
        if (/[*?[!]/.test(b)) problems.push(`${name}: branches com padrão (${b})`);
        else if (b.startsWith('tmp/')) problems.push(`${name}: branches começa com tmp/ (${b})`);
      }
    } else if (hasI) {
      if (!f['branches-ignore'].includes('tmp/**')) problems.push(`${name}: branches-ignore sem 'tmp/**'`);
    } else {
      problems.push(`${name}: sem filtro de branch`);
    }
  }
  return problems;
}

const wf = (on) => `name: X\n\non:\n${on}\n\npermissions:\n  contents: read\n\njobs:\n  a:\n    runs-on: ubuntu-latest\n`;

test.describe('regra dos gatilhos: casos da documentação', () => {
  const ok = {
    'branches: [main]': '  push:\n    branches: [main]',
    'pull_request com types e branches: [main]': '  pull_request:\n    types: [closed]\n    branches: [main]',
    'push com paths e branches: [main]': '  push:\n    branches: [main]\n    paths:\n      - .github/labels.json',
    "branches-ignore em lista de bloco com 'tmp/**'": "  pull_request:\n    branches-ignore:\n      - 'tmp/**'",
    "branches-ignore inline com 'tmp/**' e outro padrão": "  pull_request:\n    branches-ignore: ['tmp/**', 'release/*']",
    'branches com vários nomes exatos': '  push:\n    branches:\n      - main\n      - develop',
    'pull_request_target com branches: [main]': '  pull_request_target:\n    branches: [main]',
    'só schedule e workflow_dispatch (fora da regra)': "  schedule:\n    - cron: '17 3 * * 1'\n  workflow_dispatch:",
    'só workflow_call (fora da regra)': '  workflow_call:\n    inputs:\n      a:\n        type: string',
    'bloco on: esperado no test.yml': "  pull_request:\n    branches-ignore:\n      - 'tmp/**'\n  push:\n    branches: [main]",
  };
  for (const [nome, on] of Object.entries(ok)) {
    test(`válido: ${nome}`, () => assert.deepEqual(violations(wf(on)), []));
  }

  const bad = {
    'pull_request: vazio': '  pull_request:',
    'pull_request só com types': '  pull_request:\n    types: [opened, synchronize]',
    'push vazio': '  push:\n  workflow_dispatch:',
    'pull_request_target sem filtro': '  pull_request_target:\n    types: [opened]',
    "branches com '*'": "  push:\n    branches: ['*']",
    "branches com 'release/**'": "  push:\n    branches: ['release/**']",
    "branches com '?'": "  push:\n    branches: ['v?']",
    "branches com '['": "  push:\n    branches: ['v[0-9]']",
    "branches com '!'": "  push:\n    branches:\n      - main\n      - '!tmp/**'",
    'branches começando com tmp/': '  push:\n    branches: [tmp/felipe-cavalca/x]',
    "branches-ignore sem 'tmp/**'": "  pull_request:\n    branches-ignore: ['wip/**']",
    "branches-ignore com 'tmp/*' (um asterisco só)": "  pull_request:\n    branches-ignore:\n      - 'tmp/*'",
    'branches e branches-ignore no mesmo gatilho': "  push:\n    branches: [main]\n    branches-ignore: ['tmp/**']",
    'um gatilho certo e outro sem filtro': '  push:\n    branches: [main]\n  pull_request:',
  };
  for (const [nome, on] of Object.entries(bad)) {
    test(`inválido: ${nome}`, () => assert.notDeepEqual(violations(wf(on)), []));
  }

  test('inválido: on: push na forma curta', () => {
    assert.notDeepEqual(violations('name: X\non: push\njobs: {}\n'), []);
  });
  test('inválido: on: [push, pull_request] na forma de lista', () => {
    assert.notDeepEqual(violations('name: X\non: [push, pull_request]\njobs: {}\n'), []);
  });
});

test.describe('workflows de .github/workflows seguem a regra', () => {
  const files = fs.readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f));
  test('há workflows para conferir', () => assert.ok(files.length > 0));
  for (const f of files) {
    test(f, () => {
      const problems = violations(fs.readFileSync(path.join(WORKFLOWS, f), 'utf8'));
      assert.deepEqual(problems, [], `${f} não segue docs/branches-temporarias.md`);
    });
  }
});

test.describe('estado documentado de cada workflow', () => {
  const read = (f) => parseTriggers(fs.readFileSync(path.join(WORKFLOWS, f), 'utf8'));

  test("test.yml: pull_request com branches-ignore ['tmp/**'] e push com branches [main]", () => {
    const t = read('test.yml');
    assert.deepEqual(Object.keys(t).sort(), ['pull_request', 'push']);
    assert.deepEqual(t.pull_request, { 'branches-ignore': ['tmp/**'] });
    assert.deepEqual(t.push, { branches: ['main'] });
  });
  test('auto-release.yml: pull_request com branches [main]', () => {
    const t = read('auto-release.yml');
    assert.deepEqual(Object.keys(t), ['pull_request']);
    assert.deepEqual(t.pull_request, { branches: ['main'] });
  });
  test('auto-sync-labels.yml: push com branches [main]', () => {
    const t = read('auto-sync-labels.yml');
    assert.deepEqual(t.push, { branches: ['main'] });
    for (const k of Object.keys(t)) assert.ok(k === 'push' || OUT_OF_RULE.includes(k), k);
  });
  for (const f of ['release.yml', 'sync-labels.yml', 'php-quality.yml']) {
    test(`${f}: só workflow_call`, () => assert.deepEqual(Object.keys(read(f)), ['workflow_call']));
  }
});

// Blocos ```yaml da documentação que trazem um bloco on: (os chamadores de exemplo).
function yamlBlocksWithOn(doc) {
  const text = fs.readFileSync(path.join(ROOT, 'docs', doc), 'utf8').replace(/\r\n/g, '\n');
  const out = [];
  const re = /^([ \t]*)```ya?ml\n([\s\S]*?)\n\1```/gm;
  let m;
  while ((m = re.exec(text))) {
    const pad = m[1].length;
    const body = m[2].split('\n').map((l) => l.slice(Math.min(pad, indent(l)))).join('\n');
    if (/^on:/m.test(body)) out.push(body);
  }
  return out;
}

test.describe('chamadores de exemplo da documentação seguem a regra', () => {
  for (const doc of ['release.md', 'labels.md', 'qualidade.md']) {
    test(doc, () => {
      const blocks = yamlBlocksWithOn(doc);
      assert.ok(blocks.length > 0, `${doc} precisa ter um chamador de exemplo com on:`);
      blocks.forEach((b, i) => assert.deepEqual(violations(b), [], `${doc}, exemplo ${i + 1}`));
    });
  }
});
