#![allow(unused_imports)]

use arrow_array::{Int64Array, RecordBatch};
use arrow_arith::numeric::add;
use arrow_cast::cast;
use arrow_csv::ReaderBuilder;
use arrow_json::ReaderBuilder as JsonReaderBuilder;
use arrow_ord::sort::sort;
use arrow_schema::{DataType, Field, Schema};
use arrow_select::take::take;
use csv_core::Reader;
use hashbrown::HashMap;
use indexmap::IndexMap;
use itertools::Itertools;
use lexical_core::parse;
use ndarray::Array2;
use ordered_float::OrderedFloat;
use parquet::arrow::arrow_reader::ParquetRecordBatchReaderBuilder;
use regex::Regex;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Serialize, Deserialize)]
pub struct Probe {
    pub id: i64,
    pub label: String,
}

pub fn compile_surface() {
    let _: Option<i64> = parse::<i64>(b"42").ok();
    let _ = Regex::new("^x+$");
    let _: HashMap<i32, i32> = HashMap::new();
    let _: IndexMap<i32, i32> = IndexMap::new();
    let _ = [1, 2, 3].into_iter().join(",");
    let _ = OrderedFloat(1.0_f64);
    let _ = Decimal::new(1234, 2);
    let _ = Array2::<f64>::zeros((2, 2));
    let _ = Schema::new(vec![Field::new("id", DataType::Int64, false)]);
    let _ = Int64Array::from(vec![1_i64, 2, 3]);
}
