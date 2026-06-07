# n8n tenant-inquiry sample payloads

Hand-built webhook payloads for ad-hoc verification of the tenant-inquiry
automation. Used by the M5.8 verification gates and reusable for manual smoke
tests.

Send a routine inquiry through the local stack:

    curl -X POST http://localhost:5678/webhook/tenant-inquiry \
        -H "Content-Type: application/json" \
        -d @tenant-inquiry.json

Then the urgent variant (no heating, infant at home):

    curl -X POST http://localhost:5678/webhook/tenant-inquiry \
        -H "Content-Type: application/json" \
        -d @urgent-inquiry.json

Both return HTTP 200 with the triage result. The accepted body fields are
`tenantName`, `tenantEmail`, `propertyRef`, `message`, and `receivedAt` — all
optional; the workflow defaults anything missing. Delivery is to Discord when
`DISCORD_WEBHOOK_URL` is set, otherwise the result is logged to stdout and
shipped to Loki (`{container="myproperty-n8n"}` in Grafana).
