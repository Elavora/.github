'use strict';

// Funções puras do workflow de qualidade PHP. Especificação: docs/qualidade.md

const MARKER = '<!-- elavora-quality -->';
const COMMIT_MESSAGE = 'style: organiza o código';
const BOT_LOGIN = 'github-actions[bot]';
const STATUS_LABELS = Object.freeze({ ok: 'ok', fixed: 'corrigido', warning: 'aviso', error: 'erro', skipped: 'pulado' });

const MAX_FILES = 20;
const NOT_INSTALLED = 'dependências não instaladas';
const NOT_ADOPTED = 'o repositório não adotou o elavora/code-standards';
const FALLBACK_SUFFIX = `; sem .php-cs-fixer.dist.php, usado @PER-CS puro (${NOT_ADOPTED})`;
const REASON_TEXT = { push: 'push na main', fork: 'PR de fork', dependabot: 'PR do Dependabot', evento: 'este evento' };

function formatMode({ eventName, headRepo, baseRepo, actor } = {}) {
  if (eventName === 'push') return { mode: 'report', reason: 'push' };
  if (eventName !== 'pull_request') return { mode: 'report', reason: 'evento' };
  if (!headRepo || String(headRepo).toLowerCase() !== String(baseRepo ?? '').toLowerCase()) {
    return { mode: 'report', reason: 'fork' };
  }
  if (actor === 'dependabot[bot]') return { mode: 'report', reason: 'dependabot' };
  return { mode: 'commit', reason: null };
}

function composerScripts(text) {
  if (text === null || text === undefined || text === '') return [];
  let json;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new Error(`composer.json inválido: ${err.message}`);
  }
  const scripts = json && json.scripts;
  if (scripts === null || typeof scripts !== 'object' || Array.isArray(scripts)) return [];
  return Object.keys(scripts);
}

function toLines(value) {
  const list = Array.isArray(value) ? value : String(value ?? '').split('\n');
  return list.filter((line) => line !== '');
}

function filesChangedByFormatter(before, after) {
  const previous = new Set(toLines(before));
  const result = [];
  for (const file of toLines(after)) {
    if (!previous.has(file) && !result.includes(file)) result.push(file);
  }
  return result;
}

function coveragePercent(cloverXml) {
  if (typeof cloverXml !== 'string' || cloverXml === '') return null;
  const end = cloverXml.lastIndexOf('</project>');
  if (end === -1) return null;
  const metrics = cloverXml.slice(0, end).match(/<metrics\b[^>]*>/g);
  if (!metrics) return null;
  const last = metrics[metrics.length - 1];
  const statements = last.match(/\sstatements="(\d+)"/);
  const covered = last.match(/\scoveredstatements="(\d+)"/);
  if (!statements || !covered) return null;
  const total = Number(statements[1]);
  if (total === 0) return 0;
  return (Number(covered[1]) / total) * 100;
}

// Uma casa decimal, truncada, com vírgula: 85.56 → "85,5", 80 → "80".
function formatPercent(value) {
  return String(Math.trunc(value * 10) / 10).replace('.', ',');
}

function notConcluded(result) {
  return { status: 'error', detail: `etapa não concluída (${result})` };
}

function installStage(install, dependencies) {
  if (install === 'success') {
    return {
      status: 'ok',
      detail: dependencies === 'install' ? 'dependências instaladas' : 'dependências mínimas instaladas (--prefer-lowest)',
    };
  }
  if (install === 'failure' || install === 'skipped') {
    return { status: 'error', detail: 'a instalação das dependências falhou; veja o log' };
  }
  return notConcluded(install);
}

function auditStage(installed, outcome) {
  if (!installed) return { status: 'skipped', detail: NOT_INSTALLED };
  if (outcome === 'success') return { status: 'ok', detail: 'nenhum problema encontrado' };
  if (outcome === 'failure') return { status: 'error', detail: 'o composer audit encontrou problemas; veja o log' };
  return notConcluded(outcome);
}

function formatStage({ mode, reason, config, exitCode, changedFiles, push } = {}) {
  const count = (changedFiles ?? []).length;
  let result;
  if (exitCode !== 0) {
    result = { status: 'error', detail: `o PHP-CS-Fixer falhou (código ${exitCode}); veja o log` };
  } else if (count === 0) {
    result = { status: 'ok', detail: 'o código já estava formatado' };
  } else if (mode === 'commit' && push === 'success') {
    result = { status: 'fixed', detail: `${count} arquivo(s) corrigido(s) no commit "${COMMIT_MESSAGE}"` };
  } else if (mode === 'commit') {
    result = { status: 'warning', detail: `${count} arquivo(s) precisam de formatação; o commit não pôde ser enviado (veja o log)` };
  } else {
    const motivo = REASON_TEXT[reason] ?? REASON_TEXT.evento;
    result = { status: 'warning', detail: `${count} arquivo(s) precisam de formatação; sem commit automático em ${motivo}` };
  }
  if (config === 'fallback') {
    result = {
      status: result.status === 'ok' || result.status === 'fixed' ? 'warning' : result.status,
      detail: `${result.detail}${FALLBACK_SUFFIX}`,
    };
  }
  return result;
}

function editorconfigStage({ present, outcome } = {}) {
  if (present === false) {
    return { status: 'warning', detail: `sem .editorconfig na raiz; conferência pulada (${NOT_ADOPTED})` };
  }
  if (outcome === 'success') return { status: 'ok', detail: 'sem problemas' };
  if (outcome === 'failure') return { status: 'error', detail: 'arquivos fora das regras do .editorconfig; veja o log' };
  return notConcluded(outcome);
}

function scriptStage(installed, scripts, script, result) {
  if (!installed) return { status: 'skipped', detail: NOT_INSTALLED };
  if (!scripts.includes(script)) return { status: 'skipped', detail: `sem o script "${script}" no composer.json` };
  if (result === 'success') return { status: 'ok', detail: 'sem problemas' };
  if (result === 'failure') return { status: 'error', detail: 'falhou; veja o log' };
  return notConcluded(result);
}

function testStage(installed, scripts, result) {
  if (!installed) return { status: 'skipped', detail: NOT_INSTALLED };
  if (!scripts.includes('test')) return { status: 'error', detail: 'sem o script "test" no composer.json' };
  if (result === 'success') return { status: 'ok', detail: 'testes passaram' };
  if (result === 'failure') return { status: 'error', detail: 'testes falharam; veja o log' };
  return notConcluded(result);
}

function coverageStage(testStatus, { min, percent }) {
  if (testStatus !== 'ok') return { status: 'skipped', detail: 'testes não passaram' };
  if (percent === null || percent === undefined) return { status: 'warning', detail: 'relatório de cobertura não encontrado' };
  if (percent >= min) return { status: 'ok', detail: `${formatPercent(percent)}% (mínimo ${formatPercent(min)}%)` };
  return { status: 'warning', detail: `${formatPercent(percent)}% abaixo do mínimo de ${formatPercent(min)}%` };
}

function buildStages(input) {
  const { install, dependencies = 'lowest', audit, format, editorconfig, lint, analyse, test, coverage } = input;
  const scripts = Array.isArray(input.scripts) ? input.scripts : [];
  const installed = install === 'success';
  const stages = [];
  const add = (id, name, result, extra = {}) => stages.push({ id, name, ...result, ...extra });

  add('install', 'Dependências (Composer)', installStage(install, dependencies));
  if (audit && audit.enabled === true) {
    add('audit', 'Auditoria (composer audit)', auditStage(installed, audit.outcome));
  }
  add('format', 'Formatação (PHP-CS-Fixer)', formatStage(format), { files: [...((format && format.changedFiles) ?? [])] });
  add('editorconfig', 'EditorConfig', editorconfigStage(editorconfig));
  add('lint', 'Lint (composer lint)', scriptStage(installed, scripts, 'lint', lint));
  add('analyse', 'PHPStan (composer analyse)', scriptStage(installed, scripts, 'analyse', analyse));
  const testResult = testStage(installed, scripts, test);
  add('test', 'Testes (composer test)', testResult);
  if (coverage && coverage.min > 0) {
    add('coverage', 'Cobertura', coverageStage(testResult.status, coverage));
  }
  return stages;
}

function overallStatus(stages) {
  return stages.some((s) => s.status === 'error') ? 'error' : 'ok';
}

function renderReport({ stages, sha, runUrl }) {
  const title = overallStatus(stages) === 'error' ? 'testes com erro' : 'testes rodaram ok';
  const lines = [MARKER, `## Qualidade: ${title}`, '', '| Etapa | Resultado | Detalhe |', '| --- | --- | --- |'];
  for (const s of stages) {
    lines.push(`| ${s.name} | ${STATUS_LABELS[s.status]} | ${String(s.detail).replace(/\|/g, '\\|')} |`);
  }

  const format = stages.find((s) => s.id === 'format');
  if (format && Array.isArray(format.files) && format.files.length > 0) {
    const files = format.files;
    const summary = format.status === 'fixed' ? 'Arquivos formatados' : 'Arquivos que precisam de formatação';
    lines.push('', `<details><summary>${summary} (${files.length})</summary>`, '');
    for (const file of files.slice(0, MAX_FILES)) lines.push(`- \`${file}\``);
    if (files.length > MAX_FILES) lines.push(`- e mais ${files.length - MAX_FILES} arquivo(s)`);
    lines.push('', '</details>');
  }

  lines.push('', `Commit \`${String(sha).slice(0, 7)}\` · [ver a execução](${runUrl})`, '');
  return lines.join('\n');
}

function findQualityComment(comments) {
  const found = (comments ?? []).find(
    (c) => c && c.user && c.user.login === BOT_LOGIN && typeof c.body === 'string' && c.body.startsWith(MARKER),
  );
  return found ? found.id : null;
}

module.exports = {
  MARKER,
  COMMIT_MESSAGE,
  BOT_LOGIN,
  STATUS_LABELS,
  formatMode,
  composerScripts,
  filesChangedByFormatter,
  coveragePercent,
  buildStages,
  overallStatus,
  renderReport,
  findQualityComment,
};
