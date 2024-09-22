#!/bin/bash

cd ../fabric-network

export FABRIC_CFG_PATH=${PWD}/configtx-large
export PATH=${PWD}/bin:$PATH
. scripts/envVar.sh
. scripts/util.sh

ORG=$((RANDOM % 3 + 1))

RECORD_ID=$1
ACTION_ID=$2
HASH=$3

setGlobals $ORG

if [ -z "$3" ]; then
    peer chaincode invoke -o orderer.example.com:7011 --ordererTLSHostnameOverride orderer.example.com \
     --tls --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" \
     -C mychannel -n medsky \
     --peerAddresses peer0.org1.example.com:8101 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
     --peerAddresses peer0.org2.example.com:8201 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" \
     --peerAddresses peer0.org3.example.com:8301 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/tls/ca.crt" \
     -c "{\"function\":\"ReadRecordTx\",\"Args\":[\"$RECORD_ID\", \"$ACTION_ID\"]}"
else
    peer chaincode invoke -o orderer.example.com:7011 --ordererTLSHostnameOverride orderer.example.com \
     --tls --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" \
     -C mychannel -n medsky \
     --peerAddresses peer0.org1.example.com:8101 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
     --peerAddresses peer0.org2.example.com:8201 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" \
     --peerAddresses peer0.org3.example.com:8301 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/tls/ca.crt" \
     -c "{\"function\":\"CreateRecord\",\"Args\":[\"$RECORD_ID\", \"$HASH\", \"$ACTION_ID\"]}"
fi

cd -
