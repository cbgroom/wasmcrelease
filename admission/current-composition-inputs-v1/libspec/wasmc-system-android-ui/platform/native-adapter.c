#include <errno.h>
#include <fcntl.h>
#include <stdint.h>
#include <stdlib.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

static const char *snapshot_path = "/data/local/tmp/wasmc-agent-ui.xml";

static int32_t wait_child(pid_t child) {
  int child_status = 0;
  if (waitpid(child, &child_status, 0) < 0) return -errno;
  if (!WIFEXITED(child_status) || WEXITSTATUS(child_status) != 0) return -EIO;
  return 0;
}

static int32_t run_quiet(char *const arguments[]) {
  pid_t child = fork();
  if (child < 0) return -errno;
  if (child == 0) {
    int null_descriptor = open("/dev/null", O_WRONLY | O_CLOEXEC);
    if (null_descriptor < 0) _exit(126);
    if (dup2(null_descriptor, STDOUT_FILENO) < 0 ||
        dup2(null_descriptor, STDERR_FILENO) < 0) _exit(126);
    close(null_descriptor);
    execv(arguments[0], arguments);
    _exit(127);
  }
  return wait_child(child);
}

static int32_t read_file(uint8_t *output, size_t output_capacity, size_t *output_len) {
  int descriptor = -1;
  for (size_t attempt = 0; attempt < 50; attempt += 1) {
    descriptor = open(snapshot_path, O_RDONLY | O_CLOEXEC);
    if (descriptor >= 0) break;
    if (errno != ENOENT) return -errno;
    usleep(100000);
  }
  if (descriptor < 0) return -ENOENT;
  size_t total = 0;
  for (;;) {
    if (total == output_capacity) {
      uint8_t extra;
      ssize_t count = read(descriptor, &extra, 1);
      close(descriptor);
      unlink(snapshot_path);
      return count == 0 ? 0 : -EOVERFLOW;
    }
    ssize_t count = read(descriptor, output + total, output_capacity - total);
    if (count < 0) {
      int32_t status = -errno;
      close(descriptor);
      unlink(snapshot_path);
      return status;
    }
    if (count == 0) break;
    total += (size_t)count;
  }
  close(descriptor);
  unlink(snapshot_path);
  *output_len = total;
  return 0;
}

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
  while (total < output_capacity) {
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
  uint8_t extra;
  ssize_t overflow = total == output_capacity ? read(descriptors[0], &extra, 1) : 0;
  close(descriptors[0]);
  int32_t status = wait_child(child);
  if (status != 0) return status;
  if (overflow > 0) return -EOVERFLOW;
  *output_len = total;
  return 0;
}

int32_t wasmc_boundary_v1_invoke(
    const uint8_t *input, size_t input_len,
    uint8_t *output, size_t output_capacity, size_t *output_len) {
  if (!input || !output || !output_len || input_len != 1) return -EINVAL;
  *output_len = 0;
  if (input[0] == 1) {
    char *const arguments[] = {
        "/system/bin/uiautomator", "dump", (char *)snapshot_path, NULL};
    int32_t status = run_quiet(arguments);
    return status == 0 ? read_file(output, output_capacity, output_len) : status;
  }
  if (input[0] == 2) {
    char *const arguments[] = {"/system/bin/dumpsys", "window", "windows", NULL};
    return capture(arguments, output, output_capacity, output_len);
  }
  return -EINVAL;
}
