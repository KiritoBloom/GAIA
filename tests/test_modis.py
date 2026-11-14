import unittest
from unittest.mock import patch
from urllib.parse import urlparse,parse_qs
from science.modis_identity import identify_rows
from science.acquisition import modis

def row(**extra):
    return {'modis_date':'A2024129','tile':'h10v04','proc_date':'2024137223443',**extra}

def catalog(version='061',processing='2024137223443'):
    return {'feed':{'entry':[{'title':f'MOD13Q1.A2024129.h10v04.{version}.{processing}','id':'G-SYNTHETIC-TEST','collection_concept_id':'C-SYNTHETIC-TEST'}]}}

class ModisIdentityTests(unittest.TestCase):
    def test_missing_filename_resolves_exact_published_identity(self):
        versions,proof=identify_rows([row()],2024,2024,lambda url:(catalog(),{'url':url,'synthetic':True}))
        self.assertEqual(versions,['061'])
        self.assertEqual(len(proof['matched_granules']),1)
        self.assertIn('NASA CMR',proof['matched_granules'][0]['source'])
    def test_different_processing_timestamp_cannot_prove_collection(self):
        with self.assertRaises(ValueError):identify_rows([row()],2024,2024,lambda url:(catalog(processing='2024137223444'),{}))
    def test_conflicting_science_qa_collection_rejected(self):
        with self.assertRaises(ValueError):identify_rows([row(version='006'),row(version='061')],2024,2024,lambda url:({},{}))
    def test_filename_cannot_disagree_with_observation(self):
        with self.assertRaises(ValueError):identify_rows([row(filename='MOD13Q1.A2024001.h10v04.061.2024137223443.hdf')],2024,2024,lambda url:({},{}))
    def test_unverifiable_revisions_are_explicitly_excluded_not_guessed(self):
        versions,proof=identify_rows([row(),row(modis_date='A2024145',proc_date='2024160000000')],2024,2024,lambda url:(catalog(),{}))
        self.assertEqual(versions,['061'])
        self.assertEqual(len(proof['matched_granules']),1)
        self.assertEqual(len(proof['excluded_granules']),1)

class ModisRecipeTests(unittest.TestCase):
    def retrieve(self,url):
        if url.endswith('/sites'):
            return {'sites':[{'siteid':'synthetic_site','latitude':20,'longitude':30,'sitename':'Synthetic unit-test footprint'}]},{}
        if 'cmr.earthdata' in url:return catalog(),{'synthetic':True}
        band=parse_qs(urlparse(url).query)['band'][0]
        data={'250m_16_days_EVI':[2500,3000],'250m_16_days_pixel_reliability':[0,0],'250m_16_days_VI_Quality':self.qa,'250m_16_days_composite_day_of_the_year':[129,130]}[band]
        return {'band':band,'scale':'0.0001','nrows':1,'ncols':2,'cellsize':250,'latitude':20,'longitude':30,'xllcorner':0,'yllcorner':0,'subset':[row(band=band,data=data)]},{'synthetic':True}
    def acquire(self):
        with patch('science.acquisition.read_json',side_effect=self.retrieve):
            return modis({'siteid':'synthetic_site','latitude':20,'longitude':30,'start':2024,'end':2024,'months':[5]})
    def test_raw_scale_quality_actual_observation_month_and_annual_recipe(self):
        self.qa=[0,0]
        result=self.acquire()
        self.assertAlmostEqual(result['series'][0]['value'],.275)
        self.assertEqual(result['frequency'],'annual')
        self.assertEqual(result['bandwidth'],2)
        self.assertEqual(result['provenance']['collection_versions'],['061'])
        self.assertEqual(len(result['provenance']['band_requests']),4)
    def test_invalid_quality_cannot_be_cast_into_good_bits(self):
        self.qa=[-65536,0.25]
        result=self.acquire()
        self.assertIsNone(result['series'][0]['value'])
        self.assertEqual(result['provenance']['qa_diagnostics'][0]['valid_fraction'],0)

if __name__=='__main__':unittest.main()
