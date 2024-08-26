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
  peer > /dev/null
  res=$?
  if test $res -ne 0; then
    errorln "Fabric is not installed."
    installPrereq
  else
    version=$(peer version | grep Version | awk '{print $2}')
    if [ "$version" != "v3.0.0-beta" ]; then
      errorln "Unsupported Fabric version: $version"
      rm -rf ./bin ./builders
      installPrereq
    fi
  fi
}

display_help() {
  echo "USAGE: network.sh {up|down|setup}"
  echo "DESCRIPTION:"
  echo -ne "  up: bring network up starting dockers\n"
  echo -ne "  down: bring network down shutting down dockers\n"
  echo -ne "  purge: bring network down removing all containers, images, and volumes\n"
  echo -ne "  setup: configure crypto material, start dockers, create channel, package and deploy chaincode\n"
}

createOrgs() {
  infoln "Generating certificates using cryptogen tool"

  set -x
  cryptogen generate --config=cryptogen/crypto-config.yaml --output="organizations"
  { set +x; } 2>/dev/null

  cp -r organizations ../packages/server/organizations

  successln "Successfully created all organization identities"
}

networkPurge() {
  docker-compose ${COMPOSE_FILES} down --rmi all --volumes --remove-orphans
  res=$?
  verifyResult $res "Dockers purge failed"
  rm -rf ${PWD}/channel-artifacts ${PWD}/packagedChaincode
}

networkDown() {
  docker-compose ${COMPOSE_FILES} down --volumes --remove-orphans
  res=$?
  verifyResult $res "Network shutdown failed"
}

networkUp() {
  if ! docker stats --no-stream > /dev/null; then
    open /Applications/Docker.app
    while (! docker stats --no-stream ); do
      # Docker takes a few seconds to initialize
      echo "Waiting for Docker to launch..."
      sleep 1
    done
  fi

  if [[ -n $(docker-compose $COMPOSE_FILES ps -q) ]]; then
    infoln "A previous network is already running."
    infoln "Do you want to bring it down? (y/n)"
    read -r input
    input=$(echo $input | tr '[:upper:]' '[:lower:]')
    if [[ $input == "y" || $input == "yes" ]]; then
      networkDown
    else
      exit 0
    fi
  fi

  infoln "Bringing up network..."

  docker-compose ${COMPOSE_FILES} up -d
  res=$?
  verifyResult $res "Dockers did not start."

  if [[ -z ${docker-compose $COMPOSE_FILES ps -q} ]]; then
    errorln "Dockers did not started correctly."
    exit 1
  fi
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
    checkPrereq
    if [ ! -d "organizations/peerOrganizations" ]; then
      createOrgs
    fi
    networkUp
    . ./scripts/create-channel.sh
    . ./scripts/packageCC.sh
    . ./scripts/deployCC.sh
    ;;
  *)
    echo "Error: Invalid argument."
    display_help
    exit 1
esac

exit 0