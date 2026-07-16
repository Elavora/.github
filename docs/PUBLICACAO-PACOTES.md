# Publicacao de pacotes

## Composer

Os pacotes PHP publicos `elavora/api-*` sao publicados no Packagist.

Uso recomendado:

```bash
composer require elavora/api-framework
```

O GitHub Packages nao oferece registry Composer. Por isso, os pacotes Composer nao aparecem na area **Packages** do GitHub como pacotes instalaveis por Composer.

## Fluxo de release

O fluxo esperado para pacotes Composer e:

1. PR aprovado e mergeado na `main`.
2. Workflow gera tag e release no GitHub.
3. Workflow de publicacao notifica o Packagist.
4. Packagist atualiza a versao disponivel para `composer require`.

Essa publicacao acontece junto do fluxo de release do GitHub, sem substituir o Packagist.

## GitHub Packages

GitHub Packages pode ser usado para formatos suportados pelo GitHub, como:

- Container Registry / Docker;
- npm;
- RubyGems;
- Maven;
- Gradle;
- NuGet.

Para projetos Elavora, use GitHub Packages quando houver um artefato desses formatos. Exemplos possiveis:

- imagem Docker de runtime;
- imagem Docker de exemplo;
- pacote npm de frontend ou tooling.

Nao crie GitHub Package para bibliotecas PHP Composer enquanto o GitHub nao oferecer registry Composer.

## Packagist e GitHub Packages juntos

Quando um projeto tiver os dois tipos de artefato, eles devem ser publicados no mesmo fluxo de release:

1. GitHub release/tag;
2. Packagist para Composer;
3. GitHub Packages para imagens ou outros artefatos suportados.

Cada publicacao deve ser explicita no workflow do repositorio responsavel pelo artefato.
