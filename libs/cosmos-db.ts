//  Copyright PrimeObjects Software Inc. and other contributors <https://www.primeobjects.com/>
// 
//  This source code is licensed under the MIT license.
//  The detail information can be found in the LICENSE file in the root directory of this source tree.

import { isArray, each } from 'lodash';
import { isNonEmptyString, isObject, _process } from 'douhub-helper-util';
import { getSecretValue } from './secret-manager';
import { CosmosClient } from '@azure/cosmos';

export const getCosmosDB = async () => {

    if (isObject(_process._cosmosDB)) return _process._cosmosDB;
    const secrets = await getSecretValue('COSMOS_DB');

    const coreDBConnectionInfo = secrets.split("|");
    _process._cosmosDB = {};
    _process._cosmosDB.settings = {
        type: "cosmosDB",
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

export const cosmosDBClient = async () => {
    return (await getCosmosDB()).client;
};

export const cosmosDBSettings = async () => {
    return (await getCosmosDB()).settings;
};

export const cosmosDBDatabase = async () => {
    return (await cosmosDBClient()).database((await cosmosDBSettings()).databaseId);
}

export const cosmosDBContainer = async () => {
    return (await cosmosDBDatabase()).container((await cosmosDBSettings()).collectionId);
}

export const cosmosDBDelete = async (data: Record<string, any>) => {
    await (await cosmosDBContainer()).item(data.id, isNonEmptyString(data.partitionKey) ? data.partitionKey : data.organizationId).delete();
};

export const cosmosDBQueryWithAzureInfo = async (query: string, parameters: Record<string, any>): Promise<Record<string, any>> => {
    try {
        return await (await cosmosDBContainer()).items.query({ query, parameters }, { enableCrossPartitionQuery: true }).fetchAll();
    }
    catch (error) {
        console.error('cosmosDBQueryWithAzureInfo-failed');
        console.error(JSON.stringify({ query, parameters }));
        throw error;
    }
};


export const cosmosDBQuery = async (query: string, parameters: Record<string, any>): Promise<Record<string, any>[]> => {
    try {
        const response = await cosmosDBQueryWithAzureInfo(query, parameters);
        return response.resources;
    }
    catch (error) {
        console.error('cosmosDBQuery-failed');
        console.error(JSON.stringify({ query, parameters }));
        throw error;
    }
};


export const cosmosDBRetrieve = async (query: string, parameters: Record<string, any>): Promise<Record<string, any> | null> => {
    try {
        const result = await cosmosDBQuery(query, parameters);
        return result.length > 0 ? result[0] : null;
    }
    catch (error) {
        console.error('cosmosDBRetrieve-failed');
        console.error(JSON.stringify({ query, parameters }));
        throw error;
    }
};

export const cosmosDBUpsert = async (data: Record<string, any>): Promise<Record<string, any>> => {
    return (await (await cosmosDBContainer()).items.upsert(data)).resource;
};


export const cosmosDBUpdateIfMatch = async (data: Record<string, any>) => {
    await (await cosmosDBContainer()).item(data.id).replace(data, { accessCondition: { type: "IfMatch", condition: data["_etag"] } });
};

export const cosmosDBUpdate = async (data: Record<string, any>): Promise<Record<string, any>> => {

    return (await (await cosmosDBContainer()).item(data.id).replace(data)).resource;
};

export const cosmosDBRetrieveByIds = async (ids: string[], settings?: {
    attributes?: string
}): Promise<Record<string, any>[]> => {

    if (ids.length == 0) return [];

    if (!isObject(settings)) settings = {};
    let attributes = settings?.attributes;

    attributes = !isNonEmptyString(attributes) ? '*' :
        `,${attributes}`.split(',').join(',c.').replace(/ /g, '').substring(1);

    const idParams: Record<string, any>[] = [];
    let idQuery = '';

    each(ids, (i, index) => {
        if (index == 0) {
            idQuery = `@id${index}`;
        }
        else {
            idQuery = `${idQuery}, @id${index}`;
        }
        idParams.push({
            name: `@id${index}`,
            value: i
        })
    });

    return await cosmosDBQuery(`SELECT ${attributes} FROM c WHERE c.id IN (${idQuery})`, idParams);
}

export const cosmosDBRetrieveById = async (id: string, settings?: {
    attributes?: string
}): Promise<Record<string, any> | null> => {

    if (!isNonEmptyString(id)) return null;
    if (!isObject(settings)) settings = {};
    let attributes = settings?.attributes;

    attributes = !isNonEmptyString(attributes) ? '*' :
        `,${attributes}`.split(',').join(',c.').replace(/ /g, '').substring(1);

    const data = await cosmosDBQuery(`SELECT ${attributes} FROM c WHERE c.id=@id`, [
        {
            name: '@id',
            value: id
        }
    ]);

    return isArray(data) && data.length == 1 ? data[0] : null;
};

export const getDualCosmosDBClients = (sourceConnection: string, targetConnection: string): Record<string, any> => {

    const sourceCoreDBConnectionInfo = sourceConnection.split("|");
    const targetCoreDBConnectionInfo = targetConnection.split("|");

    const result: Record<string, any> = {};

    result.source = {
        type: "cosmosDB",
        uri: sourceCoreDBConnectionInfo[0],
        key: sourceCoreDBConnectionInfo[1],
        collectionId: sourceCoreDBConnectionInfo[2],
        databaseId: sourceCoreDBConnectionInfo[3],
    };

    result.target = {
        type: "cosmosDB",
        uri: targetCoreDBConnectionInfo[0],
        key: targetCoreDBConnectionInfo[1],
        collectionId: targetCoreDBConnectionInfo[2],
        databaseId: targetCoreDBConnectionInfo[3],
    };

    try {
        result.sourceClient = new CosmosClient({
            endpoint: result.source.uri,
            key: result.source.key
        });

        result.targetClient = new CosmosClient({
            endpoint: result.target.uri,
            key: result.target.key
        });
    }
    catch (error) {
        console.error({ error, message: 'Failed to new Dual CosmosDB Clients', settings: result.settings });
    }

    return result;
};