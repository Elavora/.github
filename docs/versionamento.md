# Regras de versão

Toda vez que um pull request é integrado na `main` de um repositório Elavora, o workflow central de release
(ver [release.md](release.md)) cria uma tag e uma GitHub Release. A versão é calculada só a partir de duas
entradas: as tags que já existem no repositório e as labels do pull request integrado.

Esta página é a especificação do cálculo, implementado em `scripts/release-version.cjs`.

## Formato das tags

- Versão estável: `X.Y.Z`, por exemplo `1.2.0`.
- Pré-release: `X.Y.Z-beta.N`, com `N >= 1`, por exemplo `1.2.0-beta.3`.
- Sem o prefixo `v`. O Composer e o Packagist entendem as duas formas, e a organização padronizou sem prefixo.
- Componentes numéricos em decimal, sem zero à esquerda (`0` é válido, `01` não é).

### Tags reconhecidas na leitura

| Tag existente | Como é tratada |
| --- | --- |
| `1.2.0` | estável `1.2.0` |
| `1.2.0-beta.3` | pré-release `1.2.0`, número 3 |
| `v1.2.0` (legada) | estável `1.2.0`. Conta como histórico para que os repos que já têm tags `v*` não voltem para `0.0.1` |
| `v1.2.0-rc.1` (legada) | ignorada |
| `1.2.0-rc.1`, `1.2.0-beta`, `1.2.0-beta.0`, `1.2`, `01.2.0`, `0.17.1-32`, `latest` | ignoradas |

Uma estável legada e uma nova com o mesmo número (`v1.2.0` e `1.2.0`) representam a mesma versão.
O workflow nunca cria tags com `v`, nem apaga ou move tags existentes.

## Incremento pelas labels

As labels são comparadas sem diferenciar maiúsculas de minúsculas (`Enhancement` equivale a `enhancement`).

| Label do pull request | Incremento |
| --- | --- |
| `upgrade` | major: `1.1.1` → `2.0.0` |
| `enhancement` ou `feature` (alias) | minor: `1.1.1` → `1.2.0` |
| `bug` | patch: `1.1.1` → `1.1.2` |
| qualquer outra label, inclusive `documentation`, `tests`, `refactor` e `dependencies`, ou nenhuma label | patch |

- Se o PR tiver várias labels, vale o maior incremento: `upgrade` > `enhancement`/`feature` > patch.
  Exemplo: `bug` + `enhancement` → minor, e `upgrade` + `bug` → major.
- Todo merge gera uma versão, e não existe label que pule a release.
- `major`, `minor`, `patch`, `breaking` e `improvement` (aliases antigos) são removidas dos repositórios pela
  sincronização de labels (ver [labels.md](labels.md)). Se ainda aparecerem num PR, contam como patch, como qualquer
  label desconhecida, sem aviso nem tratamento especial.

## Estável ou pré-release

- Com a label `release`, sai uma versão estável `X.Y.Z`.
- Sem ela, sai uma pré-release `X.Y.Z-beta.N`.
- `release` só define a estabilidade, não o incremento. As outras labels do mesmo PR continuam valendo.

## Algoritmo

Definições, considerando só as tags reconhecidas:

- **S**: a maior estável existente, ou `0.0.0` se não houver nenhuma.
- **Pendentes**: as pré-releases cuja base `X.Y.Z` é maior que S. Uma beta cuja base é menor ou igual a S já foi
  superada e é ignorada.
- **P**: a maior base entre as pendentes, se houver alguma.

Passos:

1. `C` = S com o incremento das labels aplicado. Um major zera minor e patch, e um minor zera patch.
2. Base `B` = a maior entre `C` e `P`. Sem pendentes, `B = C`.
   Assim, a linha de betas nunca anda para trás: uma correção feita depois de uma beta minor continua na mesma base.
3. Com `release`, a tag é `B`.
4. Sem `release`, a tag é `B-beta.N`, onde `N` = 1 + o maior número de beta já existente com a base `B`
   (ou 1, se não houver nenhuma). Quando a base muda, `N` recomeça em 1.

As versões são comparadas numericamente, componente a componente (`1.10.0` > `1.9.0`).

## Exemplos

| Tags existentes | Labels do PR | Nova tag |
| --- | --- | --- |
| nenhuma | nenhuma | `0.0.1-beta.1` |
| nenhuma | `release` | `0.0.1` |
| nenhuma | `upgrade`, `release` | `1.0.0` |
| `1.1.1` | `bug` | `1.1.2-beta.1` |
| `1.1.1` | `documentation` | `1.1.2-beta.1` |
| `1.1.1` | `dependencies` | `1.1.2-beta.1` |
| `1.1.1`, `1.1.2-beta.1` | `bug` | `1.1.2-beta.2` |
| `1.1.1`, `1.1.2-beta.2` | `enhancement` | `1.2.0-beta.1` |
| `1.1.1`, `1.1.2-beta.2`, `1.2.0-beta.1` | `bug` | `1.2.0-beta.2` |
| `1.1.1`, `1.2.0-beta.1` | `feature` | `1.2.0-beta.2` |
| `1.1.1`, `1.2.0-beta.3` | `upgrade` | `2.0.0-beta.1` |
| `1.1.1`, `1.2.0-beta.3` | `release` | `1.2.0` (promove a beta pendente) |
| `1.1.1`, `1.2.0-beta.3` | `release`, `bug` | `1.2.0` |
| `1.1.1`, `1.2.0-beta.3` | `release`, `upgrade` | `2.0.0` |
| `1.1.1` | `release`, `enhancement` | `1.2.0` |
| `1.1.1` | `bug`, `enhancement`, `upgrade` | `2.0.0-beta.1` |
| `1.2.0`, `1.2.0-beta.3` | `bug` | `1.2.1-beta.1` (a beta 1.2.0 já foi superada) |
| `1.9.0`, `1.10.0` | `bug` | `1.10.1-beta.1` |
| `1.1.1` | `Enhancement` | `1.2.0-beta.1` |
| `1.1.1` | `major` | `1.1.2-beta.1` (label desconhecida) |
| `1.1.1` | `breaking`, `release` | `1.1.2` |
| `v0.1.0`, `v0.1.1`, `v0.2.0` | `bug` | `0.2.1-beta.1` |
| `v0.2.0`, `0.2.1-beta.1` | `release` | `0.2.1` |
| `v1.0.0`, `v1.1.0-rc.1`, `v2.0.0-rc.1` | `upgrade` | `2.0.0-beta.1` (as `rc` legadas são ignoradas) |
| `0.17.1-32`, `latest` | nenhuma | `0.0.1-beta.1` |

## Interface do script

`scripts/release-version.cjs` é um módulo CommonJS sem dependências externas que roda no Node.js 20 ou mais novo.

### Funções exportadas

- `parseTag(name: string)`: devolve `{ name, major, minor, patch, beta, legacy }` ou `null` quando a tag não é
  reconhecida (conforme a tabela de leitura). `beta` é o número `N`, ou `null` para estável.
  `legacy` é `true` para `vX.Y.Z`.
  - `parseTag('1.2.0-beta.3')` → `{ name: '1.2.0-beta.3', major: 1, minor: 2, patch: 0, beta: 3, legacy: false }`
  - `parseTag('v0.2.0')` → `{ name: 'v0.2.0', major: 0, minor: 2, patch: 0, beta: null, legacy: true }`
  - `parseTag('v1.0.0-rc.1')`, `parseTag('1.2.0-beta.0')` e `parseTag('01.2.0')` → `null`
- `bumpFromLabels(labels: string[])`: devolve `'major' | 'minor' | 'patch'`.
  - `bumpFromLabels(['bug', 'Enhancement'])` → `'minor'`; `bumpFromLabels([])` → `'patch'`;
    `bumpFromLabels(['major'])` → `'patch'`.
- `nextVersion({ tags: string[], labels: string[] })`: devolve
  `{ tag, version, prerelease, bump, previous }`.
  - `tag`: a nova tag (`'1.2.0-beta.2'`).
  - `version`: a base sem o sufixo (`'1.2.0'`).
  - `prerelease`: `true` quando a tag é beta.
  - `bump`: o incremento das labels.
  - `previous`: o nome da maior estável usada como S, ou `null`.

  Tags não reconhecidas são ignoradas sem erro. `labels` que não seja array de strings lança `TypeError`.

### Linha de comando

```sh
node scripts/release-version.cjs "<tags separadas por espaço ou quebra de linha>" '<labels em JSON>'
```

Escreve em stdout uma única linha com o JSON de `nextVersion` e sai com código 0.
Com JSON de labels inválido, escreve a mensagem em stderr e sai com código 1.

```sh
$ node scripts/release-version.cjs "1.1.1 1.2.0-beta.1" '["bug"]'
{"tag":"1.2.0-beta.2","version":"1.2.0","prerelease":true,"bump":"patch","previous":"1.1.1"}
```

## Diferenças em relação ao fluxo anterior

O fluxo anterior (`release-version.cjs` até a versão integrada no PR #34) fazia outra coisa, e o comportamento
abaixo deixa de valer:

| Antes | Agora |
| --- | --- |
| tags `v1.4.0` e `v1.4.0-rc.1` | `1.4.0` e `1.4.0-beta.1` |
| `dependencies`, `improvement` e `minor` → minor | `dependencies` → patch; `improvement` e `minor` são removidas dos repos (e, se aparecerem, valem patch) |
| `breaking` e `major` → major | removidas dos repos (e, se aparecerem, valem patch) |
| a base da prévia era recalculada só com as labels do PR atual, então uma correção depois de uma prévia minor voltava para a linha patch (`v1.2.0-rc.1` seguida de `v1.1.2-rc.1`) | a base nunca anda para trás (`1.2.0-beta.1` seguida de `1.2.0-beta.2`) |
| `release` ignorava as outras labels ao promover | `release` com `upgrade` sobre `1.2.0-beta.3` gera `2.0.0` |
| a estável promovida apontava para o commit da prévia | a estável aponta para o merge do PR com `release` (ver [release.md](release.md)) |
