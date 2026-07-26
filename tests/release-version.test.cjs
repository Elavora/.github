'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { selectReleaseTag } = require('../scripts/release-version.cjs');

test('reutiliza tag do mesmo commit', () => {
  const selected = selectReleaseTag(
    [{ name: 'v1.2.3-rc.1', sha: 'merge' }],
    'merge',
    []
  );

  assert.equal(selected.name, 'v1.2.3-rc.1');
});

test('incrementa pre-releases sequenciais', () => {
  const tags = [{ name: 'v1.2.2', sha: 'stable' }];
  const first = selectReleaseTag(tags, 'first', ['bug']);
  const second = selectReleaseTag(
    [...tags, { name: first.name, sha: first.sha }],
    'second',
    ['bug']
  );

  assert.equal(first.name, 'v1.2.3-rc.1');
  assert.equal(second.name, 'v1.2.3-rc.2');
});

test('promove a pre-release mais recente', () => {
  const selected = selectReleaseTag(
    [
      { name: 'v1.2.2', sha: 'stable' },
      { name: 'v1.2.3-rc.1', sha: 'candidate' },
    ],
    'release',
    ['release']
  );

  assert.equal(selected.name, 'v1.2.3');
  assert.equal(selected.rc, null);
});

test('considera mais de cem tags ao calcular a versao', () => {
  const tags = Array.from({ length: 150 }, (_, index) => ({
    name: `v0.0.${index + 1}`,
    sha: `sha-${index + 1}`,
  }));
  const selected = selectReleaseTag(tags, 'next', ['enhancement']);

  assert.equal(selected.name, 'v0.1.0-rc.1');
});

test('incrementa major quando solicitado', () => {
  const selected = selectReleaseTag(
    [{ name: 'v2.7.4', sha: 'stable' }],
    'next',
    ['upgrade']
  );

  assert.equal(selected.name, 'v3.0.0-rc.1');
});
