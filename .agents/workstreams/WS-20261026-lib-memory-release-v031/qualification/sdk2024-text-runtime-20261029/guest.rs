use sdk::wasmc::text::text as t;
#[unsafe(no_mangle)]
pub extern "C" fn run(size: u32) -> u32 {
 let s="  HéLLo 世界\nRust  "; let needle="世界";
 assert_eq!(t::contains(s,needle),s.contains(needle));
 assert_eq!(t::starts_with(s,"  H"),s.starts_with("  H"));
 assert_eq!(t::ends_with(s,"  "),s.ends_with("  "));
 assert_eq!(t::is_empty(s),s.is_empty());
 assert_eq!(t::is_empty(""),true);
 assert_eq!(t::is_ascii(s),s.is_ascii());
 assert_eq!(t::eq_ignore_ascii_case("AbC","aBc"),"AbC".eq_ignore_ascii_case("aBc"));
 assert_eq!(t::find(s,needle),s.find(needle).map(|x|x as u32));
 assert_eq!(t::rfind(s," "),s.rfind(" ").map(|x|x as u32));
 assert_eq!(t::find(s,"missing"),None);
 assert_eq!(t::trim(s),s.trim());
 assert_eq!(t::trim_start(s),s.trim_start());
 assert_eq!(t::trim_end(s),s.trim_end());
 assert_eq!(t::to_lowercase(s),s.to_lowercase());
 assert_eq!(t::to_uppercase(s),s.to_uppercase());
 assert_eq!(t::to_ascii_lowercase(s),s.to_ascii_lowercase());
 assert_eq!(t::to_ascii_uppercase(s),s.to_ascii_uppercase());
 assert_eq!(t::split(s," "),s.split(' ').map(str::to_owned).collect::<Vec<_>>());
 assert_eq!(t::splitn(s,3," "),s.splitn(3,' ').map(str::to_owned).collect::<Vec<_>>());
 assert_eq!(t::split_whitespace(s),s.split_whitespace().map(str::to_owned).collect::<Vec<_>>());
 assert_eq!(t::split_ascii_whitespace(s),s.split_ascii_whitespace().map(str::to_owned).collect::<Vec<_>>());
 assert_eq!(t::lines(s),s.lines().map(str::to_owned).collect::<Vec<_>>());
 assert_eq!(t::replace(s," ","-"),s.replace(' ',"-"));
 assert_eq!(t::replacen(s," ","-",2),s.replacen(' ',"-",2));
 let parts=vec!["a".to_owned(),"世界".to_owned(),"".to_owned()];
 assert_eq!(t::join(&parts,"/"),parts.join("/"));
 assert_eq!(t::strip_prefix_or(s,"  ","fallback"),s.strip_prefix("  ").unwrap_or("fallback"));
 assert_eq!(t::strip_suffix_or(s,"!","fallback"),s.strip_suffix("!").unwrap_or("fallback"));
 assert_eq!(t::get_or(s,2,4,"fallback"),s.get(2..4).unwrap_or("fallback"));
 assert_eq!(t::get_or(s,4,5,"fallback"),s.get(4..5).unwrap_or("fallback"));
 assert_eq!(t::is_char_boundary(s,4),s.is_char_boundary(4));
 assert_eq!(t::into_bytes(s),s.as_bytes());
 assert_eq!(t::from_utf8_or(&[0xff],"fallback"),"fallback");
 assert_eq!(t::from_utf8_lossy(&[0xff,b'a']),String::from_utf8_lossy(&[0xff,b'a']));
 let large="x".repeat(size as usize); assert_eq!(t::to_uppercase(&large),large.to_uppercase());
 let parts=vec!["x".to_owned();70_000]; assert_eq!(t::join(&parts,","),parts.join(","));
 assert_eq!(t::to_uppercase("再见abc"),"再见ABC");
 1
}
