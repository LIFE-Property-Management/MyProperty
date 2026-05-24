resource "random_id" "suffix" {
  byte_length = 3
}

resource "digitalocean_spaces_bucket" "tfstate" {
  name   = "${var.bucket_name_prefix}-${random_id.suffix.hex}"
  region = var.region
  acl    = "private"

  versioning {
    enabled = true
  }
}

output "bucket_name" {
  description = "Name of the created state bucket. Paste this into the main module's versions.tf backend config."
  value       = digitalocean_spaces_bucket.tfstate.name
}

output "bucket_endpoint" {
  description = "S3-compatible endpoint for the region."
  value       = "${var.region}.digitaloceanspaces.com"
}

output "region" {
  description = "Region the bucket lives in."
  value       = var.region
}
