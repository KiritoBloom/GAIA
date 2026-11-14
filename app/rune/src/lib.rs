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
enum RecordView { Graph, Portfolio, Tests }
struct State {
    tab: Tab,
    selected: String,
    snapshot: Value,
    revision: String,
    fields: Vec<TextEdit>,
    field_domain: String,
    import_domain: String,
    research_view:ResearchView,
    record_view:RecordView,
    paper_id:String,
    evidence_panel: EvidencePanel,
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
        let initial = ["", "53.91", "-122.75", "2001", "2025", "T2M", "", "", "", "", "", "", "monthly", "", "", "", "", "", "", "", "", "", "", "", ""];
        Self { tab: Tab::System, selected: String::new(), snapshot: json!({}), revision: String::new(),
            fields: initial.into_iter().map(TextEdit::new).collect(), field_domain:"chloris".to_string(),import_domain:"aura".to_string(),research_view:ResearchView::Sources,record_view:RecordView::Graph,paper_id:String::new(),evidence_panel:EvidencePanel::Summary,audit_open:false,cache: None, marks: vec![], chart: None, chart_key: String::new(), scenario:None,scenario_key:String::new(),graph:None,graph_key:String::new() }
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
    if let Some(selected)=s.snapshot["selected"].as_str() { s.selected=selected.to_owned(); }
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
fn string(value: &Value) -> String { value.as_str().unwrap_or("").to_owned() }
fn list(value: &Value) -> &[Value] { value.as_array().map(Vec::as_slice).unwrap_or(&[]) }
fn label(value: impl Into<String>) -> El { text(value.into()).font(TextStyle::new(14., 400.)).w_full().wrap_anywhere() }
fn heading(value: impl Into<String>) -> El { text(value.into()).font(TextStyle::new(24., 600.)).w_full().wrap() }
fn line(title: &str, value: &Value) -> El {
    let content = match value { Value::Null => "Not available".to_owned(), Value::String(v) => v.clone(), _ => value.to_string() };
    col().w_full().gap(4.).child(text(title).font(TextStyle::new(12., 600.))).child(label(content)).into()
}
fn number(value:&Value)->String{
    if let Some(values)=value.as_array(){return values.iter().map(number).collect::<Vec<_>>().join(" to ");}
    let Some(v)=value.as_f64() else{return "Not estimable".into()};
    if value.is_i64()||value.is_u64(){return value.to_string();}
    if v!=0.&&v.abs()<0.0001{format!("{v:.3e}")}else{format!("{v:.4}")}
}
fn metric(title:&str,value:&Value)->El{
    col().grow(1.).min_w(0.).gap(5.).child(text(title).font(TextStyle::new(12.,500.))).child(text(number(value)).font(TextStyle::new(23.,500.)).w_full().wrap()).into()
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
    Button::new(title).build(k).on_press(move |_: &mut State| command(operation, body.clone()))
}
fn field(s: &State, k: &Kit, index: usize, title: &str, secure: bool) -> El {
    let input = TextInput::new(&s.fields[index]).label(title).on_edit(move |s: &mut State| &mut s.fields[index]);
    let input = if secure { input.secure() } else { input };
    col().w_full().gap(5.).child(label(title)).child(input.build(k).w_full()).into()
}
fn session(s: &State) -> Value {
    list(&s.snapshot["status"]["sessions"]).iter().find(|v| string(&v["id"]) == s.selected).cloned().unwrap_or(json!({}))
}
fn selected_action(s: &State) -> Value { json!({"sessionID":s.selected}) }
fn inspect(k: &Kit, title: &str, values: &[Value]) -> El {
    let mut body = col().w_full().gap(14.).child(heading(title));
    if values.is_empty() { body = body.child(label("No records.")); }
    for item in values.iter().rev().take(20) { body = body.child(label(serde_json::to_string_pretty(item).unwrap_or_default())); }
    body.child(button(k,"Refresh records","refresh",json!({}))).into()
}
fn provider(s: &State, k: &Kit) -> El {
    let mut body = col().w_full().gap(14.).child(heading("Model provider"))
        .child(label("Keys are entered in a masked field and sent only to the local backend. Remote inference may incur costs."))
        .child(button(k,"Discover configured provider models","provider-discover",json!({})))
        .child(field(s,k,6,"Provider name",false)).child(field(s,k,7,"Compatible API base URL",false))
        .child(field(s,k,8,"API key (session only)",true)).child(field(s,k,9,"Model identifier",false));
    for model in list(&s.snapshot["models"]).iter().take(30) {
        let name=string(model); let picked=name.clone();
        body=body.child(Button::new(name).build(k).on_press(move |s: &mut State| s.fields[9]=TextEdit::new(&picked)));
    }
    body=body.child(Button::new("Discover endpoint models").build(k).on_press(|s: &mut State| {
        command("provider-models",json!({"endpoint":s.fields[7].text,"apiKey":s.fields[8].text}));
    })).child(Button::new("Connect and verify role tools").build(k).on_press(|s: &mut State| {
        command("provider-connect",json!({"name":s.fields[6].text,"endpoint":s.fields[7].text,"apiKey":s.fields[8].text,"model":s.fields[9].text}));
        s.fields[8]=TextEdit::new("");
    })).child(button(k,"Disconnect and clear provider key","provider-remove",json!({})))
        .child(line("Connection verified",&s.snapshot["status"]["tested"]));
    if !s.snapshot["status"]["proof"].is_null(){body=body.child(line("Actual role checks completed",&s.snapshot["status"]["proof"]["completed"])).child(line("Role checks in progress",&s.snapshot["status"]["proof"]["active"]));}
    body.into()
}
fn conversation(s: &State, k: &Kit, current: &Value) -> El {
    let mut body=col().w_full().gap(18.).child(heading("Investigation question"));
    if current["chatRunning"].as_bool().unwrap_or(false){body=body.child(button(k,"Stop investigation and retain partial evidence","chat-stop",selected_action(s)));}
    for message in list(&current["messages"]).iter().rev().take(12).rev() {
        body=body.child(line(&string(&message["role"]),&message["text"]));
        if !message["label"].is_null() { body=body.child(line("Evidence status",&message["label"])); }
    }
    body.child(col().w_full().gap(6.).child(label("Question, region, period and available observations")).child(TextArea::new(&s.fields[0]).label("Investigation question").width(None).auto_grow(3,8).max_height(220.).on_edit(|s:&mut State|&mut s.fields[0]).build(k)))
        .child(Button::new("Submit question").build(k).on_press(|s: &mut State| {
            command("chat",json!({"sessionID":s.selected,"text":s.fields[0].text}));s.fields[0]=TextEdit::new("");
        }))
        .child(button(k,"Plain-language explanations","depth",json!({"sessionID":s.selected,"depth":"plain"})))
        .child(button(k,"Technical explanations","depth",json!({"sessionID":s.selected,"depth":"technical"})))
        .child(label("Investigations continue until completed or stopped. Provider costs and source-request approvals remain visible; stalled individual requests are handled separately.")).into()
}
fn investigation(s: &State, k: &Kit, current: &Value) -> El {
    let mut body=col().w_full().gap(16.).child(heading("Evidence records"));
    for record in list(&current["artifacts"]){body=body.child(button(k,&format!("{}: {} to {}",string(&record["acquisition"]["variable"]["name"]),string(&record["analysis"]["requested_start"]),string(&record["analysis"]["requested_end"])),"artifact-select",json!({"artifactID":record["id"]})));}
    if !s.snapshot["artifact"].is_null(){body=body.child(evidence_summary(s,k));}
    body=body.child(Button::new(if s.evidence_panel==EvidencePanel::Acquire{"Close data-entry controls"}else{"Add another dataset"}).build(k).on_press(|s:&mut State|s.evidence_panel=if s.evidence_panel==EvidencePanel::Acquire{EvidencePanel::Summary}else{EvidencePanel::Acquire}));
    if list(&current["artifacts"]).is_empty()||s.evidence_panel==EvidencePanel::Acquire{
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
    body=body.child(button(k,"Download investigation export","export",selected_action(s)))
        .child(heading("Competing explanations and additional observations"));
    for hypothesis in list(&current["hypothesisRecords"]) { body=body.child(line("Hypothesis",hypothesis)); }
    body=body.child(line("Observation protocol",&current["observationPlan"]))
        .child(button(k,"Retrieve selected observation and update","observation",selected_action(s)));
    for update in list(&current["evidenceUpdates"]) { body=body.child(line("Recorded evidence update",update)); }
    let artifact=string(&s.snapshot["artifact"]["id"]);
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
    body=body.child(heading("Private field-observation intake"))
        .child(label("Reported outcomes remain unverified. Packets are excluded from standard public export and are not sent to a model provider by default."))
        .child(row().gap(6.).child(Button::new("Plants / CHLORIS").build(k).on_press(|s:&mut State|s.field_domain="chloris".to_string())).child(Button::new("Water / THALASSA").build(k).on_press(|s:&mut State|s.field_domain="thalassa".to_string())).child(Button::new("Animals / ZOE").build(k).on_press(|s:&mut State|s.field_domain="zoe".to_string())))
        .child(line("Selected observation domain",&json!(s.field_domain)))
        .child(field(s,k,16,"Region or site description",false))
        .child(field(s,k,14,"What was actually observed or reported?",false))
        .child(field(s,k,17,"Organism or water compartment, if known",false))
        .child(field(s,k,18,"When was the change first observed?",false))
        .child(field(s,k,19,"Recent changes in weather, sampling or management",false))
        .child(Button::new("Save private reported-context packet").build(k).on_press(|s: &mut State|command("field-intake",json!({"sessionID":s.selected,"case":{"domain":s.field_domain,"region":s.fields[16].text,"reported_observation":s.fields[14].text,"organism":s.fields[17].text,"onset":s.fields[18].text,"recent_changes":if s.fields[19].text.is_empty(){Vec::<String>::new()}else{vec![s.fields[19].text.clone()]}}}))));
    for packet in list(&current["fieldCases"]){body=body.child(line("Private intake and safe next observations",packet));}
    body=body.child(heading("Historical prediction record"))
        .child(label("Selection, prediction, actual access-denial proof and reveal are recorded. This implementation retains a staged label unless complete access-route integrity is established."));
    let test=&current["predictionTest"];
    if test.is_null() {body=body.child(button(k,"Reserve metadata-selected target","prediction",json!({"sessionID":s.selected,"action":"reserve"})));}
    else {
        for (title,action) in [("Commit prediction","commit"),("Test reserved-data access","prove"),("Reveal and evaluate","reveal"),("Cancel target, preserve history","cancel")] {
            body=body.child(button(k,title,"prediction",json!({"sessionID":s.selected,"action":action,"testID":test["id"]})));
        }
        body=body.child(line("Prediction and integrity record",test));
    }
    for job in list(&s.snapshot["status"]["jobs"]) {
        if string(&job["sessionID"])==s.selected && string(&job["status"])=="running" {body=body.child(button(k,"Stop numerical job","stop",json!({"sessionID":s.selected,"jobID":job["id"]})));}
    }
    body
        .child(inspect(k,"Executed numerical models",list(&current["simulations"])))
        .child(button(k,"Search bounded comparison candidates","references",json!({"sessionID":s.selected,"artifactID":artifact})))
        .child(inspect(k,"Comparison records",list(&current["comparisons"])))
        .child(inspect(k,"Experimental Jev judgments (shadow only)",list(&current["semanticReviews"])))
        .child(inspect(k,"Recorded execution events",list(&current["events"]))).into()
}
fn view(s: &State, _: &mut Cx<State>) -> El {
    let k=rune_theme_opencode::kit(true);let theme=rune::tok::theme(true);let current=session(s);
    let mut sidebar=col().w(240.).h_full().padding(20.).gap(14.).fill(theme.bg).child(heading("GAIA"))
        .child(label("Earth-system analysis"))
        .child(button(&k,"New investigation","new",json!({"depth":"plain"})));
    for item in list(&s.snapshot["status"]["sessions"]) { let id=string(&item["id"]);let title=string(&item["title"]);let short:String=title.chars().take(23).collect();sidebar=sidebar.child(Button::new(short).build(&k).on_press(move |s: &mut State| {s.selected=id.clone();s.tab=Tab::Conversation;command("select",json!({"sessionID":id}));})); }
    for (title,tab) in [("System",Tab::System),("Conversation",Tab::Conversation),("Evidence",Tab::Evidence),("Investigation record",Tab::Investigation),("Research",Tab::Research),("Provider settings",Tab::Provider),("Data sources",Tab::Sources)] {
        sidebar=sidebar.child(Button::new(title).build(&k).on_press(move |s: &mut State| s.tab=tab));
    }
    let compact=s.snapshot["viewportWidth"].as_f64().unwrap_or(1280.)<900.;
    let content=match s.tab {
        Tab::History=>history(s,&k),
        Tab::Provider=>provider(s,&k),Tab::Conversation=>conversation(s,&k,&current),Tab::Evidence=>investigation(s,&k,&current),
        Tab::Research=>research(s,&k,&current),
        Tab::Investigation=>record_workspace(s,&k),
        Tab::Sources=>inspect(&k,"Data access and provenance",list(&s.snapshot["catalog"]["resources"])),
        Tab::Inspector(i)=>specialist(s,&k,&current,i),
        Tab::System if compact=>col().w_full().gap(18.).child(heading("Investigation workspace")).child(label("GAIA coordinates questions. Specialist functions are read-only evidence inspectors."))
            .child(function_node(s,&k,0,"GAIA")).child(function_node(s,&k,1,"AURA")).child(function_node(s,&k,2,"THALASSA")).child(function_node(s,&k,3,"CHLORIS")).child(function_node(s,&k,4,"ZOE")).into(),
        Tab::System=>col().w_full().gap(22.).child(heading("Investigation workspace"))
            .child(label("Define a question through GAIA. Open a specialist to inspect its recorded evidence, sources and activity."))
            .child(col().w_full().items_center().child(function_node(s,&k,1,"AURA")))
            .child(row().w_full().gap(16.).justify_center().child(function_node(s,&k,4,"ZOE")).child(function_node(s,&k,0,"GAIA")).child(function_node(s,&k,2,"THALASSA")))
            .child(col().w_full().items_center().child(function_node(s,&k,3,"CHLORIS"))).into()
    };
    let main=col().grow(1.).min_w(0.).min_h(0.).padding(if compact {12.} else {28.}).gap(16.).child(label(if s.snapshot["operation"].is_null() {"No active interface request".to_owned()} else {format!("Active request: {}",string(&s.snapshot["operation"]))}))
             .child(label(string(&s.snapshot["error"])))
             .child(col().grow(1.).min_h(0.).w_full().scroll(ScrollSpec { stick_bottom: false }).child(content));
    if compact {
        let navigation=col().w_full().padding(12.).gap(6.)
            .child(row().gap(6.).child(Button::new("Investigations").build(&k).on_press(|s:&mut State|s.tab=Tab::History)).child(Button::new("System").build(&k).on_press(|s:&mut State|s.tab=Tab::System)).child(Button::new("Providers").build(&k).on_press(|s:&mut State|s.tab=Tab::Provider)))
            .child(row().gap(6.).child(button(&k,"New investigation","new",json!({}))).child(Button::new("Conversation").build(&k).on_press(|s:&mut State|s.tab=Tab::Conversation)))
            .child(row().gap(6.).child(Button::new("Evidence").build(&k).on_press(|s:&mut State|s.tab=Tab::Evidence)).child(Button::new("Research").build(&k).on_press(|s:&mut State|s.tab=Tab::Research)))
            .child(Button::new("Investigation record").build(&k).on_press(|s:&mut State|s.tab=Tab::Investigation));
        col().w_full().h_full().fill(theme.bg).color(theme.text).child(navigation).child(main).into()
    } else {row().w_full().h_full().fill(theme.bg).color(theme.text).child(sidebar).child(main).into()}
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
        body=body.child(button(k,"Approve additional research capacity","research-budget",selected_action(s))).child(label("Explicit approval adds bounded search/read capacity; it does not make a source authoritative."));
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
    for session in list(&s.snapshot["status"]["sessions"]){let id=string(&session["id"]);body=body.child(Button::new(string(&session["title"])).build(k).on_press(move |s:&mut State|{s.selected=id.clone();command("select",json!({"sessionID":id}));s.tab=Tab::System;}));}
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
