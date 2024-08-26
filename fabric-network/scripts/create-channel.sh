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
  infoln "Joining org$ORG peer to the channel"
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

createConfigUpdate() {
  CHANNEL=$1
  ORIGINAL=$2
  MODIFIED=$3
  OUTPUT=$4

  set -x
  configtxlator proto_encode --input "${ORIGINAL}" --type common.Config --output channel-artifacts/original_config.pb
  configtxlator proto_encode --input "${MODIFIED}" --type common.Config --output channel-artifacts/modified_config.pb
  configtxlator compute_update --channel_id "${CHANNEL}" --original channel-artifacts/original_config.pb --updated channel-artifacts/modified_config.pb --output channel-artifacts/config_update.pb
  configtxlator proto_decode --input channel-artifacts/config_update.pb --type common.ConfigUpdate --output channel-artifacts/config_update.json
  echo '{"payload":{"header":{"channel_header":{"channel_id":"'$CHANNEL'", "type":2}},"data":{"config_update":'$(cat channel-artifacts/config_update.json)'}}}' | jq . > channel-artifacts/config_update_in_envelope.json
  configtxlator proto_encode --input channel-artifacts/config_update_in_envelope.json --type common.Envelope --output "${OUTPUT}"
  { set +x; } 2>/dev/null
}

fetchChannelConfig() {
  ORG=$1
  CHANNEL=$2
  OUTPUT=$3

  setGlobals $ORG

  infoln "Fetching the most recent configuration block for the channel"
  set -x
  peer channel fetch config channel-artifacts/config_block.pb -o localhost:7011 --ordererTLSHostnameOverride orderer.example.com -c $CHANNEL --tls --cafile "$ORDERER_CA"
  { set +x; } 2>/dev/null

  infoln "Decoding config block to JSON and isolating config to ${OUTPUT}"
  set -x
  configtxlator proto_decode --input channel-artifacts/config_block.pb --type common.Block --output channel-artifacts/config_block.json
  jq .data.data[0].payload.data.config channel-artifacts/config_block.json >"${OUTPUT}"
  res=$?
  { set +x; } 2>/dev/null
  verifyResult $res "Failed to parse channel configuration, make sure you have jq installed"
}

createAnchorPeerUpdate() {
  infoln "Fetching channel config for channel $CHANNEL_NAME"
  fetchChannelConfig $ORG $CHANNEL_NAME channel-artifacts/${CORE_PEER_LOCALMSPID}config.json

  infoln "Generating anchor peer update transaction for Org${ORG} on channel $CHANNEL_NAME"

  if [ $ORG -eq 1 ]; then
    HOST="peer0.org1.example.com"
    PORT=8101
  elif [ $ORG -eq 2 ]; then
    HOST="peer0.org2.example.com"
    PORT=8201
  elif [ $ORG -eq 3 ]; then
    HOST="peer0.org3.example.com"
    PORT=8301
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

setAnchorPeer() {
  ORG=$1
  infoln "Setting anchor peer for org${ORG}..."
  setGlobals $ORG
  createAnchorPeerUpdate
  updateAnchorPeer
}

createChannelGenesisBlock
createChannel

joinChannel 1
joinChannel 2
joinChannel 3

setAnchorPeer 1
setAnchorPeer 2
setAnchorPeer 3