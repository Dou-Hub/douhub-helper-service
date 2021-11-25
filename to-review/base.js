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
import { GUID_EMPTY, HTTPERROR_429, HTTPERROR_403, HTTPERROR_400 } from "../../shared/util/constants";
import CryptoJS from "crypto-js";
import { Base64 } from 'js-base64';
import { Client as SearchClient } from "@elastic/elasticsearch";
import { CosmosClient } from '@azure/cosmos';
import slugify from 'slugify';
import { verifyReCaptchaToken } from './auth';

const Graph = require('gremlin');
// import qs from 'qs';

const solutionId = solution.id;
export const DYNAMO_DB_TABLE_NAME_PROFILE = `${process.env.RESOURCE_PREFIX}-profile`;
export const CACHE_TABLE_NAME = `${process.env.RESOURCE_PREFIX}-cache`;

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
_.cosmosDb = null;
_.graphDb = null;
_.secret = null;
_.elasticSearchCache = null;
_.s3Uploader = null;


_.slug = (text) => {
    return !_.isNonEmptyString(text) ? null : slugify(text.replace(/_/g, '-'), {
        lower: 'true',
        remove: /[=:?#@!$&'()*+,;"<>%{}|\\^`]/g
    })
        .replace(/\./g, '-')
        .replace(/\//g, '-')
        .toLowerCase();
};


//Encrypt a string with key and iv
_.encrypt = (s, key, iv) => {

    if (!_.isNonEmptyString(key)) throw 'Encrypt key is not provided.';
    if (!_.isNonEmptyString(iv)) throw 'Encrypt iv is not provided.';
    try {
        let result = CryptoJS.AES.encrypt(s, CryptoJS.MD5(key), { iv: CryptoJS.MD5(iv), mode: CryptoJS.mode.CBC });

        result = result.ciphertext.toString(CryptoJS.enc.Base64);
        return Base64.encode(result);
    }
    catch (error) {
        console.error(error);
        return '';
    }
};

//Decrypt a string with key and iv
_.decrypt = (s, key, iv) => {

    if (!_.isNonEmptyString(key)) throw 'Decrypt key is not provided.';
    if (!_.isNonEmptyString(iv)) throw 'Decrypt iv is not provided.';

    try {
        s = CryptoJS.enc.Base64.parse(s).toString(CryptoJS.enc.Utf8);
        const result = CryptoJS.AES.decrypt(s, CryptoJS.MD5(key), { iv: CryptoJS.MD5(iv), mode: CryptoJS.mode.CBC });
        return result.toString(CryptoJS.enc.Utf8);
    }
    catch (error) {
        console.error(error);
        return '';
    }
};


_.callFromAWSEvents = (event) => {
    return event.source == "aws.events";
};

_.getObjectValueOfEvent = (event, name, defaultValue) => {
    if (!_.isObject(defaultValue)) defaultValue = null;
    const val = _.getPropValueOfEvent(event, name);
    try {
        return _.isObject(val) ? val : (_.isNonEmptyString(val) ? JSON.parse(val) : defaultValue);
    }
    catch (error) {
        console.error({ error, name, defaultValue, val });
    }
    return null;
};

_.getGuidValueOfEvent = (event, name, defaultValue) => {
    if (!_.isGuid(defaultValue)) defaultValue = null;
    const val = _.getPropValueOfEvent(event, name);
    return _.isGuid(val) ? val : defaultValue;
};

_.getIntValueOfEvent = (event, name, defaultValue) => {
    if (!_.isNumber(defaultValue)) defaultValue = null;
    const val = _.getPropValueOfEvent(event, name);
    return !isNaN(parseInt(val)) ? parseInt(val) : defaultValue;
};

_.getFloatValueOfEvent = (event, name, defaultValue) => {
    if (!_.isNumber(defaultValue)) defaultValue = null;
    const val = _.getPropValueOfEvent(event, name);
    return !isNaN(parseFloat(val)) ? parseFloat(val) : defaultValue;
};


_.getBooleanValueOfEvent = (event, name, defaultValue) => {
    if (!_.isBoolean(defaultValue)) defaultValue = null;
    const val = _.getPropValueOfEvent(event, name);
    if (`${val}`.toLowerCase() == 'true') return true;
    if (`${val}`.toLowerCase() == 'false') return false;
    return _.isNil(defaultValue) ? null : `${defaultValue}`.toLowerCase() == 'true';
};


_.getArrayPropValueOfEvent = (event, name, defaultValue) => {
    if (!_.isArray(defaultValue)) defaultValue = null;
    const val = _.getPropValueOfEvent(event, name);
    return _.isArray(val) ? val : _.isNonEmptyString(val) ? JSON.parse(val) : defaultValue;
};

_.getPropValueOfEvent = (event, name, defaultValue) => {

    let v = _.getPropValueOfObject(event.headers, name);
    if (!v) v = _.getPropValueOfObject(event.path, name);
    if (!v) v = _.getPropValueOfObject(event.body, name);
    if (!v) v = _.getPropValueOfObject(event.query, name);

    return !_.isNil(v) ? v : (_.isNil(defaultValue) ? null : defaultValue);
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

_.getSecretValue = async (name) => {
    const secret = await _.retrieveSecret();
    const value = secret ? secret[name] : null;
    return value;
};

_.retrieveSecret = async () => {

    // Create a Secrets Manager client
    if (!_.secret) _.secret = await _.secretsManager.getSecretValue({ SecretId: process.env.RESOURCE_PREFIX }).promise();

    if ('SecretString' in _.secret) {
        return JSON.parse(_.secret.SecretString);
    } else {
        let buff = new Buffer(_.secret.SecretBinary, 'base64');
        return buff.toString('ascii');
    }
};


_.throw = (name, detail) => {

    console.error({ type: 'managed', name, detail });
    throw { type: 'managed', name, detail };
};

//Render error result
_.onError = (error, settings) => {

    console.error({ error, settings: JSON.stringify(settings) });

    if (!_.isObject(settings)) settings = {};
    const { name, detail, callback } = settings;

    const newError = _.assign({ name, detail }, _.isObject(error) ? error : { error });

    newError.statusCode = newError.statusCode || 500;
    newError.statusName = newError.statusName || newError.name;

    //TODO: Logo the error to a storage, send action to handle it by other services

    if (callback) callback({ error: newError });
    return { error: newError };
};

//Render success result
_.onSuccess = (event, data, statusCode) => {
    //cx.event.identity.userAgent==='Local', this is defined in the serverless local invoke profile
    //when userAgent==='Local', it means the developer is running the function locally
    //Because the serverless local invoke can't render application/json and a true JSON in the body properly
    //In this case,we will have to convert a true JSON to be strinified and use text/plain

    const isLocal = event && event.identity && event.identity.userAgent === "Local";
    const contentType = !_.isObject(data) || isLocal ? "text/plain" : "application/json";
    let body = data;
    if (isLocal && _.isObject(data)) body = JSON.stringify(data);

    const result = {
        statusCode: _.isNumber(statusCode) ? statusCode : 200,
        headers: { "Content-Type": contentType },
        body,
    };

    return result;
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

//START: S3

_.s3Exist = async (bucketName, fileName) => {
    return new Promise(function (resolve) {
        _.s3.headObject({
            Bucket: bucketName,
            Key: fileName
        }, function (err) {
            if (err) {
                resolve(false);
            }
            else {
                resolve(true);
            }
        });
    });
};

_.s3Put = async (bucketName, fileName, content) => {
    await _.s3.putObject({
        Bucket: bucketName,
        Key: fileName,
        Body: content
    }).promise();
};

_.s3PutObject = async (bucketName, fileName, content) => {
    await _.s3Put(bucketName, fileName, _.isNil(content) ? '' : JSON.stringify(content));
};

_.s3Get = async (bucketName, fileName, versionId) => {

    const params = versionId ? {
        Bucket: bucketName,
        Key: fileName,
        VersionId: versionId
    } : {
        Bucket: bucketName,
        Key: fileName
    };

    const result = await _.s3.getObject(params).promise();

    return {
        versionId: result.VersionId,
        size: result.ContentLength,
        modifiedOn: result.LastModified,
        content: result.Body.toString()
    };

};

_.s3GetObject = async (bucketName, fileName, versionId) => {
    const result = await _.s3Get(bucketName, fileName, versionId);
    return {
        versionId: result.versionId,
        size: result.size,
        modifiedOn: result.modifiedOn,
        content: _.isNonEmptyString(result.content) ? JSON.parse(result.content) : null
    };
};

_.s3Delete = async (bucketName, fileName) => {
    return new Promise(function (resolve, reject) {
        _.s3.deleteObject({
            Bucket: bucketName,
            Key: fileName
        },
            function (err, url) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(url);
                }
            });
    });
};

//END: S3

//START: TOKEN
_.encryptToken = async (id) => {
    return _.encrypt(
        id,
        await _.getSecretValue('SECRET_CODE'),
        await _.getSecretValue('SECRET_IV'));
};

_.upsertToken = async (userId, type, data, allowMultiple) => {

    const id = `tokens.${userId}`;
    let token = null;
    let profile = (await _.dynamoDb.get({ TableName: DYNAMO_DB_TABLE_NAME_PROFILE, Key: { id } }).promise()).Item;
    if (!_.isObject(profile)) {
        //if there is no the user tokens profile, we will create one
        token = { token: await _.encryptToken(`${userId}|${type}|${_.newGuid()}`), createdOn: _.utcISOString(), type, data };
        await _.dynamoDb.put({
            TableName: DYNAMO_DB_TABLE_NAME_PROFILE, Item: {
                createdOn: _.utcISOString(), id, tokens: [token]
            }
        }).promise();
    }
    else {
        if (allowMultiple) {
            token = { token: await _.encryptToken(`${userId}|${type}|${_.newGuid()}`), createdOn: _.utcISOString(), type, data };
            profile.tokens.push(token);
            await _.dynamoDb.put({
                TableName: DYNAMO_DB_TABLE_NAME_PROFILE, Item: profile
            }).promise();
        }
        else {
            profile.tokens = _.map(profile.tokens, (t) => {
                if (t.type == type) {
                    t.data = data;
                    token = t;
                }
                return t;
            });
            if (!token) {
                token = { token: await _.encryptToken(`${userId}|${type}|${_.newGuid()}`), createdOn: _.utcISOString(), type, data };
                profile.tokens.push(token);
                await _.dynamoDb.put({
                    TableName: DYNAMO_DB_TABLE_NAME_PROFILE, Item: profile
                }).promise();
            }
        }
    }

    return token;
};

_.userToken = async (userId, organizationId, roles) => {
    const type = 'user';
    let token = await _.getToken(userId, type);
    if (!token) {
        token = await _.upsertToken(userId, type, { userId, organizationId, roles });
    }
    return token;
};

_.getToken = async (userId, type) => {

    const id = `tokens.${userId}`;
    const profile = (await _.dynamoDb.get({ TableName: DYNAMO_DB_TABLE_NAME_PROFILE, Key: { id } }).promise()).Item;
    if (!_.isObject(profile)) return null;
    const token = _.find(profile.tokens, (t) => t.type == type);
    return token || null;
};

_.checkToken = async (token) => {

    try {
        const userId = (await _.decrypt(token,
            await _.getSecretValue('SECRET_CODE'),
            await _.getSecretValue('SECRET_IV'))).split('|')[0];
        const id = `tokens.${userId}`;
        const profile = (await _.dynamoDb.get({ TableName: DYNAMO_DB_TABLE_NAME_PROFILE, Key: { id } }).promise()).Item;
        if (!_.isObject(profile)) return null;
        const result = _.find(profile.tokens, (t) => t.token == token);
        return _.isObject(result) && _.isObject(result.data) ? result.data : null;
    }
    catch (error) {
        return null;
    }
};
//END: TOKEN

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
            TableName: CACHE_TABLE_NAME,
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
            Bucket: CACHE_TABLE_NAME,
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

_.getDomain = (event, skipQueryValue) => {

    let domain = skipQueryValue ? null : _.getPropValueOfObject(_.isObject(event.query) ? event.query : {}, "domain");
    if (!_.isNonEmptyString(domain)) domain = _.getPropValueOfObject(event.headers, "origin");
    if (!_.isNonEmptyString(domain)) domain = _.getPropValueOfObject(event.headers, "referer");

    //try to get domain name from the origin header
    if (_.isNonEmptyString(domain)) {
        const location = _.getWebLocation(domain);
        if (location) domain = location.host;
    }

    return domain;
};


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

_.parseApiToken = async (event) => {

    let apiToken = _.getApiToken(event);

    if (_.isNonEmptyString(apiToken)) {

        try {
            const tokenData = await _.checkToken(apiToken);
            //TODO: Use tokenData to check permissions
            return _.isObject(tokenData) ? tokenData : null;
        } catch (error) {
            console.error("ERROR_CURSOLUTIONUSER_BADAPITOKEN", error);
        }
    }
    return null;
};

_.parseAccessToken = async (event) => {

    const accessToken = _.getAccessToken(event);
    if (_.isNonEmptyString(accessToken)) {
        //user.authorization = event.headers.Authorization;
        //user.accessToken = accessToken;

        //get user info
        //if (_.trackLibs) console.log("getUser by accessToken - start");
        const cognitoUser = await _.cognitoIdentityServiceProvider
            .getUser({ AccessToken: accessToken })
            .promise();

        //if (_.trackLibs) console.log("getUser by accessToken - end");
        if (_.isObject(cognitoUser) && _.isNonEmptyString(cognitoUser.Username)) {
            const userNameInfo = cognitoUser.Username.split(".");
            const organizationId = userNameInfo[0];
            const userId = userNameInfo[1];

            //Try to get user token, because it has roles & licenses
            const userToken = await _.getToken(userId, 'user');
            if (_.isNil(userToken)) throw 'Missing user token record';
            const { roles, licenses } = userToken;

            return { accessToken, userId, organizationId, roles, licenses };
        }

    }

    return null;
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
        type: "cosmosDb",
        uri: sourceCoreDBConnectionInfo[0],
        key: sourceCoreDBConnectionInfo[1],
        collectionId: sourceCoreDBConnectionInfo[2],
        databaseId: sourceCoreDBConnectionInfo[3],
    };

    result.target = {
        type: "cosmosDb",
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

const getCosmosDb = async () => {

    if (_.cosmosDb) return _.cosmosDb;

    const coreDBConnectionInfo = (await _.getSecretValue('COSMOS_DB')).split("|");
    _.cosmosDb = {};

    _.cosmosDb.settings = {
        type: "cosmosDb",
        uri: coreDBConnectionInfo[0],
        key: coreDBConnectionInfo[1],
        collectionId: coreDBConnectionInfo[2],
        databaseId: coreDBConnectionInfo[3],
    };

    try {
        _.cosmosDb.client = new CosmosClient({
            endpoint: _.cosmosDb.settings.uri,
            key: _.cosmosDb.settings.key
        });
    }
    catch (error) {
        console.error({ error, message: 'Failed to new CosmosClient', settings: _.cosmosDb.settings });
        _.cosmosDb = null;
    }

    return _.cosmosDb;
};

_.cosmosDbClient = async () => {
    if (_.cosmosDb) return _.cosmosDb.client;
    return (await getCosmosDb()).client;
};

_.cosmosDbSettings = async () => {
    if (_.cosmosDb) return _.cosmosDb.settings;
    return (await getCosmosDb()).settings;
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


_.sendMessage = async (template, regarding, settings) => {

    if (_.trackLibs) console.log({ template, regarding, settings });

    if (!_.isObject(settings)) settings = {};
    const errorDetail = { template, regarding, settings };

    if (!_.isObject(template)) _.throw('ERROR_API_SENDMESSAGE_TEMPLATE_NOT_DEFINED', errorDetail);

    const content = template.content;
    if (!_.isObject(content) || _.isObject(content) && Object.keys(content).length == 0) {
        _.throw('ERROR_API_SENDMESSAGE_TEMPLATE_CONTENT_NOT_DEFINED', errorDetail);
    }

    if (_.isArray(settings.methods) && settings.methods.length > 0) template.methods = settings.methods; //the method defined in the settings will overwrite the one from template
    if (!(_.isArray(template.methods) && template.methods.length > 0)) {
        template.methods = [];
        if (content.email) template.methods.push('email');
        if (content.sms) template.methods.push('sms');
        if (content.fcm) template.methods.push('fcm');
        if (content.chat) template.methods.push('chat.fifo');
    }

    if (!(_.isArray(template.methods) && template.methods.length > 0)) {
        _.throw('ERROR_API_SENDMESSAGE_TEMPLATE_METHOD_NOT_DEFINED', errorDetail);
    }

    if (_.isObject(settings.recipients)) {
        //the recipients defined in the settings will overwrite the one from template
        template.recipients = settings.recipients;
    }

    if (!(_.isArray(template.recipients.to) && template.recipients.to.length > 0)) {
        _.throw('ERROR_API_SENDMESSAGE_TEMPLATE_RECIPIENT_TO_NOT_DEFINED', errorDetail);
    }

    //the recipients defined in the settings will overwrite the one from template
    if (settings.sender) template.sender = settings.sender;
    if (!template.sender) template.sender = solution.sender;
    if (!template.sender) {
        _.throw('ERROR_API_SENDMESSAGE_TEMPLATE_SENDER_NOT_DEFINED', errorDetail);
    }

    const ignoreContext = template.ignoreContext && true || false;
    const ignoreUser = template.ignoreUser && true || false;
    const ignoreOrganization = template.ignoreOrganization && true || false;

    //the ignore settings in the template is for reduce the size of the message
    if (ignoreContext || ignoreUser) delete settings.user;
    if (ignoreContext || ignoreOrganization) delete settings.organization;

    //define context props to keep the object small
    if (_.isObject(settings.organization) && _.isNonEmptyString(template.contextOrganizationProps)) {
        settings.organization = _.getSubObject(settings.organization, template.contextOrganizationProps);
    }
    if (_.isObject(settings.user) && _.isNonEmptyString(template.contextUserProps)) {
        settings.user = _.getSubObject(settings.user, template.contextUserProps);
    }

    settings.mergeData = true;

    const ids = [];
    for (var i = 0; i < template.methods.length; i++) {

        ids.push(await _.sendAction(template.methods[i].toLowerCase(),
            { regarding, template },
            _.assign({ type: 'message' }, settings)));
    }

    return ids;
};

_.sendAction = async (snsTopic, data, settings) => {

    if (!_.isObject(settings)) settings = {};

    let { userId, organizationId, user, organization } = settings;

    if (!_.isNonEmptyString(snsTopic)) {
        return _.onError(
            HTTPERROR_400, {
            name: 'ERROR_API_MISSING_PARAMETERS',
            detail: {
                paramName: 'snsTopic',
                snsTopic, data, settings
            }
        });
    }

    if (settings.requireUserId && !_.isNonEmptyString(userId)) {
        return _.onError(
            HTTPERROR_400, {
            name: 'ERROR_API_MISSING_PARAMETERS',
            detail: {
                paramName: 'settings.userId',
                snsTopic, data, settings
            }
        });
    }
    if (settings.requireOrganizationId && !_.isNonEmptyString(organizationId)) {
        if (_.isObject(user) && _.isNonEmptyString(user.organizationId)) {
            organizationId = user.organizationId;
        }
        else {
            return _.onError(
                HTTPERROR_400, {
                name: 'ERROR_API_MISSING_PARAMETERS',
                detail: {
                    paramName: 'settings.organizationId',
                    snsTopic, data, settings
                }
            });
        }
    }

    if (!_.isObject(data)) data = {};
    if (!_.isNonEmptyString(settings.type)) settings.type = 'action';
    if (!_.isNonEmptyString(organizationId)) organizationId = GUID_EMPTY;

    const id = _.isNonEmptyString(settings.id) ? settings.id : _.newGuid();
    const name = _.isNonEmptyString(settings.name) ? settings.name : '';
    const s3FileName = `${solutionId}/${organizationId}/${snsTopic}/${_.isNonEmptyString(name) ? name + '/' : ''}${id}.json`;
    const s3BucketName = `${process.env.RESOURCE_PREFIX}-${settings.type}`;

    const item = _.assign((settings.mergeData ? data : { data }), { settings }, {
        id, createdOn: _.utcISOString(),
        user, organization,
        createdBy: userId, solutionId, organizationId,
        snsTopic, s3BucketName, s3FileName
    });
    if (_.isNonEmptyString(name)) item.name = settings.name;

    if (_.trackLibs) console.log(`send ${settings.type}`, JSON.stringify(item));

    try {
        await _.s3.putObject({
            Bucket: s3BucketName,
            Key: s3FileName,
            Body: JSON.stringify(item)
        }).promise();
    } catch (error) {
        return _.onError(
            error, {
            name: '_.sendAction',
            detail: {
                snsTopic, data, settings,
                s3BucketName, s3FileName
            }
        });
    }
    return item;
};

//START: COSMOSDB HELPER
_.cosmosDBDelete = async (data) => {

    const coreDBSettings = await _.cosmosDbSettings();
    const container = ((await _.cosmosDbClient()).database(coreDBSettings.databaseId)).container(coreDBSettings.collectionId);
    await container.item(data.id, _.isNonEmptyString(data.partitionKey) ? data.partitionKey : data.organizationId).delete();

};

_.cosmosDBQuery = async (query, parameters, settings) => {

    if (!_.isObject(settings)) settings = {};

    const { includeAzureInfo } = settings;

    const coreDBSettings = await _.cosmosDbSettings();
    const container = ((await _.cosmosDbClient()).database(coreDBSettings.databaseId)).container(coreDBSettings.collectionId);

    if (_.trackLibs) console.log({ coreDBSettings, query: JSON.stringify(query), parameters: JSON.stringify(parameters) });
    const response = await container.items.query({ query, parameters }, { enableCrossPartitionQuery: true }).fetchAll();
    return !includeAzureInfo ? response.resources : response;
};

_.cosmosDBUpsert = async (data) => {
    const coreDBSettings = await _.cosmosDbSettings();
    const container = ((await _.cosmosDbClient()).database(coreDBSettings.databaseId)).container(coreDBSettings.collectionId);
    await container.items.upsert(data);
};


_.cosmosDBUpdateIfMatch = async (data) => {
    const coreDBSettings = await _.cosmosDbSettings();
    const container = ((await _.cosmosDbClient()).database(coreDBSettings.databaseId)).container(coreDBSettings.collectionId);
    await container.item(data.id).replace(data, { accessCondition: { type: "IfMatch", condition: data["_etag"] } });
};

_.cosmosDBUpdate = async (data) => {
    const coreDBSettings = await _.cosmosDbSettings();
    const container = ((await _.cosmosDbClient()).database(coreDBSettings.databaseId)).container(coreDBSettings.collectionId);
    await container.item(data.id).replace(data);
};

_.cosmosDBRetrieve = async (id, settings) => {

    if (!_.isNonEmptyString(id)) return null;
    if (!_.isObject(settings)) settings = {};

    let { includeAzureInfo, attributes } = settings;

    attributes = !_.isNonEmptyString(attributes) ? '*' :
        `,${attributes}`.split(',').join(',c.').replace(/ /g, '').substring(1);

    const result = await _.cosmosDBQuery(`SELECT ${attributes} FROM c WHERE c.id=@id`, [
        {
            name: '@id',
            value: id
        }
    ], { includeAzureInfo: true });
    const data = result.resources;
    return !includeAzureInfo ? (_.isArray(data) && data.length == 1 ? data[0] : null) : result;
};
//END: COSMOSDB HELPER

//START: DYNAMODB HELPER

_.dynamoDbGet = async (tableName, keyName, keyValue) => {
    const key = {};
    key[keyName] = keyValue;
    const params = { TableName: tableName, Key: key };
    const result = (await _.dynamoDb.get(params).promise()).Item;
    return result;
};

_.dynamoDbSet = async (tableName, data) => {
    await _.dynamoDb.put({
        TableName: tableName,
        Item: data
    }).promise();
};

//END: DYNAMODB HELPER


export default _;