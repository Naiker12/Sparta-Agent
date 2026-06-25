import { useSkillStore } from '@/stores/skill.store'

export function useSkills() {
  const store = useSkillStore()
  return {
    skills: store.skills,
    addSkill: store.addSkill,
    updateSkill: store.updateSkill,
    deleteSkill: store.deleteSkill,
  }
}
