#!/usr/bin/env bash
set -Eeuo pipefail
# Track only this run's additions. Never clear an account's whole whitelist.
STATE="${RUNNER_TEMP:?}/lumen-firewall-created"
api() {
 curl --fail --silent --show-error --connect-timeout 10 --max-time 60 \
  -H "Authorization: cpanel $CPANEL_USERNAME:$CPANEL_API_TOKEN" \
  "https://$CPANEL_SERVER:2083/execute/SshWhitelist/$1"
}
case "${1:-}" in
 add)
  ip="$(curl --ipv4 -fsS --connect-timeout 5 --max-time 20 https://api.ipify.org)"
  python3 -c 'import ipaddress,sys; assert ipaddress.ip_address(sys.argv[1]).version == 4' "$ip"
  response="$(api list)"
  jq -e '.status == 1' <<< "$response" >/dev/null
  for direction in in out; do
   if ! jq -e --arg ip "$ip" --arg dir "$direction" \
     '.data.list[]? | select(.address == $ip and .direction == $dir and (.port | tonumber) == 22)' <<< "$response" >/dev/null; then
    # Save intent before the API call so cleanup also handles a lost response.
    printf '%s %s\n' "$ip" "$direction" >> "$STATE"
   fi
  done
  if [[ -f "$STATE" ]]; then api "add?address=$ip&port=22" | jq -e '.status == 1' >/dev/null; fi
  ;;
 remove)
  result=0
  if [[ -f "$STATE" ]]; then
   while read -r ip direction; do
    api "remove?address=$ip&port=22&direction=$direction" | jq -e '.status == 1' >/dev/null || result=1
   done < "$STATE"
  fi
  exit "$result"
  ;;
 *) echo 'Usage: o2switch-runner-firewall.sh add|remove' >&2; exit 2;;
esac
