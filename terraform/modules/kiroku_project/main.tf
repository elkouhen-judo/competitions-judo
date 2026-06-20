# Scope kept deliberately narrow: name and node_version only. Build/install
# commands and routing stay owned by the committed vercel.json (VCL-006/VCL-006a)
# so there is a single source of truth for build behavior. Environment
# variables (Supabase keys, MCP_JWT_SECRET, etc.) are intentionally NOT
# managed here — see terraform/README.md "Why secrets are out of scope".
resource "vercel_project" "this" {
  name         = var.project_name
  team_id      = var.vercel_team_id
  node_version = var.node_version
}

# Mirrors CFG-005/CFG-006/CFG-006a/CFG-006b: the deployed app URL and local dev
# must be allowed Auth redirect targets, against this environment's own
# dedicated Supabase project (CFG-011).
resource "supabase_settings" "auth" {
  project_ref = var.supabase_project_ref

  auth = jsonencode({
    site_url       = var.app_url
    uri_allow_list = "${var.app_url},${var.local_dev_url}"
  })
}
