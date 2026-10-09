import asyncio

import pytest

from core.channels import controls


@pytest.fixture(autouse=True)
def clean_controls():
    controls._pending.clear()
    yield
    controls._pending.clear()


def account():
    return {'id': 'bot', 'enabled': True, 'allowed_user_ids': ['123'], 'locale': 'es'}


def update(token, user=123):
    return {'update_id': 9, 'callback_query': {'id': 'query', 'data': token,
        'from': {'id': user}, 'message': {'chat': {'id': user, 'type': 'private'}}}}


def test_bound_single_use_control():
    token = controls.issue('bot', '123', 123, '/cancel', cancel_for=4)
    assert len(token.encode()) <= 64
    assert controls.consume(account(), update(token, 456)) is None
    assert controls.consume({**account(), 'id': 'other'}, update(token)) is None
    result = controls.consume(account(), update(token))
    assert result['cancel_for'] == 4
    assert result['text'] == '/cancel'
    assert controls.consume(account(), update(token)) is None


@pytest.mark.parametrize('change', [{'enabled': False}, {'allowed_user_ids': []}])
def test_revocation_checked_at_click(change):
    token = controls.issue('bot', '123', 123, '/project off')
    assert controls.consume({**account(), **change}, update(token)) is None


def test_expiry_and_explicit_revocation(monkeypatch):
    monkeypatch.setattr(controls.time, 'monotonic', lambda: 10)
    token = controls.issue('bot', '123', 123, '/project off')
    monkeypatch.setattr(controls.time, 'monotonic', lambda: 611)
    assert controls.consume(account(), update(token)) is None
    controls.revoke([token])
    assert token not in controls._pending


def test_receive_persists_control_and_acknowledges(monkeypatch):
    from core.channels import requests
    token = controls.issue('bot', '123', 123, '/cancel', cancel_for=4)
    calls, saved = [], []
    class Transport:
        async def call(self, method, **kwargs):
            calls.append((method, kwargs))
            return [update(token)] if method == 'getUpdates' else True
    monkeypatch.setattr(requests.repo, 'offset', lambda _: 0)
    monkeypatch.setattr(requests.repo, 'get_account', lambda _: account())
    monkeypatch.setattr(requests.pairing, 'capture', lambda *_: None)
    monkeypatch.setattr(requests.repo, 'ingest', lambda _, updates, normalize: saved.extend(normalize(item) for item in updates))
    result = asyncio.run(requests.receive(Transport(), 'bot'))
    assert result[0][1] == saved[0]
    assert calls[0][1]['allowed_updates'] == ['message', 'callback_query']
    assert calls[1][0] == 'answerCallbackQuery'


def test_keyboard_only_authorized_projects(monkeypatch):
    from storage.channels import projects
    monkeypatch.setattr(projects, 'available', lambda *_: [{'id': 'p', 'name': 'Mi proyecto'}])
    keyboard = controls.project_keyboard(account(), {'user_id': '123', 'chat_id': 123})
    button = keyboard['inline_keyboard'][0][0]
    assert button['text'] == 'Mi proyecto'
    assert controls.consume(account(), update(button['callback_data']))['text'] == '/project p'


def test_cancel_button_interrupts_provider_and_is_removed(monkeypatch):
    from core.channels import requests
    monkeypatch.setattr(requests.repo, 'offset', lambda _: 0)
    monkeypatch.setattr(requests.repo, 'get_account', lambda _: account())
    monkeypatch.setattr(requests.repo, 'take_cancel', lambda *_: False)
    monkeypatch.setattr(requests.repo, 'consume_control', lambda *_: True)
    monkeypatch.setattr(requests.pairing, 'capture', lambda *_: None)
    monkeypatch.setattr(requests.repo, 'ingest', lambda _, updates, normalize: [normalize(item) for item in updates])
    async def scenario():
        stopped = asyncio.Event()
        class Transport:
            token = None
            removed = False
            async def call(self, method, **kwargs):
                if method == 'getUpdates':
                    if self.token:
                        value, self.token = self.token, None
                        return [update(value)]
                    return []
                return True
            async def action(self, *_):
                pass
            async def send_controls(self, chat_id, text, markup):
                self.token = markup['inline_keyboard'][0][0]['callback_data']
                return 10
            async def clear_controls(self, chat_id, identifier, **kwargs):
                assert chat_id == 123 and identifier == 10
                self.removed = True
        async def provider():
            try:
                await asyncio.Future()
            finally:
                stopped.set()
        transport = Transport()
        with pytest.raises(requests.RequestCancelled):
            await asyncio.wait_for(requests.respond_with_progress(transport, account(), 4,
                {'user_id': '123', 'chat_id': 123, 'text': 'hello', 'media': None}, provider), 4)
        assert stopped.is_set() and transport.removed
        assert not controls._pending
    asyncio.run(scenario())
