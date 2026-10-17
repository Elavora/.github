# Release automática

Cada repositório Elavora tem um workflow chamador pequeno. Nesta primeira fase, só o `.github` e o
`devcontainers` adotam o fluxo; os pacotes `api-*` ficam para uma fase posterior (ver [Migração](#migração-dos-repositórios)).
Quando um pull request é integrado na `main`, esse chamador aciona o workflow reutilizável
`Elavora/.github/.github/workflows/release.yml`, que:

1. calcula a nova versão a partir das tags e das labels do PR (regras em [versionamento.md](versionamento.md));
2. cria a tag e a GitHub Release;
3. envia o evento `repository_dispatch` `tag-created` para o próprio repositório;
4. nos pacotes Composer, pede ao Packagist que atualize o pacote.

## Versionamento do próprio `.github`

O `.github` é versionado pelo mesmo fluxo, e os consumidores fixam uma versão dele no `uses`
(`Elavora/.github/.github/workflows/release.yml@1.1.0`): uma tag estável, recomendada, ou um SHA completo.

A partir da `1.1.0`, a entrada `automation_ref` é opcional. Sem ela, o workflow descobre a própria versão pelo
token OIDC (claim `job_workflow_sha`), e o chamador concede `id-token: write`. Com ela, o comportamento é o da
`1.0.0`, e o valor precisa ser igual ao do `uses`. As regras completas, os riscos (OIDC desabilitado, forks) e a
função `resolveAutomationRef` estão em [versao-da-automacao.md](versao-da-automacao.md).

## Workflow reutilizável `release.yml`

### Gatilho e entradas

Só `workflow_call`. Ele espera ser chamado a partir de um evento `pull_request` do tipo `closed`.

| Entrada | Tipo | Obrigatória | Padrão | Uso |
| --- | --- | --- | --- | --- |
| `automation_ref` | string | não | `''` (descobre pelo OIDC) | versão do `.github` (tag ou SHA) usada para baixar os scripts; ver [versao-da-automacao.md](versao-da-automacao.md) |
| `package_name` | string | não | nome do repositório (`github.repository`) | aparece no título da release |
| `packagist` | boolean | não | `true` | pede a atualização do Packagist depois da release |

| Secret | Obrigatório | Uso |
| --- | --- | --- |
| `PACKAGIST_WEBHOOK_URL` | só quando `packagist` é `true` | endpoint de atualização do Packagist (ver abaixo) |

| Saída | Valor |
| --- | --- |
| `tag` | a tag criada ou reaproveitada (`1.2.0-beta.2`) |
| `prerelease` | `'true'` ou `'false'` |

### Permissões

O job do chamador precisa conceder `contents: write` (para criar tag e release), `pull-requests: read` (para
levantar os PRs do intervalo, ver abaixo) e `id-token: write` (para descobrir a versão da automação quando
`automation_ref` é omitido). O workflow reutilizável não declara `permissions` e herda as do chamador, inclusive no
job do Packagist (ver [versao-da-automacao.md](versao-da-automacao.md#permissões)).

### Condições de execução

O job de release só roda quando `github.event.pull_request.merged == true` **e**
`github.event.pull_request.base.ref == 'main'`. PR fechado sem merge, ou integrado em outra branch, não gera versão
e o job aparece como `skipped`, sem falha.

### Concorrência

As execuções são serializadas por repositório (grupo `elavora-release-<owner>/<repo>`, sem cancelar a que está
em andamento). O GitHub guarda só **uma** execução pendente por grupo: com três merges seguidos (A, B e C), enquanto
A roda, a execução de B fica pendente e é cancelada quando chega a de C.

Por isso a versão não é calculada só com o PR do evento, e sim com **todos os PRs integrados desde a última tag**
(ver [Intervalo de PRs](#intervalo-de-prs)). No exemplo, C enxerga B e A: se B tinha `upgrade`, a tag de C já sai
major. Nenhuma label se perde.

**Limitação**: um merge cuja execução foi cancelada não ganha tag própria. Ele entra na tag seguinte, que contém
os seus commits. No exemplo, ficam as tags de A e de C, e não existe tag apontando para o merge de B.

### Job `release`

1. Faz checkout do repositório no `merge_commit_sha` do PR, com o histórico e as tags completos.
2. Resolve a versão da automação, faz checkout de `Elavora/.github` nessa versão, só com `scripts/`, em `.elavora/` e
   sem persistir credenciais, e confere a versão com `resolveAutomationRef` (passos comuns em
   [versao-da-automacao.md](versao-da-automacao.md#passos-comuns-aos-três-workflows)). O ref resolvido vira a saída
   interna `automation_ref` do job.
3. **Idempotência**:
   - se uma tag reconhecida pelo formato novo (`X.Y.Z` ou `X.Y.Z-beta.N`) já aponta para o `merge_commit_sha`, ela
     é reaproveitada e não se cria outra. Assim, reexecutar o workflow do mesmo merge não gera versão duplicada;
   - se o `merge_commit_sha` já está contido numa tag reconhecida mais nova (é ancestral do commit dela), o merge
     já foi absorvido por outra versão. O job termina com sucesso, sem criar tag nem release, com a saída `tag`
     vazia e um resumo dizendo em qual tag o merge está. O job `packagist` não roda. É o caso de reexecutar uma
     execução que tinha sido cancelada. Essa checagem considera todas as tags reconhecidas na leitura, inclusive
     as estáveis legadas `vX.Y.Z`. Quando mais de uma tag contém o merge, o resumo cita a de menor versão.
4. Levanta o intervalo de PRs e as labels agregadas (ver abaixo) e calcula a versão com
   `node .elavora/scripts/release-version.cjs`, passando todas as tags do repositório e as labels agregadas.
5. Cria a tag (`refs/tags/<tag>`) apontando para o `merge_commit_sha` do PR. Isso vale também para a promoção de
   uma beta: a estável inclui o que veio no PR com `release`.
6. Cria a GitHub Release, se ainda não existir uma para essa tag:
   - título: `<package_name> <tag>` (exemplo: `elavora/api-framework 1.2.0`);
   - `prerelease: true` para beta e `false` para estável;
   - `make_latest: true` só para estável;
   - notas geradas pelo GitHub (`generate_release_notes: true`).
7. Envia `repository_dispatch` com `event_type: tag-created` e
   `client_payload: { tag, release_id, prerelease }`, que os workflows do repositório usam para publicar artefatos
   da versão (exemplo: a imagem do `devcontainers`).
8. Publica um resumo (`$GITHUB_STEP_SUMMARY`) com a tag, se é pré-release, o incremento, a estável anterior e a
   lista dos PRs do intervalo (número e labels).

### Intervalo de PRs

1. **Tag de partida**: entre as tags reconhecidas na leitura (ver [versionamento.md](versionamento.md#tags-reconhecidas-na-leitura)),
   as que apontam para um ancestral do `merge_commit_sha`; dessas, a de maior versão. Tags ignoradas na leitura
   (como as `rc` legadas) não servem de partida. Sem nenhuma, o intervalo começa no primeiro commit do repositório.
2. **Commits**: `git rev-list --first-parent <tag de partida>..<merge_commit_sha>` (ou só `<merge_commit_sha>` sem
   tag de partida). O `--first-parent` pega um commit por PR em merge commit, e todos os commits em squash e rebase.
3. **PRs**: para cada commit, os PRs associados pela API (`GET /repos/{owner}/{repo}/commits/{sha}/pulls`), mantendo
   só os que foram integrados (`merged_at` preenchido) com base `main`, sem repetir número.
4. **PR do evento**: entra sempre, com as labels do payload do evento, mesmo que a API não o devolva. Se a API
   também o devolver, valem as labels do payload.
5. **Labels agregadas**: `aggregateLabels(pulls)`, de `scripts/release-version.cjs` (ver
   [versionamento.md](versionamento.md#funções-exportadas)). Vale a maior label entre todos os PRs, e `release` em
   qualquer um deles gera estável.

**Custo**: a coleta faz uma chamada à API por commit do intervalo. No dia a dia o intervalo tem um commit só. Na
primeira release de um repositório sem tag reconhecida (o `.github`, ou o `devcontainers`, que só tem a `rc`
legada `v0.0.1-rc.1`), o intervalo é todo o histórico first-parent da `main`, e a coleta faz uma chamada por commit
desse histórico. Nessa primeira vez, as labels de todos os PRs antigos também entram na agregação: confira se algum
tem `upgrade` ou `release` antes de adotar.

Exemplo: a última tag é `1.1.1`. Depois dela entraram o #10 (`bug`, execução concluída e tag `1.1.2-beta.1`),
o #11 (`upgrade`, execução cancelada) e o #12 (`documentation`). A execução do #12 parte de `1.1.2-beta.1`,
enxerga o #11 e o #12, agrega `upgrade` e `documentation` e gera `2.0.0-beta.1`, apontando para o merge do #12.

Tags criadas com o `GITHUB_TOKEN` não disparam `push: tags` nem `release: published` em outros workflows. Por isso
o fluxo usa `repository_dispatch` e faz a notificação ao Packagist no próprio workflow.

### Job `packagist`

Roda depois do job `release` (`needs: release`), quando ele termina com sucesso e `packagist` é `true`.
Por ser um job separado, uma falha aqui pode ser corrigida com **Re-run failed jobs**, sem tocar na tag nem na
release.

1. Faz checkout só de `scripts/` do `.github` no ref resolvido pelo job `release` (`needs.release.outputs.automation_ref`).
2. Chama `notifyPackagist` de `scripts/packagist.cjs` com o repositório (`Elavora/<repo>`) e o secret.
3. Sucesso: resumo com o repositório e o número de tentativas. Falha: o job falha com a mensagem, e o secret
   nunca é impresso (é registrado com `core.setSecret`).

Repositórios que não são pacotes Composer (`.github`, `devcontainers`) chamam com `packagist: false`.

## Notificação ao Packagist (`scripts/packagist.cjs`)

Módulo CommonJS sem dependências externas.

### `credentials(webhookUrl)`

Valida o secret e devolve `"<username>:<apiToken>"`. O secret precisa ter exatamente esta forma:

```
https://packagist.org/api/update-package?username=USUARIO&apiToken=TOKEN
```

Lança `Error` com uma mensagem que contém `PACKAGIST_WEBHOOK_URL` quando:

- o valor é `undefined`, vazio ou não é uma URL;
- o protocolo não é `https` ou o host não é `packagist.org` (`http://packagist.org/...`, `https://example.com/...`);
- o caminho não é `/api/update-package` (`https://packagist.org/api/github?...`);
- o host não é exatamente `packagist.org`: subdomínios como `evil.packagist.org` ou `www.packagist.org`, e hosts
  como `packagist.org.evil.com`, são inválidos;
- falta `username` ou `apiToken`, ou um deles está vazio (`username=&apiToken=b` e `username=a&apiToken=` contam
  como ausentes);
- a URL tem usuário/senha embutidos (`https://u:p@packagist.org/...`) ou fragmento (`#x`).

### `notifyPackagist({ repository, webhookUrl, fetchImpl = fetch, sleep })`

- `repository` precisa casar com `^Elavora/(api-[a-z0-9-]+|code-standards)$`: os pacotes `api-*` e o
  `Elavora/code-standards`, que também é um pacote Composer. Senão, lança `Error` antes de qualquer requisição.
  - Válidos: `Elavora/api-framework`, `Elavora/api-cache-redis2`, `Elavora/code-standards`.
  - Inválidos, além dos de antes (`elavora/api-framework`, `Outra/api-framework`, `Elavora/api-Framework`,
    `Elavora/api-`, `Elavora/api-framework/x`, a URL `https://github.com/Elavora/api-framework`):
    `elavora/code-standards`, `Elavora/Code-Standards`, `Outra/code-standards`, `Elavora/code-standards-x`,
    `Elavora/code-standards/x`, `Elavora/xcode-standards` e `Elavora/devcontainers`.
- O secret é validado com `credentials` antes de qualquer requisição. Com secret inválido ou ausente, a função
  rejeita com o mesmo `Error` de `credentials` (mensagem com `PACKAGIST_WEBHOOK_URL`) e `fetchImpl` nunca é chamado.
- Envia `POST https://packagist.org/api/update-package` com:
  - header `Authorization: Bearer <username>:<apiToken>` e `Content-Type: application/json`;
  - corpo `{"repository":"https://github.com/<repository>"}`;
  - `redirect: 'error'` e timeout de 30 segundos por tentativa (`AbortSignal.timeout(30000)`).
  As credenciais nunca vão na URL nem no corpo.
- Até 4 tentativas, com espera de 1 s, 2 s e 4 s entre elas (`sleep(ms)`, injetável para teste), para:
  falha de rede ou timeout, HTTP 429, HTTP 5xx, e falha de rede ao ler o corpo.
- Falha imediata, sem nova tentativa, para: outros HTTP 4xx (mensagem com o status, por exemplo `HTTP 403`),
  JSON inválido na resposta e resposta sem `status: "success"`.
- Esgotadas as 4 tentativas, lança `Error` informando que falhou após 4 tentativas.
- Sucesso: devolve `{ attempts }`, o número da tentativa que deu certo.
- Nenhuma mensagem de erro inclui a URL do secret, o token ou o corpo da resposta.

O secret `PACKAGIST_WEBHOOK_URL` fica na organização (Settings > Secrets and variables > Actions), com acesso aos
repositórios de pacotes. Nunca use uma Actions *variable* para ele. Um secret de repositório com o mesmo nome tem
prioridade sobre o da organização.

## Workflow chamador em cada repositório

Arquivo `.github/workflows/release.yml`, com o nome `Release`.

### Pacotes `api-*`

```yaml
name: Release

on:
  pull_request:
    types: [closed]
    branches: [main]

permissions:
  contents: read

jobs:
  release:
    if: github.event.pull_request.merged == true
    permissions:
      contents: write
      pull-requests: read
      id-token: write
    uses: Elavora/.github/.github/workflows/release.yml@1.1.0
    with:
      package_name: elavora/api-framework
    secrets:
      PACKAGIST_WEBHOOK_URL: ${{ secrets.PACKAGIST_WEBHOOK_URL }}
```

Troque `1.1.0` pela versão estável atual do `.github` e `package_name` pelo `name` do `composer.json` do
repositório. A versão aparece uma vez só, no `uses`, e o Dependabot consegue atualizá-la. Um chamador da `1.0.0`
(com `automation_ref` e sem `id-token: write`) continua funcionando, desde que `automation_ref` e `uses` tenham o
mesmo valor.

### `devcontainers`

Igual ao dos pacotes, mas com `package_name: elavora/devcontainers`, `packagist: false` e sem o bloco `secrets`.

### `.github`

O próprio repositório chama o workflow local, para que cada merge seja versionado com o código do próprio merge:

```yaml
name: Release

on:
  pull_request:
    types: [closed]
    branches: [main]

permissions:
  contents: read

jobs:
  release:
    if: github.event.pull_request.merged == true
    permissions:
      contents: write
      pull-requests: read
    uses: ./.github/workflows/release.yml
    with:
      automation_ref: ${{ github.event.pull_request.merge_commit_sha }}
      package_name: Elavora/.github
      packagist: false
```

Esse chamador fica em `.github/workflows/auto-release.yml`, porque `release.yml` já é o workflow reutilizável.

### Limitação: PRs de fork

Em `pull_request` vindo de fork, o `GITHUB_TOKEN` é somente leitura e o job de release falha ao criar a tag.
Os repositórios da organização trabalham com branches internas. Um PR de fork precisa ser recriado a partir de uma
branch do repositório.

## Migração dos repositórios

Esta mudança não altera os outros repositórios. A adoção é feita em um PR próprio em cada repositório, em duas
fases.

### Fase 1 (esta rodada): `.github` e `devcontainers`

| Repositório | Situação atual | O que fazer |
| --- | --- | --- |
| `.github` | `release.yml` (reutilizável antigo) | esta branch: novo `release.yml` reutilizável e os chamadores `auto-release.yml` e `auto-sync-labels.yml` |
| `devcontainers` | `release.yml` chamando o SHA antigo `b165150`, `sync_labels.yml`; `image.yml` reage a `tags: ['v*']`, a `repository_dispatch` `tag-created` e testa `refs/tags/v` | depois da primeira estável do `.github`: trocar `release.yml` pelo chamador desta página (`packagist: false`), trocar `sync_labels.yml` pelo chamador de [labels.md](labels.md). Em `image.yml`, a publicação da imagem continua pelo `repository_dispatch` `tag-created`, que lê `client_payload.tag` (a tag passa a vir sem `v`, por exemplo `ghcr.io/elavora/php-dev:8.3-1.0.0`); o gatilho `tags: ['v*']` e a condição `refs/tags/v` deixam de ser usados |

### Fase 2 (posterior): pacotes `api-*`

Fora desta rodada. Fica registrado o que cada grupo terá de fazer:

| Repositórios | Situação atual | O que fazer |
| --- | --- | --- |
| 28 pacotes legados (`api-log-*`, `api-storage-*`, `api-database-*`, `api-queue-*`, `api-redis`, `api-cache-*`, `api-datatype-*` exceto `core`, `api-datatypes`) | `tag_on_merge.yml`, `publish-composer.yml`, `update-composer-on-release.yml`, `sync_labels.yml` | remover os quatro; adicionar `release.yml` e `sync-labels.yml` chamadores |
| `api-framework`, `api-datatype-core`, `api-skeleton` | `release.yml` e `sync-labels.yml` fixados em SHA da branch `fix/centraliza-automacao` (PR #6, fechado), e `sync-labels.yml` com a entrada `prune`; `api-skeleton` também tem `packagist-sync.yml` | substituir os dois chamadores pelos desta página (sem `prune`); remover `packagist-sync.yml` |

Os PRs de adoção abertos para o PR #33 (`packagist-sync.yml` em 31 pacotes) ficam obsoletos com este fluxo.
As tags `v*` existentes continuam no repositório e no Packagist.

## Recuperação

- **A tag foi criada e a release falhou**: reexecute o workflow. A tag que aponta para o merge é reaproveitada
  (passo 3) e a release que faltava é criada.
- **O Packagist falhou**: corrija o secret, se for o caso, e use **Re-run failed jobs**.
- **Tag errada**: o workflow nunca move nem apaga tags. A correção é manual e precisa de análise antes, porque
  consumidores podem já ter instalado a versão.
