export type Role = "owner" | "member";
export type EntryKind = "workout" | "nutrition" | "hydration" | "bonus";
export type NutritionState = "clean" | "fast";

export interface Challenge {
  id: string;
  owner_id: string;
  name: string;
  start_date: string; // ISO date
  weeks: number;
  timezone: string;
  buyin_amount: number;
  currency: string;
  pt_workout: number;
  pt_clean: number;
  pt_fast: number;
  pt_litre: number;
  bonus_cap: number;
  invite_token: string;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
}

export interface Membership {
  id: string;
  challenge_id: string;
  user_id: string;
  role: Role;
  joined_at: string;
  profiles?: Profile;
}

export interface Entry {
  id: string;
  challenge_id: string;
  user_id: string;
  day: string; // ISO date
  kind: EntryKind;
  detail: string | null;
  points: number;
  photo_url: string | null;
  created_at: string;
}

export interface BonusChallenge {
  id: string;
  challenge_id: string;
  week_no: number;
  title: string;
  points: number;
}
