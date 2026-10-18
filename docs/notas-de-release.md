# Notas de release

Até a `1.1.0`, cada GitHub Release trazia o "What's Changed" automático do GitHub: o título do PR, o autor e um
link "Full Changelog", em inglês e sem dizer se a versão é estável, de quanto foi o salto nem o que era novidade ou
correção. O título também mudava de um repositório para outro (`Elavora/.github 1.1.0`, `elavora/devcontainers 0.3.0`),
porque vinha da entrada `package_name` de cada chamador.

A partir da `1.2.0`, o workflow central de release (ver [release.md](release.md)) escreve as notas ele mesmo, em
português e no mesmo formato em todos os repositórios:

- um título padronizado;
- um resumo da versão: estável ou beta e o salto em relação à estável anterior;
- logo abaixo de "O que há de novo", desde qual versão as mudanças estão sendo listadas, sempre com o número da
  estável anterior;
- as mudanças agrupadas pelas labels do catálogo (ver [labels.md](labels.md)), cada uma com o texto, o número e o link
  do PR e o autor;
- na estável, tudo o que saiu nas betas desde a estável anterior, com a beta em que cada item entrou;
- a lista de contribuidores, sem repetir ninguém;
- o link de comparação entre a versão anterior e a nova.

Tudo o que o workflow escreve na página da release fica em português: no lugar do "What's Changed" vem
**O que há de novo**, no lugar do quadro "Contributors" vem a seção **Contribuidores** e no lugar do "Full
Changelog" vem **Comparação completa**. Os autores aparecem como links para o perfil, e não como `@menção`, para
que o GitHub não desenhe o quadro "Contributors" em inglês (ver [Autores sem @menção](#autores-sem-menção)).

O texto de cada item é o título do PR. Quem abre o PR pode trocar esse texto preenchendo a seção opcional
**Notas de release** do [template de PR da organização](#template-de-pr-da-organização).

As releases publicadas antes da `1.2.0` não são reescritas (ver [Releases já publicadas](#releases-já-publicadas)).

## Como fica uma release

Uma estável `1.2.0` do `Elavora/.github`, depois de duas betas, com quatro PRs:

| PR | Título | Labels | Autor | Entrou em |
| --- | --- | --- | --- | --- |
| #40 | `docs: corrige exemplo do chamador` | `documentation` | `ScriptPlayerAgent` | `1.1.1-beta.1` |
| #41 | `feat: gera as notas de release em pt-BR` | `enhancement` | `ScriptPlayerAgent` | `1.2.0-beta.1` |
| #42 | `fix: aceita tag legada como estável anterior` | `bug` | `Felipe-Cavalca` | nesta versão |
| #43 | `build(deps): bump actions/checkout from 7.0.1 to 7.0.2` | `dependencies`, `release` | `dependabot[bot]` | nesta versão |

O #41 tem a seção "Notas de release" preenchida com `Release com resumo, grupos por label e link de comparação.`
O #43 é o PR com a label `release` que promoveu a versão.

Título: `Elavora/.github 1.2.0`. Corpo:

```markdown
Versão estável **1.2.0**, com salto minor (novidades compatíveis).

Reúne as betas `1.1.1-beta.1` e `1.2.0-beta.1`. Cada item mostra a beta em que entrou; os itens sem beta são novos nesta versão.

## O que há de novo

Mudanças desde a versão estável `1.1.0`.

### Novidades

- Release com resumo, grupos por label e link de comparação. ([#41](https://github.com/Elavora/.github/pull/41)) por [ScriptPlayerAgent](https://github.com/ScriptPlayerAgent) · entrou na `1.2.0-beta.1`

### Correções

- Aceita tag legada como estável anterior ([#42](https://github.com/Elavora/.github/pull/42)) por [Felipe-Cavalca](https://github.com/Felipe-Cavalca)

### Outras mudanças

- Corrige exemplo do chamador ([#40](https://github.com/Elavora/.github/pull/40)) por [ScriptPlayerAgent](https://github.com/ScriptPlayerAgent) · entrou na `1.1.1-beta.1`
- Bump actions/checkout from 7.0.1 to 7.0.2 ([#43](https://github.com/Elavora/.github/pull/43)) por [dependabot](https://github.com/apps/dependabot)

## Contribuidores

- [dependabot](https://github.com/apps/dependabot)
- [Felipe-Cavalca](https://github.com/Felipe-Cavalca)
- [ScriptPlayerAgent](https://github.com/ScriptPlayerAgent)

**Comparação completa:** [`1.1.0...1.2.0`](https://github.com/Elavora/.github/compare/1.1.0...1.2.0)
```

E a beta `1.2.0-beta.1`, que saiu antes, só com o #41 (a tag anterior era a `1.1.1-beta.1`):

```markdown
Pré-release **1.2.0-beta.1** da `1.2.0`, com salto minor (novidades compatíveis) em relação à última estável.

## O que há de novo

Mudanças desde `1.1.1-beta.1`. Última versão estável: `1.1.0`.

### Novidades

- Release com resumo, grupos por label e link de comparação. ([#41](https://github.com/Elavora/.github/pull/41)) por [ScriptPlayerAgent](https://github.com/ScriptPlayerAgent)

## Contribuidores

- [ScriptPlayerAgent](https://github.com/ScriptPlayerAgent)

**Comparação completa:** [`1.1.1-beta.1...1.2.0-beta.1`](https://github.com/Elavora/.github/compare/1.1.1-beta.1...1.2.0-beta.1)
```

## Termos usados nesta página

- **Tag de partida**: a tag a partir da qual a versão é calculada, definida em
  [release.md](release.md#intervalo-de-prs) (a de maior versão entre as tags reconhecidas que apontam para um
  ancestral do merge). Pode ser uma estável ou uma beta.
- **Estável anterior**: entre as tags estáveis reconhecidas (`X.Y.Z` e as legadas `vX.Y.Z`) que apontam para um
  ancestral do merge, a de maior versão. Com a mesma versão nas duas formas (`v1.1.0` e `1.1.0`), vale o nome sem
  `v`. Pode não existir.
- **Base** de uma tag: a parte `X.Y.Z`, sem o `-beta.N`.
- **Salto**: a comparação entre a base da nova tag e a base da estável anterior. Muda o major → `major`; senão, muda
  o minor → `minor`; senão → `patch`.
- **Intervalo das notas**: os PRs listados no corpo.
  - Na **beta**, são os PRs do intervalo da versão, desde a tag de partida (o mesmo conjunto que já alimenta
    `aggregateLabels`).
  - Na **estável**, são os PRs integrados desde a estável anterior, o que inclui os que já saíram nas betas.

## Título da release

Formato único em todos os repositórios: `<owner>/<repo> <tag>`, com o nome do repositório exatamente como o GitHub
o informa (`github.repository`).

| Repositório | Tag | Título |
| --- | --- | --- |
| `Elavora/.github` | `1.2.0` | `Elavora/.github 1.2.0` |
| `Elavora/devcontainers` | `0.4.0-beta.1` | `Elavora/devcontainers 0.4.0-beta.1` |
| `Elavora/api-framework` | `2.0.0` | `Elavora/api-framework 2.0.0` |

A entrada `package_name` do workflow reutilizável deixa de influenciar o título. Ela continua aceita para não quebrar
os chamadores que a passam (um `with:` com entrada desconhecida faz o workflow falhar), mas o valor é ignorado. Os
chamadores podem removê-la quando forem atualizados.

## Corpo da release

O corpo é Markdown e tem sempre esta ordem, com uma linha em branco entre os blocos:

1. a linha de resumo;
2. só na estável, e só quando houver betas no intervalo: a linha das betas;
3. o título `## O que há de novo`, sempre presente, seguido da [linha "desde"](#linha-desde);
4. os grupos de mudanças, na ordem da tabela abaixo, omitindo os grupos vazios. Sem nenhum PR, no lugar dos grupos
   vai a linha `Nenhum pull request encontrado neste intervalo.`;
5. quando a lista foi cortada pelo limite de tamanho, o aviso de corte (ver [Limite de tamanho](#limite-de-tamanho));
6. a seção de [contribuidores](#contribuidores), quando há pelo menos um autor;
7. a linha de comparação.

O corpo termina com uma única quebra de linha (`\n`), sem espaços no fim das linhas. Quebras de linha são sempre
`\n`.

### Linha de resumo

A linha de resumo diz o que é a versão e o tamanho do salto. Desde qual versão as mudanças contam fica na
[linha "desde"](#linha-desde), logo abaixo de "O que há de novo", e por isso o resumo não repete o número da estável
anterior nem a tag de partida.

`<tag>` e `<base>` são substituídos pelos nomes das tags. `<salto>` é um destes textos:

| Salto | Texto |
| --- | --- |
| `major` | `major (quebra de compatibilidade)` |
| `minor` | `minor (novidades compatíveis)` |
| `patch` | `patch (correções e ajustes)` |

| Caso | Linha |
| --- | --- |
| estável, com estável anterior | `Versão estável **<tag>**, com salto <salto>.` |
| estável, sem estável anterior | `Versão estável **<tag>**.` |
| beta, com estável anterior | ``Pré-release **<tag>** da `<base>`, com salto <salto> em relação à última estável.`` |
| beta, sem estável anterior | ``Pré-release **<tag>** da `<base>`.`` |

Exemplos:

- `1.2.0` depois de `1.1.0` → `Versão estável **1.2.0**, com salto minor (novidades compatíveis).`
- `2.0.0` depois de `v1.4.2` (legada) → `Versão estável **2.0.0**, com salto major (quebra de compatibilidade).`
- `1.1.2` depois de `1.1.1` → `Versão estável **1.1.2**, com salto patch (correções e ajustes).`
- `1.0.0` sem estável anterior → `Versão estável **1.0.0**.`
- `1.2.0-beta.2`, estável `1.1.0` →
  ``Pré-release **1.2.0-beta.2** da `1.2.0`, com salto minor (novidades compatíveis) em relação à última estável.``
- `1.1.2-beta.1`, estável `1.1.1` →
  ``Pré-release **1.1.2-beta.1** da `1.1.2`, com salto patch (correções e ajustes) em relação à última estável.``
- `0.0.1-beta.1` sem nenhuma tag → ``Pré-release **0.0.1-beta.1** da `0.0.1`.``

Se a base da nova tag não for maior que a da estável anterior (não acontece pelas regras de
[versionamento.md](versionamento.md), mas a função não confia nisso), o salto é `patch`.

### Linha "desde"

Fica logo abaixo do título `## O que há de novo`, separada dele e dos grupos por linhas em branco, e diz desde
qual versão as mudanças estão sendo listadas. O número da estável anterior sempre aparece quando ela existe.

| Caso | Linha |
| --- | --- |
| estável, com estável anterior | ``Mudanças desde a versão estável `<estável anterior>`.`` |
| estável, sem estável anterior | `Primeira versão estável; mudanças desde o início do projeto.` |
| beta, com tag de partida e estável anterior | ``Mudanças desde `<tag de partida>`. Última versão estável: `<estável anterior>`.`` |
| beta, com tag de partida e sem estável anterior | ``Mudanças desde `<tag de partida>`. Ainda não há versão estável.`` |
| beta, sem tag de partida e com estável anterior | ``Mudanças desde o início do projeto. Última versão estável: `<estável anterior>`.`` |
| beta, sem tag de partida nem estável anterior | `Mudanças desde o início do projeto. Ainda não há versão estável.` |

Exemplos:

- `1.2.0` depois de `1.1.0` → ``Mudanças desde a versão estável `1.1.0`.``
- `2.0.0` depois de `v1.4.2` (legada) → ``Mudanças desde a versão estável `v1.4.2`.``
- `1.0.0` sem estável anterior → `Primeira versão estável; mudanças desde o início do projeto.`
- `1.2.0-beta.2`, partida `1.2.0-beta.1`, estável `1.1.0` → ``Mudanças desde `1.2.0-beta.1`. Última versão estável: `1.1.0`.``
- `1.1.2-beta.1`, partida e estável `1.1.1` → ``Mudanças desde `1.1.1`. Última versão estável: `1.1.1`.``
- `0.1.0-beta.2`, partida `0.1.0-beta.1`, sem estável → ``Mudanças desde `0.1.0-beta.1`. Ainda não há versão estável.``
- `0.0.1-beta.1` sem nenhuma tag → `Mudanças desde o início do projeto. Ainda não há versão estável.`

Na estável, a tag de partida (`previousTag`) não é usada. A "estável anterior" desta linha e do salto é a mesma:
uma `previousStable` vazia (`''`), que `parseTag` não reconhece ou que é uma beta (`'1.1.0-beta.2'`) conta como "sem
estável anterior" no resumo, na linha "desde" e na linha de comparação (ver
[Termos usados nesta página](#termos-usados-nesta-página)). Uma `previousTag` vazia conta como "sem tag de partida".

Exemplo: `1.0.0` com `previousStable: '1.0.0-beta.3'` → resumo `Versão estável **1.0.0**.`, linha "desde"
`Primeira versão estável; mudanças desde o início do projeto.` e última linha
``**Histórico completo:** [commits até `1.0.0`](https://github.com/<owner>/<repo>/commits/1.0.0)``.

### Linha das betas

Só na estável, quando a lista de betas não está vazia. As betas aparecem em ordem crescente de versão (base e
depois `N`, numericamente), entre crases, unidas em português (`a`, `a e b`, `a, b e c`). Todo nome da lista
precisa ser uma beta do formato novo (`parseTag` reconhece, não é legada e tem `beta`); senão a função lança
`TypeError`, como `assignIntroducedIn` (`'1.2.0'`, `'v1.2.0'`, `'x'`, `''`). Essa validação vale também quando a
nova tag é beta, em que a lista é ignorada na saída.

- uma beta: ``Reúne a beta `1.2.0-beta.1`. Cada item mostra a beta em que entrou; os itens sem beta são novos nesta versão.``
- duas ou mais: ``Reúne as betas `1.1.1-beta.1`, `1.2.0-beta.1` e `1.2.0-beta.2`. Cada item mostra a beta em que entrou; os itens sem beta são novos nesta versão.``

Na beta, a lista de betas é ignorada e essa linha não existe.

### Grupos de mudanças

Cada PR entra em **um** grupo só: o primeiro da tabela que tiver alguma das suas labels. As labels são comparadas
sem diferenciar maiúsculas de minúsculas.

| Ordem | Título do grupo | Labels |
| --- | --- | --- |
| 1 | `### Quebra de compatibilidade` | `upgrade` |
| 2 | `### Novidades` | `feature`, `enhancement` |
| 3 | `### Melhorias` | `improvement` |
| 4 | `### Correções` | `bug` |
| 5 | `### Outras mudanças` | qualquer outra label (`documentation`, `tests`, `refactor`, `dependencies`, `deprecated`...) ou nenhuma |

A label `release` não define grupo: um PR só com `release` vai para "Outras mudanças".

Exemplos: `bug` + `upgrade` → Quebra de compatibilidade; `Enhancement` + `bug` → Novidades;
`improvement` + `bug` → Melhorias; `documentation` + `release` → Outras mudanças; nenhuma label → Outras mudanças.

Dentro do grupo, os PRs ficam em ordem crescente de número. Se o mesmo número aparecer mais de uma vez na lista
recebida, vale a primeira ocorrência.

O título do grupo fica numa linha, seguido de uma linha em branco e dos itens, um por linha.

### Item

```
- <texto> ([#<número>](<url>)) por [<autor>](<perfil>) · entrou na `<beta>`
```

- **`<texto>`**: as notas do PR (ver [Seção "Notas de release"](#seção-notas-de-release)) quando estiverem
  preenchidas. Senão, o título do PR com o prefixo do Conventional Commits removido e a primeira letra em maiúscula:
  - o prefixo é `tipo`, `tipo(escopo)`, `tipo!` ou `tipo(escopo)!`, seguido de `:` e espaço, no começo do título
    (regex `^[A-Za-z]+(\([^)]*\))?!?:\s+`);
  - `feat: gera as notas` → `Gera as notas`; `fix(release)!: troca o título` → `Troca o título`;
    `build(deps): bump x` → `Bump x`;
  - título sem prefixo fica como está, só com a primeira letra em maiúscula: `atualiza o README` → `Atualiza o README`;
  - se depois de remover o prefixo não sobrar nada (`feat: `), vale o título original sem espaços nas pontas.
  O título nunca é alterado além disso (sem escapar Markdown, sem tirar ponto final).
- **`<url>`**: o link do PR (`html_url`).
- **` por [<autor>](<perfil>)`**: o login de quem abriu o PR, como link para o perfil, nunca como `@menção` (ver
  [Autores sem @menção](#autores-sem-menção)):
  - usuário: `Felipe-Cavalca` → `[Felipe-Cavalca](https://github.com/Felipe-Cavalca)`;
  - bot (login terminado em `[bot]`): o sufixo é removido do nome e o perfil é o do app,
    `dependabot[bot]` → `[dependabot](https://github.com/apps/dependabot)`;
  - sem autor (usuário apagado), esse trecho não aparece.
- **`` · entrou na `<beta>` ``**: só na estável, para o PR que já saiu numa beta. Na beta, nunca aparece, mesmo que o
  PR traga essa informação.

Notas com mais de uma linha: a primeira linha vai no lugar do texto do item, e as demais vêm logo abaixo, cada uma
com dois espaços na frente, para continuar dentro do item. Se a primeira linha começar com `- ` ou `* `, esse
marcador é removido.

Notas do PR:

```markdown
## Notas de release

- O título da release passa a ser `<owner>/<repo> <tag>`.
  A entrada `package_name` é ignorada.
```

Item gerado (PR #44, na estável):

```markdown
- O título da release passa a ser `<owner>/<repo> <tag>`. ([#44](https://github.com/Elavora/.github/pull/44)) por [ScriptPlayerAgent](https://github.com/ScriptPlayerAgent)
    A entrada `package_name` é ignorada.
```

(A segunda linha já vinha com dois espaços no PR e ganhou mais dois.)

### Contribuidores

Título `## Contribuidores`, uma linha em branco e um item por autor dos PRs listados em "O que há de novo":

```
- [<autor>](<perfil>)
```

- O nome e o perfil seguem as mesmas regras do item (bot sem `[bot]`, perfil em `https://github.com/apps/<nome>`).
- Sem repetir: logins iguais sem diferenciar maiúsculas de minúsculas contam como o mesmo autor, e fica a grafia
  da primeira ocorrência na lista de PRs recebida.
- Ordem alfabética do nome exibido em minúsculas, por comparação simples de strings (`dependabot`,
  `felipe-cavalca`, `scriptplayeragent`).
- PRs sem autor não entram. Sem nenhum autor, a seção inteira (título incluído) não aparece.
- Os autores de PRs retirados pelo [limite de tamanho](#limite-de-tamanho) continuam na lista.

### Linha de comparação

A versão anterior é a **estável anterior** na estável, e a **tag de partida** na beta. Numa estável sem estável
anterior (inclusive quando `previousStable` é vazia, não reconhecida ou beta), a linha é a de histórico, mesmo que
`previousTag` esteja preenchida.

- Com versão anterior: ``**Comparação completa:** [`<anterior>...<tag>`](https://github.com/<owner>/<repo>/compare/<anterior>...<tag>)``
- Sem versão anterior: ``**Histórico completo:** [commits até `<tag>`](https://github.com/<owner>/<repo>/commits/<tag>)``

### Autores sem @menção

Quando o corpo de uma release traz `@menções` a usuários, o GitHub desenha por conta própria, abaixo do corpo, um
quadro "Contributors" em inglês, com os avatares dos mencionados. Esse quadro não pode ser traduzido nem
desligado por configuração. Por isso as notas nunca escrevem `@<autor>`: os autores entram como links Markdown
para o perfil, tanto nos itens quanto em "Contribuidores". Sem `@menções` no corpo, o quadro do GitHub não aparece,
e a seção "Contribuidores", em português, ocupa o lugar dele.

Riscos que ficam:

- O texto que vem do PR (título ou seção "Notas de release") é copiado sem alteração. Se ele tiver uma `@menção`,
  o quadro "Contributors" volta a aparecer naquela release, com quem foi mencionado. Evite `@` nesses textos.
- O resto da página da release (os botões, "Assets", "Source code", as datas) é a interface do GitHub e segue o
  idioma da conta de quem está vendo. O workflow só controla o título e o corpo.
- O comportamento do quadro é do GitHub e não é documentado em detalhe. Se ele aparecer numa release cujo corpo
  não tem nenhuma `@menção`, registre o caso: pode haver outro gatilho, e a regra desta seção precisa ser revista.

### Limite de tamanho

O GitHub aceita no máximo 125000 caracteres no corpo de uma release. Se o corpo passar disso (contado como
`string.length` do JavaScript), os itens são retirados do fim da lista (o último item do último grupo, depois o
anterior, e assim por diante, apagando os grupos que ficarem vazios) até caber, e entra o aviso, logo depois dos
grupos e antes de "Contribuidores":

```
_E mais <N> pull requests que não couberam aqui. Veja a lista completa na comparação._
```

`<N>` é o número de itens retirados. A linha de resumo, a linha das betas, o título "O que há de novo", a linha
"desde", o aviso, a seção "Contribuidores" e a linha de comparação nunca são cortados. Isso só deve acontecer na
primeira release de um repositório com muito histórico.

## Seção "Notas de release"

O script procura no corpo do PR uma seção com este título, que é o marcador:

```markdown
## Notas de release
```

Regras de leitura (`extractReleaseNotes`):

1. Corpo ausente, `null` ou que não seja string → sem notas.
2. `\r\n` vira `\n` e os comentários HTML (`<!-- ... -->`, inclusive os de várias linhas) são removidos antes de
   tudo. Por isso, as instruções do template dentro de comentário nunca viram notas.
3. O marcador é a primeira linha que, depois de tirar os espaços do fim, é `## Notas de release`, sem diferenciar
   maiúsculas de minúsculas (`## notas de release` vale). `# Notas de release`, `### Notas de release` e
   `## Notas de release:` não valem.
4. A seção vai da linha seguinte ao marcador até a próxima linha que começa com `# ` ou `## ` (título de nível 1 ou
   2), ou até o fim do corpo. Títulos de nível 3 ou mais (`### `) ficam dentro da seção.
5. Os espaços do fim de cada linha são removidos, as linhas em branco são descartadas e o resultado são as linhas
   restantes unidas por `\n`, com a indentação da esquerda preservada.
6. Sem nenhuma linha restante → sem notas, e o item usa o título do PR.

Exemplos:

| Corpo do PR | Notas |
| --- | --- |
| `null` | sem notas |
| `## Objetivo\nX` | sem notas (não há marcador) |
| `## Notas de release\n<!-- opcional -->\n` | sem notas |
| `## Notas de release\n\nAdiciona o cache.\n` | `Adiciona o cache.` |
| `## Notas de release\r\nAdiciona o cache.\r\n## Riscos\r\nNenhum` | `Adiciona o cache.` |
| `## NOTAS DE RELEASE\nA\n\n  - B\n### Detalhe\nC\n# Fim` | `A\n  - B\n### Detalhe\nC` |
| `<!-- ## Notas de release -->\n## Notas de release\nA` | `A` |
| `### Notas de release\nA` | sem notas |

## Template de PR da organização

Arquivo `.github/PULL_REQUEST_TEMPLATE.md` deste repositório. Como o `Elavora/.github` é o repositório de arquivos
padrão da organização, o GitHub usa esse template em todo repositório Elavora que não tiver um template próprio. Um
repositório com template próprio precisa acrescentar a seção "Notas de release" nele.

Conteúdo exato do arquivo:

```markdown
## Objetivo

<!-- O que este PR resolve e por quê. Cite a issue, se houver (Closes #123). -->

## Principais mudanças

<!-- Lista curta do que mudou. -->

## Testes executados

<!-- Comandos que você rodou e o resultado. -->

## Riscos

<!-- O que pode quebrar, como reverter e o que conferir depois do merge. -->

## Notas de release

<!--
Opcional. O que você escrever aqui substitui o título do PR na GitHub Release, em português.
Deixe vazio para usar o título. Pode ter mais de uma linha.
As labels do PR definem a versão e o grupo na release: veja docs/release.md no Elavora/.github.
-->
```

O arquivo termina com uma única quebra de linha depois do último `-->`.

A seção "Notas de release" fica por último: assim ela vai até o fim do corpo, e um título de nível 2 escrito depois
dela por engano encerra a seção.

## Releases já publicadas

As releases criadas antes da `1.2.0` (como `Elavora/.github 1.1.0` e `elavora/devcontainers 0.3.0`) **não são
reescritas**. O padrão vale para as releases criadas pelo workflow `1.2.0` ou mais novo. Num repositório, as notas
novas começam quando o chamador passa a usar a `1.2.0` no `uses` (o Dependabot faz essa atualização).

Pelo mesmo motivo, quando o workflow reaproveita uma release que já existe (reexecução, ver
[release.md](release.md#job-release)), ele não mexe no título nem no corpo dela.

## Referência: `scripts/release-notes.cjs`

Módulo CommonJS sem dependências externas, que roda no Node.js 20 ou mais novo. Todas as funções são puras: não
leem rede, disco nem variáveis de ambiente, e não alteram os objetos recebidos.

### Constantes exportadas

- `RELEASE_NOTES_HEADING`: `'## Notas de release'`.
- `MAX_BODY_LENGTH`: `125000`.
- `GROUPS`: a tabela de grupos, na ordem, como array de `{ title, labels }`, com as labels em minúsculas:

  ```js
  [
    { title: 'Quebra de compatibilidade', labels: ['upgrade'] },
    { title: 'Novidades', labels: ['feature', 'enhancement'] },
    { title: 'Melhorias', labels: ['improvement'] },
    { title: 'Correções', labels: ['bug'] },
    { title: 'Outras mudanças', labels: [] },
  ]
  ```

  O último grupo, com `labels` vazio, recebe tudo o que não caiu nos anteriores.

### `releaseTitle({ repository, tag })`

Devolve `` `${repository} ${tag}` ``.

- `releaseTitle({ repository: 'Elavora/devcontainers', tag: '0.4.0' })` → `'Elavora/devcontainers 0.4.0'`
- Lança `TypeError` quando `repository` não casa com `^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$` (`'Elavora'`,
  `'Elavora/x/y'`, `''`, `undefined`) ou quando `tag` não é uma tag do formato novo, isto é, `parseTag(tag)` de
  `scripts/release-version.cjs` devolve `null` ou uma tag legada (`'v1.2.0'`, `'1.2'`, `undefined`).

### `extractReleaseNotes(body)`

Devolve a string das notas, ou `null` quando não há notas, conforme
[Seção "Notas de release"](#seção-notas-de-release). Nunca lança erro.

### `groupOf(labels)`

Devolve o `title` do grupo do PR, conforme [Grupos de mudanças](#grupos-de-mudanças).

- `groupOf(['bug', 'upgrade'])` → `'Quebra de compatibilidade'`
- `groupOf(['Enhancement'])` → `'Novidades'`
- `groupOf(['release'])` → `'Outras mudanças'`; `groupOf([])` → `'Outras mudanças'`
- `labels` que não seja array de strings lança `TypeError`.

### `assignIntroducedIn({ pulls, betas })`

Marca em qual beta cada PR entrou. O workflow usa só na estável.

- `pulls`: array de objetos com pelo menos `commits: string[]`, os SHAs first-parent pelos quais o PR foi
  encontrado (ver [release.md](release.md#intervalo-de-prs)).
- `betas`: array de `{ tag, commits }`, onde `commits` são os SHAs de
  `git rev-list --first-parent <estável anterior>..<commit da beta>` (ou até o commit da beta, sem estável anterior).
- Devolve um array novo, na mesma ordem de `pulls`, com cópias dos PRs acrescidas de `introducedIn`: a tag da beta
  de **menor versão** cujo `commits` contém pelo menos um dos `commits` do PR, ou `null` quando nenhuma contém. As
  betas são ordenadas pela versão (base e depois `N`, numericamente), não pela ordem recebida. Os outros campos do PR
  são copiados sem mudança.
- Lança `TypeError` quando `pulls` ou `betas` não são arrays, quando um PR não tem `commits` como array de strings,
  quando uma beta não tem `commits` como array de strings, ou quando `tag` não é uma beta do formato novo
  (`'1.2.0'`, `'v1.2.0'`, `'x'`).

Exemplo:

```js
assignIntroducedIn({
  pulls: [
    { number: 40, commits: ['a1'] },
    { number: 41, commits: ['b2'] },
    { number: 42, commits: ['c3', 'c4'] },
  ],
  betas: [
    { tag: '1.2.0-beta.1', commits: ['b2', 'a1'] },
    { tag: '1.1.1-beta.1', commits: ['a1'] },
  ],
})
// → [
//   { number: 40, commits: ['a1'], introducedIn: '1.1.1-beta.1' },
//   { number: 41, commits: ['b2'], introducedIn: '1.2.0-beta.1' },
//   { number: 42, commits: ['c3', 'c4'], introducedIn: null },
// ]
```

### `renderReleaseNotes({ repository, tag, previousTag, previousStable, pulls, betas })`

Devolve o corpo da release (string), conforme [Corpo da release](#corpo-da-release).

| Parâmetro | Tipo | Significado |
| --- | --- | --- |
| `repository` | string | `owner/repo`, mesma validação de `releaseTitle`; usado nos links de comparação e histórico |
| `tag` | string | a nova tag, mesma validação de `releaseTitle`; beta ou estável conforme `parseTag` |
| `previousTag` | string ou `null` | a tag de partida; usada na linha "desde" e na comparação da beta |
| `previousStable` | string ou `null` | a estável anterior; usada no salto, na linha "desde" e na comparação da estável |
| `pulls` | array | os PRs do intervalo das notas (ver abaixo) |
| `betas` | array de strings, opcional (padrão `[]`) | as betas da linha das betas; ignorado na beta |

Cada PR é um objeto com:

| Campo | Tipo | Obrigatório |
| --- | --- | --- |
| `number` | inteiro maior que 0 | sim |
| `title` | string | sim |
| `url` | string | sim |
| `labels` | array de strings | sim |
| `author` | string ou `null` | não (ausente = `null`) |
| `body` | string ou `null` | não (ausente = `null`); as notas são lidas com `extractReleaseNotes` |
| `introducedIn` | string ou `null` | não (ausente ou `''` = `null`); só aparece no item na estável |

Campos a mais (como `commits`) são ignorados.

Lança `TypeError` quando: `repository` ou `tag` são inválidos; `previousTag` ou `previousStable` não são `null`,
`undefined` nem string; `pulls` não é array; um PR não segue a tabela acima; `betas` não é array de strings ou tem
um nome que não é beta do formato novo (ver [Linha das betas](#linha-das-betas)).

`''` equivale a `null` em `previousTag`, `previousStable` e `introducedIn`.

As tags de `previousTag` e `introducedIn` são usadas como texto. `previousStable` é interpretada com `parseTag`
(aceitando a legada `vX.Y.Z`): vazia, não reconhecida ou beta, ela conta como "sem estável anterior" no resumo, na
linha "desde" e na linha de comparação, que vira a de histórico.

Textos fixos que a função escreve (as regras de cada um estão nas seções de [Corpo da release](#corpo-da-release);
`<…>` é substituído, e as crases fazem parte do texto):

| Bloco | Texto exato |
| --- | --- |
| resumo, estável com anterior | `Versão estável **<tag>**, com salto <salto>.` |
| resumo, estável sem anterior | `Versão estável **<tag>**.` |
| resumo, beta com estável anterior | ``Pré-release **<tag>** da `<base>`, com salto <salto> em relação à última estável.`` |
| resumo, beta sem estável anterior | ``Pré-release **<tag>** da `<base>`.`` |
| `<salto>` | `major (quebra de compatibilidade)`, `minor (novidades compatíveis)`, `patch (correções e ajustes)` |
| betas, uma | ``Reúne a beta `<b1>`. Cada item mostra a beta em que entrou; os itens sem beta são novos nesta versão.`` |
| betas, várias | ``Reúne as betas `<b1>`, `<b2>` e `<b3>`. Cada item mostra a beta em que entrou; os itens sem beta são novos nesta versão.`` |
| título das mudanças | `## O que há de novo` |
| desde, estável com anterior | ``Mudanças desde a versão estável `<estável anterior>`.`` |
| desde, estável sem anterior | `Primeira versão estável; mudanças desde o início do projeto.` |
| desde, beta (1ª frase) | ``Mudanças desde `<tag de partida>`.`` ou, sem tag de partida, `Mudanças desde o início do projeto.` |
| desde, beta (2ª frase) | ``Última versão estável: `<estável anterior>`.`` ou, sem estável anterior, `Ainda não há versão estável.` |
| sem PRs | `Nenhum pull request encontrado neste intervalo.` |
| grupos | `### Quebra de compatibilidade`, `### Novidades`, `### Melhorias`, `### Correções`, `### Outras mudanças` |
| item | ``- <texto> ([#<número>](<url>)) por [<autor>](<perfil>) · entrou na `<beta>` `` (as partes opcionais conforme [Item](#item)) |
| aviso de corte | `_E mais <N> pull requests que não couberam aqui. Veja a lista completa na comparação._` |
| contribuidores | `## Contribuidores`, e um `- [<autor>](<perfil>)` por autor |
| comparação (estável com estável anterior reconhecida; beta com tag de partida) | ``**Comparação completa:** [`<anterior>...<tag>`](https://github.com/<owner>/<repo>/compare/<anterior>...<tag>)`` |
| histórico (os demais casos) | ``**Histórico completo:** [commits até `<tag>`](https://github.com/<owner>/<repo>/commits/<tag>)`` |

Na beta, as duas frases da linha "desde" ficam na mesma linha, separadas por um espaço.

Exemplo de chamada que gera a estável da seção [Como fica uma release](#como-fica-uma-release):

```js
renderReleaseNotes({
  repository: 'Elavora/.github',
  tag: '1.2.0',
  previousTag: '1.2.0-beta.1',
  previousStable: '1.1.0',
  betas: ['1.2.0-beta.1', '1.1.1-beta.1'],
  pulls: [
    { number: 43, title: 'build(deps): bump actions/checkout from 7.0.1 to 7.0.2', url: 'https://github.com/Elavora/.github/pull/43', labels: ['dependencies', 'release'], author: 'dependabot[bot]', body: null, introducedIn: null },
    { number: 41, title: 'feat: gera as notas de release em pt-BR', url: 'https://github.com/Elavora/.github/pull/41', labels: ['enhancement'], author: 'ScriptPlayerAgent', body: '## Notas de release\n\nRelease com resumo, grupos por label e link de comparação.', introducedIn: '1.2.0-beta.1' },
    { number: 40, title: 'docs: corrige exemplo do chamador', url: 'https://github.com/Elavora/.github/pull/40', labels: ['documentation'], author: 'ScriptPlayerAgent', body: '', introducedIn: '1.1.1-beta.1' },
    { number: 42, title: 'fix: aceita tag legada como estável anterior', url: 'https://github.com/Elavora/.github/pull/42', labels: ['bug'], author: 'Felipe-Cavalca', introducedIn: null },
  ],
})
```

O resultado é exatamente o corpo mostrado lá, com `\n` no fim. Repare que as betas foram ordenadas e que
`previousTag` não foi usado, porque a versão é estável.

## Testes

Os testes ficam em `tests/release-notes.test.cjs` e rodam com os demais (`node --test "tests/*.test.cjs"`, ver o
[README](../README.md#desenvolvimento)), no workflow `test.yml`, em todo PR. Eles cobrem as funções acima e, lendo os
arquivos como texto (os testes de `renderReleaseNotes` também conferem que o corpo gerado a partir de PRs sem `@`
no título e nas notas não contém nenhum `@`):

- que `.github/PULL_REQUEST_TEMPLATE.md` tem exatamente o conteúdo da seção
  [Template de PR da organização](#template-de-pr-da-organização) (comparando com `\r\n` convertido em `\n`);
- que o passo que cria a release em `.github/workflows/release.yml` usa `releaseTitle` e `renderReleaseNotes` de
  `scripts/release-notes.cjs` e não usa mais `generate_release_notes` nem `package_name` no título;
- que `.github/workflows/auto-release.yml` não passa mais `package_name`.

## Veja também

- [release.md](release.md): onde as notas entram no workflow e como o intervalo das notas é levantado.
- [versionamento.md](versionamento.md): como as labels viram a versão.
- [labels.md](labels.md): o catálogo de labels que define os grupos.
