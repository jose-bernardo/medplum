#!/bin/bash

cd ../fabric-network

export FABRIC_CFG_PATH=${PWD}/configtx-large
export PATH=${PWD}/bin:$PATH
. scripts/envVar.sh
. scripts/util.sh

ORG=$((RANDOM % 3 + 1))

FUNCTION=$1
RECORD_ID=$2
ACCESS_ID=$3

setGlobals $ORG

function ReadRecordTx() {
    peer chaincode invoke -o orderer.example.com:7011 --ordererTLSHostnameOverride orderer.example.com \
     --tls --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" \
     -C mychannel -n medsky \
     --peerAddresses peer0.org1.example.com:8101 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
     --peerAddresses peer0.org2.example.com:8201 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" \
     --peerAddresses peer0.org3.example.com:8301 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/tls/ca.crt" \
     --peerAddresses peer0.org4.example.com:8401 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org4.example.com/peers/peer0.org4.example.com/tls/ca.crt" \
     --peerAddresses peer0.org5.example.com:8501 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org5.example.com/peers/peer0.org5.example.com/tls/ca.crt" \
     -c "{\"function\":\"ReadRecordTx\",\"Args\":[\"$RECORD_ID\", \"$ACCESS_ID\"]}"
}

function CreateRecord() {
    peer chaincode invoke -o orderer.example.com:7011 --ordererTLSHostnameOverride orderer.example.com \
     --tls --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" \
     -C mychannel -n medsky \
     --peerAddresses peer0.org1.example.com:8101 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
     --peerAddresses peer0.org2.example.com:8201 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" \
     --peerAddresses peer0.org3.example.com:8301 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/tls/ca.crt" \
     --peerAddresses peer0.org4.example.com:8401 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org4.example.com/peers/peer0.org4.example.com/tls/ca.crt" \
     --peerAddresses peer0.org5.example.com:8501 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org5.example.com/peers/peer0.org5.example.com/tls/ca.crt" \
     -c "{\"function\":\"CreateRecord\",\"Args\":[\"$RECORD_ID\", \"$HASH\"]}"
}

if [ $FUNCTION = 'ReadRecordTx' ]; then
  ReadRecordTx
else
  CreateRecord
fi

cd -