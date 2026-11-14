import unittest
import numpy as np
from science.models import simulate, water_bucket
from tests.test_trends import fixture


class ModelTests(unittest.TestCase):
    def test_nonfinite_storage_or_capacity_rejected(self):
        for initial,capacity in ((float('nan'),10),(0,float('inf'))):
            with self.assertRaises(ValueError):
                simulate({'model':'water_bucket_v1','initial_storage':initial,'capacity':capacity,'fluxes':[{}]})
    def acquisition(self):
        return {"series":fixture(.03),"variable":{"id":"T2M","units":"C"},"geometry":{"type":"model_grid_point","latitude":20.,"longitude":30.}}

    def test_seeded_continuation_and_validation(self):
        request={"acquisition":self.acquisition(),"model":"seasonal_continuation_v1","members":32,"horizon":12}
        first,second=simulate(request),simulate(request)
        self.assertEqual(first["series"],second["series"])
        self.assertEqual(len(first["series"]),12)
        self.assertIn("seasonal_climatology",first["validation"]["metrics"])
        self.assertIn("not calibrated",first["uncertainty_label"])

    def test_gap_rejected(self):
        acquisition=self.acquisition(); acquisition["series"].pop(12)
        with self.assertRaisesRegex(ValueError,"consecutive"):
            simulate({"acquisition":acquisition})

    def test_horizon_budget_rejected(self):
        with self.assertRaisesRegex(ValueError,"budget"):
            simulate({"acquisition":self.acquisition(),"horizon":100})

    def test_bucket_conservation_and_overflow(self):
        result=water_bucket({"capacity":10,"initial_storage":5,"fluxes":[{"precipitation":10,"evapotranspiration":2}]})
        self.assertEqual(result["series"][0]["storage"],10)
        self.assertEqual(result["series"][0]["overflow"],3)
        self.assertAlmostEqual(result["series"][0]["closure_residual"],0)

    def test_bucket_cannot_create_water(self):
        with self.assertRaisesRegex(ValueError,"exceed"):
            water_bucket({"capacity":10,"initial_storage":1,"fluxes":[{"withdrawals":2}]})

    def test_response_outside_joint_domain(self):
        acquisition=self.acquisition()
        cov={**acquisition,"variable":{"id":"RH2M","units":"%"},"series":[{**row,"value":30+i%20} for i,row in enumerate(acquisition["series"])]}
        with self.assertRaisesRegex(ValueError,"outside"):
            simulate({"model":"response_emulator_v1","acquisition":acquisition,"covariates":[cov],"scenario":{"RH2M":[500]*12}})

    def test_unavailable_biology_has_no_drought_fallback(self):
        with self.assertRaisesRegex(ValueError,"not implemented"):
            simulate({"model":"transmission","acquisition":self.acquisition()})
