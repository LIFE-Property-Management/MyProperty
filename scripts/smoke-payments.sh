#!/usr/bin/env bash
# Payments state-machine smoke test.
# Walks a single payment through every state transition end-to-end.
# Usage: ./scripts/smoke-payments.sh <leaseId>
#
# Prereqs:
#   - Stack up: docker compose up -d  +  dotnet run --project backend/MyProperty.Api
#   - Seeded users: landlord@dev.local / landlord123, tenant@dev.local / tenant123
#   - A lease that connects landlord@dev.local (landlord) to tenant@dev.local (tenant)
#     — pass its UUID as $1.
#
# Note on enum values: PaymentMethod is sent as int (System.Text.Json default).
#   0 = ReceiptUpload, 1 = ManualRequest. Post-M3 follow-up: add
#   JsonStringEnumConverter to accept named values like "ManualRequest".

set -euo pipefail

API="http://localhost:5042"
KEYCLOAK="http://localhost:8080"
REALM="MyProperty"
CLIENT="myproperty-frontend"

# PaymentMethod enum values (must match Domain/Enums/PaymentMethod.cs).
METHOD_RECEIPT_UPLOAD=0
METHOD_MANUAL_REQUEST=1

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <leaseId>"
  echo "  leaseId: UUID of an existing lease between landlord@dev.local and tenant@dev.local"
  exit 1
fi
LEASE_ID="$1"

# ---- color helpers ----
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; CYAN='\033[0;36m'; NC='\033[0m'
step() { echo -e "\n${CYAN}== $1 ==${NC}"; }
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }
info() { echo -e "${YELLOW}  $1${NC}"; }

# ---- token helpers ----
get_token() {
  local user="$1" pass="$2"
  local resp
  resp=$(curl -s -X POST "$KEYCLOAK/realms/$REALM/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=password" \
    -d "client_id=$CLIENT" \
    -d "username=$user" \
    -d "password=$pass")
  local token
  token=$(echo "$resp" | jq -r '.access_token // empty')
  if [[ -z "$token" ]]; then
    echo "Failed to get token for $user" >&2
    echo "$resp" | jq . >&2
    exit 1
  fi
  echo "$token"
}

step "Acquiring tokens"
LANDLORD_TOKEN=$(get_token "landlord@dev.local" "landlord123")
ok "landlord token"
TENANT_TOKEN=$(get_token "tenant@dev.local" "tenant123")
ok "tenant token"

# ---- request helpers ----
# Args: METHOD PATH TOKEN [BODY_JSON]
# Echoes:  HTTP_STATUS<TAB>BODY
# Robust against connection errors: returns "000\t<error>" if curl can't reach the API.
api() {
  local method="$1" path="$2" token="$3" body="${4:-}"
  local body_file
  body_file=$(mktemp)
  local args=(-s -o "$body_file" -w "%{http_code}" -X "$method" "$API$path"
              -H "Authorization: Bearer $token"
              -H "Content-Type: application/json"
              --connect-timeout 5 --max-time 30)
  [[ -n "$body" ]] && args+=(-d "$body")
  local code
  code=$(curl "${args[@]}" 2>/dev/null) || true
  if [[ -z "$code" ]]; then
    code="000"
    echo "curl failed (connection error or timeout against $API$path)" > "$body_file"
  fi
  printf "%s\t%s" "$code" "$(cat "$body_file")"
  rm -f "$body_file"
}

expect() {
  local label="$1" expected_code="$2" actual_code="$3" body="$4"
  if [[ "$actual_code" == "$expected_code" ]]; then
    ok "$label → $actual_code"
    [[ -n "$body" && "$body" != "null" ]] && info "$(echo "$body" | jq -c . 2>/dev/null || echo "$body")"
  else
    info "body: $body"
    fail "$label → expected $expected_code, got $actual_code"
  fi
}

# ---- 1. Create payment (landlord) ----
step "1. Landlord creates Outstanding payment"
DUE_DATE=$(date -u -d "+30 days" +%Y-%m-%d 2>/dev/null || date -u -v+30d +%Y-%m-%d)
CREATE_BODY=$(jq -nc --arg leaseId "$LEASE_ID" --arg due "$DUE_DATE" '{
  leaseId: $leaseId, amount: 1200.00, currency: "EUR", dueDate: $due
}')
RESP=$(api POST "/api/v1/payments" "$LANDLORD_TOKEN" "$CREATE_BODY")
CODE="${RESP%%	*}"; BODY="${RESP#*	}"
expect "Create payment" "200" "$CODE" "$BODY"
PAYMENT_ID=$(echo "$BODY" | jq -r '.paymentId')
[[ "$PAYMENT_ID" != "null" && -n "$PAYMENT_ID" ]] || fail "Could not extract paymentId from create response"
info "paymentId: $PAYMENT_ID"

# ---- 2. Submit (tenant) — Outstanding → Pending ----
step "2. Tenant submits payment (Outstanding → Pending)"
SUBMIT_BODY_1=$(jq -nc --argjson method $METHOD_MANUAL_REQUEST '{method: $method, notes: "First attempt — paid in cash"}')
RESP=$(api POST "/api/v1/payments/$PAYMENT_ID/submit" "$TENANT_TOKEN" "$SUBMIT_BODY_1")
CODE="${RESP%%	*}"; BODY="${RESP#*	}"
expect "Submit (Outstanding → Pending)" "200" "$CODE" "$BODY"

# ---- 3. Reject (landlord) — Pending → Rejected ----
step "3. Landlord rejects payment (Pending → Rejected)"
REJECT_BODY='{"reason":"Cash receipt not received yet — please resubmit with photo"}'
RESP=$(api POST "/api/v1/payments/$PAYMENT_ID/reject" "$LANDLORD_TOKEN" "$REJECT_BODY")
CODE="${RESP%%	*}"; BODY="${RESP#*	}"
expect "Reject (Pending → Rejected)" "200" "$CODE" "$BODY"

# ---- 4. Submit again (tenant) — Rejected → Pending (Option C path) ----
step "4. Tenant resubmits (Rejected → Pending — Option C)"
SUBMIT_BODY_2=$(jq -nc --argjson method $METHOD_MANUAL_REQUEST '{method: $method, notes: "Second attempt — receipt attached now"}')
RESP=$(api POST "/api/v1/payments/$PAYMENT_ID/submit" "$TENANT_TOKEN" "$SUBMIT_BODY_2")
CODE="${RESP%%	*}"; BODY="${RESP#*	}"
expect "Resubmit (Rejected → Pending)" "200" "$CODE" "$BODY"

# ---- 5. Confirm (landlord) — Pending → Confirmed ----
step "5. Landlord confirms payment (Pending → Confirmed)"
RESP=$(api POST "/api/v1/payments/$PAYMENT_ID/confirm" "$LANDLORD_TOKEN" "")
CODE="${RESP%%	*}"; BODY="${RESP#*	}"
expect "Confirm (Pending → Confirmed)" "200" "$CODE" "$BODY"

# ---- 6. Try to confirm again — Confirmed is terminal, expect 409 ----
step "6. Confirm a Confirmed payment (expect 409 Conflict — terminal state)"
RESP=$(api POST "/api/v1/payments/$PAYMENT_ID/confirm" "$LANDLORD_TOKEN" "")
CODE="${RESP%%	*}"; BODY="${RESP#*	}"
expect "Re-confirm Confirmed" "409" "$CODE" "$BODY"

# ---- 7. Try to submit a Confirmed payment — expect 409 ----
step "7. Submit a Confirmed payment (expect 409 Conflict)"
SUBMIT_BODY_3=$(jq -nc --argjson method $METHOD_MANUAL_REQUEST '{method: $method, notes: "Should not work — payment is Confirmed"}')
RESP=$(api POST "/api/v1/payments/$PAYMENT_ID/submit" "$TENANT_TOKEN" "$SUBMIT_BODY_3")
CODE="${RESP%%	*}"; BODY="${RESP#*	}"
expect "Submit Confirmed" "409" "$CODE" "$BODY"

# ---- 8. Cross-role auth check: tenant tries landlord-only endpoint ----
step "8. Tenant tries to confirm a payment (expect 403 Forbidden)"
NEW_PAYMENT=$(api POST "/api/v1/payments" "$LANDLORD_TOKEN" "$CREATE_BODY")
NEW_ID=$(echo "${NEW_PAYMENT#*	}" | jq -r '.paymentId')
[[ "$NEW_ID" != "null" && -n "$NEW_ID" ]] || fail "Could not create second payment for auth check"
RESP=$(api POST "/api/v1/payments/$NEW_ID/confirm" "$TENANT_TOKEN" "")
CODE="${RESP%%	*}"; BODY="${RESP#*	}"
expect "Tenant confirms (RBAC)" "403" "$CODE" "$BODY"

# ---- 9. Validation: reject reason too short ----
step "9. Reject with reason < 10 chars (expect 400 Bad Request)"
SUBMIT_BODY_4=$(jq -nc --argjson method $METHOD_MANUAL_REQUEST '{method: $method, notes: "test"}')
api POST "/api/v1/payments/$NEW_ID/submit" "$TENANT_TOKEN" "$SUBMIT_BODY_4" >/dev/null
RESP=$(api POST "/api/v1/payments/$NEW_ID/reject" "$LANDLORD_TOKEN" '{"reason":"too short"}')
CODE="${RESP%%	*}"; BODY="${RESP#*	}"
expect "Reject with short reason" "400" "$CODE" "$BODY"

echo -e "\n${GREEN}All checks passed.${NC}"