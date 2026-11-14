import '../app/backend/runtime.mjs';
import { science } from '../app/backend/science.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
let result;
try{const response=await science({operation:'noaa_stations',latitude:53.91,longitude:-122.75,start:2001,end:2025});result={service:'NOAA CDO',status:'metadata_access_verified',stations:response.stations.length,provenance:response.provenance,limitation:'Station discovery only; no station trend or independent observational comparison claimed.'};}
catch{result={service:'NOAA CDO',status:'unavailable_within_budget',limitation:'No token-validity or station-data claim is made on a failed request.'};}
await mkdir('.runtime/proofs',{recursive:true});await writeFile('.runtime/proofs/noaa-access.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
