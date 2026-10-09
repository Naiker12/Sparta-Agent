import pytest
from core.channels import catalog


@pytest.mark.parametrize('locale', ['es', 'en'])
def test_permissions_reads_the_same_authoritative_inventory_as_tools(monkeypatch, locale):
    observed = []
    account = {'id': 'account', 'locale': locale}
    def summary(value, user_id):
        observed.append((value, user_id))
        return 'current permissions'
    monkeypatch.setattr(catalog, 'capability_summary', summary)
    assert catalog.command_reply('/permissions', account, user_id='123') == 'current permissions'
    assert observed == [(account, '123')]
