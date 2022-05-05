//  Copyright PrimeObjects Software Inc. and other contributors <https://www.primeobjects.com/>
// 
//  This source code is licensed under the MIT license.
//  The detail information can be found in the LICENSE file in the root directory of this source tree.

export {
    getSecretValue,
    getSecret
} from './libs/secret-manager';

export {
    getElasticSearch,
    elasticSearchDelete,
    elasticSearchQuery,
    elasticSearchUpsert
} from './libs/elastic-search';

export {
    getSNS,
    snsPublish
} from './libs/sns';

export {
    getSES,
    sesSend
} from './libs/ses';

export {
    getSendGrid,
    sgSend
} from './libs/send-grid';

export {
    sendEmail
} 
from './libs/email';

export {
    translateByAI,
    spellCheckByAI
} from './libs/ai';

export {
    S3Result,
    S3ResultObject,
    getS3,
    s3Exist,
    s3Put,
    s3PutObject,
    s3Get,
    s3GetDetail,
    s3GetObject,
    s3GetObjectDetail,
    s3Delete,
    s3SignedUrl
} from './libs/s3';

export {
    getCloudFront,
    cloudFrontSignedCookieForFolder,
    cloudFrontSignedUrl
} from './libs/cloudfront';

export {
    RESOURCE_PREFIX,
    DYNAMO_DB_TABLE_NAME_PROFILE,
    DYNAMO_DB_TABLE_NAME_CACHE,
    S3_BUCKET_NAME_DATA,
    S3_BUCKET_NAME_CACHE,
    AWS_REGION,
    AWS_SECRET_ID
} from './libs/constants';

export {
    getDynamoDB,
    dynamoDBCreate,
    dynamoDBRetrieve,
    dynamoDBDelete,
    dynamoDBUpsert
} from './libs/dynamo-db';


export {
    getCosmosDB,
    getDualCosmosDBClients,
    cosmosDBClient,
    cosmosDBSettings,
    cosmosDBDelete,
    cosmosDBQuery,
    cosmosDBQueryWithAzureInfo,
    cosmosDBUpsert,
    cosmosDBUpdateIfMatch,
    cosmosDBUpdate,
    cosmosDBRetrieve,
    cosmosDBRetrieveById,
    cosmosDBRetrieveByIds,
    cosmosDBContainer
} from './libs/cosmos-db';

export {
    createCognitoUser,
    deleteCognitoUser,
    updateCognitoPassword,
    getCognito
} from './libs/cognito'

export const DEFAULT_USER_ATTRIBUTES = 'id,avatar,firstName,lastName,title,company,introduction,media,url,twitter,icon';
export const DEFAULT_LOOKUP_ATTRIBUTES = 'id,avatar,firstName,lastName,fullName,name,title,display,text';
export const DEFAULT_AUTH_ATTRIBUTES = 'id,_rid,organizationId,solutionId,ownedBy,security,membership,isGlobal,entityName,entityType';
