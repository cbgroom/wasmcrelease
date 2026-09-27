#include <errno.h>
#include <fcntl.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

static uint32_t read_u32(const uint8_t *bytes) {
  return (uint32_t)bytes[0] | ((uint32_t)bytes[1] << 8) |
         ((uint32_t)bytes[2] << 16) | ((uint32_t)bytes[3] << 24);
}

static void write_u64(uint8_t *bytes, uint64_t value) {
  for (size_t index = 0; index < 8; index += 1) bytes[index] = (uint8_t)(value >> (index * 8));
}

__attribute__((visibility("default")))
int32_t wasmc_boundary_v1_invoke(
    const uint8_t *input,
    size_t input_len,
    uint8_t *output,
    size_t output_capacity,
    size_t *output_len) {
  if (!input || !output || !output_len || input_len < 9) return -EINVAL;
  const uint8_t operation = input[0];
  const uint32_t path_len = read_u32(input + 1);
  const uint32_t value_len = read_u32(input + 5);
  if (path_len == 0 || (size_t)path_len > input_len - 9) return -EINVAL;
  const size_t payload_offset = 9 + (size_t)path_len;
  char *path = malloc((size_t)path_len + 1);
  if (!path) return -ENOMEM;
  memcpy(path, input + 9, path_len);
  path[path_len] = '\0';

  int32_t status = 0;
  if (operation == 1) {
    if (payload_offset != input_len || value_len > output_capacity) status = -EINVAL;
    else {
      int descriptor = open(path, O_RDONLY | O_CLOEXEC);
      if (descriptor < 0) status = -errno;
      else {
        ssize_t count = read(descriptor, output, value_len);
        if (count < 0) status = -errno;
        else *output_len = (size_t)count;
        if (close(descriptor) != 0 && status == 0) status = -errno;
      }
    }
  } else if (operation == 2) {
    if ((size_t)value_len != input_len - payload_offset || output_capacity < 8) status = -EINVAL;
    else {
      int descriptor = open(path, O_WRONLY | O_CLOEXEC);
      if (descriptor < 0) status = -errno;
      else {
        size_t written = 0;
        while (written < value_len) {
          ssize_t count = write(descriptor, input + payload_offset + written, value_len - written);
          if (count < 0) { status = -errno; break; }
          if (count == 0) { status = -EIO; break; }
          written += (size_t)count;
        }
        if (close(descriptor) != 0 && status == 0) status = -errno;
        if (status == 0) { write_u64(output, written); *output_len = 8; }
      }
    }
  } else status = -ENOTSUP;

  free(path);
  return status;
}
