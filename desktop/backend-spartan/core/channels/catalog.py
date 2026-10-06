"""Safe inventory. Never expose headers, credentials, commands or skill paths."""

COMMANDS = {
    'es': [('help', 'Ver comandos y capacidades'), ('status', 'Estado de esta conexión'), ('provider', 'Proveedor y modelo de esta conexión'), ('usage', 'Mi consumo y límite local de consultas'), ('tools', 'Permisos de herramientas'), ('skills', 'Skills instaladas'), ('mcp', 'Servidores MCP configurados'), ('cancel', 'Cancelar mi consulta en curso'), ('reset', 'Reiniciar esta conversación')],
    'en': [('help', 'Show commands and capabilities'), ('status', 'Connection status'), ('provider', 'Provider and model for this connection'), ('usage', 'My usage and local request limit'), ('tools', 'Tool permissions'), ('skills', 'Installed skills'), ('mcp', 'Configured MCP servers'), ('cancel', 'Cancel my active request'), ('reset', 'Reset this conversation')],
}
COMMANDS['es'].append(('search', 'Buscar un tema público en internet'))
COMMANDS['en'].append(('search', 'Search a public topic on the internet'))


def inventory():
    from storage.providers_db import list_providers
    from storage.mcp_servers_db import list_servers
    from core.inference.skill_actions import list_installed_skills
    return {
        'providers': [{'id': p['id'], 'name': p['display_name'], 'models': p.get('models') or p.get('available_models') or []} for p in list_providers() if p['is_enabled'] and p['provider_type'] != 'openai_codex'],
        'skills': [{'name': str(s.get('name', s.get('id', '')))[:120]} for s in list_installed_skills()][:100],
        'mcp': [{'name': str(s.get('display_name', ''))[:120], 'enabled': bool(s.get('is_enabled', False))} for s in list_servers()][:100],
    }


def command_reply(text: str, account: dict, *, user_id=None):
    if not text.startswith('/'):
        return None
    command = text.split()[0].split('@')[0].lower()
    spanish = account['locale'] == 'es'
    if command in ('/search', '/read'):
        return None
    if command in ('/start', '/help'):
        return '\n'.join('/' + name + ' — ' + description for name, description in COMMANDS[account['locale']])
    if command == '/status':
        return 'Spartan conectado. Acceso privado autorizado.' if spanish else 'Spartan connected. Authorized private access.'
    if command == '/provider':
        return f"{account['provider_name']} · {account['model']}"
    if command == '/usage':
        if user_id is None:
            return 'Uso no disponible.' if spanish else 'Usage unavailable.'
        from storage.channels.usage import summary
        value = summary(account['id'], user_id)
        lines = [
            'Tu uso en este bot · últimas 24 horas' if spanish else 'Your usage in this bot · last 24 hours',
            ('Consultas: ' if spanish else 'Requests: ') + str(value['requests']),
        ]
        if value['reported_requests']:
            unavailable = 'no disponible' if spanish else 'unavailable'
            lines += [('Entrada reportada: ' if spanish else 'Reported input: ') + (str(value['prompt_tokens']) if value['input_reports'] else unavailable),
                      ('Salida reportada: ' if spanish else 'Reported output: ') + (str(value['completion_tokens']) if value['output_reports'] else unavailable),
                      ('Tokens conocidos: ' if spanish else 'Known tokens: ') + str(value['total_tokens'])]
        else:
            lines.append('El proveedor todavía no ha reportado tokens.' if spanish else 'The provider has not reported tokens yet.')
        if value['complete_requests'] < value['requests']:
            lines.append('Hay consultas con datos de uso incompletos o no disponibles; el total puede ser parcial.' if spanish else 'Some requests have incomplete or unavailable usage data; the total may be partial.')
        lines.append(('Límite local compartido del bot: ' if spanish else 'Bot shared local limit: ') + str(value['hourly_requests_remaining']) + '/30 ' + ('consultas disponibles en la ventana móvil de una hora.' if spanish else 'requests available in the rolling one-hour window.'))
        lines.append('Saldo del proveedor: no disponible. Este límite local no es tu saldo de tokens.' if spanish else 'Provider balance: unavailable. This local limit is not your token balance.')
        return '\n'.join(lines)
    if command == '/tools':
        return ('Puedes conversar, consultar el inventario y buscar información pública con /search y leer páginas públicas con /read URL. La búsqueda automática depende de las herramientas que soporte el modelo. Archivos locales, ejecución de skills, MCP y comandos siguen bloqueados.' if spanish else 'You can chat, inspect inventory and search public information with /search and read public pages with /read URL. Automatic search depends on model tool support. Local files, skill execution, MCP and commands remain blocked.')
    if command in ('/skills', '/mcp'):
        items = inventory()['skills' if command == '/skills' else 'mcp']
        return '\n'.join('- ' + i['name'] for i in items) or ('No hay elementos configurados.' if spanish else 'No items configured.')
    return 'Usa /help para ver los comandos.' if spanish else 'Use /help to see commands.'

COMMANDS['es'].append(('read', 'Leer una página pública: /read URL'))
COMMANDS['en'].append(('read', 'Read a public page: /read URL'))
