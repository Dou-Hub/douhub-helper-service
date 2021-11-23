//  COPYRIGHT:       PrimeObjects Software Inc. (C) 2021 All Right Reserved
//  COMPANY URL:     https://www.primeobjects.com/
//  CONTACT:         developer@primeobjects.com
//
//  This source is subject to the DouHub License Agreements.
//
//  Our EULAs define the terms of use and license for each DouHub product.
//  Whenever you install a DouHub product or research DouHub source code file, you will be prompted to review and accept the terms of our EULA.
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

//Process SNS Records
export const processSNSRecords = async (records, onMessage, onError) => {

    const finished = [];
    const failed = [];
    for (var i = 0; i < records.length; i++) {
        const record = records[i];
        const message = JSON.parse(record.Sns.Message);
        try {
            if (onMessage) await onMessage(message);
            finished.push({ message });
        } 
        catch (error) 
        {
            const errorInfo = {
                detail:{record}
            };
            _.onError(error, errorInfo);
            if (onError) await onError(error, errorInfo);
            failed.push({ message, error });
        }
    }

    return { finished, failed };
};


//record -> {bucketName, fileName}
//We will read the action detail from S3 file
export const getActionDataFromSNSRecord = async (record) => {
    return JSON.parse((await _.s3.getObject({
        Bucket: record.bucketName,
        Key: record.fileName
    }).promise()).Body.toString());
};

export const validateActionDataFromSNSRecord = (event, data, settings) => {

    if (!_.isObject(settings)) settings = {};

    if (!_.isObject(data) && !settings.ignoreData) {
         _.throw(
            'ERROR_API_MISSING_PARAMETERS',
            {
                statusCode: 400,
                event,
                detail: {
                    paramName: 'data',
                    data, settings
                }
            });
    }

    if (settings.requireUserId && !_.isNonEmptyString(settings.userId)) {
         _.throw(
            'ERROR_API_MISSING_PARAMETERS',
            {
                statusCode: 400,
                event,
                detail: {
                    paramName: 'settings.userId',
                    data, settings
                }
            });
    }

    if (settings.requireOrganizationId && !_.isNonEmptyString(settings.organizationId)) {
        if (_.isObject(settings.user) && _.isNonEmptyString(settings.user.organizationId)) {
            settings.organizationId = settings.user.organizationId;
        }
        else {
            _.throw(
                'ERROR_API_MISSING_PARAMETERS',
                {
                    statusCode: 400,
                    event,
                    detail: {
                        paramName: 'settings.organizationId',
                        data, settings
                    }
                });
        }
    }

    if (settings.requireOrganization && !_.isObject(settings.organization)) {
        _.throw(
            'ERROR_API_MISSING_PARAMETERS',
            {
                statusCode: 400,
                event,
                detail: {
                    paramName: 'settings.organization',
                    data, settings
                }
            });
    }

    if (settings.requireUser && !_.isObject(settings.user)) {
        _.throw(
            'ERROR_API_MISSING_PARAMETERS',
            {
                statusCode: 400,
                event,
                detail: {
                    paramName: 'settings.user',
                    data, settings
                }
            });
    }
};
