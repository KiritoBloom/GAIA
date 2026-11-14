import unittest
from unittest.mock import patch
from science.acquisition import power

class PowerContract(unittest.TestCase):
    def test_real_adapter_declares_monthly_frequency_and_excludes_annual_summary(self):
        document={'properties':{'parameter':{'T2M':{'200101':2,'200113':999}}},'header':{'fill_value':-999},'parameters':{'T2M':{'units':'C'}}}
        with patch('science.acquisition.read_json',return_value=(document,{'url':'https://power.larc.nasa.gov/'})):
            result=power({'latitude':1,'longitude':2,'start':2001,'end':2001,'variable':'T2M'})
        self.assertEqual(result['frequency'],'monthly')
        self.assertEqual(len(result['series']),12)
        self.assertEqual(result['series'][0]['value'],2)
        self.assertTrue(all(row['value']!=999 for row in result['series']))
