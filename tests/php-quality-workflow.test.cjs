'use strict';

// Contrato: docs/qualidade.md, seção "Workflow reutilizável php-quality.yml"
// Lê o YAML como texto (sem dependências externas) e confere a estrutura documentada.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WORKFLOW = path.join(__dirname, '..', '.github', 'workflows', 'php-quality.yml');

function readWorkflow() {
  assert.ok(fs.existsSync(WORKFLOW), '.github/workflows/php-quality.yml precisa existir');
  return fs.readFileSync(WORKFLOW, 'utf8').replace(/\r\n/g, '\n');
}

// Remove comentários de linha inteira para não casar texto comentado.
function lines(text) {
  return text.split('\n').filter((l) => !/^\s*#/.test(l));
}

const indent = (l) => l.match(/^ */)[0].length;

// Devolve o bloco (linhas mais indentadas) logo abaixo da primeira chave `key:` que casar,
// opcionalmente dentro de um bloco pai já extraído.
function block(source, key) {
  const ls = Array.isArray(source) ? source : lines(source);
  const re = new RegExp(`^\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*(#.*)?$`);
  const start = ls.findIndex((l) => re.test(l));
  if (start === -1) return null;
  const base = indent(ls[start]);
  const out = [];
  for (let i = start + 1; i < ls.length; i++) {
    const l = ls[i];
    if (l.trim() === '') { out.push(l); continue; }
    if (indent(l) <= base) break;
    out.push(l);
  }
  return out;
}

// Valor escalar de `key: valor` no nível mais raso do bloco.
function scalar(ls, key) {
  const nonEmpty = ls.filter((l) => l.trim() !== '');
  if (nonEmpty.length === 0) return undefined;
  const min = Math.min(...nonEmpty.map(indent));
  const re = new RegExp(`^ {${min}}${key}:\\s*(.*?)\\s*(#.*)?$`);
  for (const l of nonEmpty) {
    const m = l.match(re);
    if (m) return m[1].replace(/^(['"])(.*)\1$/, '$2');
  }
  return undefined;
}

function topLevelKeys(text) {
  return lines(text).filter((l) => /^[A-Za-z_][\w-]*:/.test(l)).map((l) => l.split(':')[0]);
}

test.describe('php-quality.yml: cabeçalho e gatilho', () => {
  test('nome do workflow', () => {
    const text = readWorkflow();
    const m = text.match(/^name:\s*(.+?)\s*$/m);
    assert.ok(m, 'name ausente');
    assert.equal(m[1].replace(/^(['"])(.*)\1$/, '$2'), 'Qualidade PHP reutilizável');
  });

  test('só workflow_call', () => {
    const text = readWorkflow();
    const on = block(text, 'on');
    assert.ok(on, 'chave on ausente');
    const events = on.filter((l) => l.trim() !== '');
    const min = Math.min(...events.map(indent));
    const names = events.filter((l) => indent(l) === min).map((l) => l.trim().split(':')[0]);
    assert.deepEqual(names, ['workflow_call']);
  });

  test('sem secrets', () => {
    const call = block(readWorkflow(), 'workflow_call');
    assert.ok(call);
    assert.equal(block(call, 'secrets'), null, 'workflow_call não deve declarar secrets');
  });
});

test.describe('php-quality.yml: entradas', () => {
  const inputs = () => {
    const call = block(readWorkflow(), 'workflow_call');
    assert.ok(call, 'workflow_call ausente');
    const b = block(call, 'inputs');
    assert.ok(b, 'inputs ausente');
    return b;
  };
  const input = (name) => {
    const b = block(inputs(), name);
    assert.ok(b, `entrada ${name} ausente`);
    return b;
  };

  test('conjunto de entradas', () => {
    const b = inputs().filter((l) => l.trim() !== '');
    const min = Math.min(...b.map(indent));
    const names = b.filter((l) => indent(l) === min).map((l) => l.trim().split(':')[0]).sort();
    assert.deepEqual(names, ['automation_ref', 'composer_audit', 'coverage_min', 'dependencies', 'image']);
  });

  test('image: string, opcional, padrão ghcr.io/elavora/php-dev:8.3-latest', () => {
    const b = input('image');
    assert.equal(scalar(b, 'type'), 'string');
    assert.notEqual(scalar(b, 'required'), 'true');
    assert.equal(scalar(b, 'default'), 'ghcr.io/elavora/php-dev:8.3-latest');
  });

  test('coverage_min: number, opcional, padrão 80', () => {
    const b = input('coverage_min');
    assert.equal(scalar(b, 'type'), 'number');
    assert.notEqual(scalar(b, 'required'), 'true');
    assert.equal(scalar(b, 'default'), '80');
  });

  test('composer_audit: boolean, opcional, padrão true', () => {
    const b = input('composer_audit');
    assert.equal(scalar(b, 'type'), 'boolean');
    assert.notEqual(scalar(b, 'required'), 'true');
    assert.equal(scalar(b, 'default'), 'true');
  });

  test('dependencies: string, opcional, padrão lowest', () => {
    const b = input('dependencies');
    assert.equal(scalar(b, 'type'), 'string');
    assert.notEqual(scalar(b, 'required'), 'true');
    assert.equal(scalar(b, 'default'), 'lowest');
  });

  test("automation_ref: string, opcional, padrão ''", () => {
    const b = input('automation_ref');
    assert.equal(scalar(b, 'type'), 'string');
    assert.notEqual(scalar(b, 'required'), 'true');
    assert.equal(scalar(b, 'default'), '');
  });
});

test.describe('php-quality.yml: job', () => {
  const jobs = () => {
    const b = block(readWorkflow(), 'jobs');
    assert.ok(b, 'jobs ausente');
    return b;
  };
  const job = () => {
    const b = block(jobs(), 'quality');
    assert.ok(b, 'job quality ausente');
    return b;
  };

  test('um único job, com id quality e nome Qualidade PHP', () => {
    const b = jobs().filter((l) => l.trim() !== '');
    const min = Math.min(...b.map(indent));
    assert.deepEqual(b.filter((l) => indent(l) === min).map((l) => l.trim().split(':')[0]), ['quality']);
    assert.equal(scalar(job(), 'name'), 'Qualidade PHP');
  });

  test('runs-on ubuntu-latest e timeout-minutes 20', () => {
    assert.equal(scalar(job(), 'runs-on'), 'ubuntu-latest');
    assert.equal(scalar(job(), 'timeout-minutes'), '20');
  });

  test('container com a imagem da entrada e --user root', () => {
    const c = block(job(), 'container');
    assert.ok(c, 'container ausente');
    assert.match(scalar(c, 'image') || '', /^\$\{\{\s*inputs\.image\s*\}\}$/);
    assert.match(scalar(c, 'options') || '', /--user root/);
  });

  test('variáveis COMPOSER_ALLOW_SUPERUSER e COMPOSER_NO_INTERACTION', () => {
    const env = block(job(), 'env');
    assert.ok(env, 'env do job ausente');
    assert.equal(scalar(env, 'COMPOSER_ALLOW_SUPERUSER'), '1');
    assert.equal(scalar(env, 'COMPOSER_NO_INTERACTION'), '1');
  });
});

test.describe('php-quality.yml: concorrência', () => {
  test('grupo e cancel-in-progress', () => {
    const c = block(readWorkflow(), 'concurrency');
    assert.ok(c, 'concurrency ausente');
    const group = (scalar(c, 'group') || '').replace(/\s+/g, ' ');
    assert.equal(
      group,
      'elavora-quality-${{ github.repository }}-${{ github.event.pull_request.number || github.ref }}',
    );
    assert.equal(scalar(c, 'cancel-in-progress'), 'true');
  });
});

test.describe('php-quality.yml: passos', () => {
  const body = () => lines(readWorkflow()).join('\n');

  test('valida dependencies (lowest ou install) e automation_ref', () => {
    const t = body();
    assert.match(t, /lowest/);
    assert.match(t, /install/);
    assert.match(t, /inputs\.automation_ref/);
  });

  test('checkout do repositório sem persistir credenciais, fetch-depth 1, head do PR', () => {
    const t = body();
    assert.match(t, /fetch-depth:\s*1\b/);
    assert.match(t, /github\.event\.pull_request\.head\.sha/);
    assert.match(t, /github\.sha/);
    const persist = t.match(/persist-credentials:\s*(\S+)/g) || [];
    assert.ok(persist.length >= 2, 'os dois checkouts precisam declarar persist-credentials');
    for (const p of persist) assert.match(p, /persist-credentials:\s*false/);
  });

  test('safe.directory do workspace', () => {
    assert.match(body(), /git config --global --add safe\.directory "\$GITHUB_WORKSPACE"/);
  });

  test('checkout dos scripts: Elavora/.github em .elavora/, só scripts/', () => {
    const t = body();
    assert.match(t, /repository:\s*['"]?Elavora\/\.github['"]?/);
    assert.match(t, /path:\s*['"]?\.elavora\/?['"]?/);
    assert.match(t, /sparse-checkout:[\s\S]*?scripts/);
  });

  test('usa scripts/quality.cjs e as funções documentadas', () => {
    const t = body();
    assert.match(t, /\.elavora\/scripts\/quality\.cjs/);
    for (const f of ['formatMode', 'composerScripts', 'filesChangedByFormatter', 'coveragePercent', 'buildStages', 'renderReport', 'findQualityComment', 'overallStatus']) {
      assert.ok(t.includes(f), `o workflow precisa usar ${f}`);
    }
  });

  test('comandos de instalação', () => {
    const t = body();
    assert.match(t, /composer update --prefer-lowest --prefer-stable --no-progress --prefer-dist/);
    assert.match(t, /composer install --no-progress --prefer-dist/);
    assert.match(t, /composer audit/);
  });

  test('PHP-CS-Fixer: opções, configs e fallback @PER-CS', () => {
    const t = body();
    assert.match(t, /php-cs-fixer fix/);
    assert.match(t, /--using-cache=no/);
    assert.match(t, /--no-interaction/);
    assert.match(t, /--show-progress=none/);
    assert.match(t, /\.php-cs-fixer\.php/);
    assert.match(t, /\.php-cs-fixer\.dist\.php/);
    assert.match(t, /--rules=@PER-CS/);
    assert.match(t, /--allow-risky=no/);
    assert.match(t, /git diff --name-only/);
  });

  test('PHP-CS-Fixer com arquivo de config: sem --rules, --allow-risky nem --using-cache', () => {
    const withConfig = body().split('\n').filter((l) => /--config[= ]/.test(l));
    assert.ok(withConfig.length > 0, 'precisa chamar php-cs-fixer fix --config=...');
    for (const l of withConfig) {
      assert.doesNotMatch(l, /--rules|--allow-risky|--using-cache/, l.trim());
    }
    // o fallback leva as três opções juntas
    assert.match(body(), /--rules=@PER-CS --allow-risky=no --using-cache=no/);
  });

  test('composer install roda com scripts (sincronização do code-standards)', () => {
    const installs = body().split('\n').filter((l) => /composer install\b/.test(l));
    assert.ok(installs.length > 0);
    for (const l of installs) assert.doesNotMatch(l, /--no-scripts/, l.trim());
  });

  test('syncFiles: registra .editorconfig e .php-cs-fixer.dist.php pelo git status', () => {
    const t = body();
    assert.match(t, /git status/);
    assert.match(t, /\.editorconfig/);
    assert.match(t, /\.php-cs-fixer\.dist\.php/);
    assert.match(t, /syncFiles/);
  });

  test('composer.lock nunca entra no commit', () => {
    // `git ... add` como subcomando (não confunde com `git config --add`)
    const adds = body().split('\n').filter((l) => /\bgit(\s+-c\s+\S+)*\s+add\b/.test(l));
    assert.ok(adds.length > 0, 'precisa de git add -- <arquivos>');
    for (const l of adds) {
      assert.doesNotMatch(l, /composer\.lock|vendor\/|\.elavora/, l.trim());
      assert.doesNotMatch(l, /\badd\s+(-A|--all|-u|--update|\.|\*)(\s|$)/, l.trim());
      assert.match(l, /add\s+--\s/, `git add precisa usar -- antes dos arquivos: ${l.trim()}`);
    }
    assert.doesNotMatch(body(), /commit\s+(-a|--all)\b/);
  });

  test('ordem dos passos: formatMode, install, format, commit, editorconfig, lowest, audit, lint, analyse, test, relatório, resultado', () => {
    // só dentro de jobs:, para não casar descrições das entradas
    const jobs = block(readWorkflow(), 'jobs');
    assert.ok(jobs, 'jobs ausente');
    const t = jobs.join('\n');
    const marcos = [
      ['formatMode', /formatMode/],
      ['composer install', /composer install --no-progress --prefer-dist/],
      ['php-cs-fixer fix', /php-cs-fixer fix/],
      ['push do commit', /core\.hooksPath=\/dev\/null/],
      ['editorconfig-checker', /xargs -0 editorconfig-checker/],
      ['composer update --prefer-lowest', /composer update --prefer-lowest/],
      ['composer audit', /composer audit/],
      ['composer lint', /composer lint/],
      ['composer analyse', /composer analyse/],
      ['composer test', /composer test/],
      ['coveragePercent', /coveragePercent/],
      ['renderReport', /renderReport/],
      ['testes com erro', /testes com erro/],
    ];
    let anterior = -1;
    let nomeAnterior = '(início)';
    for (const [nome, re] of marcos) {
      const m = re.exec(t);
      assert.ok(m, `${nome} ausente`);
      assert.ok(m.index > anterior, `${nome} precisa vir depois de ${nomeAnterior}`);
      anterior = m.index;
      nomeAnterior = nome;
    }
  });

  test('composer update --prefer-lowest só com dependencies lowest', () => {
    const t = body();
    const i = t.search(/composer update --prefer-lowest/);
    assert.ok(i >= 0);
    // a condição do passo (if:) ou do shell precisa citar inputs.dependencies e lowest antes do comando
    const antes = t.slice(Math.max(0, t.lastIndexOf('- name:', i)), i);
    assert.match(antes, /dependencies/);
    assert.match(antes, /lowest/);
  });

  test('commit de formatação: identidade do bot, sem hooks e sem --force', () => {
    const t = body();
    assert.match(t, /github-actions\[bot\]/);
    assert.match(t, /41898282\+github-actions\[bot\]@users\.noreply\.github\.com/);
    assert.match(t, /core\.hooksPath=\/dev\/null/);
    assert.match(t, /x-access-token:\$\{GITHUB_TOKEN\}@github\.com/);
    assert.match(t, /HEAD:refs\/heads\//);
    assert.match(t, /git reset --mixed/);
    assert.doesNotMatch(t, /push[^\n]*--force/);
    assert.doesNotMatch(t, /git add (-A|--all|\.)(\s|$)/);
  });

  test('editorconfig-checker só sobre arquivos versionados', () => {
    assert.match(body(), /git ls-files -z \| xargs -0 editorconfig-checker/);
    assert.doesNotMatch(body(), /\bec\s+-/);
  });

  test('scripts do composer: lint, analyse, test e cobertura', () => {
    const t = body();
    assert.match(t, /composer lint/);
    assert.match(t, /composer analyse/);
    assert.match(t, /XDEBUG_MODE=coverage composer test -- --coverage-clover=/);
    assert.match(t, /coverage\.xml/);
  });

  test('relatório no resumo do job e falha com "testes com erro"', () => {
    const t = body();
    assert.match(t, /GITHUB_STEP_SUMMARY|core\.summary/);
    assert.match(t, /testes com erro/);
    assert.match(t, /core\.warning/);
  });

  test('actions fixadas por SHA completo', () => {
    const uses = body().match(/uses:\s*\S+/g) || [];
    assert.ok(uses.length > 0);
    for (const u of uses) {
      assert.match(u, /@[0-9a-f]{40}$/, `${u} precisa estar fixada por SHA completo`);
    }
  });
});

// ---------------------------------------------------------------------------
// Contrato: docs/qualidade.md, seção "Passo `Registrar a imagem`"
// ---------------------------------------------------------------------------

// Passos do job quality: [{ name, lines }], na ordem do arquivo.
function qualitySteps() {
  const jobs = block(readWorkflow(), 'jobs');
  assert.ok(jobs, 'jobs ausente');
  const quality = block(jobs, 'quality');
  assert.ok(quality, 'job quality ausente');
  const steps = block(quality, 'steps');
  assert.ok(steps, 'steps do job quality ausente');
  const nonEmpty = steps.filter((l) => l.trim() !== '');
  const base = Math.min(...nonEmpty.map(indent));
  const out = [];
  for (const l of steps) {
    if (l.trim() !== '' && indent(l) === base && /^\s*-\s/.test(l)) {
      out.push({ name: undefined, lines: [l.replace(/^(\s*)-\s/, '$1  ')] });
    } else if (out.length > 0) {
      out[out.length - 1].lines.push(l);
    }
  }
  for (const s of out) s.name = scalar(s.lines, 'name');
  return out;
}

const REGISTER_IMAGE = 'Registrar a imagem';
const GITHUB_SCRIPT = 'actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3';

test.describe('php-quality.yml: passo Registrar a imagem', () => {
  const step = () => {
    const s = qualitySteps().find((x) => x.name === REGISTER_IMAGE);
    assert.ok(s, `passo "${REGISTER_IMAGE}" ausente`);
    return s;
  };

  test('fica logo depois de Conferir a versão da automação e antes de Decidir o modo de formatação', () => {
    const names = qualitySteps().map((s) => s.name);
    const i = names.indexOf(REGISTER_IMAGE);
    assert.ok(i >= 0, `passo "${REGISTER_IMAGE}" ausente`);
    assert.equal(names[i - 1], 'Conferir a versão da automação');
    assert.equal(names[i + 1], 'Decidir o modo de formatação');
  });

  test('usa actions/github-script fixado pelo SHA da v9.0.0', () => {
    assert.equal(scalar(step().lines, 'uses'), GITHUB_SCRIPT);
  });

  test('continue-on-error: true e nenhum if', () => {
    const s = step();
    assert.equal(scalar(s.lines, 'continue-on-error'), 'true');
    assert.equal(scalar(s.lines, 'if'), undefined, 'o passo não deve ter if');
  });

  test('env com IMAGE e CONTAINER_ID', () => {
    const env = block(step().lines, 'env');
    assert.ok(env, 'env do passo ausente');
    assert.match(scalar(env, 'IMAGE') || '', /^\$\{\{\s*inputs\.image\s*\}\}$/);
    assert.match(scalar(env, 'CONTAINER_ID') || '', /^\$\{\{\s*job\.container\.id\s*\}\}$/);
  });

  test('script usa imageDigest e renderImageInfo de scripts/quality.cjs, o socket do Docker e o resumo do job', () => {
    const t = step().lines.join('\n');
    assert.match(t, /\.elavora\/scripts\/quality\.cjs/);
    assert.match(t, /imageDigest/);
    assert.match(t, /renderImageInfo/);
    assert.match(t, /\/var\/run\/docker\.sock/);
    assert.match(t, /socketPath/);
    assert.match(t, /core\.info/);
    assert.match(t, /core\.summary/);
  });

  test('script consulta /containers/<id>/json (campo Image) e /images/<Image>/json (campo RepoDigests)', () => {
    const t = step().lines.join('\n');
    assert.match(t, /node:http/);
    assert.match(t, /\/containers\//);
    assert.match(t, /\/images\//);
    assert.match(t, /\/json/);
    assert.match(t, /\bImage\b/);
    assert.match(t, /RepoDigests/);
  });

  test('cada pedido ao Docker tem tempo limite de 5 segundos', () => {
    const t = step().lines.join('\n');
    assert.match(t, /timeout[^\n]{0,40}?\b(5000|5_000|5\s*\*\s*1000)\b/);
  });

  test('escreve no resumo do job com core.summary.addRaw(...).write()', () => {
    const t = step().lines.join('\n');
    assert.match(t, /core\.summary\s*\.addRaw\([^)]*\)\s*\.write\(\)/);
  });
});

test.describe('php-quality.yml: chaves de topo', () => {
  test('name, on, concurrency e jobs', () => {
    const keys = topLevelKeys(readWorkflow());
    for (const k of ['name', 'on', 'concurrency', 'jobs']) assert.ok(keys.includes(k), `chave ${k} ausente`);
  });
});

// ---------------------------------------------------------------------------
// Contrato: docs/versao-da-automacao.md (permissões e passos comuns aos três workflows)
// ---------------------------------------------------------------------------

const OIDC_UNAVAILABLE_MESSAGE = 'não foi possível descobrir a versão do Elavora/.github: conceda "id-token: write" ao job chamador ou informe a entrada automation_ref (PRs de fork não recebem id-token)';

const REUSABLE = ['php-quality.yml', 'release.yml', 'sync-labels.yml'];

function readNamed(name) {
  const file = path.join(__dirname, '..', '.github', 'workflows', name);
  assert.ok(fs.existsSync(file), `.github/workflows/${name} precisa existir`);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

for (const name of REUSABLE) {
  test.describe(`${name}: versão da automação`, () => {
    test('não declara permissions (nem no topo nem nos jobs)', () => {
      const found = lines(readNamed(name)).filter((l) => /^\s*permissions\s*:/.test(l));
      assert.deepEqual(found, [], `${name} não deve declarar permissions`);
    });

    test("automation_ref: string, opcional, padrão ''", () => {
      const call = block(readNamed(name), 'workflow_call');
      assert.ok(call, 'workflow_call ausente');
      const inputs = block(call, 'inputs');
      assert.ok(inputs, 'inputs ausente');
      const b = block(inputs, 'automation_ref');
      assert.ok(b, 'entrada automation_ref ausente');
      assert.equal(scalar(b, 'type'), 'string');
      assert.notEqual(scalar(b, 'required'), 'true');
      assert.equal(scalar(b, 'default'), '');
    });

    test('obtém a versão pelo OIDC, com a mensagem literal', () => {
      const t = lines(readNamed(name)).join('\n');
      assert.match(t, /core\.getIDToken\(/);
      assert.match(t, /job_workflow_sha/);
      assert.match(t, /job_workflow_ref/);
      assert.ok(t.includes(OIDC_UNAVAILABLE_MESSAGE), 'OIDC_UNAVAILABLE_MESSAGE precisa estar escrita literalmente no workflow');
    });

    test('checkout dos scripts em automation_ref || job_workflow_sha', () => {
      const t = lines(readNamed(name)).join('\n');
      assert.match(t, /inputs\.automation_ref\s*\|\|[^\n]*job_workflow_sha/);
    });

    test('confere a versão com resolveAutomationRef de scripts/automation-ref.cjs', () => {
      const t = lines(readNamed(name)).join('\n');
      assert.match(t, /automation-ref\.cjs/);
      assert.match(t, /resolveAutomationRef/);
    });

    test('não grava o token OIDC em saída de passo', () => {
      const t = lines(readNamed(name)).join('\n');
      assert.doesNotMatch(t, /setOutput\(\s*['"][^'"]*token[^'"]*['"]/i);
    });
  });
}

test.describe('release.yml: ref resolvido no job packagist', () => {
  test('job release expõe a saída automation_ref e o packagist a usa', () => {
    const t = lines(readNamed('release.yml')).join('\n');
    const jobs = block(t, 'jobs');
    assert.ok(jobs, 'jobs ausente');
    const release = block(jobs, 'release');
    assert.ok(release, 'job release ausente');
    const outputs = block(release, 'outputs');
    assert.ok(outputs, 'job release precisa de outputs');
    assert.ok(scalar(outputs, 'automation_ref'), 'saída automation_ref ausente');
    assert.match(t, /needs\.release\.outputs\.automation_ref/);
  });
});
