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

const solutionId = solution.id;

const RATE_LIMIT_SETTING = {
    points: _.isNonEmptyString(process.env.RATE_LIMIT_POINTS_PER_SECOND) ? parseInt(process.env.RATE_LIMIT_POINTS_PER_SECOND) : 6, // 6 points
    duration: 1, // Per second
};

_.cognito = new AWS.CognitoIdentityServiceProvider({ region: process.env.REGION });
_.rateLimiter = new RateLimiterMemory(RATE_LIMIT_SETTING);
_.cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider();
_.track = `${process.env.TRACK}`.toLowerCase() == 'true';
_.trackLibs = `${process.env.TRACK_LIBS}`.toLowerCase() == 'true';

_.secretsManager = new AWS.SecretsManager({ region: process.env.REGION });
_.s3 = new AWS.S3({ region: process.env.REGION });
_.sns = new AWS.SNS({ region: process.env.REGION });
_.ses = new AWS.SES({ region: process.env.REGION });
_.dynamoDb = new AWS.DynamoDB.DocumentClient({ region: process.env.REGION });

_.graphDb = null;
_.secret = null;
_.elasticSearchCache = null;
_.s3Uploader = null;



_.callFromAWSEvents = (event) => {
    return event.source == "aws.events";
};


_.getRecordToken = (event) => {
    let token = _.getPropValueOfEvent(event, "recordToken");
    if (!_.isNonEmptyString(token)) token = _.getPropValueOfEvent(event, "token");
    return token;
};

_.getApiToken = (event) => {
    return _.getPropValueOfEvent(event, "apiToken");
};


_.getSourceIp = (event) => {
    return event.identity && event.identity.sourceIp;
};

_.getAccessToken = (event) => {
    return _.getPropValueOfEvent(event, 'accessToken');
};




_.getUploadSetting = async (type, fileName) => {

    //let params = { Bucket: bucketName, Key: event.body.key, ACL: access, ContentType: 'image/jpg' };
    const bucket = `${process.env.RESOURCE_PREFIX}-${type.toLowerCase()}`;
    let result = '';
    try {
        result = {
            bucket, key: fileName,
            url: await (await _.s3Uploader()).getSignedUrlPromise('putObject', { Bucket: bucket, Key: fileName, ACL: 'public-read-write', ContentType: _.getContentType(type, fileName) })
        };

    }
    catch (error) {
        result = null;
        console.error(error);
    }

    return result;
};

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


_.createRecordToken = async (data, expiredOn, settings) => {

    if (!_.isObject(settings)) settings = {};

    return _.encrypt(
        `${data.id}.${_.dateTimeNumber(expiredOn || new Date("9999-12-31T23:59:59.999Z"))}.${_.newGuid()}`,
        await _.getSecretValue('SECRET_CODE'),
        await _.getSecretValue('SECRET_IV')
    );
};

//The checkRecordTokenBase can be used wherever we do not want to use await
_.checkRecordTokenBase = async (recordToken, id) => {

    //If there's no token, it is failed
    if (!_.isNonEmptyString(recordToken)) return false;

    const secretCode = await _.getSecretValue('SECRET_CODE');
    const secretIV = await _.getSecretValue('SECRET_IV');

    const result = _.decrypt(recordToken, secretCode, secretIV).split(".");

    //if (_.trackLibs) console.log("checkRecordToken", result);

    //Only record token is accepted
    //RecordToken: recordId.expiredOn.randomId e.g. ad4d5afc-b92a-48a0-895f-67c9faf27363.1610497569554.8902fb1a-2a60-413d-9252-8c10ff2a6556
    if (result.length != 3) return false;

    return _.sameGuid(result[0], id);
};


_.s3Uploader = async () => {

    if (!_.s3Uploader) {

        const s3UploaderSecret = (await _.getSecretValue('S3_UPLOADER')).split("|");

        _.s3Uploader = new AWS.S3({
            region: process.env.REGION,
            accessKeyId: s3UploaderSecret[0],
            secretAccessKey: s3UploaderSecret[1]
        });
    }

    return _.s3Uploader;
};

_.elasticSearch = async () => {

    if (!_.elasticSearchCache) {
        const elasticSearchSecret = (await _.getSecretValue('ELASTIC_SEARCH')).split("|");
        _.elasticSearchCache = new SearchClient({
            node: elasticSearchSecret[0],
            auth: {
                username: elasticSearchSecret[1],
                password: elasticSearchSecret[2],
            },
        });
    }

    return _.elasticSearchCache;
};

_.elasticQuery = async (query) => {
    const es = await _.elasticSearch();
    return (await es.search(query)).body;
};

_.elasticDelete = async (index, id) => {
    const es = await _.elasticSearch();
    await es.delete({ index, id });
};

_.elasticUpsert = async (index, data) => {
    const es = await _.elasticSearch();
    await es.index({ index, id: data.id, body: data });
};

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


_.handleActionSQS = async (event) => {

    const queueItems = event.Records;

    for (var i = 0; i < queueItems.length; i++) {

        const message = JSON.parse(queueItems[i].body);
        const records = message.Records;
        for (var j = 0; _.isArray(records) && j < records.length; j++) {

            const record = records[j];
            const bucketName = record.s3.bucket.name;
            const fileName = record.s3.object.key;
            const snsTopic = fileName.split('/')[2];  //fileName: `${solutionId}/${organizationId}/${snsTopic}/${id}.json`

            try {

                const message = JSON.stringify({ bucketName, fileName });
                const topicArn = `${process.env.SNS_TOPIC_ARN_PREFIX}-${snsTopic}`;

                if (_.track) console.log(`Publishing to SNS ${topicArn}`);

                await _.sns.publish({ Message: message, TopicArn: topicArn }).promise();
                if (_.track) console.log(`The action ${message} was sent to ${topicArn}.`);

            }
            catch (error) {
                console.error({ error });
            }
        }
    }

    return _.onSuccess(event, {});
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