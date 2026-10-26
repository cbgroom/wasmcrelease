#include <assert.h>
#include <errno.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/types.h>

static unsigned calls;
pid_t mock_fork(void) { calls++; errno = EAGAIN; return -1; }
int32_t wasmc_boundary_v1_invoke(const uint8_t *, size_t, uint8_t *, size_t, size_t *);
static int32_t invoke(const uint8_t *bytes, size_t n) {
  uint8_t output = 0; size_t output_len = 99;
  int32_t result = wasmc_boundary_v1_invoke(bytes, n, &output, 0, &output_len);
  assert(output_len == 0); return result;
}
static uint8_t *frame(unsigned op, uint32_t len) {
  size_t header = op == 2 ? 3 : 5;
  uint8_t *p = malloc(header + (size_t)len); assert(p);
  p[0] = (uint8_t)op; p[1] = (uint8_t)len; p[2] = (uint8_t)(len >> 8);
  if (op == 4) { p[3] = (uint8_t)(len >> 16); p[4] = (uint8_t)(len >> 24); }
  memset(p + header, 'x', len); return p;
}
int main(int argc, char **argv) {
  if (argc == 3 && strcmp(argv[1], "frame") == 0) {
    FILE *f = fopen(argv[2], "rb"); assert(f);
    assert(fseek(f, 0, SEEK_END) == 0); long length = ftell(f); assert(length > 5);
    assert(fseek(f, 0, SEEK_SET) == 0); uint8_t *data = malloc((size_t)length); assert(data);
    assert(fread(data, 1, (size_t)length, f) == (size_t)length); assert(fclose(f) == 0);
    assert(invoke(data, (size_t)length) == -EAGAIN && calls == 1); free(data);
    printf("encoded frame accepted, bytes=%ld, exactly one mocked system invocation\n", length);
    return 0;
  }
  int old = argc == 2 && strcmp(argv[1], "old") == 0;
  uint8_t *p = frame(2, 1025); int32_t result = invoke(p, 1028);
  if (old) { assert(result == -EINVAL && calls == 0); printf("old 1025-byte text rejected: %d\n", result); free(p); return 0; }
  assert(result == -EAGAIN && calls == 1); free(p);
  p = frame(2, 65535); assert(invoke(p, 65538) == -EAGAIN && calls == 2); free(p);
  p = frame(4, 70000); assert(invoke(p, 70005) == -EAGAIN && calls == 3);
  assert(invoke(p, 70004) == -EINVAL && calls == 3);
  p[100] = 0; assert(invoke(p, 70005) == -EINVAL && calls == 3); free(p);
  p = frame(4, 0); assert(invoke(p, 5) == -EINVAL && calls == 3); free(p);
  printf("candidate accepted u16 65535 and u32 70000; malformed, NUL and empty rejected; calls=%u\n", calls);
}
