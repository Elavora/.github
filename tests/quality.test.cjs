'use strict';

// Contrato: docs/qualidade.md, seção "Referência: scripts/quality.cjs"
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'quality.cjs');

// Carregamento tardio: se o módulo ainda não existir, cada teste falha com uma mensagem clara,
// em vez de o arquivo inteiro quebrar no require.
let mod = null;
let loadError = null;
try {
  mod = require(SCRIPT);
} catch (err) {
  loadError = err;
}

function exported(name) {
  assert.ok(mod, `scripts/quality.cjs não carregou: ${loadError && loadError.message}`);
  assert.ok(name in mod, `scripts/quality.cjs precisa exportar ${name}`);
  return mod[name];
}

function fn(name) {
  const f = exported(name);
  assert.equal(typeof f, 'function', `${name} precisa ser uma função exportada`);
  return f;
}

const FALLBACK_SUFFIX =
  '; sem .php-cs-fixer.dist.php, usado @PER-CS puro (o repositório não adotou o elavora/code-standards)';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

test.describe('constantes exportadas', () => {
  test('MARKER', () => {
    assert.equal(exported('MARKER'), '<!-- elavora-quality -->');
  });

  test('COMMIT_MESSAGE', () => {
    assert.equal(exported('COMMIT_MESSAGE'), 'style: organiza o código');
  });

  test('BOT_LOGIN', () => {
    assert.equal(exported('BOT_LOGIN'), 'github-actions[bot]');
  });

  test('STATUS_LABELS', () => {
    assert.deepEqual({ ...exported('STATUS_LABELS') }, {
      ok: 'ok',
      fixed: 'corrigido',
      warning: 'aviso',
      error: 'erro',
      skipped: 'pulado',
    });
  });
});

// ---------------------------------------------------------------------------
// formatMode
// ---------------------------------------------------------------------------

test.describe('formatMode', () => {
  const PR = { eventName: 'pull_request', headRepo: 'Elavora/api-framework', baseRepo: 'Elavora/api-framework', actor: 'fulano' };

  test('PR da própria branch → commit', () => {
    assert.deepEqual(fn('formatMode')(PR), { mode: 'commit', reason: null });
  });

  test('exemplo da doc: compara repositórios sem diferenciar caixa', () => {
    assert.deepEqual(
      fn('formatMode')({ eventName: 'pull_request', headRepo: 'Elavora/api-framework', baseRepo: 'elavora/API-framework', actor: 'fulano' }),
      { mode: 'commit', reason: null },
    );
  });

  test('exemplo da doc: PR de fork', () => {
    assert.deepEqual(
      fn('formatMode')({ eventName: 'pull_request', headRepo: 'fulano/api-framework', baseRepo: 'Elavora/api-framework', actor: 'fulano' }),
      { mode: 'report', reason: 'fork' },
    );
  });

  test('headRepo vazio, null ou ausente → fork', () => {
    const formatMode = fn('formatMode');
    assert.deepEqual(formatMode({ ...PR, headRepo: '' }), { mode: 'report', reason: 'fork' });
    assert.deepEqual(formatMode({ ...PR, headRepo: null }), { mode: 'report', reason: 'fork' });
    const { headRepo, ...semHead } = PR;
    assert.deepEqual(formatMode(semHead), { mode: 'report', reason: 'fork' });
  });

  test('PR do Dependabot → report (dependabot)', () => {
    assert.deepEqual(fn('formatMode')({ ...PR, actor: 'dependabot[bot]' }), { mode: 'report', reason: 'dependabot' });
  });

  test('ordem: fork vence dependabot', () => {
    assert.deepEqual(
      fn('formatMode')({ ...PR, headRepo: 'outro/api-framework', actor: 'dependabot[bot]' }),
      { mode: 'report', reason: 'fork' },
    );
  });

  test('push → report (push), sejam quais forem os outros campos', () => {
    const formatMode = fn('formatMode');
    assert.deepEqual(formatMode({ ...PR, eventName: 'push' }), { mode: 'report', reason: 'push' });
    assert.deepEqual(formatMode({ eventName: 'push' }), { mode: 'report', reason: 'push' });
    assert.deepEqual(
      formatMode({ eventName: 'push', headRepo: 'fulano/x', baseRepo: 'Elavora/y', actor: 'dependabot[bot]' }),
      { mode: 'report', reason: 'push' },
    );
  });

  test('outros eventos → report (evento)', () => {
    const formatMode = fn('formatMode');
    for (const eventName of ['workflow_dispatch', 'pull_request_target', 'schedule', 'merge_group']) {
      assert.deepEqual(formatMode({ ...PR, eventName }), { mode: 'report', reason: 'evento' }, eventName);
    }
  });

  test('ordem: evento vence fork e dependabot', () => {
    assert.deepEqual(
      fn('formatMode')({ eventName: 'workflow_dispatch', headRepo: '', baseRepo: 'Elavora/x', actor: 'dependabot[bot]' }),
      { mode: 'report', reason: 'evento' },
    );
  });
});

// ---------------------------------------------------------------------------
// composerScripts
// ---------------------------------------------------------------------------

test.describe('composerScripts', () => {
  test('exemplo da doc', () => {
    assert.deepEqual(
      fn('composerScripts')('{"scripts":{"lint":"php tools/lint.php","test":"phpunit"}}'),
      ['lint', 'test'],
    );
  });

  test('preserva a ordem em que os scripts aparecem', () => {
    const text = JSON.stringify({ name: 'elavora/x', scripts: { test: 'phpunit', analyse: 'phpstan', lint: 'x', check: ['@lint', '@test'] } }, null, 4);
    assert.deepEqual(fn('composerScripts')(text), ['test', 'analyse', 'lint', 'check']);
  });

  test('text null, undefined ou vazio → []', () => {
    const composerScripts = fn('composerScripts');
    assert.deepEqual(composerScripts(null), []);
    assert.deepEqual(composerScripts(undefined), []);
    assert.deepEqual(composerScripts(''), []);
  });

  test('scripts ausente → []', () => {
    assert.deepEqual(fn('composerScripts')('{"name":"elavora/x"}'), []);
  });

  test('scripts que não é objeto → []', () => {
    const composerScripts = fn('composerScripts');
    assert.deepEqual(composerScripts('{"scripts":["lint","test"]}'), []);
    assert.deepEqual(composerScripts('{"scripts":"phpunit"}'), []);
    assert.deepEqual(composerScripts('{"scripts":null}'), []);
  });

  test('scripts vazio → []', () => {
    assert.deepEqual(fn('composerScripts')('{"scripts":{}}'), []);
  });

  test('JSON inválido lança Error com "composer.json" na mensagem', () => {
    const composerScripts = fn('composerScripts');
    assert.throws(() => composerScripts('{"scripts": {'), (err) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /composer\.json/);
      return true;
    });
  });
});

// ---------------------------------------------------------------------------
// filesChangedByFormatter
// ---------------------------------------------------------------------------

test.describe('filesChangedByFormatter', () => {
  test('exemplo da doc (strings com um caminho por linha)', () => {
    assert.deepEqual(
      fn('filesChangedByFormatter')('composer.lock\n', 'composer.lock\nsrc/A.php\nsrc/B.php\n'),
      ['src/A.php', 'src/B.php'],
    );
  });

  test('arrays de strings', () => {
    assert.deepEqual(
      fn('filesChangedByFormatter')(['composer.lock'], ['src/A.php', 'composer.lock', 'src/B.php']),
      ['src/A.php', 'src/B.php'],
    );
  });

  test('mistura de array e string', () => {
    const f = fn('filesChangedByFormatter');
    assert.deepEqual(f(['composer.lock'], 'composer.lock\nsrc/A.php'), ['src/A.php']);
    assert.deepEqual(f('composer.lock\n', ['src/A.php', 'composer.lock']), ['src/A.php']);
  });

  test('ordem de after, sem repetição', () => {
    assert.deepEqual(
      fn('filesChangedByFormatter')([], ['src/C.php', 'src/A.php', 'src/C.php', 'src/B.php', 'src/A.php']),
      ['src/C.php', 'src/A.php', 'src/B.php'],
    );
  });

  test('linhas vazias são ignoradas', () => {
    const f = fn('filesChangedByFormatter');
    assert.deepEqual(f('\n\ncomposer.lock\n\n', '\nsrc/A.php\n\n\ncomposer.lock\n'), ['src/A.php']);
    assert.deepEqual(f([''], ['', 'src/A.php', '']), ['src/A.php']);
  });

  test('nada mudou → []', () => {
    const f = fn('filesChangedByFormatter');
    assert.deepEqual(f('', ''), []);
    assert.deepEqual(f([], []), []);
    assert.deepEqual(f('composer.lock\n', 'composer.lock\n'), []);
  });

  test('tudo novo quando before é vazio', () => {
    assert.deepEqual(fn('filesChangedByFormatter')('', 'src/A.php\nsrc/B.php\n'), ['src/A.php', 'src/B.php']);
  });
});

// ---------------------------------------------------------------------------
// coveragePercent
// ---------------------------------------------------------------------------

test.describe('coveragePercent', () => {
  test('exemplo da doc → 85.5 (usa o total do projeto)', () => {
    const xml = '<project><file name="a.php"><metrics statements="10" coveredstatements="5"/></file>'
      + '<metrics files="1" statements="200" coveredstatements="171"/></project>';
    assert.equal(fn('coveragePercent')(xml), 85.5);
  });

  test('relatório Clover completo do PHPUnit', () => {
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<coverage generated="1700000000">',
      '  <project timestamp="1700000000">',
      '    <package name="Elavora\\Api">',
      '      <file name="/w/src/A.php">',
      '        <class name="Elavora\\Api\\A" namespace="Elavora\\Api">',
      '          <metrics complexity="1" methods="1" coveredmethods="1" conditionals="0" coveredconditionals="0" statements="3" coveredstatements="3" elements="4" coveredelements="4"/>',
      '        </class>',
      '        <line num="10" type="stmt" count="1"/>',
      '        <metrics loc="20" ncloc="15" classes="1" methods="1" coveredmethods="1" conditionals="0" coveredconditionals="0" statements="3" coveredstatements="3" elements="4" coveredelements="4"/>',
      '      </file>',
      '    </package>',
      '    <metrics files="2" loc="40" ncloc="30" classes="2" methods="4" coveredmethods="3" conditionals="0" coveredconditionals="0" statements="8" coveredstatements="6" elements="12" coveredelements="9"/>',
      '  </project>',
      '</coverage>',
      '',
    ].join('\n');
    assert.equal(fn('coveragePercent')(xml), 75);
  });

  test('não confunde statements com coveredstatements (ordem dos atributos)', () => {
    const xml = '<project><metrics coveredstatements="1" statements="4"/></project>';
    assert.equal(fn('coveragePercent')(xml), 25);
  });

  test('não arredonda', () => {
    const xml = '<project><metrics statements="3" coveredstatements="2"/></project>';
    assert.equal(fn('coveragePercent')(xml), (2 / 3) * 100);
  });

  test('statements="0" → 0', () => {
    const xml = '<project><metrics statements="0" coveredstatements="0"/></project>';
    assert.equal(fn('coveragePercent')(xml), 0);
  });

  test('100%', () => {
    const xml = '<project><metrics statements="50" coveredstatements="50"/></project>';
    assert.equal(fn('coveragePercent')(xml), 100);
  });

  test('entrada vazia, null ou undefined → null', () => {
    const f = fn('coveragePercent');
    assert.equal(f(''), null);
    assert.equal(f(null), null);
    assert.equal(f(undefined), null);
  });

  test('sem </project> → null', () => {
    assert.equal(fn('coveragePercent')('<project><metrics statements="10" coveredstatements="5"/>'), null);
  });

  test('sem <metrics> → null', () => {
    assert.equal(fn('coveragePercent')('<coverage><project></project></coverage>'), null);
  });

  test('sem statements ou sem coveredstatements → null', () => {
    const f = fn('coveragePercent');
    assert.equal(f('<project><metrics coveredstatements="5"/></project>'), null);
    assert.equal(f('<project><metrics statements="10"/></project>'), null);
  });

  test('texto que não é Clover → null', () => {
    assert.equal(fn('coveragePercent')('nada aqui'), null);
  });
});

// ---------------------------------------------------------------------------
// buildStages
// ---------------------------------------------------------------------------

function baseInput(overrides = {}) {
  return {
    install: 'success',
    dependencies: 'lowest',
    audit: { enabled: true, outcome: 'success' },
    format: { mode: 'commit', reason: null, config: 'dist', exitCode: 0, changedFiles: [], push: 'skipped' },
    editorconfig: { present: true, outcome: 'success' },
    scripts: ['lint', 'test', 'analyse'],
    lint: 'success',
    analyse: 'success',
    test: 'success',
    coverage: { min: 80, percent: 85.5 },
    ...overrides,
  };
}

function stage(input, id) {
  const stages = fn('buildStages')(input);
  assert.ok(Array.isArray(stages), 'buildStages precisa devolver um array');
  const found = stages.find((s) => s.id === id);
  assert.ok(found, `etapa ${id} ausente`);
  return found;
}

function sd(input, id) {
  const s = stage(input, id);
  return { status: s.status, detail: s.detail };
}

test.describe('buildStages: lista de etapas', () => {
  test('com tudo ligado: ordem, ids e nomes', () => {
    const stages = fn('buildStages')(baseInput());
    assert.deepEqual(stages.map((s) => [s.id, s.name]), [
      ['install', 'Dependências (Composer)'],
      ['audit', 'Auditoria (composer audit)'],
      ['format', 'Formatação (PHP-CS-Fixer)'],
      ['editorconfig', 'EditorConfig'],
      ['lint', 'Lint (composer lint)'],
      ['analyse', 'PHPStan (composer analyse)'],
      ['test', 'Testes (composer test)'],
      ['coverage', 'Cobertura'],
    ]);
  });

  test('cada etapa tem id, name, status e detail; status é chave de STATUS_LABELS', () => {
    const labels = exported('STATUS_LABELS');
    for (const s of fn('buildStages')(baseInput())) {
      assert.equal(typeof s.id, 'string');
      assert.equal(typeof s.name, 'string');
      assert.equal(typeof s.detail, 'string');
      assert.ok(Object.prototype.hasOwnProperty.call(labels, s.status), `status ${s.status} de ${s.id}`);
    }
  });

  test('tudo ok no caminho feliz', () => {
    const stages = fn('buildStages')(baseInput());
    assert.deepEqual(stages.map((s) => s.status), ['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok']);
  });

  test('audit ausente → etapa não entra', () => {
    const input = baseInput();
    delete input.audit;
    const ids = fn('buildStages')(input).map((s) => s.id);
    assert.deepEqual(ids, ['install', 'format', 'editorconfig', 'lint', 'analyse', 'test', 'coverage']);
  });

  test('audit.enabled false → etapa não entra', () => {
    const ids = fn('buildStages')(baseInput({ audit: { enabled: false, outcome: 'skipped' } })).map((s) => s.id);
    assert.ok(!ids.includes('audit'));
  });

  test('coverage ausente → etapa não entra', () => {
    const input = baseInput();
    delete input.coverage;
    const ids = fn('buildStages')(input).map((s) => s.id);
    assert.deepEqual(ids, ['install', 'audit', 'format', 'editorconfig', 'lint', 'analyse', 'test']);
  });

  test('coverage.min 0 → etapa não entra', () => {
    const ids = fn('buildStages')(baseInput({ coverage: { min: 0, percent: null } })).map((s) => s.id);
    assert.ok(!ids.includes('coverage'));
  });

  test('sem audit e sem coverage', () => {
    const input = baseInput({ coverage: { min: 0, percent: 50 } });
    delete input.audit;
    const ids = fn('buildStages')(input).map((s) => s.id);
    assert.deepEqual(ids, ['install', 'format', 'editorconfig', 'lint', 'analyse', 'test']);
  });

  test('a etapa format tem files igual a changedFiles', () => {
    const changedFiles = ['src/A.php', 'src/B.php'];
    const s = stage(baseInput({ format: { mode: 'commit', reason: null, config: 'dist', exitCode: 0, changedFiles, push: 'success' } }), 'format');
    assert.deepEqual(s.files, changedFiles);
    assert.deepEqual(stage(baseInput(), 'format').files, []);
  });
});

test.describe('buildStages: install', () => {
  test('success + lowest', () => {
    assert.deepEqual(sd(baseInput(), 'install'), { status: 'ok', detail: 'dependências mínimas instaladas (--prefer-lowest)' });
  });

  test('dependencies ausente → padrão lowest', () => {
    const input = baseInput();
    delete input.dependencies;
    assert.deepEqual(sd(input, 'install'), { status: 'ok', detail: 'dependências mínimas instaladas (--prefer-lowest)' });
  });

  test('success + install', () => {
    assert.deepEqual(sd(baseInput({ dependencies: 'install' }), 'install'), { status: 'ok', detail: 'dependências instaladas' });
  });

  test('failure e skipped → error', () => {
    for (const install of ['failure', 'skipped']) {
      assert.deepEqual(sd(baseInput({ install }), 'install'), {
        status: 'error', detail: 'a instalação das dependências falhou; veja o log',
      }, install);
    }
  });

  test('cancelled → etapa não concluída', () => {
    assert.deepEqual(sd(baseInput({ install: 'cancelled' }), 'install'), { status: 'error', detail: 'etapa não concluída (cancelled)' });
  });
});

test.describe('buildStages: audit', () => {
  test('instalação não concluída → skipped', () => {
    for (const install of ['failure', 'skipped', 'cancelled']) {
      assert.deepEqual(sd(baseInput({ install, audit: { enabled: true, outcome: 'skipped' } }), 'audit'), {
        status: 'skipped', detail: 'dependências não instaladas',
      }, install);
    }
  });

  test('success → ok', () => {
    assert.deepEqual(sd(baseInput(), 'audit'), { status: 'ok', detail: 'nenhum problema encontrado' });
  });

  test('failure → error', () => {
    assert.deepEqual(sd(baseInput({ audit: { enabled: true, outcome: 'failure' } }), 'audit'), {
      status: 'error', detail: 'o composer audit encontrou problemas; veja o log',
    });
  });

  test('cancelled → etapa não concluída', () => {
    assert.deepEqual(sd(baseInput({ audit: { enabled: true, outcome: 'cancelled' } }), 'audit'), {
      status: 'error', detail: 'etapa não concluída (cancelled)',
    });
  });
});

test.describe('buildStages: format', () => {
  const fmt = (format) => baseInput({ format: { mode: 'commit', reason: null, config: 'dist', exitCode: 0, changedFiles: [], push: 'skipped', ...format } });
  const two = ['src/A.php', 'src/B.php'];

  test('exitCode diferente de 0 → error', () => {
    assert.deepEqual(sd(fmt({ exitCode: 16, changedFiles: two }), 'format'), {
      status: 'error', detail: 'o PHP-CS-Fixer falhou (código 16); veja o log',
    });
    assert.deepEqual(sd(fmt({ exitCode: 1 }), 'format'), {
      status: 'error', detail: 'o PHP-CS-Fixer falhou (código 1); veja o log',
    });
  });

  test('exitCode vence o modo report', () => {
    assert.deepEqual(sd(fmt({ mode: 'report', reason: 'fork', exitCode: 8, changedFiles: two }), 'format'), {
      status: 'error', detail: 'o PHP-CS-Fixer falhou (código 8); veja o log',
    });
  });

  test('changedFiles vazio → ok', () => {
    assert.deepEqual(sd(fmt({}), 'format'), { status: 'ok', detail: 'o código já estava formatado' });
    assert.deepEqual(sd(fmt({ mode: 'report', reason: 'push' }), 'format'), { status: 'ok', detail: 'o código já estava formatado' });
  });

  test('commit + push success → fixed', () => {
    assert.deepEqual(sd(fmt({ changedFiles: two, push: 'success' }), 'format'), {
      status: 'fixed', detail: '2 arquivo(s) corrigido(s) no commit "style: organiza o código"',
    });
    assert.deepEqual(sd(fmt({ changedFiles: ['src/A.php'], push: 'success' }), 'format'), {
      status: 'fixed', detail: '1 arquivo(s) corrigido(s) no commit "style: organiza o código"',
    });
  });

  test('commit + push diferente de success → warning', () => {
    for (const push of ['failure', 'skipped']) {
      assert.deepEqual(sd(fmt({ changedFiles: two, push }), 'format'), {
        status: 'warning', detail: '2 arquivo(s) precisam de formatação; o commit não pôde ser enviado (veja o log)',
      }, push);
    }
  });

  test('report → warning com o motivo', () => {
    const motivos = { push: 'push na main', fork: 'PR de fork', dependabot: 'PR do Dependabot', evento: 'este evento' };
    for (const [reason, texto] of Object.entries(motivos)) {
      assert.deepEqual(sd(fmt({ mode: 'report', reason, changedFiles: two, push: 'skipped' }), 'format'), {
        status: 'warning', detail: `2 arquivo(s) precisam de formatação; sem commit automático em ${texto}`,
      }, reason);
    }
  });

  test('config override e dist não alteram o resultado', () => {
    for (const config of ['override', 'dist']) {
      assert.deepEqual(sd(fmt({ config, changedFiles: two, push: 'success' }), 'format'), {
        status: 'fixed', detail: '2 arquivo(s) corrigido(s) no commit "style: organiza o código"',
      }, config);
    }
  });

  test('fallback: exemplo da doc (ok vira warning)', () => {
    assert.deepEqual(sd(fmt({ config: 'fallback' }), 'format'), {
      status: 'warning', detail: `o código já estava formatado${FALLBACK_SUFFIX}`,
    });
  });

  test('fallback: fixed vira warning', () => {
    assert.deepEqual(sd(fmt({ config: 'fallback', changedFiles: two, push: 'success' }), 'format'), {
      status: 'warning', detail: `2 arquivo(s) corrigido(s) no commit "style: organiza o código"${FALLBACK_SUFFIX}`,
    });
  });

  test('fallback: warning continua warning', () => {
    assert.deepEqual(sd(fmt({ config: 'fallback', mode: 'report', reason: 'fork', changedFiles: two }), 'format'), {
      status: 'warning', detail: `2 arquivo(s) precisam de formatação; sem commit automático em PR de fork${FALLBACK_SUFFIX}`,
    });
  });

  test('fallback: error continua error', () => {
    assert.deepEqual(sd(fmt({ config: 'fallback', exitCode: 16 }), 'format'), {
      status: 'error', detail: `o PHP-CS-Fixer falhou (código 16); veja o log${FALLBACK_SUFFIX}`,
    });
  });
});

test.describe('buildStages: editorconfig', () => {
  test('present false → warning', () => {
    for (const outcome of ['skipped', 'success', undefined]) {
      assert.deepEqual(sd(baseInput({ editorconfig: { present: false, outcome } }), 'editorconfig'), {
        status: 'warning',
        detail: 'sem .editorconfig na raiz; conferência pulada (o repositório não adotou o elavora/code-standards)',
      }, String(outcome));
    }
  });

  test('success → ok', () => {
    assert.deepEqual(sd(baseInput(), 'editorconfig'), { status: 'ok', detail: 'sem problemas' });
  });

  test('failure → error', () => {
    assert.deepEqual(sd(baseInput({ editorconfig: { present: true, outcome: 'failure' } }), 'editorconfig'), {
      status: 'error', detail: 'arquivos fora das regras do .editorconfig; veja o log',
    });
  });

  test('cancelled → etapa não concluída', () => {
    assert.deepEqual(sd(baseInput({ editorconfig: { present: true, outcome: 'cancelled' } }), 'editorconfig'), {
      status: 'error', detail: 'etapa não concluída (cancelled)',
    });
  });

  test('não depende da instalação', () => {
    assert.deepEqual(sd(baseInput({ install: 'failure' }), 'editorconfig'), { status: 'ok', detail: 'sem problemas' });
  });
});

for (const script of ['lint', 'analyse']) {
  test.describe(`buildStages: ${script}`, () => {
    test('instalação não concluída → skipped (antes de olhar scripts)', () => {
      for (const install of ['failure', 'skipped', 'cancelled']) {
        assert.deepEqual(sd(baseInput({ install, scripts: [], [script]: 'skipped' }), script), {
          status: 'skipped', detail: 'dependências não instaladas',
        }, install);
      }
    });

    test('script fora de scripts → skipped', () => {
      const scripts = ['lint', 'test', 'analyse'].filter((s) => s !== script);
      assert.deepEqual(sd(baseInput({ scripts, [script]: 'skipped' }), script), {
        status: 'skipped', detail: `sem o script "${script}" no composer.json`,
      });
    });

    test('success → ok', () => {
      assert.deepEqual(sd(baseInput(), script), { status: 'ok', detail: 'sem problemas' });
    });

    test('failure → error', () => {
      assert.deepEqual(sd(baseInput({ [script]: 'failure' }), script), { status: 'error', detail: 'falhou; veja o log' });
    });

    test('cancelled → etapa não concluída', () => {
      assert.deepEqual(sd(baseInput({ [script]: 'cancelled' }), script), {
        status: 'error', detail: 'etapa não concluída (cancelled)',
      });
    });
  });
}

test.describe('buildStages: test', () => {
  test('instalação não concluída → skipped (antes de olhar scripts)', () => {
    for (const install of ['failure', 'skipped', 'cancelled']) {
      assert.deepEqual(sd(baseInput({ install, scripts: [], test: 'skipped' }), 'test'), {
        status: 'skipped', detail: 'dependências não instaladas',
      }, install);
    }
  });

  test('sem o script test → error', () => {
    assert.deepEqual(sd(baseInput({ scripts: ['lint', 'analyse'], test: 'skipped' }), 'test'), {
      status: 'error', detail: 'sem o script "test" no composer.json',
    });
  });

  test('success → ok', () => {
    assert.deepEqual(sd(baseInput(), 'test'), { status: 'ok', detail: 'testes passaram' });
  });

  test('failure → error', () => {
    assert.deepEqual(sd(baseInput({ test: 'failure' }), 'test'), { status: 'error', detail: 'testes falharam; veja o log' });
  });

  test('cancelled → etapa não concluída', () => {
    assert.deepEqual(sd(baseInput({ test: 'cancelled' }), 'test'), { status: 'error', detail: 'etapa não concluída (cancelled)' });
  });
});

test.describe('buildStages: coverage', () => {
  const cov = (coverage, extra = {}) => baseInput({ coverage, ...extra });

  test('etapa test diferente de ok → skipped', () => {
    for (const extra of [{ test: 'failure' }, { install: 'failure' }, { scripts: ['lint', 'analyse'] }, { test: 'cancelled' }]) {
      assert.deepEqual(sd(cov({ min: 80, percent: 90 }, extra), 'coverage'), {
        status: 'skipped', detail: 'testes não passaram',
      }, JSON.stringify(extra));
    }
  });

  test('percent null → warning', () => {
    assert.deepEqual(sd(cov({ min: 80, percent: null }), 'coverage'), {
      status: 'warning', detail: 'relatório de cobertura não encontrado',
    });
  });

  test('acima do mínimo → ok (exemplo 85,5%)', () => {
    assert.deepEqual(sd(cov({ min: 80, percent: 85.5 }), 'coverage'), { status: 'ok', detail: '85,5% (mínimo 80%)' });
  });

  test('trunca para uma casa decimal: 85.56 → 85,5', () => {
    assert.deepEqual(sd(cov({ min: 80, percent: 85.56 }), 'coverage'), { status: 'ok', detail: '85,5% (mínimo 80%)' });
  });

  test('inteiros sem casa decimal', () => {
    assert.deepEqual(sd(cov({ min: 80, percent: 100 }), 'coverage'), { status: 'ok', detail: '100% (mínimo 80%)' });
  });

  test('igual ao mínimo → ok', () => {
    assert.deepEqual(sd(cov({ min: 80, percent: 80 }), 'coverage'), { status: 'ok', detail: '80% (mínimo 80%)' });
  });

  test('abaixo do mínimo → warning, nunca error', () => {
    assert.deepEqual(sd(cov({ min: 80, percent: 79.99 }), 'coverage'), {
      status: 'warning', detail: '79,9% abaixo do mínimo de 80%',
    });
    assert.deepEqual(sd(cov({ min: 80, percent: 0 }), 'coverage'), {
      status: 'warning', detail: '0% abaixo do mínimo de 80%',
    });
  });

  test('mínimo com casa decimal, também truncado e com vírgula', () => {
    assert.deepEqual(sd(cov({ min: 75.5, percent: 90 }), 'coverage'), { status: 'ok', detail: '90% (mínimo 75,5%)' });
  });

  test('compara sem arredondar', () => {
    // 79,95 e 79,99 aparecem iguais (79,9), mas 79.95 < 79.99
    assert.deepEqual(sd(cov({ min: 79.99, percent: 79.95 }), 'coverage'), {
      status: 'warning', detail: '79,9% abaixo do mínimo de 79,9%',
    });
  });

  test('cobertura nunca gera error', () => {
    for (const coverage of [{ min: 80, percent: null }, { min: 80, percent: 1 }, { min: 100, percent: 99.9 }]) {
      assert.notEqual(stage(cov(coverage), 'coverage').status, 'error');
    }
  });
});

// ---------------------------------------------------------------------------
// overallStatus
// ---------------------------------------------------------------------------

test.describe('overallStatus', () => {
  const st = (...statuses) => statuses.map((status, i) => ({ id: `s${i}`, name: `S${i}`, status, detail: '' }));

  test('alguma etapa error → error', () => {
    assert.equal(fn('overallStatus')(st('ok', 'error', 'ok')), 'error');
    assert.equal(fn('overallStatus')(st('error')), 'error');
  });

  test('sem error → ok, mesmo com fixed, warning e skipped', () => {
    const f = fn('overallStatus');
    assert.equal(f(st('ok', 'fixed', 'warning', 'skipped')), 'ok');
    assert.equal(f(st('warning')), 'ok');
    assert.equal(f(st('skipped', 'skipped')), 'ok');
  });

  test('lista vazia → ok', () => {
    assert.equal(fn('overallStatus')([]), 'ok');
  });

  test('integra com buildStages', () => {
    assert.equal(fn('overallStatus')(fn('buildStages')(baseInput())), 'ok');
    assert.equal(fn('overallStatus')(fn('buildStages')(baseInput({ test: 'failure' }))), 'error');
    assert.equal(fn('overallStatus')(fn('buildStages')(baseInput({ coverage: { min: 80, percent: 10 } }))), 'ok');
  });
});

// ---------------------------------------------------------------------------
// renderReport
// ---------------------------------------------------------------------------

test.describe('renderReport', () => {
  const SHA = '1a2b3c4d5e6f708192a3b4c5d6e7f80910111213';
  const RUN = 'https://github.com/Elavora/api-framework/actions/runs/1';
  const INSTALL = { id: 'install', name: 'Dependências (Composer)', status: 'ok', detail: 'dependências mínimas instaladas (--prefer-lowest)' };
  const FORMAT_FIXED = {
    id: 'format',
    name: 'Formatação (PHP-CS-Fixer)',
    status: 'fixed',
    detail: '2 arquivo(s) corrigido(s) no commit "style: organiza o código"',
    files: ['src/A.php', 'src/B.php'],
  };

  test('exemplo exato da doc', () => {
    const expected = [
      '<!-- elavora-quality -->',
      '## Qualidade: testes rodaram ok',
      '',
      '| Etapa | Resultado | Detalhe |',
      '| --- | --- | --- |',
      '| Dependências (Composer) | ok | dependências mínimas instaladas (--prefer-lowest) |',
      '| Formatação (PHP-CS-Fixer) | corrigido | 2 arquivo(s) corrigido(s) no commit "style: organiza o código" |',
      '',
      '<details><summary>Arquivos formatados (2)</summary>',
      '',
      '- `src/A.php`',
      '- `src/B.php`',
      '',
      '</details>',
      '',
      'Commit `1a2b3c4` · [ver a execução](https://github.com/Elavora/api-framework/actions/runs/1)',
      '',
    ].join('\n');
    assert.equal(fn('renderReport')({ stages: [INSTALL, FORMAT_FIXED], sha: SHA, runUrl: RUN }), expected);
  });

  test('sem arquivos formatados: sem bloco <details>', () => {
    const format = { ...FORMAT_FIXED, status: 'ok', detail: 'o código já estava formatado', files: [] };
    const expected = [
      '<!-- elavora-quality -->',
      '## Qualidade: testes rodaram ok',
      '',
      '| Etapa | Resultado | Detalhe |',
      '| --- | --- | --- |',
      '| Dependências (Composer) | ok | dependências mínimas instaladas (--prefer-lowest) |',
      '| Formatação (PHP-CS-Fixer) | ok | o código já estava formatado |',
      '',
      'Commit `1a2b3c4` · [ver a execução](https://github.com/Elavora/api-framework/actions/runs/1)',
      '',
    ].join('\n');
    const out = fn('renderReport')({ stages: [INSTALL, format], sha: SHA, runUrl: RUN });
    assert.ok(!out.includes('<details>'));
    assert.equal(out, expected);
  });

  test('primeira linha é MARKER, separador \\n e termina em \\n', () => {
    const out = fn('renderReport')({ stages: [INSTALL], sha: SHA, runUrl: RUN });
    assert.ok(out.startsWith(`${exported('MARKER')}\n`));
    assert.ok(out.endsWith('\n'));
    assert.ok(!out.endsWith('\n\n'));
    assert.ok(!out.includes('\r'));
  });

  test('título com erro', () => {
    const erro = { id: 'test', name: 'Testes (composer test)', status: 'error', detail: 'testes falharam; veja o log' };
    const out = fn('renderReport')({ stages: [INSTALL, erro], sha: SHA, runUrl: RUN });
    const lines = out.split('\n');
    assert.equal(lines[1], '## Qualidade: testes com erro');
    assert.ok(lines.includes('| Testes (composer test) | erro | testes falharam; veja o log |'));
  });

  test('rótulos de todos os status, na ordem recebida', () => {
    const stages = [
      { id: 'a', name: 'A', status: 'skipped', detail: 'd1' },
      { id: 'b', name: 'B', status: 'warning', detail: 'd2' },
      { id: 'c', name: 'C', status: 'ok', detail: 'd3' },
      { id: 'd', name: 'D', status: 'fixed', detail: 'd4' },
    ];
    const out = fn('renderReport')({ stages, sha: SHA, runUrl: RUN });
    const rows = out.split('\n').filter((l) => /^\| [A-D] \|/.test(l));
    assert.deepEqual(rows, ['| A | pulado | d1 |', '| B | aviso | d2 |', '| C | ok | d3 |', '| D | corrigido | d4 |']);
    assert.equal(out.split('\n')[1], '## Qualidade: testes rodaram ok');
  });

  test('| dentro de detail vira \\|', () => {
    const s = { id: 'lint', name: 'Lint (composer lint)', status: 'error', detail: 'a | b | c' };
    const out = fn('renderReport')({ stages: [s], sha: SHA, runUrl: RUN });
    assert.ok(out.split('\n').includes('| Lint (composer lint) | erro | a \\| b \\| c |'));
  });

  test('arquivos que precisam de formatação (status diferente de fixed)', () => {
    const format = {
      id: 'format', name: 'Formatação (PHP-CS-Fixer)', status: 'warning',
      detail: '1 arquivo(s) precisam de formatação; sem commit automático em PR de fork', files: ['src/A.php'],
    };
    const out = fn('renderReport')({ stages: [format], sha: SHA, runUrl: RUN });
    assert.ok(out.includes('\n<details><summary>Arquivos que precisam de formatação (1)</summary>\n\n- `src/A.php`\n\n</details>\n'));
    assert.ok(!out.includes('Arquivos formatados'));
  });

  test('format com error e arquivos: também mostra a lista como "precisam de formatação"', () => {
    const format = {
      id: 'format', name: 'Formatação (PHP-CS-Fixer)', status: 'error',
      detail: 'o PHP-CS-Fixer falhou (código 16); veja o log', files: ['src/A.php', 'src/B.php'],
    };
    const out = fn('renderReport')({ stages: [format], sha: SHA, runUrl: RUN });
    assert.ok(out.includes('<details><summary>Arquivos que precisam de formatação (2)</summary>'));
  });

  test('no máximo 20 arquivos, depois "- e mais <resto> arquivo(s)"', () => {
    const files = Array.from({ length: 25 }, (_, i) => `src/F${String(i + 1).padStart(2, '0')}.php`);
    const format = { ...FORMAT_FIXED, detail: '25 arquivo(s) corrigido(s) no commit "style: organiza o código"', files };
    const out = fn('renderReport')({ stages: [format], sha: SHA, runUrl: RUN });
    const expectedBlock = [
      '<details><summary>Arquivos formatados (25)</summary>',
      '',
      ...files.slice(0, 20).map((f) => `- \`${f}\``),
      '- e mais 5 arquivo(s)',
      '',
      '</details>',
    ].join('\n');
    assert.ok(out.includes(`\n${expectedBlock}\n`), out);
    assert.ok(!out.includes('src/F21.php'));
  });

  test('exatamente 20 arquivos: sem linha "e mais"', () => {
    const files = Array.from({ length: 20 }, (_, i) => `src/F${i + 1}.php`);
    const out = fn('renderReport')({ stages: [{ ...FORMAT_FIXED, files }], sha: SHA, runUrl: RUN });
    assert.ok(out.includes('- `src/F20.php`\n\n</details>'));
    assert.ok(!out.includes('e mais'));
  });

  test('21 arquivos: "- e mais 1 arquivo(s)"', () => {
    const files = Array.from({ length: 21 }, (_, i) => `src/F${i + 1}.php`);
    const out = fn('renderReport')({ stages: [{ ...FORMAT_FIXED, files }], sha: SHA, runUrl: RUN });
    assert.ok(out.includes('- `src/F20.php`\n- e mais 1 arquivo(s)\n\n</details>'));
  });

  test('última linha: 7 primeiros caracteres do sha e o link', () => {
    const out = fn('renderReport')({ stages: [INSTALL], sha: 'abcdef0123456789', runUrl: 'https://x/runs/42' });
    const lines = out.split('\n');
    assert.equal(lines[lines.length - 1], '');
    assert.equal(lines[lines.length - 2], 'Commit `abcdef0` · [ver a execução](https://x/runs/42)');
  });

  test('integra com buildStages: ordem das linhas da tabela', () => {
    const stages = fn('buildStages')(baseInput());
    const out = fn('renderReport')({ stages, sha: SHA, runUrl: RUN });
    const names = out.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Etapa') && !l.startsWith('| ---'))
      .map((l) => l.split(' | ')[0].slice(2));
    assert.deepEqual(names, stages.map((s) => s.name));
  });
});

// ---------------------------------------------------------------------------
// findQualityComment
// ---------------------------------------------------------------------------

test.describe('findQualityComment', () => {
  const MARK = '<!-- elavora-quality -->';
  const bot = { login: 'github-actions[bot]' };

  test('acha o comentário do bot com o marcador', () => {
    const comments = [
      { id: 1, body: 'oi', user: { login: 'fulano' } },
      { id: 2, body: `${MARK}\n## Qualidade: testes rodaram ok\n`, user: bot },
    ];
    assert.equal(fn('findQualityComment')(comments), 2);
  });

  test('devolve o primeiro quando há mais de um', () => {
    const comments = [
      { id: 7, body: `${MARK}\nprimeiro`, user: bot },
      { id: 9, body: `${MARK}\nsegundo`, user: bot },
    ];
    assert.equal(fn('findQualityComment')(comments), 7);
  });

  test('ignora outros autores com o marcador', () => {
    const comments = [
      { id: 3, body: `${MARK}\nfalso`, user: { login: 'fulano' } },
      { id: 4, body: `${MARK}\nfalso`, user: { login: 'dependabot[bot]' } },
    ];
    assert.equal(fn('findQualityComment')(comments), null);
  });

  test('ignora comentário do bot sem o marcador no início', () => {
    const comments = [
      { id: 5, body: 'outro relatório', user: bot },
      { id: 6, body: `texto antes\n${MARK}`, user: bot },
    ];
    assert.equal(fn('findQualityComment')(comments), null);
  });

  test('pula o falso e acha o verdadeiro', () => {
    const comments = [
      { id: 10, body: `${MARK}\nfalso`, user: { login: 'fulano' } },
      { id: 11, body: 'sem marcador', user: bot },
      { id: 12, body: `${MARK}\nverdadeiro`, user: bot },
    ];
    assert.equal(fn('findQualityComment')(comments), 12);
  });

  test('lista vazia → null', () => {
    assert.equal(fn('findQualityComment')([]), null);
  });

  test('aceita o texto gerado por renderReport', () => {
    const body = fn('renderReport')({
      stages: [{ id: 'install', name: 'Dependências (Composer)', status: 'ok', detail: 'x' }],
      sha: '1234567890', runUrl: 'https://x',
    });
    assert.equal(fn('findQualityComment')([{ id: 99, body, user: bot }]), 99);
  });
});

// ---------------------------------------------------------------------------
// Pureza
// ---------------------------------------------------------------------------

test.describe('funções puras', () => {
  test('buildStages não altera a entrada', () => {
    const input = baseInput({ format: { mode: 'commit', reason: null, config: 'fallback', exitCode: 0, changedFiles: ['src/A.php'], push: 'success' } });
    const copia = JSON.parse(JSON.stringify(input));
    fn('buildStages')(input);
    assert.deepEqual(input, copia);
  });

  test('filesChangedByFormatter não altera os arrays recebidos', () => {
    const before = ['a'];
    const after = ['a', 'b', 'b'];
    fn('filesChangedByFormatter')(before, after);
    assert.deepEqual(before, ['a']);
    assert.deepEqual(after, ['a', 'b', 'b']);
  });
});
