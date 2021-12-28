//  Copyright PrimeObjects Software Inc. and other contributors <https://www.primeobjects.com/>
// 
//  This source code is licensed under the MIT license.
//  The detail information can be found in the LICENSE file in the root directory of this source tree.

import { isArray } from 'lodash';
import { isNonEmptyString } from 'douhub-helper-util';
import { getSecretValue} from './secret-manager';
import { isObject, _process } from 'douhub-helper-util';
import { CosmosClient } from '@azure/cosmos';

export const getCosmosDb = async () => {

    if (isObject(_process._cosmosDB)) return _process._cosmosDB;
    const secrets = await getSecretValue('COSMOS_DB');
   
    const coreDBConnectionInfo = secrets.split("|");
    _process._cosmosDB = {};
    _process._cosmosDB.settings = {
        type: "cosmosDb",
        uri: coreDBConnectionInfo[0],
        key: coreDBConnectionInfo[1],
        collectionId: coreDBConnectionInfo[2],
        databaseId: coreDBConnectionInfo[3],
    };

    try {
        _process._cosmosDB.client = new CosmosClient({
            endpoint: _process._cosmosDB.settings.uri,
            key: _process._cosmosDB.settings.key
        });
    }
    catch (error) {
        console.error({ error, message: 'Failed to new CosmosClient', settings: _process._cosmosDB.settings });
    }

    return _process._cosmosDB;
};

export const cosmosDbClient = async () => {
    return (await getCosmosDb()).client;
};

export const cosmosDbSettings = async () => {
    return (await getCosmosDb()).settings;
};

export const cosmosDBDatabase = async () => {
    return (await cosmosDbClient()).database((await cosmosDbSettings()).databaseId);
}

export const cosmosDBContainer = async () => {
    return (await cosmosDBDatabase()).container((await cosmosDbSettings()).collectionId);
}

export const cosmosDBDelete = async (data: Record<string, any>) => {
    await (await cosmosDBContainer()).item(data.id, isNonEmptyString(data.partitionKey) ? data.partitionKey : data.organizationId).delete();
};

export const cosmosDBQuery = async (query: string, parameters: Record<string, any>, settings?: Record<string, any>) => {
    const includeAzureInfo = settings?.includeAzureInfo;
    const response = await (await cosmosDBContainer()).items.query({ query, parameters }, { enableCrossPartitionQuery: true }).fetchAll();
    return !includeAzureInfo ? response.resources : response;
};

export const cosmosDBUpsert = async (data: Record<string, any>) => {
    await (await cosmosDBContainer()).items.upsert(data);
};


export const cosmosDBUpdateIfMatch = async (data: Record<string, any>) => {
    await (await cosmosDBContainer()).item(data.id).replace(data, { accessCondition: { type: "IfMatch", condition: data["_etag"] } });
};

export const cosmosDBUpdate = async (data: Record<string, any>) => {
    
    await (await cosmosDBContainer()).item(data.id).replace(data);
};

export const cosmosDBRetrieve = async (id: string, settings?: Record<string, any>): Promise<Record<string, any> | null> => {

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