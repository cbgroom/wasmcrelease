#define _GNU_SOURCE

#include <errno.h>
#include <fcntl.h>
#include <poll.h>
#include <pthread.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <sys/epoll.h>
#include <sys/eventfd.h>
#include <sys/ioctl.h>
#include <sys/mman.h>
#include <sys/uio.h>
#include <unistd.h>

#define MAX_HANDLES 1024
#define MAX_MAPPINGS 1024
#define MAX_MAPPING_BYTES (UINT64_C(256) * 1024 * 1024)
#define MAX_READINESS_OPERATIONS 1024
#define MAX_WRITE_VECTORS 1024

#define READINESS_PENDING 0
#define READINESS_READY 1
#define READINESS_CANCELLED 2
#define READINESS_TIMED_OUT 3
#define READINESS_FAILED 4

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

struct readiness_slot {
  pthread_t thread;
  int target_descriptor;
  int cancel_descriptor;
  int32_t timeout_milliseconds;
  int32_t status;
  uint32_t generation;
  uint16_t events;
  uint16_t returned_events;
  uint8_t active;
  uint8_t state;
  uint8_t thread_started;
};

static struct readiness_slot readiness_operations[MAX_READINESS_OPERATIONS];
static pthread_mutex_t readiness_mutex = PTHREAD_MUTEX_INITIALIZER;

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

static int32_t invoke_ioctl_buffer(
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

static int32_t invoke_ioctl_none(
    const uint8_t *input, size_t input_len,
    uint8_t *output, size_t output_capacity, size_t *output_len) {
  if (input_len != 17 || output_capacity < 4) return -EINVAL;
  int descriptor = -1;
  int32_t status = resolve_handle(read_u64(input + 1), NULL, &descriptor);
  if (status != 0) return status;
  const int result = ioctl(descriptor, (unsigned long)read_u64(input + 9));
  if (result < 0) return -errno;
  write_u32(output, (uint32_t)result);
  *output_len = 4;
  return 0;
}

static int32_t invoke_ioctl_value(
    const uint8_t *input, size_t input_len,
    uint8_t *output, size_t output_capacity, size_t *output_len) {
  if (input_len != 25 || output_capacity < 4) return -EINVAL;
  int descriptor = -1;
  int32_t status = resolve_handle(read_u64(input + 1), NULL, &descriptor);
  if (status != 0) return status;
  const int result = ioctl(
      descriptor,
      (unsigned long)read_u64(input + 9),
      (unsigned long)read_u64(input + 17));
  if (result < 0) return -errno;
  write_u32(output, (uint32_t)result);
  *output_len = 4;
  return 0;
}

static int32_t invoke_write_vectors(
    const uint8_t *input, size_t input_len,
    uint8_t *output, size_t output_capacity, size_t *output_len) {
  if (input_len < 13 || output_capacity < 8) return -EINVAL;
  const uint32_t vector_count = read_u32(input + 9);
  if (vector_count == 0 || vector_count > MAX_WRITE_VECTORS) return -EINVAL;
  const long native_iov_max = sysconf(_SC_IOV_MAX);
  if (native_iov_max <= 0 || (uint64_t)vector_count > (uint64_t)native_iov_max) return -EINVAL;

  int descriptor = -1;
  int32_t status = resolve_handle(read_u64(input + 1), NULL, &descriptor);
  if (status != 0) return status;

  struct iovec *vectors = calloc(vector_count, sizeof(*vectors));
  if (!vectors) return -ENOMEM;
  size_t cursor = 13;
  for (uint32_t index = 0; index < vector_count; index += 1) {
    if (cursor > input_len || input_len - cursor < 4) {
      free(vectors);
      return -EINVAL;
    }
    const uint32_t length = read_u32(input + cursor);
    cursor += 4;
    if ((size_t)length > input_len - cursor) {
      free(vectors);
      return -EINVAL;
    }
    vectors[index].iov_base = (void *)(input + cursor);
    vectors[index].iov_len = length;
    cursor += length;
  }
  if (cursor != input_len) {
    free(vectors);
    return -EINVAL;
  }

  ssize_t count;
  do {
    count = writev(descriptor, vectors, (int)vector_count);
  } while (count < 0 && errno == EINTR);
  free(vectors);
  if (count < 0) return -errno;
  write_u64(output, (uint64_t)count);
  *output_len = 8;
  return 0;
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

static int32_t invoke_epoll_create(
    size_t input_len,
    uint8_t *output, size_t output_capacity, size_t *output_len) {
  if (input_len != 1 || output_capacity < 8) return -EINVAL;
  int descriptor = epoll_create1(EPOLL_CLOEXEC);
  if (descriptor < 0) return -errno;
  uint64_t token = 0;
  int32_t status = register_handle(descriptor, &token);
  if (status != 0) { close(descriptor); return status; }
  write_u64(output, token);
  *output_len = 8;
  return 0;
}

static int32_t invoke_epoll_control(const uint8_t *input, size_t input_len) {
  if (input_len != 33) return -EINVAL;
  int epoll_descriptor = -1;
  int endpoint_descriptor = -1;
  int32_t status = resolve_handle(read_u64(input + 1), NULL, &epoll_descriptor);
  if (status != 0) return status;
  status = resolve_handle(read_u64(input + 13), NULL, &endpoint_descriptor);
  if (status != 0) return status;
  const int operation = (int32_t)read_u32(input + 9);
  struct epoll_event event = { .events = read_u32(input + 21), .data.u64 = read_u64(input + 25) };
  return epoll_ctl(
      epoll_descriptor,
      operation,
      endpoint_descriptor,
      operation == EPOLL_CTL_DEL ? NULL : &event) == 0 ? 0 : -errno;
}

static int32_t invoke_epoll_wait(
    const uint8_t *input, size_t input_len,
    uint8_t *output, size_t output_capacity, size_t *output_len) {
  if (input_len != 17) return -EINVAL;
  int epoll_descriptor = -1;
  int32_t status = resolve_handle(read_u64(input + 1), NULL, &epoll_descriptor);
  if (status != 0) return status;
  const uint32_t maximum = read_u32(input + 9);
  const int32_t timeout = (int32_t)read_u32(input + 13);
  if (output_capacity < 4 || maximum == 0 || maximum > 4096 || maximum > (output_capacity - 4) / 12) return -EINVAL;
  struct epoll_event *events = calloc(maximum, sizeof(*events));
  if (!events) return -ENOMEM;
  const int count = epoll_wait(epoll_descriptor, events, (int)maximum, timeout);
  if (count < 0) status = -errno;
  else {
    write_u32(output, (uint32_t)count);
    for (int index = 0; index < count; index += 1) {
      write_u32(output + 4 + (size_t)index * 12, events[index].events);
      write_u64(output + 8 + (size_t)index * 12, events[index].data.u64);
    }
    *output_len = 4 + (size_t)count * 12;
  }
  free(events);
  return status;
}

static int32_t invoke_pipe_create(
    const uint8_t *input, size_t input_len,
    uint8_t *output, size_t output_capacity, size_t *output_len) {
  if (input_len != 5 || output_capacity < 16) return -EINVAL;
  int descriptors[2] = {-1, -1};
  if (pipe2(descriptors, (int)read_u32(input + 1) | O_CLOEXEC) != 0) return -errno;
  uint64_t read_token = 0;
  uint64_t write_token = 0;
  int32_t status = register_handle(descriptors[0], &read_token);
  if (status != 0) {
    close(descriptors[0]);
    close(descriptors[1]);
    return status;
  }
  status = register_handle(descriptors[1], &write_token);
  if (status != 0) {
    const uint32_t read_index = (uint32_t)read_token - 1;
    handles[read_index].active = 0;
    handles[read_index].descriptor = -1;
    close(descriptors[0]);
    close(descriptors[1]);
    return status;
  }
  write_u64(output, read_token);
  write_u64(output + 8, write_token);
  *output_len = 16;
  return 0;
}

static int32_t invoke_splice(
    const uint8_t *input, size_t input_len,
    uint8_t *output, size_t output_capacity, size_t *output_len) {
  if (input_len != 29 || output_capacity < 8) return -EINVAL;
  int source = -1;
  int target = -1;
  int32_t status = resolve_handle(read_u64(input + 1), NULL, &source);
  if (status != 0) return status;
  status = resolve_handle(read_u64(input + 9), NULL, &target);
  if (status != 0) return status;
  const uint64_t maximum = read_u64(input + 17);
  const size_t native_maximum = (size_t)maximum;
  if ((uint64_t)native_maximum != maximum || maximum > INT64_MAX) return -EINVAL;
  const ssize_t count = splice(source, NULL, target, NULL, native_maximum, read_u32(input + 25));
  if (count < 0) return -errno;
  write_u64(output, (uint64_t)count);
  *output_len = 8;
  return 0;
}

static void *run_readiness_operation(void *argument) {
  struct readiness_slot *slot = argument;
  struct pollfd descriptors[2] = {
    {.fd = slot->target_descriptor, .events = (short)slot->events, .revents = 0},
    {.fd = slot->cancel_descriptor, .events = POLLIN, .revents = 0},
  };
  const int result = poll(descriptors, 2, slot->timeout_milliseconds);
  const int saved_errno = errno;
  pthread_mutex_lock(&readiness_mutex);
  if (result < 0) {
    slot->state = READINESS_FAILED;
    slot->status = -saved_errno;
  } else if ((descriptors[1].revents & POLLIN) != 0) {
    slot->state = READINESS_CANCELLED;
    slot->status = 0;
  } else if (result == 0) {
    slot->state = READINESS_TIMED_OUT;
    slot->status = 0;
  } else {
    slot->state = READINESS_READY;
    slot->status = 0;
    slot->returned_events = (uint16_t)descriptors[0].revents;
  }
  close(slot->target_descriptor);
  close(slot->cancel_descriptor);
  slot->target_descriptor = -1;
  slot->cancel_descriptor = -1;
  pthread_mutex_unlock(&readiness_mutex);
  return NULL;
}

static int32_t resolve_readiness_operation(uint64_t token, uint32_t *index) {
  const uint32_t encoded_index = (uint32_t)token;
  const uint32_t generation = (uint32_t)(token >> 32);
  if (encoded_index == 0 || encoded_index > MAX_READINESS_OPERATIONS || generation == 0) return -EBADF;
  const uint32_t slot = encoded_index - 1;
  if (!readiness_operations[slot].active || readiness_operations[slot].generation != generation) return -EBADF;
  *index = slot;
  return 0;
}

static int32_t invoke_readiness_start(
    const uint8_t *input, size_t input_len,
    uint8_t *output, size_t output_capacity, size_t *output_len) {
  if (input_len != 15 || output_capacity < 8) return -EINVAL;
  int descriptor = -1;
  int32_t status = resolve_handle(read_u64(input + 1), NULL, &descriptor);
  if (status != 0) return status;
  const int retained_descriptor = fcntl(descriptor, F_DUPFD_CLOEXEC, 0);
  if (retained_descriptor < 0) return -errno;
  const int cancel_descriptor = eventfd(0, EFD_CLOEXEC | EFD_NONBLOCK);
  if (cancel_descriptor < 0) {
    status = -errno;
    close(retained_descriptor);
    return status;
  }
  pthread_mutex_lock(&readiness_mutex);
  uint32_t index = MAX_READINESS_OPERATIONS;
  for (uint32_t candidate = 0; candidate < MAX_READINESS_OPERATIONS; candidate += 1) {
    if (!readiness_operations[candidate].active) {
      index = candidate;
      break;
    }
  }
  if (index == MAX_READINESS_OPERATIONS) {
    pthread_mutex_unlock(&readiness_mutex);
    close(retained_descriptor);
    close(cancel_descriptor);
    return -EMFILE;
  }
  struct readiness_slot *slot = &readiness_operations[index];
  slot->generation += 1;
  if (slot->generation == 0) slot->generation = 1;
  slot->target_descriptor = retained_descriptor;
  slot->cancel_descriptor = cancel_descriptor;
  slot->timeout_milliseconds = (int32_t)read_u32(input + 11);
  slot->status = 0;
  slot->events = read_u16(input + 9);
  slot->returned_events = 0;
  slot->active = 1;
  slot->state = READINESS_PENDING;
  slot->thread_started = 0;
  const int thread_status = pthread_create(&slot->thread, NULL, run_readiness_operation, slot);
  if (thread_status != 0) {
    slot->active = 0;
    slot->target_descriptor = -1;
    slot->cancel_descriptor = -1;
    pthread_mutex_unlock(&readiness_mutex);
    close(retained_descriptor);
    close(cancel_descriptor);
    return -thread_status;
  }
  slot->thread_started = 1;
  const uint64_t token = ((uint64_t)slot->generation << 32) | ((uint64_t)index + 1);
  pthread_mutex_unlock(&readiness_mutex);
  write_u64(output, token);
  *output_len = 8;
  return 0;
}

static int32_t invoke_readiness_status(
    const uint8_t *input, size_t input_len,
    uint8_t *output, size_t output_capacity, size_t *output_len) {
  if (input_len != 9 || output_capacity < 7) return -EINVAL;
  pthread_mutex_lock(&readiness_mutex);
  uint32_t index = 0;
  const int32_t status = resolve_readiness_operation(read_u64(input + 1), &index);
  if (status != 0) {
    pthread_mutex_unlock(&readiness_mutex);
    return status;
  }
  const struct readiness_slot *slot = &readiness_operations[index];
  output[0] = slot->state;
  write_u32(output + 1, (uint32_t)slot->status);
  write_u16(output + 5, slot->returned_events);
  *output_len = 7;
  pthread_mutex_unlock(&readiness_mutex);
  return 0;
}

static int32_t invoke_readiness_cancel(const uint8_t *input, size_t input_len) {
  if (input_len != 9) return -EINVAL;
  pthread_mutex_lock(&readiness_mutex);
  uint32_t index = 0;
  int32_t status = resolve_readiness_operation(read_u64(input + 1), &index);
  if (status != 0) {
    pthread_mutex_unlock(&readiness_mutex);
    return status;
  }
  struct readiness_slot *slot = &readiness_operations[index];
  if (slot->state != READINESS_PENDING) status = -EALREADY;
  else {
    const uint64_t signal = 1;
    if (write(slot->cancel_descriptor, &signal, sizeof(signal)) != (ssize_t)sizeof(signal)) status = -errno;
  }
  pthread_mutex_unlock(&readiness_mutex);
  return status;
}

static int32_t invoke_readiness_release(const uint8_t *input, size_t input_len) {
  if (input_len != 9) return -EINVAL;
  pthread_mutex_lock(&readiness_mutex);
  uint32_t index = 0;
  int32_t status = resolve_readiness_operation(read_u64(input + 1), &index);
  if (status != 0) {
    pthread_mutex_unlock(&readiness_mutex);
    return status;
  }
  struct readiness_slot *slot = &readiness_operations[index];
  if (slot->state == READINESS_PENDING) {
    pthread_mutex_unlock(&readiness_mutex);
    return -EBUSY;
  }
  const pthread_t thread = slot->thread;
  const uint8_t thread_started = slot->thread_started;
  slot->active = 0;
  slot->thread_started = 0;
  pthread_mutex_unlock(&readiness_mutex);
  if (thread_started && pthread_join(thread, NULL) != 0) return -EIO;
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
    case 7: return invoke_ioctl_buffer(input, input_len, output, output_capacity, output_len);
    case 8: return invoke_poll(input, input_len, output, output_capacity, output_len);
    case 9: return invoke_map(input, input_len, output, output_capacity, output_len);
    case 10: return invoke_mapping_read(input, input_len, output, output_capacity, output_len);
    case 11: return invoke_mapping_write(input, input_len, output, output_capacity, output_len);
    case 12: return invoke_mapping_sync(input, input_len);
    case 13: return invoke_unmap(input, input_len);
    case 14: return invoke_epoll_create(input_len, output, output_capacity, output_len);
    case 15: return invoke_epoll_control(input, input_len);
    case 16: return invoke_epoll_wait(input, input_len, output, output_capacity, output_len);
    case 17: return invoke_pipe_create(input, input_len, output, output_capacity, output_len);
    case 18: return invoke_splice(input, input_len, output, output_capacity, output_len);
    case 19: return invoke_readiness_start(input, input_len, output, output_capacity, output_len);
    case 20: return invoke_readiness_status(input, input_len, output, output_capacity, output_len);
    case 21: return invoke_readiness_cancel(input, input_len);
    case 22: return invoke_readiness_release(input, input_len);
    case 23: return invoke_ioctl_none(input, input_len, output, output_capacity, output_len);
    case 24: return invoke_ioctl_value(input, input_len, output, output_capacity, output_len);
    case 25: return invoke_write_vectors(input, input_len, output, output_capacity, output_len);
    default: return -ENOTSUP;
  }
}

__attribute__((destructor))
static void close_retained_handles(void) {
  for (size_t index = 0; index < MAX_READINESS_OPERATIONS; index += 1) {
    pthread_mutex_lock(&readiness_mutex);
    struct readiness_slot *slot = &readiness_operations[index];
    const uint8_t active = slot->active;
    const uint8_t thread_started = slot->thread_started;
    const pthread_t thread = slot->thread;
    if (active && slot->state == READINESS_PENDING && slot->cancel_descriptor >= 0) {
      const uint64_t signal = 1;
      const ssize_t signal_result = write(slot->cancel_descriptor, &signal, sizeof(signal));
      if (signal_result < 0 && errno != EAGAIN) slot->status = -errno;
    }
    pthread_mutex_unlock(&readiness_mutex);
    if (active && thread_started) (void)pthread_join(thread, NULL);
    pthread_mutex_lock(&readiness_mutex);
    slot->active = 0;
    slot->thread_started = 0;
    pthread_mutex_unlock(&readiness_mutex);
  }
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
