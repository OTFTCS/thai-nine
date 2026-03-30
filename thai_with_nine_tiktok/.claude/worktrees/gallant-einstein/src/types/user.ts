export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  role: "user" | "admin";
  subscriptionStatus: "free" | "active" | "cancelled" | "past_due";
}
