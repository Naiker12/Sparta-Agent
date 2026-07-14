"""Stream state management for LangGraph event processing."""
from sparta_ai.streaming.repetition_guard import RepetitionGuard
from sparta_ai.streaming.think_scrubber import StreamingThinkScrubber


def _new_stream_state(initial_state: dict) -> dict:
    return {
        "thinking_active": False,
        "last_detected_skill": None,
        "active_skill_ids": initial_state.get("active_skills", []),
        "visible_chars": 0,
        "reasoning_chars": 0,
        "_empty_retries": 0,
        "_reasoning_extracted": False,
        "_stream_completed": False,
        "_emitted_text": "",
        "_skip_mode": False,
        "_skip_pending": "",
        "_pending_file_path": "",
        "_pending_terminal_command": "",
        "_pending_terminal_proc": {},
    }


def _reset_stream_state(stream_state: dict) -> None:
    stream_state["visible_chars"] = 0
    stream_state["reasoning_chars"] = 0
    stream_state["thinking_active"] = False
    stream_state["_reasoning_extracted"] = False
    stream_state["_emitted_text"] = ""
    stream_state["_skip_mode"] = False
    stream_state["_skip_pending"] = ""
    stream_state["_pending_file_path"] = ""
    stream_state["_pending_terminal_command"] = ""
    stream_state["_pending_terminal_proc"] = {}
    stream_state["last_detected_skill"] = None
    stream_state["_rep_guard"] = RepetitionGuard()
    stream_state["_scrubber"] = StreamingThinkScrubber()
    stream_state["_chunk_seq"] = 0
    stream_state["reasoning_tokens"] = 0
    stream_state["_plan_seen"] = False
