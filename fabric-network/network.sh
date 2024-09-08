#!/usr/bin/env bash

. ./scripts/util.sh

export PATH=${PWD}/bin:$PATH
export FABRIC_CFG_PATH=${PWD}/configtx
export COMPOSE_FILES="-f compose/compose.yaml -f compose/docker/docker-compose.yaml"
export DOCKER_SOCK="/var/run/docker.sock"

function installPrereq() {
  infoln "Installing Fabric 3.0.0-beta..."
  curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh && chmod +x install-fabric.sh
  ./install-fabric.sh --fabric-version 3.0.0-beta binary

  res=$?
  verifyResult $res "Installation has failed."
  successln "Fabric install successful."

  # we don't need these config files we already have them
  rm -rf config
}

checkPrereq() {
  peer > /dev/null 2>&1
  if [[ $? -ne 0 || ! -d "./bin" ]]; then
    errorln "Peer binary and configuration files not found.."
    errorln
    errorln "Follow the instructions in the Fabric docs to install the Fabric Binaries:"
    errorln "https://hyperledger-fabric.readthedocs.io/en/latest/install.html"
    exit 1
  fi

  #if test $res -ne 0; then
  #  errorln "Fabric is not installed."
  #  installPrereq
  #else
  #  version=$(peer version | grep Version | awk '{print $2}')
  #  if [ "$version" != "v3.0.0-beta" ]; then
  #    errorln "Unsupported Fabric version: $version"
  #    rm -rf ./bin ./builders
  #    installPrereq
  #  fi
  #fi
}

display_help() {
  echo "USAGE: network.sh {up|down|setup}"
  echo "DESCRIPTION:"
  echo -ne "  up: bring network up starting dockers\n"
  echo -ne "  down: bring network down shutting down dockers\n"
  echo -ne "  purge: bring network down removing all containers, images, and volumes\n"
  echo -ne "  setup: configure crypto material, start dockers, create channel, package and deploy chaincode\n"
  echo -ne "  restart: bring new network up without generating new crypto material\n"
}

createOrgs() {
  rm -Rf organizations/peerOrganizations && rm -Rf organizations/ordererOrganizations

  infoln "Generating certificates using cryptogen tool"

  infoln "Creating Org1 Identities"

  set -x
  cryptogen generate --config=./cryptogen/crypto-config-org1.yaml --output="organizations"
  res=$?
  { set +x; } 2>/dev/null
  if [ $res -ne 0 ]; then
    fatalln "Failed to generate certificates..."
  fi

  infoln "Creating Org2 Identities"

  set -x
  cryptogen generate --config=./cryptogen/crypto-config-org2.yaml --output="organizations"
  res=$?
  { set +x; } 2>/dev/null
  if [ $res -ne 0 ]; then
    fatalln "Failed to generate certificates..."
  fi

  infoln "Creating Orderer Org Identities"

  set -x
  cryptogen generate --config=./cryptogen/crypto-config-orderer.yaml --output="organizations"
  res=$?
  { set +x; } 2>/dev/null
  if [ $res -ne 0 ]; then
    fatalln "Failed to generate certificates..."
  fi

  successln "Successfully created all organization identities"

  infoln "Generating CCP files for Org1 and Org2"
  ./connection-profiles/ccp-generate.sh
}

networkPurge() {
  docker-compose ${COMPOSE_FILES} down --rmi all --volumes --remove-orphans
}

networkDown() {
  infoln "Removing generated chaincode docker images"
  docker image rm -f $(docker images -aq --filter reference='dev-peer*') 2>/dev/null || true

  infoln "Removing remaining containers"
  docker rm -f $(docker ps -aq --filter label=service=hyperledger-fabric) 2>/dev/null || true
  docker rm -f $(docker ps -aq --filter name='dev-peer*') 2>/dev/null || true
  docker kill $(docker ps -q --filter name=ccaas) 2>/dev/null || true

  infoln "Removing remaining volumes"
  docker-compose ${COMPOSE_FILES} down --volumes --remove-orphans

  res=$?
  verifyResult $res "Network shutdown failed"
}

networkUp() {
  bringUpNetwork="false"

  if ! docker stats --no-stream > /dev/null; then
    open /Applications/Docker.app
    while (! docker stats --no-stream ); do
      # Docker takes a few seconds to initialize
      echo "Waiting for Docker to launch..."
      sleep 1
    done
  fi

  # check if all containers are present
  CONTAINERS=($(docker ps | grep hyperledger/ | awk '{print $2}'))
  len=$(echo ${#CONTAINERS[@]})

  if [[ $len -ge 4 ]] && [[ ! -d "organizations/peerOrganizations" ]]; then
    echo "Bringing network down to sync certs with containers"
    networkDown
  fi

  [[ $len -lt 4 ]] || [[ ! -d "organizations/peerOrganizations" ]] && bringUpNetwork="true" || echo "Network Running Already"

  if [ $bringUpNetwork == "true"  ]; then
    infoln "Bringing up network"
    docker-compose $COMPOSE_FILES up -d
  fi

  #docker-compose ${COMPOSE_FILES} up -d
  #res=$?
  #verifyResult $res "Dockers did not start."

  #if [[ -z ${docker-compose $COMPOSE_FILES ps -q} ]]; then
  #  errorln "Dockers did not started correctly."
  #  exit 1
  #fi
}

. ./scripts/envVar.sh

if [ $# -ne 1 ]; then
    echo "Error: Incorrect number of arguments."
    display_help
    exit 1
fi

case $1 in
  up)
    networkUp
    ;;
  down)
    networkDown
    ;;
  purge)
    networkPurge
    ;;
  setup)
    #checkPrereq
    createOrgs
    networkUp
    . ./scripts/create-channel.sh
    ;;
  deploy)
    . ./scripts/packageCC.sh
    . ./scripts/deployCC.sh
    ;;
  *)
    echo "Error: Invalid argument."
    display_help
    exit 1
esac

exit 0