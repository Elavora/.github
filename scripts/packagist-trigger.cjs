'use strict';

// Inspect metadata only. Never execute source code or artifacts from the upstream run.
async function shouldNotify({ github, context }) {
  const { owner, repo } = context.repo;
  const payload = context.payload;
  if (context.eventName === 'workflow_dispatch') return true;
  if (context.eventName === 'push') return !payload.deleted && /^refs\/tags\/v.+/.test(payload.ref || '');
  if (context.eventName === 'release') return payload.action === 'published' && !payload.release?.draft;
  if (context.eventName === 'repository_dispatch') {
    const tag = payload.client_payload?.tag;
    if (payload.action !== 'tag-created' || typeof tag !== 'string' || !/^v[^\s]+$/.test(tag)) return false;
    try {
      await github.rest.git.getRef({ owner, repo, ref: `tags/${tag}` });
      return true;
    } catch (error) {
      if (error.status === 404) return false;
      throw error;
    }
  }
  if (context.eventName !== 'workflow_run') return false;
  const run = payload.workflow_run;
  const steps = {
    '.github/workflows/tag_on_merge.yml': 'Create Tag',
    '.github/workflows/release.yml': 'Criar tag e release de forma idempotente',
  };
  if (run?.repository?.full_name !== `${owner}/${repo}` || run.status !== 'completed'
      || run.event !== 'pull_request' || !Object.hasOwn(steps, run.path)
      || !Number.isSafeInteger(run.id) || !Number.isSafeInteger(run.run_attempt)) return false;
  // A fork head is valid: the workflow itself must belong to the base repository.
  // Inspect the exact attempt, including failed runs with a successful tag step.
  const jobs = await github.paginate(github.rest.actions.listJobsForWorkflowRunAttempt, {
    owner, repo, run_id: run.id, attempt_number: run.run_attempt, per_page: 100,
  });
  return jobs.some(job => job.steps?.some(step => step.name === steps[run.path] && step.conclusion === 'success'));
}

module.exports = { shouldNotify };
