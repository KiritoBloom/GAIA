"""One fixed JSON request in / one JSON result out. No arbitrary Python eval."""
import json
import platform
import sys
from .acquisition import power, modis, sites, import_csv, noaa_stations
from .catalog import VARIABLES, RESOURCES
from .trends import analyze
from .models import simulate, REGISTRY
from .discovery import compare
from .domain_methods import diagnose, METHODS
from .animals import occurrences


def execute(request):
    operation = request.get("operation")
    if operation == "catalog":
        return {"variables": VARIABLES, "resources": RESOURCES}
    if operation == "sites":
        return sites()
    if operation == "noaa_stations":
        return noaa_stations(request)
    if operation == 'animal_occurrences':
        return occurrences(request)
    if operation == "models":
        return REGISTRY
    if operation == 'domain_methods':
        return METHODS
    if operation == 'domain_diagnostic':
        return diagnose(request)
    if operation == "simulate":
        return simulate(request)
    if operation == "compare":
        return compare(request)
    if operation == "analyze":
        acquisition = request["acquisition"]
    elif operation in ("power", "modis", "import"):
        acquisition = {"power": power, "modis": modis, "import": import_csv}[operation](request)
    else:
        raise ValueError("Unknown registered scientific operation.")
    recipe = acquisition.get("frequency", "monthly")
    result = analyze(acquisition["series"], frequency=recipe, bandwidth=acquisition.get("bandwidth", 12), min_years=20)
    result["limitations"].extend(acquisition.get("limitations", []))
    import numpy, scipy, pandas, statsmodels
    return {"acquisition": acquisition, "analysis": result, "environment": {"python": platform.python_version(), "numpy": numpy.__version__, "scipy": scipy.__version__, "pandas": pandas.__version__, "statsmodels": statsmodels.__version__}}


if __name__ == "__main__":
    try:
        content = sys.stdin.read(2_500_001)
        if len(content) > 2_500_000:
            raise ValueError("Scientific request size exceeded.")
        result = execute(json.loads(content))
        print(json.dumps({"ok": True, "result": result}, allow_nan=False))
    except (ValueError, KeyError, TypeError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)[:500]}))
        sys.exit(1)
    except Exception:
        print(json.dumps({"ok": False, "error": "Scientific operation failed; no unverified result published."}))
        sys.exit(1)
