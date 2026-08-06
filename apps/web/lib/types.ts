export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string | null;
  bio?: string;
  social_links?: Record<string, string>;
  role: 'user' | 'admin';
  is_verified: boolean;
  created_at: string;
  last_login?: string | null;
  plan: 'free' | 'pro' | 'enterprise';
}

export interface Project {
  id: string;
  name: string;
  description: string;
  visibility: 'public' | 'private';
  slug: string;
  prompt: string;
  tech_preferences: Record<string, unknown>;
  status: 'draft' | 'generating' | 'ready';
  latest_version: number;
  created_at: string;
  updated_at: string;
}

export interface VersionSummary {
  id: string;
  version: number;
  message: string;
  created_at: string;
}

export interface VersionDetail {
  id: string;
  project_id: string;
  version: number;
  message: string;
  html: string;
  css: string;
  js: string;
  backend: Record<string, string>;
  db_schema: string;
  files: Record<string, unknown>;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestion: Record<string, unknown>;
  created_at: string;
}

export interface Deployment {
  id: string;
  project_id: string;
  version: number;
  subdomain: string;
  status: string;
  target_url: string;
  created_at: string;
}

export interface Plan {
  tier: string;
  name: string;
  price_monthly: string;
  price_annual: string;
  project_limit: number;
  rate_limit: number;
  features: string[];
}

export interface Subscription {
  id: string;
  plan_tier: string;
  status: string;
  billing_cycle: string;
  current_period_end?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  enabled: boolean;
  created_at: string;
  last_used_at?: string | null;
}

export interface Invoice {
  id: string;
  amount_due: number;
  currency: string;
  status: string;
  created: number;
  url?: string | null;
  period?: unknown;
}

export interface GeneratedResult {
  summary: string;
  html: string;
  css: string;
  js: string;
  backend?: Record<string, string> | null;
  db_schema?: string;
  [key: string]: unknown;
}

export interface AdminStats {
  users: number;
  projects: number;
  deployments: number;
  api_keys: number;
  teams: number;
  llm_calls: number;
  llm_total_tokens: number;
  revenue_cents: number;
  one_time_revenue_cents: number;
  signups_last_7_days: number;
  projects_last_7_days: number;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  banned: boolean;
  created_at: string;
}

export interface AdminProject {
  id: string;
  name: string;
  slug: string;
  status: string;
  latest_version: number;
  visibility: string;
  owner_email: string;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

export interface AdminUsageRow {
  id: string;
  email: string | null;
  model: string;
  endpoint: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_estimate: number;
  cached: boolean;
  created_at: string;
}

export interface AdminPaymentRow {
  id: string;
  email: string | null;
  amount: number;
  currency: string;
  product_name: string;
  stripe_payment_intent_id: string;
  created_at: string;
}

export interface AdminSubscriptionRow {
  id: string;
  email: string;
  plan_tier: string;
  status: string;
  billing_cycle: string;
  current_period_end: string | null;
  stripe_subscription_id: string | null;
  updated_at: string;
}
