#!/usr/bin/env bash

source ./util.sh

export CHANNEL_NAME="mychannel"
export DELAY="3"
export MAX_RETRY="5"

export PATH=${PWD}/bin:$PATH
export FABRIC_CFG_PATH=${PWD}/configtx
export DOCKER_SOCK="${DOCKER_HOST:-/var/run/docker.sock}"

export ORDERER_CA=${PWD}/organizations/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem

export CORE_PEER_TLS_ENABLED=true
export PEER0_ORG1_CA=${PWD}/organizations/peerOrganizations/org1.example.com/tlsca/tlsca.org1.example.com-cert.pem
export PEER0_ORG2_CA=${PWD}/organizations/peerOrganizations/org2.example.com/tlsca/tlsca.org2.example.com-cert.pem

export CC_NAME="medsky"
export CC_SRC_PATH=${PWD}/../chaincode
export CC_VERSION="1.0"
export CC_SEQUENCE="1"

function installPrereq() {
  infoln "Installing prerequisites"
  curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh && chmod +x install-fabric.sh
  ./install-fabric.sh --fabric-version 3.0.0-beta binary
  res=$?
  verifyResult $res "Installation has failed"
  successln "Prerequisites are now met"
}

checkPrereq() {
  FILE="./install-fabric.sh"
  if [ ! -f $FILE ]; then
    installPrereq
  else
    PEER_VERSION=peer version | grep Version
    if [ "$PEER_VERSION" != " Version: v3.0.0-beta" ]; then
      infoln "Wrong version"
      installPrereq
    else
      infoln "Prerequisites are already met"
    fi
  fi
}

createOrgs() {
  infoln 'Generating certificates using cryptogen tool'

  set -x
  cryptogen generate --config=cryptogen/crypto-config.yaml --output="organizations"
  { set +x; } 2>/dev/null

  successln 'Successfully created all organization identities'
}

networkDown() {
  rm -rf ${PWD}/organizations ${PWD}/channel-artifacts
  docker-compose -f compose/compose.yaml -f compose/docker/docker-compose.yaml down --volumes --remove-orphans
}

networkUp() {

  infoln "Bringing up network"

  createOrgs
  docker-compose -f compose/compose.yaml -f compose/docker/docker-compose.yaml up -d
  docker ps -a
}

createChannelGenesisBlock() {
  setGlobals 1
	set -x

	configtxgen -profile ChannelUsingBFT -outputBlock ./channel-artifacts/${CHANNEL_NAME}.block -channelID $CHANNEL_NAME
	res=$?
	{ set +x; } 2>/dev/null
	verifyResult $res "Failed to generate channel configuration transaction..."
}

createChannel() {
	local rc=1
	local COUNTER=1
	infoln "Adding orderers"
	while [ $rc -ne 0 -a $COUNTER -lt $MAX_RETRY ] ; do
		sleep $DELAY
		set -x

		./orderers-scripts/orderer.sh
		./orderers-scripts/orderer2.sh
		./orderers-scripts/orderer3.sh
		./orderers-scripts/orderer4.sh

		res=$?
		{ set +x; } 2>/dev/null
		let rc=$res
		COUNTER=$(expr $COUNTER + 1)
	done
	verifyResult $res "Channel creation failed"
}

joinChannel() {
  ORG=$1
  setGlobals $ORG
	local rc=1
	local COUNTER=1
	## Sometimes Join takes time, hence retry
	while [ $rc -ne 0 -a $COUNTER -lt $MAX_RETRY ] ; do
    sleep $DELAY
    set -x
    peer channel join -b "./channel-artifacts/${CHANNEL_NAME}.block"
    res=$?
    { set +x; } 2>/dev/null
		let rc=$res
		COUNTER=$(expr $COUNTER + 1)
	done
}

function vendorCC() {
  set -x
  mkdir -p packagedChaincode
  pushd $CC_SRC_PATH
  GO111MODULE=on go mod vendor
  popd
  { set +x; } 2>/dev/null
  verifyResult $res "Vendoring Go dependencies at $CC_SRC_PATH"
  successln "Finished vendoring Go dependencies"
}

packageCC() {
  infoln "Packaging chaincode"
  set -x
  peer lifecycle chaincode package ${CC_NAME}.tar.gz --path ${CC_SRC_PATH} --lang golang --label ${CC_NAME}_${CC_VERSION} >&log.txt
  res=$?
  { set +x; } 2>/dev/null
  cat log.txt
  PACKAGE_ID=$(peer lifecycle chaincode calculatepackageid ${CC_NAME}.tar.gz)
  verifyResult $res "Chaincode packaging has failed"
  successln "Chaincode is packaged"
}

function installChaincode() {
  ORG=$1
  setGlobals $ORG
  set -x
  peer lifecycle chaincode queryinstalled --output json | jq -r 'try (.installed_chaincodes[].package_id)' | grep ^${PACKAGE_ID}$ >&log.txt
  if test $? -ne 0; then
    peer lifecycle chaincode install ${CC_NAME}.tar.gz >&log.txt
    res=$?
  fi
  { set +x; } 2>/dev/null
  cat log.txt
  verifyResult $res "Chaincode installation on peer0.org${ORG} has failed"
  successln "Chaincode is installed on peer0.org${ORG}"
}

function queryInstalled() {
  ORG=$1
  setGlobals $ORG
  set -x
  peer lifecycle chaincode queryinstalled --output json | jq -r 'try (.installed_chaincodes[].package_id)' | grep ^${PACKAGE_ID}$ >&log.txt
  res=$?
  { set +x; } 2>/dev/null
  cat log.txt
  verifyResult $res "Query installed on peer0.org${ORG} has failed"
  successln "Query installed successful on peer0.org${ORG} on channel"
}

function approveForMyOrg() {
  ORG=$1
  setGlobals $ORG
  set -x
  peer lifecycle chaincode approveformyorg -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile "$ORDERER_CA" --channelID $CHANNEL_NAME --name ${CC_NAME} --version ${CC_VERSION} --package-id ${PACKAGE_ID} --sequence ${CC_SEQUENCE} ${INIT_REQUIRED} ${CC_END_POLICY} ${CC_COLL_CONFIG} >&log.txt
  res=$?
  { set +x; } 2>/dev/null
  cat log.txt
  verifyResult $res "Chaincode definition approved on peer0.org${ORG} on channel '$CHANNEL_NAME' failed"
  successln "Chaincode definition approved on peer0.org${ORG} on channel '$CHANNEL_NAME'"
}

function checkCommitReadiness() {
  ORG=$1
  shift 1
  setGlobals $ORG
  infoln "Checking the commit readiness of the chaincode definition on peer0.org${ORG} on channel '$CHANNEL_NAME'..."
  local rc=1
  local COUNTER=1
  while [ $rc -ne 0 -a $COUNTER -lt $MAX_RETRY ]; do
    sleep $DELAY
    infoln "Attempting to check the commit readiness of the chaincode definition on peer0.org${ORG}, Retry after $DELAY seconds."
    set -x
    peer lifecycle chaincode checkcommitreadiness --channelID $CHANNEL_NAME --name ${CC_NAME} --version ${CC_VERSION} --sequence ${CC_SEQUENCE} ${INIT_REQUIRED} ${CC_END_POLICY} ${CC_COLL_CONFIG} --output json >&log.txt
    res=$?
    { set +x; } 2>/dev/null
    let rc=0
    for var in "$@"; do
      grep "$var" log.txt &>/dev/null || let rc=1
    done
    COUNTER=$(expr $COUNTER + 1)
  done
  cat log.txt
  if test $rc -eq 0; then
    infoln "Checking the commit readiness of the chaincode definition successful on peer0.org${ORG} on channel '$CHANNEL_NAME'"
  else
    fatalln "After $MAX_RETRY attempts, Check commit readiness result on peer0.org${ORG} is INVALID!"
  fi
}

parsePeerConnectionParameters() {
  PEER_CONN_PARMS=()
  PEERS=""
  while [ "$#" -gt 0 ]; do
    setGlobals $1
    PEER="peer0.org$1"
    if [ -z "$PEERS" ]
    then
	    PEERS="$PEER"
    else
	    PEERS="$PEERS $PEER"
    fi
    PEER_CONN_PARMS=("${PEER_CONN_PARMS[@]}" --peerAddresses $CORE_PEER_ADDRESS)
    CA=PEER0_ORG$1_CA
    TLSINFO=(--tlsRootCertFiles "${!CA}")
    PEER_CONN_PARMS=("${PEER_CONN_PARMS[@]}" "${TLSINFO[@]}")
    shift
  done
}

function commitChaincodeDefinition() {
  parsePeerConnectionParameters $@
  res=$?
  verifyResult $res "Invoke transaction failed on channel '$CHANNEL_NAME' due to uneven number of peer and org parameters "

  set -x
  peer lifecycle chaincode commit -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile "$ORDERER_CA" --channelID $CHANNEL_NAME --name ${CC_NAME} "${PEER_CONN_PARMS[@]}" --version ${CC_VERSION} --sequence ${CC_SEQUENCE} ${INIT_REQUIRED} ${CC_END_POLICY} ${CC_COLL_CONFIG} >&log.txt
  res=$?
  { set +x; } 2>/dev/null
  cat log.txt
  verifyResult $res "Chaincode definition commit failed on peer0.org${ORG} on channel '$CHANNEL_NAME' failed"
  successln "Chaincode definition committed on channel '$CHANNEL_NAME'"
}

function queryCommitted() {
  ORG=$1
  setGlobals $ORG
  EXPECTED_RESULT="Version: ${CC_VERSION}, Sequence: ${CC_SEQUENCE}, Endorsement Plugin: escc, Validation Plugin: vscc"
  infoln "Querying chaincode definition on peer0.org${ORG} on channel '$CHANNEL_NAME'..."
  local rc=1
  local COUNTER=1
  while [ $rc -ne 0 -a $COUNTER -lt $MAX_RETRY ]; do
    sleep $DELAY
    infoln "Attempting to Query committed status on peer0.org${ORG}, Retry after $DELAY seconds."
    set -x
    peer lifecycle chaincode querycommitted --channelID $CHANNEL_NAME --name ${CC_NAME} >&log.txt
    res=$?
    { set +x; } 2>/dev/null
    test $res -eq 0 && VALUE=$(cat log.txt | grep -o '^Version: '$CC_VERSION', Sequence: [0-9]*, Endorsement Plugin: escc, Validation Plugin: vscc')
    test "$VALUE" = "$EXPECTED_RESULT" && let rc=0
    COUNTER=$(expr $COUNTER + 1)
  done
  cat log.txt
  if test $rc -eq 0; then
    successln "Query chaincode definition successful on peer0.org${ORG} on channel '$CHANNEL_NAME'"
  else
    fatalln "After $MAX_RETRY attempts, Query chaincode definition result on peer0.org${ORG} is INVALID!"
  fi
}

deployCC() {
  infoln "Installing chaincode on peer0.org1..."
  installChaincode 1
  infoln "Install chaincode on peer0.org2..."
  installChaincode 2

  queryInstalled 1

  approveForMyOrg 1

  checkCommitReadiness 1 "\"Org1MSP\": true" "\"Org2MSP\": false"
  checkCommitReadiness 2 "\"Org1MSP\": true" "\"Org2MSP\": false"

  approveForMyOrg 2

  checkCommitReadiness 1 "\"Org1MSP\": true" "\"Org2MSP\": true"
  checkCommitReadiness 2 "\"Org1MSP\": true" "\"Org2MSP\": true"

  commitChaincodeDefinition 1 2

  queryCommitted 1
  queryCommitted 2

  rm log.txt

  successln "Chaincode ${CC_NAME} successful installed on all peers"
}

networkDown
networkUp

createChannelGenesisBlock
createChannel

echo "Joining org1 peer to the channel"
joinChannel 1
echo "Joining org2 peer to the channel"
joinChannel 2

packageCC

sleep 5

deployCC