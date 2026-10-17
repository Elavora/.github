'use strict';

// Versão da automação (automation_ref ou claim job_workflow_sha do OIDC). Especificação: docs/versao-da-automacao.md

const OIDC_UNAVAILABLE_MESSAGE =
  'não foi possível descobrir a versão do Elavora/.github: conceda "id-token: write" ao job chamador ou informe a entrada automation_ref (PRs de fork não recebem id-token)';

const WORKFLOW_REF_PREFIX = 'elavora/.github/';
const SHA_PATTERN = /^[0-9a-f]{40}$/;

// Nenhuma mensagem inclui o token.
function decodeJwtClaims(token) {
  if (typeof token !== 'string') throw new Error('token OIDC inválido: precisa ser uma string');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('token OIDC inválido: precisa ter três partes separadas por "."');

  let claims;
  try {
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    throw new Error('token OIDC inválido: o payload não é JSON');
  }
  if (claims === null || typeof claims !== 'object' || Array.isArray(claims)) {
    throw new Error('token OIDC inválido: o payload não é um objeto');
  }
  return claims;
}

function resolveAutomationRef({ input, oidcClaims } = {}) {
  if (typeof input === 'string' && input.trim() !== '') {
    return { ref: input.trim(), source: 'input' };
  }
  if (oidcClaims === null || oidcClaims === undefined) {
    throw new Error(OIDC_UNAVAILABLE_MESSAGE);
  }
  const workflowRef = oidcClaims.job_workflow_ref;
  if (typeof workflowRef !== 'string' || !workflowRef.toLowerCase().startsWith(WORKFLOW_REF_PREFIX)) {
    throw new Error('claim job_workflow_ref inválida: o workflow reutilizável precisa vir de Elavora/.github');
  }
  const sha = oidcClaims.job_workflow_sha;
  if (typeof sha !== 'string' || !SHA_PATTERN.test(sha)) {
    throw new Error('claim job_workflow_sha inválida: precisa ter 40 caracteres hexadecimais minúsculos');
  }
  return { ref: sha, source: 'oidc' };
}

module.exports = { OIDC_UNAVAILABLE_MESSAGE, decodeJwtClaims, resolveAutomationRef };
