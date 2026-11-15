use std::cell::RefCell;
use std::sync::Arc;
use rune::{AppSpec, Cx, El, Image, ImageCache, ScrollSpec, TextEdit, TextStyle, Tx, Waker, col, el, row, text};
use rune_kit::{Button, Kit, TextInput, TextArea};
use serde_json::{Value, json};
use wasm_bindgen::prelude::*;

#[wasm_bindgen(inline_js = "export function gaia_snapshot(){return globalThis.gaiaSnapshot || '{}'} export function gaia_command(name,body){globalThis.gaiaCommand(name,JSON.parse(body))}")]
extern "C" {
    fn gaia_snapshot() -> String;
    fn gaia_command(name: &str, body: &str);
}

thread_local! { static WAKE: RefCell<Option<Waker>> = const { RefCell::new(None) }; }
#[wasm_bindgen]
pub fn notify() { WAKE.with(|slot| { if let Some(wake) = slot.borrow().as_ref() { wake(); } }); }

#[derive(Clone, Copy, PartialEq)]
enum Tab { System, Conversation, Evidence, Investigation, Research, Provider, Sources, Inspector(usize), History }
#[derive(Clone, Copy, PartialEq)]
enum ResearchView { Sources, Notebook, Models }
#[derive(Clone, Copy, PartialEq)]
enum EvidencePanel { Summary, Acquire }
#[derive(Clone, Copy, PartialEq)]
enum EvidenceView { Findings, Observation, Scenarios, Field, Audit }
#[derive(Clone, Copy, PartialEq)]
enum RecordView { Graph, Portfolio, Tests }
struct State {
    tab: Tab,
    selected: String,
    snapshot: Value,
    revision: String,
    fields: Vec<TextEdit>,
    field_domain: String,
    handoff_confirmed:bool,
    import_domain: String,
    research_view:ResearchView,
    record_view:RecordView,
    paper_id:String,
    evidence_panel: EvidencePanel,
    evidence_view: EvidenceView,
    audit_open: bool,
    cache: Option<ImageCache>,
    marks: Vec<Image>,
    chart: Option<Image>,
    chart_key: String,
    scenario: Option<Image>,
    scenario_key: String,
    graph:Option<Image>,
    graph_key:String,
}
impl Default for State {
    fn default() -> Self {
        let initial = ["", "53.91", "-122.75", "2001", "2025", "T2M", "", "", "", "", "", "", "monthly", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "2025", "5,6,7,8,9", "", ""];
        let mut fields=initial.into_iter().map(TextEdit::new).collect::<Vec<_>>();
        fields[30]=TextEdit::new("");
        fields[32]=TextEdit::new("5,6,7,8,9");
        fields[33]=TextEdit::new("");
        Self { tab: Tab::Conversation, selected: String::new(), snapshot: json!({}), revision: String::new(),
            fields,field_domain:"chloris".to_string(),handoff_confirmed:false,import_domain:"aura".to_string(),research_view:ResearchView::Sources,record_view:RecordView::Graph,paper_id:String::new(),evidence_panel:EvidencePanel::Summary,evidence_view:EvidenceView::Findings,audit_open:false,cache: None, marks: vec![], chart: None, chart_key: String::new(), scenario:None,scenario_key:String::new(),graph:None,graph_key:String::new() }
    }
}
fn setup(s: &mut State, wake: Waker) {
    WAKE.with(|slot| *slot.borrow_mut() = Some(wake.clone()));
    let cache = ImageCache::new(wake);
    s.marks = [include_bytes!("../../../artifacts/logos/gaia-icon.svg").as_slice(),
        include_bytes!("../../../artifacts/logos/aura-icon.svg").as_slice(),
        include_bytes!("../../../artifacts/logos/thalassa-icon.svg").as_slice(),
        include_bytes!("../../../artifacts/logos/chloris-icon.svg").as_slice(),
        include_bytes!("../../../artifacts/logos/zoe-icon.svg").as_slice()]
        .into_iter().map(|bytes| cache.load(Arc::<[u8]>::from(bytes))).collect();
    s.cache = Some(cache);
}
fn poll(s: &mut State, _: f64, _: &mut Tx) -> bool {
    let raw = gaia_snapshot();
    if raw == s.revision { return false; }
    let Ok(value) = serde_json::from_str::<Value>(&raw) else { return false; };
    s.revision = raw;
    s.snapshot = value;
    if let Some(selected)=s.snapshot["selected"].as_str() { if s.selected!=selected{s.fields[0]=TextEdit::new(&string(&s.snapshot["draft"]));s.tab=Tab::Conversation;s.selected=selected.to_owned();} }
    let draft=string(&s.snapshot["draft"]);
    if s.fields[0].text!=draft{s.fields[0]=TextEdit::new(&draft);}
    if let Some(candidate)=s.snapshot["providerCandidate"].as_object() {
        if s.fields[6].text.is_empty() { s.fields[6]=TextEdit::new(candidate.get("name").and_then(Value::as_str).unwrap_or("")); }
        if s.fields[7].text.is_empty() { s.fields[7]=TextEdit::new(candidate.get("endpoint").and_then(Value::as_str).unwrap_or("")); }
    }
    let svg = string(&s.snapshot["chartSvg"]);
    if svg != s.chart_key {
        s.chart_key = svg.clone();
        s.chart = s.cache.as_ref().filter(|_| !svg.is_empty()).map(|cache| cache.load(Arc::<[u8]>::from(svg.as_bytes())));
    }
    let scenario=string(&s.snapshot["scenarioSvg"]);
    if scenario!=s.scenario_key{s.scenario_key=scenario.clone();s.scenario=s.cache.as_ref().filter(|_|!scenario.is_empty()).map(|cache|cache.load(Arc::<[u8]>::from(scenario.as_bytes())));}
    let graph=string(&s.snapshot["graphSvg"]);
    if graph!=s.graph_key{s.graph_key=graph.clone();s.graph=s.cache.as_ref().filter(|_|!graph.is_empty()).map(|cache|cache.load(Arc::<[u8]>::from(graph.as_bytes())));}
    true
}
fn string(value: &Value) -> String { value.as_str().unwrap_or("").replace("Â·", "·") }
fn list(value: &Value) -> &[Value] { value.as_array().map(Vec::as_slice).unwrap_or(&[]) }
fn label(value: impl Into<String>) -> El { text(value.into()).font(TextStyle::new(14., 400.)).color(rune::color::hex("#24352b").unwrap_or(rune::Color::BLACK)).w_full().wrap_anywhere() }
fn heading(value: impl Into<String>) -> El { text(value.into()).font(TextStyle::new(24., 600.)).color(rune::color::hex("#24352b").unwrap_or(rune::Color::BLACK)).w_full().wrap() }
fn report_text(value:&str)->El{
    let mut body=col().w_full().gap(7.);
    for source in value.lines(){
        let item=source.trim();if item.is_empty(){continue;}
        if let Some(title)=item.strip_prefix("### "){body=body.child(text(title).font(TextStyle::new(16.,650.)).color(rune::color::hex("#24352b").unwrap_or(rune::Color::BLACK)).w_full().wrap());}
        else if let Some(title)=item.strip_prefix("## "){body=body.child(text(title).font(TextStyle::new(20.,650.)).color(rune::color::hex("#24352b").unwrap_or(rune::Color::BLACK)).w_full().wrap());}
        else if let Some(title)=item.strip_prefix("# "){body=body.child(text(title).font(TextStyle::new(24.,650.)).color(rune::color::hex("#24352b").unwrap_or(rune::Color::BLACK)).w_full().wrap());}
        else if ["Executive conclusion","Evidence and findings","Rates are not accumulated rainfall","Method and interpretation","Sensitivity and QA","Specialist review and source dependence","Spatial support and alternative interpretations","Provenance and sources","Remaining limitations"].contains(&item) || (item.chars().any(char::is_alphabetic) && item==item.to_uppercase() && item.chars().count()<100){body=body.child(heading(item));}
        else if let Some(point)=item.strip_prefix("- ").or_else(||item.strip_prefix("* ")){body=body.child(label(format!("• {point}")));}
        else if item.starts_with("| "){body=body.child(label(item));}
        else if !item.starts_with("```") {body=body.child(label(item));}
    }
    body.into()
}
fn line(title: &str, value: &Value) -> El {
    let content = match value { Value::Null => "Not available".to_owned(), Value::String(v) => v.clone(), _ => value.to_string() };
    col().w_full().gap(4.).child(text(title).font(TextStyle::new(12., 600.)).color(rune::color::hex("#24352b").unwrap_or(rune::Color::BLACK))).child(label(content)).into()
}
fn surface(body:El,background:&str)->El{
    body.fill(rune::color::hex(background).unwrap_or(rune::Color::BLACK)).radius(14.).padding(20.)
}
fn number(value:&Value)->String{
    if let Some(values)=value.as_array(){return values.iter().map(number).collect::<Vec<_>>().join(" to ");}
    let Some(v)=value.as_f64() else{return "Not estimable".into()};
    if value.is_i64()||value.is_u64(){return value.to_string();}
    if v!=0.&&v.abs()<0.0001{format!("{v:.3e}")}else{format!("{v:.4}")}
}
fn metric(title:&str,value:&Value)->El{
    col().grow(1.).min_w(0.).gap(5.).child(text(title).font(TextStyle::new(12.,500.)).color(rune::color::hex("#24352b").unwrap_or(rune::Color::BLACK))).child(text(number(value)).font(TextStyle::new(23.,500.)).color(rune::color::hex("#24352b").unwrap_or(rune::Color::BLACK)).w_full().wrap()).into()
}
fn evidence_summary(s:&State,k:&Kit)->El{
    let artifact=&s.snapshot["artifact"];let variable=&artifact["acquisition"]["variable"];let analysis=&artifact["analysis"];
    let mut body=col().w_full().gap(16.).child(heading(string(&variable["name"])))
        .child(label(format!("{} · {} · {}",string(&variable["evidence_class"]),string(&variable["units"]),string(&variable["cadence"]))))
        .child(label(match analysis["status"].as_str().unwrap_or(""){"detected"=>"Linear trend detected under the declared assumptions.","not_detected"=>"Linear trend not detected at the nominal significance threshold.","descriptive_only"=>"Descriptive slope only; statistical inference withheld.",_=>"Statistical inference is inconclusive."}))
        .child(row().w_full().gap(20.).child(metric("Rate per decade",&analysis["slope_per_decade"])).child(metric("95% slope interval per year",&analysis["interval"])).child(metric("Nominal p-value",&analysis["p_value"])))
        .child(row().w_full().gap(20.).child(metric("Valid observations",&analysis["n"])).child(metric("Missing observations",&analysis["missing"])))
        .child(label(format!("Period: {} to {}. {}",string(&analysis["requested_start"]),string(&analysis["requested_end"]),string(&artifact["acquisition"]["geometry"]["label"]))));
    if let Some(chart)=&s.chart{body=body.child(el().w_full().h(260.).pixels(chart.pixels())).child(label(format!("Source values: green. Fitted trend: gold. Units: {}. Actual dated observations; missing periods remain gaps.",string(&variable["units"]))));}
    body=body.child(line("Spatial support",&variable["support"]));
    let identity=&artifact["acquisition"]["provenance"]["collection_identity_evidence"];
    if !identity.is_null(){body=body.child(label(format!("Collection {} verified: {} exact granule identities; {} unverifiable revisions excluded. Raw QA and actual observation dates are retained in the export.",string(&artifact["acquisition"]["provenance"]["collection_versions"][0]),list(&identity["matched_granules"]).len(),list(&identity["excluded_granules"]).len())));}
    body=body.child(Button::new(if s.audit_open{"Hide method and provenance details"}else{"Inspect method and provenance details"}).build(k).on_press(|s:&mut State|s.audit_open=!s.audit_open));
    if s.audit_open{body=body.child(line("Methods",&analysis["specification"])).child(line("Limitations",&analysis["limitations"])).child(line("Sources",&analysis["sources"])).child(line("Acquisition and QA",&artifact["acquisition"]["provenance"]));}
    body.into()
}
fn command(name: &str, body: Value) { gaia_command(name, &body.to_string()); }
fn button(k: &Kit, title: &str, operation: &'static str, body: Value) -> El {
    Button::new(title).build(k).min_h(44.).on_press(move |_: &mut State| command(operation, body.clone()))
}
fn field(s: &State, k: &Kit, index: usize, title: &str, secure: bool) -> El {
    let input = TextInput::new(&s.fields[index]).label(title).on_edit(move |s: &mut State| &mut s.fields[index]);
    let input = if secure { input.secure() } else { input };
    col().w_full().gap(5.).child(label(title)).child(input.build(k).w_full().min_h(44.)).into()
}
fn session(s: &State) -> Value {
    list(&s.snapshot["status"]["sessions"]).iter().find(|v| string(&v["id"]) == s.selected).cloned().unwrap_or(json!({}))
}
fn selected_action(s: &State) -> Value { json!({"sessionID":s.selected}) }
fn inspect(k: &Kit, title: &str, values: &[Value]) -> El {
    let mut body = col().w_full().gap(14.).child(heading(title));
    if values.is_empty() { body = body.child(label("No records.")); }
    for item in values.iter().rev().take(20) {
        let mut card=col().w_full().gap(8.);
        if title=="Experimental Jev judgments (shadow only)" {
            card=card.child(label(format!("{} · {}",string(&item["status"]),string(&item["influence"]))))
                .child(line("Intent",&item["answers"]["intent"]["choice"]))
                .child(line("Context-fit score (experimental, not calibrated)",&item["answers"]["fit"]["score"]))
                .child(line("Evidence judgment",&item["answers"]["support"]["choice"]))
                .child(line("Limitations",&item["limitation"]));
        } else if title=="Recorded execution events" {
            card=card.child(label(format!("{} · {}",string(&item["time"]),string(&item["type"]))))
                .child(label(string(&item["summary"])));
            for key in ["role","operation"] {if !item[key].is_null(){card=card.child(line(if key=="role"{"Function"}else{"Operation"},&item[key]));}}
        } else {
            for (key,name) in [("model","Model"),("status","Status"),("readiness","Readiness"),("classification","Classification"),("summary","Summary"),("reason","Reason"),("limitation","Limitations"),("horizon","Horizon"),("rmse","RMSE"),("baseline_rmse","Baseline RMSE")] {
                if !item[key].is_null(){card=card.child(line(name,&item[key]));}
            }
        }
        body=body.child(surface(card,"#f3f2ec"));
    }
    body.child(button(k,"Refresh records","refresh",json!({}))).into()
}
fn provider(s: &State, k: &Kit) -> El {
    let mut body = col().w_full().gap(14.).child(heading("Model provider"))
        .child(label("Keys are entered in a masked field and sent only to the local backend. Remote inference may incur costs."))
        .child(button(k,"Discover configured provider models","provider-discover",json!({})))
        .child(field(s,k,6,"Provider name",false)).child(field(s,k,7,"Compatible API base URL",false))
        .child(field(s,k,8,"API key (session only)",true)).child(field(s,k,9,"Model identifier",false));
    for model in list(&s.snapshot["models"]).iter() {
        let name=string(model); let picked=name.clone();
        body=body.child(Button::new(name).build(k).on_press(move |s: &mut State| s.fields[9]=TextEdit::new(&picked)));
    }
    body=body.child(Button::new("Discover endpoint models").build(k).on_press(|s: &mut State| {
        command("provider-models",json!({"endpoint":s.fields[7].text,"apiKey":s.fields[8].text}));
    })).child(Button::new("Connect provider and start with GAIA").variant(rune_kit::ButtonVariant::Submit).build(k).on_press(|s: &mut State| {
        command("provider-connect",json!({"name":s.fields[6].text,"endpoint":s.fields[7].text,"apiKey":s.fields[8].text,"model":s.fields[9].text}));
        s.fields[8]=TextEdit::new("");
    })).child(button(k,"Disconnect and clear provider key","provider-remove",json!({})))
        .child(line("Connected",&s.snapshot["status"]["configured"]))
        .child(label("The optional role/tool check is synthetic routing evidence, not scientific validation. You can chat as soon as a provider is connected; real source failures are reported within the investigation."))
        .child(button(k,"Run optional synthetic role/tool check","provider-proof",json!({})));
    if !s.snapshot["status"]["proof"].is_null(){body=body.child(line("Actual role checks completed",&s.snapshot["status"]["proof"]["completed"])).child(line("Role checks in progress",&s.snapshot["status"]["proof"]["active"]));}
    body.into()
}
fn conversation(s: &State, k: &Kit, current: &Value) -> El {
    let running=current["chatRunning"].as_bool().unwrap_or(false);
    let mut body=col().w_full().max_w(980.).gap(18.).child(heading("Talk to GAIA"))
        .child(label("Tell GAIA what changed, where, and what you want to understand. She’ll fill in the method, data and specialist work; she’ll ask only if a missing detail would change the investigation."));
    if running{body=body.child(surface(row().w_full().gap(10.).child(label("Investigation in progress · completed evidence is retained as it arrives")).child(button(k,"Stop","chat-stop",selected_action(s))),"#e3eee5"));}
    for extraction in list(&current["extractions"]){
        let mut progress=col().w_full().gap(8.).child(heading("NASA regional extraction")).child(line("Provider task",&extraction["task_id"])).child(line("Status",&extraction["status"])).child(label("NASA processes the declared vegetation index and QA for the owned polygon. Values, support and checksums must be verified before a trend is published."));
        if string(&extraction["status"])!="collected" && !running{progress=progress.child(button(k,"Continue this NASA task · no duplicate submission","extraction-resume",json!({"sessionID":s.selected,"extraction_id":extraction["id"]})));}
        if !extraction["failure"].is_null(){progress=progress.child(line("Acquisition issue",&extraction["failure"]));}
        body=body.child(surface(progress,"#e3eee5"));
    }
    let last_update=list(&current["evidenceUpdates"]).last().and_then(|item|item["time"].as_str());
    let last_gaia=list(&current["messages"]).iter().rev().find(|item|string(&item["role"])=="gaia").and_then(|item|item["time"].as_str());
    if last_update.is_some_and(|updated|last_gaia.is_none_or(|reply|updated>reply)){
        body=body.child(surface(col().w_full().gap(8.).child(heading("New evidence is ready")).child(label("Your conversation is preserved. Open the evidence record for the latest measured trend, uncertainty, support and source details.")).child(Button::new("Open evidence record").build(k).min_h(44.).on_press(|s:&mut State|s.tab=Tab::Evidence)),"#e3eee5"));
    }
    let messages=list(&current["messages"]);
    if let Some(context)=list(&current["ecosystemContexts"]).last(){
        body=body.child(surface(col().w_full().gap(8.).child(heading(format!("Ecosystem context · {}",string(&context["ecosystem"])))).child(line("Evidence basis",&context["rationale"])).child(line("Measurement route",&context["vegetation_route"])).child(label("This interpretation is not a verified biome map or cover mask. Mixed landscapes, locally justified seasons and missing ecosystem-specific observations remain explicit.")),"#eaf0e8"));
    }
    if !running && !s.snapshot["artifact"].is_null(){
        let artifact=&s.snapshot["artifact"];let analysis=&artifact["analysis"];let variable=&artifact["acquisition"]["variable"];
        let derived=!artifact["acquisition"]["analysis_recipe"].is_null()||!artifact["acquisition"]["provenance"]["derived_from_artifact"].is_null()||!artifact["acquisition"]["provenance"]["common_support_sensitivity"].is_null();
        let mut overview=col().w_full().gap(16.).child(label(if derived{"EVIDENCE AT A GLANCE · DERIVED ANALYSIS, NOT NEW OBSERVATIONS"}else{"EVIDENCE AT A GLANCE · SOURCE-BACKED OBSERVATIONS"})).child(heading(format!("{} · {}",string(&variable["name"]),string(&artifact["acquisition"]["geometry"]["label"]))))
            .child(row().w_full().gap(18.).child(metric("Change per decade",&analysis["slope_per_decade"])).child(metric("Nominal p-value",&analysis["p_value"])).child(metric("Valid observations",&analysis["n"])))
            .child(label(format!("{} to {} · {} · {}",string(&analysis["requested_start"]),string(&analysis["requested_end"]),string(&variable["units"]),string(&analysis["status"]))));
        if let Some(chart)=&s.chart{overview=overview.child(el().w_full().h(270.).pixels(chart.pixels()));}
        overview=overview.child(label("Green: observed source values. Gold: fitted seasonal trend. Horizontal axis: year; vertical axis: the units above. Gaps are not interpolated. Source-specific uncertainty and limitations follow."))
            .child(button(k,"Download illustrated report","report-export",selected_action(s)));
        body=body.child(surface(overview,"#e3eee5"));
    }
    if messages.is_empty(){
        body=body.child(surface(col().w_full().gap(10.).child(label("A good first question can be simple:")).child(heading("“Has vegetation greenness changed near Manaus, and what might be related?”")).child(label("GAIA will resolve the place, choose a useful retrospective period, gather live evidence and explain what the data can—and cannot—say.")),"#eaf0e8"));
        for prompt in ["Amazon rainforest greenness trend","Heat or rainfall around the Great Barrier Reef","A change in my local environment"]{
            let selected=prompt.to_string();body=body.child(Button::new(prompt).variant(rune_kit::ButtonVariant::Outline).build(k).min_h(44.).on_press(move|s:&mut State|{s.fields[0]=TextEdit::new(&selected);command("draft",json!({"sessionID":s.selected,"text":s.fields[0].text}));}));
        }
    }
    for message in messages.iter() {
        let role=string(&message["role"]);
        let mine=role=="user";
        let title=if mine{"YOU"}else{"GAIA · INVESTIGATION REPORT"};
        let content=if mine{label(string(&message["text"]))}else{report_text(&string(&message["text"]))};
        let card=col().w_full().gap(10.).child(label(title))
            .child(content);
        body=body.child(surface(card,if mine{"#e2ebe1"}else{"#f0f3ed"}));
        if !message["label"].is_null() { body=body.child(line("Evidence status",&message["label"])); }
    }
    if !current["chatRunning"].as_bool().unwrap_or(false) && !list(&current["artifacts"]).is_empty(){
        let selected_artifact=string(&s.snapshot["artifact"]["id"]);
        let mut report=col().w_full().gap(16.).child(label("LIVE EVIDENCE · REPRODUCIBLE TREND ANALYSIS"))
            .child(heading("What the data show"))
            .child(label("Each card reports the source-specific estimate and support. Select a dataset in Evidence to inspect its dated observations, QA and complete model specification."));
        for artifact in list(&current["artifacts"]).iter(){
            let analysis=&artifact["analysis"];let acquisition=&artifact["acquisition"];let variable=&acquisition["variable"];
            let status=match analysis["status"].as_str().unwrap_or(""){"detected"=>"TREND DETECTED UNDER THE STATED MODEL","not_detected"=>"NO TREND DETECTED AT THE NOMINAL THRESHOLD","descriptive_only"=>"DESCRIPTIVE ESTIMATE · INFERENCE WITHHELD","conditional_sensitivity"=>"CONDITIONAL MISSINGNESS SENSITIVITY · NOT PRIMARY CONFIRMATION",_=>"INCONCLUSIVE · SEE SUPPORT AND LIMITATIONS"};
            let mut card=col().w_full().gap(11.).child(label(status))
                .child(heading(format!("{} · {}",string(&variable["name"]),string(&variable["units"]))))
                .child(label(format!("{} to {} · {} valid points · {}",string(&analysis["requested_start"]),string(&analysis["requested_end"]),number(&analysis["n"]),string(&acquisition["geometry"]["label"]))))
                .child(row().w_full().gap(18.).child(metric("Slope per decade",&analysis["slope_per_decade"])).child(metric(&format!("{:.0}% interval · per year",100.*(1.-analysis["specification"]["alpha"].as_f64().unwrap_or(0.05))),&analysis["interval"])).child(metric("Nominal p-value",&analysis["p_value"])))
                .child(line("Spatial and temporal support",&variable["support"]))
                .child(line("Live source",&acquisition["provenance"]["provider"]));
            if string(&artifact["id"])==selected_artifact{if let Some(chart)=&s.chart{card=card.child(el().w_full().h(270.).pixels(chart.pixels())).child(label("Dated observations and fitted trend are shown separately; missing periods remain gaps."));}}
            card=card.child(button(k,"Show this dataset’s chart","artifact-select",json!({"artifactID":artifact["id"]})));
            report=report.child(surface(card,"#f0f3ed"));
        }
        report=report.child(label("Interpretation boundary: statistical trend detection is not proof of a cause. Grid and satellite products retain their stated footprint and cannot establish local weather, regional mean conditions, species identity or deaths without matching observations."))
            .child(Button::new("Inspect data, QA, model specifications and limitations").build(k).min_h(44.).on_press(|s:&mut State|s.tab=Tab::Evidence));
        body=body.child(surface(report,"#f0f3ed")).child(button(k,"Download illustrated report · HTML / print to PDF","report-export",selected_action(s))).child(button(k,"Download reproducible investigation · JSON","export",selected_action(s)));
    }
    let composer=col().w_full().gap(8.).child(TextArea::new(&s.fields[0]).label("Describe your Earth question…").width(None).auto_grow(3,8).max_height(220.).on_edit(|s:&mut State|&mut s.fields[0]).on_change(|s:&mut State,_|command("draft",json!({"sessionID":s.selected,"text":s.fields[0].text}))).build(k))
        .child(row().w_full().gap(8.).child(Button::new(if running{"GAIA is working…"}else{"Investigate with GAIA"}).variant(rune_kit::ButtonVariant::Submit).build(k).min_h(48.).on_press(|s: &mut State| {
            if list(&s.snapshot["status"]["sessions"]).iter().any(|session|string(&session["id"])==s.selected && session["chatRunning"].as_bool().unwrap_or(false)){return;}
            command("chat",json!({"sessionID":s.selected,"text":s.fields[0].text}));
        })))
        .child(label("GAIA chooses a clear, accessible explanation by default. Ask for a detailed or technical report whenever you like."));
    body.child(surface(composer,"#f3f2ec")).into()
}
fn investigation(s: &State, k: &Kit, current: &Value, compact:bool) -> El {
    let mut body=col().w_full().gap(16.).child(heading("Evidence records"))
        .child(label("One focused workspace for measured trends, observation updates, scenarios, private field reports and audit history."));
    let tab_button=|title:&'static str,tab:EvidenceView|Button::new(title).variant(if s.evidence_view==tab{rune_kit::ButtonVariant::Contrast}else{rune_kit::ButtonVariant::Outline}).build(k).min_h(44.).on_press(move|s:&mut State|s.evidence_view=tab);
    let mut tabs=row().w_full().gap(6.).child(tab_button("Findings",EvidenceView::Findings)).child(tab_button("Observation",EvidenceView::Observation)).child(tab_button("Scenarios",EvidenceView::Scenarios));
    if compact {body=body.child(tabs).child(row().w_full().gap(6.).child(tab_button("Field notes",EvidenceView::Field)).child(tab_button("Audit",EvidenceView::Audit)));}
    else {tabs=tabs.child(tab_button("Field notes",EvidenceView::Field)).child(tab_button("Audit",EvidenceView::Audit));body=body.child(tabs);}
    for record in list(&current["artifacts"]){body=body.child(button(k,&format!("{}: {} to {}",string(&record["acquisition"]["variable"]["name"]),string(&record["analysis"]["requested_start"]),string(&record["analysis"]["requested_end"])),"artifact-select",json!({"artifactID":record["id"]})));}
    if s.evidence_view==EvidenceView::Findings {
        if !s.snapshot["artifact"].is_null(){body=body.child(evidence_summary(s,k));}
        body=body.child(Button::new("Open observation and data controls").build(k).min_h(44.).on_press(|s:&mut State|{s.evidence_view=EvidenceView::Observation;s.evidence_panel=EvidencePanel::Acquire;}));
    }
    if s.evidence_view==EvidenceView::Observation {
        body=body.child(Button::new(if s.evidence_panel==EvidencePanel::Acquire{"Close data-entry controls"}else{"Add another dataset"}).build(k).min_h(44.).on_press(|s:&mut State|s.evidence_panel=if s.evidence_panel==EvidencePanel::Acquire{EvidencePanel::Summary}else{EvidencePanel::Acquire}));
    }
    if s.evidence_view==EvidenceView::Observation && (list(&current["artifacts"]).is_empty()||s.evidence_panel==EvidencePanel::Acquire){
    body=body.child(heading("Variables, location and period"));
    for (i,name) in [(5,"Variable: T2M, PRECTOTCORR, RH2M or EVI"),(1,"Latitude"),(2,"Longitude"),(3,"Start year"),(4,"End year"),(15,"MODIS fixed-site identifier (EVI only)")] {
        body=body.child(field(s,k,i,name,false));
    }
    body=body.child(Button::new("Acquire data and calculate trend").build(k).on_press(|s: &mut State| {
        command("analyze",json!({"sessionID":s.selected,"operation":if s.fields[5].text=="EVI" {"modis"} else {"power"},"variable":s.fields[5].text,
            "latitude":s.fields[1].text.parse::<f64>().ok(),"longitude":s.fields[2].text.parse::<f64>().ok(),
            "start":s.fields[3].text.parse::<u32>().ok(),"end":s.fields[4].text.parse::<u32>().ok(),"siteid":s.fields[15].text,
             "label":"User-selected analysis support","growing_months":[5,6,7,8,9]}));s.evidence_panel=EvidencePanel::Summary;
    })).child(button(k,"Retrieve available MODIS sites","sites",json!({})))
        .child(label("POWER represents its meteorological grid, not a local station or arbitrary polygon. EVI requires actual product QA and a valid fixed-site footprint."));
    body=body.child(Button::new("Discover nearby NOAA stations: metadata only").build(k).on_press(|s: &mut State|command("stations",json!({"sessionID":s.selected,"latitude":s.fields[1].text.parse::<f64>().ok(),"longitude":s.fields[2].text.parse::<f64>().ok(),"start":s.fields[3].text.parse::<u32>().ok(),"end":s.fields[4].text.parse::<u32>().ok()}))))
        .child(label("Station discovery does not verify a complete observation record, equivalent spatial support or a station trend."));
    if !s.snapshot["stations"].is_null(){body=body.child(line("Actual station metadata",&s.snapshot["stations"]));}
    for site in list(&s.snapshot["sites"]).iter().take(20) { body=body.child(label(format!("{}: {}",string(&site["siteid"]),string(&site["sitename"])))); }
    body=body.child(heading("Import an observation series"))
        .child(field(s,k,10,"Source URL or citation",false)).child(field(s,k,11,"Physical units",false))
        .child(field(s,k,12,"Frequency: monthly or annual",false))
        .child(field(s,k,20,"Date column: optional explicit header",false)).child(field(s,k,21,"Value column: required when ambiguous",false)).child(field(s,k,22,"Declared spatial support",false));
    for (title,domain) in [("Atmosphere / AURA","aura"),("Water / THALASSA","thalassa"),("Plants / CHLORIS","chloris"),("Animals / ZOE","zoe")]{body=body.child(Button::new(title).build(k).on_press(move |s:&mut State|s.import_domain=domain.into()));}
    body=body.child(label(format!("Import domain: {}",s.import_domain))).child(Button::new("Choose and import CSV").build(k).on_press(|s: &mut State|command("import-file",json!({"sessionID":s.selected,"source":s.fields[10].text,"units":s.fields[11].text,"frequency":s.fields[12].text,"domain":s.import_domain,"date_column":if s.fields[20].text.is_empty(){Value::Null}else{json!(s.fields[20].text)},"value_column":if s.fields[21].text.is_empty(){Value::Null}else{json!(s.fields[21].text)},"support":s.fields[22].text}))))
        .child(label("Imported values remain user-supplied evidence; a citation does not independently authenticate them."));
    }
    if s.evidence_view==EvidenceView::Findings {
    body=body.child(button(k,"Download investigation export","export",selected_action(s)))
        .child(heading("Competing explanations and additional observations"));
    for hypothesis in list(&current["hypothesisRecords"]) {
        let evidence=list(&hypothesis["evidence"]);
        let statuses=["supported_signatures","contradicted_signatures","context_only","untestable","unresolved"];
        let counts=statuses.iter().filter_map(|status|{let count=evidence.iter().filter(|item|string(&item["status"])==*status).count();(count>0).then(||format!("{status}: {count}"))}).collect::<Vec<_>>().join(" · ");
        body=body.child(surface(col().w_full().gap(8.).child(heading(string(&hypothesis["name"]))).child(label(string(&hypothesis["expectation"]))).child(label(format!("{} assessment(s) · {}",evidence.len(),if counts.is_empty(){"no assessments".to_string()}else{counts}))),"#edf1e8"));
    }
    let plan=if current["observationPlan"]["protocol"].is_object(){&current["observationPlan"]["protocol"]}else{&current["observationPlan"]};
    if !plan.is_null(){
        body=body.child(heading(string(&plan["name"]))).child(line("Observation support",&plan["support"]));
        if !plan["observable"].is_null(){body=body.child(line("What to measure",&plan["observable"]));}
        for expectation in list(&plan["expectations"]){body=body.child(label(string(expectation)));}
        if !plan["under_a"].is_null(){body=body.child(line("Expectation A",&plan["under_a"])).child(line("Expectation B",&plan["under_b"])).child(line("Limit",&plan["limitation"]));}
        let existing=string(&plan["route"])=="existing_data"||string(&plan["availability"])=="inspect_existing_owned_data";
        if string(&plan["operation"])=="power"||existing{body=body.child(button(k,if existing{"Reassess existing evidence (no new observation)"}else{"Retrieve selected observation and update"},"observation",selected_action(s)));}
        else{body=body.child(label("This protocol requires real imported observations or qualified field evidence. Use Add another dataset for a lawful CSV import; no automatic retrieval or diagnosis is claimed."));}
    }
    }
    if s.evidence_view==EvidenceView::Observation {
    body=body.child(heading("Select a registered observation protocol")).child(label("Selecting a protocol freezes the current evidence baseline. Earlier selections and inspected data remain disclosed; selection is not a successful scientific test."));
    for protocol in list(&s.snapshot["catalog"]["protocols"]) {body=body.child(button(k,&format!("Select: {}",string(&protocol["name"])),"observation-plan",json!({"sessionID":s.selected,"protocolID":protocol["id"]})));}
    for update in list(&current["evidenceUpdates"]).iter().rev().take(5) {body=body.child(label(format!("Update {} · {} new evidence records. {}",string(&update["time"]),list(&update["added_artifacts"]).len(),string(&update["reason"]))));}
    }
    let artifact=string(&s.snapshot["artifact"]["id"]);
    if s.evidence_view==EvidenceView::Scenarios {
    let frequency=string(&s.snapshot["artifact"]["acquisition"]["frequency"]);
    body=body.child(button(k,"Run seasonal continuation","simulate",json!({"sessionID":s.selected,"artifactID":artifact,"model":"seasonal_continuation_v1","horizon":if frequency=="annual" {2} else {12},"members":64,"seed":20261114})));
    for candidate in list(&current["artifacts"]) {
        let id=string(&candidate["id"]);
        if id!=artifact {body=body.child(button(k,&format!("Response model with {}",string(&candidate["acquisition"]["variable"]["name"])),"simulate",json!({"sessionID":s.selected,"artifactID":artifact,"covariateIDs":[id],"model":"response_emulator_v1","horizon":if frequency=="annual" {2} else {12},"members":64,"seed":20261114})));}
    }
    if let Some(image)=&s.scenario{body=body.child(heading("Latest conditional scenario")).child(el().w_full().h(260.).pixels(image.pixels())).child(label("Gold: conditional median. Shaded: five-to-ninety-five percentile block-residual range, not calibrated forecast confidence. Inspect the actual model record, units, dates, baseline errors and readiness before use."));}
    body=body.child(heading("Conservative water-budget sandbox"))
        .child(label("Illustrative arithmetic only. Use one declared control-volume area and compatible mm per timestep; no discharge or root-water prediction is inferred."))
        .child(field(s,k,13,"Bucket inputs JSON: capacity, initial_storage, fluxes",false))
        .child(Button::new("Evaluate declared water budget").build(k).on_press(|s: &mut State|command("bucket",json!({"sessionID":s.selected,"inputs_json":s.fields[13].text}))));
    }
    if s.evidence_view==EvidenceView::Field {
    body=body.child(heading("Private field-observation intake"))
        .child(label("Reported outcomes remain unverified. Packets are excluded from standard public export and are not sent to a model provider by default."))
        .child(row().gap(6.).child(Button::new("Plant case / CHLORIS").build(k).on_press(|s:&mut State|s.field_domain="chloris".to_string())).child(Button::new("Water case / THALASSA").build(k).on_press(|s:&mut State|s.field_domain="thalassa".to_string())).child(Button::new("Animal case / ZOE").build(k).on_press(|s:&mut State|s.field_domain="zoe".to_string())))
        .child(line("Selected observation domain",&json!(s.field_domain)))
        .child(field(s,k,16,"Region or site description",false))
        .child(field(s,k,14,"What was actually observed or reported?",false))
        .child(field(s,k,17,"Organism or water compartment, if known",false))
        .child(field(s,k,18,"When was the change first observed?",false))
        .child(field(s,k,19,"Recent changes in weather, sampling or management",false))
        .child(Button::new("Save private reported-context packet").build(k).on_press(|s: &mut State|command("field-intake",json!({"sessionID":s.selected,"case":{"domain":s.field_domain,"region":s.fields[16].text,"reported_observation":s.fields[14].text,"organism":s.fields[17].text,"onset":s.fields[18].text,"recent_changes":if s.fields[19].text.is_empty(){Vec::<String>::new()}else{vec![s.fields[19].text.clone()]}}}))));
    for packet in list(&current["fieldCases"]){body=body.child(line("Private intake and safe next observations",packet));}
    if let Some(packet)=list(&current["fieldCases"]).last(){
      body=body.child(heading("Private professional handoff"))
        .child(label("Confirm the service jurisdiction, professional scope, current acceptance and minimum necessary case data before preparing a draft. This does not send anything or authorize sample handling."))
        .child(button(k,"Load documented referral guidance","field-referrals",json!({})))
        .child(Button::new(if s.handoff_confirmed{"Withdraw recipient confirmation and preparation consent"}else{"I confirm recipient scope/jurisdiction and consent to prepare a private draft"}).build(k).on_press(|s:&mut State|s.handoff_confirmed=!s.handoff_confirmed));
      for referral in list(&s.snapshot["referrals"]){if referral["domain"]!=packet["reported"]["domain"]{continue;}body=body.child(heading(string(&referral["name"]))).child(line("Service jurisdiction",&referral["jurisdiction"])).child(line("Official source",&referral["source"])).child(line("Scope",&referral["scope"])).child(line("Limits and current acceptance",&referral["limits"]));if s.handoff_confirmed{body=body.child(button(k,&format!("Prepare private draft for {}",string(&referral["name"])),"field-handoff",json!({"sessionID":s.selected,"caseID":packet["id"],"selection":{"recipient_id":referral["id"],"jurisdiction":referral["jurisdiction"],"consent":true,"recipient_confirmed":true}})));}}
      body=body.child(label("Other jurisdictions: supply a recipient you have verified. GAIA labels this user-confirmed, not independently certified."))
        .child(field(s,k,25,"Verified recipient or service name",false)).child(field(s,k,26,"Recipient official HTTPS source",false)).child(field(s,k,27,"Confirmed service/case jurisdiction",false)).child(field(s,k,28,"Relevant professional scope",false)).child(field(s,k,29,"How qualifications and current acceptance were confirmed",false));
      if s.handoff_confirmed{let case_id=packet["id"].clone();let domain=packet["reported"]["domain"].clone();body=body.child(Button::new("Prepare user-confirmed private handoff draft").build(k).on_press(move|s:&mut State|command("field-handoff",json!({"sessionID":s.selected,"caseID":case_id,"selection":{"jurisdiction":s.fields[27].text,"recipient":{"name":s.fields[25].text,"source":s.fields[26].text,"domain":domain,"jurisdiction":s.fields[27].text,"scope":s.fields[28].text,"qualification_basis":s.fields[29].text},"consent":true,"recipient_confirmed":true}}))));}
    }
    }
    if s.evidence_view==EvidenceView::Scenarios {
    body=body.child(heading("Historical prediction record"))
        .child(label("Selection, prediction, actual access-denial proof and reveal are recorded. This implementation retains a staged label unless complete access-route integrity is established."));
    let test=&current["predictionTest"];
    if test.is_null() {body=body.child(button(k,"Reserve metadata-selected target","prediction",json!({"sessionID":s.selected,"action":"reserve"})));}
    else {
        let status=string(&test["state"]);
        body=body.child(label(format!("{} · {}",status,string(&test["mode"]))))
            .child(label(format!("Metadata-selected grid location: {}, {}. Selection checksum: {}",number(&test["latitude"]),number(&test["longitude"]),string(&test["selection"]["specification_hash"]))));
        if status=="reserved"{body=body.child(button(k,"Commit prediction","prediction",json!({"sessionID":s.selected,"action":"commit"})));}
        if status=="committed"{
            body=body.child(line("Frozen acceptance rule",&test["prediction"]["prediction_evaluation_specification"]["rule"])).child(line("Prediction checksum",&test["prediction_hash"]));
            body=body.child(button(k,if test["denial_proof"].is_null(){"Test reserved-data access"}else{"Reveal and evaluate"},"prediction",json!({"sessionID":s.selected,"action":if test["denial_proof"].is_null(){"prove"}else{"reveal"}})));
        }
        if status=="evaluated"{
            body=body.child(line("Frozen-rule result",&test["evaluation"]["classification"]["status"]))
                .child(row().gap(20.).child(metric("Prediction RMSE",&test["evaluation"]["rmse"])).child(metric("Frozen baseline RMSE",&test["evaluation"]["classification"]["baseline_rmse"])))
                .child(line("Integrity label",&test["label_decision"]["reason"]))
                .child(label("This historical comparison is not a causal test or a calibrated forecast. Its committed values, rule, observed pairs and audit remain in the investigation export."));
        }else if status!="cancelled"{body=body.child(button(k,"Cancel target, preserve history","prediction",json!({"sessionID":s.selected,"action":"cancel"})));}
    }
    }
    if s.evidence_view==EvidenceView::Audit { body
        .child(inspect(k,"Executed numerical models",list(&current["simulations"])))
        .child(button(k,"Search bounded comparison candidates","references",json!({"sessionID":s.selected,"artifactID":artifact})))
        .child(inspect(k,"Comparison records",list(&current["comparisons"])))
        .child(inspect(k,"Experimental Jev judgments (shadow only)",list(&current["semanticReviews"])))
        .child(inspect(k,"Recorded execution events",list(&current["events"]))).into() }
    else { body.into() }
}
fn mission_control(s:&State,k:&Kit,current:&Value,compact:bool)->El{
    let current_artifacts=list(&current["artifacts"]);
    let mut hero=col().w_full().gap(14.)
        .child(row().gap(16.).child(if let Some(mark)=s.marks.first(){el().size(72.,72.).pixels(mark.pixels())}else{el().size(1.,1.)})
            .child(col().grow(1.).gap(8.).child(label("PLANETARY INTELLIGENCE  /  NASA SPACE APPS 2026"))
                .child(text("Read the signal. Test the story.").font(TextStyle::new(32.,650.)).w_full().wrap())
                .child(label("GAIA leads the investigation. Four scientific functions bring real evidence, bounded tools and explicit uncertainty."))))
        .child(row().child(Button::new("Start with the question that matters").variant(rune_kit::ButtonVariant::Submit).build(k).w(if compact{300.}else{380.}).min_h(48.).on_press(|s:&mut State|s.tab=Tab::Conversation)));
    let target=&s.snapshot["missionScope"];
    if target.is_null(){
        hero=hero.child(heading("Freeze a real NASA vegetation target"))
            .child(label("Choose an actual TESViS fixed site, complete period and growing-season months. CHLORIS can acquire only this exact MOD13Q1 Collection 6.1 target."))
            .child(label("Start from this investigation’s measured footprint, or search NASA’s live site catalog. Nothing is acquired until you freeze the target."));
        if let Some(existing)=current_artifacts.iter().rev().find(|artifact|string(&artifact["acquisition"]["variable"]["id"])=="EVI"){
            let artifact=existing.clone();hero=hero.child(Button::new("Use this investigation’s measured NASA footprint and period").variant(rune_kit::ButtonVariant::Outline).build(k).min_h(44.).on_press(move|s:&mut State|{
                let geometry=&artifact["acquisition"]["geometry"];let analysis=&artifact["analysis"];let months=list(&artifact["acquisition"]["provenance"]["recipe"]["months"]).iter().filter_map(Value::as_u64).map(|month|month.to_string()).collect::<Vec<_>>().join(",");
                s.fields[30]=TextEdit::new(string(&geometry["siteid"]));s.fields[33]=TextEdit::new(string(&geometry["label"]));s.fields[3]=TextEdit::new(analysis["requested_start"].as_str().unwrap_or("").get(..4).unwrap_or(""));s.fields[4]=TextEdit::new(analysis["requested_end"].as_str().unwrap_or("").get(..4).unwrap_or(""));if !months.is_empty(){s.fields[32]=TextEdit::new(months);}
            }));
        }
        hero=hero.child(label("Search by site, region or NASA identifier; choose an exact catalog result."))
            .child(field(s,k,33,"Search NASA sites",false))
            .child(field(s,k,30,"Selected NASA site identifier",false))
            .child(field(s,k,3,"First year",false)).child(field(s,k,4,"Last year",false))
            .child(field(s,k,32,"Growing-season months (comma separated)",false));
        let query=s.fields[33].text.trim().to_lowercase();
        let matches=list(&s.snapshot["sites"]).iter().filter(|site|query.is_empty()||["siteid","sitename","country"].iter().any(|key|string(&site[*key]).to_lowercase().contains(&query))).collect::<Vec<_>>();
        if query.chars().count()<2{hero=hero.child(label("Type at least two characters to search the NASA catalog."));}
        else{hero=hero.child(label(format!("{} live NASA site match(es) · showing up to 8",matches.len())));
            for site in matches.iter().take(8){let id=string(&site["siteid"]);let selected=id==s.fields[30].text;hero=hero.child(Button::new(format!("{} · {} · {}",id,string(&site["sitename"]),string(&site["latitude"])).as_str()).variant(if selected{rune_kit::ButtonVariant::Contrast}else{rune_kit::ButtonVariant::Outline}).build(k).min_h(44.).on_press(move|s:&mut State|{s.fields[30]=TextEdit::new(&id);s.fields[33]=TextEdit::new(&id);}));}
        }
        hero=hero.child(Button::new("Freeze this NASA mission target").variant(rune_kit::ButtonVariant::Submit).build(k).min_h(48.).on_press(|s:&mut State|{
            let months=s.fields[32].text.split(',').filter_map(|value|value.trim().parse::<u8>().ok()).collect::<Vec<_>>();
            command("mission-plan",json!({"sessionID":s.selected,"siteid":s.fields[30].text,"start":s.fields[3].text.parse::<u16>().ok(),"end":s.fields[4].text.parse::<u16>().ok(),"months":months}));
        }));
    }else{
        let months=list(&target["months"]).iter().filter_map(Value::as_u64).map(|month|month.to_string()).collect::<Vec<_>>().join(", ");
        hero=hero.child(label(format!("FROZEN TARGET  ·  {} / {}  ·  {}–{}  ·  months {}  ·  {}",string(&target["site_name"]),string(&target["product"]),number(&target["start"]),number(&target["end"]),months,string(&target["status"]))))
            .child(button(k,"CHLORIS · acquire this exact NASA series","analyze",json!({"sessionID":s.selected,"operation":"modis","siteid":target["siteid"],"latitude":target["latitude"],"longitude":target["longitude"],"start":target["start"],"end":target["end"],"months":target["months"],"label":target["site_name"]})))
            .child(button(k,"Release target and select another","mission-clear",selected_action(s)));
    }
    let mut card_items=Vec::new();
    for (name,role,domain,capability) in [("AURA","aura","ATMOSPHERE","NASA POWER temperature · rain · humidity"),("THALASSA","thalassa","WATER","Water-accounting methods · compatible imported gauges"),("CHLORIS","chloris","PLANTS","NASA MODIS EVI · raw QA · seasonal trend"),("ZOE","zoe","ANIMALS","Licensed occurrences · survey-effort boundaries")]{
        let status=list(&current["taskGraph"]["requests"]).iter().rev().find(|request|string(&request["role"])==role).map(|request|string(&request["status"])).unwrap_or_else(||"capability available · not yet invoked".into());
        let prompt=match role {
            "aura"=>"Retrieve monthly NASA POWER temperature, precipitation and humidity for this investigation’s region and period. Assess rainfall-shortage and heat-demand expectations only as meteorological grid context—not as a MODIS-footprint mean, local biology or causal proof. State which comparisons are support-compatible.".to_string(),
            "thalassa"=>"Assess whether actual, compatible water observations are available to test water redistribution for this investigation. Do not infer streamflow, storage or water quality from rainfall alone; if no eligible measurements exist, explain the specific gauge or chemistry observation needed.".to_string(),
            "chloris"=>"Evaluate this investigation’s actual NASA vegetation series, product QA and seasonal support. Distinguish optical greenness from species, yield, stress, disease and mortality; identify the most useful independent live/dead cover, host or injury observation and what it could discriminate.".to_string(),
            _=>"Check whether licensed, taxonomically verified and effort-qualified animal occurrence records can inform this investigation. Do not infer abundance, mortality, health, movement or exposure from unstandardized occurrences; state the minimum suitable survey evidence if records are inadequate.".to_string(),
        };
        let ask=Button::new(format!("Ask GAIA to coordinate {name}")).build(k).min_h(44.).on_press(move|s:&mut State|{s.fields[0]=TextEdit::new(prompt.clone());s.tab=Tab::Conversation;command("draft",json!({"sessionID":s.selected,"text":s.fields[0].text}));});
        card_items.push(col().grow(1.).min_w(0.).child(surface(col().w_full().gap(8.).child(row().gap(10.).child(text(name).font(TextStyle::new(17.,650.))).child(label(domain))).child(label(capability)).child(label(status)).child(ask),"#17201b")));
    }
    let cards=if compact{let mut list=col().w_full().gap(12.);for card in card_items{list=list.child(card);}list.into()}else{let mut list=row().w_full().gap(12.);for card in card_items{list=list.child(card);}list.into()};
    let flow=if compact{col().w_full().gap(4.).child(label("01  SELECT A NASA SIGNAL")).child(label("02  MEASURE THE TREND")).child(label("03  TEST ALTERNATIVES")).child(label("04  UPDATE WITH EVIDENCE"))}else{row().w_full().gap(16.).child(text("01  SELECT A NASA SIGNAL").font(TextStyle::new(13.,550.)).grow(1.).wrap()).child(text("02  MEASURE THE TREND").font(TextStyle::new(13.,550.)).grow(1.).wrap()).child(text("03  TEST ALTERNATIVES").font(TextStyle::new(13.,550.)).grow(1.).wrap()).child(text("04  UPDATE WITH EVIDENCE").font(TextStyle::new(13.,550.)).grow(1.).wrap())};
    let flow=surface(flow,"#17201b");
    let mut body=col().w_full().gap(20.).child(surface(hero,"#17201b")).child(flow);
    if let Some(evi)=current_artifacts.iter().rev().find(|artifact|string(&artifact["acquisition"]["variable"]["id"])=="EVI"){
        let trend=match string(&evi["analysis"]["status"]).as_str(){"detected"=>"A linear EVI trend was detected under the declared assumptions.","not_detected"=>"A linear EVI trend was not detected at nominal significance; that does not prove the vegetation was unchanged.","descriptive_only"=>"A descriptive EVI slope is available; inferential testing was withheld.",_=>"The EVI record does not support a resolved trend classification."};
        let analysis=&evi["analysis"];let context_records=list(&current["hypothesisRecords"]).iter().flat_map(|record|list(&record["evidence"])).filter(|item|string(&item["status"])=="context_only").filter_map(|item|item["artifactID"].as_str()).collect::<std::collections::HashSet<_>>().len();
        let contextual_hypotheses=list(&current["hypothesisRecords"]).iter().filter(|record|list(&record["evidence"]).iter().any(|item|string(&item["status"])=="context_only")).count();
        let latest=list(&current["evidenceUpdates"]).last();let update_text=latest.map(|item|if list(&item["added_artifacts"]).is_empty(){"Latest protocol update reused the frozen evidence baseline; it added no new observation.".to_string()}else{format!("Latest protocol update added {} artifact(s); this is evidence, not causal proof.",list(&item["added_artifacts"]).len())}).unwrap_or_else(||"No protocol-aware evidence update has been recorded yet.".into());
        let interval_text=list(&analysis["interval"]).iter().map(|value|value.as_f64().map(|value|format!("{value:.6}")).unwrap_or_else(||"not estimable".into())).collect::<Vec<_>>().join(" to ");
        let rate=format!("Estimated rate: {} EVI per decade · 95% Newey–West HAC interval: {interval_text} EVI/year · nominal p = {} · n = {} annual observations.",analysis["slope_per_decade"].as_f64().map(|value|format!("{value:.6}")).unwrap_or_else(||"not estimable".into()),analysis["p_value"].as_f64().map(|value|format!("{value:.6}")).unwrap_or_else(||"not estimable".into()),number(&analysis["n"]));
        let read=col().w_full().gap(10.).child(label("GAIA’S CURRENT EVIDENCE READ")).child(text(trend).font(TextStyle::new(18.,600.)).wrap()).child(label(rate))
            .child(label(format!("{} registered alternative(s) have only context-level evidence across {} weather record(s).",contextual_hypotheses,context_records)))
            .child(label("Rainfall and atmospheric-demand context do not directly test annual, fixed-footprint EVI or establish a cause."))
            .child(label(update_text))
            .child(label("Best next discriminating observation: dated, same-footprint measurements separating live green cover, standing dead vegetation and litter, paired to consistently screened seasonal EVI pixels."));
        body=body.child(surface(read,"#13231d"));
    }
    body=body.child(heading("Four functions. One evidence standard.")).child(cards)
        .child(heading("NASA trend record"));
    if current_artifacts.is_empty(){body=body.child(label("No local mission series yet. Freeze a real site above; the next view will show the acquired values, units, support, uncertainty and source QA."));}
    else{
        body=body.child(label(format!("{} actual numerical record(s) attached to this investigation. Select a record to inspect its full trend, uncertainty, support and provenance.",current_artifacts.len())));
        for artifact in current_artifacts.iter().rev().take(4){let status=string(&artifact["analysis"]["status"]);let message=match status.as_str(){"detected"=>"linear trend detected under the declared assumptions","not_detected"=>"linear trend not detected at nominal significance","descriptive_only"=>"descriptive slope only; inference withheld",_=>"inference inconclusive"};let label_text=format!("{}  /  {}  /  {}  /  {}",string(&artifact["acquisition"]["variable"]["name"]),message,string(&artifact["acquisition"]["variable"]["units"]),string(&artifact["acquisition"]["geometry"]["label"]));body=body.child(button(k,&label_text,"artifact-select",json!({"artifactID":artifact["id"]})));}
        body=body.child(Button::new("Open trend, confidence interval and QA details").build(k).min_h(44.).on_press(|s:&mut State|s.tab=Tab::Evidence));
    }
    if current["chatRunning"].as_bool().unwrap_or(false){body=body.child(label("GAIA is coordinating the active investigation. Completed evidence remains available while the functions work."));}
    body.into()
}
fn view(s: &State, _: &mut Cx<State>) -> El {
    let k=rune_theme_opencode::kit(false);let theme=rune::tok::theme(false);let current=session(s);
    let mut sidebar=col().w(250.).h_full().padding(20.).gap(12.).fill(theme.bg).child(heading("GAIA"))
        .child(label("EARTH SYSTEMS · FIELD DESK"))
        .child(label("One investigator. Evidence you can inspect."))
        .child(button(&k,"New investigation","new",json!({"depth":"plain"})));
    sidebar=sidebar.child(label("YOUR INVESTIGATIONS"));
    for item in list(&s.snapshot["status"]["sessions"]).iter().filter(|item|{
        let empty=item["messages"].as_array().is_some_and(Vec::is_empty)&&list(&item["artifacts"]).is_empty()&&list(&item["fieldCases"]).is_empty();
        !empty||string(&item["id"])==s.selected
    }).take(6) {
        let id=string(&item["id"]);let title=string(&item["title"]);
        let display=if title.is_empty()||title=="Untitled investigation" {
            format!("Investigation · {}",string(&item["created"]).get(..10).unwrap_or("Today"))
        } else {title.strip_prefix("Earth-system investigation · ").unwrap_or(&title).to_owned()};
        sidebar=sidebar.child(Button::new(display).variant(if id==s.selected{rune_kit::ButtonVariant::Contrast}else{rune_kit::ButtonVariant::Outline}).build(&k).min_h(46.).on_press(move |_: &mut State| {command("select",json!({"sessionID":id}));}));
    }
    for (title,tab) in [("Talk to GAIA",Tab::Conversation),("Evidence & report",Tab::Evidence),("Investigation map",Tab::Investigation),("Research notes",Tab::Research),("Data providers",Tab::Provider),("Sources & methods",Tab::Sources)] {
        sidebar=sidebar.child(Button::new(title).variant(if s.tab==tab{rune_kit::ButtonVariant::Contrast}else{rune_kit::ButtonVariant::Outline}).build(&k).min_h(44.).on_press(move |s: &mut State| s.tab=tab));
    }
    let compact=s.snapshot["viewportWidth"].as_f64().unwrap_or(1280.)<900.;
    let content=match s.tab {
        Tab::History=>history(s,&k),
        Tab::Provider=>provider(s,&k),Tab::Conversation=>conversation(s,&k,&current),Tab::Evidence=>investigation(s,&k,&current,compact),
        Tab::Research=>research(s,&k,&current),
        Tab::Investigation=>record_workspace(s,&k),
        Tab::Sources=>inspect(&k,"Data access and provenance",list(&s.snapshot["catalog"]["resources"])),
        Tab::Inspector(i)=>specialist(s,&k,&current,i),
        Tab::System=>mission_control(s,&k,&current,compact),
    };
    let running=current["chatRunning"].as_bool().unwrap_or(false);
    let readiness=if running{"INVESTIGATION ACTIVE · EVIDENCE RETAINED AS IT ARRIVES".to_owned()}else if s.snapshot["status"]["configured"].as_bool().unwrap_or(false){"READY · DESCRIBE AN EARTH-SYSTEM QUESTION".to_owned()}else if s.snapshot["status"]["local_configuration_available"].as_bool().unwrap_or(false){"ONE-TIME SETUP · CONNECT THE CONFIGURED MODEL TO START".to_owned()}else{"NASA DATA IS PUBLIC · CONNECT A COMPATIBLE MODEL TO TALK WITH GAIA".to_owned()};
    let mut main=col().grow(1.).min_w(0.).min_h(0.).padding(if compact {12.} else {30.}).gap(16.).child(label(readiness));
    if running&&s.tab!=Tab::Conversation{main=main.child(button(&k,"Stop investigation and retain partial evidence","chat-stop",selected_action(s)));}
    for job in list(&s.snapshot["status"]["jobs"]) {
        if string(&job["sessionID"])==s.selected&&string(&job["status"])=="running"{main=main.child(label(format!("Running numerical job: {}",string(&job["operation"]))))
            .child(button(&k,"Stop numerical job","stop",json!({"sessionID":s.selected,"jobID":job["id"]})));}
    }
    let main=main.child(label(string(&s.snapshot["error"]))).child(col().grow(1.).min_h(0.).w_full().scroll(ScrollSpec { stick_bottom: false }).child(content));
    if compact {
        let navigation=col().w_full().padding(10.).gap(5.)
            .child(row().gap(6.).child(button(&k,"New question","new",json!({}))).child(Button::new("History").build(&k).min_h(44.).on_press(|s:&mut State|s.tab=Tab::History)))
            .child(row().gap(6.).child(Button::new("Talk to GAIA").build(&k).min_h(44.).on_press(|s:&mut State|s.tab=Tab::Conversation)).child(Button::new("Evidence").build(&k).min_h(44.).on_press(|s:&mut State|s.tab=Tab::Evidence)))
            .child(row().gap(6.).child(Button::new("Research").build(&k).min_h(44.).on_press(|s:&mut State|s.tab=Tab::Research)).child(Button::new("Data providers").build(&k).min_h(44.).on_press(|s:&mut State|s.tab=Tab::Provider)))
            .child(Button::new("Investigation map").build(&k).min_h(44.).on_press(|s:&mut State|s.tab=Tab::Investigation));
        col().w_full().h_full().fill(theme.bg).color(rune::color::hex("#24352b").unwrap_or(theme.text)).child(navigation).child(main).into()
    } else {row().w_full().h_full().fill(theme.bg).color(rune::color::hex("#24352b").unwrap_or(theme.text)).child(sidebar).child(main).into()}
}
fn record_workspace(s:&State,k:&Kit)->El {
    let record=&s.snapshot["investigation"];
    let mut body=col().w_full().gap(14.).child(heading("Investigation record"))
        .child(button(k,"Refresh evidence graph and records","investigation-record",selected_action(s)))
        .child(label("Quantities, proposed pathways and the requested outcome remain distinct. Dashed connections are not certified causal links."))
        .child(row().gap(8.).child(Button::new("Evidence graph").build(k).on_press(|s:&mut State|s.record_view=RecordView::Graph)).child(Button::new("Scenario portfolio").build(k).on_press(|s:&mut State|s.record_view=RecordView::Portfolio)).child(Button::new("Test records").build(k).on_press(|s:&mut State|s.record_view=RecordView::Tests)));
    if record.is_null(){return body.child(label("Select an investigation and load its owned record.")).into();}
    match s.record_view{
        RecordView::Graph=>{
            if let Some(graph)=&s.graph{body=body.child(el().w_full().h(360.).pixels(graph.pixels()));}
            for node in list(&record["mechanism_graph"]["nodes"]){body=body.child(heading(string(&node["label"]))).child(label(string(&node["evidence_class"])));
                if let Some(id)=node["artifact_id"].as_str(){let id=id.to_string();body=body.child(Button::new("Inspect this numerical record").build(k).on_press(move |s:&mut State|{s.tab=Tab::Evidence;command("artifact-select",json!({"artifactID":id}));}));}
                for edge in list(&record["mechanism_graph"]["edges"]).iter().filter(|edge|edge["from"]==node["id"]){body=body.child(label(format!("{} · {}",string(&edge["relationship"]),string(&edge["status"]))));}
            }
            for group in list(&record["mechanism_graph"]["dependencies"]){body=body.child(label(format!("{}: agreement between functions is not independent confirmation.",string(&group["provider"]))));}
            for disagreement in list(&record["disagreements"]){body=body.child(line("Unresolved disagreement",disagreement));}
        },
        RecordView::Portfolio=>{for item in list(&record["scenario_portfolio"]){body=body.child(heading(string(&item["mechanism"]))).child(label("Mechanism validation is not established by a weather extrapolation."));for required in list(&item["required_observations"]){body=body.child(label(format!("Required observation: {}",string(required))));}for model in list(&item["model_results"]){body=body.child(label(format!("{} · {}",string(&model["model"]),string(&model["readiness"])))).child(line("Held-out evaluation",&model["validation"]));}}},
        RecordView::Tests=>{for item in list(&record["signature_test_records"]){body=body.child(heading(string(&item["hypothesis_id"]))).child(label(string(&item["expectation"]))).child(label(format!("Contrary expectation: {}",string(&item["contrary_expectation"])))).child(line("Recorded assessments",&item["assessments"]));}body=body.child(line("Independent status dimensions",&record["status_dimensions"])).child(line("Connected investigation checks",&record["backbone"]));}
    }
    body.child(label(format!("Record checksum: {}",string(&record["record_hash"])))).into()
}
fn specialist(s:&State,k:&Kit,current:&Value,index:usize)->El {
    let ids=["gaia","aura","thalassa","chloris","zoe"];let id=ids[index];
    let names=["Investigation coordination","Atmospheric processes and observations","Water systems and aquatic chemistry","Plant responses and optical observations","Animal ecology and observation processes"];
    let profile=&s.snapshot["competence"]["profiles"][id];let review=&current["roleSummaries"][id];
    let mut body=col().w_full().gap(16.).child(heading(format!("{} / {}",id.to_uppercase(),names[index])));
    body=body.child(row().gap(16.).child(metric("Procedures",&json!(list(&profile["skills"]).len()))).child(metric("Producer references",&json!(list(&profile["references"]).len()))));
    if !profile["competence"]["passed"].is_null(){body=body.child(label(format!("Internal decision checks: {} of {}. Small authored cases; independent domain review remains outstanding.",string(&profile["competence"]["passed"]),string(&profile["competence"]["total"]))));}
    body=body.child(heading("Latest retained evidence assessment")).child(label(string(&review["time"])));
    if review["text"].is_null(){body=body.child(label("No completed domain assessment for this investigation."));}else{body=body.child(label(string(&review["text"])));}
    for gap in list(&review["gaps"]){body=body.child(label(format!("Evidence gap: {}",string(&gap))));}
    body=body.child(heading("Sources actually retrieved"));
    for source in list(&review["sources"]){let url=string(&source["url"]);body=body.child(label(string(&source["quote"]))).child(Button::new(if source["title"].is_null(){url.clone()}else{string(&source["title"])}).build(k).on_press(move |_:&mut State|{let _=rune::web::open_url(&url);}));}
    body=body.child(heading("Procedure repertoire"));
    for pack in list(&profile["skills"]){body=body.child(label(format!("{} · version {}",string(&pack["id"]),string(&pack["version"]))));}
    body=body.child(heading("Executed tools"));
    for receipt in list(&review["trace"]){body=body.child(label(format!("{} · {}",string(&receipt["tool"]),string(&receipt["time"]))));}
    for diagnostic in list(&current["domainDiagnostics"]).into_iter().filter(|item|item["role"].as_str()==Some(id)){body=body.child(heading(string(&diagnostic["method"]))).child(line("Diagnostic scope",&diagnostic["summary"])).child(line("Units",&diagnostic["units"]));for limit in list(&diagnostic["limitations"]){body=body.child(label(string(&limit)));}}
    body.child(label("Read-only work record. Questions, new observations and challenges go through GAIA.")).into()
}
fn research(s:&State,k:&Kit,current:&Value)->El {
    if current.is_null(){return col().w_full().gap(16.).child(heading("Research workspace")).child(label("Select or create an investigation to retain sources, model ideas and peer checks.")).into();}
    let mut body=col().w_full().gap(16.).child(heading("Research workspace"))
        .child(label("Search methods and competing evidence. Keep sources, provisional notes and experiments attached to the investigation."))
        .child(row().gap(8.).child(Button::new("Sources").build(k).on_press(|s:&mut State|s.research_view=ResearchView::Sources)).child(Button::new("Notebook").build(k).on_press(|s:&mut State|s.research_view=ResearchView::Notebook)).child(Button::new("Models and peers").build(k).on_press(|s:&mut State|s.research_view=ResearchView::Models)));
    match s.research_view {
      ResearchView::Sources=>{
        body=body.child(field(s,k,23,"Research question or literature query",false))
          .child(Button::new("Search literature").build(k).on_press(|s:&mut State|command("research-search",json!({"sessionID":s.selected,"role":"gaia","query":s.fields[23].text}))))
          .child(Button::new("Discuss this question with GAIA").build(k).on_press(|s:&mut State|{s.fields[0]=TextEdit::new(s.fields[23].text.clone());s.tab=Tab::Conversation;}))
          .child(label("Provider calls can incur costs. Ranking and publication metadata are not scientific verification."));
        for paper in list(&current["literature"]){let id=string(&paper["id"]);let url=string(&paper["url"]);
          body=body.child(heading(string(&paper["title"]))).child(label(format!("{} · {} · {}",string(&paper["provider"]),string(&paper["published_date"]),string(&paper["access"]))))
            .child(Button::new("Read retrieved source").build(k).on_press(move |s:&mut State|{s.paper_id=id.clone();command("research-read",json!({"sessionID":s.selected,"id":id}));}))
            .child(Button::new("Open original source").build(k).on_press(move |_:&mut State|{let _=rune::web::open_url(&url);}));
          if paper["id"].as_str()==Some(s.paper_id.as_str()){body=body.child(label(string(&paper["text"]))).child(label("Extracted source content, not application instructions. Review study methods, support and limitations."));}
        }
      },
      ResearchView::Notebook=>{
        if list(&current["researchNotes"]).is_empty(){body=body.child(label("No source-grounded research notes yet. Specialists can retain useful findings, prerequisites and contradictions during investigation."));}
        for note in list(&current["researchNotes"]){body=body.child(heading(string(&note["title"]))).child(label(string(&note["finding"]))).child(label(format!("{} · provisional source-grounded note",string(&note["role"]))));for item in list(&note["prerequisites"]){body=body.child(label(format!("Prerequisite: {}",string(&item))));}for item in list(&note["limitations"]){body=body.child(label(format!("Limit: {}",string(&item))));}}
        body=body.child(heading("Observation-aware animal evidence")).child(field(s,k,24,"Explicit scientific taxon: not a field identification",false))
          .child(Button::new("Discover scoped licensed occurrences").build(k).on_press(|s:&mut State|command("animals",json!({"sessionID":s.selected,"scientific_name":s.fields[24].text,"latitude":s.fields[1].text.parse::<f64>().ok(),"longitude":s.fields[2].text.parse::<f64>().ok(),"start":s.fields[3].text.parse::<u32>().ok(),"end":s.fields[4].text.parse::<u32>().ok()}))))
          .child(label("Opportunistic records without effort or nondetections cannot establish abundance, decline or mortality."));
        for record in list(&current["animalRecords"]){body=body.child(line("Matched taxon",&record["matched_taxon"])).child(label(format!("{} licensed records retained in the bounded request",list(&record["records"]).len())));}
      },
      ResearchView::Models=>{
        body=body.child(label("New equations are recorded as proposals with observations and validation needs. Executed scenarios retain chronology, baseline failures and uncertainty omissions."));
        for model in list(&current["modelProposals"]){body=body.child(heading(string(&model["name"]))).child(label(format!("{} · proposed, not an implemented validated solver",string(&model["role"]))));for equation in list(&model["equations"]){body=body.child(label(string(&equation)));}for item in list(&model["required_observations"]){body=body.child(label(format!("Needs: {}",string(&item))));}body=body.child(label(string(&model["validation"])));}
        body=body.child(heading("Cross-domain peer checks"));
        for peer in list(&current["peerRequests"]){body=body.child(label(format!("{} → {} · {}",string(&peer["requester"]),string(&peer["role"]),string(&peer["status"])))).child(label(string(&peer["question"])));}
        for simulation in list(&current["simulations"]){
            let description=format!("Readiness: {} · {}",string(&simulation["readiness"]),string(&simulation["initiated_by"]));
            body=body.child(heading(string(&simulation["model"]))).child(label(description)).child(line("Held-out baseline comparison",&simulation["validation"]));
        }
      }
    }
    body.into()
}
fn history(s:&State,k:&Kit)->El {
    let mut body=col().w_full().gap(12.).child(heading("Saved investigations"));
    for session in list(&s.snapshot["status"]["sessions"]){let id=string(&session["id"]);body=body.child(Button::new(string(&session["title"])).build(k).min_h(44.).on_press(move |_:&mut State|{command("select",json!({"sessionID":id}));}));}
    body.child(Button::new("Data sources").build(k).on_press(|s:&mut State|s.tab=Tab::Sources)).into()
}
fn function_node(s:&State,k:&Kit,index:usize,title:&str)->El {
    let mut node=col().w(150.).gap(10.).items_center();
    if let Some(mark)=s.marks.get(index){node=node.child(el().size(70.,70.).pixels(mark.pixels()));}
    let current=session(s);let ids=["gaia","aura","thalassa","chloris","zoe"];
    let status=if index==0 && current["chatRunning"].as_bool().unwrap_or(false) {"running".to_owned()} else {list(&current["taskGraph"]["requests"]).into_iter().rev().find(|request|request["role"].as_str()==Some(ids[index])).map(|request|request["status"].as_str().unwrap_or("running").to_owned()).unwrap_or_else(||"idle".to_owned())};
    node.child(Button::new(title).build(k).on_press(move |s:&mut State|s.tab=if index==0 {Tab::Conversation} else {Tab::Inspector(index)})).child(label(format!("Latest task: {status}"))).into()
}
#[wasm_bindgen(start)]
pub fn start() {
    let mut spec=AppSpec::new("GAIA",(1280.,850.),State::default,view);
    spec.fonts=rune_theme_opencode::FONTS;spec.families=rune_theme_opencode::FAMILIES;
    spec.setup=Some(setup);spec.poll=Some(poll);rune::run(spec);
}
