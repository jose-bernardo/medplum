function pre_test_warmup() {
  echo "Sending warmup load..."

  export DURATION=$1
  export VUS=10
  echo "Sending binary files"
  ./k6 run ./binaryWriteTest.js &

  echo "Sending FHIR data"
  export VUS=40
  ./k6 run ./fhirWriteTest.js

  echo "Finished warmup"
}

function infoln() {
  echo "$1" | tee -a log.txt
}

# Expires 30 Out 2024
export TOKEN="eyJhbGciOiJSUzI1NiIsImtpZCI6IjY3M2ZmYTYxLWI4MDctNGQ2Ni1hZWY4LTYxMmEyYTcyYTE4YSIsInR5cCI6IkpXVCJ9.eyJjbGllbnRfaWQiOiJtZWRwbHVtLWNsaSIsImxvZ2luX2lkIjoiNGExYmQ0ZDAtZjExYi00YmQxLWIwMmQtNWFkZmEzYzliNDkxIiwic3ViIjoiY2Y0OTkwMDQtZWIwMS00NjJmLWFjZTEtNjc1MDMzMDQwN2E4IiwidXNlcm5hbWUiOiJjZjQ5OTAwNC1lYjAxLTQ2MmYtYWNlMS02NzUwMzMwNDA3YTgiLCJzY29wZSI6Im9wZW5pZCIsInByb2ZpbGUiOiJQcmFjdGl0aW9uZXIvNjkwYjRmNjAtZmI3OS00OGFlLWI1YTktZTEzYWVmNTM5ZWExIiwiaWF0IjoxNzI3NzM1Mjc5LCJpc3MiOiJodHRwOi8vbG9jYWxob3N0OjU1NTUvIiwiYXVkIjoibWVkcGx1bS1jbGkiLCJleHAiOjE3MzAzMjcyNzl9.kiPyIVpPJEQb5TNXJE1Jxa27yHL4SB9NK_kLdphRdYy4krO0FTy8TPryMRKkU7M9E9gQJ4PNQBBg4MqB0MRZ0FsSxI9Fw5JxiFftQixSaVA6SzIIXYEWyvCkVWoPom0vII0Peejj_aOW5J9e1dfROGhHwaRvAAIKHtEscfldhNpcd8huFzfnM3OvxJiMSoth7E94gvi0g6vPq1s0yWZWyBrNEwtyYX97YgHz4JyUrBw2yZNZ78JJ1ZmQ7oytNr3KiUsy8zKz-j4GqYn2_Tg1tGRzNHLPBVJAT9Kq1v__gQDQjS9y2R6u9VFAacZXq3wA3Qi-rZcP_rnjC1wfVEm0_A"

echo "##########################################"
echo "####### Starting System Evaluation #######"
echo "##########################################"

pre_test_warmup 10min

export VUS=50
export DURATION=35min

infoln "Initializing FHIR WRITE test with $VUS VUs during $DURATION"
infoln "Start Time: $(date)" | tee -a log
./k6 run ./fhirWriteTest.js
infoln "End Time: $(date)" >> log.txt
infoln " -------------------- "

pre_test_warmup 5min

infoln "Initializing FHIR READ test with $VUS VUs during $DURATION"
infoln "Start Time: $(date)" | tee -a log
./k6 run ./fhirReadTest.js
infoln "End Time: $(date)" >> log.txt
infoln " -------------------- "

pre_test_warmup 5min

export VUS=10

infoln "Initializing BINARY READ test with $VUS during $DURATION"
infoln "Start Time: $(date)"
./k6 run ./binaryReadTest.js
infoln "End Time: $(date)"
infoln " -------------------- "

pre_test_warmup 5min

export DURATION=15min

infoln "Initializing BINARY WRITE test with $VUS during $DURATION"
infoln "Start Time: $(date)"
./k6 run ./binaryWriteTest.js
infoln "End Time: $(date)"
infoln " -------------------- "

echo "#########################################"
echo "####### Ending System Evaluation ########"
echo "#########################################"

