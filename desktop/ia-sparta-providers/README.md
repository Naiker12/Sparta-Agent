# ia-sparta-providers — JS-side provider transport (secondary pipeline)

> **⚠️ IMPORTANTE: Este paquete NO es el pipeline principal de proveedores de IA.**
>
> El pipeline principal de chat vive en `python/sparta_ai/config/providers.py` (Python sidecar).
> Este paquete JS es un pipeline **secundario y separado**, usado exclusivamente por el motor
> de cron/subagentes (`useCronEngine.ts`, `AgentsPanel.tsx`) que necesita comunicación directa
> con LLMs desde el proceso Electron sin pasar por el sidecar Python.

## ¿Por qué existe este pipeline duplicado?

Históricamente, el motor de cron/subagentes se implementó en JS puro para evitar la latencia
del IPC con el sidecar Python en tareas cortas y frecuentes. Sin embargo, esto crea:

1. **Dos implementaciones independientes** de "hablarle a un proveedor de IA", con reglas
   distintas para timeouts, headers, manejo de reasoning, etc.
2. **Sin caché compartida** entre ambos pipelines — cada uno mantiene su propio pool de
   conexiones HTTP.
3. **Sin health-check compartido** — el health check de `providers.py` no se refleja aquí.

## Reglas para mantener la consistencia

Si modificás este paquete, asegurate de aplicar el mismo cambio en `python/sparta_ai/config/providers.py`:

| Feature | Python (principal) | JS (secundario) |
|---------|-------------------|-----------------|
| Health check | ✅ `check_provider_health()` | ❌ No implementado |
| LLM client cache | ✅ LRU por (vendor, model, key) | ❌ No implementado |
| Reasoning nativo | ✅ Detección por vendor + modelo | ❌ No implementado |
| Reasoning emulado | ✅ `emulated_reasoning.py` | ❌ No implementado |
| Timeout configurable | ✅ 75s default | ❌ Usa default del SDK |
| Pool de conexiones | ✅ vía caché de cliente | ❌ No implementado |

## ¿Cuándo usar este pipeline?

- **Solo** para tareas de cron/subagentes que se ejecutan en el proceso Electron.
- **Nunca** para el chat principal — ese siempre debe pasar por el sidecar Python.

## Plan de migración futuro

Idealmente, el motor de cron/subagentes debería hablarle al LLM a través del mismo sidecar
Python (vía IPC), eliminando la necesidad de mantener dos pipelines. Mientras tanto, cualquier
fix de latencia, timeout o manejo de errores debe aplicarse en AMBOS lados.