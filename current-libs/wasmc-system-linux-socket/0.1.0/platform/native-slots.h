#ifndef WASMC_NATIVE_SLOTS_H
#define WASMC_NATIVE_SLOTS_H
/* Fallible table growth; only size_t allocation and the existing u32 token
 * index representation bound capacity. Growth publishes no state on failure. */
static int32_t grow_slot_table(void *old, size_t *capacity, size_t stride, void **result) {
  const size_t maximum = SIZE_MAX / stride < UINT32_MAX ? SIZE_MAX / stride : UINT32_MAX;
  if (*capacity >= maximum) return -EOVERFLOW;
  const size_t next = *capacity == 0 ? (maximum < 8 ? maximum : 8) :
      (*capacity > maximum / 2 ? maximum : *capacity * 2);
  void *grown = realloc(old, next * stride);
  if (!grown) return -ENOMEM;
  memset((uint8_t *)grown + *capacity * stride, 0, (next - *capacity) * stride);
  *capacity = next;
  *result = grown;
  return 0;
}
#endif
