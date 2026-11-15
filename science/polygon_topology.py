"""Registered topology repair; no simplification, buffering or invented study box."""
import shapely
from shapely.geometry import shape, mapping


def prepare(geojson, source_boundary_sha256):
    original = shape(geojson)
    if original.geom_type not in ('Polygon', 'MultiPolygon') or original.is_empty:
        raise ValueError('Regional extraction requires a nonempty source polygon.')
    valid = bool(shapely.is_valid(original))
    reason = str(shapely.is_valid_reason(original))
    components = list(original.geoms) if original.geom_type == 'MultiPolygon' else [original]
    invalid_components = []
    polygons, residual = [], []

    def visit(geometry):
        if geometry.is_empty:
            return
        if geometry.geom_type == 'Polygon':
            polygons.append(geometry)
        elif hasattr(geometry, 'geoms'):
            for part in geometry.geoms:
                visit(part)
        else:
            residual.append({'type': geometry.geom_type, 'length_coordinate_degrees': float(geometry.length)})

    # GeoJSON MultiPolygon means UNION of its polygon components, not even-odd
    # cancellation between overlapping/nested shells. Repair each polygon's
    # rings independently, then union. A global linework pass would wrongly cut
    # valid inner polygon components out of an enclosing component as holes.
    for index, component in enumerate(components):
        if bool(shapely.is_valid(component)):
            visit(component)
        else:
            invalid_components.append({'index': index, 'reason': str(shapely.is_valid_reason(component))})
            visit(shapely.make_valid(component, method='linework', keep_collapsed=True))
    if not polygons:
        raise ValueError('Source topology has no recoverable polygon area; no substitute boundary created.')
    effective = shapely.orient_polygons(shapely.union_all(polygons), exterior_cw=False)
    if effective.is_empty or effective.geom_type not in ('Polygon', 'MultiPolygon') or not bool(shapely.is_valid(effective)):
        raise ValueError('Source polygon topology could not be repaired into a valid area.')
    audit = {'version': 'source_polygon_component_union_v1', 'source_boundary_sha256': source_boundary_sha256,
             'source_valid': valid, 'source_validation': reason,
             'method': 'Repair invalid individual polygons with GEOS linework; union polygon components; RFC7946 ring orientation',
             'multipolygon_semantics': 'Union of component polygon interiors with each component hole excluded; overlaps are not counted twice or interpreted as holes.',
             'source_component_count': len(components), 'invalid_components': invalid_components,
             'simplification': 'none', 'precision_grid': 'none',
             'source_area_coordinate_degrees_squared': float(original.area),
             'effective_area_coordinate_degrees_squared': float(effective.area),
             'area_diagnostic': 'Coordinate-plane diagnostic only, not geodesic area; an invalid original has no authoritative area.',
             'collapsed_non_area_components': residual,
             'shapely_version': shapely.__version__, 'geos_version': shapely.geos_version_string,
             'limitation': 'Original source geometry remains retained. Invalid topology required an explicitly recorded interpretation of polygon interior; repaired support must not be called an unchanged original boundary.' if not valid else 'Ring orientation does not change the polygonal point set.'}
    return mapping(effective), audit
