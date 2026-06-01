{{/*
Expand the name of the chart.
*/}}
{{- define "myproperty.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
Uses .Release.Name so all resources are prefixed as myproperty-<component>.
*/}}
{{- define "myproperty.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Chart label (name + version).
*/}}
{{- define "myproperty.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels applied to every resource.
*/}}
{{- define "myproperty.labels" -}}
helm.sh/chart: {{ include "myproperty.chart" . }}
{{ include "myproperty.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels — stable subset used by Service selectors and Deployment selectors.
*/}}
{{- define "myproperty.selectorLabels" -}}
app.kubernetes.io/name: {{ include "myproperty.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
ServiceAccount name helper. Override via values.serviceAccount.name.
*/}}
{{- define "myproperty.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "myproperty.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
TLS SAN host list. Includes only hosts whose backing component is enabled, so the
ACME certificate request never contains a name with no Ingress/DNS — which would
fail its HTTP-01 challenge and block issuance of the entire shared SAN cert.
*/}}
{{- define "myproperty.tlsHosts" -}}
{{- $hosts := list -}}
{{- if .Values.frontend.enabled -}}{{- $hosts = append $hosts .Values.hosts.app -}}{{- end -}}
{{- if .Values.backend.enabled -}}{{- $hosts = append $hosts .Values.hosts.api -}}{{- end -}}
{{- if .Values.keycloak.enabled -}}{{- $hosts = append $hosts .Values.hosts.auth -}}{{- end -}}
{{- if .Values.uptimeKuma.enabled -}}{{- $hosts = append $hosts .Values.hosts.status -}}{{- end -}}
{{- if .Values.monitoring.enabled -}}{{- $hosts = append $hosts .Values.hosts.grafana -}}{{- end -}}
{{- toYaml $hosts -}}
{{- end -}}

{{/*
cert-manager annotation — emits cluster-issuer vs namespaced issuer key based on
ingress.tls.issuerKind.
*/}}
{{- define "myproperty.certIssuerAnnotation" -}}
{{- if eq .Values.ingress.tls.issuerKind "ClusterIssuer" -}}
cert-manager.io/cluster-issuer: {{ .Values.ingress.tls.issuerName }}
{{- else -}}
cert-manager.io/issuer: {{ .Values.ingress.tls.issuerName }}
{{- end -}}
{{- end -}}
