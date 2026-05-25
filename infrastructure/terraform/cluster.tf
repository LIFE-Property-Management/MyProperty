# DOKS cluster — managed control plane (free) + worker node pool.
# Region is fra1 (Frankfurt) per locked scope. Uses the region's default VPC so
# the cluster and the managed Postgres share network reachability without extra
# Terraform.

resource "digitalocean_kubernetes_cluster" "myproperty" {
  name    = var.cluster_name
  region  = var.region
  version = var.cluster_version

  # HA control plane is $40/mo extra — not enabled for a 5-day demo.
  ha = false

  # auto_upgrade left off; we control K8s upgrades explicitly via
  # cluster_version bumps.
  auto_upgrade = false

  # Surge upgrades are free and reduce downtime during version bumps; safe default.
  surge_upgrade = true

  node_pool {
    name       = "default"
    size       = var.cluster_node_size
    node_count = var.cluster_node_count

    # Autoscaling deliberately off — fixed 2-node pool for predictable cost.
    auto_scale = false

    labels = {
      role = "worker"
    }
  }
}
