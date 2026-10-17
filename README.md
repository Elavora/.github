# .github

Automação compartilhada da organização Elavora. Os outros repositórios (`devcontainers` e os pacotes `api-*`)
chamam os workflows reutilizáveis daqui, fixando uma versão deste repositório.

| O quê | Arquivos | Documentação |
| --- | --- | --- |
| Release automática a cada merge na `main`, com notificação ao Packagist | `.github/workflows/release.yml`, `scripts/release-version.cjs`, `scripts/packagist.cjs` | [docs/release.md](docs/release.md) |
| Regras de versão (`X.Y.Z` e `X.Y.Z-beta.N` pelas labels do PR) | `scripts/release-version.cjs` | [docs/versionamento.md](docs/versionamento.md) |
| Labels padrão e sincronização | `.github/labels.json`, `.github/workflows/sync-labels.yml`, `scripts/sync-labels.cjs` | [docs/labels.md](docs/labels.md) |
| Qualidade dos pacotes PHP em PR e na `main`: formatação com commit automático, lint, auditoria, testes, cobertura e comentário no PR | `.github/workflows/php-quality.yml`, `scripts/quality.cjs` | [docs/qualidade.md](docs/qualidade.md) |

As regras de estilo (PHP-CS-Fixer em PER-CS e `.editorconfig`) não ficam aqui: elas são o pacote Composer
`elavora/code-standards` (repositório `Elavora/code-standards`), que cada projeto instala no `require-dev`.

Este repositório também é versionado pelo próprio fluxo (chamadores `auto-release.yml` e `auto-sync-labels.yml`).
Nos consumidores, use uma tag estável deste repositório no `uses` e no `automation_ref`.

## Documentação

Leia nesta ordem:

1. [Release automática](docs/release.md): o que acontece a cada merge na `main` e como cada repositório chama o
   workflow de release.
2. [Regras de versão](docs/versionamento.md): como as labels do PR viram `X.Y.Z` ou `X.Y.Z-beta.N`.
3. [Labels padrão](docs/labels.md): o catálogo e a sincronização semanal.
4. [Qualidade do código PHP](docs/qualidade.md): o workflow que formata, confere e testa os pacotes `api-*` em cada
   PR, como cada repositório adota as regras do `elavora/code-standards` e como o devcontainer usa as mesmas regras.

## Desenvolvimento

Os scripts usam só módulos nativos do Node.js (20 ou mais novo), sem `npm install`. Os testes ficam em
`tests/*.test.cjs`, usam `node:test` e nunca fazem chamadas reais ao GitHub nem ao Packagist (o `fetch` e o `sleep`
são injetados). Eles rodam em container, sem instalar nada na máquina:

```sh
docker run --rm -v "$PWD:/work:ro" -w /work node:22-alpine node --test "tests/*.test.cjs"
```

O padrão vai entre aspas para que o próprio Node expanda o glob. `node --test tests/` não funciona no Node 22
(`Cannot find module '/work/tests'`).

No PowerShell, use `${PWD}` no lugar de `$PWD`.

O workflow `.github/workflows/test.yml` roda em todo PR e em push na `main`. Ele executa os testes com o mesmo
comando (`node --test "tests/*.test.cjs"`) e o
`actionlint` 1.7.12 (`rhysd/actionlint:1.7.12`, em container) sobre os workflows de `.github/workflows/`.
Os testes de `scripts/quality.cjs` fazem parte do mesmo `node --test "tests/*.test.cjs"`.

As actions de terceiros nos workflows ficam fixadas por SHA completo, com a versão em comentário:
`actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1` (v7.0.1) e
`actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3` (v9.0.0). Para atualizar uma delas, troque o SHA e
o comentário em todos os workflows.
