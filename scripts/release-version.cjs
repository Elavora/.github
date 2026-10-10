'use strict';

const [rawTags = '', rawLabels = '[]'] = process.argv.slice(2);
const TAG_PATTERN = /^v(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$/;
const tags = rawTags.split(/\s+/).filter(Boolean).map((name) => {
  const match = TAG_PATTERN.exec(name);
  return match && {
    name, major: Number(match[1]), minor: Number(match[2]),
    patch: Number(match[3]), rc: match[4] === undefined ? null : Number(match[4]),
  };
}).filter(Boolean);
const labels = JSON.parse(rawLabels);
const compare = (a, b) => a.major - b.major || a.minor - b.minor || a.patch - b.patch
  || (a.rc ?? Number.MAX_SAFE_INTEGER) - (b.rc ?? Number.MAX_SAFE_INTEGER);
const stable = tags.filter((tag) => tag.rc === null).sort(compare).at(-1)
  ?? { major: 0, minor: 0, patch: 0 };
const publishStable = labels.includes('release');
const pending = tags.filter((tag) => tag.rc !== null
  && (tag.major > stable.major || (tag.major === stable.major && tag.minor > stable.minor)
    || (tag.major === stable.major && tag.minor === stable.minor && tag.patch > stable.patch)))
  .sort(compare);
let target;
if (publishStable && pending.length) {
  const last = pending.at(-1);
  target = { major: last.major, minor: last.minor, patch: last.patch, rc: null };
} else if (labels.includes('upgrade') || labels.includes('major')) {
  target = { major: stable.major + 1, minor: 0, patch: 0, rc: 1 };
} else if (labels.includes('enhancement') || labels.includes('dependencies') || labels.includes('minor')) {
  target = { major: stable.major, minor: stable.minor + 1, patch: 0, rc: 1 };
} else {
  target = { major: stable.major, minor: stable.minor, patch: stable.patch + 1, rc: 1 };
}
if (!publishStable) {
  const previous = tags.filter((tag) => tag.major === target.major && tag.minor === target.minor
    && tag.patch === target.patch && tag.rc !== null).sort(compare).at(-1);
  target.rc = (previous?.rc ?? 0) + 1;
}
const base = `v${target.major}.${target.minor}.${target.patch}`;
process.stdout.write(target.rc === null ? base : `${base}-rc.${target.rc}`);
