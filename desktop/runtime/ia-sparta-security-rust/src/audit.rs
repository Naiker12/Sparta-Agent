use chrono::Utc;
use serde::Serialize;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::Path;
use std::sync::Mutex;

static AUDIT_LOGGER: once_cell::sync::Lazy<Mutex<AuditLogger>> =
    once_cell::sync::Lazy::new(|| Mutex::new(AuditLogger::new()));

#[derive(Serialize, Clone)]
pub struct AuditEntry {
    pub timestamp: String,
    pub event_type: String,
    pub session_id: String,
    pub actor: String,
    pub action: String,
    pub resource: String,
    pub result: String,
    pub details: String,
    pub message_id: Option<String>,
}

pub struct AuditLogger {
    log_path: Option<String>,
    enabled: bool,
}

impl AuditLogger {
    pub fn new() -> Self {
        Self {
            log_path: None,
            enabled: false,
        }
    }

    pub fn configure(path: &str) {
        let mut logger = AUDIT_LOGGER.lock().unwrap();
        logger.log_path = Some(path.to_string());
        logger.enabled = true;

        if let Some(parent) = Path::new(path).parent() {
            let _ = fs::create_dir_all(parent);
        }
    }

    pub fn is_enabled() -> bool {
        AUDIT_LOGGER.lock().unwrap().enabled
    }

    pub fn log(entry: AuditEntry) {
        let mut logger = AUDIT_LOGGER.lock().unwrap();
        if !logger.enabled {
            return;
        }

        let line = match serde_json::to_string(&entry) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("[sparta-security] Audit serialization error: {}", e);
                return;
            }
        };

        if let Some(ref path) = logger.log_path {
            if let Ok(mut file) = OpenOptions::new()
                .create(true)
                .append(true)
                .open(path)
            {
                let _ = writeln!(file, "{}", line);
            }
        }
    }

    pub fn log_tool_call(session_id: &str, message_id: &str, tool_name: &str, input: &str, blocked: bool) {
        let entry = AuditEntry {
            timestamp: Utc::now().to_rfc3339(),
            event_type: "tool_call".into(),
            session_id: session_id.to_string(),
            actor: "agent".into(),
            action: tool_name.to_string(),
            resource: "tool".into(),
            result: if blocked { "blocked".into() } else { "allowed".into() },
            details: input.chars().take(500).collect(),
            message_id: Some(message_id.to_string()),
        };
        Self::log(entry);
    }

    pub fn log_message(session_id: &str, message_id: &str, direction: &str, action: &str, result: &str, details: &str) {
        let entry = AuditEntry {
            timestamp: Utc::now().to_rfc3339(),
            event_type: format!("message_{}", direction),
            session_id: session_id.to_string(),
            actor: direction.to_string(),
            action: action.to_string(),
            resource: "ipc".into(),
            result: result.to_string(),
            details: details.to_string(),
            message_id: Some(message_id.to_string()),
        };
        Self::log(entry);
    }

    pub fn log_security_event(event_type: &str, session_id: &str, action: &str, details: &str) {
        let entry = AuditEntry {
            timestamp: Utc::now().to_rfc3339(),
            event_type: event_type.to_string(),
            session_id: session_id.to_string(),
            actor: "system".into(),
            action: action.to_string(),
            resource: "security".into(),
            result: "alert".into(),
            details: details.to_string(),
            message_id: None,
        };
        Self::log(entry);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn test_audit_log_creates_file() {
        let test_path = "target/test_audit.log";
        let _ = fs::remove_file(test_path);

        AuditLogger::configure(test_path);
        AuditLogger::log_tool_call("sess_1", "msg_1", "web_search", "test query", false);

        assert!(Path::new(test_path).exists());
        let _ = fs::remove_file(test_path);
    }
}
