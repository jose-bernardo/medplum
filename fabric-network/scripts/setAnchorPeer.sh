#!/bin/bash

. scripts/configUpdate.sh

createAnchorPeerUpdate() {
  infoln "Fetching channel config for channel $CHANNEL_NAME"
  fetchChannelConfig $ORG $CHANNEL_NAME channel-artifacts/${CORE_PEER_LOCALMSPID}config.json

  infoln "Generating anchor peer update transaction for Org${ORG} on channel $CHANNEL_NAME"

  if [ $ORG -eq 1 ]; then
    HOST="peer0.org1.example.com"
    PORT=8101
  elif [ $ORG -eq 11 ]; then
    HOST="peer1.org1.example.com"
    PORT=8111
  elif [ $ORG -eq 2 ]; then
    HOST="peer0.org2.example.com"
    PORT=8201
  elif [ $ORG -eq 12 ]; then
    HOST="peer1.org2.example.com"
    PORT=8211
  elif [ $ORG -eq 3 ]; then
    HOST="peer0.org3.example.com"
    PORT=8301
  elif [ $ORG -eq 13 ]; then
    HOST="peer1.org3.example.com"
    PORT=8311
  elif [ $ORG -eq 4 ]; then
    HOST="peer0.org4.example.com"
    PORT=8401
  elif [ $ORG -eq 14 ]; then
    HOST="peer1.org4.example.com"
    PORT=8411
  elif [ $ORG -eq 5 ]; then
    HOST="peer0.org5.example.com"
    PORT=8501
  elif [ $ORG -eq 15 ]; then
    HOST="peer1.org5.example.com"
    PORT=8511
  else
    errorln "Org${ORG} unknown"
  fi

  set -x
  jq '.channel_group.groups.Application.groups.'${CORE_PEER_LOCALMSPID}'.values += {"AnchorPeers":{"mod_policy": "Admins","value":{"anchor_peers": [{"host": "'$HOST'","port": '$PORT'}]},"version": "0"}}' channel-artifacts/${CORE_PEER_LOCALMSPID}config.json > channel-artifacts/${CORE_PEER_LOCALMSPID}modified_config.json
  res=$?
  { set +x; } 2>/dev/null
  verifyResult $res "Channel configuration update for anchor peer failed, make sure you have jq installed"

  createConfigUpdate ${CHANNEL_NAME} channel-artifacts/${CORE_PEER_LOCALMSPID}config.json channel-artifacts/${CORE_PEER_LOCALMSPID}modified_config.json channel-artifacts/${CORE_PEER_LOCALMSPID}anchors.tx
}

updateAnchorPeer() {
  peer channel update -o localhost:7011 --ordererTLSHostnameOverride orderer.example.com -c $CHANNEL_NAME -f channel-artifacts/${CORE_PEER_LOCALMSPID}anchors.tx --tls --cafile "$ORDERER_CA" >&log.txt
  res=$?
  cat log.txt
  verifyResult $res "Anchor peer update failed"
  successln "Anchor peer set for org '$CORE_PEER_LOCALMSPID' on channel '$CHANNEL_NAME'"
}

ORG=$1
CHANNEL_NAME=$2

setGlobals $ORG

createAnchorPeerUpdate

updateAnchorPeer