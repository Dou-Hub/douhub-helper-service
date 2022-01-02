//  Copyright PrimeObjects Software Inc. and other contributors <https://www.primeobjects.com/>
// 
//  This source code is licensed under the MIT license.
//  The detail information can be found in the LICENSE file in the root directory of this source tree.


import { S3 } from 'aws-sdk';
import { isNil } from 'lodash';
import { getContentType, _process, isObject, isObjectString, _track } from 'douhub-helper-util';
import { bool } from 'aws-sdk/clients/signer';

export type S3Result = {
    versionId: string,
    size: number,
    isLatest: boolean,
    modifiedOn: string,
    content: string
}

export type S3ResultObject = {
    versionId: string,
    size: number,
    isLatest: boolean,
    modifiedOn: string,
    content: Record<string, any>
}

export const getS3 = (region?: string) => {
    if (!region) region = _process.env.REGION;
    if (!region) region = 'us-east-1';

    if (isNil(_process._s3)) _process._s3 = {};
    if (!_process._s3[region]) _process._s3[region] = new S3({ region });
    return _process._s3[region];
}

export const s3Exist = async (bucketName: string, fileName: string, region?: string): Promise<boolean> => {
    try {
        if (await getS3(region).headObject({
            Bucket: bucketName,
            Key: fileName
        }).promise()) {
            return true;
        }
        else { return false; }
    }
    catch (error: any) {
        if (_track) console.error({ source: 's3Exist', error, bucketName, fileName, region });
        //throw error;
        return false;
    }
};

export const s3Put = async (bucketName: string, fileName: string, content: string, region?: string) => {
    try {
        return await getS3(region).putObject({
            Bucket: bucketName,
            Key: fileName,
            Body: content
        }).promise();
    }
    catch (error: any) {
        if (_track) console.error({ source: 's3Put', error, bucketName, fileName, region });
        throw error;
    }
};

export const s3PutObject = async (bucketName: string, fileName: string, content: Record<string, any>, region?: string) => {
    try {
        return await s3Put(bucketName, fileName, isNil(content) ? '' : JSON.stringify(content), region);
    }
    catch (error: any) {
        if (_track) console.error({ source: 's3PutObject', error, bucketName, fileName, region });
        throw error;
    }
};

export const s3Get = async (bucketName: string, fileName: string, region?: string, versionId?: string): Promise<S3Result | null> => {
    try {
        return await s3GetDetail(bucketName, fileName, region, versionId);
    }
    catch (error: any) {
        if (_track) console.error({ source: 's3Get', error, bucketName, fileName, versionId, region });
        throw error;
    }
}

export const s3GetDetail = async (bucketName: string, fileName: string, region?: string, versionId?: string): Promise<S3Result | null> => {
    // const params = versionId ? {
    //     Bucket: bucketName,
    //     Key: fileName,
    //     VersionId: versionId
    // } : {
    //     Bucket: bucketName,
    //     Key: fileName
    // };

    try {
        const result = await getS3(region).getObject({
            Bucket: bucketName,
            Key: fileName,
            VersionId: versionId
        }).promise();

        return {
            versionId: result.VersionId,
            isLatest: result.IsLatest,
            size: result.ContentLength,
            modifiedOn: result.LastModified,
            content: result.Body.toString()
        };
    }
    catch (error: any) {
        if (_track) console.error({ source: 's3GetDetail', error, bucketName, fileName, versionId, region });
        throw error;
    }
};

export const s3GetObject = async (bucketName: string, fileName: string, versionId?: string, region?: string): Promise<Record<string, any> | null | undefined> => {
    try {
        const result = await s3GetObjectDetail(bucketName, fileName, versionId, region);
        return isObject(result) && isObject(result?.content) ? result?.content : null;
    }
    catch (error: any) {
        if (_track) console.error({ source: 's3GetObject', error, bucketName, fileName, versionId, region });
        throw error;
    }
};

export const s3GetObjectDetail = async (bucketName: string, fileName: string, versionId?: string, region?: string): Promise<S3ResultObject | null | undefined> => {
    try {
        const result = await s3GetDetail(bucketName, fileName, versionId, region);
        return result ? { ...result, content: isObjectString(result ? result.content : '') ? JSON.parse(result ? result.content : '{}') : null } : null;

    }
    catch (error: any) {
        if (_track) console.error({ source: 's3GetObjectDetail', error, bucketName, fileName, versionId, region });
        throw error;
    }
};

export const s3Delete = async (bucketName: string, fileName: string, region?: string) => {
    try {
        return await getS3(region).deleteObject({
            Bucket: bucketName,
            Key: fileName
        }).promise();
    }
    catch (error: any) {
        if (_track) console.error({ source: 's3Delete', error, bucketName, fileName, region });
        throw error;
    }
};


export const s3SignedUrl = async (bucketName: string, fileName: string,
    acl: 'public-read-write',
    expires: 3600,
    region?: string
) => {
    try {
        return await getS3(region).getSignedUrlPromise('putObject',
            {
                Bucket: bucketName,
                Key: fileName,
                Expires: expires,
                ACL: acl,
                ContentType: getContentType(fileName)
            })
    }
    catch (error: any) {
        if (_track) console.error({ source: 's3SignedUrl', error, bucketName, fileName, region, acl, expires });
        throw error;
    }
}