# Application file-storage bucket. Not consumed in M4 — provisioned now so M5's
# backend-on-Spaces migration picks up an existing resource with credentials in
# Terraform outputs. Strengthens M4.7's "real cloud resources" deliverable narrative.

resource "random_id" "receipts_suffix" {
  byte_length = 3
}

resource "digitalocean_spaces_bucket" "receipts" {
  name   = "${var.spaces_bucket_prefix_receipts}-${random_id.receipts_suffix.hex}"
  region = var.region
  acl    = "private"

  versioning {
    enabled = false # Receipts are append-only; versioning adds cost without value here.
  }
}

# Programmatic credentials for the receipts bucket. Scoped to a single bucket
# via the grant block. Resulting key is exposed in outputs.tf (sensitive).
resource "digitalocean_spaces_key" "receipts" {
  name = "myproperty-receipts-key"

  grant {
    bucket     = digitalocean_spaces_bucket.receipts.name
    permission = "readwrite"
  }
}
