# Rediseño del Sistema de Documentación — Sparta Agent

Este directorio contiene el análisis técnico, la arquitectura de componentes y la hoja de ruta para la modernización y modularización del sistema de documentación en `landing/src/components/docs/`.

---

## 📑 Índice de Contenidos

| Archivo | Descripción |
|---|---|
| [**01 · Diagnóstico del Estado Actual**](./01-diagnostico.md) | Análisis del componente monolítico `docs-page.tsx`, deuda técnica e inventario de las 10 secciones actuales. |
| [**02 · Arquitectura de Componentes**](./02-arquitectura-componentes.md) | Nueva estructura modular de carpetas (`layout/`, `content/`, `diagrams/`) y especificación técnica de cada componente. |
| [**03 · Sistema de Diseño**](./03-sistema-diseno.md) | Estandarización de tokens de color, jerarquía tipográfica, anatomía de secciones y patrones de tarjetas. |
| [**04 · Integración de Diagramas**](./04-diagramas.md) | Catálogo y especificación de diagramas vectoriales editoriales para arquitectura, agentes, MCP y seguridad. |
| [**05 · Imágenes y Recursos Visuales**](./05-imagenes-y-recursos.md) | Mapeo de capturas reales de la aplicación vs. esquemas y criterios para evitar imágenes sintéticas irrelevantes. |
| [**06 · Hoja de Ruta de Implementación**](./06-hoja-de-ruta.md) | Plan de entrega por fases seguras sin regresiones en la landing. |

---

## 🎯 Objetivos Principales

1. **Desacoplar el Layout del Contenido**: Transformar `docs-page.tsx` de un archivo monolítico de 190 líneas a un orquestador declarativo de ~40 líneas.
2. **Componentes Atómicos Reutilizables**: Encabezados estandarizados (`SectionHeader`), CTA compartida (`SectionCta`), terminal interactiva (`CodeBlock`) y contenedor de diagramas (`DiagramEmbed`).
3. **Claridad Visual mediante Diagramas**: Incorporar esquemas vectoriales claros en temas complejos como arquitectura en capas, ciclo de agentes, pasarela MCP y modelo de permisos IPC.
4. **Escalabilidad**: Permitir la adición de nuevas páginas y secciones de documentación simplemente registrando una entrada en la configuración y creando su componente correspondiente.
