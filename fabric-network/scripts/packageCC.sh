function compileCC() {
  mkdir -p packagedChaincode
  infoln "Compiling TypeScript code into JavaScript..."
  pushd $CC_SRC_PATH
  npm install
  npm run build
  popd
  successln "Finished compiling TypeScript code into JavaScript"
}

infoln "Packaging chaincode"
compileCC
set -x
peer lifecycle chaincode package ${CC_NAME}.tar.gz --path ${CC_SRC_PATH} --lang node --label ${CC_NAME}_${CC_VERSION} >&log.txt
res=$?
{ set +x; } 2>/dev/null
cat log.txt
PACKAGE_ID=$(peer lifecycle chaincode calculatepackageid ${CC_NAME}.tar.gz)
verifyResult $res "Chaincode packaging has failed"
successln "Chaincode is packaged"