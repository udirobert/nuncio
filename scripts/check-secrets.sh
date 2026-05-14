#!/bin/bash
# Scan staged files for potential secrets/API keys
# Skips this script itself and .env.example (which has empty values)

STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -v 'scripts/check-secrets.sh' | grep -v '.env.example')

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

FOUND=0

# Check for env vars with actual values assigned (not just the key name)
while IFS= read -r file; do
  # Skip binary files
  if file "$file" | grep -q "binary"; then
    continue
  fi

  # Look for API key assignments with real values (not empty, not placeholder)
  if grep -qE '(API_KEY|SECRET|TOKEN|PASSWORD)=['\''"]?[a-zA-Z0-9_-]{8,}' "$file" 2>/dev/null; then
    echo "🚨 Potential secret (env var with value) in: $file"
    FOUND=1
  fi

  # Look for common key patterns
  if grep -qE 'sk-ant-[a-zA-Z0-9_-]{20,}' "$file" 2>/dev/null; then
    echo "🚨 Potential Anthropic key in: $file"
    FOUND=1
  fi

  if grep -qE 'sk-[a-zA-Z0-9]{20,}' "$file" 2>/dev/null; then
    echo "🚨 Potential OpenAI/generic key in: $file"
    FOUND=1
  fi

  if grep -qE 'AKIA[0-9A-Z]{16}' "$file" 2>/dev/null; then
    echo "🚨 Potential AWS key in: $file"
    FOUND=1
  fi

  if grep -qE 'ghp_[a-zA-Z0-9]{36}' "$file" 2>/dev/null; then
    echo "🚨 Potential GitHub token in: $file"
    FOUND=1
  fi

  if grep -qE 'xox[baprs]-[a-zA-Z0-9-]+' "$file" 2>/dev/null; then
    echo "🚨 Potential Slack token in: $file"
    FOUND=1
  fi

done <<< "$STAGED_FILES"

if [ $FOUND -eq 1 ]; then
  echo ""
  echo "❌ Commit blocked — secrets detected in staged files."
  echo "   Remove the secrets or add the file to .gitignore."
  echo "   To bypass (not recommended): git commit --no-verify"
  exit 1
fi

exit 0
