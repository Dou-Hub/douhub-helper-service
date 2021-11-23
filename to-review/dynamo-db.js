
//  COPYRIGHT:       PrimeObjects Software Inc. (C) 2021 All Right Reserved
//  COMPANY URL:     https://www.primeobjects.com/
//  CONTACT:         developer@primeobjects.com
// 
//  This source is subject to the PrimeObjects License Agreements. 
// 
//  Our EULAs define the terms of use and license for each PrimeObjects product. 
//  Whenever you install a PrimeObjects product or research PrimeObjects source code file, you will be prompted to review and accept the terms of our EULA. 
//  If you decline the terms of the EULA, the installation should be aborted and you should remove any and all copies of our products and source code from your computer. 
//  If you accept the terms of our EULA, you must abide by all its terms as long as our technologies are being employed within your organization and within your applications.
// 
//  THIS CODE AND INFORMATION IS PROVIDED "AS IS" WITHOUT WARRANTY
//  OF ANY KIND, EITHER EXPRESSED OR IMPLIED, INCLUDING BUT NOT
//  LIMITED TO THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
//  FITNESS FOR A PARTICULAR PURPOSE.
// 
//  ALL OTHER RIGHTS RESERVED

import _ from './base';

export const deleteRecord = async (id, tableName, keyName) => {

    if (!_.isNonEmptyString(id)) throw new Error('ERROR_API_MISSING_PARAMETERS');
    if (!_.isNonEmptyString(keyName)) keyName = 'id';

    const params = { TableName: tableName, Key: {} };
    params.Key[keyName] = id;

    if (_.trackLibs) console.log("Attempting a conditional delete...");
    await _.dynamoDb.delete(params).promise();
};

export const retrieveRecord = async  (key, tableName, attributes, keyName) => {

    if (!_.isNonEmptyString(key)) throw new Error('ERROR_API_MISSING_PARAMETERS');
    if (!_.isNonEmptyString(keyName)) keyName = 'id';

    const params = { TableName: tableName, Key: {} };
    params.Key[keyName] = key;

    if (_.isArray(attributes)) params.AttributesToGet = attributes; //e.g. ["Artist", "Genre"]

    const record = (await _.dynamoDb.get(params).promise()).Item;

    return record || null;
};


export const createRecord = async  (data, tableName) => 
{

    if (!_.isObject(data)) throw new Error('ERROR_API_MISSING_PARAMETERS');

    delete data['_etag'];
    delete data['_ts'];
    delete data['_charge'];
    delete data['_self'];

    const params = { TableName: tableName, Item: data };
    await _.dynamoDb.put(params).promise();
};

//If the record does not exist, this will be a create/insert operation
//If the record exists, it will be a partial update
export const upsertRecord = async  (data, tableName, fullUpdate, keyName) => {

    if (!_.isObject(data)) throw new Error('ERROR_API_MISSING_PARAMETERS');
    if (!_.isNonEmptyString(keyName)) keyName = 'id';
    if (!_.isNonEmptyString(data[keyName])) throw new Error('ERROR_API_MISSING_PARAMETERS');

    // delete data['_etag'];
    // delete data['_ts'];
    delete data['_charge'];
    // delete data['_self'];
    // delete data['_rid'];
    // delete data['_attachments'];
    delete data['_key'];

    //Get the current version of data in the database, we will have to retrieve

    const oriData = await retrieveRecord(data[keyName], tableName, null, keyName);

    //if oriData is undefined, it means the record does not exist
    //we will create a new record
    if (!oriData) {

        data = processDataForCreate(data);

        //create a new record
        await _.dynamoDb.put({
            TableName: tableName,
            Item: data
        }).promise();

        return data;
    }

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
        const data = {
            TableName: tableName,
            Key: {},
            ReturnValues: "NONE",
            UpdateExpression: updateParams.updateExpression,
            ExpressionAttributeValues: updateParams.expressionAttributeValues,
            ExpressionAttributeNames: updateParams.expressionAttributeNames
        };

        data.Key[keyName] = oriData[keyName];
        await _.dynamoDb.update(data).promise();

        return updateParams.data;
    }
};

//process data used for create/put
const processDataForCreate = (data) => {
    data = _.removeNoValueProperty(data, true);
    if (_.trackLibs) console.log(data);
    return data;
};

//because dynamodb only accept UpdateExpression and ExpressionAttributeValues
//it does not accept a json data to simply do partial update
//we will have to parse json data to the format dynamodb can support
//the function below will only take care the level one properties
//if the property value in the new data is null or undefined, it will be removed, it means removed property has to be explicitly defined with null or undefiend value
//if the property has value in old date but the property does not exist in new data, the property in the old data will be used, this will allow support partial update
//if the value is changes or new property in the new data, it will be updated or added by using SET
const createUpdateExpression = (oldData, newData, fullUpdate) => {
    let expressionRemove = '';
    let expressionUpdate = '';
    let expressionAttributeValues = {};
    let expressionAttributeNames = {};

    const data = {};

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

            newDataValue = _.isObject(newDataValue) ? _.removeNoValueProperty(newDataValue, true) : newDataValue;
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
            if (_.isArray(newDataValue) || _.isObject(newDataValue)) {
                //in case it has been handled in the previous step
                if (!expressionAttributeValues[`:${p}`]) {
                    expressionUpdate = expressionUpdate.length == 0 ? `SET #${p}=:${p}` : `${expressionUpdate},#${p}=:${p}`;

                    newDataValue = _.isObject(newDataValue) ? _.removeNoValueProperty(newDataValue, true) : newDataValue;
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

export default {createRecord, upsertRecord, deleteRecord};