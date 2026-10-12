# Sincronização de labels

O catálogo compartilhado fica em `.github/labels.json`. O workflow reutilizável `.github/workflows/sync-labels.yml` cria labels ausentes e atualiza cor e descrição das que já existem no repositório chamador.

Labels locais que não aparecem no catálogo são preservadas. Assim, os projetos podem manter labels específicas sem que a sincronização as remova.

## Como habilitar em um repositório

Adicione um workflow chamador no repositório e substitua `SHA_COMPLETO_IMUTAVEL` pelo SHA completo de um commit integrado do repositório `.github`. Use o mesmo SHA no `uses` e na entrada `automation_ref`.

```yaml
name: Sincronizar labels

on:
  push:
    branches: [main]
  schedule:
    - cron: '17 3 * * 1'
  workflow_dispatch:

jobs:
  sincronizar:
    permissions:
      contents: read
      issues: write
    uses: Elavora/.github/.github/workflows/sync-labels.yml@SHA_COMPLETO_IMUTAVEL
    with:
      automation_ref: SHA_COMPLETO_IMUTAVEL
```

O `GITHUB_TOKEN` do repositório chamador precisa de `contents: read` e `issues: write`. O gatilho semanal aplica atualizações do catálogo central mesmo quando o repositório não recebe commits; `workflow_dispatch` permite executar a sincronização manualmente.

## Labels de versão

Os nomes permanecem alinhados ao fluxo de release usado nos projetos Elavora:

| Label | Efeito na versão |
| --- | --- |
| `upgrade`, `breaking` ou `major` | incremento major |
| `enhancement`, `improvement`, `feature`, `dependencies` ou `minor` | incremento minor |
| `bug`, `documentation`, `refactor`, `tests`, `patch` ou nenhuma label de versão | incremento patch |
| `release` | promove a pré-release pendente para estável |

A sincronização só mantém o catálogo de labels. A criação de tags e releases é feita pelo workflow de release separado.
