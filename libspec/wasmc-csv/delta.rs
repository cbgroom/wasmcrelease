use crate::data_arrow::{self, BatchSnapshot, DataType, Field};
use arrow_csv::ReaderBuilder;
use arrow_schema::{Field as ArrowField, Schema};
use std::collections::BTreeSet;
use std::io::Cursor;
use std::sync::Arc;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Options {
    pub has_header: bool,
    pub validate_header: bool,
    pub delimiter: u8,
    pub batch_rows: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Error {
    InvalidOptions,
    InvalidData,
    UnsupportedType,
}

fn schema(fields: &[Field]) -> Result<Arc<Schema>, Error> {
    if fields.is_empty() {
        return Err(Error::InvalidOptions);
    }
    let mut names = BTreeSet::new();
    let fields = fields
        .iter()
        .map(|field| {
            if field.name.is_empty() || !names.insert(field.name.clone()) {
                return Err(Error::InvalidOptions);
            }
            if field.data_type == DataType::Binary {
                return Err(Error::UnsupportedType);
            }
            Ok(ArrowField::new(
                field.name.clone(),
                data_arrow::arrow_type(field.data_type),
                field.nullable,
            ))
        })
        .collect::<Result<Vec<_>, _>>()?;
    Ok(Arc::new(Schema::new(fields)))
}

pub fn parse(
    input: Vec<u8>,
    fields: Vec<Field>,
    options: Options,
) -> Result<Vec<BatchSnapshot>, Error> {
    if options.batch_rows == 0
        || options.delimiter == 0
        || matches!(options.delimiter, b'\r' | b'\n')
    {
        return Err(Error::InvalidOptions);
    }
    let reader = ReaderBuilder::new(schema(&fields)?)
        .with_header(options.has_header)
        .with_header_validation(options.validate_header)
        .with_delimiter(options.delimiter)
        .with_batch_size(options.batch_rows as usize)
        .build(Cursor::new(input))
        .map_err(|_| Error::InvalidData)?;
    reader
        .map(|batch| {
            let batch = batch.map_err(|_| Error::InvalidData)?;
            data_arrow::snapshot_from_batch_with_fields(&batch, &fields)
                .map_err(|error| match error {
                    data_arrow::Error::UnsupportedType => Error::UnsupportedType,
                    _ => Error::InvalidData,
                })
        })
        .collect()
}
