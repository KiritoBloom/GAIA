//! One calm, evidence-led GAIA conversation with a persistent composer.
use super::*;

fn kicker(value: impl Into<String>) -> El {
    text(value.into())
        .font(TextStyle::new(12., 500.).mono().tracking(0.7))
        .color(workspace::muted())
        .w_full()
        .wrap()
}

fn stat(title: &str, value: &Value, detail: &str) -> El {
    col()
        .grow(1.)
        .min_w(0.)
        .gap(5.)
        .padding(12.)
        .fill(workspace::color("#171a1e"))
        .border_sides([0., 0., 0., 1.], workspace::color("#58616b"))
        .child(kicker(title))
        .child(
            text(number(value))
                .font(TextStyle::new(22., 550.))
                .color(workspace::ink())
                .w_full()
                .wrap(),
        )
        .child(
            text(detail)
                .font(TextStyle::new(12., 400.))
                .color(workspace::muted())
                .w_full()
                .wrap(),
        )
        .into()
}

fn status_text(status: &str) -> &'static str {
    match status {
        "detected" => "Detected under the declared method",
        "not_detected" => "Not detected at the nominal threshold",
        "descriptive_only" => "Descriptive only; inference withheld",
        "conditional_sensitivity" => "Conditional sensitivity; not primary evidence",
        _ => "Inconclusive with the available support",
    }
}

fn evidence_card(s: &State, k: &Kit, artifact: &Value) -> El {
    let acquisition = &artifact["acquisition"];
    let variable = &acquisition["variable"];
    let geometry = &acquisition["geometry"];
    let analysis = &artifact["analysis"];
    let status = string(&analysis["status"]);
    let alpha = analysis["specification"]["alpha"].as_f64().unwrap_or(0.05);
    let confidence = ((1. - alpha) * 100.).round() as i64;
    let start = string(&analysis["requested_start"]);
    let end = string(&analysis["requested_end"]);
    let units = string(&variable["units"]);
    let derived = !acquisition["analysis_recipe"].is_null()
        || !acquisition["provenance"]["derived_from_artifact"].is_null()
        || !analysis["inference_role"].is_null();

    let mut card = col()
        .w_full()
        .gap(16.)
        .padding(16.)
        .fill(workspace::color("#171a1e"))
        .border(1., workspace::color("#33383d"))
        .radius(5.)
        .child(kicker(if derived {
            "DERIVED SENSITIVITY · NOT NEW OBSERVATIONS"
        } else {
            "MEASURED SERIES · SOURCE-BACKED"
        }))
        .child(
            row()
                .w_full()
                .gap(12.)
                .items_center()
                .child(
                    col()
                        .grow(1.)
                        .min_w(0.)
                        .gap(4.)
                        .child(
                            text(string(&variable["name"]))
                                .font(TextStyle::new(19., 600.))
                                .color(workspace::ink())
                                .w_full()
                                .wrap(),
                        )
                        .child(
                            text(format!(
                                "{} · {} to {} · {}",
                                string(&geometry["label"]), start, end, units
                            ))
                            .font(TextStyle::new(13., 400.))
                            .color(workspace::muted())
                            .w_full()
                            .wrap_anywhere(),
                        ),
                )
                .child(
                    text(status_text(&status))
                        .font(TextStyle::new(12., 550.))
                        .color(workspace::ink())
                        .w(180.)
                        .wrap(),
                ),
        )
        .child(
            row()
                .w_full()
                .gap(10.)
                .child(stat(
                    "RATE / DECADE",
                    &analysis["slope_per_decade"],
                    &format!("{} per decade", units),
                ))
                .child(stat(
                    &format!("NOMINAL {confidence}% INTERVAL"),
                    &analysis["interval"],
                    &format!("{} per year", units),
                ))
                .child(stat("P-VALUE", &analysis["p_value"], "Nominal inference")),
        )
        .child(
            text(format!(
                "{} valid · {} missing · {} · support is not automatically a regional mean",
                number(&analysis["n"]),
                number(&analysis["missing"]),
                string(&variable["support"])
            ))
            .font(TextStyle::new(12., 400.))
            .color(workspace::muted())
            .w_full()
            .wrap_anywhere(),
        );

    if let Some(chart) = &s.chart {
        card = card
            .child(el().w_full().h(230.).pixels(chart.pixels()))
            .child(kicker(format!(
                "OBSERVED VALUES · FITTED TREND · {} · MISSING PERIODS REMAIN GAPS",
                units
            )));
    }
    card.child(
        Button::new("Inspect methods, QA and provenance")
            .variant(rune_kit::ButtonVariant::Ghost)
            .build(k)
            .min_h(40.)
            .on_press(|s: &mut State| s.tab = Tab::Evidence),
    )
    .into()
}

fn report_entry(s: &State, k: &Kit, message: &Value, artifact: Option<&Value>) -> El {
    let id = string(&message["id"]);
    let details_key = format!("report-details-{id}");
    let expanded = s.expanded_activity.contains(&details_key);
    let current=session(s);let content=string(&message["text"]);
    let mut entry = col()
        .key(format!("gaia-report-{id}"))
        .w_full()
        .gap(14.)
        .child(text("GAIA").font(workspace::font(13.,600.)).color(workspace::muted()))
        .child(rune::memo(format!("report-text-{id}"),(&content,list(&current["literature"]).len(),list(&current["artifacts"]).len()),||prose::report(&content,current,&id)))
        .child(prose::sources(s,k,&content,current,format!("report-sources-{id}")));

    if let Some(artifact) = artifact {
        entry=entry.child(workspace::disclosure(k,"Measured series & uncertainty",expanded,details_key));
        if expanded {
            entry = entry.child(evidence_card(s, k, artifact));
        }
    }
    if !message["label"].is_null() {
        entry = entry.child(line("Evidence status", &message["label"]));
    }
    row().w_full().items_start().gap(14.)
        .child(if let Some(mark)=s.marks.first(){el().size(28.,28.).pixels(mark.pixels()).label("GAIA")}else{el().size(28.,28.)})
        .child(entry.grow(1.).min_w(0.)).into()
}

pub fn view(s: &State, k: &Kit, current: &Value) -> El {
    let messages = list(&current["messages"]);
    let running = current["chatRunning"].as_bool().unwrap_or(false);
    let latest_report = messages.iter().rev().find(|m| string(&m["role"]) != "user");
    let selected = &s.snapshot["artifact"];
    let show_artifact = if selected.is_null() { None } else { Some(selected) };
    let mut body = col().w_full().max_w(880.).gap(32.);

    if messages.is_empty() {
        let mut welcome = col()
            .w_full()
            .min_w(0.)
            .gap(18.)
            .padding(12.)
            .child(kicker("EARTH SYSTEMS · INVESTIGATION"))
            .child(
                text("Begin with what you’ve noticed.")
                    .font(TextStyle::new(
                        if s.snapshot["viewportWidth"].as_f64().unwrap_or(1280.) < 600. {
                            28.
                        } else {
                            36.
                        },
                        500.,
                    ))
                    .color(workspace::ink())
                    .w_full()
                    .wrap(),
            )
            .child(label("GAIA will clarify what matters, gather evidence and return the results with their limits."));
        for (title, prompt) in [
            ("Climate", "Has Muscat, Oman, warmed from 2001 to 2024?"),
            ("Vegetation", "Has vegetation greenness changed around Nairobi National Park?"),
            (
                "Local observation",
                "I’ve noticed a change in my local environment. Can you help investigate?",
            ),
        ] {
            let draft = prompt.to_string();
            welcome = welcome.child(
                Button::new(title)
                    .variant(rune_kit::ButtonVariant::Outline)
                    .build(k)
                    .w_full()
                    .min_h(52.)
                    .on_press(move |s: &mut State| {
                        s.fields[0] = TextEdit::new(&draft);
                        command("draft", json!({"sessionID":s.selected,"text":draft}));
                    }),
            );
        }
        welcome = welcome.child(kicker("NO DATASET OR SPECIALIST SETUP REQUIRED"));
        body = body.child(welcome);
    }

    for message in messages {
        if string(&message["role"]) == "user" {
            let viewport=s.snapshot["viewportWidth"].as_f64().unwrap_or(1280.) as f32;
            let sidebar_width=if viewport>=900.&&sidebar::is_open(s,false){280.}else{0.};
            let rail_width=if viewport>=1200.&&s.canvas_open{360.}else{0.};
            let available=(viewport-sidebar_width-rail_width-64.).min(880.).max(180.);
            let content=string(&message["text"]);
            let width=(content.chars().count() as f32*7.8+32.).min(available*0.82).max(80.);
            let question=col().w(width).gap(7.).padding(14.).radius(14.).fill(workspace::color("#24272b"))
                .child(text("You").font(TextStyle::new(11.,600.)).color(workspace::muted()))
                .child(text(content).font(TextStyle{line_height:23.,..TextStyle::new(15.,400.)}).color(workspace::ink()).w_full().wrap_anywhere());
            body=body.child(row().w_full().justify_end().child(question));
        } else {
            let is_latest_report = latest_report
                .map(|latest| string(&latest["id"]) == string(&message["id"]))
                .unwrap_or(false);
            body = body.child(report_entry(
                s,
                k,
                message,
                if is_latest_report&&!message["investigationID"].is_null() { show_artifact } else { None },
            ));
        }
    }

    if running {
        let live_body=col().grow(1.).min_w(0.).gap(12.)
            .child(text("GAIA").font(TextStyle::new(13.,600.)).color(workspace::muted()))
            .child(live::role(s,k,current,"gaia",true));
        let mut active=col().w_full().gap(8.);
        let mut seen = std::collections::HashSet::new();
        for request in list(&current["taskGraph"]["requests"]).iter().rev() {
            if current["taskGraph"]["id"]!=current["activeGraphID"]{continue;}
            let role = string(&request["role"]);
            if !seen.insert(role.clone()) {
                continue;
            }
            let (name, index) = match role.as_str() {
                "aura" => ("AURA", 1),
                "thalassa" => ("THALASSA", 2),
                "chloris" => ("CHLORIS", 3),
                "zoe" => ("ZOE", 4),
                _ => continue,
            };
            let status=match string(&request["status"]).as_str(){"starting"=>"Starting","running"=>"Reviewing evidence","queued"=>"Queued","completed"=>"Review complete","failed"=>"Review interrupted","cancelled"=>"Cancelled",_=>"Assigned"}.to_string();
            let mark=s.marks.get(index).cloned();
            active=active.child(Button::new(format!("Open {name} work. {status}"))
                .variant(rune_kit::ButtonVariant::Ghost)
                .label_with(move|_,_|{
                    let icon=if let Some(mark)=&mark{el().size(20.,20.).pixels(mark.pixels())}else{el().size(20.,20.)};
                    row().w_full().min_w(0.).items_center().gap(10.).child(icon)
                        .child(text(name).font(TextStyle::new(12.,550.)).color(workspace::muted()))
                        .child(text(status.clone()).font(TextStyle::new(12.,400.)).color(workspace::color("#89939e")).grow(1.).min_w(0.).max_lines(1))
                        .child(live::chevron(false)).into()
                }).build(k).w_full().min_h(34.).padding(6.).radius(6.)
                .on_press(move|s:&mut State|s.tab=Tab::Inspector(index)));
        }
        let live_body=live_body.child(active);
        body=body.child(row().w_full().items_start().gap(14.).child(if let Some(mark)=s.marks.first(){el().size(28.,28.).pixels(mark.pixels())}else{el().size(28.,28.)}).child(live_body));
    } else if let Some(artifact) = show_artifact {
        let others: Vec<_> = list(&current["artifacts"])
            .iter()
            .filter(|item| string(&item["id"]) != string(&artifact["id"]))
            .collect();
        if !others.is_empty() {
            body = body
                .child(kicker("OTHER RETAINED SERIES"))
                .child(label("Select a series to inspect its measured trend and chart."));
            for item in others {
                let artifact_id = string(&item["id"]);
                body = body.child(
                    Button::new(format!(
                        "{} · {} to {} · {}",
                        string(&item["acquisition"]["variable"]["name"]),
                        string(&item["analysis"]["requested_start"]),
                        string(&item["analysis"]["requested_end"]),
                        string(&item["analysis"]["status"]),
                    ))
                    .variant(rune_kit::ButtonVariant::Ghost)
                    .build(k)
                    .w_full()
                    .min_h(42.)
                    .on_press(move |_: &mut State| {
                        command("artifact-select", json!({"artifactID":artifact_id}));
                    }),
                );
            }
        }
        body = body.child(
            row()
                .w_full()
                .gap(10.)
                .child(
                    Button::new("Methods & QA")
                        .variant(rune_kit::ButtonVariant::Outline)
                        .build(k)
                        .min_h(42.)
                        .on_press(|s: &mut State| s.tab = Tab::Evidence),
                )
                .child(button(k, "Export evidence", "export", selected_action(s))),
        );
    }
    if !running&&!list(&current["liveTurns"]).is_empty(){body=body.child(live::role(s,k,current,"gaia",false));}
    if !list(&current["extractions"]).is_empty(){body=body.child(workspace::processes(s,k,current));}
    col().w_full().items_center().child(body).into()
}

pub fn send(s:&mut State){
    if session(s)["chatRunning"].as_bool().unwrap_or(false)||!s.snapshot["status"]["configured"].as_bool().unwrap_or(false)||s.fields[0].text.trim().is_empty(){return;}
    let content=s.fields[0].text.clone();
    command("chat",json!({"sessionID":s.selected,"text":content}));
    s.fields[0]=TextEdit::new("");
}
pub fn composer(s: &State, k: &Kit, current: &Value) -> El {
    let running = current["chatRunning"].as_bool().unwrap_or(false);
    let ready = s.snapshot["status"]["configured"].as_bool().unwrap_or(false);
    let input = rune::text_input(&s.fields[0],TextStyle{line_height:23.,..TextStyle::new(15.,400.)})
        .key("gaia-composer-input")
        .label("Your question to GAIA")
        .placeholder("Ask GAIA about a change you’ve noticed…",workspace::muted())
        .color(workspace::ink()).caret(workspace::ink(),workspace::color("#505961"))
        .w_full().wrap_anywhere()
        .on_edit(|s: &mut State| &mut s.fields[0])
        .on_submit(|s:&mut State,_|send(s))
        .on_input_change(|s: &mut State, _| {
            command("draft", json!({"sessionID":s.selected,"text":s.fields[0].text}))
        });
    let send = Button::new(if running { "Stop" } else { "Ask GAIA ↑" })
        .variant(rune_kit::ButtonVariant::Submit)
        .disabled(!running&&(!ready || s.fields[0].text.trim().is_empty()))
        .build(k)
        .min_h(34.).radius(17.)
        .on_press(move|s: &mut State| {
            if running{command("chat-stop",selected_action(s));}else{self::send(s);}
        });
    let composer=col().w_full().max_w(880.).gap(5.).padding(12.)
        .fill(workspace::color("#1c1f23"))
        .border(0.6,workspace::color("#ffffff").alpha(0.14)).radius(16.)
        .child(rune::auto_grow(input,1,4).max_h(96.))
        .child(
            row()
                .w_full()
                .gap(12.)
                .items_center()
                .child(
                    text(if ready {
                        "Enter to send · Shift + Enter for a new line"
                    } else {
                        "Connect a compatible model to begin. NASA public data need no key."
                    })
                    .font(TextStyle::new(11., 400.))
                    .color(workspace::muted())
                    .grow(1.)
                    .min_w(0.)
                    .wrap(),
                )
                .child(send),
        );
    col().w_full().items_center().child(composer).into()
}
