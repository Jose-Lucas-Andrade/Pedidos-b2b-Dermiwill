# Pedido B2B Dermiwil BabyGo

Sistema simples de cotacao/pedido B2B para lojistas.

## Como rodar localmente

Na raiz do projeto:

```powershell
python -m http.server 4174 --bind 127.0.0.1
```

Depois acesse:

```text
http://127.0.0.1:4174/app/
```

## Como publicar na Vercel

Opcao recomendada:

1. Subir este repositorio no GitHub.
2. Importar o repositorio na Vercel.
3. Usar `app` como Root Directory do projeto na Vercel.
4. Apontar o dominio ou subdominio para o projeto.

Se a Vercel usar a raiz do repositorio, o arquivo `index.html` da raiz redireciona para `/app/`.

## Atualizacao de tabela e imagens

Os arquivos originais pesados ficam fora do Git por seguranca e tamanho. Para regenerar o catalogo localmente:

```powershell
python scripts/build_products.py
```

O script gera:

- `app/data/products.json`
- `app/data/import-report.json`
- `app/assets/products/**/*.webp`
