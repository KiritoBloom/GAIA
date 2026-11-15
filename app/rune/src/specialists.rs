//! Read-only specialist extensions of the single GAIA investigation.
use super::*;
const IDS:[&str;5]=["gaia","aura","thalassa","chloris","zoe"];
const TITLES:[&str;5]=["Investigation coordination","Atmosphere & climate","Water & aquatic systems","Plants & optical evidence","Animals & observation ecology"];
const DESCRIPTIONS:[&str;5]=[
    "The investigation owner. Integrates measured evidence, specialist reviews and unresolved questions.",
    "Weather, atmospheric composition and environmental demand, with explicit spatial and temporal support.",
    "Catchments, flow and aquatic chemistry. Separates water compartments and measurements from hypotheses.",
    "Plant responses, phenology and optical quality. Greenness is a proxy—not mortality, biodiversity or a biome mask.",
    "Taxonomy, sampling effort and animal exposure. Occurrences alone cannot establish population change or deaths."
];
fn note(value:impl Into<String>)->El{text(value.into()).font(TextStyle{line_height:20.,..workspace::font(12.,400.)}).color(workspace::muted()).w_full().wrap_anywhere()}
fn region(title:&str)->El{col().w_full().gap(12.).child(text(title).font(workspace::font(16.,550.)).color(workspace::ink()).w_full().wrap())}
pub fn view(s:&State,k:&Kit,current:&Value,index:usize)->El{
    let id=IDS[index];let review=&current["roleSummaries"][id];
    let tasks:Vec<_>=list(&current["taskGraph"]["requests"]).into_iter().filter(|task|task["role"].as_str()==Some(id)).collect();
    let status=tasks.last().map(|task|match string(&task["status"]).as_str(){"completed"=>"Review complete","running"=>"Reviewing evidence","starting"=>"Starting","failed"=>"Review interrupted","cancelled"=>"Cancelled",_=>"Assigned"}).unwrap_or("Not requested");
    let identity=col().grow(1.).min_w(0.).gap(8.)
        .child(text(TITLES[index]).font(workspace::font(22.,550.)).color(workspace::ink()).w_full().wrap())
        .child(note(DESCRIPTIONS[index]));
    let mut body=col().w_full().max_w(760.).gap(22.)
        .child(row().w_full().items_start().gap(14.).child(if let Some(mark)=s.marks.get(index){el().size(32.,32.).pixels(mark.pixels())}else{el().size(32.,32.)}).child(identity))
        .child(note(format!("{status} · {} evidence records · {} sources · GAIA-owned, read-only",list(&review["evidence_ids"]).len(),list(&review["sources"]).len())))
        .child(live::role(s,k,current,id,true));
    for task in &tasks{if !task["failure"].is_null(){body=body.child(note(format!("Retained interruption: {}",string(&task["failure"]))));}}
    let mut findings=region("Findings");
    if review["text"].is_null(){findings=findings.child(note("No completed review yet. Any live draft is provisional; completion requires the retained review and actual evidence."));}
    else{let content=string(&review["text"]);let same_graph=review["graphID"]==current["taskGraph"]["id"];
        findings=findings.child(note(format!("{} · {}",if same_graph{"Reviewed"}else{"Earlier retained review"},string(&review["time"]).split('T').next().unwrap_or(""))))
            .child(rune::memo(format!("specialist-review-{}-{id}",s.selected),(&content,list(&current["literature"]).len()),||prose::view(&content,current,false)));}
    body=body.child(findings);
    if !list(&review["gaps"]).is_empty(){let gaps=list(&review["gaps"]).iter().map(|gap|format!("- {}",string(gap))).collect::<Vec<_>>().join("\n\n");
        body=body.child(region("Open questions & limitations").child(prose::view(&gaps,current,false)));}
    let evidence_key=format!("specialist-sources-{}-{id}",s.selected);let evidence_open=s.expanded_activity.contains(&evidence_key);
    body=body.child(workspace::disclosure(k,"Evidence & source records",evidence_open,evidence_key));
    if evidence_open{
    let mut evidence=col().w_full().gap(16.);
    for evidence_id in list(&review["evidence_ids"]){
        if let Some(artifact)=list(&current["artifacts"]).iter().find(|artifact|artifact["id"]==*evidence_id){
            let artifact_id=artifact["id"].clone();
            let title=format!("{} · {}",string(&artifact["acquisition"]["variable"]["name"]),string(&artifact["analysis"]["status"]));
            evidence=evidence.child(Button::new(title.clone()).variant(rune_kit::ButtonVariant::Ghost)
                .label_with(move|_,_|row().w_full().items_center().gap(10.).child(text(title.clone()).font(workspace::font(13.,500.)).color(workspace::muted()).grow(1.).min_w(0.).wrap()).child(live::chevron(false)).into())
                .build(k).w_full().min_h(34.).on_press(move|s:&mut State|{command("artifact-select",json!({"artifactID":artifact_id}));s.tab=Tab::Evidence;}));
        }else{evidence=evidence.child(note(format!("Retained evidence record · {}",string(evidence_id))));}
    }
    for source in list(&review["sources"]){let url=string(&source["url"]);let title=if source["title"].is_null(){url.clone()}else{string(&source["title"])};
        evidence=evidence.child(col().w_full().gap(10.).padding(12.).border_sides([0.,0.,0.,1.],workspace::color("#454e57"))
            .child(Button::new(title.clone()).variant(rune_kit::ButtonVariant::Ghost)
                .label_with(move|_,_|row().w_full().items_start().gap(10.).child(text(title.clone()).font(workspace::font(13.,500.)).color(workspace::ink()).grow(1.).min_w(0.).wrap()).child(live::chevron(false)).into())
                .build(k).w_full().min_h(32.).padding(4.).on_press(move|_:&mut State|{if url.starts_with("https://")||url.starts_with("http://"){let _=rune::web::open_url(&url);}}))
            .child(label(string(&source["quote"]))).child(note("Exact retrieved quotation. Not independent validation.")));}
    if list(&review["sources"]).is_empty()&&list(&review["evidence_ids"]).is_empty(){evidence=evidence.child(note("No source-linked review has been retained yet. Bibliographic metadata and live activity are not numerical findings."));}
    body=body.child(evidence);}
    let assignment_key=format!("specialist-assignment-{}-{id}",s.selected);let assignment_open=s.expanded_activity.contains(&assignment_key);
    body=body.child(workspace::disclosure(k,"Assigned work",assignment_open,assignment_key));
    if assignment_open{
        let mut assignment=col().w_full().gap(16.);
        if tasks.is_empty(){assignment=assignment.child(note("No task has been assigned. GAIA requests only specialists relevant to your question."));}
        for task in tasks{assignment=assignment.child(note(format!("{} · assigned by GAIA",string(&task["status"]))))
            .child(label(string(&task["question"])));}
        body=body.child(assignment);
    }
    if id=="chloris"&&!list(&current["extractions"]).is_empty(){body=body.child(workspace::processes(s,k,current));}
    let key=format!("specialist-details-{id}");let expanded=s.expanded_activity.contains(&key);
    body=body.child(workspace::disclosure(k,"Methods, diagnostics & ownership",expanded,key));
    if expanded{
        let profile=&s.snapshot["competence"]["profiles"][id];let mut methods=region("Procedures & execution record");
        for pack in list(&profile["skills"]){methods=methods.child(note(format!("{} · version {}",string(&pack["id"]),string(&pack["version"]))));}
        if !profile["competence"]["passed"].is_null(){methods=methods.child(note(format!("Internal authored checks: {} of {}. Not independent scientific certification.",number(&profile["competence"]["passed"]),number(&profile["competence"]["total"]))));}
        for receipt in list(&review["trace"]){methods=methods.child(note(format!("{} · {}",string(&receipt["tool"]),string(&receipt["time"]))));}
        for diagnostic in list(&current["domainDiagnostics"]).into_iter().filter(|item|item["role"].as_str()==Some(id)){methods=methods.child(heading(string(&diagnostic["method"]))).child(line("Scope",&diagnostic["summary"])).child(line("Units",&diagnostic["units"]));for limit in list(&diagnostic["limitations"]){methods=methods.child(note(string(limit)));}}
        for lifecycle in list(&current["threadLifecycle"]).iter().filter(|item|item["role"].as_str()==Some(id)){methods=methods.child(note(format!("Owned scope · version {} · {}",number(&lifecycle["version"]),string(&lifecycle["state"]))));}
        body=body.child(methods);
    }
    col().w_full().items_center().child(body).into()
}
