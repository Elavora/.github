# Labels padrão

Todos os repositórios Elavora usam o mesmo conjunto de labels, definido em um catálogo central
(`.github/labels.json`, neste repositório) e aplicado pelo workflow reutilizável
`Elavora/.github/.github/workflows/sync-labels.yml`.

## Catálogo

| Label | Cor | Descrição | Efeito na versão |
| --- | --- | --- | --- |
| `upgrade` | `5319e7` | Alteração incompatível; incremento major. | major |
| `enhancement` | `a2eeef` | Funcionalidade ou melhoria compatível; incremento minor. | minor |
| `feature` | `0e8a16` | Alias de enhancement; incremento minor. | minor |
| `bug` | `d73a4a` | Correção de comportamento incorreto; incremento patch. | patch |
| `release` | `0052cc` | Gera versão estável em vez de pré-release. | estabilidade |
| `documentation` | `0075ca` | Alteração de documentação; incremento patch. | patch |
| `tests` | `bfdadc` | Alteração de testes; incremento patch. | patch |
| `refactor` | `fbca04` | Refatoração sem mudança funcional; incremento patch. | patch |
| `dependencies` | `0366d6` | Atualização de dependências; incremento patch. | patch |
| `deprecated` | `e4e669` | Recurso obsoleto ou em processo de remoção. | patch |
| `duplicate` | `cfd3d7` | Issue ou pull request duplicado. | - |
| `invalid` | `e4e669` | Issue ou pull request sem informações ou contexto válido. | - |
| `question` | `d876e3` | Pedido de esclarecimento ou discussão. | - |
| `good first issue` | `7057ff` | Boa issue para uma primeira contribuição. | - |
| `help wanted` | `008672` | Contribuições da comunidade são bem-vindas. | - |
| `wontfix` | `ffffff` | Esta solicitação não será implementada. | - |

As regras completas de versão estão em [versionamento.md](versionamento.md).

### Labels obsoletas

Estas labels saíram do padrão e a sincronização **apaga** onde existirem:

| Label | Por quê |
| --- | --- |
| `major` | substituída por `upgrade` |
| `breaking` | substituída por `upgrade` |
| `minor` | substituída por `enhancement` |
| `improvement` | substituída por `enhancement` |
| `patch` | o patch é o incremento padrão e não precisa de label |

Ao apagar uma label, o GitHub a retira das issues e PRs que a usavam. Se for necessário, ela pode ser recriada
depois, voltando ao catálogo. As outras labels fora do catálogo (por exemplo `IA`) continuam preservadas.

### Formato de `.github/labels.json`

Um objeto JSON com duas chaves:

```json
{
  "labels": [
    { "name": "upgrade", "color": "5319e7", "description": "Alteração incompatível; incremento major." }
  ],
  "remove": ["major", "breaking", "minor", "improvement", "patch"]
}
```

- `labels`: as labels padrão, na ordem da tabela do catálogo.
- `remove`: os nomes das labels obsoletas, na ordem da tabela acima.

O catálogo é válido quando:

- é um objeto com exatamente as chaves `labels` e `remove`;
- `labels` é um array não vazio;
- cada item de `labels` tem exatamente as chaves `name`, `color` e `description`, todas strings;
- `name` não é vazio, não tem espaços nas pontas e é único sem diferenciar maiúsculas de minúsculas
  (`Bug` e `bug` juntos são inválidos);
- `color` tem 6 dígitos hexadecimais minúsculos, sem `#` (`d73a4a` é válido; `#d73a4a`, `D73A4A` e `fff` não são);
- `description` tem no máximo 100 caracteres, que é o limite do GitHub;
- `remove` é um array (pode ser vazio) de strings não vazias, sem espaços nas pontas e únicas sem diferenciar
  maiúsculas de minúsculas;
- nenhum nome aparece ao mesmo tempo em `labels` e em `remove`, também sem diferenciar maiúsculas de minúsculas
  (`"Bug"` em `remove` com `bug` em `labels` é inválido).

## Sincronização

Para cada label do catálogo, comparando o nome sem diferenciar maiúsculas de minúsculas:

- **Não existe no repositório**: é criada com nome, cor e descrição do catálogo.
- **Existe, mas difere** no nome (só na caixa, como `Bug`), na cor (comparada sem diferenciar caixa) ou na descrição
  (uma descrição ausente conta como `""`): é atualizada para os valores do catálogo, inclusive o nome.
  Issues e PRs que já usam a label continuam com ela.
- **Existe e é igual**: nada muda.

Para cada nome de `remove`, também sem diferenciar maiúsculas de minúsculas:

- **Existe no repositório**: é apagada (`Major` é apagada por causa de `major`).
- **Não existe**: nada acontece.

Labels do repositório que não estão em `labels` nem em `remove` são **preservadas**. Não há remoção geral
(`prune`).

### Interface do script (`scripts/sync-labels.cjs`)

Módulo CommonJS sem dependências externas.

- `validateCatalog(catalog)`: não devolve nada quando o catálogo é válido, e lança `Error` dizendo qual item e qual
  regra falhou quando é inválido.
- `planLabelSync(catalog, existing)`: recebe o catálogo e as labels atuais do repositório
  (`[{ name, color, description }]`, com `description` podendo ser `null`) e devolve
  `{ create, update, remove, unchanged }`:
  - `create`: itens de `labels` a criar (`{ name, color, description }`);
  - `update`: `{ current, name, color, description }`, onde `current` é o nome atual no repositório e os outros
    campos são os do catálogo;
  - `remove`: os nomes **como estão no repositório** das labels a apagar (`'Major'`, não `'major'`);
  - `unchanged`: nomes que já estão iguais.
  Labels que só existem no repositório e não estão em `remove` não aparecem em nenhuma das quatro listas.
  `planLabelSync` chama `validateCatalog` antes e propaga o erro de um catálogo inválido.

Exemplo, com o catálogo desta página e o repositório contendo `Bug` (`d73a4a`), `enhancement` (`A2EEEF`, mesma
descrição do catálogo), `Major`, `improvement` e `IA`:
`Bug` vai para `update` (`current: 'Bug'`, `name: 'bug'`), `enhancement` vai para `unchanged`, `remove` fica
`['Major', 'improvement']`, `IA` é ignorada e as outras 14 labels do catálogo vão para `create`.

## Workflow reutilizável `sync-labels.yml`

| Entrada | Tipo | Obrigatória | Uso |
| --- | --- | --- | --- |
| `automation_ref` | string | sim | versão do `.github` (tag estável ou SHA completo), a mesma do `uses` |

1. Faz checkout de `Elavora/.github` em `automation_ref`, só com `.github/labels.json` e `scripts/`, sem persistir
   credenciais.
2. Valida o catálogo com `validateCatalog`. Se o catálogo for inválido, falha sem alterar nada.
3. Lista todas as labels do repositório chamador (com paginação), calcula o plano com `planLabelSync` e aplica as
   criações, atualizações e remoções pela API, com o `GITHUB_TOKEN` do chamador. Uma label de `remove` que já não
   existe na hora de apagar (HTTP 404) não é erro.
4. Publica um resumo com as quantidades criadas, atualizadas, removidas e inalteradas.

Permissões necessárias no chamador: `contents: read` e `issues: write`.

## Workflow chamador em cada repositório

Arquivo `.github/workflows/sync-labels.yml`:

```yaml
name: Sincronizar labels

on:
  schedule:
    - cron: '17 3 * * 1'
  workflow_dispatch:

permissions:
  contents: read

jobs:
  sync:
    permissions:
      contents: read
      issues: write
    uses: Elavora/.github/.github/workflows/sync-labels.yml@1.0.0
    with:
      automation_ref: 1.0.0
```

A execução semanal aplica as mudanças do catálogo em todos os repositórios, mesmo nos que não recebem commits.
`workflow_dispatch` serve para aplicar na hora, por exemplo logo depois de adotar uma nova versão do `.github`.
Os chamadores antigos (`sync_labels.yml` com `micnncim/action-label-syncer` e `prune: true`, que apagava todas as
labels locais, e `sync-labels.yml` com a entrada `prune`) devem ser removidos quando cada repositório adotar o
fluxo. Nesta fase, isso vale para o `devcontainers`; os pacotes `api-*` ficam para depois (ver
[release.md](release.md#migração-dos-repositórios)).

No próprio `.github`, o chamador é `.github/workflows/auto-sync-labels.yml`, com
`uses: ./.github/workflows/sync-labels.yml` e `automation_ref: ${{ github.sha }}`, e roda também em `push` na
`main` quando `.github/labels.json` muda.
