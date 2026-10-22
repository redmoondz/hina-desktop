#!/usr/bin/env bash
# Install the existing Connector as a standalone user service. Never print tokens.
set -euo pipefail
mode=${1:-install}
if [[ "$mode" != install && "$mode" != --print-unit ]]; then
  echo "Usage: hina-connector-service.sh [--print-unit]" >&2
  exit 2
fi
project_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
connector_root=$(cd "$project_root/../connector" && pwd)
node_bin=$(command -v node)
openclaw_bin=$(command -v openclaw)
config_root="$HOME/.config/hina-desktop"
env_file="$config_root/connector.env"
unit_root="$HOME/.config/systemd/user"
unit_file="$unit_root/hina-connector.service"
# systemd expands percent specifiers even inside quoted directives.
unit_quote() {
  local value=$1
  value=${value//%/%%}
  value=${value//\\/\\\\}
  value=${value//\"/\\\"}
  printf '"%s"' "$value"
}
print_unit() {
  cat <<UNIT
[Unit]
Description=Hina Desktop local agent connector
After=network.target

[Service]
Type=simple
WorkingDirectory=${connector_root//%/%%}
EnvironmentFile=${env_file//%/%%}
Environment=$(unit_quote "OPENCLAW_BIN=$openclaw_bin")
UnsetEnvironment=OPENCLAW_SHELL OPENCLAW_CLI
ExecStart=$(unit_quote "$node_bin") $(unit_quote "$connector_root/dist/server.js")
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
UNIT
}
if [[ "$mode" == --print-unit ]]; then
  print_unit
  exit 0
fi
if [[ ! -f "$connector_root/dist/server.js" ]]; then
  echo "Build the existing Connector before installing its service." >&2
  exit 1
fi
umask 077
mkdir -p "$config_root" "$unit_root"
# Exclusive creation prevents token rotation on reruns or overlapping installs.
"$node_bin" - "$env_file" <<'JS'
const fs = require("node:fs");
const { randomBytes } = require("node:crypto");
const file = process.argv[2];
try {
  fs.writeFileSync(file, `CONNECTOR_API_TOKEN=${randomBytes(32).toString("hex")}\nCONNECTOR_PORT=3210\n`, { flag: "wx", mode: 0o600 });
} catch (error) {
  if (error.code !== "EEXIST") throw new Error("Could not create the private Connector environment file");
}
const stat = fs.lstatSync(file);
if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o777) !== 0o600) throw new Error("Connector environment file must be a regular private file with mode 600");
JS
staging=$(mktemp "$unit_root/.hina-connector.XXXXXX")
trap 'rm -f "$staging"' EXIT
print_unit > "$staging"
if [[ ! -f "$unit_file" ]] || ! cmp -s "$staging" "$unit_file"; then
  mv "$staging" "$unit_file"
fi
systemctl --user daemon-reload
systemctl --user enable --now hina-connector.service
# A health request never triggers an agent turn or paid model inference.
for attempt in {1..20}; do
  if curl --silent --fail --max-time 2 http://127.0.0.1:3210/health |
    "$node_bin" -e 'let input=""; process.stdin.on("data", chunk => input += chunk); process.stdin.on("end", () => { try { if (JSON.parse(input).agent !== "hina") process.exit(1); } catch { process.exit(1); } });'; then
    echo "Hina Connector user service is running and healthy."
    exit 0
  fi
  sleep 1
done
echo "Hina Connector health check failed; inspect the user service journal." >&2
exit 1
