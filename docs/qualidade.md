# Qualidade do código PHP

[README](../README.md) · Veja também: [Release automática](release.md) · [Regras de versão](versionamento.md)

## Por que existe

Os pacotes PHP da Elavora (`api-*`) precisam seguir o mesmo padrão de código e passar pelas mesmas checagens em
todo pull request, mesmo quando quem contribui não usou o devcontainer. Em vez de cada repositório manter um CI
próprio, todos chamam um workflow reutilizável deste repositório. Ele:

1. **organiza o código** com o PHP-CS-Fixer no padrão PER-CS e, se algo mudou, commita a correção na branch do PR;
2. **confere estilo e análise estática**: `.editorconfig`, `composer lint` e PHPStan (`composer analyse`), além da
   auditoria de dependências (`composer audit`);
3. **roda os testes** (`composer test`) com as dependências nas versões mínimas e mede a cobertura;
4. **deixa um comentário fixo no PR**, atualizado a cada execução, dizendo "testes rodaram ok" ou "testes com erro",
   com o resultado de cada etapa.

O resultado não bloqueia o merge, porque não existe check obrigatório nem ruleset. O comentário e o check vermelho
servem de aviso para quem revisa.

Cada coisa vem de um lugar:

| O quê | Onde fica | Quem atualiza |
| --- | --- | --- |
| Ferramentas (PHP-CS-Fixer e editorconfig-checker) | imagem `ghcr.io/elavora/php-dev:8.3-latest`, do `Elavora/devcontainers` | ninguém: a `8.3-latest` acompanha cada estável do `devcontainers` (ver [Imagem do job](#imagem-do-job)) |
| Regras de estilo (configuração do PHP-CS-Fixer e `.editorconfig`) | pacote Composer `elavora/code-standards`, no `require-dev` de cada repositório | Dependabot (ecossistema `composer`) |
| Workflow de qualidade e scripts | este repositório (`Elavora/.github`) | troca da versão no chamador |

## Visão geral: o que acontece num PR

Exemplo: alguém abre um PR no `api-framework` com dois arquivos mal indentados.

1. O workflow roda dentro da imagem `ghcr.io/elavora/php-dev:8.3-latest` e registra no resumo do job qual imagem
   (digest) rodou.
2. Roda o `composer install`, que também sincroniza o `.editorconfig` e o `.php-cs-fixer.dist.php` com a versão
   instalada do `elavora/code-standards`.
3. O PHP-CS-Fixer, com a configuração do pacote, corrige os dois arquivos. O workflow faz o commit
   `style: organiza o código` na branch do PR, junto com os arquivos que a sincronização tiver alterado.
4. No mesmo job, já sobre o código corrigido, roda o editorconfig-checker. Depois o workflow troca as dependências
   pelas versões mínimas e roda o `composer audit`, o `composer lint`, o `composer analyse` e o `composer test`, com
   a cobertura.
5. O PR recebe (ou tem atualizado) um comentário como este:

   > **Qualidade: testes rodaram ok**
   >
   > | Etapa | Resultado | Detalhe |
   > | --- | --- | --- |
   > | Dependências (Composer) | ok | dependências mínimas instaladas (--prefer-lowest) |
   > | Auditoria (composer audit) | ok | nenhum problema encontrado |
   > | Formatação (PHP-CS-Fixer) | corrigido | 2 arquivo(s) corrigido(s) no commit "style: organiza o código" |
   > | EditorConfig | ok | sem problemas |
   > | Lint (composer lint) | ok | sem problemas |
   > | PHPStan (composer analyse) | ok | sem problemas |
   > | Testes (composer test) | ok | testes passaram |
   > | Cobertura | ok | 85,5% (mínimo 80%) |

6. Quem desenvolve precisa dar `git pull` antes do próximo push, porque a branch ganhou um commit novo.

Em PR de fork, em PR do Dependabot e em push na `main`, o workflow não commita: só informa quantos arquivos
precisam de formatação (ver [Modo de formatação](#modo-de-formatação-commit-ou-aviso)).

## Como adotar num repositório `api-*`

1. Adote as regras de estilo do `elavora/code-standards` (ver [Regras de estilo](#regras-de-estilo-elavoracode-standards)):
   o pacote no `require-dev`, o stub `.php-cs-fixer.dist.php` e o `.editorconfig` copiado pelo comando do pacote.
2. Acrescente ao `.gitignore` as linhas `/.elavora/` (a pasta onde o CI guarda os scripts centrais) e
   `/.php-cs-fixer.php` (o override pessoal).
3. Crie `.github/workflows/quality.yml` com o chamador abaixo, com a versão estável atual do `.github` no `uses`.
   A versão aparece uma vez só, e o workflow descobre a própria versão pelo OIDC (ver
   [versao-da-automacao.md](versao-da-automacao.md)):

   ```yaml
   name: Qualidade

   on:
     pull_request:
       branches: [main]
     push:
       branches: [main]

   permissions:
     contents: read

   jobs:
     quality:
       permissions:
         contents: write
         pull-requests: write
         id-token: write
       uses: Elavora/.github/.github/workflows/php-quality.yml@1.1.0
   ```

   O chamador não passa `image`: o padrão `8.3-latest` é o recomendado. Passe `image` só para fixar uma versão (ver
   [Imagem do job](#imagem-do-job)).
4. Use no `.devcontainer/devcontainer.json` a imagem `ghcr.io/elavora/php-dev:8.3-latest`, a mesma do CI (ver
   [No devcontainer](#no-devcontainer)).
5. Remova o `quality.yml` antigo, o que chama o SHA `1e0f42a` da branch `fix/centraliza-automacao`.
6. Se o repositório tiver proteção de branch com checks obrigatórios, retire ou troque os nomes antigos
   (ver [Nomes de job e de check](#nomes-de-job-e-de-check)).

O primeiro PR de adoção costuma receber um commit `style:` grande, porque o código existente passa a seguir o
PER-CS de uma vez. Ele também pode mostrar falhas que antes não apareciam, já que testes com dependências mínimas,
auditoria e cobertura passam a rodar em todo repositório.

## Regras de estilo (`elavora/code-standards`)

As regras não ficam neste repositório. Elas são o pacote Composer `elavora/code-standards`
(repositório `Elavora/code-standards`), instalado no `require-dev` de cada projeto. Assim, o Dependabot atualiza
as regras como qualquer outra dependência.

**Dependência explícita:** este workflow segue o contrato do `elavora/code-standards` **1.0.0**, descrito em
`docs/integracao-ci.md` daquele repositório. Os itens que o workflow usa:

| Item | Valor |
| --- | --- |
| Pacote | `elavora/code-standards`, no `require-dev`, versão `^1.0` |
| Configuração do PHP-CS-Fixer | `Elavora\CodeStandards\PhpCsFixer::config(string $dir)`, em `vendor/elavora/code-standards/src/PhpCsFixer.php` |
| Sincronização automática | callback `Elavora\CodeStandards\Composer::sync` em `post-install-cmd` e `post-update-cmd` do `composer.json` do projeto |
| Comando de sincronização | `vendor/bin/elavora-standards sync` |
| Arquivos que a sincronização pode criar ou alterar | só `.editorconfig` e `.php-cs-fixer.dist.php`, na raiz |

O pacote não exige `friendsofphp/php-cs-fixer`: o binário vem da imagem. A adoção é `composer require --dev
elavora/code-standards:^1.0`, com o callback nos dois eventos do `composer.json`. O primeiro `composer install`
cria os dois arquivos, que são commitados.

No repositório que adota o pacote:

- `.php-cs-fixer.dist.php` (versionado) é o stub que a sincronização cria. Ele carrega só o arquivo da classe, e não
  o `vendor/autoload.php`, para não misturar as dependências do projeto com as do PHAR do PHP-CS-Fixer:

  ```php
  <?php

  require_once __DIR__ . '/vendor/elavora/code-standards/src/PhpCsFixer.php';

  return Elavora\CodeStandards\PhpCsFixer::config(__DIR__);
  ```

- `.editorconfig` (versionado) traz o bloco que a sincronização mantém, entre `# >>> elavora/code-standards >>>` e
  `# <<< elavora/code-standards <<<`. O editor e o editorconfig-checker só leem o `.editorconfig` da árvore do projeto.
- `.php-cs-fixer.php` (fora do git) é um override pessoal opcional, que parte do stub:

  ```php
  <?php

  declare(strict_types=1);

  $config = require __DIR__ . '/.php-cs-fixer.dist.php';

  return $config->setRules([...$config->getRules(), 'some_rule' => false]);
  ```

### Como o workflow escolhe a configuração

**PHP-CS-Fixer**, na ordem, vale o primeiro que existir na raiz do repositório:

| Arquivo | Comando | Observação no relatório |
| --- | --- | --- |
| `.php-cs-fixer.php` | `php-cs-fixer fix --config=.php-cs-fixer.php --no-interaction --show-progress=none` | nenhuma (na prática não existe no CI, porque fica fora do git) |
| `.php-cs-fixer.dist.php` | `php-cs-fixer fix --config=.php-cs-fixer.dist.php --no-interaction --show-progress=none` | nenhuma |
| nenhum dos dois | `php-cs-fixer fix --rules=@PER-CS --allow-risky=no --using-cache=no --no-interaction --show-progress=none .` | aviso: o repositório não adotou o `elavora/code-standards` |

É a mesma ordem do PHP-CS-Fixer e da extensão do VS Code. Com um arquivo de configuração, o workflow não passa
`--rules`, `--allow-risky` nem `--using-cache`, porque eles substituiriam o que a configuração do pacote define.

A escolha acontece **depois** do `composer install`: o stub depende de `vendor/elavora/code-standards/`, e a
sincronização pode ter acabado de criar o `.php-cs-fixer.dist.php`.

**EditorConfig:** com `.editorconfig` na raiz, o editorconfig-checker roda. Sem ele, a conferência é pulada e o
relatório mostra um aviso de que o repositório não adotou o `elavora/code-standards`. O workflow não usa um
`.editorconfig` próprio.

### No devcontainer

O devcontainer usa as mesmas ferramentas e os mesmos arquivos de configuração do CI, e organiza o código ao
salvar. Basta o `.devcontainer/devcontainer.json` seguir o
[`examples/devcontainer.json`](https://github.com/Elavora/devcontainers/blob/main/examples/devcontainer.json) do
`Elavora/devcontainers`, a partir da imagem `ghcr.io/elavora/php-dev:8.3-latest`, que traz:

- `php-cs-fixer` e `editorconfig-checker` em `/usr/local/bin`. São as mesmas versões do CI quando o devcontainer
  está com a mesma imagem que o CI baixou. O CI baixa a `8.3-latest` a cada execução, mas o devcontainer usa a cópia
  que já está na máquina. Depois de uma estável nova do `devcontainers`, reconstrua o container (no VS Code,
  "Dev Containers: Rebuild Container", ou `docker pull ghcr.io/elavora/php-dev:8.3-latest` antes) para voltar a
  bater com o CI. O digest no resumo do job do CI diz qual imagem ele usou.
- As extensões `junstyle.php-cs-fixer` e `EditorConfig.EditorConfig`, com formatação ao salvar. A extensão do
  PHP-CS-Fixer procura `.php-cs-fixer.php` e depois `.php-cs-fixer.dist.php` na raiz, e encontra o stub sem
  nenhuma configuração extra. O `postCreateCommand` do exemplo já roda o `composer install`, que traz o pacote para
  o `vendor/`.

No terminal do devcontainer, na raiz do projeto, os comandos são os mesmos do CI:

```sh
php-cs-fixer fix                                  # usa .php-cs-fixer.php ou .php-cs-fixer.dist.php
git ls-files -z | xargs -0 editorconfig-checker   # confere só os arquivos versionados
```

## Workflow reutilizável `php-quality.yml`

Arquivo `.github/workflows/php-quality.yml`, com o nome `Qualidade PHP reutilizável`.

### Gatilho e entradas

Só `workflow_call`. Ele espera ser chamado a partir de `pull_request` ou de `push` na `main`.

| Entrada | Tipo | Obrigatória | Padrão | Uso |
| --- | --- | --- | --- | --- |
| `automation_ref` | string | não | `''` (descobre pelo OIDC) | versão do `.github` (tag estável ou SHA completo), a mesma do `uses`; ver [versao-da-automacao.md](versao-da-automacao.md) |
| `image` | string | não | `ghcr.io/elavora/php-dev:8.3-latest` | imagem do job; use só imagens `ghcr.io/elavora/php-dev`. Omita para acompanhar a última estável; passe só para fixar uma versão (ver [Imagem do job](#imagem-do-job)) |
| `coverage_min` | number | não | `80` | cobertura mínima em %. Abaixo dela, o relatório mostra aviso, sem erro. `0` desliga a etapa |
| `composer_audit` | boolean | não | `true` | roda `composer audit` depois de instalar as dependências |
| `dependencies` | string | não | `lowest` | `lowest` instala as versões mínimas; `install` usa `composer install` |

Não há secrets. Um valor de `dependencies` fora de `lowest` e `install` faz o job falhar logo no início.

As três opções vêm ligadas porque reproduzem o que o `api-framework` já fazia no CI antigo: cobertura de 80%,
dependências mínimas e auditoria. Um repositório desliga uma delas passando o valor no `with` do chamador.
Não há matriz de versões de PHP, porque a imagem só tem o PHP 8.3; uma matriz dependeria de variantes da imagem.

### Permissões

O job do chamador precisa conceder `contents: write` (para enviar o commit de formatação), `pull-requests: write`
(para o comentário) e `id-token: write` (para descobrir a versão da automação quando `automation_ref` é omitido).
O workflow reutilizável não declara `permissions` e herda as do chamador (ver
[versao-da-automacao.md](versao-da-automacao.md#permissões)).

### Nomes de job e de check

Os nomes são **estáveis** e fazem parte do contrato. Mudar qualquer um deles é uma mudança incompatível
(label `upgrade`).

- O workflow reutilizável tem um único job, com id `quality` e nome `Qualidade PHP`.
- Com o chamador recomendado (job `quality`), o check aparece no PR como **`quality / Qualidade PHP`**.

**Armadilha:** um repositório com proteção de branch e checks obrigatórios (por exemplo `Composer Quality` ou
`Quality Gate`, do workflow antigo) precisa ajustar a proteção quando adota o workflow central. Senão, o PR fica
esperando para sempre um check que não roda mais. Pela decisão da organização, este check não deve ser
obrigatório: a adoção retira os checks antigos da proteção.

### Ambiente

- `runs-on: ubuntu-latest`, `timeout-minutes: 20`.
- `container.image: ${{ inputs.image }}`, com `options: --user root`. A imagem usa o usuário `vscode`, mas no CI a
  pasta de trabalho pertence ao runner, e o checkout falharia sem root.
- Variáveis do job: `COMPOSER_ALLOW_SUPERUSER: '1'` e `COMPOSER_NO_INTERACTION: '1'`.
- O PHP-CS-Fixer e o editorconfig-checker são chamados pelo nome (`php-cs-fixer` e `editorconfig-checker`), no
  `PATH` da imagem, nas versões que a imagem traz. Não existe o alias `ec`.

### Imagem do job

**Padrão:** `ghcr.io/elavora/php-dev:8.3-latest`. É a referência móvel que o `Elavora/devcontainers` publica: ela só
muda quando o `devcontainers` lança uma versão **estável** (por exemplo `8.3-0.4.0`), e passa a apontar para a mesma
imagem dessa versão. Uma beta (`8.3-0.4.0-beta.1`) nunca move a `8.3-latest`. Com isso, o CI de todos os pacotes
acompanha a imagem sozinho, sem PR de troca de versão em cada repositório. Os devcontainers dos projetos usam a
mesma `8.3-latest`.

Os chamadores da organização (`api-framework`, `api-skeleton` e os demais `api-*`) **não passam** `image`.

**Risco:** uma estável nova da imagem vale para o CI de todos os repositórios **na hora**, já na próxima execução.
Os runners do GitHub começam sempre vazios e baixam a `8.3-latest` a cada job, então não existe uma janela em que a
versão antiga continue valendo. Se a imagem nova trouxer, por exemplo, um PHP-CS-Fixer com uma regra diferente, PRs
que não mexeram no código podem passar a receber commit `style:` ou ficar com erro.

**Como fixar:** quem precisar de uma imagem estável e conhecida passa `image` no `with` do chamador, com uma versão
publicada do `devcontainers` ou com o digest:

```yaml
    uses: Elavora/.github/.github/workflows/php-quality.yml@1.3.0
    with:
      image: ghcr.io/elavora/php-dev:8.3-0.3.0
      # ou, para travar a imagem exata:
      # image: ghcr.io/elavora/php-dev@sha256:<digest>
```

Fixar é a saída quando uma estável nova da imagem quebra o CI: o repositório afetado fixa a versão anterior até o
`devcontainers` lançar uma correção, e depois volta a omitir `image`. A `8.3-latest` não volta para trás sozinha:
ela só anda de novo com a próxima estável do `devcontainers`.

**Qual imagem rodou:** cada execução registra a imagem e o digest no log do passo `Registrar a imagem` e no resumo do
job, numa linha antes do relatório:

> Imagem do job: `ghcr.io/elavora/php-dev:8.3-latest` · digest `sha256:3f1c...e9a2`

Quando o digest não pode ser obtido, a linha diz `digest não disponível`, e o job segue normalmente. Nesse caso, o
log do passo `Initialize containers`, que o próprio runner escreve, mostra o `Digest: sha256:...` do `docker pull`.
O comentário fixo no PR não muda.

Para saber a qual versão o digest corresponde, compare com as versões publicadas do pacote `php-dev` no GitHub
(Packages do `Elavora/devcontainers`): a versão estável e a `8.3-latest` daquele momento têm o mesmo digest.

### Concorrência

Grupo `elavora-quality-${{ github.repository }}-${{ github.event.pull_request.number || github.ref }}`, com
`cancel-in-progress: true`. Um push novo no PR cancela a execução anterior, que ficaria desatualizada.

### Passos

1. **Validar as entradas**: falha se `dependencies` não for `lowest` nem `install`. Em seguida, obtém a versão da
   automação (`automation_ref` ou a claim `job_workflow_sha` do OIDC), como nos passos comuns de
   [versao-da-automacao.md](versao-da-automacao.md#passos-comuns-aos-três-workflows). Sem as duas, o job falha aqui,
   antes do relatório.
2. **Checkout do repositório**, com `fetch-depth: 1` e **sem** persistir credenciais:
   - em `pull_request`: `ref: github.event.pull_request.head.sha`, o último commit da branch do PR (e não o merge
     com a `main`, porque a correção de formatação precisa ser commitada na branch);
   - em `push`: `github.sha`.
3. **Marcar o diretório como seguro** para o git (`git config --global --add safe.directory "$GITHUB_WORKSPACE"`).
4. **Checkout dos scripts**: `Elavora/.github` na versão obtida no passo 1, em `.elavora/`, só com `scripts/`, sem
   persistir credenciais. Depois, confere a versão com `resolveAutomationRef`. Em seguida vem o passo
   **Registrar a imagem** (ver [Passo `Registrar a imagem`](#passo-registrar-a-imagem)), que nunca interrompe o job.
5. **Decidir o modo de formatação** com `formatMode` (ver [Referência](#referência-scriptsqualitycjs)): `commit` ou
   `report`, e o motivo.
6. **Ler os scripts do Composer** com `composerScripts` sobre o `composer.json`. Se a função lançar erro
   (`composer.json` inválido), o passo registra a mensagem como aviso no log (`core.warning`) e segue com a lista
   vazia. O erro de verdade aparece depois, na instalação, e o `composer test` ausente vira erro no relatório.
7. **Instalar as dependências** com `composer install --no-progress --prefer-dist`, **com scripts**, sem
   interromper o job em caso de falha. É essa instalação que roda a sincronização do `elavora/code-standards`
   (`Elavora\CodeStandards\Composer::sync`) e pode criar ou alterar o `.editorconfig` e o `.php-cs-fixer.dist.php`.
   Logo depois, o workflow registra quais desses dois arquivos aparecem alterados ou novos no `git status`
   (`syncFiles`).
8. **Formatar** (só com o passo 7 concluído):
   - guarda a lista dos arquivos versionados já alterados antes da formatação (`git diff --name-only`), que inclui
     os `syncFiles` já versionados;
   - escolhe a configuração (ver [Como o workflow escolhe a configuração](#como-o-workflow-escolhe-a-configuração))
     e roda o `php-cs-fixer fix`, guardando o código de saída sem interromper o job;
   - calcula os arquivos alterados pela formatação com `filesChangedByFormatter(antes, depois)`;
   - se o modo é `report` ou o código de saída não é 0, desfaz só esses arquivos (`git checkout -- <arquivos>`).
     Assim, o lint e os testes rodam sobre o código que está na branch. Os `syncFiles` continuam na pasta de
     trabalho, sem commit.
9. **Commitar e enviar** (só quando o modo é `commit`, o código de saída é 0 e há arquivos alterados pela formatação
   ou `syncFiles`): ver [Commit de formatação](#commit-de-formatação). Se o push falhar, o job continua: o commit
   local é desfeito (`git reset --mixed <sha original>`) e os arquivos formatados voltam ao original
   (`git checkout -- <arquivos>`). Os `syncFiles` continuam na pasta de trabalho.
10. **EditorConfig**: com `.editorconfig` na raiz, roda `git ls-files -z | xargs -0 editorconfig-checker` a partir da
    raiz, sem interromper o job. A árvore já está sincronizada, então a conferência usa as regras da versão
    instalada do pacote. Só os arquivos versionados são conferidos, e `vendor/` e `.elavora/` ficam de fora. Um
    `.editorconfig` criado agora pela sincronização ainda não é versionado, mas vale como regra. Um
    `.editorconfig-checker.json` na raiz (o arquivo de configuração da v4; o `.ecrc` não é mais lido) é respeitado,
    por exemplo para excluir arquivos gerados. Sem `.editorconfig`, o passo não roda.
11. **Dependências mínimas** (só com `dependencies: lowest` e o passo 7 concluído):
    `composer update --prefer-lowest --prefer-stable --no-progress --prefer-dist`, sem interromper o job. Ela roda
    depois da formatação e do commit de propósito. A sincronização roda de novo com a versão mínima do pacote e
    pode reescrever os dois arquivos com regras mais antigas, e essas mudanças, assim como o `composer.lock`
    alterado, nunca vão para o commit. Daqui em diante, nenhum passo usa esses arquivos.
12. **Auditoria** (só com `composer_audit: true` e a instalação concluída): `composer audit`, sobre as dependências
    que serão testadas.
13. **Lint** (só com a instalação concluída e o script `lint` no `composer.json`): `composer lint`.
14. **PHPStan** (só com a instalação concluída e o script `analyse`): `composer analyse`.
15. **Testes** (só com a instalação concluída e o script `test`):
    - `coverage_min` igual a `0`: `composer test`;
    - `coverage_min` maior que `0`: `XDEBUG_MODE=coverage composer test -- --coverage-clover=<temporário>/coverage.xml`.
      Isso exige que o script `test` chame o PHPUnit diretamente, para receber os argumentos extras.
16. **Cobertura** (só com `coverage_min` maior que `0`): lê o relatório com `coveragePercent`.
17. **Relatório** (sempre, mesmo com falhas anteriores): monta as etapas com `buildStages` e o texto com
    `renderReport`, e o grava no resumo do job (`$GITHUB_STEP_SUMMARY`). Quando o modo é `commit`, cria ou atualiza o
    comentário fixo no PR (ver [Comentário fixo](#comentário-fixo-no-pr)).
18. **Resultado**: se `overallStatus` for `error`, o job falha com a mensagem `testes com erro`.

Nos passos acima, "a instalação concluída" significa o passo 7 concluído e, com `dependencies: lowest`, também o
passo 11. Os passos 7, 8, 10, 11, 12, 13, 14 e 15 não interrompem o job quando falham: o resultado de cada um vai
para o relatório.

### Passo `Registrar a imagem`

Passo do workflow com o nome exato `Registrar a imagem`, logo depois de `Conferir a versão da automação` e antes de
`Decidir o modo de formatação`. Ele:

- usa `actions/github-script`, fixado pelo mesmo SHA dos outros passos (`v9.0.0`);
- tem `continue-on-error: true` e nenhum `if`, para rodar em toda execução que chegou até ele;
- recebe no `env` `IMAGE: ${{ inputs.image }}` e `CONTAINER_ID: ${{ job.container.id }}`.

O script:

1. Pergunta ao Docker do runner, pelo socket `/var/run/docker.sock` (que o runner monta no container do job), com
   o módulo `node:http` e a opção `socketPath`:
   - `GET /containers/<CONTAINER_ID>/json` e lê o campo `Image` (o id local da imagem);
   - `GET /images/<Image>/json` e lê o campo `RepoDigests` (por exemplo
     `["ghcr.io/elavora/php-dev@sha256:3f1c..."]`).

   Cada pedido tem tempo limite de 5 segundos. Qualquer falha (socket ausente, `CONTAINER_ID` vazio, resposta que
   não é 200, JSON inválido, tempo esgotado) é tratada como `RepoDigests` vazio, sem aviso e sem erro.
2. Calcula o digest com `imageDigest({ image: IMAGE, repoDigests })` e o texto com `renderImageInfo({ image: IMAGE,
   digest })`, ambos de `scripts/quality.cjs`.
3. Escreve o texto no log (`core.info`) e no resumo do job (`core.summary.addRaw(texto).write()`). Como este passo
   roda antes do `Relatório`, a linha aparece acima da tabela no resumo.

O passo não muda o resultado do job, as etapas do relatório nem o comentário fixo no PR.

### Modo de formatação: commit ou aviso

| Situação | Modo | O que acontece |
| --- | --- | --- |
| PR de uma branch do próprio repositório | `commit` | corrige e commita na branch do PR |
| PR vindo de fork | `report` (`fork`) | o token é só leitura: informa os arquivos, sem commit |
| PR aberto pelo Dependabot | `report` (`dependabot`) | o token do Dependabot é só leitura: informa, sem commit |
| push na `main` | `report` (`push`) | nunca commita direto na `main`: informa no resumo do job |
| qualquer outro evento | `report` (`evento`) | informa, sem commit |

No modo `report`, código sem formatação gera um **aviso**, e não um erro. O resultado geral continua
"testes rodaram ok" se o resto passou.

O comentário no PR só é escrito no modo `commit`. Nos outros, o token não pode comentar (fork e Dependabot) ou não
há PR (push), e o resultado fica só no resumo do job.

### Commit de formatação

- **Identidade:** `github-actions[bot]`, com o e-mail `41898282+github-actions[bot]@users.noreply.github.com`,
  passada só no comando (`git -c user.name=... -c user.email=...`).
- **Token:** o `GITHUB_TOKEN` do job (`github.token`). Ele entra só no ambiente deste passo, porque o checkout não
  persiste credenciais. Não há secret nem GitHub App.
- **Mensagem:** exatamente `style: organiza o código`, sem corpo. Todo commit automático da Elavora segue a mesma
  regra dos commits feitos por pessoas: português do Brasil e Conventional Commits.
- **Conteúdo:** os arquivos que o PHP-CS-Fixer alterou e os `syncFiles` (o `.editorconfig` e o
  `.php-cs-fixer.dist.php` que a sincronização do `composer install` criou ou alterou), adicionados um a um
  (`git add -- <arquivos>`). Eles entram porque fazem parte da correção automática: sem eles, a branch ficaria com
  regras diferentes das que o CI usou. O `composer.lock`, `vendor/`, `.elavora/` e qualquer outro arquivo nunca
  entram, nem as mudanças da segunda sincronização (passo 11).
- **Envio:** `git -c core.hooksPath=/dev/null push "https://x-access-token:${GITHUB_TOKEN}@github.com/<owner>/<repo>.git" HEAD:refs/heads/<branch do PR>`,
  sem `--force`. Os hooks ficam desligados (`-c core.hooksPath=/dev/null`) **no commit e no push**, porque o código
  do repositório e das dependências já rodou nos passos anteriores e poderia ter instalado um hook. Se a branch andou durante a execução, o push é recusado e a etapa
  vira aviso. A execução nova, disparada pelo push que moveu a branch, refaz a formatação.

**Por que o lint e os testes rodam no mesmo job.** Um commit feito com o `GITHUB_TOKEN` não dispara outros
workflows. Se o lint e os testes dependessem de uma nova execução depois do commit, ela nunca aconteceria. Por isso
o commit acontece antes deles, e as etapas seguintes rodam sobre o código já corrigido.

**Consequências:**

- O commit `style:` não tem check próprio no PR. O check `quality / Qualidade PHP` fica no commit anterior, e o
  comentário diz qual commit foi testado.
- Não há laço: o commit do bot não dispara uma nova execução.
- Quem desenvolve precisa dar `git pull` antes do próximo push.

### Comentário fixo no PR

- Um único comentário por PR, identificado pelo marcador `<!-- elavora-quality -->` na primeira linha e pelo autor
  `github-actions[bot]`.
- A cada execução, o workflow lista os comentários do PR (com paginação) e procura o comentário com
  `findQualityComment`. Se achar, atualiza o texto; se não, cria um novo.
- Uma falha ao comentar gera um aviso no log (`core.warning`), mas não muda o resultado do job.

### Resultado do job

- Erro em qualquer etapa (`overallStatus` igual a `error`): o comentário diz "testes com erro" e o job termina em
  falha, com o check vermelho. Como o check não é obrigatório, o merge continua liberado.
- Sem erro: "testes rodaram ok" e o job termina com sucesso, mesmo com avisos ou etapas puladas. Cobertura abaixo
  do mínimo é aviso, nunca erro.

### Limitações

- O lint e os testes rodam sobre o último commit da branch do PR, e não sobre o merge com a `main`.
- Serviços de integração (Redis, MySQL, PostgreSQL, MongoDB), que o workflow antigo subia, não fazem parte da
  1.1.0. Testes que dependem deles precisam ficar fora do `composer test` por enquanto.
- Só PHP 8.3, a versão da imagem.
- PRs de fork não recebem `id-token`, e o job falha no passo 1 com uma mensagem pedindo o `automation_ref`, sem
  relatório nem comentário. Nos PRs do Dependabot, a concessão do `id-token` precisa ser conferida no primeiro PR
  real (ver [versao-da-automacao.md](versao-da-automacao.md#riscos-e-limitações)).

## Referência: `scripts/quality.cjs`

Módulo CommonJS sem dependências externas, usado pelo workflow via `actions/github-script`. Todas as funções são
puras: não leem arquivos, variáveis de ambiente nem a rede.

### Constantes exportadas

- `MARKER`: a string `<!-- elavora-quality -->`.
- `COMMIT_MESSAGE`: a string `style: organiza o código`.
- `BOT_LOGIN`: a string `github-actions[bot]`.
- `STATUS_LABELS`: `{ ok: 'ok', fixed: 'corrigido', warning: 'aviso', error: 'erro', skipped: 'pulado' }`.

### `formatMode({ eventName, headRepo, baseRepo, actor })`

Devolve `{ mode, reason }`. As regras são avaliadas nesta ordem, e vale a primeira que casar:

| Condição | Resultado |
| --- | --- |
| `eventName` é `push` | `{ mode: 'report', reason: 'push' }` |
| `eventName` não é `pull_request` (nem `push`) | `{ mode: 'report', reason: 'evento' }` |
| `headRepo` vazio, ausente ou diferente de `baseRepo` (sem diferenciar caixa) | `{ mode: 'report', reason: 'fork' }` |
| `actor` é `dependabot[bot]` | `{ mode: 'report', reason: 'dependabot' }` |
| nenhuma das anteriores | `{ mode: 'commit', reason: null }` |

`headRepo` e `baseRepo` são nomes completos (`Elavora/api-framework`). Exemplos:

- `{ eventName: 'pull_request', headRepo: 'Elavora/api-framework', baseRepo: 'elavora/API-framework', actor: 'fulano' }`
  → `{ mode: 'commit', reason: null }`;
- `{ eventName: 'pull_request', headRepo: 'fulano/api-framework', baseRepo: 'Elavora/api-framework', actor: 'fulano' }`
  → `{ mode: 'report', reason: 'fork' }`;
- `{ eventName: 'push', ... }` → `{ mode: 'report', reason: 'push' }`, sejam quais forem os outros campos.

### `composerScripts(text)`

Recebe o conteúdo do `composer.json` como string e devolve um array com os nomes dos scripts (as chaves de
`scripts`), na ordem em que aparecem.

- `text` `null`, `undefined` ou vazio (o arquivo não existe) → `[]`.
- `scripts` ausente, ou que não é um objeto (por exemplo um array) → `[]`.
- JSON inválido → lança `Error` com uma mensagem que contém `composer.json`.

Exemplo: `'{"scripts":{"lint":"php tools/lint.php","test":"phpunit"}}'` → `['lint', 'test']`.

### `filesChangedByFormatter(before, after)`

Recebe duas listas de caminhos (a saída de `git diff --name-only` antes e depois do PHP-CS-Fixer) e devolve os
caminhos de `after` que não estão em `before`, na ordem de `after` e sem repetição. Linhas vazias são ignoradas.
Cada argumento pode ser um array de strings ou uma string com um caminho por linha (`\n`).

Exemplo: `before = 'composer.lock\n'` e `after = 'composer.lock\nsrc/A.php\nsrc/B.php\n'` →
`['src/A.php', 'src/B.php']`.

### `coveragePercent(cloverXml)`

Recebe o relatório Clover do PHPUnit como string e devolve a cobertura de statements em porcentagem (número, sem
arredondar), ou `null`.

- Usa o último elemento `<metrics ...>` antes de `</project>`, que é o total do projeto, e os atributos
  `statements` e `coveredstatements`: `coveredstatements / statements * 100`.
- `statements="0"` → `0`.
- Sem `</project>`, sem `<metrics>` ou sem um dos dois atributos, ou com `cloverXml` vazio, `null` ou `undefined` →
  `null`.

Exemplo: `<project><file name="a.php"><metrics statements="10" coveredstatements="5"/></file><metrics files="1" statements="200" coveredstatements="171"/></project>`
→ `85.5`.

### `buildStages(input)`

Monta a lista de etapas do relatório. Cada etapa é `{ id, name, status, detail }`, e a de formatação também tem
`files`: os `changedFiles`, seguidos dos `syncFiles` que ainda não estão neles. `status` é uma das chaves de
`STATUS_LABELS`.

Entrada:

```js
{
  install: 'success',                // resultado do passo 7 (composer install)
  dependencies: 'lowest',            // opcional; padrão 'lowest'
  lowest: 'success',                 // resultado do passo 11; só conta com dependencies 'lowest'
  audit: { enabled: true, outcome: 'success' },  // opcional; ausente = desligada
  format: { mode, reason, config, exitCode, changedFiles, syncFiles, push },
  // config: 'override' | 'dist' | 'fallback'; syncFiles: opcional, padrão []; push: resultado do passo 9
  editorconfig: { present: true, outcome: 'success' },
  scripts: ['lint', 'test', 'analyse'],
  lint: 'success',
  analyse: 'success',
  test: 'success',
  coverage: { min: 80, percent: 85.5 },  // opcional; ausente ou min 0 = desligada
}
```

Os resultados (`outcome`, `install`, `lowest`, `lint`, `analyse`, `test`, `push`) são os do GitHub Actions:
`success`, `failure`, `skipped` ou `cancelled`. Nas regras abaixo, "instalação concluída" significa `install` igual a
`success` e, com `dependencies` `lowest`, também `lowest` igual a `success`.

Ordem e nomes das etapas, que é a ordem de execução. As opcionais só entram na lista quando estão ligadas:

| `id` | `name` | Quando entra |
| --- | --- | --- |
| `install` | `Dependências (Composer)` | sempre |
| `audit` | `Auditoria (composer audit)` | só com `audit.enabled` igual a `true` |
| `format` | `Formatação (PHP-CS-Fixer)` | sempre |
| `editorconfig` | `EditorConfig` | sempre |
| `lint` | `Lint (composer lint)` | sempre |
| `analyse` | `PHPStan (composer analyse)` | sempre |
| `test` | `Testes (composer test)` | sempre |
| `coverage` | `Cobertura` | só com `coverage.min` maior que `0` |

Regras de cada etapa: avaliadas na ordem, vale a primeira que casar. Quando a etapa deveria ter rodado (a
instalação terminou e, quando é o caso, o script existe) e o resultado não é `success` nem `failure`, ela vira
`error` com o detalhe `etapa não concluída (<resultado>)`. Isso vale também para `skipped`
(`etapa não concluída (skipped)`) e para `cancelled`. Um passo que deveria ter rodado e não rodou nunca aparece
como `ok` nem como `pulado`, para não esconder uma falha do workflow.

**`install`**

| Condição | `status` | `detail` |
| --- | --- | --- |
| `install` `failure` ou `skipped` | `error` | `a instalação das dependências falhou; veja o log` |
| `install` `success` e `dependencies` `install` | `ok` | `dependências instaladas` |
| `install` `success`, `dependencies` `lowest` e `lowest` `success` | `ok` | `dependências mínimas instaladas (--prefer-lowest)` |
| `install` `success`, `dependencies` `lowest` e `lowest` `failure` ou `skipped` | `error` | `a instalação das dependências mínimas falhou; veja o log` |

**`audit`**

| Condição | `status` | `detail` |
| --- | --- | --- |
| instalação não concluída | `skipped` | `dependências não instaladas` |
| `outcome` `success` | `ok` | `nenhum problema encontrado` |
| `outcome` `failure` | `error` | `o composer audit encontrou problemas; veja o log` |
| `outcome` `skipped` | `error` | `etapa não concluída (skipped)` |

**`format`** (`<n>` é o número de arquivos em `files`, ou seja, `changedFiles` mais `syncFiles` sem repetição)

| Condição | `status` | `detail` |
| --- | --- | --- |
| `install` diferente de `success` (o passo 8 não rodou) | `skipped` | `dependências não instaladas` |
| `exitCode` diferente de `0` | `error` | `o PHP-CS-Fixer falhou (código <exitCode>); veja o log` |
| `files` vazio | `ok` | `o código já estava formatado` |
| `mode` `commit` e `push` `success` | `fixed` | `<n> arquivo(s) corrigido(s) no commit "style: organiza o código"` |
| `mode` `commit` e `push` diferente de `success` | `warning` | `<n> arquivo(s) precisam de formatação; o commit não pôde ser enviado (veja o log)` |
| `mode` `report` | `warning` | `<n> arquivo(s) precisam de formatação; sem commit automático em <motivo>` |

`<motivo>` vem de `reason`: `push` → `push na main`, `fork` → `PR de fork`, `dependabot` → `PR do Dependabot`,
`evento` → `este evento`.

Com `config` `fallback` (o repositório não tem `.php-cs-fixer.php` nem `.php-cs-fixer.dist.php`), depois de aplicar
a tabela acima:

- `ok` e `fixed` viram `warning`; `warning` e `error` continuam como estão;
- o `detail` ganha no fim o texto `; sem .php-cs-fixer.dist.php, usado @PER-CS puro (o repositório não adotou o elavora/code-standards)`.

A regra do `fallback` não se aplica à linha `skipped`.

Exemplo: `fallback` com `files` vazio → `warning`, `o código já estava formatado; sem .php-cs-fixer.dist.php, usado @PER-CS puro (o repositório não adotou o elavora/code-standards)`.

**`editorconfig`**

| Condição | `status` | `detail` |
| --- | --- | --- |
| `present` `false` | `warning` | `sem .editorconfig na raiz; conferência pulada (o repositório não adotou o elavora/code-standards)` |
| `outcome` `success` | `ok` | `sem problemas` |
| `outcome` `failure` | `error` | `arquivos fora das regras do .editorconfig; veja o log` |
| `outcome` `skipped` | `error` | `etapa não concluída (skipped)` |

**`lint`** e **`analyse`** (`<script>` é `lint` ou `analyse`)

| Condição | `status` | `detail` |
| --- | --- | --- |
| instalação não concluída | `skipped` | `dependências não instaladas` |
| `<script>` fora de `scripts` | `skipped` | `sem o script "<script>" no composer.json` |
| `success` | `ok` | `sem problemas` |
| `failure` | `error` | `falhou; veja o log` |
| `skipped` | `error` | `etapa não concluída (skipped)` |

**`test`**

| Condição | `status` | `detail` |
| --- | --- | --- |
| instalação não concluída | `skipped` | `dependências não instaladas` |
| `test` fora de `scripts` | `error` | `sem o script "test" no composer.json` |
| `success` | `ok` | `testes passaram` |
| `failure` | `error` | `testes falharam; veja o log` |
| `skipped` | `error` | `etapa não concluída (skipped)` |

Um repositório sem `composer test` fica com erro de propósito: sem ele não dá para dizer que os testes rodaram.

**`coverage`** (`<p>` e `<min>` são escritos com no máximo uma casa decimal, truncados e com vírgula: `85.56` →
`85,5`, `80` → `80`). A cobertura só reporta e **nunca** gera `error`:

| Condição | `status` | `detail` |
| --- | --- | --- |
| etapa `test` diferente de `ok` | `skipped` | `testes não passaram` |
| `percent` `null` | `warning` | `relatório de cobertura não encontrado` |
| `percent >= min` (comparando sem arredondar) | `ok` | `<p>% (mínimo <min>%)` |
| `percent < min` | `warning` | `<p>% abaixo do mínimo de <min>%` |

### `overallStatus(stages)`

Devolve `'error'` se alguma etapa tiver `status` `error`, e `'ok'` em qualquer outro caso (inclusive com `fixed`,
`warning` e `skipped`).

### `renderReport({ stages, sha, runUrl })`

Devolve o texto em Markdown do comentário e do resumo, com as linhas separadas por `\n` e terminado em `\n`:

```markdown
<!-- elavora-quality -->
## Qualidade: testes rodaram ok

| Etapa | Resultado | Detalhe |
| --- | --- | --- |
| Dependências (Composer) | ok | dependências mínimas instaladas (--prefer-lowest) |
| Formatação (PHP-CS-Fixer) | corrigido | 2 arquivo(s) corrigido(s) no commit "style: organiza o código" |

<details><summary>Arquivos formatados (2)</summary>

- `src/A.php`
- `src/B.php`

</details>

Commit `1a2b3c4` · [ver a execução](https://github.com/Elavora/api-framework/actions/runs/1)
```

- Primeira linha: `MARKER`.
- Título: `## Qualidade: testes rodaram ok` quando `overallStatus` é `ok`, e `## Qualidade: testes com erro` quando é
  `error`.
- Uma linha da tabela por etapa, na ordem recebida, com `name`, o rótulo de `STATUS_LABELS` e `detail`. Um `|`
  dentro de `detail` é escrito como `\|`.
- Bloco `<details>` só quando a etapa `format` tem `files` não vazio. O resumo é `Arquivos formatados (<n>)` com
  `status` `fixed`, e `Arquivos que precisam de formatação (<n>)` nos outros casos. Lista no máximo 20 arquivos, cada
  um entre crases; com mais de 20, uma última linha `- e mais <resto> arquivo(s)`.
- Última linha: `Commit` seguido dos 7 primeiros caracteres de `sha` entre crases, ` · ` e o link
  `[ver a execução](<runUrl>)`.

No modo `commit` com push concluído, `sha` é o commit `style:` criado. Nos outros casos, é o commit testado (o do
passo 2).

### `imageRepository(image)`

Recebe uma referência de imagem e devolve só o repositório, sem a tag e sem o digest, em minúsculas. Espaços nas
pontas são ignorados. Primeiro sai o digest: tudo a partir do primeiro `@`. Depois sai a tag: tudo a partir do
último `:` que aparece **depois** da última `/`, para não confundir com a porta do registro. `null`, `undefined` ou
vazio → `''`.

| Entrada | Saída |
| --- | --- |
| `'ghcr.io/elavora/php-dev:8.3-latest'` | `'ghcr.io/elavora/php-dev'` |
| `'ghcr.io/Elavora/php-dev:8.3-0.3.0'` | `'ghcr.io/elavora/php-dev'` |
| `'ghcr.io/elavora/php-dev@sha256:abc'` | `'ghcr.io/elavora/php-dev'` |
| `'ghcr.io/elavora/php-dev:8.3-latest@sha256:abc'` | `'ghcr.io/elavora/php-dev'` |
| `'localhost:5000/elavora/php-dev:8.3'` | `'localhost:5000/elavora/php-dev'` |
| `'localhost:5000/elavora/php-dev'` | `'localhost:5000/elavora/php-dev'` |
| `''` | `''` |

### `imageDigest({ image, repoDigests })`

Devolve o digest da imagem que rodou (`sha256:...`) ou `null`. Vale a primeira regra que casar:

1. `image` tem `@`: devolve o que vem depois do primeiro `@`, sem espaços nas pontas (quem fixou pelo digest já sabe
   qual rodou). Se depois do `@` não houver nada, devolve `null`.
2. `repoDigests` é um array: devolve, do primeiro item que é uma string no formato `<repositório>@<digest>` e cujo
   `imageRepository(<repositório>)` é igual a `imageRepository(image)`, a parte depois do `@`. Itens que não são
   string, sem `@` ou de outro repositório são ignorados.
3. Nos outros casos (`repoDigests` ausente, `null`, que não é array, vazio ou sem item que case): `null`.

Exemplos:

- `{ image: 'ghcr.io/elavora/php-dev:8.3-latest', repoDigests: ['ghcr.io/elavora/php-dev@sha256:aaa'] }` →
  `'sha256:aaa'`;
- `{ image: 'ghcr.io/elavora/php-dev:8.3-latest', repoDigests: ['ghcr.io/outro/img@sha256:bbb', 'ghcr.io/elavora/php-dev@sha256:aaa'] }`
  → `'sha256:aaa'`;
- `{ image: 'ghcr.io/elavora/php-dev:8.3-latest', repoDigests: ['GHCR.IO/Elavora/php-dev@sha256:aaa'] }` →
  `'sha256:aaa'` (o repositório é comparado sem diferenciar caixa; o digest volta como veio);
- `{ image: 'ghcr.io/elavora/php-dev@sha256:ccc', repoDigests: [] }` → `'sha256:ccc'`;
- `{ image: 'ghcr.io/elavora/php-dev:8.3-latest', repoDigests: [] }` → `null`;
- `{ image: 'ghcr.io/elavora/php-dev:8.3-latest', repoDigests: ['ghcr.io/outro/img@sha256:bbb'] }` → `null`;
- `{ image: 'ghcr.io/elavora/php-dev:8.3-latest', repoDigests: [42, 'sem-arroba', null] }` → `null`;
- `{ image: 'ghcr.io/elavora/php-dev:8.3-latest' }` → `null`.

### `renderImageInfo({ image, digest })`

Devolve a linha em Markdown do resumo do job, terminada em `\n\n` (uma linha em branco separa a linha da tabela do
relatório). `image` vai sem espaços nas pontas.

- Com `digest` (string não vazia): `` Imagem do job: `<image>` · digest `<digest>`\n\n ``.
- Com `digest` `null`, `undefined` ou vazio: `` Imagem do job: `<image>` · digest não disponível\n\n ``.

Exemplos:

- `{ image: 'ghcr.io/elavora/php-dev:8.3-latest', digest: 'sha256:aaa' }` →
  ``'Imagem do job: `ghcr.io/elavora/php-dev:8.3-latest` · digest `sha256:aaa`\n\n'``;
- `{ image: 'ghcr.io/elavora/php-dev:8.3-latest', digest: null }` →
  ``'Imagem do job: `ghcr.io/elavora/php-dev:8.3-latest` · digest não disponível\n\n'``.

O separador ` · ` é espaço, o caractere `·` (U+00B7) e espaço, o mesmo da última linha de `renderReport`.

### `findQualityComment(comments)`

Recebe a lista de comentários do PR, como a API do GitHub devolve (`[{ id, body, user: { login } }]`), e devolve o
`id` do primeiro comentário cujo `user.login` é `BOT_LOGIN` e cujo `body` começa com `MARKER`, ou `null`.
Comentários de outros autores com o marcador são ignorados.

## O que muda no `.github`

- Novos: `.github/workflows/php-quality.yml`, `scripts/quality.cjs`, `scripts/automation-ref.cjs` e os testes deles
  em `tests/`. Os testes entram no `node --test "tests/*.test.cjs"` que o workflow `Testes` já roda. O `test.yml`
  não muda.
- `release.yml` e `sync-labels.yml`: `automation_ref` passa a ser opcional, a versão é resolvida pelos passos comuns
  e os workflows deixam de declarar `permissions` (ver [versao-da-automacao.md](versao-da-automacao.md)).
- Este repositório não guarda regras de estilo. Elas ficam no `elavora/code-standards`.
- Esta mudança substitui e amplia o item 2 da fila de automação ("testes automáticos em PR"): além dos testes, o
  workflow formata, faz o lint, audita as dependências e mede a cobertura.
- Sai na versão **`1.1.0`** do `.github`: o PR leva as labels `enhancement` (minor) e `release` (estável).
- Ordem de adoção: imagem `8.3-0.2.0` e `elavora/code-standards` `1.0.0` publicados, depois esta `1.1.0`. Em seguida
  o `api-framework` e o `api-skeleton` adotam, cada um num PR próprio. Os outros pacotes `api-*` adotam junto com a
  fase 2 do release.

### Imagem padrão `8.3-latest` (versão `1.3.0`)

- O padrão da entrada `image` passa de `ghcr.io/elavora/php-dev:8.3-0.2.0` para
  `ghcr.io/elavora/php-dev:8.3-latest`. A entrada continua opcional e com o mesmo nome; quem passa `image` não
  percebe diferença.
- Novo passo `Registrar a imagem` e novas funções `imageRepository`, `imageDigest` e `renderImageInfo` em
  `scripts/quality.cjs`, com testes em `tests/`.
- Sai na versão **`1.3.0`** do `.github`: o PR leva as labels `enhancement` (minor) e `release` (estável). Não é
  `upgrade`: as entradas, os nomes de job e de check e o relatório continuam os mesmos.
- Depois da `1.3.0`, o `api-framework` (que hoje passa `image: ghcr.io/elavora/php-dev:8.3-0.3.0`) e o
  `api-skeleton` atualizam o `uses` e deixam de passar `image`, e os devcontainers dos projetos passam a usar a
  `8.3-latest`. Cada um num PR próprio.

---

[README](../README.md) · Veja também: [Release automática](release.md) · [Regras de versão](versionamento.md)
