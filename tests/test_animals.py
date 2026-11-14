import unittest
from unittest.mock import patch
from science.animals import occurrences

class AnimalContracts(unittest.TestCase):
    def test_license_taxonomy_scope_and_sensitive_fields(self):
        taxon={'matchType':'EXACT','rank':'SPECIES','kingdom':'Animalia','usageKey':1,'scientificName':'Declared test species'}
        good={'key':10,'speciesKey':1,'kingdom':'Animalia','decimalLatitude':1,'decimalLongitude':2,'year':2001,'license':'http://creativecommons.org/licenses/by/4.0/legalcode','recordedBy':'Private observer','eventDate':'2001-01-01'}
        with patch('science.animals.read_json',side_effect=[(taxon,{}),({'results':[good,{**good,'key':11,'license':'http://creativecommons.org/licenses/by-nc/4.0/legalcode'}],'count':2},{})]):result=occurrences({'latitude':1,'longitude':2,'start':2001,'end':2002,'scientific_name':'Declared test species'})
        self.assertEqual(len(result['records']),1);self.assertEqual(len(result['rejected']),1)
        self.assertNotIn('decimalLatitude',result['records'][0]);self.assertNotIn('recordedBy',result['records'][0]);self.assertIsNone(result['records'][0]['samplingEffort'])
    def test_fuzzy_or_plant_match_cannot_become_animal_evidence(self):
        with patch('science.animals.read_json',return_value=({'matchType':'FUZZY','rank':'SPECIES','kingdom':'Plantae'},{})):
            with self.assertRaises(ValueError):occurrences({'latitude':1,'longitude':2,'start':2001,'end':2002,'scientific_name':'Uncertain name'})
