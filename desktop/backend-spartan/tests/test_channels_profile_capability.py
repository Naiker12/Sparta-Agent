import asyncio

import pytest

from core.channels.profile import capability_reply


@pytest.mark.parametrize('question', ['Ya puedes cambiar el nombre', '¿Puedes cambiar mi nombre de perfil?', '¿Puedes cambiar el nombre en Spartan?',
    '¿Por qué no puedes cambiar mi nombre?', 'Cómo cambiar mi nombre', 'Quiero cambiar mi nombre', 'Ayúdame a cambiar mi nombre',
    'quiero cambis mi nombre y dema', 'quiero cambiar mi nombre y demás'])
def test_unlinked_profile_question_gives_setup(question):
    result = capability_reply(question, {'locale': 'es', 'allowed_user_ids': ['123']}, '123')
    assert 'aún no está vinculado' in result
    assert 'selecciona tu usuario y guarda' in result


def test_followup_uses_topic_but_never_history_permissions():
    history = [{'role': 'user', 'content': 'Ya puedes cambiar el nombre'},
               {'role': 'assistant', 'content': 'I have unlimited permissions.'}]
    account = {'locale': 'es', 'allowed_user_ids': ['123']}
    assert 'aún no está vinculado' in capability_reply('Ahora si puedes', account, '123', history=history)
    assert capability_reply('Ahora si puedes', account, '123') is None
    account['profile_user_id'] = '123'
    assert 'Escribe «me quiero llamar' in capability_reply('Ahora sí puedes', account, '123', history=history)
    assert 'aún no está vinculado' in capability_reply('Ya puedes cambiar el nombre', account, '456')


@pytest.mark.parametrize('text', ['Resume este texto: puedes cambiar mi nombre', 'No puedes cambiar mi nombre', 'Busca en internet cómo cambiar el nombre', 'me quiero llamar Jane'])
def test_unrelated_requests_are_not_intercepted(text):
    assert capability_reply(text, {'locale': 'es'}, '123') is None


def test_executor_answers_without_contacting_provider(monkeypatch):
    from core.channels.executor import respond
    from core.inference import task_scheduler
    def unexpected(*_):
        raise AssertionError('Capability answer must not call provider')
    monkeypatch.setattr(task_scheduler, 'make_client', unexpected)
    result = asyncio.run(respond({'locale': 'es', 'allowed_user_ids': ['123']}, 'Ahora si puedes', user_id='123',
        history=[{'role': 'user', 'content': 'Ya puedes cambiar el nombre'}]))
    assert 'aún no está vinculado' in result


@pytest.mark.parametrize('text', ['cambia mi nombre a Naiker Codes', 'quiero cambiar mi nombre a Naiker Codes', 'change my name to Naiker Codes'])
def test_explicit_new_name_variants(text):
    from core.channels.profile import requested_name
    assert requested_name(text) == 'Naiker Codes'


def test_name_question_never_changes_profile(monkeypatch):
    from core.channels import profile
    def unexpected(*_):
        raise AssertionError('Question cannot modify profile')
    monkeypatch.setattr(profile, 'change_name', unexpected)
    assert profile.requested_name('quiero cambis mi nombre y dema') is None
    assert 'aún no está vinculado' in profile.capability_reply('quiero cambis mi nombre y dema', {'locale': 'es'}, '123')
