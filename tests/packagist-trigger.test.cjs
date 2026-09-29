'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { shouldNotify } = require('../scripts/packagist-trigger.cjs');
const repo = { owner: 'Elavora', repo: 'api-framework' };
const run = { repository: { full_name: 'Elavora/api-framework' }, status: 'completed',
  event: 'pull_request', path: '.github/workflows/tag_on_merge.yml', id: 42, run_attempt: 2,
  head_repository: { full_name: 'Contributor/fork' }, conclusion: 'failure' };
function fixture(changes = {}, jobs = [{ steps: [{ name: 'Create Tag', conclusion: 'success' }] }]) {
  return { context: { repo, eventName: 'workflow_run', payload: { workflow_run: { ...run, ...changes } } },
    github: { rest: { actions: { listJobsForWorkflowRunAttempt: 'jobs' } }, paginate: async (method, args) => {
      assert.equal(method, 'jobs');
      assert.deepEqual(args, { ...repo, run_id: 42, attempt_number: 2, per_page: 100 });
      return jobs;
    } } };
}
test('merged fork tag is synchronized despite failure in a later job', async () => {
  assert.equal(await shouldNotify(fixture()), true);
});
test('modern release is synchronized despite failure in the optional notifier', async () => {
  assert.equal(await shouldNotify(fixture({ path: '.github/workflows/release.yml' },
    [{ steps: [{ name: 'Criar tag e release de forma idempotente', conclusion: 'success' }] }])), true);
});
for (const jobs of [[], [{ conclusion: 'skipped' }], [{ steps: [{ name: 'Create Tag', conclusion: 'skipped' }] }],
  [{ steps: [{ name: 'Create Tag', conclusion: 'failure' }] }], [{ steps: [{ name: 'Checkout', conclusion: 'success' }] }]]) {
  test(`does not notify without a successful tag step: ${JSON.stringify(jobs)}`, async () => {
    assert.equal(await shouldNotify(fixture({ conclusion: 'success' }, jobs)), false);
  });
}
for (const change of [{ repository: { full_name: 'Contributor/fork' } }, { path: '.github/workflows/quality.yml' },
  { event: 'push' }, { status: 'in_progress' }, { id: undefined }, { run_attempt: undefined }]) {
  test(`rejects an unrelated or incomplete run: ${JSON.stringify(change)}`, async () => {
    const input = fixture(change); input.github.paginate = async () => { throw new Error('must not query jobs'); };
    assert.equal(await shouldNotify(input), false);
  });
}
test('job API failures remain visible', async () => {
  const input = fixture(); input.github.paginate = async () => { throw new Error('API failed'); };
  await assert.rejects(shouldNotify(input), /API failed/);
});
for (const [eventName, payload, expected] of [
  ['push', { ref: 'refs/tags/v1.2.3', deleted: false }, true],
  ['push', { ref: 'refs/tags/v1.2.3', deleted: true }, false],
  ['push', { ref: 'refs/heads/main' }, false],
  ['release', { action: 'published', release: { draft: false } }, true],
  ['release', { action: 'published', release: { draft: true } }, false],
  ['workflow_dispatch', {}, true], ['pull_request', {}, false],
]) {
  test(`explicit event ${eventName} ${JSON.stringify(payload)}`, async () => {
    assert.equal(await shouldNotify({ context: { repo, eventName, payload }, github: {} }), expected);
  });
}
