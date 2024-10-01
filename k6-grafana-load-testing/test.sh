function pre_test_warmup() {
  echo "Sending warmup load..."

  export DURATION=$1
  echo "Sending FHIR data"
  export VUS=40
  ./k6 run ./fhirWriteTest.js > /dev/null

  sleep 30

  echo "Finished warmup"
}

function infoln() {
  echo "$1" | tee -a log.txt
}

# Expires 30 Out 2024
export TOKEN="eyJhbGciOiJSUzI1NiIsImtpZCI6IjY3M2ZmYTYxLWI4MDctNGQ2Ni1hZWY4LTYxMmEyYTcyYTE4YSIsInR5cCI6IkpXVCJ9.eyJjbGllbnRfaWQiOiJtZWRwbHVtLWNsaSIsImxvZ2luX2lkIjoiNGExYmQ0ZDAtZjExYi00YmQxLWIwMmQtNWFkZmEzYzliNDkxIiwic3ViIjoiY2Y0OTkwMDQtZWIwMS00NjJmLWFjZTEtNjc1MDMzMDQwN2E4IiwidXNlcm5hbWUiOiJjZjQ5OTAwNC1lYjAxLTQ2MmYtYWNlMS02NzUwMzMwNDA3YTgiLCJzY29wZSI6Im9wZW5pZCIsInByb2ZpbGUiOiJQcmFjdGl0aW9uZXIvNjkwYjRmNjAtZmI3OS00OGFlLWI1YTktZTEzYWVmNTM5ZWExIiwiaWF0IjoxNzI3NzM1Mjc5LCJpc3MiOiJodHRwOi8vbG9jYWxob3N0OjU1NTUvIiwiYXVkIjoibWVkcGx1bS1jbGkiLCJleHAiOjE3MzAzMjcyNzl9.kiPyIVpPJEQb5TNXJE1Jxa27yHL4SB9NK_kLdphRdYy4krO0FTy8TPryMRKkU7M9E9gQJ4PNQBBg4MqB0MRZ0FsSxI9Fw5JxiFftQixSaVA6SzIIXYEWyvCkVWoPom0vII0Peejj_aOW5J9e1dfROGhHwaRvAAIKHtEscfldhNpcd8huFzfnM3OvxJiMSoth7E94gvi0g6vPq1s0yWZWyBrNEwtyYX97YgHz4JyUrBw2yZNZ78JJ1ZmQ7oytNr3KiUsy8zKz-j4GqYn2_Tg1tGRzNHLPBVJAT9Kq1v__gQDQjS9y2R6u9VFAacZXq3wA3Qi-rZcP_rnjC1wfVEm0_A"

mkdir -p reports

function execFhirWriteTest() {
pre_test_warmup 5m
export VUS=50
export DURATION=65m

infoln "Initializing FHIR WRITE test with $VUS VUs during $DURATION"
infoln "Start Time: $(date)"
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_PORT=9997 K6_WEB_DASHBOARD_EXPORT=reports/fhirWriteTest.html ./k6 run ./fhirWriteTest.js
infoln "End Time: $(date)"
infoln " -------------------- "
}


function execFhirReadTest() {
pre_test_warmup 5m
export VUS=50
export DURATION=65m

infoln "Initializing FHIR READ test with $VUS VUs during $DURATION"
infoln "Start Time: $(date)"
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_PORT=9997 K6_WEB_DASHBOARD_EXPORT=reports/fhirReadTest.html ./k6 run ./fhirReadTest.js
infoln "End Time: $(date)"
infoln " -------------------- "
}


function execBinaryReadTest() {
pre_test_warmup 5m
export VUS=10
export DURATION=65m

infoln "Initializing BINARY READ test with $VUS during $DURATION"
infoln "Start Time: $(date)"
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_PORT=9997 K6_WEB_DASHBOARD_EXPORT=reports/binaryWriteTest.html ./k6 run ./binaryReadTest.js
infoln "End Time: $(date)"
infoln " -------------------- "
}


function execBinaryWriteTest() {
pre_test_warmup 5m
export VUS=10
export DURATION=15m

infoln "Initializing BINARY WRITE test with $VUS during $DURATION"
infoln "Start Time: $(date)"
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_PORT=9997 K6_WEB_DASHBOARD_EXPORT=reports/binaryWriteTest.html ./k6 run ./binaryWriteTest.js
infoln "End Time: $(date)"
infoln " -------------------- "
}

echo "##########################################"
echo "####### Starting System Evaluation #######"
echo "##########################################"

if [ $1 = "fr" ]; then
  execFhirReadTest
elif [ $1 = "fw" ]; then
  execFhirWriteTest
elif [ $1 = "br" ]; then
  execBinaryReadTest
elif [ $1 = "bw" ]; then
  execBinaryWriteTest
else
  execFhirReadTest
  execFhirWriteTest
  execBinaryReadTest
fi

echo "#########################################"
echo "####### Ending System Evaluation ########"
echo "#########################################"