import unittest
from science.acquisition import import_csv

class ExportContracts(unittest.TestCase):
    def test_commented_portal_metadata_is_not_a_header(self):
        result=import_csv({'csv':'# Time bounds, 2001, 2025\n# Source: user-provided portal export\ntime,temperature,quality\n2001-01-01T00:00:00Z,2.5,good\n2001-02-01T00:00:00Z,3.5,good','source':'https://giovanni.gsfc.nasa.gov/giovanni/','units':'C','value_column':'temperature','domain':'aura'})
        self.assertEqual(result['series'][0]['value'],2.5)
        self.assertEqual(result['provenance']['authenticity'],'not_independently_authenticated')
    def test_explicit_columns_and_domain(self):
        result=import_csv({'csv':'observed,flow,other\n2001-01-01,3,4','date_column':'observed','value_column':'flow','source':'Publisher citation','units':'m3/s','domain':'thalassa'})
        self.assertEqual(result['variable']['domain'],'thalassa')
        self.assertEqual(result['series'][0]['value'],3)
    def test_ambiguous_values_or_invalid_date_suffix_rejected(self):
        base={'source':'Publisher citation','units':'C'}
        with self.assertRaises(ValueError):import_csv({**base,'csv':'date,x,y\n2001-01-01,2,3'})
        with self.assertRaises(ValueError):import_csv({**base,'csv':'date,value\n2001-01-01not-a-date,2'})
        with self.assertRaises(ValueError):import_csv({**base,'csv':'date,value\n2001-01-01T25:88:00Z,2'})
