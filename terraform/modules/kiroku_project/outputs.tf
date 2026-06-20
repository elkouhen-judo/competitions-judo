output "vercel_project_id" {
  description = "Vercel project ID."
  value       = vercel_project.this.id
}

output "app_url" {
  description = "Canonical app URL passed in."
  value       = var.app_url
}
