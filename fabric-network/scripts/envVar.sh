# General vars
export CHANNEL_NAME="mychannel"
export DELAY="3"
export MAX_RETRY="5"

export FABRIC_LOGGING_SPEC=grpc=warning

# Peers and orderers vars
export ORDERER_CA=${PWD}/organizations/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem

export CORE_PEER_TLS_ENABLED=true
export PEER0_ORG1_CA=${PWD}/organizations/peerOrganizations/org1.example.com/tlsca/tlsca.org1.example.com-cert.pem
export PEER0_ORG2_CA=${PWD}/organizations/peerOrganizations/org2.example.com/tlsca/tlsca.org2.example.com-cert.pem
export PEER0_ORG3_CA=${PWD}/organizations/peerOrganizations/org3.example.com/tlsca/tlsca.org3.example.com-cert.pem
export PEER0_ORG4_CA=${PWD}/organizations/peerOrganizations/org4.example.com/tlsca/tlsca.org4.example.com-cert.pem
export PEER0_ORG5_CA=${PWD}/organizations/peerOrganizations/org5.example.com/tlsca/tlsca.org5.example.com-cert.pem
export PEER0_ORG6_CA=${PWD}/organizations/peerOrganizations/org6.example.com/tlsca/tlsca.org6.example.com-cert.pem
export PEER0_ORG7_CA=${PWD}/organizations/peerOrganizations/org7.example.com/tlsca/tlsca.org7.example.com-cert.pem
export PEER0_ORG8_CA=${PWD}/organizations/peerOrganizations/org8.example.com/tlsca/tlsca.org8.example.com-cert.pem
export PEER0_ORG9_CA=${PWD}/organizations/peerOrganizations/org9.example.com/tlsca/tlsca.org9.example.com-cert.pem

# Chaincode vars
export CC_NAME="medsky"
export CC_SRC_PATH=${PWD}/chaincode
export CC_VERSION="1.0"
export CC_SEQUENCE="1"