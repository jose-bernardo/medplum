#!/usr/bin/env bash

C_RESET='\033[0m'
C_RED='\033[0;31m'
C_GREEN='\033[0;32m'
C_BLUE='\033[0;34m'

function setGlobals() {
  USING_ORG=$1
  infoln "Using organization ${USING_ORG}"
  if [ $USING_ORG -eq 1 ]; then
    export CORE_PEER_LOCALMSPID=Org1MSP
    export CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_ORG1_CA
    export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
    export CORE_PEER_ADDRESS=localhost:7051
  elif [ $USING_ORG -eq 2 ]; then
    export CORE_PEER_LOCALMSPID=Org2MSP
    export CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_ORG2_CA
    export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp
    export CORE_PEER_ADDRESS=localhost:9051
  else
    errorln "ORG Unknown"
  fi
 }

function println() {
  echo -e "$1"
}

function errorln() {
  println "${C_RED}${1}${C_RESET}"
}

function successln() {
  println "${C_GREEN}${1}${C_RESET}"
}

function infoln() {
  println "${C_BLUE}${1}${C_RESET}"
}

function fatalln() {
  errorln "$1"
  exit 1
}

function verifyResult() {
  if [ $1 -ne 0 ]; then
    fatalln "$2"
  fi
}

export -f setGlobals
export -f errorln
export -f successln
export -f infoln
export -f verifyResult