/**
 * Seed data para desarrollo.
 * Ejecutar con: npx tsx scripts/seed-dev-data.ts
 * 
 * Solo corre en entorno de desarrollo. No se ejecuta en producción.
 * Puebla stores con datos de ejemplo para facilitar el desarrollo de UI.
 */

// Provider de ejemplo para desarrollo
const DEV_PROVIDER = {
  vendor: 'openai',
  kind: 'cloud',
  label: 'Mi OpenAI Dev',
  apiKey: 'sk-dev-placeholder',
  defaultModel: 'gpt-4',
}

// Skills de ejemplo
const DEV_SKILLS = [
  {
    name: 'Code Review',
    description: 'Revisa código y sugiere mejoras',
    prompt: 'Revisa el siguiente código y sugiere mejoras de calidad, seguridad y rendimiento.',
    tags: ['code', 'review'],
  },
  {
    name: 'Resumen de docs',
    description: 'Genera un resumen conciso de documentación',
    prompt: 'Genera un resumen ejecutivo del siguiente documento en 3-5 párrafos.',
    tags: ['docs', 'summary'],
  },
]

// Proyecto default
const DEV_PROJECT = {
  name: 'sparta-agent',
  description: 'Proyecto principal',
}

async function seed() {
  console.log('=== Sparta Agent - Seed Data ===')
  console.log('')
  console.log('Este script puebla datos de ejemplo para desarrollo.')
  console.log('NO ejecutar en producción.')
  console.log('')
  console.log('Para cargar estos datos, abre la consola del navegador en modo dev')
  console.log('y ejecuta los comandos manualmente desde el store correspondiente.')
  console.log('')
  console.log('Ejemplo:')
  console.log('  useProviderStore.getState().addProvider({...})')
  console.log('  useSkillStore.getState().addSkill(...)')
  console.log('')
  console.log('=== FIN ===')
}

seed().catch(console.error)

export {}
