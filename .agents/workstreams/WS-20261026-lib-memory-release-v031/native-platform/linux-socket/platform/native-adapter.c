#define _GNU_SOURCE

#include <arpa/inet.h>
#include <errno.h>
#include <poll.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>

#define MAX_HANDLES 1024
#define HANDLE_LISTENER 1
#define HANDLE_STREAM 2

struct handle_slot {
  int descriptor;
  uint32_t generation;
  uint8_t active;
  uint8_t kind;
};

static struct handle_slot handles[MAX_HANDLES];

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

static void write_u64(uint8_t *bytes, uint64_t value) {
  for (size_t index = 0; index < 8; index += 1) bytes[index] = (uint8_t)(value >> (index * 8));
}

static int32_t register_handle(int descriptor, uint8_t kind, uint64_t *token) {
  for (uint32_t index = 0; index < MAX_HANDLES; index += 1) {
    if (!handles[index].active) {
      handles[index].generation += 1;
      if (handles[index].generation == 0) handles[index].generation = 1;
      handles[index].descriptor = descriptor;
      handles[index].kind = kind;
      handles[index].active = 1;
      *token = ((uint64_t)handles[index].generation << 32) | ((uint64_t)index + 1);
      return 0;
    }
  }
  return -EMFILE;
}

static int32_t resolve_handle(
    uint64_t token, uint8_t expected_kind,
    uint32_t *index, int *descriptor) {
  const uint32_t encoded_index = (uint32_t)token;
  const uint32_t generation = (uint32_t)(token >> 32);
  if (encoded_index == 0 || encoded_index > MAX_HANDLES || generation == 0) return -EBADF;
  const uint32_t slot = encoded_index - 1;
  if (!handles[slot].active || handles[slot].generation != generation) return -EBADF;
  if (expected_kind != 0 && handles[slot].kind != expected_kind) return -ENOTSOCK;
  if (index) *index = slot;
  *descriptor = handles[slot].descriptor;
  return 0;
}

static void decode_address(const uint8_t *bytes, struct sockaddr_in *address) {
  memset(address, 0, sizeof(*address));
  address->sin_family = AF_INET;
  memcpy(&address->sin_addr.s_addr, bytes, 4);
  address->sin_port = htons(read_u16(bytes + 4));
}

static void encode_address(const struct sockaddr_in *address, uint8_t *output) {
  memcpy(output, &address->sin_addr.s_addr, 4);
  write_u16(output + 4, ntohs(address->sin_port));
}

static int32_t create_stream_socket(int *descriptor) {
  *descriptor = socket(AF_INET, SOCK_STREAM | SOCK_CLOEXEC, 0);
  return *descriptor >= 0 ? 0 : -errno;
}

static int32_t invoke_bind(
    const uint8_t *input, size_t input_len,
    uint8_t *output, size_t output_capacity, size_t *output_len) {
  if (input_len != 11 || output_capacity < 8) return -EINVAL;
  const uint32_t backlog = read_u32(input + 7);
  if (backlog == 0 || backlog > INT32_MAX) return -EINVAL;
  struct sockaddr_in address;
  decode_address(input + 1, &address);
  int descriptor = -1;
  int32_t status = create_stream_socket(&descriptor);
  if (status != 0) return status;
  const int reuse = 1;
  if (setsockopt(descriptor, SOL_SOCKET, SO_REUSEADDR, &reuse, sizeof(reuse)) != 0 ||
      bind(descriptor, (const struct sockaddr *)&address, sizeof(address)) != 0 ||
      listen(descriptor, (int)backlog) != 0) {
    status = -errno;
    close(descriptor);
    return status;
  }
  uint64_t token = 0;
  status = register_handle(descriptor, HANDLE_LISTENER, &token);
  if (status != 0) {
    close(descriptor);
    return status;
  }
  write_u64(output, token);
  *output_len = 8;
  return 0;
}

static int32_t invoke_connect(
    const uint8_t *input, size_t input_len,
    uint8_t *output, size_t output_capacity, size_t *output_len) {
  if (input_len != 7 || output_capacity < 8) return -EINVAL;
  struct sockaddr_in address;
  decode_address(input + 1, &address);
  int descriptor = -1;
  int32_t status = create_stream_socket(&descriptor);
  if (status != 0) return status;
  if (connect(descriptor, (const struct sockaddr *)&address, sizeof(address)) != 0) {
    status = -errno;
    close(descriptor);
    return status;
  }
  uint64_t token = 0;
  status = register_handle(descriptor, HANDLE_STREAM, &token);
  if (status != 0) {
    close(descriptor);
    return status;
  }
  write_u64(output, token);
  *output_len = 8;
  return 0;
}

static int32_t invoke_accept(
    const uint8_t *input, size_t input_len,
    uint8_t *output, size_t output_capacity, size_t *output_len) {
  if (input_len != 9 || output_capacity < 14) return -EINVAL;
  int listener = -1;
  int32_t status = resolve_handle(read_u64(input + 1), HANDLE_LISTENER, NULL, &listener);
  if (status != 0) return status;
  struct sockaddr_in peer;
  socklen_t peer_len = sizeof(peer);
  const int descriptor = accept4(listener, (struct sockaddr *)&peer, &peer_len, SOCK_CLOEXEC);
  if (descriptor < 0) return -errno;
  if (peer_len != sizeof(peer) || peer.sin_family != AF_INET) {
    close(descriptor);
    return -EPROTO;
  }
  uint64_t token = 0;
  status = register_handle(descriptor, HANDLE_STREAM, &token);
  if (status != 0) {
    close(descriptor);
    return status;
  }
  write_u64(output, token);
  encode_address(&peer, output + 8);
  *output_len = 14;
  return 0;
}

static int32_t invoke_endpoint(
    const uint8_t *input, size_t input_len,
    uint8_t *output, size_t output_capacity, size_t *output_len) {
  if (input_len != 9 || output_capacity < 6) return -EINVAL;
  int descriptor = -1;
  int32_t status = resolve_handle(read_u64(input + 1), 0, NULL, &descriptor);
  if (status != 0) return status;
  struct sockaddr_in address;
  socklen_t address_len = sizeof(address);
  const int result = input[0] == 4
      ? getsockname(descriptor, (struct sockaddr *)&address, &address_len)
      : getpeername(descriptor, (struct sockaddr *)&address, &address_len);
  if (result != 0) return -errno;
  if (address_len != sizeof(address) || address.sin_family != AF_INET) return -EPROTO;
  encode_address(&address, output);
  *output_len = 6;
  return 0;
}

static int32_t invoke_read(
    const uint8_t *input, size_t input_len,
    uint8_t *output, size_t output_capacity, size_t *output_len) {
  if (input_len != 13) return -EINVAL;
  const uint32_t maximum = read_u32(input + 9);
  if (maximum > output_capacity) return -EINVAL;
  int descriptor = -1;
  int32_t status = resolve_handle(read_u64(input + 1), HANDLE_STREAM, NULL, &descriptor);
  if (status != 0) return status;
  ssize_t count;
  do {
    count = recv(descriptor, output, maximum, 0);
  } while (count < 0 && errno == EINTR);
  if (count < 0) return -errno;
  *output_len = (size_t)count;
  return 0;
}

static int32_t invoke_write(
    const uint8_t *input, size_t input_len,
    uint8_t *output, size_t output_capacity, size_t *output_len) {
  if (input_len < 13 || output_capacity < 8) return -EINVAL;
  const uint32_t payload_len = read_u32(input + 9);
  if (input_len != 13 + (size_t)payload_len) return -EINVAL;
  int descriptor = -1;
  int32_t status = resolve_handle(read_u64(input + 1), HANDLE_STREAM, NULL, &descriptor);
  if (status != 0) return status;
  uint64_t written = 0;
  while (written < payload_len) {
    const ssize_t count = send(
        descriptor, input + 13 + written, payload_len - written, MSG_NOSIGNAL);
    if (count < 0 && errno == EINTR) continue;
    if (count < 0) return -errno;
    if (count == 0) return -EIO;
    written += (uint64_t)count;
  }
  write_u64(output, written);
  *output_len = 8;
  return 0;
}

static int32_t invoke_poll(
    const uint8_t *input, size_t input_len,
    uint8_t *output, size_t output_capacity, size_t *output_len) {
  if (input_len != 15 || output_capacity < 2) return -EINVAL;
  int descriptor = -1;
  int32_t status = resolve_handle(read_u64(input + 1), 0, NULL, &descriptor);
  if (status != 0) return status;
  struct pollfd item = {
    .fd = descriptor,
    .events = (short)read_u16(input + 9),
    .revents = 0,
  };
  int result;
  do {
    result = poll(&item, 1, (int32_t)read_u32(input + 11));
  } while (result < 0 && errno == EINTR);
  if (result < 0) return -errno;
  write_u16(output, (uint16_t)item.revents);
  *output_len = 2;
  return 0;
}

static int32_t invoke_shutdown_write(const uint8_t *input, size_t input_len) {
  if (input_len != 9) return -EINVAL;
  int descriptor = -1;
  int32_t status = resolve_handle(read_u64(input + 1), HANDLE_STREAM, NULL, &descriptor);
  if (status != 0) return status;
  return shutdown(descriptor, SHUT_WR) == 0 ? 0 : -errno;
}

static int32_t invoke_close(const uint8_t *input, size_t input_len) {
  if (input_len != 9) return -EINVAL;
  uint32_t index = 0;
  int descriptor = -1;
  int32_t status = resolve_handle(read_u64(input + 1), 0, &index, &descriptor);
  if (status != 0) return status;
  handles[index].active = 0;
  handles[index].descriptor = -1;
  handles[index].kind = 0;
  return close(descriptor) == 0 ? 0 : -errno;
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
    case 1: return invoke_bind(input, input_len, output, output_capacity, output_len);
    case 2: return invoke_connect(input, input_len, output, output_capacity, output_len);
    case 3: return invoke_accept(input, input_len, output, output_capacity, output_len);
    case 4:
    case 5: return invoke_endpoint(input, input_len, output, output_capacity, output_len);
    case 6: return invoke_read(input, input_len, output, output_capacity, output_len);
    case 7: return invoke_write(input, input_len, output, output_capacity, output_len);
    case 8: return invoke_poll(input, input_len, output, output_capacity, output_len);
    case 9: return invoke_shutdown_write(input, input_len);
    case 10: return invoke_close(input, input_len);
    default: return -ENOTSUP;
  }
}

__attribute__((destructor))
static void close_retained_handles(void) {
  for (size_t index = 0; index < MAX_HANDLES; index += 1) {
    if (handles[index].active) close(handles[index].descriptor);
    handles[index].active = 0;
    handles[index].descriptor = -1;
    handles[index].kind = 0;
  }
}
