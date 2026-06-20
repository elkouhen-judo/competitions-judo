terraform {
  required_version = ">= 1.9"

  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 3.2"
    }
    supabase = {
      source  = "supabase/supabase"
      version = "~> 1.4"
    }
  }
}
