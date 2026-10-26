#define _GNU_SOURCE
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
static int refuse_next_growth;
static void *test_realloc(void *pointer, size_t size) {
  if (refuse_next_growth) { refuse_next_growth = 0; return NULL; }
  return realloc(pointer, size);
}
#define realloc test_realloc
#include "linux-socket/platform/native-adapter.c"
#undef realloc
#include <fcntl.h>
int main(void) {
  enum { COUNT = 4096 };
  uint64_t tokens[COUNT];
  const int base = open("/dev/null", O_RDONLY | O_CLOEXEC);
  assert(base >= 0);
  for (size_t i = 0; i < 8; i++) { const int fd = dup(base); assert(fd >= 0); assert(register_handle(fd, HANDLE_STREAM, &tokens[i]) == 0); }
  struct handle_slot *before = handles;
  const size_t old_capacity = handles_capacity;
  const int rejected = dup(base); assert(rejected >= 0);
  refuse_next_growth = 1;
  uint64_t unused;
  assert(register_handle(rejected, HANDLE_STREAM, &unused) == -ENOMEM);
  close(rejected);
  assert(handles == before && handles_capacity == old_capacity);
  for (size_t i = 8; i < COUNT; i++) { const int fd = dup(base); assert(fd >= 0); assert(register_handle(fd, HANDLE_STREAM, &tokens[i]) == 0); }
  for (size_t i = 0; i < COUNT; i++) {
    int fd;
    assert(resolve_handle(tokens[i], HANDLE_STREAM, NULL, &fd) == 0 && fd >= 0);
    uint8_t request[9] = {10}, output[1]; size_t length;
    write_u64(request + 1, tokens[i]);
    assert(wasmc_boundary_v1_invoke(request, sizeof(request), output, sizeof(output), &length) == 0);
    assert(resolve_handle(tokens[i], HANDLE_STREAM, NULL, &fd) == -EBADF);
  }
  handles[0].generation = UINT32_MAX; // exhausted physical identity retires
  uint64_t next;
  const int next_fd = dup(base); assert(next_fd >= 0);
  assert(register_handle(next_fd, HANDLE_STREAM, &next) == 0);
  assert((uint32_t)next != 1);
  close(base);
  close_retained_handles();
  assert(handles == NULL && handles_capacity == 0);
  puts("{\"accepted\":true,\"fixture\":\"socket\",\"live_handles\":4096,\"allocation_refusal_preserves_prior_state\":true,\"cleanup\":true}");
}
