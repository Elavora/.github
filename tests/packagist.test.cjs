'use strict';

// Contrato: docs/release.md, seção "Notificação ao Packagist"
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { credentials, notifyPackagist } = require(path.join(__dirname, '..', 'scripts', 'packagist.cjs'));

const USER = 'elavora-bot';
const TOKEN = 'tok3n-SECRETO-abc123';
const WEBHOOK = `https://packagist.org/api/update-package?username=${USER}&apiToken=${TOKEN}`;
const REPO = 'Elavora/api-framework';
const SEGREDO_CORPO = 'corpo-da-resposta-confidencial';

function resposta(status, corpo) {
  const texto = typeof corpo === 'string' ? corpo : JSON.stringify(corpo);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => texto,
    json: async () => JSON.parse(texto),
  };
}

function respostaCorpoQuebrado(status) {
  const erro = () => Promise.reject(new TypeError('network error while reading body'));
  return {
    ok: true, status, statusText: '', headers: new Headers(), text: erro, json: erro,
  };
}

const sucesso = () => resposta(200, { status: 'success' });

// fetch falso: cada item da fila é uma função que devolve a resposta ou lança.
function fakeFetch(fila) {
  const calls = [];
  const fn = async (url, options) => {
    calls.push({ url: String(url), options });
    const passo = fila[Math.min(calls.length - 1, fila.length - 1)];
    return passo();
  };
  fn.calls = calls;
  return fn;
}

function fakeSleep() {
  const waits = [];
  const fn = async (ms) => { waits.push(ms); };
  fn.waits = waits;
  return fn;
}

function assertSemSegredos(erro) {
  assert.ok(erro instanceof Error);
  for (const s of [TOKEN, WEBHOOK, 'apiToken=', SEGREDO_CORPO]) {
    assert.ok(!erro.message.includes(s), `mensagem não pode conter ${s}: ${erro.message}`);
  }
}

test.describe('credentials', () => {
  test('devolve username:apiToken', () => {
    assert.equal(credentials(WEBHOOK), `${USER}:${TOKEN}`);
  });

  const invalidos = [
    ['undefined', undefined],
    ['vazio', ''],
    ['não é URL', 'não é uma url'],
    ['http', `http://packagist.org/api/update-package?username=${USER}&apiToken=${TOKEN}`],
    ['outro host', `https://example.com/api/update-package?username=${USER}&apiToken=${TOKEN}`],
    ['subdomínio evil', `https://evil.packagist.org/api/update-package?username=${USER}&apiToken=${TOKEN}`],
    ['subdomínio www', `https://www.packagist.org/api/update-package?username=${USER}&apiToken=${TOKEN}`],
    ['host com sufixo', `https://packagist.org.evil.com/api/update-package?username=${USER}&apiToken=${TOKEN}`],
    ['outro caminho', `https://packagist.org/api/github?username=${USER}&apiToken=${TOKEN}`],
    ['sem username', `https://packagist.org/api/update-package?apiToken=${TOKEN}`],
    ['sem apiToken', `https://packagist.org/api/update-package?username=${USER}`],
    ['username vazio', `https://packagist.org/api/update-package?username=&apiToken=${TOKEN}`],
    ['apiToken vazio', `https://packagist.org/api/update-package?username=${USER}&apiToken=`],
    ['usuário/senha embutidos', `https://u:p@packagist.org/api/update-package?username=${USER}&apiToken=${TOKEN}`],
    ['fragmento', `https://packagist.org/api/update-package?username=${USER}&apiToken=${TOKEN}#x`],
  ];
  for (const [nome, valor] of invalidos) {
    test(`rejeita ${nome}`, () => {
      assert.throws(() => credentials(valor), (e) => {
        assert.ok(e instanceof Error);
        assert.match(e.message, /PACKAGIST_WEBHOOK_URL/);
        return true;
      });
    });
  }
});

test.describe('notifyPackagist', () => {
  test('sucesso na primeira tentativa: requisição conforme o contrato', async () => {
    const fetchImpl = fakeFetch([sucesso]);
    const sleep = fakeSleep();
    const r = await notifyPackagist({ repository: REPO, webhookUrl: WEBHOOK, fetchImpl, sleep });
    assert.deepEqual(r, { attempts: 1 });
    assert.equal(fetchImpl.calls.length, 1);
    assert.deepEqual(sleep.waits, []);

    const { url, options } = fetchImpl.calls[0];
    assert.equal(url, 'https://packagist.org/api/update-package');
    assert.equal(String(options.method).toUpperCase(), 'POST');
    const headers = new Headers(options.headers);
    assert.equal(headers.get('authorization'), `Bearer ${USER}:${TOKEN}`);
    assert.match(headers.get('content-type'), /^application\/json/);
    assert.deepEqual(JSON.parse(options.body), { repository: `https://github.com/${REPO}` });
    assert.ok(!String(options.body).includes(TOKEN));
    assert.ok(!url.includes(TOKEN));
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal, 'precisa de signal com timeout');
  });

  test('cada tentativa recebe um signal próprio', async () => {
    const fetchImpl = fakeFetch([() => resposta(503, {}), sucesso]);
    await notifyPackagist({ repository: REPO, webhookUrl: WEBHOOK, fetchImpl, sleep: fakeSleep() });
    for (const c of fetchImpl.calls) assert.ok(c.options.signal instanceof AbortSignal);
  });

  for (const repository of [
    'Elavora/devcontainers',
    'Elavora/.github',
    'elavora/api-framework',
    'Outra/api-framework',
    'Elavora/api-Framework',
    'Elavora/api-',
    'Elavora/api-framework/x',
    'https://github.com/Elavora/api-framework',
    '',
    undefined,
  ]) {
    test(`repositório inválido ${JSON.stringify(repository)} falha antes de qualquer requisição`, async () => {
      const fetchImpl = fakeFetch([sucesso]);
      await assert.rejects(
        async () => notifyPackagist({ repository, webhookUrl: WEBHOOK, fetchImpl, sleep: fakeSleep() }),
        Error,
      );
      assert.equal(fetchImpl.calls.length, 0);
    });
  }

  for (const [nome, webhookUrl] of [
    ['ausente', undefined],
    ['vazio', ''],
    ['outro host', `https://example.com/api/update-package?username=${USER}&apiToken=${TOKEN}`],
    ['subdomínio', `https://www.packagist.org/api/update-package?username=${USER}&apiToken=${TOKEN}`],
    ['sem apiToken', `https://packagist.org/api/update-package?username=${USER}`],
  ]) {
    test(`secret ${nome}: rejeita com erro de credentials antes de qualquer fetch`, async () => {
      const fetchImpl = fakeFetch([sucesso]);
      await assert.rejects(
        async () => notifyPackagist({ repository: REPO, webhookUrl, fetchImpl, sleep: fakeSleep() }),
        (e) => {
          assert.ok(e instanceof Error);
          assert.match(e.message, /PACKAGIST_WEBHOOK_URL/);
          assert.ok(!e.message.includes(TOKEN));
          return true;
        },
      );
      assert.equal(fetchImpl.calls.length, 0);
    });
  }

  test('aceita nomes api-* com dígitos e hífens', async () => {
    const fetchImpl = fakeFetch([sucesso]);
    const r = await notifyPackagist({
      repository: 'Elavora/api-cache-redis2', webhookUrl: WEBHOOK, fetchImpl, sleep: fakeSleep(),
    });
    assert.deepEqual(r, { attempts: 1 });
  });

  const transitórios = [
    ['falha de rede', () => { throw new TypeError('fetch failed'); }],
    ['timeout', () => { throw new DOMException('The operation was aborted due to timeout', 'TimeoutError'); }],
    ['HTTP 429', () => resposta(429, { status: 'error' })],
    ['HTTP 500', () => resposta(500, SEGREDO_CORPO)],
    ['HTTP 502', () => resposta(502, SEGREDO_CORPO)],
    ['HTTP 503', () => resposta(503, {})],
    ['falha de rede ao ler o corpo', () => respostaCorpoQuebrado(200)],
  ];

  for (const [nome, falha] of transitórios) {
    test(`${nome}: tenta de novo e devolve o número da tentativa que deu certo`, async () => {
      const fetchImpl = fakeFetch([falha, falha, sucesso]);
      const sleep = fakeSleep();
      const r = await notifyPackagist({ repository: REPO, webhookUrl: WEBHOOK, fetchImpl, sleep });
      assert.deepEqual(r, { attempts: 3 });
      assert.equal(fetchImpl.calls.length, 3);
      assert.deepEqual(sleep.waits, [1000, 2000]);
    });

    test(`${nome}: esgota as 4 tentativas com espera de 1 s, 2 s e 4 s`, async () => {
      const fetchImpl = fakeFetch([falha]);
      const sleep = fakeSleep();
      await assert.rejects(
        notifyPackagist({ repository: REPO, webhookUrl: WEBHOOK, fetchImpl, sleep }),
        (e) => {
          assertSemSegredos(e);
          assert.match(e.message, /4 tentativas/);
          return true;
        },
      );
      assert.equal(fetchImpl.calls.length, 4);
      assert.deepEqual(sleep.waits, [1000, 2000, 4000]);
    });
  }

  test('sucesso na quarta tentativa', async () => {
    const f = () => resposta(500, {});
    const fetchImpl = fakeFetch([f, f, f, sucesso]);
    const sleep = fakeSleep();
    const r = await notifyPackagist({ repository: REPO, webhookUrl: WEBHOOK, fetchImpl, sleep });
    assert.deepEqual(r, { attempts: 4 });
    assert.deepEqual(sleep.waits, [1000, 2000, 4000]);
  });

  const definitivos = [
    ['HTTP 400', () => resposta(400, SEGREDO_CORPO), /HTTP 400/],
    ['HTTP 401', () => resposta(401, { status: 'error', message: SEGREDO_CORPO }), /HTTP 401/],
    ['HTTP 403', () => resposta(403, { status: 'error', message: SEGREDO_CORPO }), /HTTP 403/],
    ['HTTP 404', () => resposta(404, SEGREDO_CORPO), /HTTP 404/],
    ['JSON inválido', () => resposta(200, `<html>${SEGREDO_CORPO}</html>`), null],
    ['sem status success', () => resposta(200, { status: 'error', message: SEGREDO_CORPO }), null],
    ['corpo sem status', () => resposta(200, { ok: true }), null],
  ];

  for (const [nome, falha, padrao] of definitivos) {
    test(`${nome}: falha imediata, sem nova tentativa`, async () => {
      const fetchImpl = fakeFetch([falha, sucesso]);
      const sleep = fakeSleep();
      await assert.rejects(
        notifyPackagist({ repository: REPO, webhookUrl: WEBHOOK, fetchImpl, sleep }),
        (e) => {
          assertSemSegredos(e);
          if (padrao) assert.match(e.message, padrao);
          return true;
        },
      );
      assert.equal(fetchImpl.calls.length, 1);
      assert.deepEqual(sleep.waits, []);
    });
  }

  test('erro de rede com a URL na mensagem não vaza o secret', async () => {
    const fetchImpl = fakeFetch([() => { throw new TypeError(`fetch failed ${WEBHOOK}`); }]);
    await assert.rejects(
      notifyPackagist({ repository: REPO, webhookUrl: WEBHOOK, fetchImpl, sleep: fakeSleep() }),
      (e) => { assertSemSegredos(e); return true; },
    );
  });
});
