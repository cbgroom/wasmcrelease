#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum Capability { Camera,Microphone,LocationWhenInUse,Motion,Notifications,PhotosReadWrite,Contacts,Calendar,Reminders,SpeechRecognition }
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum State { NotRequired,Unavailable,NotDetermined,Denied,Restricted,Authorized,Limited,Provisional,Ephemeral,Unknown }
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum Plan { NoRequest,Request,WaitForInFlightRequest,OpenSettings,FailClosed }

use std::cell::RefCell;
#[derive(Clone, Copy, Debug)]
pub struct Decision { pub capability:Capability,pub state:State,pub attempt_count:u32,pub request_in_flight:bool,pub plan:Plan }
#[derive(Clone, Copy)]
struct Entry { state:State, attempts:u32, pending:Option<u32> }
thread_local! { static ENTRIES:RefCell<[Entry;10]>=const { RefCell::new([Entry{state:State::Unknown,attempts:0,pending:None};10]) }; }
pub fn plan(state:State,in_flight:bool)->Plan {
    match state {
        State::NotRequired|State::Authorized|State::Limited|State::Provisional|State::Ephemeral=>Plan::NoRequest,
        State::NotDetermined=>if in_flight {Plan::WaitForInFlightRequest} else {Plan::Request},
        State::Denied=>Plan::OpenSettings,
        State::Restricted|State::Unavailable|State::Unknown=>Plan::FailClosed,
    }
}
fn decision(capability:Capability,e:&Entry)->Decision {
    Decision{capability,state:e.state,attempt_count:e.attempts,request_in_flight:e.pending.is_some(),plan:plan(e.state,e.pending.is_some())}
}
pub fn observe(capability:Capability,state:State)->Result<(),i32>{
    ENTRIES.with(|v|{let mut v=v.borrow_mut();let e=&mut v[capability as usize];
        if e.pending.is_some(){return Err(-16)} e.state=state;Ok(())})
}
pub fn plan_request(caps:Vec<Capability>)->Vec<Decision>{
    ENTRIES.with(|v|{let v=v.borrow();caps.into_iter().map(|c|decision(c,&v[c as usize])).collect()})
}
pub fn begin_request(capability:Capability)->Result<u32,i32>{
    ENTRIES.with(|v|{let mut v=v.borrow_mut();let e=&mut v[capability as usize];
        if e.pending.is_some(){return Err(-16)}
        if plan(e.state,false)!=Plan::Request{return Err(-13)}
        let id=e.attempts.checked_add(1).ok_or(-75)?;e.attempts=id;e.pending=Some(id);Ok(id)})
}
pub fn complete_request(capability:Capability,id:u32,observed:State)->Result<(),i32>{
    ENTRIES.with(|v|{let mut v=v.borrow_mut();let e=&mut v[capability as usize];
        if e.pending!=Some(id){return Err(-22)} e.pending=None;e.state=observed;Ok(())})
}
pub fn snapshot()->Vec<Decision>{plan_request(vec![Capability::Camera,Capability::Microphone,Capability::LocationWhenInUse,Capability::Motion,Capability::Notifications,Capability::PhotosReadWrite,Capability::Contacts,Capability::Calendar,Capability::Reminders,Capability::SpeechRecognition])}
