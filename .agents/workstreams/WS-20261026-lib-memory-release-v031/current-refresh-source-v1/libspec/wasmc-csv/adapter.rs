use crate::delta;
use crate::exports::wasmc::csv::parser::{
    CsvError, CsvOptions as WitOptions, Guest,
};
use crate::wasmc::data_core::types::{
    BatchSnapshot as WitBatchSnapshot, Column as WitColumn, DataType as WitDataType,
    Field as WitField,
};

crate::define_data_arrow_wit_bridge!(WitDataType, WitField, WitColumn, WitBatchSnapshot);
pub struct Adapter;

fn error(value: delta::Error) -> CsvError {
    match value {
        delta::Error::InvalidOptions => CsvError::InvalidOptions,
        delta::Error::InvalidData => CsvError::InvalidData,
        delta::Error::UnsupportedType => CsvError::UnsupportedType,
    }
}

impl Guest for Adapter {
    fn parse(
        input: Vec<u8>,
        fields: Vec<WitField>,
        options: WitOptions,
    ) -> Result<Vec<WitBatchSnapshot>, CsvError> {
        let fields = fields.into_iter().map(field_from_wit).collect();
        let options = delta::Options {
            has_header: options.has_header,
            validate_header: options.validate_header,
            delimiter: options.delimiter,
            batch_rows: options.batch_rows,
        };
        delta::parse(input, fields, options)
            .map(|values| values.into_iter().map(batch_to_wit).collect())
            .map_err(error)
    }
}
