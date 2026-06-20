variable "project_name" {
  description = "Vercel project name (also determines the *.vercel.app subdomain)."
  type        = string
}

variable "vercel_team_id" {
  description = "Vercel team ID that owns the project."
  type        = string
}

variable "node_version" {
  description = "Node.js version for builds and serverless functions."
  type        = string
}

variable "app_url" {
  description = "Canonical app URL for this environment, e.g. https://competitions-judo.vercel.app."
  type        = string
}

variable "local_dev_url" {
  description = "Local dev URL allowed as an additional Auth redirect target."
  type        = string
  default     = "http://localhost:3100"
}

variable "supabase_project_ref" {
  description = "Project ref (subdomain) of this environment's dedicated Supabase project."
  type        = string
}
