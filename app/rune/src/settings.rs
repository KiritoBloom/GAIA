use super::*;
use rune_kit::{Combobox, ComboboxOption, ComboboxState, Switch};

#[derive(Clone,Copy,PartialEq)]
enum Source{Current,Local,Manual}
impl Source{fn name(self)->&'static str{match self{Self::Current=>"current",Self::Local=>"local",Self::Manual=>"manual"}}}
#[derive(Default,PartialEq)]
enum Phase{#[default]Idle,Awaiting,Debouncing,Loading,Ready,Error}
pub struct Settings{
    revision:u64,opened:bool,source:Source,phase:Phase,protocol:String,variant:String,
    api:ComboboxState,model:ComboboxState,thinking:ComboboxState,options:Vec<ComboboxOption>,details:bool,manual:bool,diagnostics:bool,
}
impl Default for Settings{fn default()->Self{Self{revision:u64::MAX,opened:false,source:Source::Manual,phase:Phase::Idle,protocol:"responses".into(),variant:String::new(),api:Default::default(),model:Default::default(),thinking:Default::default(),options:Vec::new(),details:false,manual:false,diagnostics:false}}}

pub fn poll(s:&mut State)->bool{
    if s.tab==Tab::Provider&&!s.settings.opened{s.settings.opened=true;command("provider-open",json!({}));return true;}false
}
pub fn sync(s:&mut State){
    let data=&s.snapshot["providerSettings"];let revision=data["revision"].as_u64().unwrap_or(0);
    if revision==s.settings.revision{return;}s.settings.revision=revision;
    s.settings.phase=match string(&data["phase"]).as_str(){"awaiting"=>Phase::Awaiting,"debouncing"=>Phase::Debouncing,"loading"=>Phase::Loading,"ready"=>Phase::Ready,"error"=>Phase::Error,_=>Phase::Idle};
    s.settings.source=match string(&data["source"]).as_str(){"current"=>Source::Current,"local"=>Source::Local,_=>Source::Manual};
    let protocol=string(&data["protocol"]);if !protocol.is_empty(){s.settings.protocol=protocol;}
    let endpoint=string(&data["endpoint"]);if !endpoint.is_empty()&&s.fields[7].text!=endpoint{s.fields[7]=TextEdit::new(&endpoint);}
    if !data["model"].is_null(){let model=string(&data["model"]);if model!=s.fields[9].text{s.fields[9]=TextEdit::new(&model);}}
    s.settings.variant=string(&data["variant"]);
    s.settings.options=list(&data["models"]).iter().map(|model|{let mut option=ComboboxOption::new(string(&model["id"]),string(&model["name"]));option.detail=string(&model["id"]);option.disabled=model["tools"]==false;option}).collect();
    if s.settings.phase==Phase::Ready{s.fields[8]=TextEdit::new("");}
}
fn form(s:&State)->Value{json!({"source":s.settings.source.name(),"protocol":s.settings.protocol,"endpoint":s.fields[7].text,"apiKey":s.fields[8].text})}
fn edit(s:&mut State,index:usize){
    s.settings.source=Source::Manual;
    if index==7{s.fields[8]=TextEdit::new("");}
    command("provider-form",form(s));
}
fn choose_protocol(s:&mut State,id:&str){
    s.settings.api.close();if id==s.settings.protocol{return;}
    s.settings.protocol=id.into();s.settings.source=Source::Manual;s.settings.variant.clear();s.settings.manual=false;
    s.fields[7]=TextEdit::new(if id=="anthropic"{"https://api.anthropic.com/v1"}else{"https://api.openai.com/v1"});s.fields[8]=TextEdit::new("");s.fields[9]=TextEdit::new("");
    command("provider-form",form(s));
}
fn choose_model(s:&mut State,id:&str){s.settings.model.close();s.settings.manual=false;s.fields[9]=TextEdit::new(id);s.settings.variant.clear();command("provider-choice",json!({"model":id,"variant":""}));}
fn note(value:impl Into<String>)->El{text(value.into()).font(TextStyle{line_height:20.,..workspace::font(12.,400.)}).color(workspace::muted()).w_full().wrap_anywhere()}
fn title(value:&str)->El{text(value).font(workspace::font(12.,550.)).color(workspace::ink())}
fn blocked(s:&State)->bool{!s.snapshot["status"]["provider_settings_version"].is_number()||!s.snapshot["operation"].is_null()||s.snapshot["status"]["proof"]["state"]=="running"||list(&s.snapshot["status"]["sessions"]).iter().any(|value|value["chatRunning"].as_bool().unwrap_or(false))}
fn select_trigger(k:&Kit,name:&str,value:&str,disabled:bool)->El{
    let value=value.to_owned();Button::new(name).variant(rune_kit::ButtonVariant::Ghost).disabled(disabled)
        .label_with(move|_,_|row().w_full().gap(8.).items_center().child(text(value.clone()).font(workspace::font(14.,400.)).color(workspace::ink()).grow(1.).min_w(0.))
            .child(rune::canvas(rune::Shape::new().stroke(vec![[3.,5.],[7.,9.],[11.,5.]],1.3,workspace::muted())).size(14.,14.)))
        .build(k).w_full().min_h(36.).padding(10.).fill(workspace::color("#191c20")).border(1.,workspace::color("#30353a")).radius(8.)
}
fn input(s:&State,k:&Kit,index:usize,name:&str,secure:bool)->El{
    let field=TextInput::new(&s.fields[index]).label(name).placeholder(if secure{"Enter API key"}else{"https://…/v1"}).text_style(workspace::font(14.,400.)).height(36.).width(None)
        .on_edit(move|s:&mut State|&mut s.fields[index]).on_change(move|s:&mut State,_|edit(s,index)).on_submit(|s:&mut State,_|command("provider-models",form(s)));
    let field=if secure{field.secure()}else{field};
    col().w_full().gap(7.).child(title(name)).child(field.build(k)).into()
}
fn toggle(k:&Kit,label:&str,open:bool)->El{
    let label=label.to_owned();Button::new(label.clone()).variant(rune_kit::ButtonVariant::Ghost)
        .label_with(move|_,_|row().w_full().gap(8.).items_center().child(live::chevron(open)).child(text(label.clone()).font(workspace::font(12.,450.)).color(workspace::muted())))
        .build(k).w_full().min_h(30.).padding(4.).expanded(open)
}
pub fn view(s:&State,k:&Kit,layer:&mut Vec<El>)->El{
    let mut tokens=k.clone();tokens.ty.ui=workspace::font(14.,400.);tokens.ty.ui_medium=workspace::font(14.,550.);tokens.ty.body=workspace::font(14.,400.);let k=&tokens;
    let status=&s.snapshot["status"];let discovery=&s.snapshot["providerSettings"];let connected=status["configured"].as_bool().unwrap_or(false);
    let locked=list(&status["sessions"]).iter().any(|value|value["chatRunning"].as_bool().unwrap_or(false))||status["proof"]["state"]=="running";
    let legacy=!status["provider_settings_version"].is_number();let busy=!s.snapshot["operation"].is_null();let loading=matches!(s.settings.phase,Phase::Idle|Phase::Loading|Phase::Debouncing);
    let compact=s.snapshot["viewportWidth"].as_f64().unwrap_or(1280.)<1050.;
    let mut body=col().w_full().max_w(720.).gap(20.).child(col().w_full().gap(7.).child(heading("Model connection")).child(note("Choose an API, model and thinking preference. Keys stay private.")));
    if connected{
        let model=format!("{}{}",string(&status["model"]),if string(&status["variant"]).is_empty(){String::new()}else{format!(" · {}",string(&status["variant"]))});
        body=body.child(row().w_full().gap(12.).items_center().child(text("Connected").font(workspace::font(11.,550.)).color(workspace::color("#bcc9bd")))
            .child(col().grow(1.).min_w(0.).gap(3.).child(text(string(&status["provider"])).font(workspace::font(14.,550.)).color(workspace::ink())).child(note(model))));
    }
    if locked||legacy{body=body.child(note(if locked&&legacy{"Investigation running · changes locked. New integrations activate after a safe backend reload."}else if locked{"Investigation running · browse models now, apply changes when it finishes."}else{"New integrations activate after a safe backend reload."}));}
    let api_options=vec![ComboboxOption::new("responses","OpenAI Responses"),ComboboxOption::new("chat","OpenAI Chat / compatible"),ComboboxOption::new("anthropic","Anthropic Messages")];
    let api=Combobox::new("settings-api",&s.settings.api,&api_options,|s:&mut State|&mut s.settings.api).current(Some(&s.settings.protocol)).label("API type").placeholder("Choose API type").width(360.)
        .trigger(select_trigger(k,"API type",api_options.iter().find(|option|option.id==s.settings.protocol).map(|option|option.label.as_str()).unwrap_or("Choose API type"),false))
        .on_choose(|s,id,_|choose_protocol(s,id)).build(k,layer);
    let mut form_view=col().w_full().gap(18.).child(col().w_full().gap(7.).child(title("API type")).child(api));
    if s.settings.source==Source::Manual{form_view=form_view.child(input(s,k,8,"API key",true));}
    else{form_view=form_view.child(row().w_full().gap(8.).items_center().child(note(if s.settings.source==Source::Current{"Using the connected provider’s private credential."}else{"Using private credentials from local configuration."}))
        .child(Button::new("Replace key").variant(rune_kit::ButtonVariant::Ghost).build(k).min_h(30.).on_press(|s:&mut State|{s.settings.source=Source::Manual;s.fields[8]=TextEdit::new("");command("provider-form",form(s));})));}
    let options=&s.settings.options;
    let selected=if s.fields[9].text.is_empty(){None}else{Some(s.fields[9].text.as_str())};
    let model=Combobox::new("settings-model",&s.settings.model,&options,|s:&mut State|&mut s.settings.model).current(selected).label("Model").placeholder(if loading{"Finding models…"}else{"Search and select a model"}).search_placeholder("Search model names or IDs…").empty_message("No matching tool-capable model.").width(if compact{440.}else{560.}).max_height(280.)
        .trigger(select_trigger(k,"Model",if loading{"Finding models…"}else{options.iter().find(|option|Some(option.id.as_str())==selected).map(|option|option.label.as_str()).unwrap_or("Search and select a model")},loading||options.is_empty()))
        .disabled(loading||options.is_empty()).on_choose(|s,id,_|choose_model(s,id)).build(k,layer);
    let detail=list(&discovery["models"]).iter().find(|value|value["id"]==s.fields[9].text);
    let mut variants=vec![ComboboxOption::new("default","Provider default")];
    if let Some(detail)=detail{for value in list(&detail["variants"]){variants.push(ComboboxOption::new(string(&value["id"]),string(&value["name"])));}}
    let current=if s.settings.variant.is_empty(){"default"}else{s.settings.variant.as_str()};
    let thinking=Combobox::new("settings-thinking",&s.settings.thinking,&variants,|s:&mut State|&mut s.settings.thinking).current(Some(current)).label("Thinking").width(300.).disabled(loading||variants.len()==1)
        .trigger(select_trigger(k,"Thinking",variants.iter().find(|option|option.id==current).map(|option|option.label.as_str()).unwrap_or("Provider default"),loading||variants.len()==1))
        .on_choose(|s,id,_|{s.settings.thinking.close();s.settings.variant=if id=="default"{String::new()}else{id.into()};command("provider-choice",json!({"model":s.fields[9].text,"variant":s.settings.variant}));}).build(k,layer);
    let model_field=col().grow(1.).min_w(0.).gap(7.).child(title("Model")).child(model);
    let thinking_field=col().grow(1.).min_w(0.).gap(7.).child(title("Thinking")).child(thinking);
    form_view=form_view.child(if compact{col().w_full().gap(18.).child(model_field).child(thinking_field)}else{row().w_full().gap(14.).child(model_field).child(thinking_field)});
    let message=string(&discovery["message"]);if !message.is_empty(){form_view=form_view.child(note(message).role(if s.settings.phase==Phase::Error{"alert"}else{"status"}));}
    let changed=!connected||s.settings.source==Source::Manual||s.fields[9].text!=string(&status["model"])||s.settings.variant!=string(&status["variant"])||s.settings.protocol!=string(&status["protocol"]);
    let can_apply=!locked&&!legacy&&!busy&&!loading&&!s.fields[9].text.is_empty()&&(s.settings.phase==Phase::Ready||s.settings.manual)&&changed;
    form_view=form_view.child(row().w_full().gap(10.).items_center().child(Button::new(if connected{"Apply changes"}else{"Connect"}).variant(rune_kit::ButtonVariant::Submit).disabled(!can_apply).build(k).min_h(36.).on_press(|s:&mut State|{
        if blocked(s)||s.fields[9].text.is_empty()||matches!(s.settings.phase,Phase::Idle|Phase::Loading|Phase::Debouncing)||s.settings.phase!=Phase::Ready&&!s.settings.manual{return;}
        command("provider-connect",json!({"source":s.settings.source.name(),"protocol":s.settings.protocol,"endpoint":s.fields[7].text,"apiKey":s.fields[8].text,"model":s.fields[9].text,"variant":s.settings.variant}));s.fields[8]=TextEdit::new("");
    })).child(Button::new("Refresh models").variant(rune_kit::ButtonVariant::Ghost).disabled(loading).build(k).min_h(36.).on_press(|_:&mut State|command("provider-reload",json!({})))));
    body=body.child(form_view);
    let semantic=&status["semantic"];let semantic_key=semantic["configured"].as_bool().unwrap_or(false);let semantic_enabled=semantic["enabled"].as_bool().unwrap_or(false);
    body=body.child(row().w_full().gap(16.).items_center().border_sides([1.,0.,0.,0.],workspace::color("#2a2e33")).padding(16.)
        .child(col().grow(1.).min_w(0.).gap(5.).child(text("Jev semantic review").font(workspace::font(14.,550.)).color(workspace::ink()))
            .child(note(if semantic_key{"Optional and shadow-only. Scientific work does not depend on it."}else if semantic_enabled{"Enabled, but skipped because no TypeSafe key is configured. GAIA works normally without it."}else{"Off · no TypeSafe key. GAIA works normally without it."})))
        .child(Switch::new(semantic_enabled).label("Enable optional Jev semantic review").hide_label().disabled(locked||legacy||!semantic_key||busy).on_toggle(move|s:&mut State|{if !blocked(s){command("semantic-settings",json!({"enabled":!semantic_enabled}));}}).build(k)));
    body=body.child(toggle(k,"Connection details",s.settings.details).on_press(|s:&mut State|s.settings.details=!s.settings.details));
    if s.settings.details{
        let mut details=col().w_full().gap(14.).child(input(s,k,7,"API base URL",false)).child(note("Official endpoints use native OpenAI or Anthropic clients. Custom endpoints use the selected wire protocol. A key is never reused for a different endpoint."));
        details=details.child(note("Thinking choices come from provider or published model metadata; custom gateways may not implement every option. Higher effort can increase latency and cost. Private reasoning is never displayed."));
        details=details.child(toggle(k,"Enter a model ID manually",s.settings.manual).on_press(|s:&mut State|{s.settings.manual=!s.settings.manual;s.settings.variant.clear();command("provider-choice",json!({"model":s.fields[9].text,"variant":""}));}));
        if s.settings.manual{details=details.child(TextInput::new(&s.fields[9]).label("Manual model ID").placeholder("Exact model ID or alias").width(None).height(36.).text_style(workspace::font(14.,400.)).on_edit(|s:&mut State|&mut s.fields[9]).on_change(|s:&mut State,_|command("provider-choice",json!({"model":s.fields[9].text,"variant":""}))).build(k)).child(note("Use this only if the provider does not publish a model catalogue. Thinking remains at the provider default."));}
        if connected{details=details.child(Button::new("Disconnect").variant(rune_kit::ButtonVariant::Ghost).disabled(locked||busy).build(k).min_h(32.).on_press(|s:&mut State|{if !blocked(s){command("provider-remove",json!({}));}}));}
        body=body.child(details);
    }
    body=body.child(toggle(k,"Optional connection diagnostics",s.settings.diagnostics).on_press(|s:&mut State|s.settings.diagnostics=!s.settings.diagnostics));
    if s.settings.diagnostics{body=body.child(note("A synthetic role/tool check verifies routing, not scientific correctness. It is not required to chat."))
        .child(Button::new("Run role/tool check").variant(rune_kit::ButtonVariant::Ghost).disabled(!connected||locked||busy).build(k).min_h(32.).on_press(|s:&mut State|{if !blocked(s){command("provider-proof",json!({}));}}));}
    body.into()
}
