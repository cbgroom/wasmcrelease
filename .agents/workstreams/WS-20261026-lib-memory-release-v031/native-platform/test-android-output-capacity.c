#include <assert.h>
#include <errno.h>
#include <fcntl.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>
static size_t data_len, position, reads, invocations, waits;static int child_fail, fail_at_eof;
static int fake_pipe(int fd[2]){fd[0]=41;fd[1]=42;return 0;}
static pid_t fake_fork(void){invocations++;return 123;}
static int fake_close(int fd){(void)fd;return 0;}
static pid_t fake_waitpid(pid_t p,int *status,int flags){(void)flags;waits++;if(status)*status=child_fail?256:0;return p;}
static ssize_t fake_read(int fd,void *p,size_t n){(void)fd;reads++;if(position==data_len&&fail_at_eof){errno=EIO;return -1;}size_t remaining=data_len-position;if(n>remaining)n=remaining;memset(p,'x',n);position+=n;return (ssize_t)n;}
static int fake_open(const char *path,int flags,...){(void)path;(void)flags;return 43;}
static int fake_unlink(const char *path){(void)path;return 0;}
static int fake_usleep(useconds_t n){(void)n;return 0;}
#define pipe fake_pipe
#define fork fake_fork
#define close fake_close
#define waitpid fake_waitpid
#define read fake_read
#define open fake_open
#define unlink fake_unlink
#define usleep fake_usleep
#if defined(DISPLAY)
#if defined(OLD)
#include "../../../../current-libs/wasmc-system-android-display/0.0.1/platform/native-adapter.c"
#else
#include "android-display/platform/native-adapter.c"
#endif
#else
#if defined(OLD)
#include "../../../../current-libs/wasmc-system-android-ui/0.0.1/platform/native-adapter.c"
#else
#include "android-ui/platform/native-adapter.c"
#endif
#endif
static void reset(size_t n,int fail,int read_fail){data_len=n;position=reads=invocations=waits=0;child_fail=fail;fail_at_eof=read_fail;}
static int32_t run(uint8_t op,size_t capacity,size_t *out){uint8_t *buffer=malloc(capacity?capacity:1);assert(buffer);int32_t r=wasmc_boundary_v1_invoke(&op,1,buffer,capacity,out);for(size_t i=0;i<position&&i<capacity;i++)assert(buffer[i]=='x');free(buffer);return r;}
int main(void){size_t n=999;reset(4,0,0);assert(run(1,4,&n)==0);
#if defined(OLD)
assert(n==0);
#if defined(DISPLAY)
reset(4,1,0);assert(run(1,4,&n)==0&&n==0);
#endif
printf("{\"old_exact_capacity_output_length\":%zu,\"expected\":4}\n",n);return 0;
#else
assert(n==4);assert(invocations==1);reset(0,0,0);assert(run(1,0,&n)==0&&n==0);reset(3,0,0);assert(run(1,4,&n)==0&&n==3);reset(5,0,0);assert(run(1,4,&n)==-EOVERFLOW&&n==0);assert(invocations==1);reset(9*1024*1024+1,0,0);assert(run(1,data_len,&n)==0&&n==data_len);assert(invocations==1);reset(4,1,0);assert(run(1,4,&n)==-EIO&&n==0);reset(4,0,1);assert(run(1,4,&n)==-EIO&&n==0);
#if !defined(DISPLAY)
reset(4,0,0);assert(run(2,4,&n)==0&&n==4);reset(5,0,0);assert(run(2,4,&n)==-EOVERFLOW&&n==0);reset(4,1,0);assert(run(2,4,&n)==-EIO&&n==0);reset(4,0,1);assert(run(2,4,&n)==-EIO&&n==0);
#endif
printf("{\"accepted\":true,\"exact_capacity\":4,\"large_bytes\":9437185,\"fresh_calls\":true,\"mocked_host\":true,\"android_device\":false}\n");return 0;
#endif
}
