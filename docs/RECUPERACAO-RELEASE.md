# Recuperacao de release

O workflow de release serializa execucoes por repositorio e e idempotente por
commit. Uma nova execucao reutiliza a tag que ja aponta para o merge.

## Tag existe e a release falhou

Execute novamente o workflow para o mesmo merge. A tag existente sera
reutilizada e a GitHub Release ausente sera criada.

## Release existe e o Packagist falhou

Corrija o secret `PACKAGIST_WEBHOOK_URL` e execute novamente o workflow. A
release existente nao sera duplicada e a notificacao sera repetida com timeout
e tentativas limitadas.

## Publicacao parcial

1. Confirme que a tag aponta para o commit de merge esperado.
2. Confirme que a GitHub Release usa a mesma tag.
3. Consulte o pacote no Packagist.
4. Reexecute o workflow se apenas a notificacao estiver pendente.

Tags publicadas nao devem ser movidas ou apagadas automaticamente. Uma tag
incorreta exige analise manual antes de qualquer acao destrutiva.
