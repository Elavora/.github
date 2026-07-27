'use strict';

const TAG_PATTERN = /^v(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$/;

function parseTag(tag) {
  const match = tag.name.match(TAG_PATTERN);
  if (match === null) {
    return null;
  }

  return {
    name: tag.name,
    sha: tag.sha,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    rc: match[4] === undefined ? null : Number(match[4]),
  };
}

function compare(left, right) {
  return left.major - right.major
    || left.minor - right.minor
    || left.patch - right.patch
    || (left.rc ?? Number.MAX_SAFE_INTEGER) - (right.rc ?? Number.MAX_SAFE_INTEGER);
}

function isAfter(tag, version) {
  return tag.major > version.major
    || (tag.major === version.major && tag.minor > version.minor)
    || (
      tag.major === version.major
      && tag.minor === version.minor
      && tag.patch > version.patch
    );
}

function selectReleaseTag(tags, mergeSha, labels) {
  const parsed = tags.map(parseTag).filter(Boolean);
  const existing = parsed.find(({ sha }) => sha === mergeSha);
  if (existing !== undefined) {
    return existing;
  }

  const stable = parsed.filter(({ rc }) => rc === null).sort(compare).at(-1) ?? {
    major: 0,
    minor: 0,
    patch: 0,
  };
  const publishStable = labels.includes('release');
  const prereleases = parsed
    .filter(({ rc }) => rc !== null)
    .filter((tag) => isAfter(tag, stable))
    .sort(compare);
  let target = { major: stable.major, minor: stable.minor, patch: stable.patch };

  if (publishStable && prereleases.length > 0) {
    const candidate = prereleases.at(-1);
    target = {
      major: candidate.major,
      minor: candidate.minor,
      patch: candidate.patch,
    };
  } else if (labels.includes('upgrade') || labels.includes('major')) {
    target = { major: stable.major + 1, minor: 0, patch: 0 };
  } else if (
    labels.includes('enhancement')
    || labels.includes('dependencies')
    || labels.includes('minor')
  ) {
    target = { major: stable.major, minor: stable.minor + 1, patch: 0 };
  } else {
    target.patch++;
  }

  let rc = null;
  if (!publishStable) {
    const previousRc = parsed
      .filter((tag) =>
        tag.major === target.major
        && tag.minor === target.minor
        && tag.patch === target.patch
        && tag.rc !== null
      )
      .sort(compare)
      .at(-1);
    rc = (previousRc?.rc ?? 0) + 1;
  }

  const base = `v${target.major}.${target.minor}.${target.patch}`;

  return {
    ...target,
    rc,
    name: rc === null ? base : `${base}-rc.${rc}`,
    sha: mergeSha,
  };
}

module.exports = { selectReleaseTag };
