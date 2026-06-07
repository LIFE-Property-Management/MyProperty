"""
Generator for the M5.8 n8n "tenant-inquiry triage" workflow.

This is a *build helper*, not a runtime artifact. It exists only because n8n
workflow JSON embeds long JavaScript strings (the Code nodes) that are painful
to hand-escape. We author the JS as normal Python strings here, dump valid JSON,
import it into a real n8n instance, verify end-to-end, then commit n8n's own
canonical export of the workflow. Re-run if you need to regenerate the import
seed:  python infrastructure/n8n/_build_workflow.py
"""

import json
import pathlib

# ── Code node: normalise the inbound webhook body + build the Anthropic request
PREPARE_JS = r"""
// Normalise the inbound webhook body and build the Anthropic request.
// The Webhook node nests the POSTed JSON under `body`; fall back to the root
// item so a hand-crafted test payload without that envelope still works.
const body = ($json.body && typeof $json.body === 'object') ? $json.body : $json;

const str = (v, n) => (v === undefined || v === null ? '' : String(v)).slice(0, n);

const tenantName  = str(body.tenantName || body.name, 200) || 'Unknown tenant';
const tenantEmail = str(body.tenantEmail || body.email, 200);
const propertyRef = str(body.propertyRef || body.property || body.propertyId, 200);
const message     = str(body.message || body.inquiry || body.text, 4000);
const receivedAt  = str(body.receivedAt, 40) || new Date().toISOString();

const model = ($env.N8N_TENANT_INQUIRY_MODEL || 'claude-haiku-4-5-20251001').trim();
const anthropicConfigured = !!($env.ANTHROPIC_API_KEY && $env.ANTHROPIC_API_KEY.trim());

const system = [
  'You are the front-desk assistant for MyProperty, a property-management',
  'platform. You triage inbound tenant inquiries for the landlord. Be concise,',
  'practical, and professional.',
  '',
  'Respond with ONLY a JSON object (no markdown, no prose, no code fences) with',
  'exactly these keys:',
  '  "category": one of "maintenance", "billing", "lease", "complaint", "general"',
  '  "urgency": one of "low", "medium", "high", "urgent"',
  '  "sentiment": one of "positive", "neutral", "negative", "frustrated"',
  '  "summary": one sentence summarising the inquiry for the landlord',
  '  "suggestedReply": a short professional draft reply (2-4 sentences) the',
  '      landlord can send back to the tenant',
  '  "recommendedAction": one short imperative sentence telling the landlord',
  '      what to do next',
].join('\n');

const userPrompt = [
  'New tenant inquiry received ' + receivedAt + '.',
  'Tenant: ' + tenantName + (tenantEmail ? ' <' + tenantEmail + '>' : ''),
  'Property: ' + (propertyRef || '(not specified)'),
  '',
  'Message:',
  (message || '(empty)'),
].join('\n');

const anthropicBody = {
  model: model,
  max_tokens: 1024,
  system: system,
  messages: [{ role: 'user', content: userPrompt }],
};

return [{ json: {
  tenantName, tenantEmail, propertyRef, message, receivedAt,
  model, anthropicConfigured, anthropicBody,
} }];
""".strip()

# ── Code node: parse Claude's reply (with fallback) + build Discord embed + log
PARSE_JS = r"""
// Read the prepared fields (preserved across the HTTP node) and Claude's reply.
const prep = $('Prepare triage request').first().json;
const resp = $json;

function fallback(reason) {
  return {
    category: 'general',
    urgency: 'unknown',
    sentiment: 'unknown',
    summary: (prep.message || 'Tenant inquiry received.').slice(0, 280),
    suggestedReply: 'Thank you for reaching out. We have received your message '
      + 'and a member of our team will get back to you shortly.',
    recommendedAction: 'Review this inquiry manually — automated triage was '
      + 'unavailable (' + reason + ').',
    aiTriaged: false,
  };
}

let triage;
try {
  if (!prep.anthropicConfigured) {
    triage = fallback('ANTHROPIC_API_KEY not set');
  } else if (resp && Array.isArray(resp.content)) {
    const text = resp.content
      .filter(b => b && b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();
    const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    triage = {
      category: parsed.category || 'general',
      urgency: parsed.urgency || 'medium',
      sentiment: parsed.sentiment || 'neutral',
      summary: parsed.summary || (prep.message || '').slice(0, 280),
      suggestedReply: parsed.suggestedReply || '',
      recommendedAction: parsed.recommendedAction || '',
      aiTriaged: true,
    };
  } else {
    triage = fallback('Claude API call failed');
  }
} catch (e) {
  triage = fallback('could not parse Claude response');
}

// Discord embed — colour/emoji conventions mirror the M4.11 aiops-webhook.
const COLOR = { urgent: 0xE01E5A, high: 0xE01E5A, medium: 0xECB22E, low: 0x36C5F0, unknown: 0x95A5A6 };
const EMOJI = { urgent: '\u{1F6A8}', high: '\u{1F6A8}', medium: '⚠️', low: 'ℹ️', unknown: '\u{1F514}' };
const emoji = EMOJI[triage.urgency] || '\u{1F514}';
const color = COLOR[triage.urgency] || COLOR.unknown;

const fields = [
  { name: 'Tenant', value: (prep.tenantName || 'Unknown') + (prep.tenantEmail ? ' <' + prep.tenantEmail + '>' : ''), inline: true },
  { name: 'Property', value: prep.propertyRef || '(not specified)', inline: true },
  { name: 'Urgency', value: String(triage.urgency), inline: true },
  { name: 'Category', value: String(triage.category), inline: true },
  { name: 'Sentiment', value: String(triage.sentiment), inline: true },
];

const descParts = [];
if (triage.summary) descParts.push('**Summary**\n' + triage.summary);
descParts.push('**Original message**\n' + (prep.message || '(empty)').slice(0, 1500));
if (triage.suggestedReply) descParts.push('**Suggested reply**\n' + triage.suggestedReply);
if (triage.recommendedAction) descParts.push('**Recommended action**\n' + triage.recommendedAction);

const discordPayload = {
  content: (emoji + ' [' + String(triage.urgency).toUpperCase() + '] New tenant inquiry from '
    + (prep.tenantName || 'Unknown')).slice(0, 2000),
  embeds: [{
    title: (emoji + ' New tenant inquiry').slice(0, 256),
    color: color,
    description: descParts.join('\n\n').slice(0, 4096),
    fields: fields,
  }],
};

const discordConfigured = !!($env.DISCORD_WEBHOOK_URL && $env.DISCORD_WEBHOOK_URL.trim());

const responseBody = {
  received: true,
  aiTriaged: triage.aiTriaged,
  category: triage.category,
  urgency: triage.urgency,
  sentiment: triage.sentiment,
  summary: triage.summary,
  suggestedReply: triage.suggestedReply,
  recommendedAction: triage.recommendedAction,
  deliveredTo: discordConfigured ? 'discord' : 'log',
};

// Always log a structured line. Promtail ships n8n's stdout to Loki, so the
// triage is visible in Grafana even when DISCORD_WEBHOOK_URL is unset.
console.log('[n8n][tenant-inquiry] ' + JSON.stringify({ tenant: prep.tenantName, ...responseBody }));

return [{ json: { discordPayload, discordConfigured, responseBody, triage } }];
""".strip()


def boolean_if(node_id, name, expr, x, y):
    """An IF node (v2) that branches on a boolean expression being true."""
    return {
        "parameters": {
            "conditions": {
                "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
                "conditions": [{
                    "id": node_id + "-c1",
                    "leftValue": expr,
                    "rightValue": "",
                    "operator": {"type": "boolean", "operation": "true", "singleValue": True},
                }],
                "combinator": "and",
            },
            "options": {},
        },
        "id": node_id,
        "name": name,
        "type": "n8n-nodes-base.if",
        "typeVersion": 2.2,
        "position": [x, y],
    }


nodes = [
    {
        "parameters": {
            "httpMethod": "POST",
            "path": "tenant-inquiry",
            "responseMode": "responseNode",
            "options": {},
        },
        "id": "node-webhook",
        "name": "Webhook",
        "type": "n8n-nodes-base.webhook",
        "typeVersion": 2,
        "position": [0, 300],
        "webhookId": "myproperty-tenant-inquiry",
    },
    {
        "parameters": {"jsCode": PREPARE_JS},
        "id": "node-prepare",
        "name": "Prepare triage request",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [220, 300],
    },
    boolean_if("node-if-anthropic", "Anthropic configured?", "={{ $json.anthropicConfigured }}", 440, 300),
    {
        "parameters": {
            "method": "POST",
            "url": "https://api.anthropic.com/v1/messages",
            "sendHeaders": True,
            "headerParameters": {"parameters": [
                {"name": "x-api-key", "value": "={{ $env.ANTHROPIC_API_KEY }}"},
                {"name": "anthropic-version", "value": "2023-06-01"},
                {"name": "content-type", "value": "application/json"},
            ]},
            "sendBody": True,
            "specifyBody": "json",
            "jsonBody": "={{ JSON.stringify($json.anthropicBody) }}",
            "options": {"timeout": 20000},
        },
        "id": "node-claude",
        "name": "Claude triage",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": [660, 200],
        "onError": "continueRegularOutput",
    },
    {
        "parameters": {"jsCode": PARSE_JS},
        "id": "node-parse",
        "name": "Parse triage",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [880, 300],
    },
    boolean_if("node-if-discord", "Discord configured?", "={{ $json.discordConfigured }}", 1100, 300),
    {
        "parameters": {
            "method": "POST",
            "url": "={{ $env.DISCORD_WEBHOOK_URL }}",
            "sendBody": True,
            "specifyBody": "json",
            "jsonBody": "={{ JSON.stringify($json.discordPayload) }}",
            "options": {"timeout": 10000},
        },
        "id": "node-discord",
        "name": "Post to Discord",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": [1320, 200],
        "onError": "continueRegularOutput",
    },
    {
        "parameters": {
            "respondWith": "json",
            "responseBody": "={{ JSON.stringify($('Parse triage').first().json.responseBody) }}",
            "options": {},
        },
        "id": "node-respond",
        "name": "Respond to caller",
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1.1,
        "position": [1320, 400],
    },
]

connections = {
    "Webhook": {"main": [[{"node": "Prepare triage request", "type": "main", "index": 0}]]},
    "Prepare triage request": {"main": [[{"node": "Anthropic configured?", "type": "main", "index": 0}]]},
    "Anthropic configured?": {"main": [
        [{"node": "Claude triage", "type": "main", "index": 0}],   # true
        [{"node": "Parse triage", "type": "main", "index": 0}],    # false
    ]},
    "Claude triage": {"main": [[{"node": "Parse triage", "type": "main", "index": 0}]]},
    "Parse triage": {"main": [[{"node": "Discord configured?", "type": "main", "index": 0}]]},
    "Discord configured?": {"main": [
        [{"node": "Post to Discord", "type": "main", "index": 0}],   # true
        [{"node": "Respond to caller", "type": "main", "index": 0}], # false
    ]},
    "Post to Discord": {"main": [[{"node": "Respond to caller", "type": "main", "index": 0}]]},
}

workflow = {
    "name": "MyProperty - Tenant inquiry triage (M5.8)",
    "nodes": nodes,
    "connections": connections,
    "active": True,
    "settings": {"executionOrder": "v1"},
    "pinData": {},
    "meta": {},
    "id": "MyPropertyM58Inq",
}

out = pathlib.Path(__file__).parent / "workflows" / "tenant-inquiry.json"
out.parent.mkdir(parents=True, exist_ok=True)
# `n8n import:workflow --input=<file>` expects a JSON array of workflows.
out.write_text(json.dumps([workflow], indent=2, ensure_ascii=False), encoding="utf-8")
print("wrote", out)
