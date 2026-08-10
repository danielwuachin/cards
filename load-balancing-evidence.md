# Load Balancing Evidence

Captured: 2026-08-10 19:27:15 UTC
Target: `https://api.danviviendo.com`

## Load test (`hey -n 500 -c 50`)

```

Summary:
  Total:	2.4916 secs
  Slowest:	0.8528 secs
  Fastest:	0.1391 secs
  Average:	0.2202 secs
  Requests/sec:	200.6774
  
  Total data:	35500 bytes
  Size/request:	71 bytes

Response time histogram:
  0.139 [1]	|
  0.210 [432]	|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
  0.282 [17]	|■■
  0.353 [0]	|
  0.425 [0]	|
  0.496 [0]	|
  0.567 [0]	|
  0.639 [0]	|
  0.710 [24]	|■■
  0.781 [17]	|■■
  0.853 [9]	|■


Latency distribution:
  10%% in 0.1453 secs
  25%% in 0.1483 secs
  50%% in 0.1580 secs
  75%% in 0.1778 secs
  90%% in 0.6682 secs
  95%% in 0.7169 secs
  99%% in 0.8484 secs

Details (average, fastest, slowest):
  DNS+dialup:	0.0539 secs, 0.0000 secs, 0.6740 secs
  DNS-lookup:	0.0070 secs, 0.0000 secs, 0.0708 secs
  req write:	0.0000 secs, 0.0000 secs, 0.0007 secs
  resp wait:	0.1620 secs, 0.1390 secs, 0.2666 secs
  resp read:	0.0001 secs, 0.0000 secs, 0.0008 secs

Status code distribution:
  [200]	500 responses
```

## Instance distribution (100 sequential requests to /health)

```
  50 "instanceId":"ip-10-0-11-35.us-east-2.compute.internal"
  50 "instanceId":"ip-10-0-10-44.us-east-2.compute.internal"
   1 
```
