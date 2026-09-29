'use strict';

const { setTimeout: delay } = require('node:timers/promises');

function credentials(webhookUrl) {
  let url;
  try { url = new URL(webhookUrl); } catch {
    throw new Error('Configure o secret PACKAGIST_WEBHOOK_URL com o endpoint de atualizacao do Packagist.');
  }
  if (url.origin !== 'https://packagist.org' || url.pathname !== '/api/update-package'
      || url.username || url.password || url.hash
      || !url.searchParams.get('username') || !url.searchParams.get('apiToken')) {
    throw new Error('PACKAGIST_WEBHOOK_URL deve usar https://packagist.org/api/update-package com username e apiToken.');
  }
  return `${url.searchParams.get('username')}:${url.searchParams.get('apiToken')}`;
}

async function notifyPackagist({ repository, webhookUrl, fetchImpl = fetch, sleep = delay }) {
  if (!/^Elavora\/api-[a-z0-9-]+$/.test(repository)) {
    throw new Error('Repositorio consumidor invalido: esperado um pacote Elavora/api-*.');
  }
  const authorization = credentials(webhookUrl);
  for (let attempt = 1; attempt <= 4; attempt++) {
    let response;
    try {
      response = await fetchImpl('https://packagist.org/api/update-package', {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(30_000),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authorization}`,
        },
        body: JSON.stringify({ repository: `https://github.com/${repository}` }),
      });
    } catch {
      if (attempt === 4) throw new Error('Falha de rede/timeout ao notificar Packagist apos 4 tentativas.');
      await sleep(1000 * 2 ** (attempt - 1));
      continue;
    }
    if (!response.ok) {
      if (attempt < 4 && (response.status === 429 || response.status >= 500)) {
        await response.body?.cancel();
        await sleep(1000 * 2 ** (attempt - 1));
        continue;
      }
      throw new Error(`Packagist rejeitou a atualizacao (HTTP ${response.status}). Verifique o secret e o acesso ao pacote.`);
    }
    let result;
    try { result = await response.json(); } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Packagist retornou uma resposta JSON invalida.');
      }
      if (attempt === 4) throw new Error('Falha de rede/timeout ao ler resposta do Packagist apos 4 tentativas.');
      await sleep(1000 * 2 ** (attempt - 1));
      continue;
    }
    if (result?.status !== 'success') {
      throw new Error('Packagist nao confirmou a solicitacao de atualizacao.');
    }
    return { attempts: attempt };
  }
}

module.exports = { credentials, notifyPackagist };
