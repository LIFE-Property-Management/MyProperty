terraform {
  required_version = ">= 1.6"

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.46"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # State stored in a DigitalOcean Spaces bucket via the S3-compatible backend.
  # Bucket is created out-of-band by ./bootstrap/. After bootstrap apply, paste the
  # bucket name into the `bucket` field below (or pass via -backend-config at init).
  backend "s3" {
    endpoints = {
      s3 = "https://fra1.digitaloceanspaces.com"
    }
    bucket                      = "REPLACE_WITH_BOOTSTRAP_OUTPUT"
    key                         = "myproperty/terraform.tfstate"
    region                      = "us-east-1" # Required placeholder for the S3 backend; DO Spaces ignores this.
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true
    use_path_style              = false
  }
}

provider "digitalocean" {
  token             = var.do_token
  spaces_access_id  = var.spaces_access_id
  spaces_secret_key = var.spaces_secret_key
}
