'use strict';

// Notificação ao Packagist. Especificação: docs/release.md, seção "Notificação ao Packagist".
// Nenhuma mensagem de erro inclui a URL do secret, o token ou o corpo da resposta.

const ENDPOINT = 'https://packagist.org/api/update-package';
const REPOSITORY_PATTERN = /^Elavora\/(api-[a-z0-9-]+|code-standards)$/;
const MAX_ATTEMPTS = 4;
const TIMEOUT_MS = 30000;

const invalidSecret = (motivo) => new Error(`PACKAGIST_WEBHOOK_URL inválido: ${motivo}`);

function credentials(webhookUrl) {
  if (typeof webhookUrl !== 'string' || webhookUrl === '') throw invalidSecret('ausente ou vazio');
  let url;
  try {
    url = new URL(webhookUrl);
  } catch {
    throw invalidSecret('não é uma URL');
  }
  if (url.protocol !== 'https:' || url.hostname !== 'packagist.org' || url.port !== '') {
    throw invalidSecret('precisa usar https e o host packagist.org');
  }
  if (url.pathname !== '/api/update-package') throw invalidSecret('o caminho precisa ser /api/update-package');
  if (url.username !== '' || url.password !== '') throw invalidSecret('não pode ter usuário ou senha embutidos');
  if (url.hash !== '' || webhookUrl.includes('#')) throw invalidSecret('não pode ter fragmento');
  const username = url.searchParams.get('username');
  const apiToken = url.searchParams.get('apiToken');
  if (!username || !apiToken) throw invalidSecret('precisa ter username e apiToken preenchidos');
  return `${username}:${apiToken}`;
}

const defaultSleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

class Transient extends Error {}

async function attempt({ repository, auth, fetchImpl }) {
  let response;
  try {
    response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ repository: `https://github.com/${repository}` }),
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const kind = error && error.name === 'TimeoutError' ? 'timeout' : 'falha de rede';
    throw new Transient(kind);
  }

  if (response.status === 429 || response.status >= 500) throw new Transient(`HTTP ${response.status}`);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Packagist recusou a atualização: HTTP ${response.status}`);
  }

  let text;
  try {
    text = await response.text();
  } catch {
    throw new Transient('falha de rede ao ler a resposta');
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Packagist devolveu uma resposta que não é JSON válido');
  }
  if (!data || data.status !== 'success') {
    throw new Error('Packagist não confirmou a atualização (status diferente de "success")');
  }
}

async function notifyPackagist({ repository, webhookUrl, fetchImpl = fetch, sleep = defaultSleep } = {}) {
  if (typeof repository !== 'string' || !REPOSITORY_PATTERN.test(repository)) {
    throw new Error('repositório inválido: esperado Elavora/api-<nome> ou Elavora/code-standards');
  }
  const auth = credentials(webhookUrl);

  let last = 'erro desconhecido';
  for (let attempts = 1; attempts <= MAX_ATTEMPTS; attempts += 1) {
    try {
      await attempt({ repository, auth, fetchImpl });
      return { attempts };
    } catch (error) {
      if (!(error instanceof Transient)) throw error;
      last = error.message;
    }
    if (attempts < MAX_ATTEMPTS) await sleep(1000 * 2 ** (attempts - 1));
  }
  throw new Error(`Packagist falhou após ${MAX_ATTEMPTS} tentativas (última: ${last})`);
}

module.exports = { credentials, notifyPackagist };
