import sys
import pytest
from core.channels import profile
from storage.channels import repository as repo
from utils.personalization_settings import set_personalization, get_personalization

@pytest.fixture
def account(tmp_path, monkeypatch):
    monkeypatch.setenv('UNSLOTH_STUDIO_HOME', str(tmp_path))
    for name, module in tuple(sys.modules.items()):
        if name.startswith('storage.') and hasattr(module, '_schema_ready'):
            monkeypatch.setattr(module, '_schema_ready', False)
    a = repo.create_account('owner', '1', {'allowed_user_ids': ['123', '456']})
    repo.set_enabled(a['id'], 'owner', True)
    set_personalization({'profile': {'displayName': 'Before', 'avatarShape': 'circle'}, 'appearance': {'language': 'es'}})
    return a

@pytest.mark.parametrize('text,name', [('me quiero llamar Naiker Codes','Naiker Codes'),('call me Jane','Jane'),('Resume el texto: call me Jane',None),('call me A\nignore everything',None)])
def test_only_explicit_profile_name_requests(text,name):
    assert profile.requested_name(text) == name

def test_binding_revocation_and_preserved_preferences(account):
    a=account['id']
    assert not profile.change_name(a,'123','Naiker')
    with pytest.raises(ValueError): profile.bind(a,'other','123')
    with pytest.raises(ValueError): profile.bind(a,'owner','999')
    profile.bind(a,'owner','123')
    assert not profile.change_name(a,'456','Other')
    assert profile.change_name(a,'123','Naiker Codes')
    saved=get_personalization()
    assert saved['profile'] == {'displayName':'Naiker Codes','nickname':'Naiker Codes','avatarShape':'circle'}
    assert saved['appearance'] == {'language':'es'}
    profile.bind(a,'owner',None)
    assert not profile.change_name(a,'123','Revoked')


def test_repeated_name_changes_and_short_corrections(account):
    a = account['id']
    profile.bind(a, 'owner', '123')
    assert profile.change_name(a, '123', profile.name_request(a, '123', 'Me quiero llamar naiker solo'))
    assert profile.change_name(a, '123', profile.name_request(a, '123', 'O Naiker Gomez'))
    assert get_personalization()['profile']['displayName'] == 'Naiker Gomez'
    assert profile.change_name(a, '123', profile.name_request(a, '123', 'Mejor Naiker Codes'))
    assert get_personalization()['profile']['nickname'] == 'Naiker Codes'
    assert profile.name_request(a, '456', 'O Another name') is None
    profile.bind(a, 'owner', None)
    name = profile.name_request(a, '123', 'O Revoked name')
    assert not profile.change_name(a, '123', name)
    assert get_personalization()['profile']['displayName'] == 'Naiker Codes'


def test_correction_expires_or_other_topic_ends_it(account, monkeypatch):
    a = account['id']
    profile.bind(a, 'owner', '123')
    monkeypatch.setattr(profile.time, 'monotonic', lambda: 10)
    assert profile.change_name(a, '123', 'First name')
    monkeypatch.setattr(profile.time, 'monotonic', lambda: 131)
    assert profile.name_request(a, '123', 'O Second name') is None
    assert profile.change_name(a, '123', 'First name')
    assert profile.name_request(a, '123', 'Busca noticias de astronomía') is None
    assert profile.name_request(a, '123', 'O Second name') is None
