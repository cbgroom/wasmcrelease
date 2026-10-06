#include <errno.h>
#include <stdint.h>
#include <stdlib.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

static int32_t capture(
    char *const arguments[], uint8_t *output, size_t output_capacity,
    size_t *output_len) {
  int descriptors[2];
  if (pipe(descriptors) != 0) return -errno;
  pid_t child = fork();
  if (child < 0) {
    int32_t status = -errno;
    close(descriptors[0]);
    close(descriptors[1]);
    return status;
  }
  if (child == 0) {
    close(descriptors[0]);
    if (dup2(descriptors[1], STDOUT_FILENO) < 0) _exit(126);
    close(descriptors[1]);
    execv(arguments[0], arguments);
    _exit(127);
  }
  close(descriptors[1]);
  size_t total = 0;
  for (;;) {
    if (total == output_capacity) {
      uint8_t extra;
      ssize_t count = read(descriptors[0], &extra, 1);
      close(descriptors[0]);
      waitpid(child, NULL, 0);
      return count == 0 ? 0 : -EOVERFLOW;
    }
    ssize_t count = read(descriptors[0], output + total, output_capacity - total);
    if (count < 0) {
      int32_t status = -errno;
      close(descriptors[0]);
      waitpid(child, NULL, 0);
      return status;
    }
    if (count == 0) break;
    total += (size_t)count;
  }
  close(descriptors[0]);
  int child_status = 0;
  if (waitpid(child, &child_status, 0) < 0) return -errno;
  if (!WIFEXITED(child_status) || WEXITSTATUS(child_status) != 0) return -EIO;
  *output_len = total;
  return 0;
}

int32_t wasmc_boundary_v1_invoke(
    const uint8_t *input, size_t input_len,
    uint8_t *output, size_t output_capacity, size_t *output_len) {
  if (!input || !output || !output_len || input_len != 1 || input[0] != 1) return -EINVAL;
  *output_len = 0;
  char *const arguments[] = {"/system/bin/screencap", "-p", NULL};
  return capture(arguments, output, output_capacity, output_len);
}
