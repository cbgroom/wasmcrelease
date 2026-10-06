#include <errno.h>
#include <fcntl.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

static int valid_udid(const char *value) {
  if (value == NULL || strlen(value) != 36) return 0;
  for (size_t index = 0; index < 36; index += 1) {
    const char byte = value[index];
    const int hex = (byte >= '0' && byte <= '9') ||
                    (byte >= 'a' && byte <= 'f') ||
                    (byte >= 'A' && byte <= 'F');
    const int hyphen = index == 8 || index == 13 || index == 18 || index == 23;
    if ((hyphen && byte != '-') || (!hyphen && !hex)) return 0;
  }
  return 1;
}

int32_t wasmc_boundary_v1_invoke(const uint8_t *input, size_t input_len,
                                 uint8_t *output, size_t output_capacity,
                                 size_t *output_len) {
  (void)input;
  if (output == NULL || output_len == NULL) return -EINVAL;
  *output_len = 0;
  if (input_len != 0) return -EINVAL;

  const char *udid = getenv("WASMC_IOS_SIMULATOR_UDID");
  if (!valid_udid(udid)) return -EINVAL;

  char frame_path[] = "/tmp/wasmc-ios-frame-XXXXXX.png";
  const int frame_descriptor = mkstemps(frame_path, 4);
  if (frame_descriptor < 0) return -errno;
  close(frame_descriptor);
  const pid_t child = fork();
  if (child < 0) {
    const int status = -errno;
    unlink(frame_path);
    return status;
  }
  if (child == 0) {
    execl("/usr/bin/xcrun", "xcrun", "simctl", "io", udid, "screenshot",
          "--type=png", frame_path, (char *)NULL);
    _exit(127);
  }

  int child_status = 0;
  if (waitpid(child, &child_status, 0) < 0) {
    const int status = -errno;
    unlink(frame_path);
    return status;
  }
  if (!WIFEXITED(child_status) || WEXITSTATUS(child_status) != 0) {
    unlink(frame_path);
    return -EIO;
  }

  const int descriptor = open(frame_path, O_RDONLY | O_CLOEXEC);
  if (descriptor < 0) {
    const int status = -errno;
    unlink(frame_path);
    return status;
  }
  size_t total = 0;
  int overflow = 0;
  uint8_t discard[4096];
  for (;;) {
    uint8_t *destination = total < output_capacity ? output + total : discard;
    const size_t available = total < output_capacity ? output_capacity - total : sizeof(discard);
    const ssize_t count = read(descriptor, destination, available);
    if (count == 0) break;
    if (count < 0) {
      if (errno == EINTR) continue;
      const int status = -errno;
      close(descriptor);
      unlink(frame_path);
      return status;
    }
    if (total < output_capacity) total += (size_t)count;
    else overflow = 1;
  }
  close(descriptor);
  unlink(frame_path);
  if (overflow) return -EOVERFLOW;
  static const uint8_t png_signature[8] = {137, 80, 78, 71, 13, 10, 26, 10};
  if (total < sizeof(png_signature) ||
      memcmp(output, png_signature, sizeof(png_signature)) != 0) return -EBADMSG;
  *output_len = total;
  return 0;
}
