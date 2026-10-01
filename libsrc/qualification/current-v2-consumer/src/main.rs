use std::{error::Error, path::Path};
use wasmc_data_core_component::{
    Lib as DataLib,
    exports::wasmc::data_core::types::{BatchSnapshot, Column, DataType, Field},
};
use wasmc_host_clock_component::{Lib as ClockLib, wasmc::host_clock::clock_host};
use wasmc_http1_component::{Lib as HttpLib, wasmtime};
use wasmc_owned_algorithms_component::{
    Lib as OwnedLib, exports::wasmc::owned_algorithms::algorithms::Request,
};
use wasmc_resource_counter_component::Lib as CounterLib;
use wasmtime::{
    Engine, Store,
    component::{Component, Linker},
};

struct Clock {
    next: i32,
    calls: u32,
}
impl clock_host::Host for Clock {
    fn now(&mut self) -> i32 {
        self.calls += 1;
        let value = self.next;
        self.next += 1;
        value
    }
}

fn main() -> Result<(), Box<dyn Error>> {
    let root = std::env::args()
        .nth(1)
        .ok_or("exact staged package directory required")?;
    let engine = Engine::default();
    let component = |id: &str, version: &str| -> Result<Component, Box<dyn Error>> {
        Ok(Component::from_file(
            &engine,
            Path::new(&root)
                .join(id)
                .join(version)
                .join("component.wasm"),
        )?)
    };
    let http = component("wasmc-http1", "0.0.1")?;
    let mut hs = Store::new(&engine, ());
    let h = HttpLib::instantiate(&mut hs, &http, &Linker::new(&engine))?;
    let api = h.wasmc_http1_server_wire();
    let request = b"GET /health HTTP/1.1\r\nHost: example.test\r\n\r\n";
    for _ in 0..128 {
        let parsed = api
            .call_parse_request(&mut hs, request)?
            .map_err(|_| "HTTP parse error")?;
        assert_eq!(parsed.method, "GET");
        assert_eq!(parsed.target, "/health");
        assert_eq!(parsed.headers.len(), 1);
        assert_eq!(
            api.call_request_frame_length(&mut hs, request)?
                .map_err(|_| "HTTP frame error")?,
            Some(request.len() as u32)
        );
        assert_eq!(
            api.call_serialize_response_head(&mut hs, 1, 200, &[])?
                .map_err(|_| "HTTP serialize error")?,
            b"HTTP/1.1 200 OK\r\n\r\n"
        );
        assert!(
            api.call_serialize_response_head(&mut hs, 1, 99, &[])?
                .is_err()
        );
        assert!(api.call_parse_request(&mut hs, b"BAD\r\n\r\n")?.is_err());
        assert_eq!(
            api.call_request_frame_length(&mut hs, b"GET /")?
                .map_err(|_| "partial frame error")?,
            None
        );
    }
    let owned = component("wasmc-owned-algorithms", "0.1.0")?;
    let mut os = Store::new(&engine, ());
    let o = OwnedLib::instantiate(&mut os, &owned, &Linker::new(&engine))?;
    let api = o.wasmc_owned_algorithms_algorithms();
    for _ in 0..128 {
        assert_eq!(api.call_count_true(&mut os, &[true, false, true])?, 2);
        assert_eq!(api.call_count_true(&mut os, &[])?, 0);
        assert_eq!(
            api.call_sum_s32(&mut os, &[i32::MAX, i32::MAX, -1])?,
            4_294_967_293
        );
        assert_eq!(api.call_sum_s32(&mut os, &[])?, 0);
        assert_eq!(api.call_utf8_score(&mut os, "A中")?, 2004);
        assert_eq!(api.call_utf8_score(&mut os, "")?, 0);
        assert_eq!(
            api.call_request_score(
                &mut os,
                &Request {
                    label: "abc".into(),
                    values: vec![4, 5],
                    enabled: true
                }
            )?,
            3109
        );
        assert_eq!(
            api.call_request_score(
                &mut os,
                &Request {
                    label: "".into(),
                    values: vec![],
                    enabled: false
                }
            )?,
            0
        );
    }
    let clock = component("wasmc-host-clock", "0.0.1")?;
    assert!(
        ClockLib::instantiate(
            &mut Store::new(&engine, Clock { next: 40, calls: 0 }),
            &clock,
            &Linker::new(&engine)
        )
        .is_err()
    );
    let mut linker = Linker::new(&engine);
    ClockLib::add_to_linker::<Clock, wasmtime::component::HasSelf<Clock>>(&mut linker, |state| {
        state
    })?;
    let mut cs = Store::new(&engine, Clock { next: 40, calls: 0 });
    let c = ClockLib::instantiate(&mut cs, &clock, &linker)?;
    let api = c.wasmc_host_clock_clock_api();
    for index in 0..128 {
        assert_eq!(api.call_sampled(&mut cs, 2)?, 42 + index * 2);
        assert_eq!(api.call_sampled(&mut cs, -1)?, 40 + index * 2);
    }
    assert_eq!(cs.data().calls, 256);
    let counter = component("wasmc-resource-counter", "0.0.1")?;
    let mut rs = Store::new(&engine, ());
    let r = CounterLib::instantiate(&mut rs, &counter, &Linker::new(&engine))?;
    let api = r.wasmc_resource_counter_counters().counter();
    for _ in 0..128 {
        let resource = api.call_constructor(&mut rs, 10)?;
        assert_eq!(api.call_add(&mut rs, resource.clone(), -3)?, 7);
        assert_eq!(api.call_value(&mut rs, resource.clone())?, 7);
        resource.resource_drop(&mut rs)?;
    }
    let resource = api.call_constructor(&mut rs, 0)?;
    let stale = resource.clone();
    resource.resource_drop(&mut rs)?;
    assert!(api.call_value(&mut rs, stale).is_err());
    let data_path = std::env::args()
        .nth(2)
        .ok_or("exact Data Core package directory required")?;
    let data = Component::from_file(&engine, Path::new(&data_path).join("component.wasm"))?;
    let mut ds = Store::new(&engine, ());
    let d = DataLib::instantiate(&mut ds, &data, &Linker::new(&engine))?;
    let api = d.wasmc_data_core_model();
    let batch = BatchSnapshot {
        rows: 2,
        fields: [
            DataType::Boolean,
            DataType::Int64,
            DataType::Uint64,
            DataType::Float64,
            DataType::Utf8,
            DataType::Binary,
        ]
        .into_iter()
        .enumerate()
        .map(|(i, data_type)| Field {
            name: format!("c{i}"),
            data_type,
            nullable: true,
        })
        .collect(),
        columns: vec![
            Column::BooleanColumn(vec![Some(true), None]),
            Column::Int64Column(vec![Some(i64::MIN), None]),
            Column::Uint64Column(vec![Some(u64::MAX), None]),
            Column::Float64Column(vec![Some(1.25), None]),
            Column::Utf8Column(vec![Some("A中".into()), None]),
            Column::BinaryColumn(vec![Some(vec![0, 255]), None]),
        ],
    };
    for _ in 0..128 {
        assert_eq!(
            api.call_validate(&mut ds, &batch)?
                .map_err(|_| "Data Core validate error")?,
            2
        );
        let taken = api
            .call_take(&mut ds, &batch, &[1, 0])?
            .map_err(|_| "Data Core take error")?;
        assert_eq!(taken.rows, 2);
        assert_eq!(taken.fields.len(), 6);
        assert!(matches!(&taken.columns[0],Column::BooleanColumn(v) if v==&[None,Some(true)]));
        assert!(matches!(&taken.columns[1],Column::Int64Column(v) if v==&[None,Some(i64::MIN)]));
        assert!(matches!(&taken.columns[2],Column::Uint64Column(v) if v==&[None,Some(u64::MAX)]));
        assert!(matches!(&taken.columns[3],Column::Float64Column(v) if v==&[None,Some(1.25)]));
        assert!(matches!(&taken.columns[4],Column::Utf8Column(v) if v==&[None,Some("A中".into())]));
        assert!(
            matches!(&taken.columns[5],Column::BinaryColumn(v) if v==&[None,Some(vec![0,255])])
        );
        assert!(api.call_take(&mut ds, &batch, &[2])?.is_err());
        let empty = BatchSnapshot {
            rows: 0,
            fields: vec![],
            columns: vec![],
        };
        assert_eq!(
            api.call_validate(&mut ds, &empty)?
                .map_err(|_| "empty validate error")?,
            0
        );
        let empty_taken = api
            .call_take(&mut ds, &empty, &[])?
            .map_err(|_| "empty take error")?;
        assert_eq!(empty_taken.rows, 0);
        assert!(empty_taken.fields.is_empty() && empty_taken.columns.is_empty());
        assert!(api.call_take(&mut ds, &empty, &[0])?.is_err());
        let zero_columns = BatchSnapshot {
            rows: 3,
            fields: vec![],
            columns: vec![],
        };
        let selected = api
            .call_take(&mut ds, &zero_columns, &[2, 0, 2, 1])?
            .map_err(|_| "zero-column take error")?;
        assert_eq!(selected.rows, 4);
        assert!(selected.fields.is_empty() && selected.columns.is_empty());
    }
    println!(
        "{{\"accepted\":true,\"engine\":\"wasmtime-49.0.0\",\"packages\":5,\"rounds_per_package\":128,\"http1_calls\":768,\"owned_calls\":1024,\"clock_calls\":256,\"counter_lifecycles\":129,\"data_core_calls\":896,\"data_core_types\":6,\"missing_host_rejected\":true,\"stale_resource_rejected\":true,\"consumer\":\"generated-root-sdk-only\",\"ordinary_wasmc_app_qualified\":false}}"
    );
    Ok(())
}
