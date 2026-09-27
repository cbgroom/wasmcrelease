#include <errno.h>
#include <fcntl.h>
#include <poll.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <sys/mman.h>
#include <unistd.h>

#define MAX_HANDLES 1024
#define MAX_MAPPINGS 1024
#define MAX_MAPPING_BYTES (UINT64_C(256) * 1024 * 1024)

struct handle_slot {
  int descriptor;
  uint32_t generation;
  uint8_t active;
};

static struct handle_slot handles[MAX_HANDLES];

struct mapping_slot {
  void *address;
  size_t length;
  uint32_t generation;
  uint8_t active;
};

static struct mapping_slot mappings[MAX_MAPPINGS];

static uint16_t read_u16(const uint8_t *bytes) {
  return (uint16_t)bytes[0] | ((uint16_t)bytes[1] << 8);
}

static uint32_t read_u32(const uint8_t *bytes) {
  return (uint32_t)bytes[0] | ((uint32_t)bytes[1] << 8) |
         ((uint32_t)bytes[2] << 16) | ((uint32_t)bytes[3] << 24);
}

static uint64_t read_u64(const uint8_t *bytes) {
  uint64_t value = 0;
  for (size_t index = 0; index < 8; index += 1) value |= (uint64_t)bytes[index] << (index * 8);
  return value;
}

static void write_u16(uint8_t *bytes, uint16_t value) {
  bytes[0] = (uint8_t)value;
  bytes[1] = (uint8_t)(value >> 8);
}

static void write_u32(uint8_t *bytes, uint32_t value) {
  for (size_t index = 0; index < 4; index += 1) bytes[index] = (uint8_t)(value >> (index * 8));
}

static void write_u64(uint8_t *bytes, uint64_t value) {
  for (size_t index = 0; index < 8; index += 1) bytes[index] = (uint8_t)(value >> (index * 8));
}

static int32_t path_from_input(
    const uint8_t *input, size_t input_len, size_t path_offset,
    uint32_t path_len, char **path) {
  if (path_len == 0 || path_offset > input_len || (size_t)path_len > input_len - path_offset) return -EINVAL;
  *path = malloc((size_t)path_len + 1);
  if (!*path) return -ENOMEM;
  memcpy(*path, input + path_offset, path_len);
  (*path)[path_len] = '\0';
  return 0;
}

static int32_t register_handle(int descriptor, uint64_t *token) {
  for (uint32_t index = 0; index < MAX_HANDLES; index += 1) {
    if (!handles[index].active) {
      handles[index].generation += 1;
      if (handles[index].generation == 0) handles[index].generation = 1;
      handles[index].descriptor = descriptor;
      handles[index].active = 1;
      *token = ((uint64_t)handles[index].generation << 32) | ((uint64_t)index + 1);
      return 0;
    }
  }
  return -EMFILE;
}

static int32_t resolve_handle(uint64_t token, uint32_t *index, int *descriptor) {
  const uint32_t encoded_index = (uint32_t)token;
  const uint32_t generation = (uint32_t)(token >> 32);
  if (encoded_index == 0 || encoded_index > MAX_HANDLES || generation == 0) return -EBADF;
  const uint32_t slot = encoded_index - 1;
  if (!handles[slot].active || handles[slot].generation != generation) return -EBADF;
  if (index) *index = slot;
  *descriptor = handles[slot].descriptor;
  return 0;
}

static int32_t register_mapping(void *address, size_t length, uint64_t *token) {
  for (uint32_t index = 0; index < MAX_MAPPINGS; index += 1) {
    if (!mappings[index].active) {
      mappings[index].generation += 1;
      if (mappings[index].generation == 0) mappings[index].generation = 1;
      mappings[index].address = address;
      mappings[index].length = length;
      mappings[index].active = 1;
      *token = ((uint64_t)mappings[index].generation << 32) | ((uint64_t)index + 1);
      return 0;
    }
  }
  return -EMFILE;
}

static int32_t resolve_mapping(uint64_t token, uint32_t *index, void **address, size_t *length) {
  const uint32_t encoded_index = (uint32_t)token;
  const uint32_t generation = (uint32_t)(token >> 32);
  if (encoded_index == 0 || encoded_index > MAX_MAPPINGS || generation == 0) return -EBADF;
  const uint32_t slot = encoded_index - 1;
  if (!mappings[slot].active || mappings[slot].generation != generation) return -EBADF;
  if (index) *index = slot;
  *address = mappings[slot].address;
  *length = mappings[slot].length;
  return 0;
}

static int32_t read_all(int descriptor, uint8_t *output, size_t maximum, size_t *output_len) {
  ssize_t count = read(descriptor, output, maximum);
  if (count < 0) return -errno;
  *output_len = (size_t)count;
  return 0;
}

static int32_t write_all(int descriptor, const uint8_t *payload, size_t payload_len, uint64_t *written) {
  *written = 0;
  while (*written < payload_len) {
    ssize_t count = write(descriptor, payload + *written, payload_len - *written);
    if (count < 0) return -errno;
    if (count == 0) return -EIO;
    *written += (uint64_t)count;
  }
  return 0;
}

static int32_t invoke_path(
    uint8_t operation, const uint8_t *input, size_t input_len,
    uint8_t *output, size_t output_capacity, size_t *output_len) {
  if (input_len < 9) return -EINVAL;
  const uint32_t path_len = read_u32(input + 1);
  const uint32_t value_len = read_u32(input + 5);
  const size_t payload_offset = 9 + (size_t)path_len;
  char *path = NULL;
  int32_t status = path_from_input(input, input_len, 9, path_len, &path);
  if (status != 0) return status;
  if (operation == 1) {
    if (payload_offset != input_len || value_len > output_capacity) status = -EINVAL;
    else {
      int descriptor = open(path, O_RDONLY | O_CLOEXEC);
      if (descriptor < 0) status = -errno;
      else {
        status = read_all(descriptor, output, value_len, output_len);
        if (close(descriptor) != 0 && status == 0) status = -errno;
      }
    }
  } else {
    if ((size_t)value_len != input_len - payload_offset || output_capacity < 8) status = -EINVAL;
    else {
      int descriptor = open(path, O_WRONLY | O_CLOEXEC);
      if (descriptor < 0) status = -errno;
      else {
        uint64_t written = 0;
        status = write_all(descriptor, input + payload_offset, value_len, &written);
        if (close(descriptor) != 0 && status == 0) status = -errno;
        if (status == 0) { write_u64(output, written); *output_len = 8; }
      }
    }
  }
  free(path);
  return status;
}

static int32_t invoke_open(
    const uint8_t *input, size_t input_len,
    uint8_t *output, size_t output_capacity, size_t *output_len) {
  if (input_len < 9 || output_capacity < 8) return -EINVAL;
  const uint32_t path_len = read_u32(input + 1);
  const uint32_t flags = read_u32(input + 5);
  if (input_len != 9 + (size_t)path_len) return -EINVAL;
  if ((flags & O_CREAT) != 0) return -ENOTSUP;
#ifdef O_TMPFILE
  if ((flags & O_TMPFILE) == O_TMPFILE) return -ENOTSUP;
#endif
  char *path = NULL;
  int32_t status = path_from_input(input, input_len, 9, path_len, &path);
  if (status != 0) return status;
  int descriptor = open(path, (int)flags | O_CLOEXEC);
  free(path);
  if (descriptor < 0) return -errno;
  uint64_t token = 0;
  status = register_handle(descriptor, &token);
  if (status != 0) { close(descriptor); return status; }
  write_u64(output, token);
  *output_len = 8;
  return 0;
}

static int32_t invoke_read_handle(
    const uint8_t *input, size_t input_len,
    uint8_t *output, size_t output_capacity, size_t *output_len) {
  if (input_len != 13) return -EINVAL;
  const uint32_t maximum = read_u32(input + 9);
  if (maximum > output_capacity) return -EINVAL;
  int descriptor = -1;
  int32_t status = resolve_handle(read_u64(input + 1), NULL, &descriptor);
  if (status != 0) return status;
  return read_all(descriptor, output, maximum, output_len);
}

static int32_t invoke_write_handle(
    const uint8_t *input, size_t input_len,
    uint8_t *output, size_t output_capacity, size_t *output_len) {
  if (input_len < 13 || output_capacity < 8) return -EINVAL;
  const uint32_t payload_len = read_u32(input + 9);
  if (input_len != 13 + (size_t)payload_len) return -EINVAL;
  int descriptor = -1;
  int32_t status = resolve_handle(read_u64(input + 1), NULL, &descriptor);
  if (status != 0) return status;
  uint64_t written = 0;
  status = write_all(descriptor, input + 13, payload_len, &written);
  if (status == 0) { write_u64(output, written); *output_len = 8; }
  return status;
}

static int32_t invoke_close(const uint8_t *input, size_t input_len) {
  if (input_len != 9) return -EINVAL;
  uint32_t index = 0;
  int descriptor = -1;
  int32_t status = resolve_handle(read_u64(input + 1), &index, &descriptor);
  if (status != 0) return status;
  handles[index].active = 0;
  handles[index].descriptor = -1;
  return close(descriptor) == 0 ? 0 : -errno;
}

static int32_t invoke_ioctl(
    const uint8_t *input, size_t input_len,
    uint8_t *output, size_t output_capacity, size_t *output_len) {
  if (input_len < 25) return -EINVAL;
  const uint64_t request = read_u64(input + 9);
  const uint32_t argument_len = read_u32(input + 17);
  const uint32_t result_capacity = read_u32(input + 21);
  if (input_len != 25 + (size_t)argument_len || output_capacity < 4 + (size_t)result_capacity) return -EINVAL;
  int descriptor = -1;
  int32_t status = resolve_handle(read_u64(input + 1), NULL, &descriptor);
  if (status != 0) return status;
  const size_t buffer_len = argument_len > result_capacity ? argument_len : result_capacity;
  uint8_t *buffer = calloc(buffer_len == 0 ? 1 : buffer_len, 1);
  if (!buffer) return -ENOMEM;
  memcpy(buffer, input + 25, argument_len);
  int result = ioctl(descriptor, (unsigned long)request, buffer);
  if (result < 0) status = -errno;
  else {
    write_u32(output, (uint32_t)result);
    memcpy(output + 4, buffer, result_capacity);
    *output_len = 4 + (size_t)result_capacity;
  }
  free(buffer);
  return status;
}

static int32_t invoke_poll(
    const uint8_t *input, size_t input_len,
    uint8_t *output, size_t output_capacity, size_t *output_len) {
  if (input_len != 15 || output_capacity < 2) return -EINVAL;
  int descriptor = -1;
  int32_t status = resolve_handle(read_u64(input + 1), NULL, &descriptor);
  if (status != 0) return status;
  struct pollfd item = { .fd = descriptor, .events = (short)read_u16(input + 9), .revents = 0 };
  const int result = poll(&item, 1, (int32_t)read_u32(input + 11));
  if (result < 0) return -errno;
  write_u16(output, (uint16_t)item.revents);
  *output_len = 2;
  return 0;
}

static int32_t invoke_map(
    const uint8_t *input, size_t input_len,
    uint8_t *output, size_t output_capacity, size_t *output_len) {
  if (input_len != 33 || output_capacity < 8) return -EINVAL;
  int descriptor = -1;
  int32_t status = resolve_handle(read_u64(input + 1), NULL, &descriptor);
  if (status != 0) return status;
  const uint64_t offset = read_u64(input + 9);
  const uint64_t length = read_u64(input + 17);
  const uint32_t protection = read_u32(input + 25);
  const uint32_t flags = read_u32(input + 29);
  const size_t native_length = (size_t)length;
  if (length == 0 || length > MAX_MAPPING_BYTES || (uint64_t)native_length != length || offset > INT64_MAX) return -EINVAL;
  void *address = mmap(NULL, native_length, (int)protection, (int)flags, descriptor, (off_t)offset);
  if (address == MAP_FAILED) return -errno;
  uint64_t token = 0;
  status = register_mapping(address, native_length, &token);
  if (status != 0) { munmap(address, native_length); return status; }
  write_u64(output, token);
  *output_len = 8;
  return 0;
}

static int32_t invoke_mapping_read(
    const uint8_t *input, size_t input_len,
    uint8_t *output, size_t output_capacity, size_t *output_len) {
  if (input_len != 21) return -EINVAL;
  void *address = NULL;
  size_t mapping_len = 0;
  int32_t status = resolve_mapping(read_u64(input + 1), NULL, &address, &mapping_len);
  if (status != 0) return status;
  const uint64_t offset = read_u64(input + 9);
  const uint32_t length = read_u32(input + 17);
  if (offset > mapping_len || length > mapping_len - (size_t)offset || length > output_capacity) return -EINVAL;
  memcpy(output, (const uint8_t *)address + (size_t)offset, length);
  *output_len = length;
  return 0;
}

static int32_t invoke_mapping_write(
    const uint8_t *input, size_t input_len,
    uint8_t *output, size_t output_capacity, size_t *output_len) {
  if (input_len < 21 || output_capacity < 8) return -EINVAL;
  void *address = NULL;
  size_t mapping_len = 0;
  int32_t status = resolve_mapping(read_u64(input + 1), NULL, &address, &mapping_len);
  if (status != 0) return status;
  const uint64_t offset = read_u64(input + 9);
  const uint32_t length = read_u32(input + 17);
  if (input_len != 21 + (size_t)length || offset > mapping_len || length > mapping_len - (size_t)offset) return -EINVAL;
  memcpy((uint8_t *)address + (size_t)offset, input + 21, length);
  write_u64(output, length);
  *output_len = 8;
  return 0;
}

static int32_t invoke_mapping_sync(const uint8_t *input, size_t input_len) {
  if (input_len != 13) return -EINVAL;
  void *address = NULL;
  size_t mapping_len = 0;
  int32_t status = resolve_mapping(read_u64(input + 1), NULL, &address, &mapping_len);
  if (status != 0) return status;
  return msync(address, mapping_len, (int)read_u32(input + 9)) == 0 ? 0 : -errno;
}

static int32_t invoke_unmap(const uint8_t *input, size_t input_len) {
  if (input_len != 9) return -EINVAL;
  uint32_t index = 0;
  void *address = NULL;
  size_t mapping_len = 0;
  int32_t status = resolve_mapping(read_u64(input + 1), &index, &address, &mapping_len);
  if (status != 0) return status;
  if (munmap(address, mapping_len) != 0) return -errno;
  mappings[index].active = 0;
  mappings[index].address = NULL;
  mappings[index].length = 0;
  return 0;
}

__attribute__((visibility("default")))
int32_t wasmc_boundary_v1_invoke(
    const uint8_t *input,
    size_t input_len,
    uint8_t *output,
    size_t output_capacity,
    size_t *output_len) {
  if (!input || !output || !output_len || input_len == 0) return -EINVAL;
  *output_len = 0;
  switch (input[0]) {
    case 1:
    case 2: return invoke_path(input[0], input, input_len, output, output_capacity, output_len);
    case 3: return invoke_open(input, input_len, output, output_capacity, output_len);
    case 4: return invoke_read_handle(input, input_len, output, output_capacity, output_len);
    case 5: return invoke_write_handle(input, input_len, output, output_capacity, output_len);
    case 6: return invoke_close(input, input_len);
    case 7: return invoke_ioctl(input, input_len, output, output_capacity, output_len);
    case 8: return invoke_poll(input, input_len, output, output_capacity, output_len);
    case 9: return invoke_map(input, input_len, output, output_capacity, output_len);
    case 10: return invoke_mapping_read(input, input_len, output, output_capacity, output_len);
    case 11: return invoke_mapping_write(input, input_len, output, output_capacity, output_len);
    case 12: return invoke_mapping_sync(input, input_len);
    case 13: return invoke_unmap(input, input_len);
    default: return -ENOTSUP;
  }
}

__attribute__((destructor))
static void close_retained_handles(void) {
  for (size_t index = 0; index < MAX_MAPPINGS; index += 1) {
    if (mappings[index].active) munmap(mappings[index].address, mappings[index].length);
    mappings[index].active = 0;
    mappings[index].address = NULL;
    mappings[index].length = 0;
  }
  for (size_t index = 0; index < MAX_HANDLES; index += 1) {
    if (handles[index].active) close(handles[index].descriptor);
    handles[index].active = 0;
    handles[index].descriptor = -1;
  }
}
