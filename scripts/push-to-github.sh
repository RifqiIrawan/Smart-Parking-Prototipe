#!/bin/bash
# Smart Parking - Push to GitHub
# Jalankan script ini dengan token GitHub Anda

echo "================================================"
echo " Smart Parking - Push to GitHub"
echo "================================================"

if [ -z "$GITHUB_TOKEN" ]; then
    echo ""
    echo "❌ GITHUB_TOKEN tidak ditemukan!"
    echo ""
    echo "Cara mendapatkan token:"
    echo "1. Buka https://github.com/settings/tokens"
    echo "2. Generate new token (classic)"
    echo "3. Centang scope: repo"
    echo "4. Jalankan:"
    echo ""
    echo "   export GITHUB_TOKEN=ghp_yourtoken"
    echo "   bash scripts/push-to-github.sh"
    echo ""
    exit 1
fi

REPO_URL="https://RifqiIrawan:${GITHUB_TOKEN}@github.com/RifqiIrawan/Smart-Parking-Prototipe.git"

git remote set-url origin "$REPO_URL"
git push origin main

echo ""
echo "✅ Push berhasil!"
echo "   Lihat di: https://github.com/RifqiIrawan/Smart-Parking-Prototipe"
