//! Public output and execution metadata only. No provider reasoning text.
use super::*;

pub fn apply_updates(s:&mut State)->bool{
    let Ok(updates)=serde_json::from_str::<Vec<Value>>(&gaia_updates())else{return false;};
    if updates.is_empty(){return false;}
    let Some(sessions)=s.snapshot["status"]["sessions"].as_array_mut()else{return false;};
    let mut changed=false;
    for patch in updates{
        if patch["sessionID"].as_str()!=Some(s.selected.as_str()){continue;}
        let Some(current)=sessions.iter_mut().find(|current|current["id"]==patch["sessionID"])else{continue;};
        if !current["liveTurns"].is_array(){current["liveTurns"]=json!([]);}
        let turns=current["liveTurns"].as_array_mut().unwrap();
        let index=turns.iter().position(|turn|turn["id"]==patch["id"]);
        let index=match index{Some(index)=>index,None=>{if !patch["turn"].is_object(){continue;}turns.push(patch["turn"].clone());changed=true;turns.len()-1}};
        let turn=&mut turns[index];
        if turn["sequence"].as_u64().unwrap_or(0)>=patch["sequence"].as_u64().unwrap_or(0){continue;}
        if let Some(value)=patch["text"].as_str(){turn["text"]=json!(value);}
        if let Some(append)=patch["append"].as_str(){if let Some(value)=turn["text"].as_str(){turn["text"]=json!(format!("{value}{append}"));}else{turn["text"]=json!(append);}}
        for key in ["thinking","status","connection"]{if !patch[key].is_null(){turn[key]=patch[key].clone();}}
        if !patch["status"].is_null(){turn["thinking"]=json!(false);}
        if !turn["tools"].is_array(){turn["tools"]=json!([]);}
        let tools=turn["tools"].as_array_mut().unwrap();
        for tool in list(&patch["tools"]){if let Some(found)=tools.iter_mut().find(|found|found["id"]==tool["id"]){*found=tool.clone();}else{tools.push(tool.clone());}}
        turn["sequence"]=patch["sequence"].clone();changed=true;
    }
    changed
}

pub fn section(value:impl Into<String>)->El{text(value.into()).font(TextStyle::new(12.,500.).mono().tracking(0.5)).color(workspace::muted()).w_full().wrap()}
pub fn chevron(open:bool)->El{
    let path=if open{vec![[3.,5.],[7.,9.],[11.,5.]]}else{vec![[5.,3.],[9.,7.],[5.,11.]]};
    rune::canvas(rune::Shape::new().stroke(path,1.3,workspace::muted())).size(14.,14.).min_w(14.)
}
fn phase(current:&Value,role:&str,turns:&[&Value])->String{
    if role=="gaia"&&current["chatRunning"].as_bool().unwrap_or(false){
        if let Some(turn)=turns.iter().rev().find(|turn|string(&turn["status"])=="running"){
            return match string(&turn["phase"]).as_str(){"Writing the report"=>"Writing the response".into(),"Investigating"=>"Reviewing evidence".into(),_=>string(&turn["phase"])};
        }
        if list(&current["extractions"]).iter().any(|item|item["graphID"]==current["activeGraphID"]&&matches!(string(&item["status"]).as_str(),"pending"|"processing"|"collecting"|"reconnecting")){return "Waiting for NASA data".into();}
        if list(&current["taskGraph"]["requests"]).iter().any(|item|matches!(string(&item["status"]).as_str(),"starting"|"running"|"queued")){return "Specialists at work".into();}
        return "Preparing the next step".into();
    }
    if current["chatRunning"].as_bool().unwrap_or(false){"Reviewing evidence".into()}else{"Execution record".into()}
}
pub fn role(s:&State,k:&Kit,current:&Value,role:&str,show_output:bool)->El{
    let turns=list(&current["liveTurns"]);
    let graph=if current["activeGraphID"].is_string(){string(&current["activeGraphID"])}else{turns.last().map(|t|string(&t["graphID"])).unwrap_or_default()};
    let turns:Vec<_>=turns.iter().filter(|turn|string(&turn["role"])==role&&string(&turn["graphID"])==graph).collect();
    let running=current["chatRunning"].as_bool().unwrap_or(false);
    if turns.is_empty()&&!(running&&role=="gaia"){return col().into();}
    let key=format!("activity-{}-{graph}-{role}",s.selected);let expanded=s.expanded_activity.contains(&key);
    let title=if running{"Thinking"}else{"Activity"};let phase=phase(current,role,&turns);
    let count:usize=turns.iter().map(|turn|list(&turn["tools"]).len()).sum();
    let mut body=col().w_full().gap(10.).child(
        Button::new(format!("{title}: {phase}. {} execution activity",if expanded{"Hide"}else{"Show"}))
            .help("Show execution metadata, not private reasoning.").expanded(expanded).variant(rune_kit::ButtonVariant::Ghost)
            .label_with(move|_,_|row().w_full().min_w(0.).items_center().gap(8.)
                .child(chevron(expanded))
                .child(text(title).font(TextStyle::new(13.,500.)).color(workspace::muted()))
                .child(text(phase.clone()).font(TextStyle::new(13.,400.)).color(workspace::color("#89939e")).grow(1.).min_w(0.).max_lines(1))
                .child(text(if count>0{format!("{count} actions")}else{String::new()}).font(TextStyle::new(11.,400.)).color(workspace::color("#89939e"))).into())
            .build(k).w_full().min_h(32.).padding(6.).radius(6.)
            .on_press(move|s:&mut State|{if !s.expanded_activity.remove(&key){s.expanded_activity.insert(key.clone());}}));
    if expanded{
        let mut record=col().w_full().gap(10.).padding(12.).border_sides([0.,0.,0.,1.],workspace::color("#30363d"));
        if turns.is_empty(){record=record.child(label_text("Preparing the investigation. Recorded actions will appear here."));}
        for turn in &turns{
            record=record.child(text(string(&turn["phase"])).font(TextStyle::new(12.,500.)).color(workspace::muted()).w_full().wrap());
            for tool in list(&turn["tools"]){record=record.child(row().w_full().gap(12.).child(label_text(string(&tool["label"])).grow(1.).min_w(0.)).child(text(string(&tool["status"])).font(TextStyle::new(11.,400.)).color(workspace::muted())));}
            if string(&turn["connection"])=="interrupted"{record=record.child(label_text("Live output interrupted. Retained results remain available; completion is not assumed."));}
        }
        record=record.child(text("Execution activity only. Private reasoning is not displayed.").font(TextStyle::new(11.,400.)).color(workspace::color("#89939e")).w_full().wrap());
        body=body.child(record);
    }
    for turn in turns{
        let output=string(&turn["text"]);
        let reviewed=!current["roleSummaries"][role]["text"].is_null();
        let public_answer=role!="gaia"||string(&turn["phase"])=="Writing the report";
        if show_output&&public_answer&&!output.is_empty()&&(running||!reviewed&&role!="gaia")&&!matches!(string(&turn["status"]).as_str(),"rejected"|"superseded"){
            if role!="gaia"{body=body.child(section("LIVE DRAFT · NOT A COMPLETED ASSESSMENT"));}
            body=body.child(rune::memo(format!("stream-text-{}",string(&turn["id"])),(&output,list(&current["literature"]).len()),||prose::view(&output,current,running)));
        }
    }
    body.into()
}
fn label_text(value:impl Into<String>)->El{text(value.into()).font(TextStyle::new(14.,400.)).color(workspace::muted()).w_full().wrap_anywhere()}
