import math
import unittest
from science.domain_methods import diagnose

def series(identifier,units,values):return {'variable':{'id':identifier,'units':units},'frequency':'monthly','geometry':{'type':'grid_supported_location','latitude':1,'longitude':2},'series':[{'date':f'2001-{i+1:02d}-01','value':v} for i,v in enumerate(values)]}
class DomainMethods(unittest.TestCase):
    def test_vpd_fao_equation_missingness_and_approximation(self):
        result=diagnose({'method':'vpd_context','role':'aura','acquisitions':[series('T2M','C',[20,None]),series('RH2M','%',[50,70])]})
        self.assertAlmostEqual(result['series'][0]['value'],0.6108*math.exp(17.27*20/257.3)*0.5)
        self.assertEqual(result['missing'],1);self.assertEqual(result['aggregation_status'],'period_mean_approximation')
    def test_layer_units_support_and_role_must_match(self):
        for first,second in [(series('LST','C',[20]),series('RH2M','%',[50])),(series('T2M','K',[293]),series('RH2M','%',[50]))]:
            with self.assertRaises(ValueError):diagnose({'method':'vpd_context','role':'aura','acquisitions':[first,second]})
        with self.assertRaises(ValueError):diagnose({'method':'vpd_context','role':'zoe','acquisitions':[]})
    def test_concentration_flow_units_and_no_integrated_mass_claim(self):
        result=diagnose({'method':'concentration_load','role':'thalassa','acquisitions':[series('concentration','mg/L',[10]),series('discharge','m3/s',[2])]})
        self.assertAlmostEqual(result['series'][0]['value'],0.02);self.assertEqual(result['units'],'kg/s');self.assertIn('no integrated mass',result['limitations'][1])
    def test_occurrences_cannot_become_abundance_or_mortality(self):
        result=diagnose({'method':'animal_observation','role':'zoe','records':[{'key':1,'eventDate':'2001-01-01'},{'key':1,'eventDate':'2001-01-01'}]})
        self.assertEqual(result['duplicate_ids'],1);self.assertEqual(result['permitted_inference'],'occurrence_context_only');self.assertIsNone(result['mortality'])
