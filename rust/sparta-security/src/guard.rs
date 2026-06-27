use std::collections::HashMap;
use std::time::{Duration, Instant};

const DEFAULT_RATE_LIMIT_WINDOW_SECS: u64 = 60;
const DEFAULT_RATE_LIMIT_MAX_REQUESTS: u32 = 30;
const DEFAULT_MAX_TOOL_CALLS_PER_TURN: u32 = 20;
const DEFAULT_MAX_MESSAGE_SIZE: usize = 1_000_000; // 1MB
const DEFAULT_MAX_PROVIDER_KEY_LENGTH: usize = 200;

pub struct SecurityGuard {
    rate_limiter: RateLimiter,
    max_tool_calls_per_turn: u32,
    max_message_size: usize,
    max_provider_key_length: usize,
}

impl SecurityGuard {
    pub fn new() -> Self {
        Self {
            rate_limiter: RateLimiter::new(
                DEFAULT_RATE_LIMIT_WINDOW_SECS,
                DEFAULT_RATE_LIMIT_MAX_REQUESTS,
            ),
            max_tool_calls_per_turn: DEFAULT_MAX_TOOL_CALLS_PER_TURN,
            max_message_size: DEFAULT_MAX_MESSAGE_SIZE,
            max_provider_key_length: DEFAULT_MAX_PROVIDER_KEY_LENGTH,
        }
    }

    pub fn check_rate_limit(&mut self, session_id: &str) -> GuardResult {
        self.rate_limiter.check(session_id)
    }

    pub fn validate_tool_call_count(&self, count: u32) -> GuardResult {
        if count > self.max_tool_calls_per_turn {
            return GuardResult::Blocked(format!(
                "Tool call count {} exceeds limit of {} per turn",
                count, self.max_tool_calls_per_turn
            ));
        }
        GuardResult::Allowed
    }

    pub fn validate_message_size(&self, size: usize) -> GuardResult {
        if size > self.max_message_size {
            return GuardResult::Blocked(format!(
                "Message size {} exceeds limit of {} bytes",
                size, self.max_message_size
            ));
        }
        GuardResult::Allowed
    }

    pub fn validate_provider_key(&self, key: &str) -> GuardResult {
        if key.len() > self.max_provider_key_length {
            return GuardResult::Blocked("Provider key exceeds maximum length".into());
        }
        let allowed_chars = key.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.');
        if !allowed_chars {
            return GuardResult::Blocked("Provider key contains invalid characters".into());
        }
        GuardResult::Allowed
    }
}

pub enum GuardResult {
    Allowed,
    Blocked(String),
}

struct RateLimiter {
    window_secs: u64,
    max_requests: u32,
    sessions: HashMap<String, Vec<Instant>>,
}

impl RateLimiter {
    fn new(window_secs: u64, max_requests: u32) -> Self {
        Self {
            window_secs,
            max_requests,
            sessions: HashMap::new(),
        }
    }

    fn check(&mut self, session_id: &str) -> GuardResult {
        let now = Instant::now();
        let window = Duration::from_secs(self.window_secs);

        let timestamps = self.sessions.entry(session_id.to_string()).or_default();

        timestamps.retain(|t| now.duration_since(*t) < window);

        if timestamps.len() as u32 >= self.max_requests {
            return GuardResult::Blocked(format!(
                "Rate limit exceeded: {} requests in {}s",
                self.max_requests, self.window_secs
            ));
        }

        timestamps.push(now);
        GuardResult::Allowed
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rate_limit_allows_first_request() {
        let mut guard = SecurityGuard::new();
        let result = guard.check_rate_limit("session_1");
        assert!(matches!(result, GuardResult::Allowed));
    }

    #[test]
    fn test_validate_tool_call_count() {
        let guard = SecurityGuard::new();
        assert!(matches!(guard.validate_tool_call_count(5), GuardResult::Allowed));
        assert!(matches!(guard.validate_tool_call_count(50), GuardResult::Blocked(_)));
    }

    #[test]
    fn test_validate_provider_key() {
        let guard = SecurityGuard::new();
        assert!(matches!(guard.validate_provider_key("sk-test-123"), GuardResult::Allowed));
        assert!(matches!(guard.validate_provider_key(&"x".repeat(300)), GuardResult::Blocked(_)));
    }
}
