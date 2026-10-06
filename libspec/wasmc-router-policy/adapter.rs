use crate::delta;
use crate::exports::wasmc::router_policy::policy::{Guest, Decision};
pub struct Adapter;
impl Guest for Adapter {
    fn route(method:u32,path:u32,body_class:u32,request_count:u32)->Decision{
        let (status,upstream,flags)=delta::route(method,path,body_class,request_count);
        Decision{status,upstream,flags}
    }
}
