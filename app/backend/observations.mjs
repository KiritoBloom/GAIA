export function observationProtocol(session){
 const plan=session.observationPlan,protocol=plan?.protocol||plan;
 if(!protocol||typeof protocol.id!=='string'||!protocol.id.length)return null;
 return protocol;
}
