#define _GNU_SOURCE
#include "linux-endpoint/platform/native-adapter.c"
#include <assert.h>
#include <stdio.h>
static uint64_t dispatch_token(uint8_t *request, size_t count) {
  uint8_t output[16]; size_t length;
  assert(wasmc_boundary_v1_invoke(request, count, output, sizeof(output), &length) == 0);
  assert(length == 8); return read_u64(output);
}
static void dispatch_unit(uint8_t operation, uint64_t token) {
  uint8_t request[9] = {operation}, output[16]; size_t length;
  write_u64(request + 1, token);
  assert(wasmc_boundary_v1_invoke(request, sizeof(request), output, sizeof(output), &length) == 0);
}
static uint64_t start_readiness(uint64_t token, uint16_t events, uint32_t timeout) {
  uint8_t request[15] = {19};write_u64(request + 1, token);write_u16(request + 9, events);write_u32(request + 11, timeout);
  return dispatch_token(request, sizeof(request));
}
static void wait_readiness(uint64_t token, uint8_t expected) {
  uint8_t request[9] = {20}, output[7]; size_t length;write_u64(request + 1, token);
  for (size_t i = 0; i < 5000; i++) {
    assert(wasmc_boundary_v1_invoke(request, sizeof(request), output, sizeof(output), &length) == 0);
    assert(length == 7);
    if (output[0] != READINESS_PENDING) { assert(output[0] == expected); return; }
    usleep(1000);
  }
  assert(!"readiness fixture exceeded its five-second observation window");
}
int main(void) {
  enum { HANDLES = 4096, MAPPINGS = 2048, OPERATIONS = 1100 };
  uint64_t handles_test[HANDLES], mappings_test[MAPPINGS], operations_test[OPERATIONS];
  const int base = open("/dev/null", O_RDONLY | O_CLOEXEC); assert(base >= 0);
  for (size_t i = 0; i < HANDLES; i++) { int fd = dup(base); assert(fd >= 0); assert(register_handle(fd, &handles_test[i]) == 0); }
  for (size_t i = 0; i < HANDLES; i++) dispatch_unit(6, handles_test[i]);
  close(base);
  for (size_t i = 0; i < MAPPINGS; i++) {void *p=mmap(NULL,4096,PROT_READ|PROT_WRITE,MAP_PRIVATE|MAP_ANONYMOUS,-1,0);assert(p!=MAP_FAILED);assert(register_mapping(p,4096,&mappings_test[i])==0);}
  for (size_t i = 0; i < MAPPINGS; i++) dispatch_unit(13,mappings_test[i]);
  const int backing=memfd_create("wasmc-memory-capacity",MFD_CLOEXEC);assert(backing>=0);
  const uint64_t length=UINT64_C(300)*1024*1024;assert(ftruncate(backing,(off_t)length)==0);
  uint64_t backing_token;assert(register_handle(backing,&backing_token)==0);
  uint8_t map_request[33]={9};write_u64(map_request+1,backing_token);write_u64(map_request+17,length);write_u32(map_request+25,PROT_READ|PROT_WRITE);write_u32(map_request+29,MAP_SHARED);
  const uint64_t mapping=dispatch_token(map_request,sizeof(map_request));
  uint8_t write_request[22]={11};write_u64(write_request+1,mapping);write_u64(write_request+9,length-1);write_u32(write_request+17,1);write_request[21]=77;
  assert(dispatch_token(write_request,sizeof(write_request))==1);
  uint8_t read_request[21]={10},output[16];size_t output_len;write_u64(read_request+1,mapping);write_u64(read_request+9,length-1);write_u32(read_request+17,1);
  assert(wasmc_boundary_v1_invoke(read_request,sizeof(read_request),output,sizeof(output),&output_len)==0&&output_len==1&&output[0]==77);
  dispatch_unit(13,mapping);dispatch_unit(6,backing_token);
  int pipes[2];assert(pipe2(pipes,O_CLOEXEC)==0);uint64_t reader,writer;assert(register_handle(pipes[0],&reader)==0);assert(register_handle(pipes[1],&writer)==0);
  const uint64_t pending=start_readiness(reader,POLLIN,UINT32_MAX);
  struct readiness_slot *stable=readiness_operations[0];
  for (size_t i=0;i<OPERATIONS;i++){operations_test[i]=start_readiness(writer,POLLOUT,0);wait_readiness(operations_test[i],READINESS_READY);}
  assert(readiness_capacity>1024&&readiness_operations[0]==stable);
  dispatch_unit(21,pending);wait_readiness(pending,READINESS_CANCELLED);
  for(size_t i=0;i<OPERATIONS;i++)dispatch_unit(22,operations_test[i]);
  dispatch_unit(22,pending);
  dispatch_unit(6,reader);dispatch_unit(6,writer);
  const long iov=sysconf(_SC_IOV_MAX);assert(iov>0);
  close_retained_handles();assert(handles==NULL&&mappings==NULL&&readiness_operations==NULL);
  printf("{\"accepted\":true,\"fixture\":\"endpoint\",\"handles\":4096,\"mappings\":2048,\"large_mapping_bytes\":%llu,\"retained_completed_operations\":1100,\"pending_worker_address_stable\":true,\"kernel_iov_max\":%ld,\"cleanup\":true}\n",(unsigned long long)length,iov);
}
