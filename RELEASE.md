# Release procedure

### 1. Develop

- Edit `index.ts` (new tools, fixes)
- Update `openclaw.plugin.json`:
  - `description` if needed
  - `contracts.tools` — add/remove tool names to match `index.ts`

### 2. Review all files before releasing

Go through each file in order — everything must be consistent:

| File | What to check |
|---|---|
| `index.ts` | Tool `description` fields in each `registerTool` call |
| `openclaw.plugin.json` | `description`, `contracts.tools` complete and up to date |
| `package.json` | `description`, `version` |
| `README.md` | Tool count in the intro line, tools table |

### 3. Bump version

```bash
npm version <patch|minor|major> --no-git-tag-version
```

### 4. Test locally

```bash
# Build tarball
npm pack

# Remove currently installed version
rm -rf ~/.openclaw/extensions/openclaw-trello

# Install
openclaw plugins install ./openclaw-trello-<version>.tgz

# Restart gateway
openclaw gateway restart

# Manually test new/changed tools from an active session

# Clean up test tarball
rm openclaw-trello-<version>.tgz
```

### 5. Commit, tag and push

```bash
git add -A
git commit -m "feat: <description>"
git tag v<version>
git push
git push --tags
```

### 6. Publish to npm

```bash
npm publish
```

### 7. Publish to ClawHub

```bash
# Build a clean tarball (no node_modules) and extract it
npm pack --pack-destination /tmp/
mkdir -p /tmp/trello-pkg
tar xzf /tmp/openclaw-trello-<version>.tgz -C /tmp/trello-pkg --strip-components=1

# Publish
clawhub package publish /tmp/trello-pkg \
  --family code-plugin \
  --name openclaw-trello \
  --display-name "Trello" \
  --version <version> \
  --tags "latest,trello" \
  --changelog "<what changed>" \
  --source-repo marcchapeau/openclaw-trello \
  --source-commit $(git rev-parse v<version>) \
  --source-ref v<version>

# Clean up
rm -rf /tmp/trello-pkg /tmp/openclaw-trello-<version>.tgz
```
