#!/bin/bash
# Publica o site no GitHub Pages.
#
# A branch main guarda o projeto inteiro (inclusive as fontes originais em 8K);
# a branch gh-pages leva só o que o site serve — index.html e assets —, para a
# publicação ficar leve. Este script reconstrói o site, copia esses arquivos
# para uma worktree temporária da gh-pages e envia.
set -euo pipefail

cd "$(dirname "$0")/.."
raiz="$(pwd)"
temp="$(mktemp -d)"

echo "→ build"
npm run build

echo "→ preparando a branch gh-pages"
git fetch -q origin gh-pages
git worktree add -q "$temp" gh-pages
rm -rf "$temp"/assets "$temp"/index.html
cp -R "$raiz"/assets "$raiz"/index.html "$temp"/
touch "$temp"/.nojekyll

cd "$temp"
git add -A
if git diff --cached --quiet; then
  echo "→ nada mudou"
else
  git commit -q -m "Publicação do site ($(date '+%d/%m/%Y %H:%M'))"
  git push -q origin gh-pages
  echo "→ publicado em https://joaopauloalvesofc-lab.github.io/saggiorato/"
fi

cd "$raiz"
git worktree remove --force "$temp"
