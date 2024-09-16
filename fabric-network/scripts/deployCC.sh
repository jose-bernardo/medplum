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
  peer lifecycle chaincode approveformyorg -o localhost:7011 --ordererTLSHostnameOverride orderer.example.com --tls --cafile "$ORDERER_CA" --channelID $CHANNEL_NAME --name ${CC_NAME} --version ${CC_VERSION} --package-id ${PACKAGE_ID} --sequence ${CC_SEQUENCE} ${INIT_REQUIRED} ${CC_END_POLICY} ${CC_COLL_CONFIG} >&log.txt
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
    cat log.txt
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
  peer lifecycle chaincode commit -o localhost:7011 --ordererTLSHostnameOverride orderer.example.com --tls --cafile "$ORDERER_CA" --channelID $CHANNEL_NAME --name ${CC_NAME} "${PEER_CONN_PARMS[@]}" --version ${CC_VERSION} --sequence ${CC_SEQUENCE} ${INIT_REQUIRED} ${CC_END_POLICY} ${CC_COLL_CONFIG} >&log.txt
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

function initLedger() {
  infoln "Invoking InitLedger"

  FILE_SIZE=$2

  ORG=$1
  setGlobals $ORG

  set -x
  if [[ $NETWORK_SIZE = "medium" ]]; then
    peer chaincode invoke -o localhost:7011 --ordererTLSHostnameOverride orderer.example.com \
      --tls --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" \
      -C mychannel -n medsky \
      --peerAddresses localhost:8101 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
      --peerAddresses localhost:8201 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" \
      --peerAddresses localhost:8301 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/tls/ca.crt" \
      -c "{\"function\":\"InitLedger\",\"Args\":[\"$FILE_SIZE\"]}"
    res=$?
  elif [[ $NETWORK_SIZE = "large" ]]; then
    peer chaincode invoke -o localhost:7011 --ordererTLSHostnameOverride orderer.example.com \
      --tls --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" \
      -C mychannel -n medsky \
      --peerAddresses localhost:8101 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
      --peerAddresses localhost:8201 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" \
      --peerAddresses localhost:8301 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org3.example.com/peers/peer0.org3.example.com/tls/ca.crt" \
      --peerAddresses localhost:8401 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org4.example.com/peers/peer0.org4.example.com/tls/ca.crt" \
      --peerAddresses localhost:8501 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org5.example.com/peers/peer0.org5.example.com/tls/ca.crt" \
      -c "{\"function\":\"InitLedger\",\"Args\":[\"$FILE_SIZE\"]}"
      res=$?
  else
   peer chaincode invoke -o localhost:7011 --ordererTLSHostnameOverride orderer.example.com \
     --tls --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" \
     -C mychannel -n medsky \
     --peerAddresses localhost:8101 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
     --peerAddresses localhost:8201 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" \
     -c "{\"function\":\"InitLedger\",\"Args\":[\"$FILE_SIZE\"]}"
     res=$?
  fi
  { set +x; } 2>/dev/null

  verifyResult $res "InitLedger failed"
  successln "Transaction submit successful"
}

infoln "Install chaincode on peer0.org1..."
installChaincode 1
infoln "Install chaincode on peer0.org2..."
installChaincode 2
infoln "Install chaincode on peer0.org3..."
installChaincode 3
approveForMyOrg 1
approveForMyOrg 2
approveForMyOrg 3
queryInstalled 1

if [[ $NETWORK_SIZE = "small" ]]; then
  checkCommitReadiness 1 "\"Org1MSP\": true" "\"Org2MSP\": true" "\"Org3MSP\": true"
  checkCommitReadiness 2 "\"Org1MSP\": true" "\"Org2MSP\": true" "\"Org3MSP\": true"
  checkCommitReadiness 3 "\"Org1MSP\": true" "\"Org2MSP\": true" "\"Org3MSP\": true"
  commitChaincodeDefinition 1 2 3
  queryCommitted 1
  queryCommitted 2
  queryCommitted 3
fi

if [[ $NETWORK_SIZE = "medium" ]]; then
  infoln "Install chaincode on peer0.org4..."
  installChaincode 4
  infoln "Install chaincode on peer0.org5..."
  installChaincode 5
  approveForMyOrg 4
  approveForMyOrg 5
  checkCommitReadiness 1 "\"Org1MSP\": true" "\"Org2MSP\": true" "\"Org3MSP\": true" "\"Org4MSP\": true" "\"Org5MSP\": true"
  checkCommitReadiness 2 "\"Org1MSP\": true" "\"Org2MSP\": true" "\"Org3MSP\": true" "\"Org4MSP\": true" "\"Org5MSP\": true"
  checkCommitReadiness 3 "\"Org1MSP\": true" "\"Org2MSP\": true" "\"Org3MSP\": true" "\"Org4MSP\": true" "\"Org5MSP\": true"
  checkCommitReadiness 4 "\"Org1MSP\": true" "\"Org2MSP\": true" "\"Org3MSP\": true" "\"Org4MSP\": true" "\"Org5MSP\": true"
  checkCommitReadiness 5 "\"Org1MSP\": true" "\"Org2MSP\": true" "\"Org3MSP\": true" "\"Org4MSP\": true" "\"Org5MSP\": true"
  commitChaincodeDefinition 1 2 3 4 5
  queryCommitted 1
  queryCommitted 2
  queryCommitted 3
  queryCommitted 4
  queryCommitted 5
fi

if [[ $NETWORK_SIZE = "large" ]]; then
  infoln "Install chaincode on peer0.org4..."
  installChaincode 4
  infoln "Install chaincode on peer0.org5..."
  installChaincode 5
  infoln "Install chaincode on peer0.org6..."
  installChaincode 6
  infoln "Install chaincode on peer0.org7..."
  installChaincode 7
  infoln "Install chaincode on peer0.org8..."
  installChaincode 8
  infoln "Install chaincode on peer0.org9..."
  installChaincode 9
  approveForMyOrg 4
  approveForMyOrg 5
  approveForMyOrg 6
  approveForMyOrg 7
  approveForMyOrg 8
  approveForMyOrg 9
  checkCommitReadiness 1 "\"Org1MSP\": true" "\"Org2MSP\": true" "\"Org3MSP\": true" "\"Org4MSP\": true" "\"Org5MSP\": true" "\"Org6MSP\": true" "\"Org7MSP\": true" "\"Org8MSP\": true" "\"Org9MSP\": true"
  checkCommitReadiness 2 "\"Org1MSP\": true" "\"Org2MSP\": true" "\"Org3MSP\": true" "\"Org4MSP\": true" "\"Org5MSP\": true" "\"Org6MSP\": true" "\"Org7MSP\": true" "\"Org8MSP\": true" "\"Org9MSP\": true"
  checkCommitReadiness 3 "\"Org1MSP\": true" "\"Org2MSP\": true" "\"Org3MSP\": true" "\"Org4MSP\": true" "\"Org5MSP\": true" "\"Org6MSP\": true" "\"Org7MSP\": true" "\"Org8MSP\": true" "\"Org9MSP\": true"
  checkCommitReadiness 4 "\"Org1MSP\": true" "\"Org2MSP\": true" "\"Org3MSP\": true" "\"Org4MSP\": true" "\"Org5MSP\": true" "\"Org6MSP\": true" "\"Org7MSP\": true" "\"Org8MSP\": true" "\"Org9MSP\": true"
  checkCommitReadiness 5 "\"Org1MSP\": true" "\"Org2MSP\": true" "\"Org3MSP\": true" "\"Org4MSP\": true" "\"Org5MSP\": true" "\"Org6MSP\": true" "\"Org7MSP\": true" "\"Org8MSP\": true" "\"Org9MSP\": true"
  checkCommitReadiness 6 "\"Org1MSP\": true" "\"Org2MSP\": true" "\"Org3MSP\": true" "\"Org4MSP\": true" "\"Org5MSP\": true" "\"Org6MSP\": true" "\"Org7MSP\": true" "\"Org8MSP\": true" "\"Org9MSP\": true"
  checkCommitReadiness 7 "\"Org1MSP\": true" "\"Org2MSP\": true" "\"Org3MSP\": true" "\"Org4MSP\": true" "\"Org5MSP\": true" "\"Org6MSP\": true" "\"Org7MSP\": true" "\"Org8MSP\": true" "\"Org9MSP\": true"
  checkCommitReadiness 8 "\"Org1MSP\": true" "\"Org2MSP\": true" "\"Org3MSP\": true" "\"Org4MSP\": true" "\"Org5MSP\": true" "\"Org6MSP\": true" "\"Org7MSP\": true" "\"Org8MSP\": true" "\"Org9MSP\": true"
  checkCommitReadiness 9 "\"Org1MSP\": true" "\"Org2MSP\": true" "\"Org3MSP\": true" "\"Org4MSP\": true" "\"Org5MSP\": true" "\"Org6MSP\": true" "\"Org7MSP\": true" "\"Org8MSP\": true" "\"Org9MSP\": true"
  commitChaincodeDefinition 1 2 3 4 5 6 7 8 9
  queryCommitted 1
  queryCommitted 2
  queryCommitted 3
  queryCommitted 4
  queryCommitted 5
  queryCommitted 6
  queryCommitted 7
  queryCommitted 8
  queryCommitted 9
fi

initLedger 1 "medium"

rm log.txt

successln "Chaincode ${CC_NAME} successful installed on all peers"