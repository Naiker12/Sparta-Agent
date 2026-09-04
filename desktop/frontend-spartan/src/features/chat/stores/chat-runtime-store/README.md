# Submódulo: Chat Runtime Store (`src/features/chat/stores/chat-runtime-store/`)

Este submódulo gestiona el estado global reactivo de inferencia, hardware, parámetros de muestreo, estado de herramientas y ciclo de vida de los hilos de conversación utilizando **Zustand**.

---

## 1. Arquitectura y Flujo de Estados

```mermaid
graph TD
    UI[Componentes de Chat / Composers] -->|Acciones y Selectores| Store[useChatRuntimeStore]
    Store -->|Persistencia Local| LocalStorage[localStorage]
    Store -->|Sincronización Backend| API[/api/chat/settings /api/inference/status]
    Store --> Slices[Slices Atómicos Zustand]
    Slices --> TLS[thread-lifecycle-slice.ts: Hilos y Cancelación]
    Slices --> TSS[tools-status-slice.ts: Streaming Live y MCP]
    Slices --> MCS[model-catalog-slice.ts: Catálogo y Residente]
    Slices --> RS[reasoning-slice.ts: Thinking y Effort]
    Slices --> RAGS[rag-slice.ts: Fuentes RAG y OCR]
    Slices --> IPS[inference-params-slice.ts: Muestreo y Presets]
    Store --> Helpers[Módulos Puros y Helpers]
    Helpers --> Constants[constants.ts: Claves y Defaults]
    Helpers --> Types[types.ts: Tipos de Dominio]
    Helpers --> GpuMem[gpu-memory.ts: Asignación y Split GPU]
    Helpers --> Spec[speculative.ts: MTP y Speculative Decoding]
    Helpers --> ModelUtils[model-utils.ts: Identificación GGUF/Hub]
    Helpers --> Debounce[settings-debounce.ts: Coalescencia HTTP]
```

---

## 2. Responsabilidad por Archivo (Clean Code & SRP)

| Archivo | Responsabilidad Única (SRP) |
| :--- | :--- |
| **`constants.ts`** | Centraliza todas las claves de persistencia de `localStorage`, timeouts de deep research y configuraciones por defecto de RAG. |
| **`types.ts`** | Define contratos de tipos independientes: `PermissionMode`, `RagSource`, `RagMode`, `ReasoningStyle`, `ReasoningEffort`, `DiffusionCanvasFrame`. |
| **`gpu-memory.ts`** | Lógica pura para distribución proporcional de pesos (`distributeByWeight`), rebalanceo de splits (`rebalanceSplit`), persistencia de modo GPU y reconciliación de IDs físicos frente a Vulkan/CUDA. |
| **`speculative.ts`** | Normalización de modos de decodificación especulativa (`normalizeSpeculativeType`), resolución de estados y guardado seguro de preferencias universales. |
| **`model-utils.ts`** | Predicados para clasificación de modelos (`hasGgufSource`, `isLocalModelPath`, `isDownloadableHubRepo`). |
| **`settings-debounce.ts`** | Debounce y coalescencia de parches (`mergePatch`, `scheduleSettingsFlush`, `flushPendingSettingsNow`) para amortiguar escrituras HTTP en `/api/chat/settings`. |
| **`thread-lifecycle-slice.ts`**| Slice de Zustand para gestión de ciclo de vida de hilos (`runningByThreadId`, `localRunByThreadId`, cancelaciones y canvas). |
| **`tools-status-slice.ts`** | Slice de Zustand para streaming en vivo de salidas de herramientas, estatus de ejecución y aprobaciones MCP. |
| **`model-catalog-slice.ts`** | Slice de Zustand para inventario de modelos, LoRAs, estado residente y errores de carga. |
| **`reasoning-slice.ts`** | Slice de Zustand para control de thinking mode, estilos y esfuerzo de razonamiento. |
| **`rag-slice.ts`** | Slice de Zustand para gestión de retrieval aumentado, bases de conocimiento y OCR. |
| **`inference-params-slice.ts`**| Slice de Zustand para muestreo (temperature, topP, contextLength) y presets de usuario. |
| **`index.ts`** | Barril unificado de exportación para consumo interno y externo. |

---

## 3. Algoritmos y Patrones Clave

### A. Reparto de Capas por Remanente Máximo (`gpu-memory.ts`)
`largestRemainder` implementa el algoritmo de Hare-Niemeyer para garantizar que el redondeo discreto de capas distribuidas entre múltiples GPUs sume exactamente el número total solicitado sin truncamientos asimétricos.

### B. Normalización de Modos Especulativos (`speculative.ts`)
Alinea alias heredados del backend (`mtp`, `draft-dspark`, `ngram-simple`) con los identificadores canónicos expuestos por la interfaz de usuario, garantizando tolerancia a versiones dispares del backend local.

### C. Coalescencia Profunda de Parches (`settings-debounce.ts`)
`mergePatch` efectúa un merge selectivo donde las claves atómicas (como `ragSource`) reemplazan el valor anterior para evitar estados inválidos de discriminadores de unión, mientras que los mapas anidados (como `inferenceParamsByModel`) se fusionan por subclave para preservar parámetros concurrentes de múltiples modelos.


