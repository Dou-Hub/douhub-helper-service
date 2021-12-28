//  Copyright PrimeObjects Software Inc. and other contributors <https://www.primeobjects.com/>
// 
//  This source code is licensed under the MIT license.
//  The detail information can be found in the LICENSE file in the root directory of this source tree.

import { isArray, isObject, isNil } from 'lodash';
import { isNonEmptyString, removeNoValueProperty, _process } from 'douhub-helper-util';
import { DynamoDB } from 'aws-sdk';

export const getDynamoDB = (region?: string) => {
    region = region ? region : 'us-east-1';
    if (isNil(_process._dynamoDb))  _process._dynamoDb={};
    if (!_process._dynamoDb[region]) _process._dynamoDb[region] = new DynamoDB.DocumentClient({ region });
    return _process._dynamoDb[region];
}

export const dynamoDBDelete = async (id: string, tableName: string, keyName: string, region?: string) => {

    if (!isNonEmptyString(id)) throw new Error('ERROR_API_MISSING_PARAMETERS');
    if (!isNonEmptyString(keyName)) keyName = 'id';

    const params: Record<string, any> = { TableName: tableName, Key: {} };
    params.Key[keyName] = id;

    await (getDynamoDB(region)).delete(params).promise();
};

export const dynamoDBRetrieve = async (key: string, tableName: string, region?: string, attributes?: Array<string>, keyName?: string): Promise<Record<string,any>> => {

    if (!isNonEmptyString(key)) throw new Error('ERROR_API_MISSING_PARAMETERS');
    
    const params: Record<string, any> = { TableName: tableName, Key: {} };
    params.Key[keyName?keyName:'id'] = key;

    if (isArray(attributes)) params.AttributesToGet = attributes; //e.g. ["Artist", "Genre"]

    const record = (await (getDynamoDB(region)).get(params).promise()).Item;

    return record || null;
};

export const dynamoDBCreate = async (data: Record<string, any>, tableName: string, region?: string) :Promise<Record<string,any>> => {

    if (!data) throw new Error('ERROR_API_MISSING_PARAMETERS');

    delete data['_etag'];
    delete data['_ts'];
    delete data['_charge'];
    delete data['_self'];

    data = processDataForCreate(data);

    const params = { TableName: tableName, Item: data };
    await (getDynamoDB(region)).put(params).promise();

    return data;
};

//If the record does not exist, this will be a create/insert operation
//If the record exists, it will be a partial update
export const dynamoDBUpsert = async (data: Record<string, any>, tableName: string, fullUpdate: boolean, region?: string, keyName?: string):Promise<Record<string,any>> => {

    if (!data) throw new Error('ERROR_API_MISSING_PARAMETERS');
    const newKeyName: string = keyName?keyName: 'id';
    if (!isNonEmptyString(data[newKeyName])) throw new Error('ERROR_API_MISSING_PARAMETERS');

    delete data['_charge'];
    delete data['_key'];

    //Get the current version of data in the database, we will have to retrieve
    const oriData = await dynamoDBRetrieve(data[newKeyName], tableName, region, undefined, newKeyName);

    //if oriData is undefined, it means the record does not exist
    //we will create a new record
    if (!oriData) return await dynamoDBCreate(data,tableName, region);

    //remove some system properties
    delete oriData['aws:rep:updateregion'];
    delete oriData['aws:rep:updatetime'];
    delete oriData['aws:rep:deleting'];
    delete data['aws:rep:updateregion'];
    delete data['aws:rep:updatetime'];
    delete data['aws:rep:deleting'];

    //we will review existing data and new data, to generate UpdateExpression
    const updateParams = createUpdateExpression(oriData, data, fullUpdate);

    //if nothing to update, return oriData
    if (updateParams.updateExpression.length == 0) {
        return oriData;
    }
    else {
        const data: Record<string, any> = {
            TableName: tableName,
            Key: {},
            ReturnValues: "NONE",
            UpdateExpression: updateParams.updateExpression,
            ExpressionAttributeValues: updateParams.expressionAttributeValues,
            ExpressionAttributeNames: updateParams.expressionAttributeNames
        };

        data.Key[newKeyName] = oriData[newKeyName];
        await (getDynamoDB(region)).update(data).promise();

        return updateParams.data;
    }
};

//process data used for create/put
const processDataForCreate = (data: Record<string, any>) => {
    return removeNoValueProperty(data, true);
};

//because dynamodb only accept UpdateExpression and ExpressionAttributeValues
//it does not accept a json data to simply do partial update
//we will have to parse json data to the format dynamodb can support
//the function below will only take care the level one properties
//if the property value in the new data is null or undefined, it will be removed, it means removed property has to be explicitly defined with null or undefiend value
//if the property has value in old date but the property does not exist in new data, the property in the old data will be used, this will allow support partial update
//if the value is changes or new property in the new data, it will be updated or added by using SET
const createUpdateExpression = (oldData: Record<string,any>, newData: Record<string,any>, fullUpdate: boolean) => {
    let expressionRemove = '';
    let expressionUpdate = '';
    let expressionAttributeValues: Record<string,any> = {};
    let expressionAttributeNames: Record<string,any> = {};

    const data: Record<string,any> = {};

    //handle remove
    let p = null;
    for (p in newData) {
        let newDataValue = newData[p];
        let oldDataValue = oldData[p];

        // if new value is explicitly undefined or null, it is a REMOVE
        // because dynamoDB API does not support new value to be empty string, stupid, but we will have to handle it as a remove.
        if (newDataValue === undefined || newDataValue === null || newDataValue === '') {
            delete oldData[p];
            delete newData[p];
            newDataValue = null;
            oldDataValue = null;
            expressionRemove = expressionRemove.length == 0 ? `REMOVE #${p}` : `${expressionRemove}, #${p}`;
            expressionAttributeNames[`#${p}`] = p;
        }

        //If there's no value but has no old value, it is a SET
        if (newDataValue !== undefined && newDataValue !== null && (oldDataValue === undefined || oldDataValue === null)) {
            expressionUpdate = expressionUpdate.length == 0 ? `SET #${p}=:${p}` : `${expressionUpdate},#${p}=:${p}`;
            expressionAttributeNames[`#${p}`] = p;

            newDataValue = isObject(newDataValue) ? removeNoValueProperty(newDataValue, true) : newDataValue;
            expressionAttributeValues[`:${p}`] = newDataValue;

            //give new value to old data, so it can be skipped in the next step
            oldData[p] = newDataValue;
            data[p] = newDataValue;
        }

    }

    //handle set
    for (p in oldData) {
        let newDataValue = newData[p];
        const oldDataValue = oldData[p];

        //check whether there's new data
        if (newDataValue !== undefined && newDataValue !== null) {
            //if new value is object or array, always override old data
            if (isArray(newDataValue) || isObject(newDataValue)) {
                //in case it has been handled in the previous step
                if (!expressionAttributeValues[`:${p}`]) {
                    expressionUpdate = expressionUpdate.length == 0 ? `SET #${p}=:${p}` : `${expressionUpdate},#${p}=:${p}`;

                    newDataValue = isObject(newDataValue) ? removeNoValueProperty(newDataValue, true) : newDataValue;
                    expressionAttributeValues[`:${p}`] = newDataValue;
                    expressionAttributeNames[`#${p}`] = p;

                    data[p] = newDataValue;
                }
            }
            else {
                //for other type of value, we will compare and decide
                if (oldDataValue !== newDataValue && !expressionAttributeValues[`:${p}`]) {
                    expressionUpdate = expressionUpdate.length == 0 ? `SET #${p}=:${p}` : `${expressionUpdate},#${p}=:${p}`;
                    expressionAttributeValues[`:${p}`] = newDataValue;
                    expressionAttributeNames[`#${p}`] = p;

                    data[p] = newDataValue;
                }
                else {
                    if (oldDataValue !== undefined && oldDataValue !== null) data[p] = oldDataValue;
                }
            }
        }
        else {
            //if fullUpdate===true, it means newData has everything we need
            //so if there's no value in the newData but it has value in the oldData, we will do a remove
            if (fullUpdate && oldDataValue) {
                expressionRemove = expressionRemove.length == 0 ? `REMOVE #${p}` : `${expressionRemove}, #${p}`;
                expressionAttributeNames[`#${p}`] = p;
                delete data[p];
            }
            else {
                data[p] = oldDataValue;
            }

        }
    }

    return {
        updateExpression: (`${expressionUpdate} ${expressionRemove}`).trim(),
        expressionAttributeValues, expressionAttributeNames,
        data
    };
};
