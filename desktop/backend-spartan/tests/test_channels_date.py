from datetime import datetime

from core.channels.intents import current_date_reply


def test_spanish_date_and_weekday_from_clock():
    reply = current_date_reply('Que dia es hoy ?', 'es', now=datetime(2026, 10, 6))
    assert 'martes, 6 de octubre de 2026' in reply


def test_english_date_and_weekday():
    assert 'Wednesday, 2026-10-07' in current_date_reply("What is today's date?", 'en', now=datetime(2026, 10, 7))


def test_does_not_intercept_research_or_document_requests():
    assert current_date_reply('Busca en internet qué día es hoy', 'es') is None
    assert current_date_reply('Resume: que dia es hoy', 'es') is None
