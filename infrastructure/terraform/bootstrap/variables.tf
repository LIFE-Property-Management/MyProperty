variable "do_token" {
  description = "DigitalOcean Personal Access Token (read+write)."
  type        = string
  sensitive   = true
}

variable "spaces_access_id" {
  description = "DigitalOcean Spaces access key ID. Generate at https://cloud.digitalocean.com/account/api/spaces."
  type        = string
  sensitive   = true
}

variable "spaces_secret_key" {
  description = "DigitalOcean Spaces secret key. Generated alongside spaces_access_id."
  type        = string
  sensitive   = true
}

variable "region" {
  description = "DigitalOcean region for the state bucket. Match the main stack."
  type        = string
  default     = "fra1"
}

variable "bucket_name_prefix" {
  description = "Prefix for the state bucket; a random 6-char suffix is appended."
  type        = string
  default     = "myproperty-tfstate"
}
