import sys
from pathlib import Path

# Add backend root to sys.path
backend_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_root))

from core.research.parsing import _parse_and_validate_plan
from core.research_runs import _select_synthesis_report
from core.inference.tools import _web_search


def test_plan_parsing():
    # 1. Standard JSON plan
    p1 = _parse_and_validate_plan('{"title": "Real Madrid Plan", "steps": [{"title": "Step 1", "query": "Real Madrid"}]}', "", 5)
    assert p1["title"] == "Real Madrid Plan"
    assert len(p1["steps"]) == 1
    assert p1["steps"][0]["query"] == "Real Madrid"

    # 2. Numbered list text plan (when model skips JSON)
    text_plan = (
        "Plan de investigación:\n"
        "1. Buscar cómo obtener información en tiempo real del partido del Real Madrid\n"
        "2. Buscar canales de transmisión y marcadores en vivo\n"
    )
    p2 = _parse_and_validate_plan(text_plan, "", 5)
    assert len(p2["steps"]) == 2
    assert "Real Madrid" in p2["steps"][0]["query"]

    # 3. Plain free-form text
    p3 = _parse_and_validate_plan("Investigar el partido del Real Madrid hoy", "", 5)
    assert len(p3["steps"]) >= 1

    print("Plan parsing tests passed!")


def test_synthesis_report_selection():
    # 1. With boundary marker in content
    r1 = _select_synthesis_report("Intro\n<!-- UNSLOTH_FINAL_REPORT -->\n# Report Body", "")
    assert r1 == "# Report Body"

    # 2. Content without boundary marker
    r2 = _select_synthesis_report("# Full Report Without Marker\nDetailed analysis here.", "")
    assert "# Full Report Without Marker" in r2

    # 3. Only reasoning content
    r3 = _select_synthesis_report("", "# Thinking Report\nAll generated in reasoning.")
    assert "Thinking Report" in r3

    print("Synthesis report selection tests passed!")


if __name__ == "__main__":
    test_plan_parsing()
    test_synthesis_report_selection()
    print("ALL DEEP RESEARCH RESILIENCE TESTS PASSED!")
