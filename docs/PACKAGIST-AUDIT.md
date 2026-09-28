# Auditoria de publicacao — 2026-09-28

Foram consultados os 32 repositorios publicos da organizacao: 31 pacotes Composer e este repositorio de automacao.

Escopo: manifestos Composer, workflows de release/publicacao, estado dos workflows e metadados publicos do Packagist. Nenhum segredo ou webhook privado foi lido.

- 28 pacotes usam publicador legado com vars.PACKAGIST_WEBHOOK_URL e continue-on-error.
- 3 pacotes usam release central com notificacao opcional.
- Nenhum manifesto atual declara version explicitamente.
- Todos os 31 pacotes possuem metadados publicados no Packagist.
- Os workflows de release/publicacao consultados estao ativos.
- Sync Labels do api-framework esta disabled_inactivity; nao faz parte da publicacao e nao foi alterado.

| Pacote | Versao mais recente retornada pelo Packagist | Fluxo de release |
| --- | --- | --- |
| [api-cache-apcu](https://github.com/Elavora/api-cache-apcu) | v0.3.1 | Legado |
| [api-cache-redis](https://github.com/Elavora/api-cache-redis) | v0.1.1 | Legado |
| [api-database-mysql](https://github.com/Elavora/api-database-mysql) | v0.2.0 | Legado |
| [api-database-pdo](https://github.com/Elavora/api-database-pdo) | v0.2.0 | Legado |
| [api-database-postgresql](https://github.com/Elavora/api-database-postgresql) | v0.2.0 | Legado |
| [api-database-sqlite](https://github.com/Elavora/api-database-sqlite) | v0.2.0 | Legado |
| [api-datatype-base64](https://github.com/Elavora/api-datatype-base64) | v0.2.0 | Legado |
| [api-datatype-cnpj](https://github.com/Elavora/api-datatype-cnpj) | v0.2.0 | Legado |
| [api-datatype-core](https://github.com/Elavora/api-datatype-core) | v1.0.0 | Central |
| [api-datatype-cpf](https://github.com/Elavora/api-datatype-cpf) | v0.2.0 | Legado |
| [api-datatype-date-time](https://github.com/Elavora/api-datatype-date-time) | v0.2.0 | Legado |
| [api-datatype-email](https://github.com/Elavora/api-datatype-email) | v0.2.0 | Legado |
| [api-datatype-file-name](https://github.com/Elavora/api-datatype-file-name) | v0.2.0 | Legado |
| [api-datatype-file-path](https://github.com/Elavora/api-datatype-file-path) | v0.2.0 | Legado |
| [api-datatype-folder-name](https://github.com/Elavora/api-datatype-folder-name) | v0.2.0 | Legado |
| [api-datatype-folder-path](https://github.com/Elavora/api-datatype-folder-path) | v0.2.0 | Legado |
| [api-datatype-json](https://github.com/Elavora/api-datatype-json) | v0.2.0 | Legado |
| [api-datatype-storage-key](https://github.com/Elavora/api-datatype-storage-key) | v0.2.0 | Legado |
| [api-datatype-url](https://github.com/Elavora/api-datatype-url) | v0.2.0 | Legado |
| [api-datatype-uuid](https://github.com/Elavora/api-datatype-uuid) | v0.2.0 | Legado |
| [api-datatypes](https://github.com/Elavora/api-datatypes) | v0.2.0 | Legado |
| [api-framework](https://github.com/Elavora/api-framework) | v2.0.0-rc.1 | Central |
| [api-log-file](https://github.com/Elavora/api-log-file) | v0.2.0 | Legado |
| [api-log-mongodb](https://github.com/Elavora/api-log-mongodb) | v0.2.0 | Legado |
| [api-log-stdout](https://github.com/Elavora/api-log-stdout) | v0.2.0 | Legado |
| [api-queue-redis](https://github.com/Elavora/api-queue-redis) | v0.2.0 | Legado |
| [api-queue-worker](https://github.com/Elavora/api-queue-worker) | v0.2.0 | Legado |
| [api-redis](https://github.com/Elavora/api-redis) | v0.2.0 | Legado |
| [api-skeleton](https://github.com/Elavora/api-skeleton) | v1.1.0-rc.1 | Central |
| [api-storage-local](https://github.com/Elavora/api-storage-local) | v0.2.0 | Legado |
| [api-storage-s3](https://github.com/Elavora/api-storage-s3) | v0.2.0 | Legado |

Esta e uma fotografia dos metadados consultados, nao uma matriz de compatibilidade. O sucesso da API de atualizacao depende de um secret valido com acesso aos pacotes. A auditoria nao certifica as credenciais, nem a indexacao futura.

Aplicar o PR central antes dos PRs dos pacotes; os links dos PRs de rollout serao registrados na descricao do PR central.
