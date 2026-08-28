import { authFetch } from "@/features/auth";

export type InstalledSkill = {
  id: string;
  name: string;
  description: string;
  source: string;
  tags: string[];
  requires_api_key: boolean;
  env_vars: string[];
};

export async function listInstalledSkills(): Promise<InstalledSkill[]> {
  const response = await authFetch("/api/skills/");
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  const value = await response.json();
  return Array.isArray(value) ? (value as InstalledSkill[]) : [];
}
