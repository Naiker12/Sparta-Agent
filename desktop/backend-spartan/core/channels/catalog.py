"""Safe inventory. Never expose headers, credentials, commands or skill paths."""

COMMANDS = {
    'es': [('help', 'Ver comandos y capacidades'), ('status', 'Estado de esta conexión'), ('provider', 'Proveedor y modelo de esta conexión'), ('usage', 'Mi consumo y límite local de consultas'), ('tools', 'Permisos de herramientas'), ('skills', 'Skills instaladas'), ('mcp', 'Servidores MCP configurados'), ('cancel', 'Cancelar mi consulta en curso'), ('reset', 'Reiniciar esta conversación')],
    'en': [('help', 'Show commands and capabilities'), ('status', 'Connection status'), ('provider', 'Provider and model for this connection'), ('usage', 'My usage and local request limit'), ('tools', 'Tool permissions'), ('skills', 'Installed skills'), ('mcp', 'Configured MCP servers'), ('cancel', 'Cancel my active request'), ('reset', 'Reset this conversation')],
}
COMMANDS['es'].append(('search', 'Buscar un tema público en internet'))
COMMANDS['en'].append(('search', 'Search a public topic on the internet'))



# Shared contract for model instructions, command help and desktop inventory.
CAPABILITIES = (
    ('textChat', 'available', 'Conversación de texto', 'Text conversation'),
    ('conversationContext', 'available', 'Contexto de conversación', 'Conversation context'),
    ('projectContext', 'available', 'Instrucciones y documentos indexados del proyecto', 'Project instructions and indexed documents'),
    ('typingCancellation', 'available', 'Escritura y cancelación', 'Typing and cancellation'),
    ('documents', 'available', 'Documentos TXT, Markdown, CSV y JSON', 'TXT, Markdown, CSV and JSON documents'),
    ('publicWebSearch', 'available', 'Búsqueda pública en internet', 'Public web search'),
    ('publicPageRead', 'available', 'Lectura de páginas públicas', 'Public page reading'),
    ('referenceImages', 'available', 'Imágenes de referencia con fuentes', 'Reference images with sources'),
    ('webTools', 'pending', 'Ejecución de skills y MCP', 'Skill and MCP execution'),
)


def profile_linked(account, user_id):
    return bool(user_id and account.get('profile_user_id') == user_id
                and user_id in account.get('allowed_user_ids', []))


def capability_summary(account, user_id=None, *, locale=None):
    spanish = (locale or account['locale']) == 'es'
    available = ', '.join(item[2 if spanish else 3] for item in CAPABILITIES if item[1] == 'available')
    lines = [('Disponible: ' if spanish else 'Available: ') + available + '.']
    lines.append(('Notas de voz: habilitadas; requieren un proveedor de transcripción preparado.' if spanish else 'Voice notes: enabled; require a prepared transcription provider.') if account.get('voice_enabled') else ('Notas de voz: desactivadas en esta conexión.' if spanish else 'Voice notes: disabled for this connection.'))
    if profile_linked(account, user_id):
        lines.append('Puedes cambiar tu nombre en Spartan: «me quiero llamar Naiker Codes». La aplicación guarda el cambio; no modifica tu cuenta de Telegram.' if spanish else 'This sender is explicitly linked to the Spartan profile. They can change their display name and nickname: "call me Jane". The application saves the change; it does not modify their Telegram account. The stored link is authoritative: do not ask this sender to confirm linking again. For an unclear rename request, ask for the new name using the supported phrase.')
    elif account.get('owner_user_id') and account['owner_user_id'] != user_id:
        lines.append('Esta cuenta invitada no puede cambiar el perfil del propietario.' if spanish else 'This guest cannot change the owner profile. Do not suggest granting themselves profile access.')
    else:
        lines.append('Puedes solicitar el cambio de nombre desde Telegram después de vincular tu usuario en Configuración → Canales y permisos → Perfil de Spartan.' if spanish else 'Profile name changes require linking this Telegram user in Spartan Settings > Channels and permissions > Spartan profile. After linking, the user can request a name change directly from this Telegram conversation.')
    lines.append('La aplicación ejecuta el cambio de nombre fuera del modelo. El asistente debe explicar esta función y el vínculo necesario; no afirmar que solo conversa ni que todos los cambios deben hacerse manualmente en el escritorio. No puede crear el vínculo desde Telegram.' if spanish else 'The application executes explicit profile name changes outside the language model. As the Spartan assistant, explain this supported feature and any required linking; do not say you only chat or that all name changes must be performed manually in the desktop app. Linking itself must be done in the desktop app.')
    from .permissions import project_context_allowed
    lines.append(('Al seleccionar un proyecto autorizado, puedes consultar sus instrucciones y fragmentos de documentos indexados. No puedes abrir carpetas ni modificar archivos. Las consultas con proyecto seleccionado no usan herramientas web públicas.' if spanish else 'Selecting an authorized project allows its instructions and matching indexed document excerpts. You cannot open folders or modify files. Requests with a selected project do not use public web tools.') if project_context_allowed(account, user_id) else ('Puedes seleccionar proyectos autorizados para vincular actividad; la lectura de contexto requiere permiso en Configuración → Canales y permisos.' if spanish else 'You can select authorized projects to link activity; reading context requires permission in Settings > Channels and permissions.'))
    lines.append('Pendiente: archivos locales, comandos del sistema, ejecución de skills/MCP, generación de imágenes y respuestas de voz.' if spanish else 'Not implemented: local file access, shell execution, skill/MCP execution, image generation and spoken audio replies.')
    return '\n'.join(lines)


def inventory():
    from storage.providers_db import list_providers
    from storage.mcp_servers_db import list_servers
    from core.inference.skill_actions import list_installed_skills
    return {
        'capabilities': [{'id': item[0], 'status': item[1]} for item in CAPABILITIES],
        'providers': [{'id': p['id'], 'name': p['display_name'], 'models': p.get('models') or p.get('available_models') or []} for p in list_providers() if p['is_enabled'] and p['provider_type'] != 'openai_codex'],
        'skills': [{'name': str(s.get('name', s.get('id', '')))[:120]} for s in list_installed_skills()][:100],
        'mcp': [{'name': str(s.get('display_name', ''))[:120], 'enabled': bool(s.get('is_enabled', False))} for s in list_servers()][:100],
    }


def command_reply(text: str, account: dict, *, user_id=None, buttons=False):
    if not text.startswith('/'):
        return None
    command = text.split()[0].split('@')[0].lower()
    spanish = account['locale'] == 'es'
    if command in ('/projects', '/project') and user_id is not None:
        from storage.channels import projects
        visible = projects.available(account['id'], user_id)
        if command == '/projects':
            if buttons and visible:
                return ('Elige un proyecto autorizado. Cambiar de proyecto reinicia el contexto del chat. Se muestran hasta 20 proyectos.' if spanish else 'Choose an authorized project. Switching projects resets the chat context. Up to 20 projects are shown.')
            return ('Proyectos autorizados:\n' if spanish else 'Authorized projects:\n') + ('\n'.join(p['name'] + ' — /project ' + p['id'] for p in visible) or ('Ninguno. Autorízalos en Configuración → Canales y permisos → Proyectos.' if spanish else 'None. Authorize them in Settings → Channels and permissions → Projects.'))
        value = text.split(maxsplit=1)[1].strip() if len(text.split(maxsplit=1)) > 1 else ''
        if value:
            previous = projects.selected(account['id'], user_id)
            if not projects.select(account['id'], user_id, None if value.lower() == 'off' else value):
                return 'Proyecto no autorizado. Usa /projects.' if spanish else 'Project not authorized. Use /projects.'
            if previous != projects.selected(account['id'], user_id):
                from storage.channels import history
                history.reset(account['id'], user_id)
        project = projects.selected(account['id'], user_id)
        from .permissions import project_context_allowed
        from storage.channels.repository import get_account
        current = get_account(account['id']) or account
        access = ('Instrucciones y documentos indexados disponibles. No abre carpetas ni modifica archivos. Las búsquedas web se desactivan mientras este proyecto esté seleccionado.' if spanish else 'Instructions and indexed documents are available. No folder access or file modification. Public web lookups are disabled while this project is selected.') if project and project_context_allowed(current, user_id) else ('Solo vincula la actividad; no concede acceso a archivos.' if spanish else 'Links activity only; does not grant file access.')
        return (('Proyecto seleccionado: ' if spanish else 'Selected project: ') + project['name'] if project else ('Sin proyecto seleccionado.' if spanish else 'No project selected.')) + '\n' + access + (' Cambiar de proyecto reinicia el contexto del chat. Usa /project off para salir.' if spanish else ' Switching projects resets chat context. Use /project off to leave.')
    if command in ('/search', '/read', '/images'):
        return None
    if command in ('/start', '/help'):
        guide = ('Habla normalmente o envía una nota con el micrófono de Telegram. Para buscar, escribe «Busca en internet…».\n\n' if spanish else 'Chat normally or send a note using the Telegram microphone. To search, write “Search the web…”.\n\n')
        return guide + capability_summary(account, user_id) + '\n\n' + '\n'.join('/' + name + ' — ' + description for name, description in COMMANDS[account['locale']])
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
    if command == '/voice':
        from .voice import active_status, notice
        if not account.get('voice_enabled'):
            return notice('voice_disabled', account['locale'])
        prepared = active_status()
        if not prepared['ready']:
            return notice('voice_not_ready', account['locale'])
        label = prepared['provider_name'] + ' · ' + prepared['model']
        return (f'Entrada de voz activa · {label}. Máximo cinco minutos y 20 MB por audio. Respuestas por texto.' if spanish else f'Voice input enabled · {label}. Maximum five minutes and 20 MB per audio. Text replies.')
    if command in ('/tools', '/permissions'):
        return capability_summary(account, user_id)
    if command in ('/skills', '/mcp'):
        items = inventory()['skills' if command == '/skills' else 'mcp']
        return '\n'.join('- ' + i['name'] for i in items) or ('No hay elementos configurados.' if spanish else 'No items configured.')
    return 'Usa /help para ver los comandos.' if spanish else 'Use /help to see commands.'

COMMANDS['es'].append(('read', 'Leer una página pública: /read URL'))
COMMANDS['en'].append(('read', 'Read a public page: /read URL'))
COMMANDS['es'].append(('images', 'Buscar imágenes de referencia: /images tema'))
COMMANDS['en'].append(('images', 'Find reference images: /images topic'))

COMMANDS['es'].append(('voice', 'Estado de la entrada de voz local'))
COMMANDS['en'].append(('voice', 'Local voice input status'))
COMMANDS['es'].extend([('projects', 'Ver proyectos autorizados'), ('project', 'Seleccionar proyecto o salir: /project off')])
COMMANDS['en'].extend([('projects', 'Show authorized projects'), ('project', 'Select project or leave: /project off')])

# Compatibility handlers remain available, but routine capabilities do not
# require a slash command. Keep the native menu focused on chat controls.
for _locale in COMMANDS:
    COMMANDS[_locale] = [(name, description) for name, description in COMMANDS[_locale]
                         if name in ('help', 'projects', 'usage', 'cancel', 'reset')]
