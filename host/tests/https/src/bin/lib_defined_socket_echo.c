#define _GNU_SOURCE

#include <dlfcn.h>
#include <errno.h>
#include <inttypes.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

typedef int32_t (*invoke_fn)(
    const uint8_t *, size_t, uint8_t *, size_t, size_t *);

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

static uint16_t read_u16(const uint8_t *bytes) {
  return (uint16_t)bytes[0] | ((uint16_t)bytes[1] << 8);
}

static uint64_t read_u64(const uint8_t *bytes) {
  uint64_t value = 0;
  for (size_t index = 0; index < 8; index += 1) value |= (uint64_t)bytes[index] << (index * 8);
  return value;
}

static void require_call(
    invoke_fn invoke, const uint8_t *input, size_t input_len,
    uint8_t *output, size_t output_capacity, size_t *output_len) {
  const int32_t status = invoke(input, input_len, output, output_capacity, output_len);
  if (status != 0) {
    fprintf(stderr, "Lib socket adapter failed: %d\n", status);
    exit(1);
  }
}

static uint64_t call_token(invoke_fn invoke, const uint8_t *input, size_t input_len) {
  uint8_t output[16];
  size_t output_len = 0;
  require_call(invoke, input, input_len, output, sizeof(output), &output_len);
  if (output_len < 8) {
    fputs("Lib socket adapter returned a short token\n", stderr);
    exit(1);
  }
  return read_u64(output);
}

static void write_all(invoke_fn invoke, uint64_t token, const uint8_t *payload, size_t length) {
  uint8_t *input = malloc(13 + length);
  uint8_t output[8];
  size_t output_len = 0;
  if (!input) exit(1);
  input[0] = 7;
  write_u64(input + 1, token);
  write_u32(input + 9, (uint32_t)length);
  memcpy(input + 13, payload, length);
  require_call(invoke, input, 13 + length, output, sizeof(output), &output_len);
  free(input);
  if (output_len != 8 || read_u64(output) != length) {
    fputs("Lib socket adapter returned a partial benchmark write\n", stderr);
    exit(1);
  }
}

static void read_exact(invoke_fn invoke, uint64_t token, uint8_t *output, size_t length) {
  size_t offset = 0;
  while (offset < length) {
    uint8_t input[13] = {0};
    size_t output_len = 0;
    input[0] = 6;
    write_u64(input + 1, token);
    write_u32(input + 9, (uint32_t)(length - offset));
    require_call(invoke, input, sizeof(input), output + offset, length - offset, &output_len);
    if (output_len == 0) {
      fputs("unexpected Lib socket EOF\n", stderr);
      exit(1);
    }
    offset += output_len;
  }
}

static void close_token(invoke_fn invoke, uint64_t token) {
  uint8_t input[9] = {0};
  uint8_t output[1];
  size_t output_len = 0;
  input[0] = 10;
  write_u64(input + 1, token);
  require_call(invoke, input, sizeof(input), output, sizeof(output), &output_len);
}

static uint64_t monotonic_ns(void) {
  struct timespec value;
  if (clock_gettime(CLOCK_MONOTONIC, &value) != 0) exit(1);
  return (uint64_t)value.tv_sec * UINT64_C(1000000000) + (uint64_t)value.tv_nsec;
}

int main(int argc, char **argv) {
  if (argc != 4) {
    fputs("usage: lib-defined-socket-echo ADAPTER ITERATIONS FRAME_BYTES\n", stderr);
    return 2;
  }
  const size_t iterations = strtoull(argv[2], NULL, 10);
  const size_t frame_bytes = strtoull(argv[3], NULL, 10);
  if (iterations == 0 || frame_bytes < 16 || frame_bytes > 1048576) return 2;
  void *library = dlopen(argv[1], RTLD_NOW | RTLD_LOCAL);
  if (!library) {
    fprintf(stderr, "dlopen: %s\n", dlerror());
    return 1;
  }
  invoke_fn invoke = (invoke_fn)dlsym(library, "wasmc_boundary_v1_invoke");
  if (!invoke) {
    fprintf(stderr, "dlsym: %s\n", dlerror());
    return 1;
  }

  uint8_t bind_input[11] = {1, 127, 0, 0, 1};
  write_u16(bind_input + 5, 0);
  write_u32(bind_input + 7, 128);
  const uint64_t listener = call_token(invoke, bind_input, sizeof(bind_input));

  uint8_t endpoint_input[9] = {0};
  uint8_t endpoint_output[6];
  size_t endpoint_len = 0;
  endpoint_input[0] = 4;
  write_u64(endpoint_input + 1, listener);
  require_call(invoke, endpoint_input, sizeof(endpoint_input), endpoint_output, sizeof(endpoint_output), &endpoint_len);
  if (endpoint_len != 6) return 1;

  uint8_t connect_input[7] = {2, 127, 0, 0, 1};
  write_u16(connect_input + 5, read_u16(endpoint_output + 4));
  const uint64_t client = call_token(invoke, connect_input, sizeof(connect_input));
  uint8_t accept_input[9] = {0};
  accept_input[0] = 3;
  write_u64(accept_input + 1, listener);
  const uint64_t server = call_token(invoke, accept_input, sizeof(accept_input));

  uint8_t *sent = malloc(frame_bytes);
  uint8_t *received = malloc(frame_bytes);
  if (!sent || !received) return 1;
  for (size_t index = 0; index < frame_bytes; index += 1) sent[index] = (uint8_t)(index * 31U + 7U);

  const uint64_t started = monotonic_ns();
  for (size_t iteration = 0; iteration < iterations; iteration += 1) {
    sent[0] = (uint8_t)iteration;
    write_all(invoke, client, sent, frame_bytes);
    read_exact(invoke, server, received, frame_bytes);
    if (memcmp(sent, received, frame_bytes) != 0) return 1;
    write_all(invoke, server, received, frame_bytes);
    read_exact(invoke, client, received, frame_bytes);
    if (memcmp(sent, received, frame_bytes) != 0) return 1;
  }
  const uint64_t elapsed_ns = monotonic_ns() - started;
  const uint64_t logical_transfers = (uint64_t)iterations * 2;
  const double operations_per_sec = (double)logical_transfers * 1e9 / (double)elapsed_ns;
  const double mib_per_second = operations_per_sec * (double)frame_bytes / (1024.0 * 1024.0);

  close_token(invoke, client);
  close_token(invoke, server);
  close_token(invoke, listener);
  free(sent);
  free(received);
  dlclose(library);
  printf("{\"accepted\":true,\"lane\":\"lib-defined-socket-adapter\",\"iterations\":%zu,\"frame_bytes\":%zu,\"elapsed_ns\":%" PRIu64 ",\"logical_transfers\":%" PRIu64 ",\"logical_transfers_per_sec\":%.3f,\"mib_per_second\":%.3f}\n",
         iterations, frame_bytes, elapsed_ns, logical_transfers, operations_per_sec, mib_per_second);
  return 0;
}
