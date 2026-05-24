# Authentication
variable "do_token" {
  description = "DigitalOcean Personal Access Token (read+write). Same token used by doctl + GitHub Actions DIGITALOCEAN_ACCESS_TOKEN secret."
  type        = string
  sensitive   = true
}

variable "spaces_access_id" {
  description = "DigitalOcean Spaces access key ID."
  type        = string
  sensitive   = true
}

variable "spaces_secret_key" {
  description = "DigitalOcean Spaces secret key."
  type        = string
  sensitive   = true
}

# Region
variable "region" {
  description = "DigitalOcean region slug for all resources (cluster, DB, buckets)."
  type        = string
  default     = "fra1"
}

# Cluster
variable "cluster_name" {
  description = "DOKS cluster name. Used as the kubeconfig context name when configured via doctl."
  type        = string
  default     = "myproperty-cluster"
}

variable "cluster_version" {
  description = "DOKS Kubernetes version slug. Get current options with `doctl kubernetes options versions`."
  type        = string
  default     = "1.34.8-do.0"
}

variable "cluster_node_size" {
  description = "Droplet size slug for worker nodes."
  type        = string
  default     = "s-2vcpu-4gb"
}

variable "cluster_node_count" {
  description = "Number of worker nodes in the default pool."
  type        = number
  default     = 2
}

# Database
variable "db_cluster_name" {
  description = "Managed Postgres cluster name."
  type        = string
  default     = "myproperty-db"
}

variable "db_engine_version" {
  description = "Postgres major version. Must match the in-cluster Postgres version (16) so EF migrations behave identically."
  type        = string
  default     = "16"
}

variable "db_size" {
  description = "Managed Postgres node size slug. Get options with `doctl databases options slugs --engine pg`."
  type        = string
  default     = "db-s-1vcpu-1gb"
}

variable "db_name" {
  description = "Application database name inside the cluster."
  type        = string
  default     = "myproperty"
}

variable "db_user" {
  description = "Non-admin application database user. Granted access to db_name only. Never doadmin."
  type        = string
  default     = "myproperty_app"
}

# Spaces
variable "spaces_bucket_prefix_receipts" {
  description = "Prefix for the receipts Spaces bucket. Random 6-char suffix appended."
  type        = string
  default     = "myproperty-receipts"
}
