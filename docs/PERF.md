# Performance Analysis — Sparta Agent

> **Estado actual:** Este documento consolida los análisis de `docs/18-*`, `docs/19-*`, `docs/21-*` y `docs/22-*`.
> Las optimizaciones descritas en esos documentos **ya están aplicadas** en el código actual (commit `0da4c5b`).
> Este documento refleja el estado vivo de la performance.

## 1. Optimizaciones ya aplicadas (verificadas contra código actual)

| Optimización | Archivo | Estado |
|---|---|---|
| Paralelización de `prepare_agent` con `asyncio.gather` | `server_handlers.py:476-490` | ✅ Aplicada |
| `single_pass_cleanup` en vez de 3 deepcopy | `agents/message_cleanup.py` | ✅ Aplicada |
| Detección de reasoning nativo en LM Studio | `agents/emulated_reasoning.py:140-148` | ✅ Aplicada |
| Compresión de contexto no-bloqueante | `memory/context_manager.py` | ✅ Aplicada |
| Pool de conexiones MCP | `tools/mcp_manager.py` | ✅ Aplicada |
| Circuit breaker MCP (cooldown 60s) | `tools/mcp_manager.py:41` | ✅ Aplicada |
| StreamingThinkScrubber para thinking tags | `streaming/think_scrubber.py` | ✅ Aplicada |
| RepetitionGuard para degeneración | `streaming/repetition_guard.py` | ✅ Aplicada |

## 2. Causa raíz de latencia al cambiar de proveedor

El problema principal **no** es que un proveedor sea lento, sino que **el cambio de proveedor no tiene un camino rápido propio**:

### 2.1 Health check no conectado al flujo real (FIXED en esta auditoría)

`check_provider_health()` existía en `providers.py:259-289` pero **no se llamaba desde `prepare_agent`**. 
- **Antes:** Si cambiabas a un proveedor local caído, el timeout era de 75s (`DEFAULT_REQUEST_TIMEOUT_SECONDS`)
- **Ahora:** `prepare_agent` llama a `check_provider_health()` antes de construir el LLM. Si falla, lanza `RuntimeError` inmediato (<3s)

### 2.2 Sin caché de cliente LLM (FIXED en esta auditoría)

`build_llm()` instanciaba un `ChatOpenAI`/`ChatAnthropic` nuevo **en cada turno**.
- **Antes:** Cada mensaje reconstruía el cliente, pagando DNS + TLS + SDK object construction
- **Ahora:** Caché LRU por `(vendor, model, api_key_hash, base_url)` con hasta 16 entradas

### 2.3 Reasoning emulado mal detectado al cambiar de proveedor (FIXED en esta auditoría)

`needs_emulated_reasoning()` solo cubría vendors locales (`lmstudio`, `ollama`, `llamacpp`, `custom`) con detección por nombre de modelo.
- **Antes:** Al cambiar de un modelo con reasoning nativo a un vendor OpenAI-compatible genérico (Groq, Together, etc.), se inyectaba el prompt de razonamiento emulado duplicando latencia
- **Ahora:** También verifica `_model_has_native_reasoning()` para vendors cloud OpenAI-compatible

### 2.4 MCP en ruta crítica (FIXED en esta auditoría)

El descubrimiento MCP se ejecutaba en modo "agente" incluso sin servidores configurados.
- **Antes:** Cada turno en modo agente pasaba por `mcp_manager.get_tools()` aunque `mcp_servers` estuviera vacío
- **Ahora:** Salta inmediatamente si `not mcp_servers`

### 2.5 Sin logging por fase con vendor/model (FIXED en esta auditoría)

- **Antes:** `logger.info("prepare_agent parallel phase: %.1fms")` sin vendor/model
- **Ahora:** `logger.info("prepare_agent parallel phase: %.1fms [vendor=%s model=%s health=%.1fms build=%.1fms]")`

## 3. Pipeline duplicado JS vs Python

Hay **dos implementaciones independientes** de "hablarle a un proveedor de IA":

- **Camino real del chat:** React → IPC/WebSocket → Python sidecar → `config/providers.py` → LangChain → LLM
- **Camino paralelo, JS puro:** `desktop/ia-sparta-providers/src/transports/*` + `gateway.ts`, usado solo por el motor de cron/subagentes

**Problema:** No comparten caché, health-check, ni manejo de timeouts. Ver `desktop/ia-sparta-providers/README.md` para más detalles.

## 4. Pendientes / Mejoras futuras

| Prioridad | Tarea | Impacto |
|---|---|---|
| Media | Unificar pipeline de proveedores (JS → Python sidecar) | Elimina duplicación de código y bugs de latencia |
| Baja | Consolidar docs de performance en este archivo | Reduce ruido en `docs/` |
| Baja | Agregar `*.node` a `.gitignore` | ✅ Hecho |
| Baja | Eliminar `package-lock.json` (usar solo pnpm) | ✅ Ya en `.gitignore` |

## 5. Métricas de referencia

Tiempos de `prepare_agent` en condiciones normales (proveedor cloud, MCP sin servidores):

| Fase | Tiempo típico |
|---|---|
| Health check (local) | <3s o inmediato si cloud |
| Build LLM (cache hit) | <1ms |
| Build LLM (cache miss) | ~10-50ms |
| Parallel phase total | ~50-200ms |
| MCP discovery (con servidores) | 1-30s (depende de `npx`) |