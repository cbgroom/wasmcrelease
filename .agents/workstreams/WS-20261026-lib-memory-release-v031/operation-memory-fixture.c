#include <errno.h>
#include <pthread.h>
#include <stdatomic.h>
#include <stddef.h>
#include <stdint.h>
#include <string.h>
static pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t changed = PTHREAD_COND_INITIALIZER;
static int released;
static _Atomic uint32_t invocations;
int32_t wasmc_boundary_v1_invoke(const uint8_t *input, size_t input_len, uint8_t *output, size_t capacity, size_t *output_len) {
  if (!input || input_len == 0 || !output || !output_len) return -EINVAL;
  *output_len=0;atomic_fetch_add(&invocations,1);
  if (input[0]==1) {
    pthread_mutex_lock(&lock);while (!released) pthread_cond_wait(&changed,&lock);pthread_mutex_unlock(&lock);
    return 0;
  }
  if (input[0]==2) {pthread_mutex_lock(&lock);released=1;pthread_cond_broadcast(&changed);pthread_mutex_unlock(&lock);return 0;}
  if (input[0]==3) {if(input_len-1>capacity)return -EINVAL;memcpy(output,input+1,input_len-1);*output_len=input_len-1;return 0;}
  if (input[0]==4) {if(capacity<4)return -EINVAL;uint32_t n=atomic_load(&invocations);memcpy(output,&n,4);*output_len=4;return 0;}
  if (input[0]==5) {pthread_mutex_lock(&lock);released=0;pthread_mutex_unlock(&lock);return 0;}
  return -EINVAL;
}
