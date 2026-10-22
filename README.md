# .github

Automação compartilhada da organização Elavora.

## O que é

Este repositório guarda os workflows do GitHub Actions que todos os repositórios da Elavora usam. Em vez de cada
repositório manter o próprio CI e o próprio processo de release, ele chama os workflows daqui.

Com isso, todo repositório da organização ganha:

- **release automática**: cada merge na `main` gera uma tag e uma GitHub Release, com o número calculado pelas
  labels do PR e notas em português;
- **labels iguais em todos os repositórios**, sincronizadas toda semana a partir de um catálogo único;
- **qualidade do código PHP** em cada PR dos pacotes `api-*`: formatação automática, lint, análise estática, testes e
  um comentário no PR com o resultado.

## Para quem é

- **Quem abre PR** num repositório da Elavora: precisa saber só qual label usar. Veja o
  [guia rápido de labels](docs/labels.md#guia-rápido-qual-label-usar-no-meu-pr).
- **Quem mantém um repositório** e quer adotar o fluxo: siga os três passos abaixo.
- **Quem mexe nesta automação**: veja [Desenvolvimento](#desenvolvimento) e a referência de cada documento.

## Como adotar num repositório

1. **Copie os chamadores.** Um chamador é um arquivo pequeno em `.github/workflows/` que só chama o workflow
   daqui. Copie o de release ([docs/release.md](docs/release.md#workflow-chamador-em-cada-repositório)) e o de labels
   ([docs/labels.md](docs/labels.md#workflow-chamador-em-cada-repositório)). Nos pacotes `api-*`, copie também o de
   qualidade ([docs/qualidade.md](docs/qualidade.md#como-adotar-num-repositório-api-)).
2. **Fixe a versão desta automação.** No `uses` de cada chamador, use uma tag estável deste repositório (por exemplo
   `@1.2.0`). A versão aparece só ali, e o Dependabot consegue atualizá-la sozinho
   (ver [docs/versao-da-automacao.md](docs/versao-da-automacao.md)).
3. **Use as labels nos PRs.** A label decide qual número da versão sobe, e a label `release` publica a estável
   (ver [docs/labels.md](docs/labels.md#guia-rápido-qual-label-usar-no-meu-pr)).

## Documentação

Leia nesta ordem. Cada documento começa por um guia em linguagem simples e termina com a referência técnica.

1. [Release automática](docs/release.md): o que acontece a cada merge na `main`, o chamador que cada repositório
   copia e o que fazer quando a release falha.
2. [Regras de versão](docs/versionamento.md): como as labels do PR viram `X.Y.Z` ou `X.Y.Z-beta.N`, com exemplos
   do dia a dia.
3. [Labels padrão](docs/labels.md): qual label usar no PR, o catálogo completo e a sincronização semanal.
4. [Notas de release](docs/notas-de-release.md): o título e o corpo de cada GitHub Release, a seção "Notas de
   release" do template de PR e o que muda para as releases já publicadas.
5. [Versão da automação](docs/versao-da-automacao.md): como os workflows descobrem de qual versão do `.github`
   baixar os scripts, as permissões dos chamadores e os limites (OIDC, forks).
6. [Qualidade do código PHP](docs/qualidade.md): o workflow que formata, confere e testa os pacotes `api-*` em cada
   PR, como cada repositório adota as regras do `elavora/code-standards` e como o devcontainer usa as mesmas regras.

## O que há neste repositório

| O quê | Arquivos | Documentação |
| --- | --- | --- |
| Release automática a cada merge na `main`, com notificação ao Packagist | `.github/workflows/release.yml`, `scripts/release-version.cjs`, `scripts/packagist.cjs` | [docs/release.md](docs/release.md) |
| Regras de versão (`X.Y.Z` e `X.Y.Z-beta.N` pelas labels do PR) | `scripts/release-version.cjs` | [docs/versionamento.md](docs/versionamento.md) |
| Notas de release em português: título padronizado, resumo da versão, mudanças agrupadas pelas labels e link de comparação | `scripts/release-notes.cjs` | [docs/notas-de-release.md](docs/notas-de-release.md) |
| Template de PR padrão da organização, com a seção opcional "Notas de release" | `.github/PULL_REQUEST_TEMPLATE.md` | [docs/notas-de-release.md](docs/notas-de-release.md#template-de-pr-da-organização) |
| Labels padrão e sincronização | `.github/labels.json`, `.github/workflows/sync-labels.yml`, `scripts/sync-labels.cjs` | [docs/labels.md](docs/labels.md) |
| Versão da automação: os workflows descobrem a própria versão pelo OIDC | `scripts/automation-ref.cjs` | [docs/versao-da-automacao.md](docs/versao-da-automacao.md) |
| Branches temporárias `tmp/<nome-do-dev>/<nome>`: trabalho não salvo sobe antes de parar, e a automação ignora `tmp/**` | todos os workflows (`branches` ou `branches-ignore`) | [docs/branches-temporarias.md](docs/branches-temporarias.md) |
| Qualidade dos pacotes PHP em PR e na `main`, na imagem `ghcr.io/elavora/php-dev:8.3-latest`: formatação com commit automático, lint, auditoria, testes, cobertura e comentário no PR | `.github/workflows/php-quality.yml`, `scripts/quality.cjs` | [docs/qualidade.md](docs/qualidade.md) |

As regras de estilo (PHP-CS-Fixer em PER-CS e `.editorconfig`) não ficam aqui: elas são o pacote Composer
`elavora/code-standards` (repositório `Elavora/code-standards`), que cada projeto instala no `require-dev`.

Este repositório também é versionado pelo próprio fluxo (chamadores `auto-release.yml` e `auto-sync-labels.yml`).
Nos consumidores, use uma tag estável deste repositório no `uses`. A partir da `1.1.0`, a versão aparece só ali: o
workflow descobre a própria versão pelo token OIDC e o chamador concede `id-token: write`. Assim, o Dependabot
consegue atualizar a automação sozinho (ver [docs/versao-da-automacao.md](docs/versao-da-automacao.md)).

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

O workflow `.github/workflows/test.yml` roda em todo PR (menos os com destino `tmp/**`) e em push na `main`. Ele
executa os testes com o mesmo
comando (`node --test "tests/*.test.cjs"`) e o
`actionlint` 1.7.12 (`rhysd/actionlint:1.7.12`, em container) sobre os workflows de `.github/workflows/`.
Os testes de `scripts/quality.cjs` e de `scripts/release-notes.cjs` (`tests/release-notes.test.cjs`) fazem parte do
mesmo `node --test "tests/*.test.cjs"`.

As actions de terceiros nos workflows ficam fixadas por SHA completo, com a versão em comentário:
`actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1` (v7.0.1) e
`actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3` (v9.0.0). Para atualizar uma delas, troque o SHA e
o comentário em todos os workflows.
