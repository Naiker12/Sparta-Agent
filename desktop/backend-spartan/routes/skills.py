"""Read-only inventory of installed skills for the chat composer."""

from fastapi import APIRouter, Depends

from auth.authentication import get_current_subject
from core.inference.skill_actions import list_installed_skills

router = APIRouter()


@router.get("/")
async def list_skills(current_subject: str = Depends(get_current_subject)):
    """Return safe skill metadata; never include a skill's instructions or secrets."""
    return list_installed_skills()
