// DEPRECATED — La lógica de sanitización se portó a Python
// (`python/sparta_ai/tools/file_tools.py:_get_safe_path` y `_MAX_CONTENT_SIZE`).
// Las funciones se mantienen para referencia histórica y para que los tests
// de Rust (cargo test) sigan pasando, pero YA NO se invocan desde Electron.
// La única funcionalidad de Rust que sigue activa y aporta valor es la
// auditoría (`audit.rs`) y el rate limiter singleton (`guard.rs`).

use regex::Regex;
use serde_json::{json, Value};
use std::collections::HashSet;

const ALLOWED_WEB_SEARCH_DOMAINS: &[&str] = &[];
const BLOCKED_FILE_PATTERNS: &[&str] = &[
    r"\.env$",
    r"\.pem$",
    r"\.key$",
    r"\.cert$",
    r"sparta-vault\.json$",
    r"node_modules[/\\]",
    r"\.git[/\\]",
    r"\.venv[/\\]",
];

const BLOCKED_PATH_COMPONENTS: &[&str] = &[
    "..",
    "~",
    "$HOME",
    "%USERPROFILE%",
];

pub struct SanitizedToolCall {
    pub safe: bool,
    pub blocked_reason: Option<String>,
    pub sanitized_input: Option<Value>,
}

fn contains_blocked_pattern(path: &str) -> Option<String> {
    let lower = path.to_lowercase();
    for pattern in BLOCKED_FILE_PATTERNS {
        if let Ok(re) = Regex::new(pattern) {
            if re.is_match(&lower) {
                return Some(format!("Path matches blocked pattern: {}", pattern));
            }
        }
    }
    for component in BLOCKED_PATH_COMPONENTS {
        if lower.contains(component) {
            return Some(format!("Path contains blocked component: {}", component));
        }
    }
    None
}

/// DEPRECATED — La sanitización de tool-calls se implementa ahora en
/// Python (`file_tools.py` → `_get_safe_path()`) para no mantener dos
/// sanitizadores sincronizados en dos lenguajes.  El módulo Rust se
/// mantiene únicamente para auditoría persistente (`audit.rs`).
///
/// Este código se conserva para referencia pero no se invoca desde
/// ningún punto del flujo activo.
#[deprecated(note = "Reemplazado por _get_safe_path() en Python")]
pub fn sanitize_file_tool_call(tool_name: &str, input: &Value) -> SanitizedToolCall {
    let path = input
        .get("path")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    if let Some(reason) = contains_blocked_pattern(path) {
        return SanitizedToolCall {
            safe: false,
            blocked_reason: Some(reason),
            sanitized_input: None,
        };
    }

    let max_path_len = 512;
    if path.len() > max_path_len {
        return SanitizedToolCall {
            safe: false,
            blocked_reason: Some(format!("Path exceeds max length of {}", max_path_len)),
            sanitized_input: None,
        };
    }

    let max_content_size = 5 * 1024 * 1024; // 5MB
    if let Some(content) = input.get("content").and_then(|v| v.as_str()) {
        if content.len() > max_content_size {
            return SanitizedToolCall {
                safe: false,
                blocked_reason: Some(format!("Content exceeds 5MB limit ({} bytes)", content.len())),
                sanitized_input: None,
            };
        }
    }

    SanitizedToolCall {
        safe: true,
        blocked_reason: None,
        sanitized_input: None,
    }
}

pub fn sanitize_web_search_call(input: &Value) -> SanitizedToolCall {
    let query = input.get("query").and_then(|v| v.as_str()).unwrap_or("");

    if query.len() > 500 {
        return SanitizedToolCall {
            safe: false,
            blocked_reason: Some("Search query exceeds 500 characters".into()),
            sanitized_input: None,
        };
    }

    let count = input.get("count").and_then(|v| v.as_u64()).unwrap_or(5);
    if count > 50 {
        return SanitizedToolCall {
            safe: false,
            blocked_reason: Some("Search count exceeds maximum of 50".into()),
            sanitized_input: Some(json!({
                "count": 50,
                "query": query,
            })),
        };
    }

    SanitizedToolCall {
        safe: true,
        blocked_reason: None,
        sanitized_input: None,
    }
}

pub fn sanitize_memory_tool_call(tool_name: &str, input: &Value) -> SanitizedToolCall {
    if let Some(content) = input.get("content").and_then(|v| v.as_str()) {
        if content.len() > 50_000 {
            return SanitizedToolCall {
                safe: false,
                blocked_reason: Some("Memory content exceeds 50KB".into()),
                sanitized_input: None,
            };
        }
    }

    if let Some(query) = input.get("query").and_then(|v| v.as_str()) {
        if query.len() > 2000 {
            return SanitizedToolCall {
                safe: false,
                blocked_reason: Some("Memory query exceeds 2000 characters".into()),
                sanitized_input: None,
            };
        }
    }

    if let Some(k) = input.get("k").and_then(|v| v.as_u64()) {
        if k > 100 {
            return SanitizedToolCall {
                safe: false,
                blocked_reason: Some("Memory result count exceeds 100".into()),
                sanitized_input: Some(json!({"k": 100})),
            };
        }
    }

    SanitizedToolCall {
        safe: true,
        blocked_reason: None,
        sanitized_input: None,
    }
}

/// DEPRECATED — ver `sanitize_file_tool_call`.
#[deprecated(note = "Reemplazado por sanitización en Python")]
pub fn sanitize_tool_call(tool_name: &str, input: &Value) -> SanitizedToolCall {
    let dangerous_tools: HashSet<&str> = [
        "exec_command", "shell_exec", "run_terminal",
        "execute_bash", "execute_powershell",
    ]
    .into();

    if dangerous_tools.contains(tool_name) {
        return SanitizedToolCall {
            safe: false,
            blocked_reason: Some(format!("Tool '{}' is blocked for security reasons", tool_name)),
            sanitized_input: None,
        };
    }

    match tool_name {
        n if n.starts_with("delegate_") => {
            if let Some(task) = input.get("task").and_then(|v| v.as_str()) {
                if task.len() > 10_000 {
                    return SanitizedToolCall {
                        safe: false,
                        blocked_reason: Some("Delegated task exceeds 10KB".into()),
                        sanitized_input: None,
                    };
                }
            }
            SanitizedToolCall { safe: true, blocked_reason: None, sanitized_input: None }
        }
        "read_file" | "write_file" | "read_file_tool" | "write_file_tool" => {
            sanitize_file_tool_call(tool_name, input)
        }
        "web_search" | "web_search_tool" => {
            sanitize_web_search_call(input)
        }
        "read_memory" | "read_memory_tool" | "write_memory" | "write_memory_tool" => {
            sanitize_memory_tool_call(tool_name, input)
        }
        _ => SanitizedToolCall { safe: true, blocked_reason: None, sanitized_input: None },
    }
}

pub fn sanitize_tool_calls(tool_calls: &Value) -> Vec<SanitizedToolCall> {
    let calls = match tool_calls.as_array() {
        Some(c) => c,
        None => return vec![],
    };

    calls.iter().map(|call| {
        let name = call.get("name").and_then(|v| v.as_str()).unwrap_or("unknown");
        let input = call.get("input").or_else(|| call.get("args")).unwrap_or(&Value::Null);
        sanitize_tool_call(name, input)
    }).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_sanitize_file_tool_blocked_dotenv() {
        let result = sanitize_file_tool_call("read_file", &json!({"path": "/home/user/.env"}));
        assert!(!result.safe);
        assert!(result.blocked_reason.unwrap().contains(".env"));
    }

    #[test]
    fn test_sanitize_file_tool_blocked_path_traversal() {
        let result = sanitize_file_tool_call("read_file", &json!({"path": "/safe/../../etc/passwd"}));
        assert!(!result.safe);
    }

    #[test]
    fn test_sanitize_file_tool_blocked_vault() {
        let result = sanitize_file_tool_call("read_file", &json!({"path": "sparta-vault.json"}));
        assert!(!result.safe);
    }

    #[test]
    fn test_sanitize_web_search_oversized_query() {
        let long_query = "a".repeat(600);
        let result = sanitize_web_search_call(&json!({"query": long_query, "count": 5}));
        assert!(!result.safe);
    }

    #[test]
    fn test_sanitize_memory_oversized_content() {
        let large_content = "x".repeat(100_000);
        let result = sanitize_memory_tool_call("write_memory", &json!({"content": large_content}));
        assert!(!result.safe);
    }
}
