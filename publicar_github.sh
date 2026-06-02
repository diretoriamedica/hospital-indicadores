#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  PUBLICAR NO GITHUB — Rede Hospital Casa
#  Execute este script no Terminal: bash publicar_github.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

REPO_NAME="hospital-indicadores"
PASTA="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   Publicar Sistema de Indicadores no GitHub Pages   ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── 1. Verificar se GitHub CLI está instalado ─────────────────────────────────
if command -v gh &> /dev/null; then
  echo "✅ GitHub CLI encontrado."

  # Verificar autenticação
  if ! gh auth status &> /dev/null; then
    echo ""
    echo "🔐 Faça login no GitHub:"
    gh auth login
  fi

  USUARIO=$(gh api user --jq '.login')
  echo "✅ Logado como: $USUARIO"
  echo ""

  # ── 2. Inicializar git ────────────────────────────────────────────────────
  cd "$PASTA"
  if [ ! -d ".git" ]; then
    git init
    git branch -M main
    echo "✅ Repositório git inicializado."
  fi

  # ── 3. Criar repositório no GitHub ───────────────────────────────────────
  if ! gh repo view "$USUARIO/$REPO_NAME" &> /dev/null; then
    gh repo create "$REPO_NAME" --public --source=. --remote=origin
    echo "✅ Repositório criado: github.com/$USUARIO/$REPO_NAME"
  else
    echo "ℹ️  Repositório já existe: github.com/$USUARIO/$REPO_NAME"
    git remote remove origin 2>/dev/null || true
    git remote add origin "https://github.com/$USUARIO/$REPO_NAME.git"
  fi

  # ── 4. Commit e push ──────────────────────────────────────────────────────
  git add .
  git commit -m "feat: sistema de indicadores hospitalares - primeira publicacao" 2>/dev/null || \
  git commit --allow-empty -m "update: publicacao atualizada"
  git push -u origin main --force

  # ── 5. Ativar GitHub Pages ────────────────────────────────────────────────
  gh api \
    --method POST \
    -H "Accept: application/vnd.github+json" \
    "/repos/$USUARIO/$REPO_NAME/pages" \
    -f source='{"branch":"main","path":"/"}' 2>/dev/null || \
  gh api \
    --method PUT \
    -H "Accept: application/vnd.github+json" \
    "/repos/$USUARIO/$REPO_NAME/pages" \
    -f source='{"branch":"main","path":"/"}' 2>/dev/null || \
  echo "ℹ️  GitHub Pages: acesse Settings → Pages no repositório para ativar manualmente."

  echo ""
  echo "════════════════════════════════════════════════════════"
  echo "  ✅ PUBLICADO COM SUCESSO!"
  echo ""
  echo "  📁 Repositório : https://github.com/$USUARIO/$REPO_NAME"
  echo "  🌐 Site online : https://$USUARIO.github.io/$REPO_NAME/"
  echo "  🧮 Sistema     : https://$USUARIO.github.io/$REPO_NAME/sistema.html"
  echo ""
  echo "  ⏳ O GitHub Pages leva ~2 minutos para ativar."
  echo "════════════════════════════════════════════════════════"

else
  # ── SEM GitHub CLI: instrução manual ──────────────────────────────────────
  echo "⚠️  GitHub CLI (gh) não encontrado."
  echo ""
  echo "OPÇÃO A — Instalar GitHub CLI (recomendado):"
  echo "  1. Acesse: https://cli.github.com"
  echo "  2. Clique em 'Download for macOS'"
  echo "  3. Instale e execute este script novamente."
  echo ""
  echo "OPÇÃO B — Publicar manualmente pelo site:"
  echo "  1. Acesse https://github.com e faça login"
  echo "  2. Clique em '+' → 'New repository'"
  echo "  3. Nome: $REPO_NAME | Visibilidade: Public | Criar"
  echo "  4. Clique em 'uploading an existing file'"
  echo "  5. Arraste TODOS os arquivos desta pasta para a janela"
  echo "     (exceto os .xlsx — são grandes demais)"
  echo "  6. Clique em 'Commit changes'"
  echo "  7. Vá em Settings → Pages → Branch: main → Save"
  echo "  8. Aguarde ~2 min. URL: https://SEU-USUARIO.github.io/$REPO_NAME/"
  echo ""
fi
