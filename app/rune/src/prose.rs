//! Presentation only: original reports, quotations and source identities remain retained.
use super::*;
use rune_kit::{Markdown, MarkdownStyle};

fn domain(url:&str)->&str{url.split("://").nth(1).unwrap_or(url).split('/').next().unwrap_or(url).trim_start_matches("www.")}
fn source_label(url:&str)->&str{
    let host=domain(url);
    if host.ends_with("nasa.gov"){"NASA"}else if host.ends_with("nsidc.org"){"NSIDC"}else if host.ends_with("noaa.gov"){"NOAA"}else if host.ends_with("nature.com"){"Nature"}else{host}
}
pub fn references<'a>(value:&str,current:&'a Value)->Vec<(usize,&'a Value)>{
    list(&current["literature"]).iter().enumerate().filter(|(_,source)|{
        let id=string(&source["id"]);let url=string(&source["url"]);
        (!id.is_empty()&&value.contains(&id))||(!url.is_empty()&&value.contains(&url))
    }).map(|(index,source)|(index+1,source)).collect()
}
fn display(value:&str,current:&Value)->String{
    let records:std::collections::HashMap<_,_>=list(&current["literature"]).iter().enumerate()
        .filter_map(|(index,source)|Some((source["id"].as_str()?,(index+1,source["url"].as_str()?)))).collect();
    let mut out=String::with_capacity(value.len());let mut offset=0;let mut code=0;
    while offset<value.len(){
        let rest=&value[offset..];let ch=rest.chars().next().unwrap();
        if ch=='`'{let n=rest.bytes().take_while(|byte|*byte==b'`').count();if code==0{code=n;}else if code==n{code=0;}out.push_str(&rest[..n]);offset+=n;continue;}
        if code==0&&rest.len()>=36&&rest.is_char_boundary(36){
            if let Some((index,url))=records.get(&rest[..36]){
                if url.starts_with("https://")||url.starts_with("http://"){out.push_str(&format!("[{index}]({url})"));offset+=36;continue;}
            }
        }
        if code==0&&(rest.starts_with("https://")||rest.starts_with("http://"))&&!value[..offset].ends_with("](")&&!value[..offset].ends_with('<'){
            let end=rest.find(char::is_whitespace).unwrap_or(rest.len());let token=&rest[..end];
            let mut url=token.trim_end_matches(['.',',',';']);
            while url.ends_with(')')&&url.matches(')').count()>url.matches('(').count(){url=&url[..url.len()-1];}
            if url.ends_with(']')&&!url.contains('['){url=&url[..url.len()-1];}
            if !url.is_empty(){out.push_str(&format!("[{}]({url}){}",source_label(url),&token[url.len()..]));offset+=end;continue;}
        }
        out.push(ch);offset+=ch.len_utf8();
    }
    out.lines().map(|line|match line.trim(){
        "Executive conclusion"|"Evidence and findings"|"Why ice is being lost"|"Findings by ice quantity"|"Rates are not accumulated rainfall"|"Method and interpretation"|"Sensitivity and QA"|"Specialist review and source dependence"|"Spatial support and alternative interpretations"|"Provenance and sources"|"Remaining limitations"=>format!("## {line}"),
        _=>line.to_owned(),
    }).collect::<Vec<_>>().join("\n")
}
pub fn view(value:&str,current:&Value,streaming:bool)->El{
    let style=MarkdownStyle::neutral(true).text(workspace::color("#d9dde2")).muted(workspace::muted())
        .body_font(TextStyle{line_height:25.,..workspace::font(15.,400.)})
        .heading_font(1,workspace::font(23.,600.)).heading_font(2,workspace::font(19.,600.))
        .heading_font(3,workspace::font(16.,600.)).heading_font(4,workspace::font(15.,600.))
        .strong_weight(600.).link(workspace::color("#adbdd0")).link_underline(workspace::color("#526173"))
        .list(20.,8.).quote(workspace::color("#46515f"),1.,14.,workspace::muted());
    Markdown::new(display(value,current)).streaming(streaming).selectable(true).scroll_wide(true)
        .on_link(|_:&mut State,url|{if url.starts_with("https://")||url.starts_with("http://"){let _=rune::web::open_url(url);}})
        .render(&style).w_full().min_w(0.)
}
fn numeric_claim(block:&str,artifact:&Value)->bool{
    if artifact["analysis"]["slope_per_decade"].as_f64().is_none(){return false;}
    let acquisition=&artifact["acquisition"];let variable=&acquisition["variable"];
    let name=string(&variable["name"]).to_lowercase();let id=string(&variable["id"]).to_lowercase();
    let text=block.to_lowercase();
    let subject=match id.as_str(){
        "evi"|"ndvi"=>text.contains(&id)||text.contains("greenness")||text.contains("vegetation index"),
        "t2m"=>text.contains("t2m")||text.contains("temperature")||text.contains("warming"),
        "prectotcorr"=>text.contains("precipitation")||text.contains("rainfall")||text.contains("prectotcorr"),
        "rh2m"=>text.contains("humidity")||text.contains("rh2m"),
        _=>text.contains(&id)||(!name.is_empty()&&text.contains(&name.to_lowercase())),
    };
    if !subject{return false;}
    let analysis=&artifact["analysis"];
    let mut values=vec![analysis["slope_per_year"].as_f64(),analysis["slope_per_decade"].as_f64(),analysis["p_value"].as_f64()].into_iter().flatten().collect::<Vec<_>>();
    if let Some(interval)=analysis["interval"].as_array(){values.extend(interval.iter().filter_map(Value::as_f64));}
    values.into_iter().any(|value|{
        if !value.is_finite(){return false;}
        let candidates=[format!("{value:.6}"),format!("{value:.4}"),format!("{value:.3}"),format!("{value:.2}"),format!("{value:.1}")];
        candidates.iter().any(|number|number.len()>2&&block.contains(number))
    })
}
fn slope_plot(artifact:&Value)->Option<El>{
    let analysis=&artifact["analysis"];let estimate=analysis["slope_per_decade"].as_f64()?;
    if !estimate.is_finite(){return None;}
    let interval=analysis["interval"].as_array().filter(|values|values.len()==2&&values.iter().all(|v|v.as_f64().is_some_and(f64::is_finite)));
    let (low,high)=if let Some(values)=interval{(values[0].as_f64()?*10.,values[1].as_f64()?*10.)}else{(estimate,estimate)};
    let span=(high-low).abs().max(estimate.abs()).max(1e-9);let min=low.min(0.)-span*0.12;let max=high.max(0.)+span*0.12;
    let x=|v:f64|16.+(v-min)/(max-min)*248.;let zero=x(0.);let left=x(low);let right=x(high);let point=x(estimate);
    let stroke=workspace::color("#9eabb8");let accent=workspace::color("#d6e4d6");
    let shape=rune::Shape::new().stroke(vec![[zero as f32,3.],[zero as f32,27.]],1.,workspace::color("#65716b"))
        .stroke(vec![[left as f32,15.],[right as f32,15.]],2.6,stroke)
        .stroke(vec![[left as f32,10.],[left as f32,20.]],1.6,stroke)
        .stroke(vec![[right as f32,10.],[right as f32,20.]],1.6,stroke)
        .stroke(vec![[point as f32-3.,15.],[point as f32,12.],[point as f32+3.,15.],[point as f32,18.],[point as f32-3.,15.]],1.8,accent);
    Some(col().w_full().gap(5.).padding(9.).fill(workspace::color("#171b1d")).radius(5.)
        .child(rune::canvas(shape).w_full().h(30.).min_h(30.))
        .child(text(format!("{} · {} · slope / decade {}{}",string(&analysis["requested_start"]),string(&analysis["requested_end"]),if interval.is_some(){"95% interval"}else{"descriptive estimate"},if interval.is_some(){" · zero reference"}else{" · no inferential interval"}))
            .font(workspace::font(11.,400.)).color(workspace::muted()).w_full().wrap())
        .into())
}
pub fn report(value:&str,current:&Value,key:&str)->El{
    let mut body=col().key(format!("report-prose-{key}")).w_full().gap(5.);
    for (index,block) in value.split("\n\n").enumerate(){
        if block.trim().is_empty(){continue;}
        let block=block.trim();
        body=body.child(Markdown::new(display(block,current)).streaming(false).selectable(true).scroll_wide(true)
            .on_link(|_:&mut State,url|{if url.starts_with("https://")||url.starts_with("http://"){let _=rune::web::open_url(url);}})
            .render(&MarkdownStyle::neutral(true).text(workspace::color("#d9dde2")).muted(workspace::muted())
                .body_font(TextStyle{line_height:25.,..workspace::font(15.,400.)}).heading_font(1,workspace::font(23.,600.))
                .heading_font(2,workspace::font(19.,600.)).heading_font(3,workspace::font(16.,600.)).strong_weight(600.)
                .link(workspace::color("#adbdd0")).link_underline(workspace::color("#526173")).list(20.,8.))
            .key(format!("report-block-{key}-{index}")).w_full().min_w(0.));
        if block.chars().any(|ch|ch.is_ascii_digit()){
            for artifact in list(&current["artifacts"]){
                if numeric_claim(block,artifact){
                    if let Some(plot)=slope_plot(artifact){body=body.child(plot);break;}
                }
            }
        }
    }
    body
}
pub fn sources(s:&State,k:&Kit,value:&str,current:&Value,key:String)->El{
    let sources=references(value,current);if sources.is_empty(){return col().into();}
    let expanded=s.expanded_activity.contains(&key);let count=sources.len();
    let mut body=col().w_full().gap(8.).child(workspace::disclosure(k,&format!("Sources · {count}"),expanded,key));
    if expanded{
        for (index,source) in sources{
            let url=string(&source["url"]);let host=source_label(&url).to_owned();let title=string(&source["title"]);let record=string(&source["id"]);
            body=body.child(col().w_full().gap(5.).padding(10.).border_sides([0.,0.,1.,0.],workspace::color("#272d33"))
                .child(Button::new(format!("{index}. {title}")).variant(rune_kit::ButtonVariant::Ghost)
                    .label_with(move|_,_|row().w_full().min_w(0.).gap(10.).items_start()
                        .child(text(index.to_string()).font(workspace::font(12.,500.)).color(workspace::muted()).min_w(18.))
                        .child(text(title.clone()).font(workspace::font(13.,500.)).color(workspace::ink()).grow(1.).min_w(0.).wrap())
                        .child(live::chevron(false)).into())
                    .build(k).w_full().min_h(32.).padding(4.).on_press(move|_:&mut State|{if url.starts_with("https://")||url.starts_with("http://"){let _=rune::web::open_url(&url);}}))
                .child(text(format!("{host} · retained source {record}")).font(workspace::font(11.,400.)).color(workspace::muted()).w_full().wrap_anywhere()));
        }
    }
    body.into()
}
