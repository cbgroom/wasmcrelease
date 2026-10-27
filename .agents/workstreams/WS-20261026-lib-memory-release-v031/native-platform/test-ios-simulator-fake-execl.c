#include <errno.h>
#include <fcntl.h>
#include <stdarg.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
int fixture_execl(const char *path,const char *arg0,...){(void)path;(void)arg0;va_list ap;va_start(ap,arg0);const char *v,*last=0;while((v=va_arg(ap,const char *))!=0)last=v;va_end(ap);if(!last)_exit(3);int fd=open(last,O_WRONLY|O_TRUNC);if(fd<0)_exit(4);const uint8_t sig[8]={137,80,78,71,13,10,26,10};if(write(fd,sig,8)!=8)_exit(5);uint8_t block[8192];memset(block,'p',sizeof block);size_t left=17*1024*1024+1-8;while(left){size_t n=left<sizeof block?left:sizeof block;ssize_t w=write(fd,block,n);if(w<0){if(errno==EINTR)continue;_exit(6);}left-=(size_t)w;}close(fd);const char *log=getenv("WASMC_TEST_INVOCATION_LOG");if(log){fd=open(log,O_WRONLY|O_CREAT|O_APPEND,0600);if(fd>=0){write(fd,"x",1);close(fd);}}_exit(0);}
