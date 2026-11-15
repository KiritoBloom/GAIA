"""A reproducible common-pixel subset sensitivity, never a biome mask."""
from copy import deepcopy


def common_support(request):
    acquisition = deepcopy(request['acquisition'])
    previous_recipe = acquisition.pop('analysis_recipe', None)
    rows = acquisition['series']
    actual = [row for row in rows if row.get('common_support_pixels', 0) > 0]
    if not actual:
        raise ValueError('No common QA-valid pixel intersection was retained. A fresh extraction with scientifically justified support_months is needed; old means cannot reconstruct pixel identity.')
    identities = {(row['common_support_mask_sha256'], row['common_support_pixels'], row['common_support_area_fraction'], tuple(row['common_support_months'])) for row in actual}
    if len(identities) != 1:
        raise ValueError('Common support differs across files/dates; a registered spatial mosaic is required.')
    mask_hash, pixels, fraction, months = next(iter(identities))
    acquisition['series'] = [{**row, 'value': row.get('common_support_value')} for row in rows]
    acquisition['geometry']['type'] = 'polygon_common_pixel_subset'
    acquisition['geometry']['common_support_area_fraction'] = fraction
    acquisition['variable']['support'] = f'Fixed QA-valid pixel subset covering {fraction:.6f} of polygon cell area, not the full polygon or a biome mask.'
    acquisition['provenance']['common_support_sensitivity'] = {'source_artifact_id': request['artifact_id'], 'mask_sha256': mask_hash, 'pixels': pixels, 'area_fraction': fraction, 'months': list(months), 'rationale': request['rationale']}
    if previous_recipe:
        acquisition['provenance']['upstream_analysis_recipe'] = previous_recipe
    acquisition['limitations'] = [*acquisition.get('limitations', []), 'Common pixels can select unusually clear or atypical locations; a different slope is a support sensitivity, not proof of a cause.']
    return acquisition
