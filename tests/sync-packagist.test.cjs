'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { credentials, notifyPackagist } = require('../scripts/sync-packagist.cjs');
const secret = 'https://packagist.org/api/update-package?username=maintainer&apiToken=test-token';
const options = { repository: 'Elavora/api-framework', webhookUrl: secret, sleep: async () => {} };
const success = () => new Response(JSON.stringify({ status: 'success', jobs: ['job'] }), { status: 200 });

// Official API contract: https://packagist.org/apidoc#update-a-package (repository is a string).
test('uses canonical repository and header authentication without leaking credentials into URL', async () => {
  const result = await notifyPackagist({ ...options, fetchImpl: async (url, request) => {
    assert.equal(url, 'https://packagist.org/api/update-package');
    assert.equal(request.headers.Authorization, 'Bearer maintainer:test-token');
    assert.equal(request.method, 'POST');
    assert.equal(request.redirect, 'error');
    assert.ok(request.signal instanceof AbortSignal);
    assert.deepEqual(JSON.parse(request.body), { repository: 'https://github.com/Elavora/api-framework' });
    return success();
  }});
  assert.equal(result.attempts, 1);
});

for (const value of [undefined, '', 'invalid', 'http://packagist.org/api/update-package?username=a&apiToken=b',
  'https://example.com/api/update-package?username=a&apiToken=b',
  'https://packagist.org/api/github?username=a&apiToken=b',
  'https://packagist.org/api/update-package?username=a',
  'https://packagist.org/api/update-package?username=a&apiToken=b#fragment']) {
  test(`rejects invalid/missing secret (${String(value).split('?')[0]})`, () => {
    assert.throws(() => credentials(value), /PACKAGIST_WEBHOOK_URL/);
  });
}

for (const status of [400, 401, 403, 404, 302]) {
  test(`HTTP ${status} fails without hiding errors or exposing response`, async () => {
    let calls = 0;
    await assert.rejects(notifyPackagist({ ...options, fetchImpl: async () => {
      calls++; return new Response(secret, { status });
    }}), error => error.message.includes(`HTTP ${status}`) && !error.message.includes('test-token'));
    assert.equal(calls, 1);
  });
}

for (const status of [429, 500, 502, 503]) {
  test(`retries HTTP ${status} and accepts subsequent success`, async () => {
    let calls = 0;
    const waits = [];
    const result = await notifyPackagist({ ...options, sleep: async ms => waits.push(ms), fetchImpl: async () => {
      return ++calls < 3 ? new Response('', { status }) : success();
    }});
    assert.equal(result.attempts, 3);
    assert.deepEqual(waits, [1000, 2000]);
  });
}

test('stops after four failed requests', async () => {
  let calls = 0;
  await assert.rejects(notifyPackagist({ ...options, fetchImpl: async () => {
    calls++; return new Response('', { status: 503 });
  }}), /HTTP 503/);
  assert.equal(calls, 4);
});

test('network errors are retried without exposing secret-bearing exceptions', async () => {
  let calls = 0;
  await assert.rejects(notifyPackagist({ ...options, fetchImpl: async () => {
    calls++; throw new Error(secret);
  }}), error => /4 tentativas/.test(error.message) && !error.message.includes('test-token'));
  assert.equal(calls, 4);
});

test('a network failure followed by success is recoverable', async () => {
  let calls = 0;
  const result = await notifyPackagist({ ...options, fetchImpl: async () => {
    if (++calls === 1) throw new Error('timeout');
    return success();
  }});
  assert.equal(result.attempts, 2);
});

for (const payload of ['not json', '{"status":"error"}', 'null']) {
  test(`rejects unconfirmed HTTP 200 response: ${payload}`, async () => {
    await assert.rejects(notifyPackagist({ ...options, fetchImpl: async () => new Response(payload) }));
  });
}

test('rejects a repository outside the package organization', async () => {
  await assert.rejects(notifyPackagist({ ...options, repository: 'Other/package' }), /Repositorio consumidor invalido/);
});

test('repeated notifications target the same package without creating versions', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return success(); };
  await notifyPackagist({ ...options, fetchImpl });
  await notifyPackagist({ ...options, fetchImpl });
  assert.equal(calls, 2);
});

for (const error of [new TypeError('connection reset'), new DOMException('timeout', 'TimeoutError')]) {
  test(`retries failures consuming response body: ${error.name}`, async () => {
    let calls = 0;
    const result = await notifyPackagist({ ...options, fetchImpl: async () => {
      return ++calls === 1 ? { ok: true, json: async () => { throw error; } } : success();
    }});
    assert.equal(result.attempts, 2);
  });
}
test('body failures exhaust the retry budget without leaking response data', async () => {
  let calls = 0;
  await assert.rejects(notifyPackagist({ ...options, fetchImpl: async () => {
    calls++; return { ok: true, json: async () => { throw new TypeError(secret); } };
  }}), error => /4 tentativas/.test(error.message) && !error.message.includes('test-token'));
  assert.equal(calls, 4);
});
test('malformed JSON is not treated as a retryable network failure', async () => {
  let calls = 0;
  await assert.rejects(notifyPackagist({ ...options, fetchImpl: async () => {
    calls++; return new Response('not json');
  }}), /JSON invalida/);
  assert.equal(calls, 1);
});
