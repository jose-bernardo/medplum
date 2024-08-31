#!/usr/bin/env bash

#npx caliper 2> /dev/null
#res=$?
#if [ $res -ne 0 ]; then
#  npm install --only=prod @hyperledger/caliper-cli
#fi

npx caliper bind --caliper-bind-sut fabric:2.4

npx caliper launch manager --caliper-workspace ./ --caliper-networkconfig network.yaml --caliper-benchconfig chaincode/medsky/config.yaml --caliper-flow-only-test --caliper-fabric-gateway-enabled