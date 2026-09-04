"""Studio SQLite database modular architecture."""

from storage.studio.exceptions import (
    ChatMessageConflictError,
    ChatMessageProtectedError,
    ChatThreadDeletedError,
    ChatThreadPreconditionFailed,
    CorruptSettingsError,
    ProjectWorkspaceError,
)

from storage.studio.connection import (
    get_connection,
    _BUSY_TIMEOUT_SECONDS,
    _CONTENDED_BUSY_TIMEOUT_SECONDS,
    _SQLITE_IN_CHUNK_SIZE,
    _schema_lock,
    _schema_ready,
)

from storage.studio.schema import (
    _ensure_schema,
    _CHAT_ATTACHMENT_INVENTORY_VERSION,
)

from storage.studio.project_workspace import (
    _PROJECT_WORKSPACE_SUBDIRS,
    _contains_sensitive_path_component,
    _default_project_root,
    _delete_project_workspace,
    _denied_path_prefixes,
    _ensure_project_workspace,
    _like_escape,
    _mentions_session,
    _project_slug,
    contains_sensitive_path_component,
    delete_chat_project_workspace,
    delete_project_workspace,
    is_denied_system_path,
    sandbox_is_referenced_elsewhere,
)

from storage.studio.prompt_library import (
    _prompt_entry_from_row,
    _prompt_list_from_row,
    bulk_upsert_prompt_entries,
    bulk_upsert_prompt_lists,
    delete_prompt_entry,
    delete_prompt_list_db,
    list_prompt_entries,
    list_prompt_lists_db,
    upsert_prompt_entry,
    upsert_prompt_list,
)

from storage.studio.training_runs import (
    _extract_project_name_from_config_json,
    cleanup_orphaned_runs,
    create_run,
    delete_run,
    finish_run,
    get_resumable_run_by_output_dir,
    get_run,
    get_run_metrics,
    insert_metrics_batch,
    list_other_run_output_dirs,
    list_runs,
    mark_run_cancel_requested,
    update_run_config_json,
    update_run_display_name,
    update_run_output_dir,
    update_run_progress,
    update_run_total_steps,
)

from storage.studio.scan_folders import (
    add_scan_folder,
    add_scan_folder_with_status,
    list_scan_folders,
    remove_scan_folder,
)

from storage.studio.chat_threads import (
    _ACTIVE_RESEARCH_RUN_STATUSES,
    _MAX_SETTINGS_WRITERS,
    _OPENING_USER_MESSAGE,
    _active_research_run_ids,
    _reparent_surviving_forks,
    _tombstone_chat_threads,
    _workspace_from_row,
    _write_chat_thread_settings_in_conn,
    bind_chat_thread_workspace,
    build_chat_history_export,
    clear_chat_history,
    clear_chat_history_with_active_research_runs,
    count_chat_threads,
    delete_chat_threads,
    delete_chat_threads_with_active_research_runs,
    get_chat_thread,
    get_thread_workspace_binding,
    list_chat_threads,
    unbind_chat_thread_workspace,
    update_chat_thread,
    upsert_chat_thread,
    write_chat_thread_settings,
)

from storage.studio.chat_projects import (
    _chat_project_from_row,
    delete_chat_project,
    delete_chat_project_with_active_research_runs,
    ensure_chat_project_workspace,
    get_chat_project,
    list_chat_projects,
    update_chat_project,
    upsert_chat_project,
)

from storage.studio.chat_forks import (
    _RESEARCH_LINK_KEYS,
    _chat_thread_from_row,
    _detach_research_message_json,
    _json_loads,
    _parents_of,
    _raise_if_chat_thread_deleted,
    _reseat_protected_messages,
    count_forks_for_message,
    fork_chat_thread,
    fork_counts_for_thread,
)

from storage.studio.chat_attachments import (
    _CONTENT_PART_ID_PREFIX,
    _URI_SCHEME_RE,
    _attachment_content_parts,
    _blob_part_base64_len,
    _chat_attachment_inventory_entries,
    _chat_attachment_metadata_text,
    _chat_attachment_size_bytes,
    _content_part_attachments,
    _content_part_id,
    _ensure_chat_attachment_inventory_current,
    _is_locally_stored_blob,
    _managed_content_part_payload,
    _mark_chat_attachment_inventory_clean,
    _rebuild_chat_attachment_inventory,
    _record_chat_attachment_tombstone,
    _replace_chat_attachment_inventory,
    count_chat_message_attachments,
    delete_chat_attachment,
    get_chat_attachment,
    list_chat_attachments,
    list_chat_attachments_page,
)

from storage.studio.chat_messages import (
    _bump_chat_thread_updated_at,
    _chat_attachment_tombstones_for_messages,
    _chat_message_from_row,
    _guard_research_messages,
    _raise_if_chat_message_thread_conflicts,
    _reconcile_chat_message_uploads,
    _recompute_chat_thread_updated_at,
    _research_message_ids,
    _research_message_would_change,
    _surviving_parent_id,
    get_chat_message,
    list_chat_messages,
    list_chat_messages_for_threads,
    sync_chat_messages,
    upsert_chat_message,
)

from storage.studio.settings import (
    _ATOMIC_SETTING_KEYS,
    _deep_merge_settings,
    _load_chat_settings_for_merge,
    _parse_chat_setting_json,
    get_app_setting,
    list_chat_legacy_imports,
    list_chat_settings,
    upsert_app_setting_map_entry,
    upsert_app_settings,
    upsert_chat_legacy_imports,
    upsert_chat_settings,
    upsert_chat_settings_merge,
)
