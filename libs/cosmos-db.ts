//  Copyright PrimeObjects Software Inc. and other contributors <https://www.primeobjects.com/>
// 
//  This source code is licensed under the MIT license.
//  The detail information can be found in the LICENSE file in the root directory of this source tree.

import {  isArray } from 'lodash';
import { isNonEmptyString} from 'douhub-helper-util';
import { getSecretValue } from './secret-manager';
import { isObject } from 'douhub-helper-util';
import { CosmosClient } from '@azure/cosmos';

let _cosmosDB: Record<string,any> = {};

const getCosmosDb = async () => {

    if (_cosmosDB) return _cosmosDB;

    const coreDBConnectionInfo = (await getSecretValue('COSMOS_DB')).split("|");
    _cosmosDB = {};

    _cosmosDB.settings = {
        type: "cosmosDb",
        uri: coreDBConnectionInfo[0],
        key: coreDBConnectionInfo[1],
        collectionId: coreDBConnectionInfo[2],
        databaseId: coreDBConnectionInfo[3],
    };

    try {
        _cosmosDB.client = new CosmosClient({
            endpoint: _cosmosDB.settings.uri,
            key: _cosmosDB.settings.key
        });
    }
    catch (error) {
        console.error({ error, message: 'Failed to new CosmosClient', settings: _cosmosDB.settings });
    }

    return _cosmosDB;
};

export const cosmosDbClient = async () => {
    if (_cosmosDB) return _cosmosDB.client;
    return (await getCosmosDb()).client;
};

export const cosmosDbSettings = async () => {
    if (_cosmosDB) return _cosmosDB.settings;
    return (await getCosmosDb()).settings;
};


export const cosmosDBDelete = async (data: Record<string,any>) => {

    const coreDBSettings = await cosmosDbSettings();
    const container = ((await cosmosDbClient()).database(coreDBSettings.databaseId)).container(coreDBSettings.collectionId);
    await container.item(data.id, isNonEmptyString(data.partitionKey) ? data.partitionKey : data.organizationId).delete();

};

export const cosmosDBQuery = async (query:string , parameters: Record<string,any>, settings?: Record<string,any>) => {

    const includeAzureInfo = settings?.includeAzureInfo;

    const coreDBSettings = await cosmosDbSettings();
    const container = ((await cosmosDbClient()).database(coreDBSettings.databaseId)).container(coreDBSettings.collectionId);

    const response = await container.items.query({ query, parameters }, { enableCrossPartitionQuery: true }).fetchAll();
    return !includeAzureInfo ? response.resources : response;
};

export const cosmosDBUpsert = async (data:Record<string,any>) => {
    const coreDBSettings = await cosmosDbSettings();
    const container = ((await cosmosDbClient()).database(coreDBSettings.databaseId)).container(coreDBSettings.collectionId);
    await container.items.upsert(data);
};


export const cosmosDBUpdateIfMatch = async (data:Record<string,any>) => {
    const coreDBSettings = await cosmosDbSettings();
    const container = ((await cosmosDbClient()).database(coreDBSettings.databaseId)).container(coreDBSettings.collectionId);
    await container.item(data.id).replace(data, { accessCondition: { type: "IfMatch", condition: data["_etag"] } });
};

export const cosmosDBUpdate = async (data:Record<string,any>) => {
    const coreDBSettings = await cosmosDbSettings();
    const container = ((await cosmosDbClient()).database(coreDBSettings.databaseId)).container(coreDBSettings.collectionId);
    await container.item(data.id).replace(data);
};

export const cosmosDBRetrieve = async (id:string, settings?:Record<string,any>): Promise<Record<string,any> | null> => {

    if (!isNonEmptyString(id)) return null;
    if (!isObject(settings)) settings = {};

    const includeAzureInfo = settings?.includeAzureInfo;
    let attributes = settings?.attributes;

    attributes = !isNonEmptyString(attributes) ? '*' :
        `,${attributes}`.split(',').join(',c.').replace(/ /g, '').substring(1);

    const result = await cosmosDBQuery(`SELECT ${attributes} FROM c WHERE c.id=@id`, [
        {
            name: '@id',
            value: id
        }
    ], { includeAzureInfo: true });
    const data = result.resources;
    return !includeAzureInfo ? (isArray(data) && data.length == 1 ? data[0] : null) : result;
};