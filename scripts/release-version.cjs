'use strict';

// Cálculo da próxima versão. Especificação: docs/versionamento.md

// Única fonte do mapeamento label → incremento. Toda label fora daqui vale patch.
const BUMP_LABELS = Object.freeze({
  major: Object.freeze(['upgrade']),
  minor: Object.freeze(['enhancement', 'feature', 'improvement']),
});

const RELEASE_LABEL = 'release';
const NUM = '(0|[1-9]\\d*)';
const TAG_PATTERN = new RegExp(`^(v)?${NUM}\\.${NUM}\\.${NUM}(?:-beta\\.([1-9]\\d*))?$`);

function parseTag(name) {
  if (typeof name !== 'string') return null;
  const match = TAG_PATTERN.exec(name);
  if (!match) return null;
  const legacy = match[1] === 'v';
  const beta = match[5] === undefined ? null : Number(match[5]);
  // Pré-releases legadas (vX.Y.Z-rc.N ou vX.Y.Z-beta.N) não são reconhecidas.
  if (legacy && beta !== null) return null;
  return {
    name,
    major: Number(match[2]),
    minor: Number(match[3]),
    patch: Number(match[4]),
    beta,
    legacy,
  };
}

function assertLabels(labels) {
  if (!Array.isArray(labels) || !labels.every((label) => typeof label === 'string')) {
    throw new TypeError('labels precisa ser um array de strings');
  }
}

function bumpFromLabels(labels) {
  assertLabels(labels);
  const lower = labels.map((label) => label.toLowerCase());
  if (lower.some((label) => BUMP_LABELS.major.includes(label))) return 'major';
  if (lower.some((label) => BUMP_LABELS.minor.includes(label))) return 'minor';
  return 'patch';
}

// União das labels dos PRs do intervalo, sem repetir nomes sem diferenciar caixa.
// Fica a grafia da primeira ocorrência, na ordem dos PRs e das labels.
function aggregateLabels(pulls) {
  if (!Array.isArray(pulls)) throw new TypeError('pulls precisa ser um array de { number, labels }');
  const seen = new Set();
  const result = [];
  for (const pull of pulls) {
    if (pull === null || typeof pull !== 'object') {
      throw new TypeError('cada PR precisa ser um objeto { number, labels }');
    }
    assertLabels(pull.labels);
    for (const label of pull.labels) {
      const key = label.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(label);
      }
    }
  }
  return result;
}

function compareBase(a, b) {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

function applyBump(base, bump) {
  if (bump === 'major') return { major: base.major + 1, minor: 0, patch: 0 };
  if (bump === 'minor') return { major: base.major, minor: base.minor + 1, patch: 0 };
  return { major: base.major, minor: base.minor, patch: base.patch + 1 };
}

const formatBase = (v) => `${v.major}.${v.minor}.${v.patch}`;

function nextVersion({ tags = [], labels } = {}) {
  assertLabels(labels);
  const parsed = (Array.isArray(tags) ? tags : []).map(parseTag).filter(Boolean);

  // S: maior estável; com a mesma versão nas duas formas, prefere o nome sem prefixo.
  let stable = null;
  for (const tag of parsed.filter((t) => t.beta === null)) {
    const cmp = stable ? compareBase(tag, stable) : 1;
    if (cmp > 0 || (cmp === 0 && stable.legacy && !tag.legacy)) stable = tag;
  }
  const s = stable ?? { major: 0, minor: 0, patch: 0 };

  const betas = parsed.filter((t) => t.beta !== null);
  const pending = betas.filter((t) => compareBase(t, s) > 0);

  const bump = bumpFromLabels(labels);
  let base = applyBump(s, bump);
  for (const p of pending) {
    if (compareBase(p, base) > 0) base = { major: p.major, minor: p.minor, patch: p.patch };
  }

  const version = formatBase(base);
  const isRelease = labels.some((label) => label.toLowerCase() === RELEASE_LABEL);
  let tag = version;
  if (!isRelease) {
    const last = betas
      .filter((t) => compareBase(t, base) === 0)
      .reduce((max, t) => Math.max(max, t.beta), 0);
    tag = `${version}-beta.${last + 1}`;
  }

  return {
    tag,
    version,
    prerelease: !isRelease,
    bump,
    previous: stable ? stable.name : null,
  };
}

function main(argv) {
  const [rawTags = '', rawLabels] = argv;
  let labels = [];
  if (rawLabels !== undefined) {
    try {
      labels = JSON.parse(rawLabels);
    } catch {
      throw new TypeError('o segundo argumento precisa ser JSON válido (array de strings)');
    }
    assertLabels(labels);
  }
  const tags = rawTags.split(/\s+/).filter(Boolean);
  return nextVersion({ tags, labels });
}

if (require.main === module) {
  try {
    const result = main(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`release-version: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  BUMP_LABELS, parseTag, bumpFromLabels, aggregateLabels, nextVersion,
};
