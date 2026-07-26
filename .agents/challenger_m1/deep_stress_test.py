import os
import re
import math

# Stress test geometry and pressure logic empirically in Python to evaluate logic robustness
def test_geometry(p1, p2):
    dx = p2['x'] - p1['x']
    dy = p2['y'] - p1['y']
    return math.sqrt(dx * dx + dy * dy)

def test_pressure(pressure=None, default_pressure=0.5):
    if pressure is None:
        return default_pressure
    if math.isnan(pressure):
        # In JS: Math.max(0, Math.min(1, NaN)) -> NaN
        return math.nan
    return max(0.0, min(1.0, pressure))

def run_deep_checks():
    results = []
    
    # Test 1: Geometry distance calculations
    d1 = test_geometry({'x': 0, 'y': 0}, {'x': 3, 'y': 4})
    assert abs(d1 - 5.0) < 1e-6, f"Expected 5.0, got {d1}"
    results.append("Geometry calculateDistance (3,4) -> 5.0 PASS")

    d2 = test_geometry({'x': -10, 'y': -20}, {'x': -10, 'y': -20})
    assert abs(d2 - 0.0) < 1e-6, f"Expected 0.0, got {d2}"
    results.append("Geometry calculateDistance same point -> 0.0 PASS")

    # Test 2: Pressure normalization
    p_def = test_pressure(None)
    assert p_def == 0.5, f"Expected 0.5, got {p_def}"
    results.append("Pressure normalization default -> 0.5 PASS")

    p_clamp_high = test_pressure(1.5)
    assert p_clamp_high == 1.0, f"Expected 1.0, got {p_clamp_high}"
    results.append("Pressure normalization clamp high (1.5 -> 1.0) PASS")

    p_clamp_low = test_pressure(-0.2)
    assert p_clamp_low == 0.0, f"Expected 0.0, got {p_clamp_low}"
    results.append("Pressure normalization clamp low (-0.2 -> 0.0) PASS")

    p_nan = test_pressure(float('nan'))
    results.append(f"Pressure normalization NaN input -> {p_nan} (Edge case noted: NaN propagates)")

    print("\n".join(results))

if __name__ == "__main__":
    run_deep_checks()
