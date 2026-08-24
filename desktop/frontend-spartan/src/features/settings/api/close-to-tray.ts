
export async function loadCloseToTray(): Promise<boolean | null> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<boolean | null>("get_close_to_tray");
}

export async function updateCloseToTray(enabled: boolean): Promise<boolean> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<boolean>("set_close_to_tray", { enabled });
}
