import unittest
from science.discovery import compare
from science.trends import analyze
from test_trends import fixture

def artifact(identifier,units='C'):
    series=fixture(.03)
    return {'id':identifier,'acquisition':{'series':series,'frequency':'monthly','geometry':{'latitude':20,'longitude':30},'variable':{'id':'T2M','units':units,'provider':'NASA POWER'}},'analysis':analyze(series)}

class ComparisonTests(unittest.TestCase):
    def test_same_source_is_context_not_independence(self):
        result=compare({'focal':artifact('focal'),'candidates':[artifact('other')],'baseline_end':'2019-12-01'})
        self.assertEqual(result['tested_count'],1)
        self.assertEqual(result['candidates'][0]['tier'],'contextual_only')
        self.assertTrue(result['candidates'][0]['shared_source'])
        self.assertAlmostEqual(result['candidates'][0]['paired_slope_difference']['slope_per_year'],0)
    def test_units_are_not_silently_compared(self):
        result=compare({'focal':artifact('focal'),'candidates':[artifact('other','mm/day')],'baseline_end':'2019-12-01'})
        self.assertEqual(result['candidates'][0]['tier'],'inadequate')
    def test_candidate_budget(self):
        with self.assertRaisesRegex(ValueError,'twelve'):
            compare({'focal':artifact('focal'),'candidates':[artifact(str(i)) for i in range(13)],'baseline_end':'2019-12-01'})
