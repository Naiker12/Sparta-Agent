import logging
from langchain_core.tools import tool
from langchain.agents import create_react_agent
from langchain_openai import ChatOpenAI

logger = logging.getLogger("sparta_ai.subagents.code")


@tool
def execute_code_task(
    task: str,
    language: str = "auto",
    file_path: str | None = None,
) -> str:
    """
    Ejecuta tareas de programación: escribir código, refactorizar,
    depurar, o analizar archivos de código fuente.

    Args:
        task: Descripción de la tarea de código a realizar.
        language: Lenguaje de programación (python, javascript, typescript, etc.).
                 Usar 'auto' para detección automática.
        file_path: Ruta opcional al archivo a modificar o analizar.

    Returns:
        Código generado o modificado, con explicación de los cambios.
    """
    from sparta_ai.tools.file_tools import read_file_tool, write_file_tool

    context = ""
    if file_path:
        try:
            context = read_file_tool.invoke({"path": file_path})
        except Exception as e:
            context = f"(No se pudo leer {file_path}: {e})"

    prompt_parts = [
        f"Tarea: {task}",
    ]
    if language and language != "auto":
        prompt_parts.append(f"Lenguaje: {language}")
    if context:
        prompt_parts.append(f"Contexto del archivo:\n{context}")

    agent = _build_code_agent()
    result = agent.invoke({"input": "\n".join(prompt_parts)})
    return result.get("output", str(result))


def _build_code_agent():
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2)
    tools = [read_file_tool, write_file_tool]
    prompt = (
        "Eres un agente de programación experto. Tu tarea es escribir, "
        "refactorizar y depurar código. Siempre explica los cambios que haces "
        "y sigue las mejores prácticas del lenguaje correspondiente."
    )
    return create_react_agent(llm, tools, prompt=prompt)
