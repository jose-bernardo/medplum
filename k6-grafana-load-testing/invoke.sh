#!/bin/bash

cd ../fabric-network

export FABRIC_CFG_PATH=${PWD}/configtx-large
export PATH=${PWD}/bin:$PATH
. scripts/envVar.sh
. scripts/util.sh

ORG=$((RANDOM % 9 + 1))

RECORD_ID=$1
ACTION_ID=$2
HASH=$3

setGlobals $ORG

peer chaincode invoke -o localhost:7011 --ordererTLSHostnameOverride orderer.example.com \
     --tls --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" \
     -C mychannel -n medsky \
     --peerAddresses localhost:8101 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
     --peerAddresses localhost:8201 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" \
     --peerAddresses localhost:8301 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/tls/ca.crt" \
     --peerAddresses localhost:8401 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org4.example.com/peers/peer0.org4.example.com/tls/ca.crt" \
     --peerAddresses localhost:8501 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org5.example.com/peers/peer0.org5.example.com/tls/ca.crt" \
     --peerAddresses localhost:8601 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org6.example.com/peers/peer0.org6.example.com/tls/ca.crt" \
     -c "{\"function\":\"CreateRecord\",\"Args\":[\"$RECORD_ID\", \"$HASH\", \"$ACTION_ID\"]}"

cd -
