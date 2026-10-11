# Rótulos de pull request e versões

O workflow compartilhado de release é chamado após o merge de um pull request em `main`. Os rótulos do PR determinam o incremento:

| Rótulo do pull request | Incremento |
| --- | --- |
| `upgrade`, `breaking` ou `major` | Major |
| `enhancement`, `improvement`, `feature`, `dependencies` ou `minor` | Minor |
| `bug`, `documentation`, `docs`, `refactor`, `tests` ou nenhum rótulo de versão | Patch |

Sem o rótulo `release`, o workflow cria uma prévia, como `v1.4.0-rc.1`. Com `release`, ele promove a prévia pendente mais recente para uma versão estável, como `v1.4.0`. Se não houver prévia pendente, cria uma versão estável diretamente, usando os outros rótulos do PR para escolher o incremento.

## Como chamar o workflow

Use um SHA completo e imutável do commit já integrado deste repositório tanto no `uses` quanto em `automation_ref`. O chamador também precisa conceder `contents: write`, pois o token do `GITHUB_TOKEN` não pode receber permissões maiores dentro de um workflow reutilizável.

```yaml
name: Publicar versão

on:
  pull_request:
    types: [closed]
    branches: [main]

jobs:
  release:
    if: github.event.pull_request.merged == true
    permissions:
      contents: write
    uses: Elavora/.github/.github/workflows/release.yml@<SHA_COMPLETO_IMUTAVEL>
    with:
      package_name: fornecedor/pacote
      automation_ref: <SHA_COMPLETO_IMUTAVEL>
```

Substitua os dois marcadores pelo mesmo SHA completo do commit deste repositório. O workflow compartilhado também valida que o PR foi integrado em `main` e serializa as publicações por repositório, mantendo execuções pendentes na fila.

O workflow cria uma GitHub Release e envia o evento `tag-created`, permitindo que consumidores, como publicadores de imagens GHCR, construam a versão exata. Ao promover uma RC, a tag estável aponta para o mesmo commit da RC selecionada.
