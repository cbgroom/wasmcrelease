pub fn route(method:u32,path:u32,body_class:u32,request_count:u32)->(u32,u32,u32){
    if request_count>=100{return (429,0,0)}
    match (method,path,body_class){
        (0,0,_) => (200,0,0), (0,1,_) => (204,1,2), (0,3,_) => (403,0,0),
        (0,4,_) => (301,2,1), (0,5,_) => (418,0,0), (1,2,1) => (201,1,3), _ => (404,0,0),
    }
}
