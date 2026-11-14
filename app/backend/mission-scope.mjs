import { sha256 } from './security.mjs';

const integer=(value,min,max)=>Number.isInteger(value)&&value>=min&&value<=max;

export function freezeMissionScope(sites,input,created=new Date().toISOString()){
 if(!Array.isArray(sites))throw Error('Load the current NASA fixed-site catalog before selecting a vegetation mission.');
 if(typeof input?.siteid!=='string'||!/^[A-Za-z0-9_-]{1,120}$/.test(input.siteid))throw Error('Select a real NASA MODIS fixed-site identifier.');
 const site=sites.find(item=>item.siteid===input.siteid);
 if(!site)throw Error('That site is not in the current NASA provider catalog.');
 if(!integer(input.start,2000,2100)||!integer(input.end,input.start,2100))throw Error('Choose a MODIS period from 2000 onward with start year no later than end year.');
 const months=input.months;
 if(!Array.isArray(months)||months.length<1||months.length>12||months.some(month=>!integer(month,1,12))||new Set(months).size!==months.length)throw Error('Choose one to twelve distinct calendar months for the declared seasonal recipe.');
 const latitude=Number(site.latitude),longitude=Number(site.longitude);
 if(!Number.isFinite(latitude)||latitude< -90||latitude>90||!Number.isFinite(longitude)||longitude< -180||longitude>180)throw Error('NASA site catalog is missing valid fixed-site coordinates.');
 const selection={version:'modis-evi-fixed-site-v1',provider:'NASA MODIS / ORNL DAAC TESViS',product:'MOD13Q1.061',variable:'EVI',siteid:site.siteid,site_name:String(site.sitename||site.siteid).slice(0,180),latitude,longitude,start:input.start,end:input.end,months:[...months].sort((a,b)=>a-b),created};
 return{...selection,selection_sha256:sha256(selection),status:'user_selected_frozen_target'};
}

export function verifyMissionScope(scope){
 if(!scope||typeof scope!=='object')throw Error('Choose a NASA MODIS mission target before CHLORIS can acquire vegetation evidence.');
 const{selection_sha256,status,...selection}=scope;
 if(status!=='user_selected_frozen_target'||selection.version!=='modis-evi-fixed-site-v1'||sha256(selection)!==selection_sha256)throw Error('The frozen NASA vegetation target is invalid or was changed; select and freeze it again.');
 return selection;
}

export function missionAcquisitionRequest(scope){
 const selection=verifyMissionScope(scope);
 return{operation:'modis',siteid:selection.siteid,latitude:selection.latitude,longitude:selection.longitude,start:selection.start,end:selection.end,months:[...selection.months],label:selection.site_name};
}

export function sameMissionArtifact(artifact,selection){
 const acquisition=artifact?.acquisition,geometry=acquisition?.geometry,recipe=acquisition?.provenance?.recipe;
 return acquisition?.provenance?.product==='MOD13Q1'&&acquisition?.variable?.id==='EVI'&&geometry?.siteid===selection.siteid&&geometry?.latitude===selection.latitude&&geometry?.longitude===selection.longitude&&artifact.analysis?.requested_start===`${selection.start}-01-01`&&artifact.analysis?.requested_end?.startsWith(`${selection.end}-`)&&JSON.stringify(recipe?.months)===JSON.stringify(selection.months);
}
