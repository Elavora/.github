# Elavora

A Elavora desenvolve componentes PHP modulares para criar APIs HTTP com
dependencias explicitas e instalacao por Composer.

## Por onde comecar

- [api-framework](https://github.com/Elavora/api-framework): nucleo HTTP,
  container, roteamento, middleware e contratos compartilhados.
- [api-skeleton](https://github.com/Elavora/api-skeleton): estrutura inicial
  para uma nova API.
- [api-datatypes](https://github.com/Elavora/api-datatypes): agregador dos
  DataTypes reutilizaveis. Cada DataType tambem pode ser instalado
  individualmente.

Os adaptadores de cache, banco de dados, Redis, filas, logs e storage ficam em
repositorios `api-*` separados. Cada projeto instala apenas os pacotes de que
precisa.

## Instalacao

Os pacotes exigem PHP e Composer. Consulte o `composer.json` do pacote escolhido
para conhecer as versoes e extensoes suportadas.

```bash
composer require elavora/api-framework
```

Para iniciar um projeto pela estrutura base:

```bash
composer create-project elavora/api-skeleton api
```

## Projeto publico

Issues e pull requests devem ser abertos no repositorio afetado. As orientacoes
de contribuicao e a politica de seguranca ficam nos arquivos `CONTRIBUTING.md`
e `SECURITY.md` de cada pacote.

Os pacotes ainda estao em evolucao. Consulte releases e changelogs antes de
adota-los.
