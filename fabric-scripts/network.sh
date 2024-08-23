#!/usr/bin/env bash

export CHANNEL_NAME="mychannel"
export DELAY="3"
export MAX_RETRY="5"

export PATH=${PWD}/bin:$PATH
export FABRIC_CFG_PATH=${PWD}/configtx
export DOCKER_SOCK="${DOCKER_HOST:-/var/run/docker.sock}"

export CORE_PEER_TLS_ENABLED=true
export PEER0_ORG1_CA=${PWD}/organizations/peerOrganizations/org1.example.com/tlsca/tlsca.org1.example.com-cert.pem
export PEER0_ORG2_CA=${PWD}/organizations/peerOrganizations/org2.example.com/tlsca/tlsca.org2.example.com-cert.pem

setGlobals() {
  USING_ORG=$1
  echo "Using organization ${USING_ORG}"
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
    echo "ORG Unknown"
  fi
}

createOrgs() {
  echo 'Generating certificates using cryptogen tool'

  set -x
  cryptogen generate --config=cryptogen/crypto-config.yaml --output="organizations"
  { set +x; } 2>/dev/null

  echo 'Successfully created all organization identities'
}

networkDown() {
  rm -rf ${PWD}/organizations
  docker-compose -f compose/compose.yaml -f compose/docker/docker-compose.yaml down --volumes --remove-orphans
}

networkUp() {
  createOrgs
  docker-compose -f compose/compose.yaml -f compose/docker/docker-compose.yaml up -d
  docker ps -a
}

createChannelGenesisBlock() {
  setGlobals 1
	set -x

	configtxgen -profile ChannelUsingRaft -outputBlock ./channel-artifacts/${CHANNEL_NAME}.block -channelID $CHANNEL_NAME

	{ set +x; } 2>/dev/null
}

createChannel() {
	# Poll in case the raft leader is not set yet
	local rc=1
	local COUNTER=1
	echo "Adding orderers"
	while [ $rc -ne 0 -a $COUNTER -lt $MAX_RETRY ] ; do
		sleep $DELAY
		set -x

    export ORDERER_CA=${PWD}/organizations/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem
    export ORDERER_ADMIN_TLS_SIGN_CERT=${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/tls/server.crt
    export ORDERER_ADMIN_TLS_PRIVATE_KEY=${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/tls/server.key
    osnadmin channel join --channelID ${CHANNEL_NAME} --config-block ./channel-artifacts/${CHANNEL_NAME}.block -o localhost:7053 --ca-file "$ORDERER_CA" --client-cert "$ORDERER_ADMIN_TLS_SIGN_CERT" --client-key "$ORDERER_ADMIN_TLS_PRIVATE_KEY"

		res=$?
		{ set +x; } 2>/dev/null
		let rc=$res
		COUNTER=$(expr $COUNTER + 1)
	done
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

packageCC() {
  echo "Packaging chaincode"
  set -x
  pushd ../chaincode
  GO111MODULE=on go mod vendor
  popd
  peer lifecycle chaincode package packagedChaincode/medsky_1.0.tar.gz --path ../chaincode --lang golang --label medsky_1.0
  res=$?
  { set +x; } 2>/dev/null
  if [[ $res -eq 0 ]]; then
    echo "Chaincode is packaged"
  fi
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