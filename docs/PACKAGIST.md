# Atualizacao automatica no Packagist

Cada pacote continua criando suas tags/releases no fluxo existente. O novo workflow
`Atualizar Packagist` solicita a reindexacao do repositorio ja cadastrado no Packagist.
Ele nao publica codigo novo, nao altera constraints, nao grava `version` no
composer.json e nao atualiza o composer.lock de consumidores.

## Gatilhos

- `repository_dispatch: tag-created`: recebe o sinal emitido logo apos criar a tag
  nos fluxos legados, mesmo com GITHUB_TOKEN.
- `workflow_run` ao terminar `Release` ou `Tag on merge`: confere repositorio,
  caminho do workflow e sucesso da etapa de tag na tentativa correspondente via
  API do GitHub (permissao actions: read). Aceita forks e falhas posteriores a essa
  etapa; ignora jobs pulados em PRs fechados sem merge. Os nomes das etapas sao
  contratos com os workflows atuais; atualizar o filtro se esses nomes mudarem.
- `release: published`: releases publicadas manualmente.
- `push` de tags `v*`: tags criadas diretamente por mantenedores.
- `workflow_dispatch`: reexecucao manual para recuperar notificacoes perdidas ou
  falhas de rede/credenciais. Executar depois de existir a tag desejada.

O workflow_run precisa estar na branch padrao do pacote para receber eventos.
Ele nao executa codigo nem baixa artefatos da execucao anterior; baixa somente a
implementacao central fixada por SHA. A notificacao fica restrita ao repositorio
consumidor. Eventos duplicados apenas solicitam outra reindexacao do mesmo pacote.

## Configuracao necessaria

1. Na organizacao Elavora, abra Settings > Secrets and variables > Actions.
2. Crie o secret `PACKAGIST_WEBHOOK_URL`, com acesso aos 31 repositorios de pacotes:
   `https://packagist.org/api/update-package?username=USUARIO&apiToken=TOKEN`
3. Use uma conta mantenedora dos pacotes e, preferencialmente, um token safe do
   Packagist. Nao use uma Actions variable nem comite a URL real.
4. Se houver secrets de repositorio com o mesmo nome, atualize-os tambem: eles
   prevalecem sobre o secret da organizacao.
5. Integre primeiro o PR central e depois os PRs dos pacotes. Os chamadores fixam
   o SHA central revisado. Eles precisam manter `uses` e `automation_ref` iguais.
6. Em cada pacote, rode Actions > Atualizar Packagist > Run workflow (main) para
   validar as credenciais e solicitar a indexacao de tags ja existentes.

Nenhuma credencial foi consultada ou alterada pela auditoria. A configuracao do
secret e a chamada real autenticada sao pre-requisitos operacionais; os testes
usam respostas simuladas e nao notificam o Packagist.

A implementacao converte a URL secreta em autenticacao Bearer para o endpoint
oficial, evita redirects e nao imprime URL, token nem resposta de erro. Falha
quando o segredo falta ou quando o Packagist nao confirma `status: success`.
Timeout: 30 segundos por requisicao; ate quatro tentativas para falhas de rede,
HTTP 429 e 5xx, inclusive falhas ao consumir a resposta, com espera exponencial.
JSON malformado e erros 4xx de autenticacao falham imediatamente.
O resumo confirma a solicitacao aceita; a indexacao no Packagist e assincrona.

## Recuperacao

Corrija o secret/permissao ou aguarde o servico se recuperar e repita o workflow.
Nao recrie nem mova tags para repetir uma notificacao. Confira a versao no pacote
ou em `https://repo.packagist.org/p2/elavora/NOME-DO-PACOTE.json`.
A branch main so aparece como versao dev; uma nova versao numerada exige uma tag.

Os workflows antigos `publish-composer.yml` e `update-composer-on-release.yml`
sao substituidos. O primeiro ignorava falhas; o segundo gravava version em main
apos criar a release. Os tres pacotes com release central tambem passam a ter
uma notificacao independente e reexecutavel. A notificacao opcional embutida no
workflow central antigo pode gerar uma chamada adicional, que e idempotente.

A correcao integral do versionamento/tagging legado continua na issue #1. Esta
entrega atende a notificacao do Packagist e remove a escrita posterior de version.

## Validacao e manutencao

- Testes Node usam apenas modulos nativos e rodam em Docker; nao ha npm install.
- actionlint roda em Docker nos workflows centrais e nos 31 chamadores gerados.
- Nao foi executada a suite PHP completa dos 31 pacotes, pois a mudanca e de
  publicacao. O inventario verifica composer.json, workflows e metadados publicos.
- `scripts/install-packagist-sync.cjs DIRETORIO SHA` aplica o template a um clone
  limpo, preserva os demais workflows e remove apenas os dois publicadores legados.

Referencias: [Packagist API](https://packagist.org/apidoc#update-a-package),
[workflow_run](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run)
e [version no Composer](https://getcomposer.org/doc/04-schema.md#version).
