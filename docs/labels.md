# Labels padrão

Todos os repositórios Elavora usam o mesmo conjunto de labels, definido em um catálogo central
(`.github/labels.json`, neste repositório) e aplicado pelo workflow reutilizável
`Elavora/.github/.github/workflows/sync-labels.yml`. O repositório fica com **exatamente** as labels do catálogo:
o que falta é criado, o que difere é corrigido e todo o resto é apagado.

## Catálogo

As nove labels padrão do GitHub, com as cores padrão e descrições traduzidas, mais as oito da Elavora
(`upgrade`, `release`, `feature`, `improvement`, `refactor`, `tests`, `deprecated` e `dependencies`), num total
de 17:

| Label | Cor | Descrição | Efeito na versão |
| --- | --- | --- | --- |
| `bug` | `d73a4a` | Algo não está funcionando | patch |
| `documentation` | `0075ca` | Melhorias ou acréscimos à documentação | patch |
| `duplicate` | `cfd3d7` | Esta issue ou pull request já existe | patch |
| `enhancement` | `a2eeef` | Nova funcionalidade ou pedido | minor |
| `good first issue` | `7057ff` | Boa para quem está começando | patch |
| `help wanted` | `008672` | Precisa de atenção extra | patch |
| `invalid` | `e4e669` | Isto não parece certo | patch |
| `question` | `d876e3` | Mais informações são necessárias | patch |
| `wontfix` | `ffffff` | Isto não será feito | patch |
| `upgrade` | `5319e7` | Alteração incompatível; gera versão major | major |
| `release` | `0052cc` | Gera versão estável em vez de pré-release | estabilidade |
| `feature` | `0e8a16` | Nova funcionalidade compatível; gera versão minor | minor |
| `improvement` | `84b6eb` | Melhoria compatível; gera versão minor | minor (provisório) |
| `refactor` | `fbca04` | Refatoração sem mudança funcional | patch |
| `tests` | `bfdadc` | Criação ou alteração de testes | patch |
| `deprecated` | `e4e669` | Recurso obsoleto ou em processo de remoção | patch |
| `dependencies` | `0366d6` | Atualização de dependências | patch |

As regras completas de versão estão em [versionamento.md](versionamento.md). `enhancement`, `feature` e
`improvement` são labels próprias (não aliases) e as três dão minor. `improvement` → minor ainda está para
confirmar com o usuário; trocar a faixa é editar só `BUMP_LABELS` em `scripts/release-version.cjs`.

`major`, `minor`, `patch` e `breaking` não fazem parte do catálogo e são apagadas onde existirem, como qualquer
outra label local.

### Formato de `.github/labels.json`

Um array JSON de objetos `{ "name", "color", "description" }`, na ordem da tabela acima:

```json
[
  { "name": "bug", "color": "d73a4a", "description": "Algo não está funcionando" }
]
```

O catálogo é válido quando:

- é um array não vazio (um objeto, como `{ "labels": [...] }`, é inválido);
- cada item tem exatamente as chaves `name`, `color` e `description`, todas strings;
- `name` não é vazio, não tem espaços nas pontas e é único sem diferenciar maiúsculas de minúsculas
  (`Bug` e `bug` juntos são inválidos);
- `color` tem 6 dígitos hexadecimais minúsculos, sem `#` (`d73a4a` é válido; `#d73a4a`, `D73A4A` e `fff` não são);
- `description` tem no máximo 100 caracteres, que é o limite do GitHub.

## Sincronização

Comparando nomes sem diferenciar maiúsculas de minúsculas:

- **Label do catálogo que não existe no repositório**: é criada com nome, cor e descrição do catálogo.
- **Label do catálogo que existe, mas difere** no nome (só na caixa, como `Bug`), na cor (comparada sem diferenciar
  caixa) ou na descrição (uma descrição ausente conta como `""`): é atualizada para os valores do catálogo,
  inclusive o nome. Issues e PRs que já usam a label continuam com ela.
- **Label do catálogo que existe e é igual**: nada muda.
- **Label do repositório que não está no catálogo**: é **apagada** (prune total). Não há lista de exceções nem opção
  para preservar labels locais.

Ao apagar uma label, o GitHub a retira de todas as issues e PRs que a usavam, e essa classificação se perde.
Para manter uma label, ela precisa entrar no catálogo.

### Armadilha: labels criadas por bots

Bots que aplicam labels criam a label no repositório quando ela não existe. Se a label estiver fora do catálogo,
a sincronização seguinte a apaga, e o bot a recria no próximo PR. O caso mais comum é o **Dependabot**, que por
padrão marca os PRs com `dependencies` e com o nome do ecossistema (`php`, `github_actions`, `docker`...).
`dependencies` está no catálogo e fica; as do ecossistema são apagadas.

Labels de bots fora do catálogo **não entram nele**. Há duas formas de lidar com elas:

1. **Mudar a configuração do bot.** No Dependabot, defina `labels` em cada `updates` do `.github/dependabot.yml`
   usando só labels do catálogo, por exemplo:

   ```yaml
   updates:
     - package-ecosystem: composer
       directory: /
       schedule:
         interval: weekly
       labels: [dependencies]
   ```

   Quando `labels` é definido, o Dependabot usa só essas labels e deixa de criar a do ecossistema.
2. **Aceitar a remoção.** A label continua sendo criada pelo bot e apagada toda semana. Isso não afeta a versão,
   porque uma label desconhecida vale patch, mas a label some dos PRs depois de cada sincronização.

A primeira opção é a recomendada, e cada repositório a ajusta no seu `dependabot.yml`.

### Interface do script (`scripts/sync-labels.cjs`)

Módulo CommonJS sem dependências externas.

- `validateCatalog(catalog)`: não devolve nada quando o catálogo é válido, e lança `Error` dizendo qual item e qual
  regra falhou quando é inválido.
- `planLabelSync(catalog, existing)`: recebe o catálogo e as labels atuais do repositório
  (`[{ name, color, description }]`, com `description` podendo ser `null`) e devolve
  `{ create, update, remove, unchanged }`:
  - `create`: itens do catálogo a criar (`{ name, color, description }`);
  - `update`: `{ current, name, color, description }`, onde `current` é o nome atual no repositório e os outros
    campos são os do catálogo;
  - `remove`: os nomes, **como estão no repositório**, de todas as labels que não estão no catálogo;
  - `unchanged`: nomes que já estão iguais.

  Cada label do repositório aparece em exatamente uma das listas `update`, `remove` ou `unchanged`.
  `planLabelSync` chama `validateCatalog` antes e propaga o erro de um catálogo inválido, sem devolver plano.

Exemplo, com o catálogo desta página e o repositório contendo `Bug` (`d73a4a`), `enhancement` (`A2EEEF`, mesma
descrição do catálogo), `php`, `Major` e `IA`:
`Bug` vai para `update` (`current: 'Bug'`, `name: 'bug'`), `enhancement` vai para `unchanged`, `remove` fica
`['php', 'Major', 'IA']` e as outras 15 labels do catálogo vão para `create`.

## Workflow reutilizável `sync-labels.yml`

| Entrada | Tipo | Obrigatória | Uso |
| --- | --- | --- | --- |
| `automation_ref` | string | sim | versão do `.github` (tag estável ou SHA completo), a mesma do `uses` |

1. Faz checkout de `Elavora/.github` em `automation_ref`, só com `.github/labels.json` e `scripts/`, sem persistir
   credenciais.
2. Valida o catálogo com `validateCatalog`. Se o catálogo for inválido, falha sem alterar nada. Isso impede que um
   catálogo quebrado apague todas as labels.
3. Lista todas as labels do repositório chamador (com paginação), calcula o plano com `planLabelSync` e aplica as
   criações, atualizações e remoções pela API, com o `GITHUB_TOKEN` do chamador. Uma label que já não existe na
   hora de apagar (HTTP 404) não é erro.
4. Publica um resumo com as quantidades e os nomes das labels criadas, atualizadas e removidas, e a quantidade das
   inalteradas.

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
Os chamadores antigos (`sync_labels.yml` com `micnncim/action-label-syncer` e `sync-labels.yml` com a entrada
`prune`) devem ser removidos quando cada repositório adotar o fluxo. Nesta fase, isso vale para o `devcontainers`;
os pacotes `api-*` ficam para depois (ver [release.md](release.md#migração-dos-repositórios)).

No próprio `.github`, o chamador é `.github/workflows/auto-sync-labels.yml`, com
`uses: ./.github/workflows/sync-labels.yml` e `automation_ref: ${{ github.sha }}`, e roda também em `push` na
`main` quando `.github/labels.json` muda.
