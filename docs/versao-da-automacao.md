# Versão da automação (`automation_ref`)

[README](../README.md) · Veja também: [Release automática](release.md) · [Labels padrão](labels.md) ·
[Qualidade do código PHP](qualidade.md)

## Por que existe

Os workflows reutilizáveis deste repositório (release, sincronização de labels e qualidade) baixam os próprios
scripts de `Elavora/.github`. Eles precisam saber de qual versão baixar, e essa versão tem de ser a mesma do
workflow que está rodando. Senão, um workflow da `1.1.0` rodaria scripts da `1.0.0`.

Até a `1.0.0`, o chamador informava a versão duas vezes: no `uses: ...@1.0.0` e na entrada `automation_ref: 1.0.0`.
O Dependabot atualiza só o `uses`, e o `automation_ref` ficava para trás. A partir da `1.1.0`, o workflow descobre
sozinho a própria versão, e o chamador escreve a versão uma vez só, no `uses`.

## Visão geral

- **Sem `automation_ref`** (recomendado): o workflow pede ao GitHub um token OIDC e lê a claim `job_workflow_sha`,
  que é o SHA do commit do `Elavora/.github` de onde o workflow reutilizável foi carregado. Os scripts vêm desse SHA.
  O chamador precisa conceder `id-token: write`.
- **Com `automation_ref`**: o comportamento é o da `1.0.0`. O valor informado é usado e o OIDC não é consultado.
  Por isso a mudança é compatível (minor): um chamador da `1.0.0` que só troca a versão do `uses` continua funcionando.

Exemplo de chamador na `1.1.0`, que o Dependabot consegue manter sozinho:

```yaml
jobs:
  release:
    if: github.event.pull_request.merged == true
    permissions:
      contents: write
      pull-requests: read
      id-token: write
    uses: Elavora/.github/.github/workflows/release.yml@1.1.0
```

## Regras para os chamadores

- O `uses` recebe uma tag estável (`1.1.0`, recomendado) ou um SHA completo de 40 caracteres. Não use `main`, nome de
  branch ou tag beta, que só serve para testar uma versão nova do `.github` antes da estável.
- Não existem tags móveis (`1`, `latest`). Para atualizar a automação, troque a versão do `uses`, ou deixe o
  Dependabot (ecossistema `github-actions`) fazer isso.
- Quem ainda informa `automation_ref` precisa manter o mesmo valor do `uses`. Um valor diferente mistura duas
  versões da automação.
- Os chamadores do próprio `.github` (`auto-release.yml` e `auto-sync-labels.yml`) continuam informando
  `automation_ref` (o SHA do merge ou do push), porque usam o workflow local (`uses: ./...`).

## Permissões

Os workflows reutilizáveis **não declaram** `permissions`, nem no topo nem nos jobs: herdam exatamente o que o job
chamador concede. É isso que mantém a compatibilidade. Se o workflow reutilizável pedisse `id-token: write`, um
chamador da `1.0.0` que não concede essa permissão nem chegaria a iniciar, mesmo com `automation_ref` informado.

Consequência: o mínimo de permissões passa a ser responsabilidade do chamador. Cada página lista o que o chamador
concede:

| Workflow | Permissões do job chamador |
| --- | --- |
| `release.yml` | `contents: write`, `pull-requests: read`, `id-token: write` |
| `sync-labels.yml` | `contents: read`, `issues: write`, `id-token: write` |
| `php-quality.yml` | `contents: write`, `pull-requests: write`, `id-token: write` |

`id-token: write` só é necessário quando o chamador omite `automation_ref`. O token OIDC é usado só para ler a
claim, e não é enviado a nenhum serviço.

No `release.yml`, o job `packagist` passa a herdar as mesmas permissões do job `release` (antes ele tinha só
`contents: read`).

## Passos comuns aos três workflows

No início do job (em `release.yml`, no job `release`), no lugar do antigo "Validar automation_ref":

1. **Obter a versão da automação** (`actions/github-script`, com código no próprio workflow, porque os scripts ainda
   não foram baixados):
   - com `automation_ref` preenchido (depois de tirar os espaços), não faz nada além de repassar o valor;
   - senão, chama `core.getIDToken()` e decodifica o payload do JWT (a parte do meio, em base64url) para ler
     `job_workflow_ref` e `job_workflow_sha`, que ficam como saídas do passo;
   - se o token não puder ser obtido, o job falha com a mensagem `OIDC_UNAVAILABLE_MESSAGE` (abaixo), escrita
     literalmente no workflow.
2. **Checkout dos scripts** de `Elavora/.github` em `inputs.automation_ref || <job_workflow_sha>`, como antes.
3. **Conferir a versão da automação**: carrega `scripts/automation-ref.cjs` do checkout e chama
   `resolveAutomationRef({ input, oidcClaims })`. Se a função lançar erro, o job falha com a mensagem dela.

O token OIDC nunca é impresso nem gravado em saída de passo: só as duas claims.

No `release.yml`, o job `release` expõe o ref resolvido numa saída interna (`automation_ref`), que o job
`packagist` usa no seu checkout dos scripts.

## Riscos e limitações

- **O OIDC precisa estar habilitado** para o repositório e o chamador precisa conceder `id-token: write`. Sem isso,
  e sem `automation_ref`, o workflow falha logo no início com a mensagem abaixo.
- **PRs de fork não recebem `id-token`.** No `php-quality.yml`, um PR de fork falha nesse passo, sem relatório nem
  comentário. Os repositórios da organização trabalham com branches internas. Quem precisar aceitar forks pode
  informar `automation_ref` no chamador, e volta a ter de mantê-lo igual ao `uses`. O `release.yml` já não funcionava
  com PRs de fork (ver [release.md](release.md#limitação-prs-de-fork)).
- **PRs do Dependabot.** Os workflows disparados pelo Dependabot recebem um `GITHUB_TOKEN` restrito. Se o `id-token`
  também não for concedido nesses PRs, o `php-quality.yml` falha com a mesma mensagem nos PRs do Dependabot. Isso
  precisa ser conferido no primeiro PR real do Dependabot depois da adoção.

## Referência: `scripts/automation-ref.cjs`

Módulo CommonJS sem dependências externas. As funções são puras e nenhuma mensagem de erro inclui o token.

### `OIDC_UNAVAILABLE_MESSAGE`

Constante exportada, com exatamente este texto:

```text
não foi possível descobrir a versão do Elavora/.github: conceda "id-token: write" ao job chamador ou informe a entrada automation_ref (PRs de fork não recebem id-token)
```

### `decodeJwtClaims(token)`

Recebe o token OIDC (um JWT `cabeçalho.payload.assinatura`) e devolve o payload como objeto. Não confere a
assinatura, porque o token vem do próprio runner.

- O payload é a segunda parte, em base64url (com `-` e `_`, sem `=` de preenchimento).
- Lança `Error` com uma mensagem que contém `token OIDC inválido` quando: `token` não é string, não tem exatamente
  três partes separadas por `.`, o payload não decodifica como JSON, ou o JSON não é um objeto (por exemplo um array
  ou `null`).

Exemplo: o token `x.eyJqb2Jfd29ya2Zsb3dfc2hhIjoiYWJjIn0.y` → `{ job_workflow_sha: 'abc' }`.

### `resolveAutomationRef({ input, oidcClaims })`

Escolhe a versão da automação. As regras são avaliadas nesta ordem:

| Condição | Resultado |
| --- | --- |
| `input` é string e não fica vazia depois de `trim()` | `{ ref: input.trim(), source: 'input' }`, sem olhar `oidcClaims` |
| `oidcClaims` é `null` ou `undefined` | lança `Error(OIDC_UNAVAILABLE_MESSAGE)` |
| `oidcClaims.job_workflow_ref` não é string ou não começa com `Elavora/.github/` (sem diferenciar caixa) | lança `Error` com uma mensagem que contém `job_workflow_ref` e `Elavora/.github` |
| `oidcClaims.job_workflow_sha` não tem exatamente 40 caracteres hexadecimais minúsculos | lança `Error` com uma mensagem que contém `job_workflow_sha` |
| nenhuma das anteriores | `{ ref: oidcClaims.job_workflow_sha, source: 'oidc' }` |

O `input` não é validado além disso, como na `1.0.0`: uma tag ou um SHA continuam aceitos do jeito que vierem.

A conferência de `job_workflow_ref` impede que uma cópia do workflow em outro repositório baixe os scripts do
`Elavora/.github` num SHA que não é o dela.

Exemplos:

- `{ input: ' 1.0.0 ', oidcClaims: null }` → `{ ref: '1.0.0', source: 'input' }`;
- `{ input: '', oidcClaims: { job_workflow_ref: 'Elavora/.github/.github/workflows/release.yml@refs/tags/1.1.0', job_workflow_sha: '<40 hex>' } }`
  → `{ ref: '<40 hex>', source: 'oidc' }`;
- `{ input: undefined, oidcClaims: undefined }` → lança `Error(OIDC_UNAVAILABLE_MESSAGE)`;
- `{ input: '', oidcClaims: { job_workflow_ref: 'fulano/.github/.github/workflows/release.yml@refs/heads/main', job_workflow_sha: '<40 hex>' } }`
  → lança o erro de `job_workflow_ref`.

---

[README](../README.md) · Veja também: [Release automática](release.md) · [Labels padrão](labels.md) ·
[Qualidade do código PHP](qualidade.md)
