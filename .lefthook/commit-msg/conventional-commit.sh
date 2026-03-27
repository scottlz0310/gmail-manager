#!/bin/sh
head -1 "$1" | grep -qE '^(feat|fix|docs|style|refactor|test|chore|ci|build|perf)(\(.+\))?(!)?: .+' || {
  echo "❌ Conventional Commits 形式で書いてください。例: feat: add search filter"
  exit 1
}
