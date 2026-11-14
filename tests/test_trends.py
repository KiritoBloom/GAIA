import unittest
from datetime import date
import numpy as np
from science.trends import analyze
from science.acquisition import import_csv, scope


def fixture(slope=0.3, years=25, seed=34, rho=0.35):
    random = np.random.default_rng(seed)
    residual = 0
    series = []
    for i in range(years * 12):
        residual = rho * residual + random.normal(scale=0.1)
        series.append({"date": f"{2000+i//12}-{i%12+1:02d}-01", "value": 10 + slope * i / 12 + 3 * np.sin(2*np.pi*(i%12)/12) + residual})
    return series


class Trends(unittest.TestCase):
    def test_positive_slope_units_and_seasonality(self):
        result = analyze(fixture())
        self.assertEqual(result["status"], "detected")
        self.assertAlmostEqual(result["slope_per_year"], 0.3, delta=0.01)
        self.assertAlmostEqual(result["slope_per_decade"], result["slope_per_year"] * 10)
        self.assertLess(result["interval"][0], 0.3)
        self.assertGreater(result["interval"][1], 0.3)

    def test_negative(self):
        result = analyze(fixture(-0.2))
        self.assertLess(result["slope_per_year"], 0)
        self.assertEqual(result["status"], "detected")

    def test_missing_month_is_not_time_compressed(self):
        values = fixture()
        del values[87]
        result = analyze(values)
        self.assertEqual(result["status"], "descriptive_only")
        self.assertIsNone(result["p_value"])
        self.assertEqual(result["missing"], 1)

    def test_fill_value_is_missing(self):
        values = fixture()
        values[17]["value"] = None
        self.assertIsNone(analyze(values)["p_value"])

    def test_constant_is_not_fake_significance(self):
        values = fixture()
        for row in values:
            row["value"] = 4
        result = analyze(values)
        self.assertEqual(result["status"], "descriptive_only")
        self.assertIsNone(result["p_value"])

    def test_short_series(self):
        self.assertEqual(analyze(fixture(years=10))["status"], "descriptive_only")

    def test_duplicate_rejected(self):
        values = fixture()
        values.append(values[0])
        with self.assertRaises(ValueError):
            analyze(values)

    def test_hash_reproducible(self):
        first, second = analyze(fixture()), analyze(fixture())
        self.assertEqual(first["inputs_sha256"], second["inputs_sha256"])
        self.assertEqual(first["specification_hash"], second["specification_hash"])
        self.assertEqual(first["interval"], second["interval"])

    def test_annual_uses_yearly_bandwidth(self):
        # Annual inference uses years, never a compressed monthly timeline.
        rng = np.random.default_rng(5)
        values = [{"date": f"{2000+i}-01-01", "value": 0.3 + i*0.01 + rng.normal(0, 0.004)} for i in range(25)]
        result = analyze(values, frequency="annual", bandwidth=2)
        self.assertEqual(result["specification"]["bandwidth"], 2)
        self.assertAlmostEqual(result["slope_per_year"], 0.01, delta=0.001)

    def test_hash_survives_javascript_numeric_serialization(self):
        values = fixture()
        values[0]["value"] = 0.0
        first = analyze(values)
        values[0]["value"] = 0
        second = analyze(values)
        self.assertEqual(first["inputs_sha256"], second["inputs_sha256"])
        self.assertEqual(first["specification_hash"], second["specification_hash"])
        self.assertEqual(first["slope_per_year"], second["slope_per_year"])

    def test_autocorrelated_null_characterization(self):
        # A finite synthetic implementation check, NOT a guarantee of 5% FPR.
        tested = [analyze(fixture(0, seed=i, rho=0.6)) for i in range(40)]
        positives = sum(result["status"] == "detected" for result in tested)
        self.assertLessEqual(positives, 10)

    def test_import_declared_not_authentic(self):
        data = import_csv({"csv": "date,value\n2000-01-01,1\n2000-02-01,2", "source": "NASA Giovanni export supplied by user", "units": "degC"})
        self.assertEqual(data["provenance"]["authenticity"], "not_independently_authenticated")

    def test_scope_rejects_invalid_and_future(self):
        with self.assertRaises(ValueError):
            scope({"latitude": 91, "longitude": 0, "start": 2000, "end": 2024})
        with self.assertRaises(ValueError):
            scope({"latitude": 0, "longitude": 0, "start": 2000, "end": 2090})


if __name__ == "__main__":
    unittest.main()
