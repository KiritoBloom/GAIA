"""Bounded descriptive comparisons; no ecological twins or causal controls."""
import numpy as np
from .trends import analyze, digest, monthly_index, finite


def compare(request):
    focal=request["focal"]
    candidates=request.get("candidates",[])
    if len(candidates)>12:
        raise ValueError("Comparison pool budget is twelve candidates.")
    baseline_end=request["baseline_end"]
    specification={"baseline_end":baseline_end,"pool":[item["id"] for item in candidates],"matching":"pre-evaluation mean and variability of the same named quantity","tier":"contextual_only unless an independently declared response/domain design is supplied","selection":"all candidates retained; no outcome-selected replacement"}
    first={row["date"]:float(row["value"]) for row in focal["acquisition"]["series"] if finite(row.get("value"))}
    baseline=np.array([value for stamp,value in first.items() if stamp<=baseline_end])
    if len(baseline)<20:
        raise ValueError("Insufficient permitted baseline observations for comparison.")
    scale=max(float(baseline.std()),1e-8)
    results=[]
    for candidate in candidates:
        acquired=candidate["acquisition"]
        if acquired["variable"]["id"]!=focal["acquisition"]["variable"]["id"] or acquired["variable"]["units"]!=focal["acquisition"]["variable"]["units"] or acquired.get("frequency","monthly")!=focal["acquisition"].get("frequency","monthly"):
            results.append({"id":candidate["id"],"tier":"inadequate","reason":"Different quantity, units or temporal support."});continue
        other={row["date"]:float(row["value"]) for row in acquired["series"] if finite(row.get("value"))}
        matched=np.array([value for stamp,value in other.items() if stamp<=baseline_end])
        if len(matched)<20:
            results.append({"id":candidate["id"],"tier":"inadequate","reason":"Insufficient permitted baseline coverage."});continue
        distance=float(np.linalg.norm([(matched.mean()-baseline.mean())/scale,(matched.std()-baseline.std())/scale]))
        dates=sorted(set(first)&set(other))
        difference=analyze([{"date":stamp,"value":first[stamp]-other[stamp]} for stamp in dates],frequency=acquired.get("frequency","monthly"),bandwidth=2 if acquired.get("frequency")=="annual" else 12,min_years=20)
        contrary=focal["analysis"].get("interval") and candidate["analysis"].get("interval") and ((focal["analysis"]["interval"][0]>0 and candidate["analysis"]["interval"][1]<0) or (focal["analysis"]["interval"][1]<0 and candidate["analysis"]["interval"][0]>0))
        results.append({"id":candidate["id"],"tier":"contextual_only","geometry":acquired["geometry"],"baseline_distance":distance,"slope_per_year":candidate["analysis"]["slope_per_year"],"interval":candidate["analysis"]["interval"],"paired_slope_difference":difference,"exploratory_contrasting_directions":bool(contrary),"shared_source":acquired["variable"]["provider"]==focal["acquisition"]["variable"]["provider"],"unresolved_attributes":["Local soil, management, irrigation and ecosystem response are not established by this climatic match."],"reason":"Descriptive environmental comparison; matching does not establish local ecological equivalence."})
    return {"specification":specification,"specification_hash":digest(specification),"candidates":results,"tested_count":len(results),"counterexamples":[item["id"] for item in results if item.get("exploratory_contrasting_directions")],"search_label":"bounded exploratory comparison; not confirmatory counterexample or causal-control inference","limitations":["Shared forcing and spatial dependence are retained; multiple products or regions are not automatically independent.","Slope differences are calculated directly from paired time-series differences, not confidence-interval overlap.","Selected extremes remain exploratory and are not reused as untouched prediction evaluation."]}
