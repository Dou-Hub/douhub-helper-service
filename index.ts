//  Copyright PrimeObjects Software Inc. and other contributors <https://www.primeobjects.com/>
// 
//  This source code is licensed under the MIT license.
//  The detail information can be found in the LICENSE file in the root directory of this source tree.

export {
    getSecretValue,
    getSecret
} from './libs/secret-manager';

export {
    getS3,
    s3Exist,
    s3Put,
    s3PutObject,
    s3Get,
    s3GetObject,
    s3Delete,
    s3SignedUrl
} from './libs/s3';

export {
    DYNAMO_DB_TABLE_NAME_PROFILE,
    DYNAMO_DB_TABLE_NAME_CACHE,
    S3_BUCKET_NAME_DATA,
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
    getCosmosDb,
    cosmosDbClient,
    cosmosDbSettings,
    cosmosDBDelete,
    cosmosDBQuery,
    cosmosDBUpsert,
    cosmosDBUpdateIfMatch,
    cosmosDBUpdate,
    cosmosDBRetrieve
} from './libs/cosmos-db';

export {
    createCognitoUser,
    deleteCognitoUser,
    updateCognitoPassword,
    getCognito
} from './libs/cognito'