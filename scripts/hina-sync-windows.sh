#!/usr/bin/env bash
# Run with explicit filesystem approval: the destination is outside the workspace.
set -euo pipefail
source_root=$(git rev-parse --show-toplevel)
target=${1:-/mnt/c/Users/siriu/projects/hina-desktop/desktop}
if [[ "$source_root" == "$target" || ! -d "$target/.git" ]]; then
  echo "Expected a separate existing Windows checkout."
  exit 1
fi
manifest=$(mktemp /tmp/hina-sync.XXXXXX)
trap 'rm -f "$manifest"' EXIT
git -C "$source_root" ls-files -z --cached --others --exclude-standard > "$manifest"
node - "$source_root" "$target" "$manifest" check <<'JS'
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const [root, target, manifest] = process.argv.slice(2);
const statePath = path.join('/tmp', 'hina-sync-state-' + crypto.createHash('sha256').update(target).digest('hex').slice(0, 16) + '.json');
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : {};
const hash = file => fs.existsSync(file) ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null;
const changes = [...execFileSync('git', ['-c', 'core.autocrlf=false', '-C', target, 'diff', '--name-only', '-z']).toString().split('\0'), ...execFileSync('git', ['-c', 'core.autocrlf=false', '-C', target, 'diff', '--cached', '--name-only', '-z']).toString().split('\0'), ...execFileSync('git', ['-c', 'core.autocrlf=false', '-C', target, 'ls-files', '--others', '--exclude-standard', '-z']).toString().split('\0')].filter(Boolean);
for (const file of changes) {
  if (!Object.hasOwn(state, file) || state[file] !== hash(path.join(target, file))) throw new Error('Windows checkout has changes outside the previous synchronized snapshot: ' + file);
}
const files = fs.readFileSync(manifest, 'utf8').split('\0').filter(Boolean).filter(file => {
  if (/(^|\/)(?:node_modules|dist|secure-keys)(?:\/|$)/i.test(file) || /(^|\/)(\.env(?:\..*)?|[^/]*creds[^/]*)$/i.test(file)) return false;
  try { return fs.lstatSync(path.join(root, file)).isFile(); } catch { return false; }
});
const changed = files.filter(file => state[file] !== hash(path.join(root, file)));
fs.writeFileSync(manifest, changed.length ? changed.join('\0') + '\0' : '');
console.log('Changed source files: ' + changed.length);
JS
# Never delete files, credentials, dependencies, or outputs in the destination.
rsync --archive --ignore-times --from0 --files-from="$manifest" "$source_root/" "$target/"
node - "$source_root" "$target" "$manifest" <<'JS'
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const [root, target, manifest] = process.argv.slice(2);
const statePath = path.join('/tmp', 'hina-sync-state-' + crypto.createHash('sha256').update(target).digest('hex').slice(0, 16) + '.json');
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : {};
for (const file of fs.readFileSync(manifest, 'utf8').split('\0').filter(Boolean)) state[file] = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
fs.writeFileSync(statePath, JSON.stringify(state));
JS
echo "Source synchronized; Windows dependencies and build outputs preserved."
