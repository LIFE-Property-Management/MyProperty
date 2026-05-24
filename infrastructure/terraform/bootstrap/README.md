# Bootstrap — Terraform state bucket

Creates the DigitalOcean Spaces bucket that holds the main `infrastructure/terraform/` module's
remote state. Uses **local state itself** because we can't store our own state in a bucket
that doesn't exist yet.

**Run this once.** Output `bucket_name` is pasted into the main module's `versions.tf` `backend "s3"` block.

## Recipe

1. Copy `terraform.tfvars.example` → `terraform.tfvars` and fill values (`do_token`, `spaces_access_id`, `spaces_secret_key`).
2. `terraform init`
3. `terraform plan -out=plan.bin`
4. `terraform apply plan.bin`
5. Copy the printed `bucket_name` output. Paste into `../versions.tf` backend block.

## Not in scope

This module does **not** manage application state. It only creates the state bucket. The main module
(one directory up) manages the cluster, database, application Spaces buckets, etc.
