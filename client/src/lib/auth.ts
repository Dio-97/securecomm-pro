import { apiRequest } from "./queryClient";
import type { LoginRequest } from "@shared/schema";

export async function login(credentials: LoginRequest) {
  const response = await apiRequest("POST", "/api/auth/login", credentials);
  return response.json();
}
