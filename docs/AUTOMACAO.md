# Politica de automacao

## Compatibilidade

Os pacotes novos declaram PHP 8.3 como versao minima e validam PHP 8.3, 8.4 e
8.5. O PHP minimo executa com dependencias minimas e atuais; as demais versoes
executam com a resolucao atual.

O job `Quality Gate` e o unico contexto estavel que deve ser exigido pela
protecao da branch. Ele falha quando validacao do Composer, auditoria, testes,
lint, analise estatica, cobertura ou integracao configurada falhar.

## Workflows reutilizaveis

- `quality.yml`: matriz Composer, auditoria, analise estatica, cobertura e
  servicos opcionais.
- `codeql.yml`: analise dos workflows GitHub Actions.
- `dependency-review.yml`: impede novas dependencias com vulnerabilidade alta.
- `release.yml`: cria tag, GitHub Release e notifica o Packagist.
- `sync-labels.yml`: aplica o manifesto central sem remover labels durante a
  migracao.

Os pacotes devem chamar esses workflows por SHA completo. Actions de terceiros
tambem ficam fixadas por SHA e sao atualizadas pelo Dependabot.

## PRs coordenados

Durante uma alteracao que ainda nao possui tags nas dependencias internas, o
caller pode informar `development_dependencies` como um objeto JSON de
pacote para branch. O gate configura apenas repositorios `elavora/*`, valida o
formato da branch e usa alias `1.0.x-dev` sem alterar o manifesto versionado.

Esse input deve ser condicionado a branch do trabalho. Depois que as tags
estaveis estiverem disponiveis, o valor precisa ser `{}` para que o Composer
valide somente releases publicadas.

## Servicos

O workflow de qualidade aceita um servico por pacote:

- `redis`;
- `mysql`;
- `postgresql`;
- `mongodb`;
- `none`.

SQLite e APCu usam extensoes no runner e nao precisam de container de servico.

## Labels

`.github/labels.yml` e a fonte central. Durante a migracao, `prune` permanece
desativado. A remocao automatica so pode ser habilitada depois de comparar as
labels usadas por issues, pull requests, templates e automacoes em todos os
repositorios.

## Arquivos gerados

Bibliotecas ignoram `vendor/`, cache do PHPUnit, relatorios de cobertura e
`composer.lock`. O `api-skeleton` e uma aplicacao e deve versionar
`composer.lock` para produzir builds reproduziveis.
