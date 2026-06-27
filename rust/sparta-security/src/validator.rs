use serde_json::Value;
use std::collections::HashSet;

const ALLOWED_METHODS: &[&str] = &[
    "chat.stream",
    "chat.abort",
    "keymanager.set",
    "keymanager.clear",
    "shutdown",
];

const MAX_ID_LENGTH: usize = 128;
const MAX_SESSION_ID_LENGTH: usize = 64;
const MAX_MESSAGE_ID_LENGTH: usize = 64;

pub struct ValidationResult {
    pub valid: bool,
    pub error: Option<String>,
}

pub enum MessageDirection {
    ElectronToPython,
    PythonToElectron,
}

pub fn validate_request(msg: &Value) -> ValidationResult {
    if !msg.is_object() {
        return ValidationResult {
            valid: false,
            error: Some("Message must be a JSON object".into()),
        };
    }

    let id = msg.get("id");
    match id {
        Some(Value::String(s)) => {
            if s.is_empty() {
                return ValidationResult {
                    valid: false,
                    error: Some("'id' must not be empty".into()),
                };
            }
            if s.len() > MAX_ID_LENGTH {
                return ValidationResult {
                    valid: false,
                    error: Some(format!("'id' exceeds max length of {}", MAX_ID_LENGTH)),
                };
            }
            if !s.chars().all(|c| c.is_alphanumeric() || c == ':' || c == '_' || c == '-') {
                return ValidationResult {
                    valid: false,
                    error: Some("'id' contains invalid characters".into()),
                };
            }
        }
        Some(_) => {
            return ValidationResult {
                valid: false,
                error: Some("'id' must be a string".into()),
            };
        }
        None => {
            return ValidationResult {
                valid: false,
                error: Some("Missing required field: 'id'".into()),
            };
        }
    }

    let method = msg.get("method");
    match method {
        Some(Value::String(s)) => {
            if !ALLOWED_METHODS.contains(&s.as_str()) {
                return ValidationResult {
                    valid: false,
                    error: Some(format!("Unknown method: '{}'", s)),
                };
            }
        }
        Some(_) => {
            return ValidationResult {
                valid: false,
                error: Some("'method' must be a string".into()),
            };
        }
        None => {
            return ValidationResult {
                valid: false,
                error: Some("Missing required field: 'method'".into()),
            };
        }
    }

    if let Some(params) = msg.get("params") {
        if !params.is_object() && !params.is_null() {
            return ValidationResult {
                valid: false,
                error: Some("'params' must be an object or null".into()),
            };
        }

        if let Some(session_id) = params.get("session_id").and_then(|v| v.as_str()) {
            if session_id.len() > MAX_SESSION_ID_LENGTH {
                return ValidationResult {
                    valid: false,
                    error: Some(format!("'session_id' exceeds max length of {}", MAX_SESSION_ID_LENGTH)),
                };
            }
        }

        if let Some(message_id) = params.get("message_id").and_then(|v| v.as_str()) {
            if message_id.len() > MAX_MESSAGE_ID_LENGTH {
                return ValidationResult {
                    valid: false,
                    error: Some(format!("'message_id' exceeds max length of {}", MAX_MESSAGE_ID_LENGTH)),
                };
            }
        }

        if let Some(messages) = params.get("messages").and_then(|v| v.as_array()) {
            if messages.len() > 200 {
                return ValidationResult {
                    valid: false,
                    error: Some("'messages' array exceeds max length of 200".into()),
                };
            }
            let allowed_roles: HashSet<&str> = ["user", "assistant", "system"].into();
            for (i, msg_item) in messages.iter().enumerate() {
                if let Some(role) = msg_item.get("role").and_then(|v| v.as_str()) {
                    if !allowed_roles.contains(role) {
                        return ValidationResult {
                            valid: false,
                            error: Some(format!("messages[{}] invalid role: '{}'", i, role)),
                        };
                    }
                }
                if let Some(content) = msg_item.get("content").and_then(|v| v.as_str()) {
                    if content.len() > 100_000 {
                        return ValidationResult {
                            valid: false,
                            error: Some(format!("messages[{}] 'content' exceeds 100KB", i)),
                        };
                    }
                }
            }
        }
    }

    ValidationResult {
        valid: true,
        error: None,
    }
}

pub fn validate_response(msg: &Value) -> ValidationResult {
    if !msg.is_object() {
        return ValidationResult {
            valid: false,
            error: Some("Response must be a JSON object".into()),
        };
    }

    if msg.get("id").and_then(|v| v.as_str()).is_none() {
        return ValidationResult {
            valid: false,
            error: Some("Response missing 'id' field".into()),
        };
    }

    let allowed_events: HashSet<&str> = [
        "thinking_start", "thinking_token", "thinking_end",
        "stream_token", "stream_end",
        "tool_start", "tool_end",
        "subagent_start", "subagent_end",
        "usage", "error",
        "keymanager.set", "keymanager.clear", "shutdown",
    ]
    .into();

    if let Some(event) = msg.get("event").and_then(|v| v.as_str()) {
        if !allowed_events.contains(event) {
            return ValidationResult {
                valid: false,
                error: Some(format!("Unknown event type: '{}'", event)),
            };
        }

        if let Some(data) = msg.get("data") {
            if let Some(token) = data.get("token").and_then(|v| v.as_str()) {
                if token.len() > 50_000 {
                    return ValidationResult {
                        valid: false,
                        error: Some("'token' data exceeds 50KB".into()),
                    };
                }
            }
        }
    }

    ValidationResult {
        valid: true,
        error: None,
    }
}

pub fn validate_raw(line: &str) -> ValidationResult {
    if line.len() > 1_000_000 {
        return ValidationResult {
            valid: false,
            error: Some("Message exceeds 1MB size limit".into()),
        };
    }

    match serde_json::from_str::<Value>(line) {
        Ok(val) => {
            let has_method = val.get("method").is_some();
            let has_event = val.get("event").is_some();

            if has_method {
                validate_request(&val)
            } else if has_event {
                validate_response(&val)
            } else {
                ValidationResult {
                    valid: false,
                    error: Some("Message must have either 'method' or 'event' field".into()),
                }
            }
        }
        Err(e) => ValidationResult {
            valid: false,
            error: Some(format!("Invalid JSON: {}", e)),
        },
    }
}
