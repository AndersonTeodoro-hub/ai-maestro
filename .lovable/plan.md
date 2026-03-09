

## Fix: Missing `react-markdown` dependency

**Problem**: `Chat.tsx` imports `react-markdown` but it's not in `package.json`.

**Fix**:
1. Add `react-markdown` (^9.0.0) to `package.json` dependencies
2. No other missing imports detected — all other imports reference installed packages or local files

