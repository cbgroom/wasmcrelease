use crate::data_arrow::{self, BatchSnapshot};
use arrow_array::UInt32Array;
use arrow_select::take::{take as arrow_take, TakeOptions};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Error {
    Model(data_arrow::Error),
    IndexOutOfBounds,
}

impl From<data_arrow::Error> for Error {
    fn from(value: data_arrow::Error) -> Self {
        Self::Model(value)
    }
}

pub fn validate(value: BatchSnapshot) -> Result<u32, Error> {
    let batch = data_arrow::validate_snapshot(&value)?;
    u32::try_from(batch.num_rows()).map_err(|_| Error::Model(data_arrow::Error::InvalidLayout))
}

pub fn take(value: BatchSnapshot, indices: Vec<u32>) -> Result<BatchSnapshot, Error> {
    let batch = data_arrow::validate_snapshot(&value)?;
    if indices.iter().any(|index| *index >= value.rows) {
        return Err(Error::IndexOutOfBounds);
    }
    let output_rows = indices.len();
    let indices = UInt32Array::from(indices);
    let columns = batch
        .columns()
        .iter()
        .map(|array| {
            arrow_take(
                array.as_ref(),
                &indices,
                Some(TakeOptions { check_bounds: true }),
            )
        })
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| Error::Model(data_arrow::Error::InvalidLayout))?;
    // A zero-column batch still has a meaningful row count. Arrow cannot infer
    // that count from an empty array vector, so carry it explicitly after take.
    let options = arrow_array::RecordBatchOptions::new().with_row_count(Some(output_rows));
    let output = arrow_array::RecordBatch::try_new_with_options(batch.schema(), columns, &options)
        .map_err(|_| Error::Model(data_arrow::Error::InvalidLayout))?;
    data_arrow::snapshot_from_batch_with_fields(&output, &value.fields).map_err(Into::into)
}
