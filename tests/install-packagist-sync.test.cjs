'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { install } = require('../scripts/install-packagist-sync.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'packagist-fixture-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'composer.json'), '{"name":"elavora/api-framework"}\n');
  const workflows = path.join(root, '.github', 'workflows');
  fs.mkdirSync(workflows, { recursive: true });
  return { root, workflows };
}

test('installs both release triggers and immutable central references, removing only legacy publishers', t => {
  const { root, workflows } = fixture(t);
  const sha = 'a'.repeat(40);
  for (const name of ['publish-composer.yml', 'update-composer-on-release.yml', 'release.yml', 'quality.yml']) {
    fs.writeFileSync(path.join(workflows, name), name);
  }
  install(root, sha);
  const text = fs.readFileSync(path.join(workflows, 'packagist-sync.yml'), 'utf8');
  assert.match(text, /workflows: \[Release, Tag on merge\]/);
  assert.match(text, /types: \[completed\]/);
  assert.match(text, /actions: read/);
  assert.ok(!text.includes('head_repository'));
  assert.match(text, /workflow_dispatch:/);
  assert.match(text, /types: \[published\]/);
  assert.match(text, /tags: \['v\*'\]/);
  assert.equal(text.split(sha).length - 1, 2);
  assert.ok(!text.includes('AUTOMATION_REF'));
  assert.ok(!fs.existsSync(path.join(workflows, 'publish-composer.yml')));
  assert.ok(!fs.existsSync(path.join(workflows, 'update-composer-on-release.yml')));
  assert.equal(fs.readFileSync(path.join(workflows, 'release.yml'), 'utf8'), 'release.yml');
  assert.equal(fs.readFileSync(path.join(workflows, 'quality.yml'), 'utf8'), 'quality.yml');
  assert.equal(fs.readFileSync(path.join(root, 'composer.json'), 'utf8'), '{"name":"elavora/api-framework"}\n');
  install(root, sha);
  assert.equal(fs.readFileSync(path.join(workflows, 'packagist-sync.yml'), 'utf8'), text);
});

test('rejects mutable automation refs before writing files', t => {
  const { root, workflows } = fixture(t);
  assert.throws(() => install(root, 'main'), /SHA/);
  assert.deepEqual(fs.readdirSync(workflows), []);
});

test('rejects a non-Elavora consumer', t => {
  const { root, workflows } = fixture(t);
  fs.writeFileSync(path.join(root, 'composer.json'), '{"name":"other/package"}');
  assert.throws(() => install(root, 'a'.repeat(40)), /pacote Composer/);
  assert.deepEqual(fs.readdirSync(workflows), []);
});
