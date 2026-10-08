#include <errno.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

static uint16_t read_u16(const uint8_t *bytes) {
  return (uint16_t)bytes[0] | ((uint16_t)bytes[1] << 8);
}

static uint32_t read_u32(const uint8_t *bytes) {
  return (uint32_t)bytes[0] | ((uint32_t)bytes[1] << 8) |
         ((uint32_t)bytes[2] << 16) | ((uint32_t)bytes[3] << 24);
}

static int32_t run(char *const arguments[]) {
  pid_t child = fork();
  if (child < 0) return -errno;
  if (child == 0) {
    execv(arguments[0], arguments);
    _exit(127);
  }
  int child_status = 0;
  if (waitpid(child, &child_status, 0) < 0) return -errno;
  if (!WIFEXITED(child_status) || WEXITSTATUS(child_status) != 0) return -EIO;
  return 0;
}

int32_t wasmc_boundary_v1_invoke(
    const uint8_t *input, size_t input_len,
    uint8_t *output, size_t output_capacity, size_t *output_len) {
  (void)output_capacity;
  if (!input || !output || !output_len || input_len == 0) return -EINVAL;
  *output_len = 0;
  if (input[0] == 1) {
    if (input_len != 9) return -EINVAL;
    char x[16];
    char y[16];
    snprintf(x, sizeof(x), "%u", read_u32(input + 1));
    snprintf(y, sizeof(y), "%u", read_u32(input + 5));
    char *const arguments[] = {"/system/bin/input", "tap", x, y, NULL};
    return run(arguments);
  }
  if (input[0] == 2) {
    if (input_len < 3) return -EINVAL;
    uint16_t length = read_u16(input + 1);
    if (length == 0 || length > 1024 || input_len != 3u + (size_t)length) return -EINVAL;
    if (memchr(input + 3, 0, length)) return -EINVAL;
    char *value = calloc((size_t)length + 1u, 1);
    if (!value) return -ENOMEM;
    memcpy(value, input + 3, length);
    char *const arguments[] = {"/system/bin/input", "text", value, NULL};
    int32_t status = run(arguments);
    free(value);
    return status;
  }
  if (input[0] == 3) {
    if (input_len != 5) return -EINVAL;
    char key[16];
    snprintf(key, sizeof(key), "%u", read_u32(input + 1));
    char *const arguments[] = {"/system/bin/input", "keyevent", key, NULL};
    return run(arguments);
  }
  return -EINVAL;
}
