createChannelGenesisBlock() {
  rm -Rf ./channel-artifacts

  setGlobals 1
  which configtxgen
	if [ "$?" -ne 0 ]; then
		fatalln "configtxgen tool not found."
  fi
	set -x

  if $RAFT; then
	  configtxgen -profile ChannelUsingRaft -outputBlock ./channel-artifacts/${CHANNEL_NAME}.block -channelID $CHANNEL_NAME
	else
	  configtxgen -profile ChannelUsingBFT -outputBlock ./channel-artifacts/${CHANNEL_NAME}.block -channelID $CHANNEL_NAME
	fi

	res=$?
	{ set +x; } 2>/dev/null
	verifyResult $res "Failed to generate channel configuration transaction..."
}

createChannel() {
  infoln "Creating channel ${CHANNEL_NAME}"
	local rc=1
	local COUNTER=1
	infoln "Adding orderers"
	while [ $rc -ne 0 -a $COUNTER -lt $MAX_RETRY ] ; do
		sleep $DELAY
		set -x

		./orderers-scripts/orderer.sh
		./orderers-scripts/orderer2.sh
		./orderers-scripts/orderer3.sh
		if ! $RAFT; then
		  ./orderers-scripts/orderer4.sh
		fi

		res=$?
		{ set +x; } 2>/dev/null
		let rc=$res
		COUNTER=$(expr $COUNTER + 1)
	done
	cat log.txt
	verifyResult $res "Channel creation failed"

	successln "Channel '$CHANNEL_NAME' created"
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
    peer channel join -b "./channel-artifacts/${CHANNEL_NAME}.block" >&log.txt
    res=$?
    { set +x; } 2>/dev/null
		let rc=$res
		COUNTER=$(expr $COUNTER + 1)
	done

	cat log.txt
	verifyResult $res "After $MAX_RETRY attempts, peer0.org${ORG} has failed to join channel '$CHANNEL_NAME'"
}

setAnchorPeer() {
  ORG=$1
  . scripts/setAnchorPeer.sh $ORG $CHANNEL_NAME
}

if [ ! -d "channel-artifacts" ]; then
	mkdir channel-artifacts
fi

createChannelGenesisBlock
createChannel

joinChannel 1
joinChannel 11
joinChannel 2
joinChannel 12
joinChannel 3
joinChannel 13
  joinChannel 4
  joinChannel 14
  joinChannel 5
  joinChannel 15

setAnchorPeer 1
setAnchorPeer 2
setAnchorPeer 3

  setAnchorPeer 4
  setAnchorPeer 5