"""Plan tool for the Sparta agent graph.

Replaces the old planner.py node (which did a blind ainvoke and parsed JSON
from text) with a proper tool call. The LLM calls create_plan as a structured
tool_use — the result never leaks into chat text because it's a tool block,
not a text block.
"""
from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field
from typing import Optional


class Step(BaseModel):
    id: int = Field(description="Step number in execution order")
    action: str = Field(description="What this step does")
    tool: Optional[str] = Field(default=None, description="Tool to use (or null for manual step)")
    depends_on: list[int] = Field(default_factory=list, description="Step IDs this depends on")


class CreatePlanInput(BaseModel):
    steps: list[Step] = Field(description="Ordered list of steps to execute")
    estimated_steps: int = Field(default=0, description="Total number of steps estimated")


def _create_plan(steps: list[dict], estimated_steps: int = 0) -> str:
    """Registra un plan de pasos para una tarea compleja de varios pasos.

    Úsalo SOLO cuando la tarea requiera múltiples herramientas en secuencia.
    No lo uses para preguntas simples o de un solo paso.

    El plan registrado se muestra automáticamente en el panel 'Plan de ejecución'
    del usuario. Los pasos se marcan como completados a medida que ejecutás tools.

    Args:
        steps: Lista ordenada de pasos a ejecutar. Cada paso tiene id, action,
               tool (opcional), depends_on (opcional).
        estimated_steps: Número total estimado de pasos.

    Returns:
        Confirmación de que el plan fue registrado.
    """
    return "Plan registrado. Los pasos se mostrarán en el panel de ejecución."


create_plan_tool = StructuredTool.from_function(
    name="create_plan",
    description="Registra un plan de pasos para una tarea compleja de varios pasos. "
                "Úsalo SOLO cuando la tarea requiera múltiples herramientas en secuencia. "
                "No lo uses para preguntas simples.",
    args_schema=CreatePlanInput,
    func=_create_plan,
)
