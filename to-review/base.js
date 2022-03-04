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

import { solution } from "../../shared/metadata/solution";
import _ from "../../shared/util/base";
import { RateLimiterMemory } from 'rate-limiter-flexible';
import AWS from 'aws-sdk';
import CryptoJS from "crypto-js";
import { Base64 } from 'js-base64';
import { Client as SearchClient } from "@elastic/elasticsearch";
import { CosmosClient } from '@azure/cosmos';
import slugify from 'slugify';
import { verifyReCaptchaToken } from './auth';
import {DYNAMO_DB_TABLE_NAME_CACHE} from '../libs/constants'


const Graph = require('gremlin');
// import qs from 'qs';


//START: CACHE
_.getDynamoDbCache = async (key) => {
    const params = { TableName: CACHE_TABLE_NAME, Key: { key } };
    params.AttributesToGet = ["content"];
    const cache = (await _.dynamoDb.get(params).promise()).Item;
    return cache && cache.content ? cache.content : null;
};

//expire: mins
_.setDynamoDbCache = async (key, content, expireMinutes) => {

    try {
        const cache = {
            key, content
        };

        if (_.isInteger(expireMinutes) && expireMinutes > 0) {
            cache.ttl = _.ttl(expireMinutes);
        }
        else {
            cache.ttl = _.ttl(30 * 24 * 60); //30 days default
        }

        await _.dynamoDb.put({
            TableName: DYNAMO_DB_TABLE_NAME_CACHE,
            Item: cache
        }).promise();
    }
    catch (error) {
        console.error(error);
    }
};

_.getS3Cache = async (key) => {

    if (!_.isNonEmptyString(key)) return null;

    try {
        const v = (await _.s3.getObject({
            Bucket: DYNAMO_DB_TABLE_NAME_CACHE,
            Key: `${_.slug(key)}.txt`
        }).promise()).Body.toString();

        if (_.isNonEmptyString(v)) {
            const result = JSON.parse(v);
            if (_.isInteger(result.ttl) && Date.now() > result.ttl * 1000)  //.ttl is in seconds
            {
                return null;
            }
            if (!_.isNil(result.cache)) return result.cache;
        }

    }
    catch (error) {
        console.error(error);
    }

    return null;
};

_.getS3CacheObject = async (key) => {

    const v = await _.getS3Cache(key);
    if (_.isNonEmptyString(v)) {
        try {
            return JSON.parse(v);
        }
        catch (error) {
            console.error(error);
        }
    }
    return null;
};

_.setS3Cache = async (key, content, expireMinutes) => {

    if (!_.isNonEmptyString(key)) return null;
    const data = {};
    if (_.isInteger(expireMinutes) && expireMinutes > 0) {
        data.ttl = _.ttl(expireMinutes);
    }
    else {
        data.ttl = _.ttl(30 * 24 * 60); //30 days default
    }

    if (_.isNonEmptyString(content)) data.cache = content;
    try {
        await _.s3.putObject({
            Bucket: `${process.env.RESOURCE_PREFIX}-cache`,
            Key: `${_.slug(key)}.txt`,
            Body: JSON.stringify(data)
        }).promise();
    }
    catch (error) {
        console.error(error);
    }
};

_.setS3CacheObject = async (key, content, expireMinutes) => {
    await _.setS3Cache(key, JSON.stringify(content), expireMinutes);
};

_.isValidQueryForCache = (query, settings) => {

    if (!_.isObject(settings)) settings = {};
    const { organizationId, userId } = settings;

    if (!_.isObject(query)) return null;
    if (!_.isObject(query.cache)) return null;
    if (!_.isNonEmptyString(query.cache.applyTo)) return null;
    if (!_.isNonEmptyString(query.cache.key)) return null;


    const hasUser = _.isNonEmptyString(userId);
    if (hasUser && query.cache.applyTo != 'current' || !hasUser && query.cache.applyTo != 'anonymous') return null;
    if (hasUser && !_.isNonEmptyString(organizationId)) return null;


    if (query.cache.supportPage) {
        query.cache.key = `${query.cache.key}.p${_.isNumber(query.pageNumber) ? query.pageNumber : 0}`;
    }
    else {
        if (_.isNumber(query.pageNumber)) return null;
    }

    return query.applyTo == 'current' ? `${solutionId}/${organizationId}/${userId}/${query.cache.key}.json` : `${solutionId}/${query.cache.key}.json`;
};

_.getQueryCache = async (query, settings) => {

    const key = _.isValidQueryForCache(query, settings);
    if (!key) return null;

    try {
        let content = await _.getS3Cache(key);
        if (_.isNonEmptyString(content)) {
            content = JSON.parse(content);
            const data = content.data;
            data['_cache'] = _.utcMaxISOString();
            return new Date(content.expiredOn) > new Date() ? data : null;
        }
    }
    catch (error) {
        console.error({ error });
    }
    return null;
};

_.setQueryCache = async (query, data, settings) => {

    const key = _.isValidQueryForCache(query, settings);
    if (!key) return null;

    try {
        let expiredOn = _.isNumber(query.expire) ? _.utcISOString(new Date(), query.expire) : _.utcMaxISOString();
        await _.setS3Cache(key, JSON.stringify({ cache: query.cache, expiredOn, data }));
    }
    catch (error) {
        console.error({ error });
    }
};

//END: CACHE



const getGraphDb = async () => {

    const graphDbConnectionInfo = (await _.getSecretValue('GRAPH_DB')).split("|");
    const result = {};

    result.settings = {
        type: "gremlinDb",
        uri: graphDbConnectionInfo[0],
        key: graphDbConnectionInfo[1],
        collectionId: graphDbConnectionInfo[2],
        databaseId: graphDbConnectionInfo[3],
    };


    try {
        const authenticator = new Graph.driver.auth.PlainTextSaslAuthenticator(`/dbs/${result.settings.databaseId}/colls/${result.settings.collectionId}`, result.settings.key);
        result.client = new Graph.driver.Client(result.settings.uri, { authenticator, traversalsource: "g", rejectUnauthorized: true, mimeType: "application/vnd.gremlin-v2.0+json" });

        _.graphDb = result;
        return result;
    }
    catch (error) {
        console.error({ error, message: 'Failed to new GraphClient', settings: result.settings });
    }

    return null;
};

_.graphDbClient = async () => {
    if (_.graphDb) return _.graphDb.client;
    return (await getGraphDb()).client;
};

_.graphDbSettings = async () => {
    if (_.graphDb) return _.graphDb.settings;
    return (await getGraphDb()).settings;
};

_.dualCosmosDBs = (sourceConnection, targetConnection) => {
    const sourceCoreDBConnectionInfo = sourceConnection.split("|");
    const targetCoreDBConnectionInfo = targetConnection.split("|");

    const result = {};

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

        return result;
    }
    catch (error) {
        console.error({ error, message: 'Failed to new Dual CosmosClients', settings: result.settings });
    }
};


_.sendGraph = async (graph, settings) => {

    if (!_.isObject(settings)) settings = {};
    if (!(_.isArray(graph) && graph.length > 0)) throw new Error(`There's no graph provided in the array format.`);

    for (var i = 0; i < graph.length; i++) {
        const r = graph[i];
        if (!_.isObject(r.source) || !_.isObject(r.target) || !_.isNonEmptyString(r.relationship)) {
            throw new Error(`One of the mandatory props is not defined (source, target, relationship).`);
        }
    }

    settings.mergeData = true;
    return await _.sendAction('graph', { graph }, _.assign({ type: 'graph' }, settings));
};




export default _;