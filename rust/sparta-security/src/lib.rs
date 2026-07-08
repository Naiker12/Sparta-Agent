#[macro_use]
extern crate napi_derive;

mod validator;
mod sanitizer;
mod guard;
mod audit;

use napi::bindgen_prelude::*;
use serde_json::Value;

/// Validate a raw JSON-RPC message (request or response)
#[napi]
pub fn validate_message(line: String) -> Result<String> {
    let result = validator::validate_raw(&line);
    let status = if result.valid { "ok" } else { "error" };
    Ok(serde_json::json!({
        "status": status,
        "valid": result.valid,
        "error": result.error,
    })
    .to_string())
}

/// Sanitize a tool call and return if it's safe
///
/// DEPRECATED — Python (`python/sparta_ai/tools/file_tools.py`) is now the
/// SINGLE SOURCE OF TRUTH for sanitization.  This export is kept only to
/// avoid breaking existing code; it is NOT called from the active flow.
/// See `python/sparta_ai/tools/file_tools.py:BLOCKED_FILE_PATTERNS`.
#[napi]
pub fn sanitize_tool_call(tool_name: String, input_json: String) -> Result<String> {
    let input: Value = serde_json::from_str(&input_json)
        .map_err(|e| Error::from_reason(format!("Invalid input JSON: {}", e)))?;

    let result = sanitizer::sanitize_tool_call(&tool_name, &input);

    Ok(serde_json::json!({
        "safe": result.safe,
        "blocked_reason": result.blocked_reason,
        "sanitized_input": result.sanitized_input,
    })
    .to_string())
}

/// Sanitize multiple tool calls at once
#[napi]
pub fn sanitize_tool_calls(tool_calls_json: String) -> Result<String> {
    let tool_calls: Value = serde_json::from_str(&tool_calls_json)
        .map_err(|e| Error::from_reason(format!("Invalid tool calls JSON: {}", e)))?;

    let results = sanitizer::sanitize_tool_calls(&tool_calls);

    let json_results: Vec<serde_json::Value> = results
        .into_iter()
        .map(|r| {
            serde_json::json!({
                "safe": r.safe,
                "blocked_reason": r.blocked_reason,
                "sanitized_input": r.sanitized_input,
            })
        })
        .collect();

    Ok(serde_json::to_string(&json_results).unwrap_or_default())
}

/// Check rate limit for a session
#[napi]
pub fn check_rate_limit(session_id: String) -> String {
    let mut guard = guard::SECURITY_GUARD.lock().unwrap();
    let result = guard.check_rate_limit(&session_id);
    match result {
        guard::GuardResult::Allowed => {
            serde_json::json!({"allowed": true}).to_string()
        }
        guard::GuardResult::Blocked(reason) => {
            serde_json::json!({"allowed": false, "reason": reason}).to_string()
        }
    }
}

/// Validate tool call count per turn
#[napi]
pub fn validate_tool_call_count(count: u32) -> String {
    let guard = guard::SecurityGuard::new();
    let result = guard.validate_tool_call_count(count);
    match result {
        guard::GuardResult::Allowed => {
            serde_json::json!({"allowed": true}).to_string()
        }
        guard::GuardResult::Blocked(reason) => {
            serde_json::json!({"allowed": false, "reason": reason}).to_string()
        }
    }
}

/// Configure audit logging
#[napi]
pub fn configure_audit_log(path: String) {
    audit::AuditLogger::configure(&path);
}

/// Log a tool call event to the audit trail
#[napi]
pub fn audit_log_tool_call(session_id: String, message_id: String, tool_name: String, input_json: String, blocked: bool) {
    audit::AuditLogger::log_tool_call(&session_id, &message_id, &tool_name, &input_json, blocked);
}

/// Log a security event to the audit trail
#[napi]
pub fn audit_log_security(event_type: String, session_id: String, action: String, details: String) {
    audit::AuditLogger::log_security_event(&event_type, &session_id, &action, &details);
}

/// Check if audit logging is enabled
#[napi]
pub fn is_audit_enabled() -> bool {
    audit::AuditLogger::is_enabled()
}
