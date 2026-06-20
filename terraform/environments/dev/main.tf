# This Vercel project and Supabase project are NOT created by Terraform.
# They were created manually (see docs/spec-tech.md, VCL-005b and CFG-011) and
# must be imported once with `terraform import` before the first `terraform apply`.
# See terraform/README.md.

module "app" {
  source = "../../modules/kiroku_project"

  project_name         = "competitions-judo-dev"
  vercel_team_id       = var.vercel_team_id
  node_version         = "22.x"
  app_url              = "https://competitions-judo-dev.vercel.app"
  supabase_project_ref = var.supabase_project_ref
}
