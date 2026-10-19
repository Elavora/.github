'use strict';

// Título e corpo das GitHub Releases. Especificação: docs/notas-de-release.md
// Funções puras: sem rede, disco ou variáveis de ambiente, e sem alterar os objetos recebidos.

const { parseTag } = require('./release-version.cjs');

const RELEASE_NOTES_HEADING = '## Notas de release';
const ATTRIBUTION_PREFIX = '🤖 Generated with';
const MAX_BODY_LENGTH = 125000;

const GROUPS = Object.freeze([
  Object.freeze({ title: 'Quebra de compatibilidade', labels: Object.freeze(['upgrade']) }),
  Object.freeze({ title: 'Novidades', labels: Object.freeze(['feature', 'enhancement']) }),
  Object.freeze({ title: 'Melhorias', labels: Object.freeze(['improvement']) }),
  Object.freeze({ title: 'Correções', labels: Object.freeze(['bug']) }),
  Object.freeze({ title: 'Outras mudanças', labels: Object.freeze([]) }),
]);

const REPOSITORY_PATTERN = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/;
const CONVENTIONAL_PREFIX = /^[A-Za-z]+(\([^)]*\))?!?:\s+/;

const BUMP_TEXT = {
  major: 'major (quebra de compatibilidade)',
  minor: 'minor (novidades compatíveis)',
  patch: 'patch (correções e ajustes)',
};

const BETAS_TAIL = 'Cada item mostra a beta em que entrou; os itens sem beta são novos nesta versão.';

const isStringArray = (value) => Array.isArray(value) && value.every((item) => typeof item === 'string');
const isOptionalString = (value) => value === undefined || value === null || typeof value === 'string';
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function assertRepository(repository) {
  if (typeof repository !== 'string' || !REPOSITORY_PATTERN.test(repository)) {
    throw new TypeError('repository precisa ser "owner/repo"');
  }
}

// Tag do formato novo (X.Y.Z ou X.Y.Z-beta.N), nunca a legada vX.Y.Z.
function parseNewTag(tag, what = 'tag') {
  const parsed = parseTag(tag);
  if (!parsed || parsed.legacy) throw new TypeError(`${what} precisa ser X.Y.Z ou X.Y.Z-beta.N`);
  return parsed;
}

function assertLabels(labels) {
  if (!isStringArray(labels)) throw new TypeError('labels precisa ser um array de strings');
}

const compareBase = (a, b) => a.major - b.major || a.minor - b.minor || a.patch - b.patch;
const compareVersion = (a, b) => compareBase(a, b) || (a.beta ?? Infinity) - (b.beta ?? Infinity);
const baseOf = (t) => `${t.major}.${t.minor}.${t.patch}`;

function releaseTitle({ repository, tag } = {}) {
  assertRepository(repository);
  parseNewTag(tag);
  return `${repository} ${tag}`;
}

// Título de nível 1 ou 2, ou a linha de atribuição dos agentes (regra 4 da doc).
function endsSection(line) {
  if (line.startsWith('# ') || line.startsWith('## ')) return true;
  return line.trim().startsWith(ATTRIBUTION_PREFIX);
}

function extractReleaseNotes(body) {
  if (typeof body !== 'string') return null;
  const text = body.replace(/\r\n/g, '\n').replace(/<!--[\s\S]*?-->/g, '');
  const lines = text.split('\n');
  const marker = RELEASE_NOTES_HEADING.toLowerCase();
  const start = lines.findIndex((line) => line.trimEnd().toLowerCase() === marker);
  if (start === -1) return null;
  const section = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (endsSection(lines[i])) break;
    section.push(lines[i].trimEnd());
  }
  const kept = section.filter((line) => line !== '');
  return kept.length ? kept.join('\n') : null;
}

function groupOf(labels) {
  assertLabels(labels);
  const lower = labels.map((label) => label.toLowerCase());
  const group = GROUPS.find((g) => g.labels.some((label) => lower.includes(label)));
  return (group ?? GROUPS[GROUPS.length - 1]).title;
}

function assignIntroducedIn({ pulls, betas } = {}) {
  if (!Array.isArray(pulls)) throw new TypeError('pulls precisa ser um array');
  if (!Array.isArray(betas)) throw new TypeError('betas precisa ser um array');
  for (const pull of pulls) {
    if (!isObject(pull) || !isStringArray(pull.commits)) {
      throw new TypeError('cada PR precisa ter commits como array de strings');
    }
  }
  const sorted = betas.map((beta) => {
    if (!isObject(beta) || !isStringArray(beta.commits)) {
      throw new TypeError('cada beta precisa ter commits como array de strings');
    }
    const parsed = parseNewTag(beta.tag, 'a tag da beta');
    if (parsed.beta === null) throw new TypeError('a tag da beta precisa ser X.Y.Z-beta.N');
    return { tag: beta.tag, parsed, commits: new Set(beta.commits) };
  }).sort((a, b) => compareVersion(a.parsed, b.parsed));

  return pulls.map((pull) => {
    const beta = sorted.find((b) => pull.commits.some((sha) => b.commits.has(sha)));
    return { ...pull, introducedIn: beta ? beta.tag : null };
  });
}

function assertPull(pull) {
  if (!isObject(pull)) throw new TypeError('cada PR precisa ser um objeto');
  if (!Number.isInteger(pull.number) || pull.number <= 0) throw new TypeError('number do PR precisa ser inteiro maior que 0');
  if (typeof pull.title !== 'string') throw new TypeError('title do PR precisa ser string');
  if (typeof pull.url !== 'string') throw new TypeError('url do PR precisa ser string');
  assertLabels(pull.labels);
  if (!isOptionalString(pull.author)) throw new TypeError('author do PR precisa ser string ou null');
  if (!isOptionalString(pull.body)) throw new TypeError('body do PR precisa ser string ou null');
  if (!isOptionalString(pull.introducedIn)) throw new TypeError('introducedIn do PR precisa ser string ou null');
}

function authorLink(login) {
  if (login.endsWith('[bot]')) {
    const name = login.slice(0, -'[bot]'.length);
    return { name, link: `[${name}](https://github.com/apps/${name})` };
  }
  return { name: login, link: `[${login}](https://github.com/${login})` };
}

function cleanTitle(title) {
  const stripped = title.replace(CONVENTIONAL_PREFIX, '');
  if (stripped.trim() === '') return title.trim();
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

function renderItem(pull, stable) {
  const notes = extractReleaseNotes(pull.body);
  let first;
  let rest = [];
  if (notes) {
    [first, ...rest] = notes.split('\n');
    if (first.startsWith('- ') || first.startsWith('* ')) first = first.slice(2);
  } else {
    first = cleanTitle(pull.title);
  }
  let line = `- ${first} ([#${pull.number}](${pull.url}))`;
  if (pull.author) line += ` por ${authorLink(pull.author).link}`;
  if (stable && pull.introducedIn) line += ` · entrou na \`${pull.introducedIn}\``;
  return [line, ...rest.map((l) => `  ${l}`)].join('\n');
}

function joinPt(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

function sortTags(names) {
  const known = [];
  const unknown = [];
  for (const name of names) {
    const parsed = parseTag(name);
    if (parsed) known.push({ name, parsed });
    else unknown.push(name);
  }
  known.sort((a, b) => compareVersion(a.parsed, b.parsed));
  return [...known.map((k) => k.name), ...unknown];
}

function renderReleaseNotes({
  repository, tag, previousTag, previousStable, pulls, betas = [],
} = {}) {
  assertRepository(repository);
  const current = parseNewTag(tag);
  if (!isOptionalString(previousTag)) throw new TypeError('previousTag precisa ser string ou null');
  if (!isOptionalString(previousStable)) throw new TypeError('previousStable precisa ser string ou null');
  if (!Array.isArray(pulls)) throw new TypeError('pulls precisa ser um array');
  pulls.forEach(assertPull);
  if (!isStringArray(betas)) throw new TypeError('betas precisa ser um array de strings');
  for (const name of betas) {
    if (parseNewTag(name, 'cada beta').beta === null) throw new TypeError('cada beta precisa ser X.Y.Z-beta.N');
  }

  const stable = current.beta === null;
  const start = previousTag || null;
  const stableName = previousStable || null;
  // Vazia, não reconhecida ou beta: conta como "sem estável anterior".
  const parsedStable = stableName ? parseTag(stableName) : null;
  const prev = parsedStable && parsedStable.beta === null ? parsedStable : null;

  // Resumo e linha "desde".
  let jump = null;
  if (prev) {
    if (compareBase(current, prev) <= 0) jump = 'patch';
    else if (current.major !== prev.major) jump = 'major';
    else if (current.minor !== prev.minor) jump = 'minor';
    else jump = 'patch';
  }
  const head = [];
  if (stable) {
    head.push(jump ? `Versão estável **${tag}**, com salto ${BUMP_TEXT[jump]}.` : `Versão estável **${tag}**.`);
    if (betas.length) {
      const list = sortTags(betas).map((b) => `\`${b}\``);
      head.push(`${list.length === 1 ? 'Reúne a beta' : 'Reúne as betas'} ${joinPt(list)}. ${BETAS_TAIL}`);
    }
  } else {
    const base = baseOf(current);
    head.push(jump
      ? `Pré-release **${tag}** da \`${base}\`, com salto ${BUMP_TEXT[jump]} em relação à última estável.`
      : `Pré-release **${tag}** da \`${base}\`.`);
  }
  head.push('## O que há de novo');
  if (stable) {
    head.push(prev
      ? `Mudanças desde a versão estável \`${stableName}\`.`
      : 'Primeira versão estável; mudanças desde o início do projeto.');
  } else {
    const since = start ? `Mudanças desde \`${start}\`.` : 'Mudanças desde o início do projeto.';
    const last = prev ? `Última versão estável: \`${stableName}\`.` : 'Ainda não há versão estável.';
    head.push(`${since} ${last}`);
  }

  // PRs sem repetir número (vale a primeira ocorrência), agrupados e em ordem crescente.
  const unique = [];
  const seen = new Set();
  for (const pull of pulls) {
    if (seen.has(pull.number)) continue;
    seen.add(pull.number);
    unique.push(pull);
  }
  const flat = [];
  for (const group of GROUPS) {
    unique
      .filter((pull) => groupOf(pull.labels) === group.title)
      .sort((a, b) => a.number - b.number)
      .forEach((pull) => flat.push({ group: group.title, text: renderItem(pull, stable) }));
  }

  // Contribuidores: todos os autores, inclusive dos itens cortados.
  const authors = new Map();
  for (const pull of unique) {
    if (!pull.author) continue;
    const key = pull.author.toLowerCase();
    if (!authors.has(key)) authors.set(key, authorLink(pull.author));
  }
  const contributors = [...authors.values()].sort((a, b) => {
    const x = a.name.toLowerCase();
    const y = b.name.toLowerCase();
    if (x < y) return -1;
    return x > y ? 1 : 0;
  });

  const tail = [];
  if (contributors.length) tail.push('## Contribuidores', contributors.map((c) => `- ${c.link}`).join('\n'));
  const previous = stable ? (prev && stableName) : start;
  tail.push(previous
    ? `**Comparação completa:** [\`${previous}...${tag}\`](https://github.com/${repository}/compare/${previous}...${tag})`
    : `**Histórico completo:** [commits até \`${tag}\`](https://github.com/${repository}/commits/${tag})`);

  const build = (removed) => {
    const kept = flat.slice(0, flat.length - removed);
    const blocks = [...head];
    if (!flat.length) blocks.push('Nenhum pull request encontrado neste intervalo.');
    for (const group of GROUPS) {
      const items = kept.filter((k) => k.group === group.title).map((k) => k.text);
      if (items.length) blocks.push(`### ${group.title}`, items.join('\n'));
    }
    if (removed) blocks.push(`_E mais ${removed} pull requests que não couberam aqui. Veja a lista completa na comparação._`);
    return `${[...blocks, ...tail].join('\n\n')}\n`;
  };

  const body = build(0);
  if (body.length <= MAX_BODY_LENGTH || !flat.length) return body;

  // A partir de 1 item retirado, o tamanho só diminui: busca binária pelo menor corte que cabe.
  let low = 1;
  let high = flat.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (build(mid).length <= MAX_BODY_LENGTH) high = mid;
    else low = mid + 1;
  }
  return build(low);
}

module.exports = {
  RELEASE_NOTES_HEADING,
  MAX_BODY_LENGTH,
  GROUPS,
  releaseTitle,
  extractReleaseNotes,
  groupOf,
  assignIntroducedIn,
  renderReleaseNotes,
};
