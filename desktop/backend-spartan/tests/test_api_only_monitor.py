"""The API monitor must not inspect the retired local admission queue."""
from routes.inference import _monitor_queue_state


def test_api_only_monitor_has_no_local_queue():
    assert _monitor_queue_state() is None
