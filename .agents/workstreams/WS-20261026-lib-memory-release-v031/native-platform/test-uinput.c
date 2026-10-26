#define _GNU_SOURCE
#include <assert.h>
#include <errno.h>
#include <fcntl.h>
#include <linux/input.h>
#include <linux/uinput.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <unistd.h>
/* No /dev/uinput effects: exercise the actual adapter parser/tables while the
 * kernel device boundary is an explicit fixture. This is not device proof. */
static size_t configured_keys;
static int fixture_open(const char *path, int flags, ...) {
  assert(strcmp(path,"/dev/uinput")==0);
  return open("/dev/null",flags);
}
static int fixture_ioctl(int descriptor, unsigned long operation, ...) {
  assert(descriptor>=0);
  if (operation==UI_SET_KEYBIT)configured_keys++;
  return 0;
}
#define open fixture_open
#define ioctl fixture_ioctl
#ifdef ANDROID_ADAPTER
#include "android-uinput/platform/native-adapter.c"
#else
#include "linux-uinput/platform/native-adapter.c"
#endif
#undef open
#undef ioctl
static void destroy_token(uint8_t operation,uint64_t token) {
  uint8_t input[9]={operation},output[8];size_t length;write_u64(input+1,token);
  assert(wasmc_boundary_v1_invoke(input,sizeof(input),output,sizeof(output),&length)==0);
}
int main(void) {
  enum {COUNT=256,KEYS=512};
  uint8_t request[6+KEYS*2]={1,1,0,0,2,'x'},output[8];size_t length;
  for(size_t i=0;i<KEYS;i++){request[6+i*2]=(uint8_t)i;request[7+i*2]=(uint8_t)(i>>8);}
  assert(wasmc_boundary_v1_invoke(request,sizeof(request),output,sizeof(output),&length)==0);
  assert(length==8&&configured_keys==KEYS);
  const uint64_t configured_token=read_u64(output);
  enum { EVENTS=2048 };
  uint8_t batch[11+EVENTS*6]={4};write_u64(batch+1,configured_token);batch[9]=(uint8_t)EVENTS;batch[10]=(uint8_t)(EVENTS>>8);
  for(size_t i=0;i<EVENTS;i++){batch[11+i*6]=30;batch[13+i*6]=(uint8_t)(i%2);}
  assert(wasmc_boundary_v1_invoke(batch,sizeof(batch),output,sizeof(output),&length)==0);
  assert(length==8&&read_u64(output)==EVENTS*2);
  destroy_token(3,configured_token);
  const int base=open("/dev/null",O_RDONLY|O_CLOEXEC);assert(base>=0);uint64_t tokens[COUNT];
  for(size_t i=0;i<COUNT;i++){int fd=dup(base);assert(fd>=0);assert(register_keyboard(fd,&tokens[i])==0);}
  for(size_t i=0;i<COUNT;i++){int fd=-1;assert(resolve_keyboard(tokens[i],NULL,&fd)==0&&fd>=0);destroy_token(3,tokens[i]);assert(resolve_keyboard(tokens[i],NULL,&fd)==-EBADF);}
#ifdef ANDROID_ADAPTER
  for(size_t i=0;i<COUNT;i++){int fd=dup(base);assert(fd>=0);assert(register_touchscreen(fd,640,480,&tokens[i])==0);}
  for(size_t i=0;i<COUNT;i++){int fd=-1;uint32_t width,height;assert(resolve_touchscreen(tokens[i],NULL,&fd,&width,&height)==0);assert(width==640&&height==480);destroy_token(7,tokens[i]);assert(resolve_touchscreen(tokens[i],NULL,&fd,NULL,NULL)==-EBADF);}
#endif
  close(base);close_keyboards();assert(keyboards==NULL&&keyboards_capacity==0);
#ifdef ANDROID_ADAPTER
  assert(touchscreens==NULL&&touchscreens_capacity==0);
  puts("{\"accepted\":true,\"adapter\":\"Android-uinput-source\",\"keyboards\":256,\"touchscreens\":256,\"configured_keys\":512,\"batch_events\":2048,\"kernel_boundary\":\"explicit fixture\",\"execution_host\":\"Linux\",\"Android_ABI_or_device_qualification\":false,\"cleanup\":true}");
#else
  puts("{\"accepted\":true,\"adapter\":\"Linux-uinput\",\"keyboards\":256,\"configured_keys\":512,\"batch_events\":2048,\"kernel_boundary\":\"explicit fixture\",\"device_qualification\":false,\"cleanup\":true}");
#endif
}
