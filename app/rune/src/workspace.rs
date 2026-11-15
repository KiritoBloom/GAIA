//! GAIA's branded workspace. Scientific execution remains application-owned.
use super::*;

pub fn color(hex:&str)->rune::Color{rune::color::hex(hex).unwrap_or(rune::Color::BLACK)}
pub fn font(size:f32,weight:f32)->TextStyle{TextStyle{family:rune::Family::Named("Geist"),..TextStyle::new(size,weight)}}
pub fn disclosure(k:&Kit,title:&str,expanded:bool,key:String)->El{
    let label=title.to_owned();
    Button::new(format!("{} {title}",if expanded{"Hide"}else{"Show"})).expanded(expanded).variant(rune_kit::ButtonVariant::Ghost)
        .label_with(move|_,_|row().w_full().items_center().gap(8.).child(live::chevron(expanded)).child(text(label.clone()).font(font(12.,500.)).color(muted()).grow(1.).min_w(0.)).into())
        .build(k).w_full().min_h(32.).padding(6.).radius(6.)
        .on_press(move|s:&mut State|{if !s.expanded_activity.remove(&key){s.expanded_activity.insert(key.clone());}})
}
pub fn ink()->rune::Color{color("#f0f0f2")}
pub fn muted()->rune::Color{color("#b3bbc4")}
const ROLES:[&str;5]=["gaia","aura","thalassa","chloris","zoe"];
const NAMES:[&str;5]=["GAIA","AURA","THALASSA","CHLORIS","ZOE"];
const ACCENTS:[&str;5]=["#7de3bc","#ff976a","#49e5cf","#cee96f","#cfb7f5"];
const POS:[(f32,f32);5]=[(170.,190.),(170.,50.),(290.,190.),(170.,330.),(50.,190.)];
enum Flight{Ready{key:String,from:usize,to:usize,at:f64},Moving{key:String,from:usize,to:usize,until:f64}}
#[derive(Default)]
pub struct Handoff{session:String,seen:std::collections::HashSet<String>,flights:Vec<Flight>}
pub fn observe(s:&mut State,now:f64,tx:&mut Tx){
    let selected=string(&s.snapshot["selected"]);
    if s.handoff.session!=selected{s.handoff=Handoff{session:selected.clone(),..Default::default()};}
    for event in list(&s.snapshot["motionEvents"]){
        if string(&event["sessionID"])!=selected{continue;}
        let key=string(&event["id"]);if !s.handoff.seen.insert(key.clone()){continue;}
        let Some(role)=ROLES.iter().position(|r|*r==string(&event["role"]))else{continue;};
        let (from,to)=match string(&event["type"]).as_str(){"worker.started"=>(0,role),"worker.completed"=>(role,0),_=>continue};
        if !s.snapshot["reducedMotion"].as_bool().unwrap_or(false){s.handoff.flights.push(Flight::Ready{key,from,to,at:now+0.025});tx.wake_at(now+0.025);}
    }
}
pub fn advance(s:&mut State,now:f64,tx:&mut Tx)->bool{
    let mut changed=false;
    for flight in &mut s.handoff.flights{
        if let Flight::Ready{key,from,to,at}=flight{if now>=*at{*flight=Flight::Moving{key:key.clone(),from:*from,to:*to,until:now+1.1};changed=true;tx.animated();}}
        let deadline=match flight{Flight::Ready{at,..}=>*at,Flight::Moving{until,..}=>*until};if deadline>now{tx.wake_at(deadline);}
    }
    s.handoff.flights.retain(|f|{let retain=!matches!(f,Flight::Moving{until,..}if now>=*until);if !retain{changed=true;}retain});
    changed
}
fn caption(value:impl Into<String>)->El{text(value.into()).font(TextStyle::new(12.,400.).mono()).color(muted()).w_full().wrap_anywhere()}
fn nav(k:&Kit,title:&str,tab:Tab,selected:bool)->El{
    Button::new(title).variant(if selected{rune_kit::ButtonVariant::Contrast}else{rune_kit::ButtonVariant::Ghost}).build(k).w_full().min_h(44.).on_press(move|s:&mut State|s.tab=tab)
}
fn role_status(current:&Value,index:usize)->String{
    if index==0{return if current["chatRunning"].as_bool().unwrap_or(false){"Coordinating"}else{"Ready"}.into();}
    list(&current["taskGraph"]["requests"]).iter().rev().find(|r|string(&r["role"])==ROLES[index]).map(|r|string(&r["status"])).unwrap_or_else(||"Not requested".into())
}
fn node(s:&State,k:&Kit,current:&Value,index:usize)->El{
    let status=role_status(current,index);let active=matches!(status.as_str(),"running"|"Coordinating"|"queued");
    let mut content=col().w(96.).gap(5.).items_center();
    if let Some(mark)=s.marks.get(index){content=content.child(el().size(if index==0{66.}else{54.},if index==0{66.}else{54.}).pixels(mark.pixels()));}
    content.child(Button::new(NAMES[index]).variant(rune_kit::ButtonVariant::Ghost).build(k).w_full().min_h(30.).color(color(ACCENTS[index])).label(format!("{}: {}. Open {}",NAMES[index],status,if index==0{"GAIA conversation"}else{"read-only specialist inspector"})).on_press(move|s:&mut State|s.tab=if index==0{Tab::Conversation}else{Tab::Inspector(index)}))
        .child(text(status).font(TextStyle::new(11.,500.)).color(if active{color(ACCENTS[index])}else{muted()}).w_full().wrap()).into()
}
pub fn constellation(s:&State,k:&Kit,current:&Value)->El{
    let mut board=el().w(340.).h(400.).role("group").label("GAIA coordination constellation. Specialist controls open read-only work records.");
    for index in 1..5{
        let (x,y)=POS[index];let active=matches!(role_status(current,index).as_str(),"running"|"queued"|"completed");
        let c=if active{color("#a6afb8")}else{color("#33383d")};
        let line=if index==1||index==3{el().w(1.).h(62.).absolute(170.,if index==1{108.}else{248.})}else{el().w(48.).h(1.).absolute(if index==2{222.}else{70.},190.)};
        board=board.child(line.fill(c)).child(node(s,k,current,index).absolute(x-48.,y-48.));
    }
    board=board.child(node(s,k,current,0).absolute(122.,142.));
    if !s.snapshot["reducedMotion"].as_bool().unwrap_or(false){for flight in &s.handoff.flights{
        let (key,from,to,moving)=match flight{Flight::Ready{key,from,to,..}=>(key,*from,*to,false),Flight::Moving{key,from,to,..}=>(key,*from,*to,true)};
        let (x,y)=POS[from];let (dest_x,dest_y)=POS[to];
        board=board.child(el().key(format!("handoff-{key}")).size(7.,7.).radius(4.).fill(color(ACCENTS[if from==0{to}else{from}])).absolute(x-3.5,y-3.5).motion(rune::Spring::new(0.65,0.)).offset(if moving{dest_x-x}else{0.},if moving{dest_y-y}else{0.}).label("Recorded evidence handoff"));
    }}
    col().w_full().gap(12.).child(row().w_full().gap(12.).child(text("SPECIALISTS").font(TextStyle::new(12.,500.).mono()).color(muted()).grow(1.).min_w(0.)).child(text(if s.snapshot["connected"].as_bool().unwrap_or(false){"Live"}else{"Offline"}).font(TextStyle::new(12.,400.).mono()).color(muted())))
        .child(board).child(caption("One conversation. Select a specialist to inspect its work. Motion follows recorded handoffs, never inferred confidence.")).into()
}
pub fn processes(s:&State,k:&Kit,current:&Value)->El{
    let mut body=col().w_full().gap(14.).child(live::section("DATA OPERATIONS"));let mut count=0;
    for extraction in list(&current["extractions"]){count+=1;let status=string(&extraction["status"]);
        body=body.child(caption("NASA / REGIONAL EXTRACTION")).child(label(status.clone())).child(caption(format!("Task {}",string(&extraction["task_id"]))));
        if !extraction["failure"].is_null(){body=body.child(line("Issue",&extraction["failure"]));}
        if status!="collected"&&!extraction["task_id"].is_null()&&!current["chatRunning"].as_bool().unwrap_or(false){body=body.child(button(k,"Resume original task","extraction-resume",json!({"sessionID":s.selected,"extraction_id":extraction["id"]})));}
    }
    for job in list(&s.snapshot["status"]["jobs"]).iter().filter(|j|string(&j["sessionID"])==s.selected){count+=1;
        body=body.child(label(format!("{} · {}",string(&job["operation"]),string(&job["status"]))));
        if string(&job["status"])=="running"{body=body.child(button(k,"Stop this job","stop",json!({"sessionID":s.selected,"jobID":job["id"]})));}
    }
    if count==0{body=body.child(caption("Numerical jobs and provider extractions appear here when actually requested. No jobs are running by default."));}
    body.into()
}
fn events(current:&Value)->El{
    let mut body=col().w_full().gap(12.).child(live::section("RECORDED ACTIVITY"));
    for event in list(&current["events"]).iter().rev().take(8){body=body.child(caption(format!("{} · {}",string(&event["time"]),string(&event["type"])))).child(label(string(&event["summary"])));}
    if list(&current["events"]).is_empty(){body=body.child(caption("No activity yet. Start with a question; GAIA will decide which evidence and specialists it needs."));}
    body.into()
}
pub fn system(s:&State,k:&Kit,current:&Value,compact:bool)->El{
    let mut intro=col().w_full().gap(14.).child(heading("One investigation. Connected perspectives.")).child(label("GAIA coordinates the work. These are live task states and retained evidence, not separate conversations."));
    if compact{for index in 0..5{intro=intro.child(node(s,k,current,index));}intro.child(processes(s,k,current)).child(events(current)).into()}
    else{intro.child(row().w_full().gap(32.).child(constellation(s,k,current)).child(col().grow(1.).min_w(0.).gap(28.).child(processes(s,k,current)).child(events(current)))).into()}
}
pub fn view(s:&State,cx:&mut Cx<State>)->El{
    let reduced=s.snapshot["reducedMotion"].as_bool().unwrap_or(false);cx.reduced_motion(reduced);
    let mut tokens=rune_theme_opencode::kit(true).clone();
    tokens.c.page=color("#101214");tokens.c.bg_base=color("#17191c");tokens.c.bg_deep=color("#121315");
    tokens.c.layer_01=color("#191c20");tokens.c.layer_02=color("#202429");tokens.c.layer_03=color("#262a2e");tokens.c.layer_04=color("#30353b");
    tokens.c.bg_contrast=color("#dce1e6");tokens.c.text_contrast=color("#15181b");tokens.c.icon_contrast=color("#15181b");tokens.c.submit_fg=color("#15181b");tokens.c.submit_icon=color("#15181b");tokens.c.border_focus=color("#a6afb8");tokens.c.text_base=ink();tokens.c.text_muted=muted();tokens.c.text_faint=color("#a0a0ab");tokens.c.bg_button_neutral=color("#22262a");
    tokens.c.bg_accent=color("#282d32");tokens.c.text_accent=ink();tokens.c.icon_accent=ink();tokens.c.border_base=color("#33383d");tokens.c.border_muted=color("#2a2f34");tokens.c.border_strong=color("#515961");
    tokens.c.surface_base=color("#17191c");tokens.c.surface_raised=color("#202429");tokens.c.surface_weak=color("#121315");tokens.c.text_strong=ink();tokens.c.text_weak=muted();
    tokens.ty.ui=TextStyle::new(15.,400.);tokens.ty.ui_medium=TextStyle::new(14.,550.);tokens.ty.ui_compact=TextStyle::new(16.,400.);tokens.ty.body=TextStyle::new(16.,400.);
    let k=&tokens;let current=session(s);let width=s.snapshot["viewportWidth"].as_f64().unwrap_or(1280.);let compact=width<900.;
    let running=current["chatRunning"].as_bool().unwrap_or(false);
    let title=match s.tab{Tab::Conversation=>"GAIA".to_owned(),Tab::Inspector(index)=>format!("{} workspace",ROLES[index]),Tab::System=>"Specialists".into(),Tab::Evidence=>"Evidence".into(),Tab::Investigation=>"Investigation record".into(),Tab::Research=>"Research".into(),Tab::Provider=>"Settings".into(),Tab::Sources=>"Sources & methods".into(),Tab::History=>"Investigations".into()};
    let mut top=row().w_full().min_h(36.).gap(10.).items_center();
    if compact||!sidebar::is_open(s,false){top=top.child(Button::new("Navigation").help("Open chat history and navigation").variant(rune_kit::ButtonVariant::Ghost)
        .label_with(|_,_|rune::canvas(rune::Shape::new().stroke(vec![[3.,5.],[17.,5.]],1.4,muted()).stroke(vec![[3.,10.],[17.,10.]],1.4,muted()).stroke(vec![[3.,15.],[17.,15.]],1.4,muted())).size(20.,20.))
        .build(k).min_h(34.).w(34.).on_press(move|s:&mut State|sidebar::toggle(s,compact)));}
    top=top.child(text(title).font(font(14.,550.)).color(ink()).min_w(0.));
    if running{top=top.child(text("Working").font(font(11.,400.)).color(muted()));}
    top=top.child(el().grow(1.).min_w(0.));
    if matches!(s.tab,Tab::Inspector(_)){top=top.child(Button::new("← GAIA").help("Return to the conversation").variant(rune_kit::ButtonVariant::Ghost).build(k).min_h(32.).on_press(|s:&mut State|s.tab=Tab::Conversation));}
    if running&&!matches!(s.tab,Tab::Conversation|Tab::Provider){top=top.child(Button::new("Stop").variant(rune_kit::ButtonVariant::Ghost).build(k).min_h(32.).on_press(|s:&mut State|command("chat-stop",selected_action(s))));}
    else if !running&&s.tab!=Tab::Provider&&!list(&current["artifacts"]).is_empty(){top=top.child(Button::new("Export").help("Export the complete investigation report").variant(rune_kit::ButtonVariant::Ghost).build(k).min_h(32.).on_press(|s:&mut State|command("report-export",selected_action(s))));}
    if width>=1200.&&s.tab!=Tab::Provider{top=top.child(Button::new(if s.canvas_open{"Hide panel"}else{"Evidence"}).help("Open or close the live-work and evidence panel").variant(rune_kit::ButtonVariant::Ghost).build(k).min_h(32.).on_press(|s:&mut State|s.canvas_open=!s.canvas_open));}
    let mut overlays=Vec::new();
    let content=match s.tab{Tab::Conversation=>chat::view(s,k,&current),Tab::System=>system(s,k,&current,compact),Tab::Evidence=>investigation(s,k,&current,compact),Tab::Investigation=>record_workspace(s,k),Tab::Research=>research(s,k,&current),Tab::Provider=>settings::view(s,k,&mut overlays),Tab::Sources=>inspect(k,"Data access and provenance",list(&s.snapshot["catalog"]["resources"])),Tab::Inspector(i)=>specialist(s,k,&current,i),Tab::History=>history(s,k)};
    let scroll=col().key(format!("view-{}-{}",tab_key(s.tab),s.selected)).grow(1.).min_h(0.).w_full().scroll(ScrollSpec{stick_bottom:running&&(s.tab==Tab::Conversation||matches!(s.tab,Tab::Inspector(_)))}).child(content);
    let mut center=col().grow(1.).min_w(0.).min_h(0.).gap(if compact{16.}else{20.}).padding(if compact{16.}else{24.}).child(top);
    if s.tab!=Tab::Provider&&!s.snapshot["status"]["configured"].as_bool().unwrap_or(false){center=center.child(Button::new("Connect a model to talk with GAIA").build(k).min_h(44.).on_press(|s:&mut State|s.tab=Tab::Provider));}
    if s.tab!=Tab::Provider&&!string(&s.snapshot["error"]).is_empty(){center=center.child(label(string(&s.snapshot["error"])).role("alert"));}
    center=center.child(scroll);
    if s.tab==Tab::Conversation{center=center.child(chat::composer(s,k,&current));}
    let mut page=if compact{col().w_full().grow(1.).min_h(0.)}else{row().w_full().grow(1.).min_h(0.)};
    if sidebar::is_open(s,compact){page=page.child(sidebar::view(s,k,compact));}page=page.child(center);
    if width>=1200.&&s.canvas_open&&!matches!(s.tab,Tab::System|Tab::Provider){
        let tabs=row().w_full().gap(6.).child(Button::new("Agents").variant(if !s.canvas_evidence{rune_kit::ButtonVariant::Contrast}else{rune_kit::ButtonVariant::Ghost}).build(k).min_h(42.).on_press(|s:&mut State|s.canvas_evidence=false)).child(Button::new("Evidence").variant(if s.canvas_evidence{rune_kit::ButtonVariant::Contrast}else{rune_kit::ButtonVariant::Ghost}).build(k).min_h(42.).on_press(|s:&mut State|s.canvas_evidence=true));
        let mut rail=col().w(360.).h_full().padding(16.).gap(18.).fill(color("#121518")).border_sides([0.,0.,0.,1.],color("#33383d")).child(caption(if s.canvas_evidence{"EVIDENCE RECORD"}else{"LIVE WORK"})).child(tabs);
        let mut pane=col().w_full().grow(1.).min_h(0.).gap(20.).scroll(ScrollSpec{stick_bottom:false});
        if s.canvas_evidence{pane=pane.child(evidence_preview(s,k,&current));}else{pane=pane.child(constellation(s,k,&current)).child(processes(s,k,&current)).child(events(&current));}
        rail=rail.child(pane);page=page.child(rail);
    }
    rune_kit::root(page.fill(color("#101214")).color(ink()).motion(rune::Spring::new(0.32,0.)),overlays)
}
fn tab_key(tab:Tab)->String{match tab{Tab::System=>"system",Tab::Conversation=>"conversation",Tab::Evidence=>"evidence",Tab::Investigation=>"record",Tab::Research=>"research",Tab::Provider=>"provider",Tab::Sources=>"sources",Tab::Inspector(_)=>"inspector",Tab::History=>"history"}.into()}
fn evidence_preview(s:&State,k:&Kit,current:&Value)->El{
    let mut body=col().w_full().gap(18.).child(heading("Evidence canvas"));
    if s.snapshot["artifact"].is_null(){return body.child(label("Source-backed findings will appear as GAIA acquires and checks them. Nothing is populated with demonstration data.")).into();}
    let a=&s.snapshot["artifact"];let analysis=&a["analysis"];let v=&a["acquisition"]["variable"];
    body=body.child(caption(string(&v["evidence_class"]))).child(heading(string(&v["name"]))).child(label(format!("{} to {} · {}",string(&analysis["requested_start"]),string(&analysis["requested_end"]),string(&v["units"]))))
        .child(label(format!("{} · {} valid / {} missing",string(&analysis["status"]),number(&analysis["n"]),number(&analysis["missing"]))));
    if let Some(image)=&s.chart{body=body.child(el().w_full().h(160.).pixels(image.pixels()));}
    body=body.child(caption("Light: observations. Dashed steel: fitted trend. Actual dates; missing values break the line."))
        .child(metric("Rate per decade",&analysis["slope_per_decade"])).child(metric("Nominal p-value",&analysis["p_value"]))
        .child(line("Interval / year",&analysis["interval"])).child(line("Actual support",&v["support"]))
        .child(Button::new("Inspect QA and methods").build(k).min_h(44.).on_press(|s:&mut State|s.tab=Tab::Evidence));
    for artifact in list(&current["artifacts"]){body=body.child(button(k,&format!("{} · {}",string(&artifact["acquisition"]["variable"]["name"]),string(&artifact["analysis"]["status"])),"artifact-select",json!({"artifactID":artifact["id"]})));}
    body.into()
}
