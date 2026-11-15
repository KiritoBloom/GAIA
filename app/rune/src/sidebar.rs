//! A restrained, contained investigation sidebar.
use super::*;
use workspace::color;

const PANEL:&str="#121315";
const RAISED:&str="#17191c";
const SELECTED:&str="#262a2e";
const EDGE:&str="#33383d";
const TEXT:&str="#f0f0f2";
const QUIET:&str="#b0b0b9";
const FAINT:&str="#a0a0ab";

#[derive(Clone,Copy,Default)]
pub enum Visibility{#[default] Auto,Open,Closed}
pub fn is_open(s:&State,compact:bool)->bool{match s.sidebar{Visibility::Auto=>!compact,Visibility::Open=>true,Visibility::Closed=>false}}
pub fn toggle(s:&mut State,compact:bool){s.sidebar=if is_open(s,compact){Visibility::Closed}else{Visibility::Open};}

fn text_color()->rune::Color{color(TEXT)}
fn quiet_color()->rune::Color{color(QUIET)}
fn section_title(value:&str)->El{
    text(value).font(TextStyle::new(12.,500.).mono().tracking(0.5)).color(color(FAINT))
}
#[derive(Clone,Copy)]
enum Icon{Chat,Agents,Results,Activity,Sources,History,Settings,Plus}

// Identical view boxes and stroke weights avoid font-dependent glyph baselines.
fn icon_view(icon:Icon,tone:rune::Color)->El{
    let paths:Vec<Vec<[f32;2]>>=match icon{
        Icon::Chat=>vec![vec![[4.,3.],[16.,3.],[18.,5.],[18.,13.],[16.,15.],[8.,15.],[3.,18.],[3.,5.],[4.,3.]]],
        Icon::Agents=>vec![vec![[10.,2.],[17.,6.],[17.,14.],[10.,18.],[3.,14.],[3.,6.],[10.,2.]],vec![[3.,6.],[10.,10.],[17.,6.]],vec![[10.,10.],[10.,18.]]],
        Icon::Results=>vec![vec![[3.,3.],[3.,17.],[18.,17.]],vec![[6.,12.],[10.,8.],[13.,10.],[17.,5.]]],
        Icon::Activity=>vec![vec![[2.,10.],[6.,10.],[8.,4.],[12.,16.],[14.,10.],[18.,10.]]],
        Icon::Sources=>vec![vec![[3.,3.],[9.,3.],[10.,5.],[11.,3.],[17.,3.],[17.,16.],[11.,16.],[10.,18.],[9.,16.],[3.,16.],[3.,3.]],vec![[10.,5.],[10.,18.]]],
        Icon::History=>vec![vec![[6.,5.],[17.,5.]],vec![[6.,10.],[17.,10.]],vec![[6.,15.],[17.,15.]],vec![[2.,5.],[3.,5.]],vec![[2.,10.],[3.,10.]],vec![[2.,15.],[3.,15.]]],
        Icon::Settings=>vec![vec![[3.,5.],[7.,5.]],vec![[11.,5.],[17.,5.]],vec![[7.,3.],[11.,3.],[11.,7.],[7.,7.],[7.,3.]],vec![[3.,14.],[11.,14.]],vec![[15.,14.],[17.,14.]],vec![[11.,12.],[15.,12.],[15.,16.],[11.,16.],[11.,12.]]],
        Icon::Plus=>vec![vec![[4.,10.],[16.,10.]],vec![[10.,4.],[10.,16.]]],
    };
    let shape=paths.into_iter().fold(rune::Shape::new(),|shape,path|shape.stroke(path,1.6,tone));
    rune::canvas(shape).size(20.,20.).min_w(20.).min_h(20.)
}
fn display_title(value:&str)->String{
    let mut parts=value.split(" · ");
    let Some(subject)=parts.next() else{return value.to_owned()};
    let Some(place)=parts.next() else{return value.to_owned()};
    let place=place.split(',').next().unwrap_or(place).trim();
    if place.is_empty(){subject.to_owned()}else{format!("{subject} · {place}")}
}
fn contained_row(k:&Kit,icon:Icon,title:String,detail:Option<String>,selected:bool,tall:bool)->El{
    let row_description=detail.as_ref().map(|d|format!("{title}. {d}")).unwrap_or_else(||title.clone());
    let accessible=if tall&&selected{format!("Selected investigation. {row_description}")}else if tall{format!("Open investigation. {row_description}")}else{row_description};
    let title_color=if selected{text_color()}else{color("#dddddf")};
    let icon_color=if selected{color("#f0f0f2")}else{color("#b5b5be")};
    let title_lines=if detail.is_some(){2}else{1};
    let height=if tall{82.}else if detail.is_some(){64.}else{48.};
    Button::new(accessible).help(title.clone()).variant(rune_kit::ButtonVariant::Ghost)
        .label_with(move|_,_|{
            let visible_title=if tall{display_title(&title)}else{title.clone()};
            let label=text(visible_title).font(TextStyle::new(15.,if selected{600.}else{450.})).color(title_color).w_full().max_lines(title_lines);
            let marker=el().size(30.,30.).min_w(30.).min_h(30.).center().child(icon_view(icon,icon_color));
            let mut copy=col().grow(1.).min_w(0.).gap(5.).child(label);
            if let Some(detail)=detail{copy=copy.child(text(detail).font(TextStyle::new(12.,400.).mono()).color(quiet_color()).w_full().truncate());}
            row().w_full().min_w(0.).items_center().gap(12.).child(marker).child(copy).into()
        })
        .build(k).w_full().h(height).min_h(height)
        .padding(10.)
        .fill(color(if selected{SELECTED}else{RAISED}))
        .border_sides([0.,0.,1.,if selected{2.}else{0.}],color(if selected{"#d6dce0"}else{EDGE}))
        .radius(4.).clip_rounded(4.)
}

fn nav_item(k:&Kit,title:&str,tab:Tab,selected:bool,compact:bool)->El{
    let icon=match tab{Tab::Conversation=>Icon::Chat,Tab::System=>Icon::Agents,Tab::Evidence=>Icon::Results,Tab::Investigation=>Icon::Activity,Tab::Research=>Icon::Sources,_=>Icon::History};
    contained_row(k,icon,title.to_owned(),None,selected,false).on_press(move|s:&mut State|{
        s.tab=tab;
        if compact{s.sidebar=Visibility::Closed;}
    })
}

pub fn view(s:&State,k:&Kit,compact:bool)->El{
    let brand=col().w_full().padding(2.).gap(16.)
        .child(row().w_full().items_center().gap(11.)
            .child(if let Some(mark)=s.marks.first(){el().size(36.,36.).pixels(mark.pixels())}else{el().w(36.).h(36.)})
            .child(col().gap(3.)
                .child(text("GAIA").font(TextStyle::new(21.,600.).tracking(1.2)).color(text_color()))
                .child(text("Earth science").font(TextStyle::new(12.,400.).mono()).color(quiet_color()))))
        .child(Button::new("New investigation").help("Start a new investigation with GAIA")
            .variant(rune_kit::ButtonVariant::Ghost)
            .label_with(|_,_|row().w_full().items_center().justify_center().gap(9.)
                .child(icon_view(Icon::Plus,color("#e1e5e9")))
                .child(text("New investigation").font(TextStyle::new(14.,550.)).color(color("#e1e5e9"))).into())
            .build(k).w_full().h(48.).min_h(48.)
            .padding(12.).fill(color("#22262a")).border(1.,color("#50575e")).radius(4.)
            .on_press(move|s:&mut State|{
                command("new",json!({"depth":"plain"}));
                if compact{s.sidebar=Visibility::Closed;}
            }));

    let selected_tab=s.tab;
    let navigation=col().w_full().gap(6.)
        .child(section_title("WORKSPACE"))
        .child(nav_item(k,"Question",Tab::Conversation,selected_tab==Tab::Conversation,compact))
        .child(nav_item(k,"Specialists",Tab::System,selected_tab==Tab::System,compact))
        .child(nav_item(k,"Measurements",Tab::Evidence,selected_tab==Tab::Evidence,compact))
        .child(nav_item(k,"Record",Tab::Investigation,selected_tab==Tab::Investigation,compact))
        .child(nav_item(k,"Literature",Tab::Research,selected_tab==Tab::Research,compact));

    let sessions=list(&s.snapshot["status"]["sessions"]);
    let mut history=col().w_full().gap(7.);
    let mut count=0usize;
    for current in sessions{
        if current["archived"].as_bool().unwrap_or(false){continue;}
        let id=string(&current["id"]);
        if current["message_count"].as_u64().unwrap_or(list(&current["messages"]).len() as u64)==0&&list(&current["artifacts"]).is_empty()&&current["field_case_count"].as_u64().unwrap_or(list(&current["fieldCases"]).len() as u64)==0&&id!=s.selected{continue;}
        count+=1;
        let raw_title=string(&current["title"]).replace("Â·","·");
        let title=if raw_title.is_empty(){"New chat".into()}else{raw_title.strip_prefix("Earth-system investigation · ").unwrap_or(&raw_title).to_owned()};
        let status=if current["chatRunning"].as_bool().unwrap_or(false){"Running"}else{"Recorded"};
        let date=string(&current["created"]);let date=date.get(..10).unwrap_or("");
        let artifacts=list(&current["artifacts"]);
        let detail=if let Some(artifact)=artifacts.first(){
            let quantity=string(&artifact["acquisition"]["variable"]["id"]);
            let start=string(&artifact["analysis"]["requested_start"]);
            let end=string(&artifact["analysis"]["requested_end"]);
            if !quantity.is_empty()&&!start.is_empty()&&!end.is_empty(){
                format!("{} / {}–{}",quantity,start.get(..4).unwrap_or(&start),end.get(..4).unwrap_or(&end))
            }else if date.is_empty(){status.to_owned()}else{format!("{status} · {date}")}
        }else if date.is_empty(){status.to_owned()}else{format!("{status} · {date}")};
        let record_icon=if artifacts.is_empty(){Icon::Chat}else{Icon::Results};
        history=history.child(contained_row(k,record_icon,title,Some(detail),id==s.selected,true)
            .on_press(move|s:&mut State|{
                command("select",json!({"sessionID":id}));
                if compact{s.sidebar=Visibility::Closed;}
            }));
    }
    if count==0{history=history.child(el().w_full().padding(12.).fill(color("#151518")).border(1.,color(EDGE)).radius(10.)
        .child(text("Your investigations will appear here.").font(TextStyle::new(13.,450.)).color(quiet_color()).w_full().wrap()));}

    let recent=col().w_full().gap(9.)
        .child(row().w_full().items_center().child(section_title("INVESTIGATIONS")).child(el().grow(1.))
            .child(el().w(28.).h(22.).min_w(28.).fill(color("#202024")).radius(8.).clip_rounded(8.)
                .child(el().w_full().h_full().center().child(text(count.to_string()).font(TextStyle::new(12.,600.)).color(quiet_color())))))
        .child(history)
        .child(contained_row(k,Icon::History,"All investigations".into(),None,s.tab==Tab::History,false)
            .on_press(move|s:&mut State|{s.tab=Tab::History;if compact{s.sidebar=Visibility::Closed;}}));

    let scroll=col().key("sidebar-scroll").w_full().grow(1.).min_h(0.)
        .scroll(ScrollSpec{stick_bottom:false})
        .child(col().w_full().gap(22.).child(navigation).child(recent));
    let connected=s.snapshot["connected"].as_bool().unwrap_or(false);
    let status=if connected{"Connected"}else{"Offline"};
    col().w(if compact{300.}else{284.}).h_full().min_h(0.).padding(16.).gap(16.)
        .fill(color(PANEL)).border_sides([0.,1.,0.,0.],color(EDGE))
        .child(brand).child(scroll)
        .child(contained_row(k,Icon::Settings,"Settings".into(),Some(status.into()),s.tab==Tab::Provider,false)
            .on_press(move|s:&mut State|{s.tab=Tab::Provider;if compact{s.sidebar=Visibility::Closed;}}))
        .into()
}
