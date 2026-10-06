"""Safe inventory. Never expose headers, credentials, commands or skill paths."""

COMMANDS = {
    'es': [('help', 'Ver comandos y capacidades'), ('status', 'Estado de esta conexión'), ('provider', 'Proveedor y modelo de esta conexión'), ('tools', 'Permisos de herramientas'), ('skills', 'Skills instaladas'), ('mcp', 'Servidores MCP configurados')],
    'en': [('help', 'Show commands and capabilities'), ('status', 'Connection status'), ('provider', 'Provider and model for this connection'), ('tools', 'Tool permissions'), ('skills', 'Installed skills'), ('mcp', 'Configured MCP servers')],
}


def inventory():
    from storage.providers_db import list_providers
    from storage.mcp_servers_db import list_servers
    from core.inference.skill_actions import list_installed_skills
    return {
        'providers': [{'id': p['id'], 'name': p['display_name'], 'models': p.get('models') or p.get('available_models') or []} for p in list_providers() if p['is_enabled'] and p['provider_type'] != 'openai_codex'],
        'skills': [{'name': str(s.get('name', s.get('id', '')))[:120]} for s in list_installed_skills()][:100],
        'mcp': [{'name': str(s.get('display_name', ''))[:120], 'enabled': bool(s.get('is_enabled', False))} for s in list_servers()][:100],
    }


def command_reply(text: str, account: dict):
    if not text.startswith('/'):
        return None
    command = text.split()[0].split('@')[0].lower()
    spanish = account['locale'] == 'es'
    if command in ('/start', '/help'):
        return '\n'.join('/' + name + ' — ' + description for name, description in COMMANDS[account['locale']])
    if command == '/status':
        return 'Spartan conectado. Acceso privado autorizado.' if spanish else 'Spartan connected. Authorized private access.'
    if command == '/provider':
        return f"{account['provider_name']} · {account['model']}"
    if command == '/tools':
        return ('Esta primera versión permite conversación y consultas de inventario. Web, ejecución de skills, MCP, archivos locales y comandos todavía están bloqueados.' if spanish else 'This first version supports conversations and inventory queries. Web, skill execution, MCP, local files and commands are still blocked.')
    if command in ('/skills', '/mcp'):
        items = inventory()['skills' if command == '/skills' else 'mcp']
        return '\n'.join('- ' + i['name'] for i in items) or ('No hay elementos configurados.' if spanish else 'No items configured.')
    return 'Usa /help para ver los comandos.' if spanish else 'Use /help to see commands.'
