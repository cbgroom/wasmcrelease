#define _GNU_SOURCE

#include <errno.h>
#include <fcntl.h>
#include <linux/input.h>
#include <linux/uinput.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <unistd.h>

#define MAX_KEYBOARDS 16
#define MAX_KEYS 64

struct keyboard_slot {
  int descriptor;
  uint32_t generation;
  uint8_t active;
};

static struct keyboard_slot keyboards[MAX_KEYBOARDS];

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

static void write_u64(uint8_t *bytes, uint64_t value) {
  for (size_t index = 0; index < 8; index += 1) bytes[index] = (uint8_t)(value >> (index * 8));
}

static int32_t register_keyboard(int descriptor, uint64_t *token) {
  for (uint32_t index = 0; index < MAX_KEYBOARDS; index += 1) {
    if (!keyboards[index].active) {
      keyboards[index].generation += 1;
      if (keyboards[index].generation == 0) keyboards[index].generation = 1;
      keyboards[index].descriptor = descriptor;
      keyboards[index].active = 1;
      *token = ((uint64_t)keyboards[index].generation << 32) | ((uint64_t)index + 1);
      return 0;
    }
  }
  return -EMFILE;
}

static int32_t resolve_keyboard(uint64_t token, uint32_t *index, int *descriptor) {
  const uint32_t encoded_index = (uint32_t)token;
  const uint32_t generation = (uint32_t)(token >> 32);
  if (encoded_index == 0 || encoded_index > MAX_KEYBOARDS || generation == 0) return -EBADF;
  const uint32_t slot = encoded_index - 1;
  if (!keyboards[slot].active || keyboards[slot].generation != generation) return -EBADF;
  if (index) *index = slot;
  *descriptor = keyboards[slot].descriptor;
  return 0;
}

static int32_t invoke_create(
    const uint8_t *input, size_t input_len,
    uint8_t *output, size_t output_capacity, size_t *output_len) {
  if (input_len < 5 || output_capacity < 8) return -EINVAL;
  const uint16_t name_len = read_u16(input + 1);
  const uint16_t key_count = read_u16(input + 3);
  if (name_len == 0 || name_len >= UINPUT_MAX_NAME_SIZE || key_count == 0 || key_count > MAX_KEYS) {
    return -EINVAL;
  }
  if (input_len != 5u + (size_t)name_len + (size_t)key_count * 2u) return -EINVAL;

  int descriptor = open("/dev/uinput", O_WRONLY | O_NONBLOCK | O_CLOEXEC);
  if (descriptor < 0) return -errno;
  int32_t status = 0;
  if (ioctl(descriptor, UI_SET_EVBIT, EV_KEY) != 0 ||
      ioctl(descriptor, UI_SET_EVBIT, EV_SYN) != 0) {
    status = -errno;
    close(descriptor);
    return status;
  }
  for (uint16_t index = 0; index < key_count; index += 1) {
    const uint16_t code = read_u16(input + 5 + name_len + (size_t)index * 2u);
    if (code > KEY_MAX || ioctl(descriptor, UI_SET_KEYBIT, code) != 0) {
      status = code > KEY_MAX ? -EINVAL : -errno;
      close(descriptor);
      return status;
    }
  }

  struct uinput_setup setup;
  memset(&setup, 0, sizeof(setup));
  memcpy(setup.name, input + 5, name_len);
  setup.id.bustype = BUS_VIRTUAL;
  setup.id.vendor = 0x5753;
  setup.id.product = 0x0001;
  setup.id.version = 1;
  if (ioctl(descriptor, UI_DEV_SETUP, &setup) != 0 || ioctl(descriptor, UI_DEV_CREATE) != 0) {
    status = -errno;
    close(descriptor);
    return status;
  }

  uint64_t token = 0;
  status = register_keyboard(descriptor, &token);
  if (status != 0) {
    ioctl(descriptor, UI_DEV_DESTROY);
    close(descriptor);
    return status;
  }
  write_u64(output, token);
  *output_len = 8;
  return 0;
}

static int32_t invoke_emit(
    const uint8_t *input, size_t input_len,
    uint8_t *output, size_t output_capacity, size_t *output_len) {
  if (input_len != 15 || output_capacity < 8) return -EINVAL;
  int descriptor = -1;
  int32_t status = resolve_keyboard(read_u64(input + 1), NULL, &descriptor);
  if (status != 0) return status;
  const uint16_t code = read_u16(input + 9);
  if (code > KEY_MAX) return -EINVAL;
  struct input_event events[2];
  memset(events, 0, sizeof(events));
  events[0].type = EV_KEY;
  events[0].code = code;
  events[0].value = (int32_t)read_u32(input + 11);
  events[1].type = EV_SYN;
  events[1].code = SYN_REPORT;
  const ssize_t written = write(descriptor, events, sizeof(events));
  if (written < 0) return -errno;
  if ((size_t)written != sizeof(events)) return -EIO;
  write_u64(output, 2);
  *output_len = 8;
  return 0;
}

static int32_t invoke_destroy(
    const uint8_t *input, size_t input_len,
    size_t output_capacity, size_t *output_len) {
  (void)output_capacity;
  if (input_len != 9) return -EINVAL;
  uint32_t index = 0;
  int descriptor = -1;
  int32_t status = resolve_keyboard(read_u64(input + 1), &index, &descriptor);
  if (status != 0) return status;
  if (ioctl(descriptor, UI_DEV_DESTROY) != 0) status = -errno;
  if (close(descriptor) != 0 && status == 0) status = -errno;
  keyboards[index].active = 0;
  keyboards[index].descriptor = -1;
  *output_len = 0;
  return status;
}

static int32_t invoke_emit_batch(
    const uint8_t *input, size_t input_len,
    uint8_t *output, size_t output_capacity, size_t *output_len) {
  if (input_len < 11 || output_capacity < 8) return -EINVAL;
  int descriptor = -1;
  int32_t status = resolve_keyboard(read_u64(input + 1), NULL, &descriptor);
  if (status != 0) return status;
  const uint16_t count = read_u16(input + 9);
  if (count == 0 || count > 512 || input_len != 11u + (size_t)count * 6u) return -EINVAL;
  struct input_event *events = calloc((size_t)count * 2u, sizeof(*events));
  if (!events) return -ENOMEM;
  for (uint16_t index = 0; index < count; index += 1) {
    const size_t input_offset = 11u + (size_t)index * 6u;
    const uint16_t code = read_u16(input + input_offset);
    if (code > KEY_MAX) {
      free(events);
      return -EINVAL;
    }
    events[(size_t)index * 2u].type = EV_KEY;
    events[(size_t)index * 2u].code = code;
    events[(size_t)index * 2u].value = (int32_t)read_u32(input + input_offset + 2u);
    events[(size_t)index * 2u + 1u].type = EV_SYN;
    events[(size_t)index * 2u + 1u].code = SYN_REPORT;
  }
  const size_t byte_length = (size_t)count * 2u * sizeof(*events);
  const ssize_t written = write(descriptor, events, byte_length);
  free(events);
  if (written < 0) return -errno;
  if ((size_t)written != byte_length) return -EIO;
  write_u64(output, (uint64_t)count * 2u);
  *output_len = 8;
  return 0;
}

__attribute__((destructor)) static void close_keyboards(void) {
  for (size_t index = 0; index < MAX_KEYBOARDS; index += 1) {
    if (keyboards[index].active) {
      ioctl(keyboards[index].descriptor, UI_DEV_DESTROY);
      close(keyboards[index].descriptor);
      keyboards[index].active = 0;
    }
  }
}

int32_t wasmc_boundary_v1_invoke(
    const uint8_t *input, size_t input_len,
    uint8_t *output, size_t output_capacity, size_t *output_len) {
  if (!input || !output || !output_len || input_len == 0) return -EINVAL;
  *output_len = 0;
  switch (input[0]) {
    case 1:
      return invoke_create(input, input_len, output, output_capacity, output_len);
    case 2:
      return invoke_emit(input, input_len, output, output_capacity, output_len);
    case 3:
      return invoke_destroy(input, input_len, output_capacity, output_len);
    case 4:
      return invoke_emit_batch(input, input_len, output, output_capacity, output_len);
    default:
      return -EINVAL;
  }
}
