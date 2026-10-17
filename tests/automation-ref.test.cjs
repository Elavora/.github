'use strict';

// Contrato: docs/versao-da-automacao.md, seção "Referência: scripts/automation-ref.cjs"
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'automation-ref.cjs');

let mod = null;
let loadError = null;
try {
  mod = require(SCRIPT);
} catch (err) {
  loadError = err;
}

function exported(name) {
  assert.ok(mod, `scripts/automation-ref.cjs não carregou: ${loadError && loadError.message}`);
  assert.ok(name in mod, `scripts/automation-ref.cjs precisa exportar ${name}`);
  return mod[name];
}

function fn(name) {
  const f = exported(name);
  assert.equal(typeof f, 'function', `${name} precisa ser uma função exportada`);
  return f;
}

const MESSAGE = 'não foi possível descobrir a versão do Elavora/.github: conceda "id-token: write" ao job chamador ou informe a entrada automation_ref (PRs de fork não recebem id-token)';
const SHA = '0123456789abcdef0123456789abcdef01234567';
const REF = 'Elavora/.github/.github/workflows/release.yml@refs/tags/1.1.0';

const b64url = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
const jwt = (payload) => `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url(payload)}.assinatura`;

function throwsWith(f, predicate) {
  assert.throws(f, (err) => {
    // Uma falha de asserção (por exemplo, função não exportada) não pode passar como o erro esperado.
    if (err instanceof assert.AssertionError) throw err;
    assert.ok(err instanceof Error, 'precisa lançar Error');
    predicate(err.message);
    return true;
  });
}

test.describe('OIDC_UNAVAILABLE_MESSAGE', () => {
  test('texto exato', () => {
    assert.equal(exported('OIDC_UNAVAILABLE_MESSAGE'), MESSAGE);
  });
});

test.describe('decodeJwtClaims', () => {
  test('exemplo da doc', () => {
    assert.deepEqual(fn('decodeJwtClaims')('x.eyJqb2Jfd29ya2Zsb3dfc2hhIjoiYWJjIn0.y'), { job_workflow_sha: 'abc' });
  });

  test('payload com as claims do GitHub', () => {
    const claims = { job_workflow_ref: REF, job_workflow_sha: SHA, repository: 'Elavora/api-framework', aud: 'https://github.com/Elavora' };
    assert.deepEqual(fn('decodeJwtClaims')(jwt(claims)), claims);
  });

  test('base64url com - e _ e sem preenchimento', () => {
    // Procura um payload cuja codificação tenha '-' ou '_' e cujo base64 padrão teria '='.
    let payload = null;
    for (let i = 0; i < 2000 && !payload; i++) {
      const p = { v: `~~?>${'ÿ'.repeat(i % 7)}${i}` };
      const enc = b64url(p);
      const std = Buffer.from(JSON.stringify(p)).toString('base64');
      if (/[-_]/.test(enc) && std.endsWith('=')) payload = p;
    }
    assert.ok(payload, 'não achou payload de teste');
    const token = jwt(payload);
    assert.ok(!token.includes('='));
    assert.deepEqual(fn('decodeJwtClaims')(token), payload);
  });

  test('token que não é string → token OIDC inválido', () => {
    const f = fn('decodeJwtClaims');
    for (const token of [undefined, null, 42, {}, ['a', 'b', 'c']]) {
      throwsWith(() => f(token), (m) => assert.match(m, /token OIDC inválido/));
    }
  });

  test('número de partes diferente de três → token OIDC inválido', () => {
    const f = fn('decodeJwtClaims');
    const p = b64url({ a: 1 });
    for (const token of ['', 'abc', `x.${p}`, `x.${p}.y.z`, `x.${p}.y.`]) {
      throwsWith(() => f(token), (m) => assert.match(m, /token OIDC inválido/));
    }
  });

  test('payload que não é JSON → token OIDC inválido', () => {
    const f = fn('decodeJwtClaims');
    throwsWith(() => f(`x.${b64url('não é json')}.y`), (m) => assert.match(m, /token OIDC inválido/));
    throwsWith(() => f('x..y'), (m) => assert.match(m, /token OIDC inválido/));
  });

  test('JSON que não é objeto → token OIDC inválido', () => {
    const f = fn('decodeJwtClaims');
    for (const raw of ['null', '[1,2]', '42', '"texto"', 'true']) {
      throwsWith(() => f(`x.${b64url(raw)}.y`), (m) => assert.match(m, /token OIDC inválido/, raw));
    }
  });

  test('a mensagem de erro não inclui o token', () => {
    const token = `cabecalhoSecreto.${b64url('{quebrado')}.assinaturaSecreta`;
    throwsWith(() => fn('decodeJwtClaims')(token), (m) => {
      assert.ok(!m.includes(token));
      assert.ok(!m.includes('cabecalhoSecreto'));
      assert.ok(!m.includes('assinaturaSecreta'));
    });
  });
});

test.describe('resolveAutomationRef', () => {
  const claims = (over = {}) => ({ job_workflow_ref: REF, job_workflow_sha: SHA, ...over });

  test('exemplo: input com espaços', () => {
    assert.deepEqual(fn('resolveAutomationRef')({ input: ' 1.0.0 ', oidcClaims: null }), { ref: '1.0.0', source: 'input' });
  });

  test('exemplo: input vazio usa o OIDC', () => {
    assert.deepEqual(fn('resolveAutomationRef')({ input: '', oidcClaims: claims() }), { ref: SHA, source: 'oidc' });
  });

  test('exemplo: sem input e sem claims → OIDC_UNAVAILABLE_MESSAGE', () => {
    throwsWith(() => fn('resolveAutomationRef')({ input: undefined, oidcClaims: undefined }), (m) => assert.equal(m, MESSAGE));
  });

  test('exemplo: job_workflow_ref de outro repositório', () => {
    throwsWith(
      () => fn('resolveAutomationRef')({ input: '', oidcClaims: claims({ job_workflow_ref: 'fulano/.github/.github/workflows/release.yml@refs/heads/main' }) }),
      (m) => { assert.match(m, /job_workflow_ref/); assert.ok(m.includes('Elavora/.github')); },
    );
  });

  test('input preenchido não olha as claims, mesmo inválidas', () => {
    const f = fn('resolveAutomationRef');
    assert.deepEqual(f({ input: '1.1.0', oidcClaims: { job_workflow_ref: 'fulano/x', job_workflow_sha: 'xyz' } }), { ref: '1.1.0', source: 'input' });
    assert.deepEqual(f({ input: SHA, oidcClaims: undefined }), { ref: SHA, source: 'input' });
  });

  test('input não é validado além do trim', () => {
    const f = fn('resolveAutomationRef');
    assert.deepEqual(f({ input: 'main', oidcClaims: null }), { ref: 'main', source: 'input' });
    assert.deepEqual(f({ input: '1.2.0-beta.1\n', oidcClaims: null }), { ref: '1.2.0-beta.1', source: 'input' });
    assert.deepEqual(f({ input: 'ABCDEF', oidcClaims: null }), { ref: 'ABCDEF', source: 'input' });
  });

  test('input só com espaços conta como vazio', () => {
    const f = fn('resolveAutomationRef');
    assert.deepEqual(f({ input: '   \t ', oidcClaims: claims() }), { ref: SHA, source: 'oidc' });
    throwsWith(() => f({ input: '  ', oidcClaims: null }), (m) => assert.equal(m, MESSAGE));
  });

  test('input que não é string conta como ausente', () => {
    const f = fn('resolveAutomationRef');
    assert.deepEqual(f({ input: null, oidcClaims: claims() }), { ref: SHA, source: 'oidc' });
    assert.deepEqual(f({ input: 110, oidcClaims: claims() }), { ref: SHA, source: 'oidc' });
    assert.deepEqual(f({ oidcClaims: claims() }), { ref: SHA, source: 'oidc' });
  });

  test('oidcClaims null → OIDC_UNAVAILABLE_MESSAGE', () => {
    throwsWith(() => fn('resolveAutomationRef')({ input: '', oidcClaims: null }), (m) => assert.equal(m, exported('OIDC_UNAVAILABLE_MESSAGE')));
  });

  test('job_workflow_ref sem diferenciar caixa', () => {
    const f = fn('resolveAutomationRef');
    assert.deepEqual(
      f({ input: '', oidcClaims: claims({ job_workflow_ref: 'elavora/.GITHUB/.github/workflows/php-quality.yml@refs/tags/1.1.0' }) }),
      { ref: SHA, source: 'oidc' },
    );
  });

  test('job_workflow_ref inválido', () => {
    const f = fn('resolveAutomationRef');
    const invalid = [
      undefined,
      null,
      42,
      '',
      'Elavora/.github',
      'Elavora/.github-fork/.github/workflows/release.yml@refs/heads/main',
      'Elavora/api-framework/.github/workflows/quality.yml@refs/heads/main',
      'x/Elavora/.github/.github/workflows/release.yml@refs/tags/1.1.0',
    ];
    for (const job_workflow_ref of invalid) {
      throwsWith(
        () => f({ input: '', oidcClaims: claims({ job_workflow_ref }) }),
        (m) => { assert.match(m, /job_workflow_ref/, String(job_workflow_ref)); assert.ok(m.includes('Elavora/.github')); },
      );
    }
  });

  test('job_workflow_ref ausente', () => {
    throwsWith(
      () => fn('resolveAutomationRef')({ input: '', oidcClaims: { job_workflow_sha: SHA } }),
      (m) => assert.match(m, /job_workflow_ref/),
    );
  });

  test('ordem: job_workflow_ref é conferido antes de job_workflow_sha', () => {
    throwsWith(
      () => fn('resolveAutomationRef')({ input: '', oidcClaims: { job_workflow_ref: 'fulano/x', job_workflow_sha: 'xyz' } }),
      (m) => assert.match(m, /job_workflow_ref/),
    );
  });

  test('job_workflow_sha inválido', () => {
    const f = fn('resolveAutomationRef');
    const invalid = [
      undefined,
      null,
      '',
      SHA.slice(0, 39),
      `${SHA}0`,
      SHA.toUpperCase(),
      `${SHA.slice(0, 39)}g`,
      ` ${SHA.slice(0, 39)}`,
      '1.1.0',
      123,
    ];
    for (const job_workflow_sha of invalid) {
      throwsWith(
        () => f({ input: '', oidcClaims: claims({ job_workflow_sha }) }),
        (m) => assert.match(m, /job_workflow_sha/, String(job_workflow_sha)),
      );
    }
  });

  test('integra com decodeJwtClaims', () => {
    const oidcClaims = fn('decodeJwtClaims')(jwt({ job_workflow_ref: REF, job_workflow_sha: SHA }));
    assert.deepEqual(fn('resolveAutomationRef')({ input: '', oidcClaims }), { ref: SHA, source: 'oidc' });
  });
});
