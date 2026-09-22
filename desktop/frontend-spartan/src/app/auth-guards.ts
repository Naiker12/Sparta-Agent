// Copyright 2026-present the Spartan Agent AI team. All rights reserved.

import { redirect } from "@tanstack/react-router";

export function requireAuth(): void {
  // Authentication bypassed: always allow direct access to all routes.
  return;
}

export function requireGuest(): void {
  // Always redirect guest route requests to the main chat interface.
  throw redirect({ to: "/chat" });
}

export function requirePasswordChangeFlow(): void {
  // Password change not required: always redirect to main chat.
  throw redirect({ to: "/chat" });
}
