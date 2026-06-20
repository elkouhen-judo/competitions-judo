variable "vercel_api_token" {
  description = "Vercel API token (also settable via VERCEL_API_TOKEN env var). Never commit this value."
  type        = string
  sensitive   = true
  default     = null
}

variable "vercel_team_id" {
  description = "Vercel team ID that owns this project."
  type        = string
  default     = "team_RvEgPCDetancG3mzS4xHRnTs"
}

variable "supabase_access_token" {
  description = "Supabase Management API access token (also settable via SUPABASE_ACCESS_TOKEN env var). Never commit this value."
  type        = string
  sensitive   = true
  default     = null
}

variable "supabase_project_ref" {
  description = "Project ref (subdomain) of the production Supabase project."
  type        = string
  default     = "dqtdbfmehwdexikkblwg"
}
