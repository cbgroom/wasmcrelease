#include <errno.h>
#include <string.h>
#include <unistd.h>
#include <stdint.h>
int fixture_execv(const char *path,char *const argv[]){(void)argv;uint8_t b[8192];memset(b,strstr(path,"screencap")?'p':'u',sizeof b);size_t left=9*1024*1024+1;while(left){size_t n=left<sizeof b?left:sizeof b;ssize_t w=write(STDOUT_FILENO,b,n);if(w<0){if(errno==EINTR)continue;_exit(3);}left-=(size_t)w;}_exit(0);}
