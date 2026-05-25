# Cluster
output "cluster_id" {
  description = "DOKS cluster UUID. Use for doctl kubeconfig save."
  value       = digitalocean_kubernetes_cluster.myproperty.id
}

output "cluster_name" {
  description = "DOKS cluster name."
  value       = digitalocean_kubernetes_cluster.myproperty.name
}

output "cluster_endpoint" {
  description = "Kubernetes API server URL."
  value       = digitalocean_kubernetes_cluster.myproperty.endpoint
}

# Database — connection details for the backend pod.
# Host is the PRIVATE hostname so traffic stays inside the VPC. Port is the
# DIRECT (non-pooled) port 25060 — Npgsql does its own pooling; PgBouncer
# transaction mode breaks some EF Core features.
output "db_host" {
  description = "Managed Postgres private hostname. Use this — not the public host — from cluster workloads."
  value       = digitalocean_database_cluster.myproperty.private_host
}

output "db_port" {
  description = "Managed Postgres direct connection port (25060). NOT the pooled port (25061)."
  value       = digitalocean_database_cluster.myproperty.port
}

output "db_name" {
  description = "Application database name."
  value       = digitalocean_database_db.myproperty.name
}

output "db_user" {
  description = "Non-admin application user."
  value       = digitalocean_database_user.myproperty.name
}

output "db_password" {
  description = "Generated password for the application user. Read with: terraform output -raw db_password"
  value       = digitalocean_database_user.myproperty.password
  sensitive   = true
}

# Spaces — receipts bucket (M5 file-storage consumer).
output "receipts_bucket_name" {
  description = "Spaces bucket name for receipt file storage."
  value       = digitalocean_spaces_bucket.receipts.name
}

output "receipts_bucket_endpoint" {
  description = "S3-compatible endpoint URL for the receipts bucket region."
  value       = "${digitalocean_spaces_bucket.receipts.region}.digitaloceanspaces.com"
}

output "receipts_access_key_id" {
  description = "Access key ID for the receipts bucket."
  value       = digitalocean_spaces_key.receipts.access_key
  sensitive   = true
}

output "receipts_secret_key" {
  description = "Secret access key for the receipts bucket."
  value       = digitalocean_spaces_key.receipts.secret_key
  sensitive   = true
}
