#include "NetworkAdapter.h"

#include <arpa/inet.h>
#include <errno.h>
#include <netinet/in.h>
#include <stdio.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>

static int tcp_probe(void) {
  const char payload[] = "wasmc-ios-tcp";
  int listener = socket(AF_INET, SOCK_STREAM, 0);
  if (listener < 0) return 0;
  struct sockaddr_in address = {.sin_family = AF_INET, .sin_port = 0};
  address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  socklen_t length = sizeof(address);
  if (bind(listener, (struct sockaddr *)&address, length) != 0 ||
      listen(listener, 1) != 0 ||
      getsockname(listener, (struct sockaddr *)&address, &length) != 0) {
    close(listener);
    return 0;
  }
  int client = socket(AF_INET, SOCK_STREAM, 0);
  if (client < 0 || connect(client, (struct sockaddr *)&address, length) != 0) {
    if (client >= 0) close(client);
    close(listener);
    return 0;
  }
  int server = accept(listener, NULL, NULL);
  char received[sizeof(payload)] = {0};
  const int accepted = server >= 0 &&
      send(client, payload, sizeof(payload), 0) == sizeof(payload) &&
      recv(server, received, sizeof(received), MSG_WAITALL) == sizeof(payload) &&
      memcmp(payload, received, sizeof(payload)) == 0;
  if (server >= 0) close(server);
  close(client);
  close(listener);
  return accepted;
}

static int udp_probe(void) {
  const char payload[] = "wasmc-ios-udp";
  int server = socket(AF_INET, SOCK_DGRAM, 0);
  if (server < 0) return 0;
  struct sockaddr_in address = {.sin_family = AF_INET, .sin_port = 0};
  address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  socklen_t length = sizeof(address);
  if (bind(server, (struct sockaddr *)&address, length) != 0 ||
      getsockname(server, (struct sockaddr *)&address, &length) != 0) {
    close(server);
    return 0;
  }
  int client = socket(AF_INET, SOCK_DGRAM, 0);
  char received[sizeof(payload)] = {0};
  const int accepted = client >= 0 &&
      sendto(client, payload, sizeof(payload), 0, (struct sockaddr *)&address, length) == sizeof(payload) &&
      recvfrom(server, received, sizeof(received), 0, NULL, NULL) == sizeof(payload) &&
      memcmp(payload, received, sizeof(payload)) == 0;
  if (client >= 0) close(client);
  close(server);
  return accepted;
}

int wasmc_ios_app_loopback_probe(char *output, size_t capacity) {
  if (output == NULL || capacity == 0) return EINVAL;
  const int tcp = tcp_probe();
  const int udp = udp_probe();
  const int count = snprintf(output, capacity,
      "{\"tcp_loopback\":%s,\"udp_loopback\":%s}",
      tcp ? "true" : "false", udp ? "true" : "false");
  if (count < 0 || (size_t)count >= capacity) return EOVERFLOW;
  return 0;
}
