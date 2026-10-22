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
#define MAX_TOUCHSCREENS 16
#define MAX_KEYS 64

struct keyboard_slot {
  int descriptor;
  uint32_t generation;
  uint32_t width;
  uint32_t height;
  uint8_t active;
};

static struct keyboard_slot keyboards[MAX_KEYBOARDS];
static struct keyboard_slot touchscreens[MAX_TOUCHSCREENS];

static uint16_t read_u16(const uint8_t *bytes) {
  return (uint16_t)bytes[0] | ((uint16_t)bytes[1] << 8);
}

static uint32_t read_u32(const uint8_t *bytes) {
  return (uint32_t)bytes[0] | ((uint32_t)bytes[1] << 8) |
         ((uint32_t)bytes[2] << 16) | ((uint32_t)bytes[3] << 24);
}

static uint64_t read_u64(const uint8_t *bytes) {
  uint64_t value = 0;
  for (size_t index = 0; index < 8; index += 1) {
    value |= (uint64_t)bytes[index] << (index * 8);
  }
  return value;
}

static void write_u64(uint8_t *bytes, uint64_t value) {
  for (size_t index = 0; index < 8; index += 1) {
    bytes[index] = (uint8_t)(value >> (index * 8));
  }
}

static int32_t register_keyboard(int descriptor, uint64_t *token) {
  for (uint32_t index = 0; index < MAX_KEYBOARDS; index += 1) {
    if (!keyboards[index].active) {
      keyboards[index].generation += 1;
      if (keyboards[index].generation == 0)
        keyboards[index].generation = 1;
      keyboards[index].descriptor = descriptor;
      keyboards[index].active = 1;
      *token =
          ((uint64_t)keyboards[index].generation << 32) | ((uint64_t)index + 1);
      return 0;
    }
  }
  return -EMFILE;
}

static int32_t resolve_keyboard(uint64_t token, uint32_t *index,
                                int *descriptor) {
  const uint32_t encoded_index = (uint32_t)token;
  const uint32_t generation = (uint32_t)(token >> 32);
  if (encoded_index == 0 || encoded_index > MAX_KEYBOARDS || generation == 0) {
    return -EBADF;
  }
  const uint32_t slot = encoded_index - 1;
  if (!keyboards[slot].active || keyboards[slot].generation != generation) {
    return -EBADF;
  }
  if (index)
    *index = slot;
  *descriptor = keyboards[slot].descriptor;
  return 0;
}

static int32_t register_touchscreen(int descriptor, uint32_t width,
                                    uint32_t height, uint64_t *token) {
  for (uint32_t index = 0; index < MAX_TOUCHSCREENS; index += 1) {
    if (!touchscreens[index].active) {
      touchscreens[index].generation += 1;
      if (touchscreens[index].generation == 0) {
        touchscreens[index].generation = 1;
      }
      touchscreens[index].descriptor = descriptor;
      touchscreens[index].width = width;
      touchscreens[index].height = height;
      touchscreens[index].active = 1;
      *token = ((uint64_t)touchscreens[index].generation << 32) |
               ((uint64_t)index + 1);
      return 0;
    }
  }
  return -EMFILE;
}

static int32_t resolve_touchscreen(uint64_t token, uint32_t *index,
                                   int *descriptor, uint32_t *width,
                                   uint32_t *height) {
  const uint32_t encoded_index = (uint32_t)token;
  const uint32_t generation = (uint32_t)(token >> 32);
  if (encoded_index == 0 || encoded_index > MAX_TOUCHSCREENS ||
      generation == 0) {
    return -EBADF;
  }
  const uint32_t slot = encoded_index - 1;
  if (!touchscreens[slot].active ||
      touchscreens[slot].generation != generation) {
    return -EBADF;
  }
  if (index)
    *index = slot;
  *descriptor = touchscreens[slot].descriptor;
  if (width)
    *width = touchscreens[slot].width;
  if (height)
    *height = touchscreens[slot].height;
  return 0;
}

static int32_t configure_absolute_axis(int descriptor, uint16_t code,
                                       int32_t maximum) {
  struct uinput_abs_setup setup;
  memset(&setup, 0, sizeof(setup));
  setup.code = code;
  setup.absinfo.minimum = 0;
  setup.absinfo.maximum = maximum;
  return ioctl(descriptor, UI_ABS_SETUP, &setup) == 0 ? 0 : -errno;
}

static int32_t create_keyboard(const uint8_t *input, size_t input_len,
                               uint8_t *output, size_t output_capacity,
                               size_t *output_len) {
  if (input_len < 5 || output_capacity < 8)
    return -EINVAL;
  const uint16_t name_len = read_u16(input + 1);
  const uint16_t key_count = read_u16(input + 3);
  if (name_len == 0 || name_len >= UINPUT_MAX_NAME_SIZE || key_count == 0 ||
      key_count > MAX_KEYS ||
      input_len != 5u + (size_t)name_len + (size_t)key_count * 2u) {
    return -EINVAL;
  }

  int descriptor = open("/dev/uinput", O_WRONLY | O_NONBLOCK | O_CLOEXEC);
  if (descriptor < 0)
    return -errno;
  if (ioctl(descriptor, UI_SET_EVBIT, EV_KEY) != 0 ||
      ioctl(descriptor, UI_SET_EVBIT, EV_SYN) != 0) {
    int32_t status = -errno;
    close(descriptor);
    return status;
  }
  for (uint16_t index = 0; index < key_count; index += 1) {
    const uint16_t code = read_u16(input + 5 + name_len + (size_t)index * 2u);
    if (code > KEY_MAX || ioctl(descriptor, UI_SET_KEYBIT, code) != 0) {
      int32_t status = code > KEY_MAX ? -EINVAL : -errno;
      close(descriptor);
      return status;
    }
  }

  struct uinput_setup setup;
  memset(&setup, 0, sizeof(setup));
  memcpy(setup.name, input + 5, name_len);
  setup.id.bustype = BUS_VIRTUAL;
  setup.id.vendor = 0x5753;
  setup.id.product = 0x0002;
  setup.id.version = 1;
  if (ioctl(descriptor, UI_DEV_SETUP, &setup) != 0 ||
      ioctl(descriptor, UI_DEV_CREATE) != 0) {
    int32_t status = -errno;
    close(descriptor);
    return status;
  }

  uint64_t token = 0;
  int32_t status = register_keyboard(descriptor, &token);
  if (status != 0) {
    ioctl(descriptor, UI_DEV_DESTROY);
    close(descriptor);
    return status;
  }
  write_u64(output, token);
  *output_len = 8;
  return 0;
}

static int32_t emit_keys(const uint8_t *input, size_t input_len,
                         uint8_t *output, size_t output_capacity,
                         size_t *output_len) {
  if (input_len < 11 || output_capacity < 8)
    return -EINVAL;
  int descriptor = -1;
  int32_t status = resolve_keyboard(read_u64(input + 1), NULL, &descriptor);
  if (status != 0)
    return status;
  const uint16_t count = read_u16(input + 9);
  if (count == 0 || count > 512 || input_len != 11u + (size_t)count * 6u) {
    return -EINVAL;
  }

  struct input_event *events = calloc((size_t)count * 2u, sizeof(*events));
  if (!events)
    return -ENOMEM;
  for (uint16_t index = 0; index < count; index += 1) {
    const size_t offset = 11u + (size_t)index * 6u;
    const uint16_t code = read_u16(input + offset);
    if (code > KEY_MAX) {
      free(events);
      return -EINVAL;
    }
    events[(size_t)index * 2u].type = EV_KEY;
    events[(size_t)index * 2u].code = code;
    events[(size_t)index * 2u].value = (int32_t)read_u32(input + offset + 2u);
    events[(size_t)index * 2u + 1u].type = EV_SYN;
    events[(size_t)index * 2u + 1u].code = SYN_REPORT;
  }
  const size_t byte_length = (size_t)count * 2u * sizeof(*events);
  const ssize_t written = write(descriptor, events, byte_length);
  free(events);
  if (written < 0)
    return -errno;
  if ((size_t)written != byte_length)
    return -EIO;
  write_u64(output, (uint64_t)count * 2u);
  *output_len = 8;
  return 0;
}

static int32_t emit_key(const uint8_t *input, size_t input_len, uint8_t *output,
                        size_t output_capacity, size_t *output_len) {
  if (input_len != 15 || output_capacity < 8)
    return -EINVAL;
  int descriptor = -1;
  int32_t status = resolve_keyboard(read_u64(input + 1), NULL, &descriptor);
  if (status != 0)
    return status;
  const uint16_t code = read_u16(input + 9);
  if (code > KEY_MAX)
    return -EINVAL;
  struct input_event events[2];
  memset(events, 0, sizeof(events));
  events[0].type = EV_KEY;
  events[0].code = code;
  events[0].value = (int32_t)read_u32(input + 11);
  events[1].type = EV_SYN;
  events[1].code = SYN_REPORT;
  const ssize_t written = write(descriptor, events, sizeof(events));
  if (written < 0)
    return -errno;
  if ((size_t)written != sizeof(events))
    return -EIO;
  write_u64(output, 2);
  *output_len = 8;
  return 0;
}

static int32_t destroy_keyboard(const uint8_t *input, size_t input_len,
                                size_t *output_len) {
  if (input_len != 9)
    return -EINVAL;
  uint32_t index = 0;
  int descriptor = -1;
  int32_t status = resolve_keyboard(read_u64(input + 1), &index, &descriptor);
  if (status != 0)
    return status;
  if (ioctl(descriptor, UI_DEV_DESTROY) != 0)
    status = -errno;
  if (close(descriptor) != 0 && status == 0)
    status = -errno;
  keyboards[index].active = 0;
  keyboards[index].descriptor = -1;
  *output_len = 0;
  return status;
}

static int32_t create_touchscreen(const uint8_t *input, size_t input_len,
                                  uint8_t *output, size_t output_capacity,
                                  size_t *output_len) {
  if (input_len < 11 || output_capacity < 8)
    return -EINVAL;
  const uint16_t name_len = read_u16(input + 1);
  const uint32_t width = read_u32(input + 3);
  const uint32_t height = read_u32(input + 7);
  if (name_len == 0 || name_len >= UINPUT_MAX_NAME_SIZE || width == 0 ||
      height == 0 || width > INT32_MAX || height > INT32_MAX ||
      input_len != 11u + (size_t)name_len) {
    return -EINVAL;
  }

  int descriptor = open("/dev/uinput", O_WRONLY | O_NONBLOCK | O_CLOEXEC);
  if (descriptor < 0)
    return -errno;
  if (ioctl(descriptor, UI_SET_EVBIT, EV_SYN) != 0 ||
      ioctl(descriptor, UI_SET_EVBIT, EV_KEY) != 0 ||
      ioctl(descriptor, UI_SET_EVBIT, EV_ABS) != 0 ||
      ioctl(descriptor, UI_SET_KEYBIT, BTN_TOUCH) != 0 ||
      ioctl(descriptor, UI_SET_KEYBIT, BTN_TOOL_FINGER) != 0 ||
      ioctl(descriptor, UI_SET_PROPBIT, INPUT_PROP_DIRECT) != 0) {
    int32_t status = -errno;
    close(descriptor);
    return status;
  }

  int32_t status =
      configure_absolute_axis(descriptor, ABS_X, (int32_t)width - 1);
  if (status == 0) {
    status = configure_absolute_axis(descriptor, ABS_Y, (int32_t)height - 1);
  }
  if (status == 0)
    status = configure_absolute_axis(descriptor, ABS_MT_SLOT, 0);
  if (status == 0) {
    status = configure_absolute_axis(descriptor, ABS_MT_TRACKING_ID, 65535);
  }
  if (status == 0) {
    status = configure_absolute_axis(descriptor, ABS_MT_POSITION_X,
                                     (int32_t)width - 1);
  }
  if (status == 0) {
    status = configure_absolute_axis(descriptor, ABS_MT_POSITION_Y,
                                     (int32_t)height - 1);
  }
  if (status != 0) {
    close(descriptor);
    return status;
  }

  struct uinput_setup setup;
  memset(&setup, 0, sizeof(setup));
  memcpy(setup.name, input + 11, name_len);
  setup.id.bustype = BUS_VIRTUAL;
  setup.id.vendor = 0x5753;
  setup.id.product = 0x0003;
  setup.id.version = 1;
  if (ioctl(descriptor, UI_DEV_SETUP, &setup) != 0 ||
      ioctl(descriptor, UI_DEV_CREATE) != 0) {
    status = -errno;
    close(descriptor);
    return status;
  }

  uint64_t token = 0;
  status = register_touchscreen(descriptor, width, height, &token);
  if (status != 0) {
    ioctl(descriptor, UI_DEV_DESTROY);
    close(descriptor);
    return status;
  }
  write_u64(output, token);
  *output_len = 8;
  return 0;
}

static int32_t tap_touchscreen(const uint8_t *input, size_t input_len,
                               uint8_t *output, size_t output_capacity,
                               size_t *output_len) {
  if (input_len != 17 || output_capacity < 8)
    return -EINVAL;
  int descriptor = -1;
  uint32_t width = 0;
  uint32_t height = 0;
  int32_t status = resolve_touchscreen(read_u64(input + 1), NULL, &descriptor,
                                       &width, &height);
  if (status != 0)
    return status;
  const int32_t x = (int32_t)read_u32(input + 9);
  const int32_t y = (int32_t)read_u32(input + 13);
  if (x < 0 || y < 0 || (uint32_t)x >= width || (uint32_t)y >= height) {
    return -EINVAL;
  }

  struct input_event events[14];
  memset(events, 0, sizeof(events));
  events[0] =
      (struct input_event){.type = EV_ABS, .code = ABS_MT_SLOT, .value = 0};
  events[1] = (struct input_event){
      .type = EV_ABS, .code = ABS_MT_TRACKING_ID, .value = 1};
  events[2] = (struct input_event){
      .type = EV_ABS, .code = ABS_MT_POSITION_X, .value = x};
  events[3] = (struct input_event){
      .type = EV_ABS, .code = ABS_MT_POSITION_Y, .value = y};
  events[4] = (struct input_event){.type = EV_ABS, .code = ABS_X, .value = x};
  events[5] = (struct input_event){.type = EV_ABS, .code = ABS_Y, .value = y};
  events[6] =
      (struct input_event){.type = EV_KEY, .code = BTN_TOUCH, .value = 1};
  events[7] =
      (struct input_event){.type = EV_KEY, .code = BTN_TOOL_FINGER, .value = 1};
  events[8] = (struct input_event){.type = EV_SYN, .code = SYN_REPORT};
  events[9] =
      (struct input_event){.type = EV_ABS, .code = ABS_MT_SLOT, .value = 0};
  events[10] = (struct input_event){
      .type = EV_ABS, .code = ABS_MT_TRACKING_ID, .value = -1};
  events[11] =
      (struct input_event){.type = EV_KEY, .code = BTN_TOUCH, .value = 0};
  events[12] =
      (struct input_event){.type = EV_KEY, .code = BTN_TOOL_FINGER, .value = 0};
  events[13] = (struct input_event){.type = EV_SYN, .code = SYN_REPORT};
  const ssize_t written = write(descriptor, events, sizeof(events));
  if (written < 0)
    return -errno;
  if ((size_t)written != sizeof(events))
    return -EIO;
  write_u64(output, 14);
  *output_len = 8;
  return 0;
}

static int32_t destroy_touchscreen(const uint8_t *input, size_t input_len,
                                   size_t *output_len) {
  if (input_len != 9)
    return -EINVAL;
  uint32_t index = 0;
  int descriptor = -1;
  int32_t status =
      resolve_touchscreen(read_u64(input + 1), &index, &descriptor, NULL, NULL);
  if (status != 0)
    return status;
  if (ioctl(descriptor, UI_DEV_DESTROY) != 0)
    status = -errno;
  if (close(descriptor) != 0 && status == 0)
    status = -errno;
  touchscreens[index].active = 0;
  touchscreens[index].descriptor = -1;
  *output_len = 0;
  return status;
}

__attribute__((destructor)) static void close_keyboards(void) {
  for (size_t index = 0; index < MAX_KEYBOARDS; index += 1) {
    if (keyboards[index].active) {
      ioctl(keyboards[index].descriptor, UI_DEV_DESTROY);
      close(keyboards[index].descriptor);
      keyboards[index].active = 0;
    }
  }
  for (size_t index = 0; index < MAX_TOUCHSCREENS; index += 1) {
    if (touchscreens[index].active) {
      ioctl(touchscreens[index].descriptor, UI_DEV_DESTROY);
      close(touchscreens[index].descriptor);
      touchscreens[index].active = 0;
    }
  }
}

int32_t wasmc_boundary_v1_invoke(const uint8_t *input, size_t input_len,
                                 uint8_t *output, size_t output_capacity,
                                 size_t *output_len) {
  if (!input || !output || !output_len || input_len == 0)
    return -EINVAL;
  *output_len = 0;
  switch (input[0]) {
  case 1:
    return create_keyboard(input, input_len, output, output_capacity,
                           output_len);
  case 2:
    return emit_key(input, input_len, output, output_capacity, output_len);
  case 3:
    return destroy_keyboard(input, input_len, output_len);
  case 4:
    return emit_keys(input, input_len, output, output_capacity, output_len);
  case 5:
    return create_touchscreen(input, input_len, output, output_capacity,
                              output_len);
  case 6:
    return tap_touchscreen(input, input_len, output, output_capacity,
                           output_len);
  case 7:
    return destroy_touchscreen(input, input_len, output_len);
  default:
    return -EINVAL;
  }
}
