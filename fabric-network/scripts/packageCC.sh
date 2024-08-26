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

infoln "Packaging chaincode"
set -x
vendorCC
peer lifecycle chaincode package ${CC_NAME}.tar.gz --path ${CC_SRC_PATH} --lang golang --label ${CC_NAME}_${CC_VERSION} >&log.txt
res=$?
{ set +x; } 2>/dev/null
cat log.txt
PACKAGE_ID=$(peer lifecycle chaincode calculatepackageid ${CC_NAME}.tar.gz)
verifyResult $res "Chaincode packaging has failed"
successln "Chaincode is packaged"