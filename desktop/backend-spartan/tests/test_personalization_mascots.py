import pytest
from pydantic import ValidationError
from routes.settings_pkg.schemas import PersonalizationProfile, PersonalizationPayload


def test_selected_mascot_is_saved_and_preserved_on_partial_profile_update(monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from auth.authentication import get_current_subject
    from routes import settings

    store = {}
    monkeypatch.setattr('storage.studio_db.get_app_setting', lambda key, default=None: store.get(key, default))
    monkeypatch.setattr('storage.studio_db.upsert_app_settings', lambda values: store.update(values))
    app = FastAPI()
    app.dependency_overrides[get_current_subject] = lambda: 'unsloth'
    app.include_router(settings.router, prefix='/api/settings')
    with TestClient(app) as client:
        saved = client.put('/api/settings/personalization', json={'profile': {'avatarDataUrl': 'mascot:cat'}})
        assert saved.status_code == 200
        assert client.get('/api/settings/personalization').json()['profile']['avatarDataUrl'] == 'mascot:cat'
        updated = client.put('/api/settings/personalization', json={'profile': {'nickname': 'Geo'}})
        assert updated.status_code == 200
        profile = client.get('/api/settings/personalization').json()['profile']
        assert profile['avatarDataUrl'] == 'mascot:cat'
        assert profile['nickname'] == 'Geo'


@pytest.mark.parametrize('character', ['fox', 'cat', 'sloth', 'astronaut', 'tv', 'fox-ink', 'fox-pixel'])
def test_bundled_mascot_profile_roundtrips(character):
    payload = PersonalizationPayload.model_validate({'profile': {'avatarDataUrl': 'mascot:' + character}})
    assert payload.model_dump()['profile']['avatarDataUrl'] == 'mascot:' + character


@pytest.mark.parametrize('value', ['mascot:missing', 'mascot:../../secret', 'mascot:fox?url=https://example.com', 'mascot:https://example.com', 'mascot:FOX'])
def test_mascot_tokens_cannot_select_paths_or_remote_resources(value):
    with pytest.raises(ValidationError):
        PersonalizationProfile.model_validate({'avatarDataUrl': value})
