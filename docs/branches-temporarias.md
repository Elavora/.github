# Branches temporárias (`tmp/`)

Esta regra vale para todos os repositórios da organização Elavora, para pessoas e para agentes.

## A regra

Antes de parar de trabalhar, envie o trabalho ainda não salvo para uma branch temporária.

Assim, nada fica só na sua máquina. Outra pessoa (ou você mesmo, em outro computador) consegue continuar dali.

O trabalho pode estar pela metade. A branch temporária não precisa compilar nem passar nos testes.

## O nome da branch

Use `tmp/<nome-do-dev>/<nome-qualquer>`.

- `<nome-do-dev>` é o seu usuário do GitHub, em minúsculas.
- `<nome-qualquer>` é livre. Prefira algo que diga o assunto, com letras minúsculas, números e hífens.

Exemplos válidos:

| Branch | Por quê |
| --- | --- |
| `tmp/felipe-cavalca/cache-redis` | pessoa, com assunto |
| `tmp/felipe-cavalca/wip-2026-10-18` | o nome é livre |

Exemplos que não seguem a regra:

| Branch | Problema |
| --- | --- |
| `tmp/cache-redis` | falta o nome do dev |
| `temp/felipe-cavalca/cache-redis` | o prefixo é `tmp/`, não `temp/` |
| `wip/felipe-cavalca/cache-redis` | o prefixo é `tmp/` |

Só o prefixo `tmp/` muda o comportamento da automação. O resto do nome é convenção para as pessoas.

## Como enviar

```sh
git switch -c tmp/<seu-usuario>/<nome>
git add <arquivos>
git commit -m "wip: <o que estava fazendo>"
git push -u origin tmp/<seu-usuario>/<nome>
```

Para continuar depois, traga a branch, termine o trabalho e mova o resultado para uma branch normal
(`feat/...`, `fix/...`, `docs/...`). O PR sai da branch normal, não da `tmp/`.

## Apagar as branches `tmp/`

As branches `tmp/` são descartáveis. Quando o projeto achar necessário, todas podem ser apagadas, sem aviso.

Por isso, não deixe numa branch `tmp/` nada que você só tenha ali. Se o trabalho importa, leve para uma branch
normal e abra o PR.

## O que a automação faz com `tmp/`

Nada. As branches `tmp/` não geram release, não sincronizam labels e não rodam CI.

| Automação | Por que não roda em `tmp/` |
| --- | --- |
| Release (`auto-release.yml`, chamador de `release.yml`) | só dispara em PR integrado na `main` |
| Sincronizar labels (`auto-sync-labels.yml`) | só dispara por agenda, manualmente ou em push na `main` |
| Testes do `.github` (`test.yml`) | push só na `main`; PR com destino `tmp/**` é ignorado (`branches-ignore`) |
| Qualidade PHP (chamador de `php-quality.yml`) | só dispara em PR e push na `main` |

Um PR aberto **a partir** de uma branch `tmp/` com destino `main` roda o CI normalmente. O filtro de branch do
GitHub em `pull_request` olha a branch de destino, e um PR para a `main` precisa sempre passar pelo CI antes do merge.
O jeito certo continua sendo abrir o PR de uma branch normal.

### Regra para os workflows

Vale para todo arquivo em `.github/workflows/` deste repositório e para todo chamador de exemplo que a documentação
ensina a copiar ([release.md](release.md), [labels.md](labels.md), [qualidade.md](qualidade.md)).

Cada gatilho `push`, `pull_request` ou `pull_request_target` precisa ter **um** destes filtros:

1. `branches` com uma lista só de nomes exatos (sem `*`, `?`, `[` ou `!`), e nenhum deles começando com `tmp/`.
   Exemplo: `branches: [main]`.
2. `branches-ignore` com uma lista que contém `'tmp/**'`.

Gatilho sem filtro de branch (por exemplo `pull_request:` vazio ou só com `types`) não é permitido, porque
dispararia em `tmp/`.

O GitHub não aceita `branches` e `branches-ignore` no mesmo gatilho. Quando o gatilho já tem `branches: [main]`,
ele já ignora `tmp/` e fica como está.

Os gatilhos `schedule`, `workflow_dispatch` e `workflow_call` não têm filtro de branch e ficam fora da regra.
`schedule` roda sempre na branch padrão. `workflow_dispatch` é manual. `workflow_call` herda o evento do chamador.

### Estado de cada workflow deste repositório

| Arquivo | Gatilho | Filtro esperado | Muda? |
| --- | --- | --- | --- |
| `.github/workflows/test.yml` | `pull_request` | `branches-ignore: ['tmp/**']` | sim (hoje não tem filtro) |
| `.github/workflows/test.yml` | `push` | `branches: [main]` | não |
| `.github/workflows/auto-release.yml` | `pull_request` (`types: [closed]`) | `branches: [main]` | não |
| `.github/workflows/auto-sync-labels.yml` | `push` (com `paths`) | `branches: [main]` | não |
| `.github/workflows/release.yml` | só `workflow_call` | fora da regra | não |
| `.github/workflows/sync-labels.yml` | só `workflow_call` | fora da regra | não |
| `.github/workflows/php-quality.yml` | só `workflow_call` | fora da regra | não |

O bloco `on:` esperado em `.github/workflows/test.yml`:

```yaml
on:
  pull_request:
    branches-ignore:
      - 'tmp/**'
  push:
    branches: [main]
```

O padrão `tmp/**` (dois asteriscos) pega qualquer profundidade, como `tmp/felipe-cavalca/nome`. Com um asterisco
só (`tmp/*`), ele pegaria só `tmp/nome`.

Os chamadores de exemplo da documentação não mudam: todos os gatilhos `push` e `pull_request` deles já usam
`branches: [main]` ([release.md](release.md#workflow-chamador-em-cada-repositório),
[labels.md](labels.md#workflow-chamador-em-cada-repositório), [qualidade.md](qualidade.md#como-adotar-num-repositório-api-)).
