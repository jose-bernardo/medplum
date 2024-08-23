package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"github.com/hyperledger/fabric-chaincode-go/shim"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
	"log"
	"time"
)

type Contract struct {
	contractapi.Contract
}

type EHR struct {
	ID   string `json:"ID"`
	To   string `json:"To"`
	From string `json:"From"`
	Hash string `json:"Hash"`
}

type HistoryQueryResult struct {
	Record    *EHR      `json:"Record"`
	TxId      string    `json:"TXId"`
	Timestamp time.Time `json:"Timestamp"`
	IsDelete  bool      `json:"IsDelete"`
}

type ActionLogEntry struct {
	ID                 string    `json:"ID"`
	Requestor          string    `json:"Requestor"`
	Timestamp          time.Time `json:"Timestamp"`
	RecordID           string    `json:"RecordID"`
	FunctionName       string    `json:"FunctionName"`
	FunctionParameters []string  `json:"FunctionParameters"`
}

type ResponseWrapper struct {
	EHR            *EHR            `json:"EHR"`
	ActionLogEntry *ActionLogEntry `json:"ActionLogEntry"`
}

func (s *Contract) readState(ctx contractapi.TransactionContextInterface, id string) ([]byte, error) {
	ehrJSON, err := ctx.GetStub().GetState(id)
	if err != nil {
		return nil, fmt.Errorf("failed to read from world state: %v", err)
	}

	if ehrJSON == nil {
		return nil, fmt.Errorf("the ehr %s does not exist", id)
	}

	return ehrJSON, nil
}

func (s *Contract) logAction(ctx contractapi.TransactionContextInterface, ehrId string) (*ActionLogEntry, error) {
	creator, err := ctx.GetStub().GetCreator()
	if err != nil {
		return nil, err
	}

	timestamp, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return nil, err
	}

	functionName, parameters := ctx.GetStub().GetFunctionAndParameters()

	// Create log payload
	logEntry := ActionLogEntry{
		ID:                 ctx.GetStub().GetTxID(),
		Requestor:          base64.StdEncoding.EncodeToString(creator),
		Timestamp:          timestamp.AsTime(),
		RecordID:           ehrId,
		FunctionName:       functionName,
		FunctionParameters: parameters,
	}

	logEntryJSON, err := json.Marshal(logEntry)
	if err != nil {
		return nil, err
	}

	err = ctx.GetStub().PutState(logEntry.ID, logEntryJSON)
	if err != nil {
		return nil, err
	}

	return &logEntry, nil
}

func (s *Contract) CreateEHR(ctx contractapi.TransactionContextInterface, id string, hash string) (*ResponseWrapper, error) {
	existing, err := s.readState(ctx, id)
	if err == nil && existing != nil {
		return nil, fmt.Errorf("the ehr %s already exists", id)
	}

	// creator is the Identity's public key
	creator, err := ctx.GetStub().GetCreator()
	if err != nil {
		return nil, err
	}

	ehr := EHR{
		ID:   id,
		Hash: hash,
		To:   base64.StdEncoding.EncodeToString(creator),
		From: base64.StdEncoding.EncodeToString(creator),
	}

	ehrJSON, err := json.Marshal(ehr)
	if err != nil {
		return nil, err
	}

	err = ctx.GetStub().PutState(ehr.ID, ehrJSON)
	if err != nil {
		return nil, err
	}

	logAction, err := s.logAction(ctx, ehr.ID)
	if err != nil {
		return nil, err
	}

	response := ResponseWrapper{
		EHR:            &ehr,
		ActionLogEntry: logAction,
	}

	return &response, nil
}

func (s *Contract) ReadActionLogEntry(ctx contractapi.TransactionContextInterface, id string) (*ActionLogEntry, error) {
	entryJSON, err := s.readState(ctx, id)
	if err != nil {
		return nil, err
	}

	var entry ActionLogEntry
	err = json.Unmarshal(entryJSON, &entry)
	if err != nil {
		return nil, err
	}

	return &entry, nil
}

func (s *Contract) ReadEHRNoLog(ctx contractapi.TransactionContextInterface, id string) (*ResponseWrapper, error) {
	ehrJSON, err := s.readState(ctx, id)
	if err != nil {
		return nil, err
	}

	var ehr EHR
	err = json.Unmarshal(ehrJSON, &ehr)
	if err != nil {
		return nil, err
	}

	response := ResponseWrapper{
		EHR:            &ehr,
		ActionLogEntry: nil,
	}

	return &response, nil
}

func (s *Contract) ReadEHR(ctx contractapi.TransactionContextInterface, id string) (*ResponseWrapper, error) {
	ehrJSON, err := s.readState(ctx, id)
	if err != nil {
		return nil, err
	}

	var ehr EHR
	err = json.Unmarshal(ehrJSON, &ehr)
	if err != nil {
		return nil, err
	}

	logAction, err := s.logAction(ctx, id)
	if err != nil {
		return nil, err
	}

	response := ResponseWrapper{
		EHR:            &ehr,
		ActionLogEntry: logAction,
	}

	return &response, nil
}

// constructQueryResponseFromIterator constructs a slice of assets from the resultsIterator
func constructQueryResponseFromIterator(resultsIterator shim.StateQueryIteratorInterface) ([]*EHR, error) {
	var ehrs []*EHR
	for resultsIterator.HasNext() {
		queryResult, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}
		var ehr EHR
		err = json.Unmarshal(queryResult.Value, &ehr)
		if err != nil {
			return nil, err
		}

		ehrs = append(ehrs, &ehr)
	}

	return ehrs, nil
}

// getQueryResultForQueryString executes the passed in query string.
// The result set is built and returned as a byte array containing the JSON results.
func getQueryResultForQueryString(ctx contractapi.TransactionContextInterface, queryString string) ([]*EHR, error) {
	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	return constructQueryResponseFromIterator(resultsIterator)
}

// QueryEHRCustom queries for ehrs based on query string
func (s *Contract) QueryEHRCustom(ctx contractapi.TransactionContextInterface, queryString string) ([]*EHR, error) {
	return getQueryResultForQueryString(ctx, queryString)
}

// QueryEHRByOwner queries for ehrs based on the owners name.
func (s *Contract) QueryEHRByOwner(ctx contractapi.TransactionContextInterface, owner string) ([]*EHR, error) {
	queryString := fmt.Sprintf(`{"selector":{"Owner"":"%s"}}, "use_index": ["_design/index1Doc", "index1Doc"]`, owner)
	return getQueryResultForQueryString(ctx, queryString)
}

// QueryEHRByResourceType queries for ehrs based on the resource type.
func (s *Contract) QueryEHRByResourceType(ctx contractapi.TransactionContextInterface,
	resourceType string) ([]*EHR, error) {
	queryString := fmt.Sprintf(`{"selector":{"ResourceType":"%s"}}, "use_index": ["_design/index2Doc", "index2Doc"]`, resourceType)
	return getQueryResultForQueryString(ctx, queryString)
}

// QueryEHRByAll queries for ehrs based on the owners name and resource type.
func (s *Contract) QueryEHRByAll(ctx contractapi.TransactionContextInterface,
	owner string, resourceType string) ([]*EHR, error) {
	queryString := fmt.Sprintf(`{"selector":{"Owner":"%s", "ResourceType":"%s"}}`, owner, resourceType)
	return getQueryResultForQueryString(ctx, queryString)
}

// DeleteEHR deletes an ehr from the world state
func (s *Contract) DeleteEHR(ctx contractapi.TransactionContextInterface, id string) (*ResponseWrapper, error) {
	_, err := s.readState(ctx, id)
	if err != nil {
		return nil, err
	}

	err = ctx.GetStub().DelState(id)
	if err != nil {
		return nil, err
	}

	logAction, err := s.logAction(ctx, id)
	if err != nil {
		return nil, err
	}

	response := ResponseWrapper{
		EHR:            nil,
		ActionLogEntry: logAction,
	}

	return &response, nil
}

// GetEHRHistory returns the chain of custody for an ehr since issuance.
func (s *Contract) GetEHRHistory(ctx contractapi.TransactionContextInterface, id string) ([]HistoryQueryResult, error) {
	log.Printf("GetEHRHistory: ID %v", id)

	resultsIterator, err := ctx.GetStub().GetHistoryForKey("ReadAsset")
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var ehrs []HistoryQueryResult
	for resultsIterator.HasNext() {
		response, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var ehr EHR
		if len(response.Value) > 0 {
			err = json.Unmarshal(response.Value, &ehr)
			if err != nil {
				return nil, err
			}
		} else {
			ehr = EHR{
				ID: id,
			}
		}

		timestamp := response.Timestamp.AsTime()

		record := HistoryQueryResult{
			TxId:      response.TxId,
			Timestamp: timestamp,
			Record:    &ehr,
			IsDelete:  response.IsDelete,
		}
		ehrs = append(ehrs, record)

	}

	return ehrs, nil
}

func main() {
	ehrChaincode, err := contractapi.NewChaincode(&Contract{})

	if err != nil {
		log.Panicf("Error creating ehr chaincode: %v", err)
	}

	if err := ehrChaincode.Start(); err != nil {
		log.Panicf("Error starting ehr chaincode: %v", err)
	}
}
