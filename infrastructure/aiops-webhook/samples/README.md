# AIOps webhook sample payloads

Hand-built Alertmanager webhook payloads for ad-hoc verification of the
`aiops-webhook` service. Used by the docs/milestones M4.11 verification
gates (G6) and reusable for manual smoke tests.

Send a firing alert through the local stack:

    curl -X POST http://localhost:5001/alerts \
        -H "Content-Type: application/json" \
        -d @samples/firing-alert.json

Then the resolved variant:

    curl -X POST http://localhost:5001/alerts \
        -H "Content-Type: application/json" \
        -d @samples/resolved-alert.json

Both return HTTP 202 with `{"received": 1, "queued": true}`. The Slack /
stdout message arrives asynchronously (background task).
